import * as THREE from "three";
import { downloadFromBlob } from "../lib/downloadFromBlob";
import RenderShaderFrag from "../shaders/standard.frag";
import RenderShaderLightFrag from "../shaders/light.frag";
import RenderShaderVert from "../shaders/standard.vert";
import RenderShaderLightVert from "../shaders/light.vert";
import { FRAME_BUFFER_HEIGHT, FRAME_BUFFER_WIDTH, MAX_BONE_TRANSFORMS, TIMECODE_PIXEL_STRIDE } from "../lib/constants";
import { TIMECODE_PIXEL_BUFFER_WIDTH, TIMECODE_PIXEL_BUFFER_HEIGHT } from "../dash/PlaybackManager";
import { processVideoTexture } from "../lib/processVideoTexture";

export class DashPlayerWebGLImplementation {
  setup(player) {
    this.player = player;
    player.setupTextures = this.setupTextures.bind(player);
    player.setupMaterials = this.setupMaterials.bind(player);
    player.setupMesh = this.setupMesh.bind(player);
    player.copyVideoToStagingTexture = this.copyVideoToStagingTexture.bind(player);
    player.updateRenderTexture = this.updateRenderTexture.bind(player);
    player.createTexture = this.createTexture.bind(player);
    player.createFramebuffer = this.createFramebuffer.bind(player);
    player.createPixelBuffer = this.createPixelBuffer.bind(player);
    player.processTimecode = this.processTimecode.bind(player);
    player.saveFrameAsGLTF = this.saveFrameAsGLTF.bind(player);
    player.saveFrameAsScreenshot = this.saveFrameAsScreenshot.bind(player);
    player.handleVideoResolutionChange = this.handleVideoResolutionChange.bind(player);
    player.setOpacity = this.setOpacity.bind(player);
    player.setContrast = this.setContrast.bind(player);
  }
  processTimecode(videoWidth) {
    const {
      framebuffer,
      gl,
      pixelBuffer,
      playbackManager: { timecodeByteLength, useWebGL2, timecodeBuffer },
    } = this;

    const x = videoWidth - TIMECODE_PIXEL_BUFFER_WIDTH;
    const y = 0;

    if (useWebGL2) {
      gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer);
      gl.bindBuffer(gl.PIXEL_PACK_BUFFER, pixelBuffer);
      gl.bufferData(gl.PIXEL_PACK_BUFFER, timecodeByteLength, gl.STATIC_COPY);
      gl.readPixels(x, y, TIMECODE_PIXEL_BUFFER_WIDTH, TIMECODE_PIXEL_BUFFER_HEIGHT, gl.RGBA, gl.UNSIGNED_BYTE, 0);
      gl.getBufferSubData(gl.PIXEL_PACK_BUFFER, 0, timecodeBuffer);
    } else {
      gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer);
      gl.readPixels(
        x,
        y,
        TIMECODE_PIXEL_BUFFER_WIDTH,
        TIMECODE_PIXEL_BUFFER_HEIGHT,
        gl.RGBA,
        gl.UNSIGNED_BYTE,
        timecodeBuffer
      );
    }
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  }

  handleVideoResolutionChange() {
    const {
      logger,
      video: { videoWidth, videoHeight },
    } = this;
    logger.info(`Video resolution changed to ${videoWidth}x${videoHeight} - Resetting textures.`);
    this.isTextureAllocated = false;
  }

  /**
   * Saves the current frame as a GLTF (binary) file.
   */
  async saveFrameAsGLTF(filename = "screenshot.glb") {
    const { mesh, video } = this;

    const wasPlaying = !video.paused;

    if (wasPlaying) {
      video.pause();
    }

    const object3D = mesh.clone();
    const previousMaterial = object3D.material.clone();
    object3D.material = new THREE.MeshStandardMaterial();
    object3D.material.map = await processVideoTexture(video);

    const { GLTFExporter } = await import("three/examples/jsm/exporters/GLTFExporter.js");
    const gltfExporter = new GLTFExporter();

    const options = {
      onlyVisible: false,
      binary: true,
      embedImages: true,
    };

    gltfExporter.parse(
      object3D,
      (buffer) => {
        downloadFromBlob(new Blob([buffer], { type: "model/gltf-binary" }), filename);
        object3D.material = previousMaterial;
        if (wasPlaying) {
          video.play();
        }
      },
      (error) => {
        console.log(`error ${error}`);
        object3D.material = previousMaterial;
      },
      options
    );
  }

  async saveFrameAsScreenshot(filename = "screenshot.png") {
    const { renderer } = this;

    renderer.domElement.toBlob((blob) => {
      blob.name = "screenshot.png";
      downloadFromBlob(blob, filename);
    });
  }

  setupTextures() {
    const {
      gl,
      renderer,
      deviceCapabilities: { anisotropicExtension },
    } = this;

    const stagingTexture = this.createTexture();
    const framebuffer = this.createFramebuffer(stagingTexture);
    const renderTexture = this.createTexture();
    const pixelBuffer = this.createPixelBuffer();

    if (anisotropicExtension) {
      gl.bindTexture(gl.TEXTURE_2D, renderTexture);
      const value = Math.min(10, gl.getParameter(anisotropicExtension.MAX_TEXTURE_MAX_ANISOTROPY_EXT));

      // logger.silly(`Capping anisotropic filtering to ${value} for performance.`);

      gl.texParameterf(gl.TEXTURE_2D, anisotropicExtension.TEXTURE_MAX_ANISOTROPY_EXT, value);
    }

    gl.bindTexture(gl.TEXTURE_2D, null);

    // Manually assign the `renderTexture` to `texProps.__webglTexture`.
    //
    // This manual assignment helps to bypass the automatic texture upload/update mechanism
    // of `THREE.js` and ensure that the correct WebGL texture is bound in GPU memory.
    //
    // By explicitly setting `texProps.__webglTexture = renderTexture`, we:
    // - Force `THREE.js` to recognize and bind the correct WebGL texture, bypassing
    //   the usual texture upload/update flow which may cause delays or inconsistencies.
    // - Eliminate issues with flickering or black screens by ensuring that `renderTexture`
    //   always has a valid WebGL texture reference, ready for rendering.
    const texProps = renderer.properties.get(renderTexture);
    texProps.__webglTexture = renderTexture;

    this.pixelBuffer = pixelBuffer;
    this.framebuffer = framebuffer;
    this.stagingTexture = stagingTexture;
    this.renderTexture = renderTexture;
  }

  setupMaterials() {
    const {
      renderTexture,
      options: { enableDirectionalLight, opacity, contrast },
    } = this;
    const boneTransforms = new Array(MAX_BONE_TRANSFORMS);
    boneTransforms.fill(new THREE.Matrix4());

    const uniforms = THREE.UniformsUtils.clone(THREE.ShaderMaterial.uniforms);
    uniforms.videoMap = new THREE.Uniform(renderTexture);

    uniforms.opacity = new THREE.Uniform(opacity);
    uniforms.contrast = new THREE.Uniform(contrast);
    uniforms.boneTransforms = new THREE.Uniform(boneTransforms);

    const defaultMaterial = new THREE.ShaderMaterial({
      glslVersion: THREE.GLSL1,
      defaultAttributeValues: {
        weightsAtt: [0, 0, 0, 0],
        bindingsAtt: [0, 0, 0, 0],
      },
      uniforms,
      vertexShader: enableDirectionalLight ? RenderShaderLightVert : RenderShaderVert,
      fragmentShader: enableDirectionalLight ? RenderShaderLightFrag : RenderShaderFrag,
      transparent: true,
      side: THREE.DoubleSide,
    });

    this.defaultMaterial = defaultMaterial;
  }

  setOpacity(value: number) {
    const { logger } = this;
    if (!this.mesh) {
      logger.warn(`setOpacity: ${value} - No mesh available`);
      return;
    }
    logger.debug(`setOpacity: ${value}`);
    const {
      mesh: { material },
    } = this;
    material.uniforms.opacity.value = value;
  }

  setContrast(value: number) {
    const { logger } = this;
    if (!this.mesh) {
      logger.warn(`setContrast: ${value} - No mesh available`);
      return;
    }
    logger.debug(`setContrast: ${value}`);
    const {
      mesh: { material },
    } = this;
    material.uniforms.contrast.value = value;
  }

  setupMesh() {
    const { defaultMaterial } = this;
    const mesh = new THREE.Mesh(undefined, defaultMaterial);

    if (!mesh) {
      throw new Error("Failed to initalize mesh");
    }

    this.mesh = mesh;
  }

  copyVideoToStagingTexture() {
    const { gl, stagingTexture, video } = this;
    gl.bindTexture(gl.TEXTURE_2D, stagingTexture);
    if (this.isTextureAllocated) {
      gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, gl.RGBA, gl.UNSIGNED_BYTE, video);
    } else {
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, video);
    }
    // gl.bindTexture(gl.TEXTURE_2D, null);
  }

  /**
   * Updates the render texture with the current video frame.
   */
  updateRenderTexture() {
    const {
      gl,
      renderTexture,
      framebuffer,
      video: { videoWidth, videoHeight },
    } = this;
    gl.bindTexture(gl.TEXTURE_2D, renderTexture);
    gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer);

    if (this.isTextureAllocated) {
      gl.copyTexSubImage2D(gl.TEXTURE_2D, 0, 0, 0, 0, 0, videoWidth, videoHeight);
    } else {
      gl.copyTexImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 0, 0, videoWidth, videoHeight, 0);
      // TODO: This is an optimization which should reduce the amount of memory allocation.
      // This currently doesn't work in case the texture size changes dynamically.
      // this.isTextureAllocated = true;
    }
    // gl.bindTexture(gl.TEXTURE_2D, null);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  }

  /**
   * Create a new WebGL texture with default values.
   */
  createTexture() {
    const { gl } = this;
    const texture = gl.createTexture();
    if (!texture) {
      throw new Error("Failed to create WebGL texture");
    }
    gl.bindTexture(gl.TEXTURE_2D, texture);

    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, FRAME_BUFFER_WIDTH, FRAME_BUFFER_HEIGHT, 0, gl.RGB, gl.UNSIGNED_BYTE, null);

    gl.bindTexture(gl.TEXTURE_2D, null);
    return texture;
  }

  /**
   * Create a new WebGL framebuffer with default values.
   * @param texture
   */
  createFramebuffer(texture: WebGLTexture): WebGLFramebuffer {
    const { gl } = this;
    const framebuffer = gl.createFramebuffer();
    if (!framebuffer) {
      throw new Error("Failed to create WebGL framebuffer");
    }
    gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, texture, 0);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    return framebuffer;
  }

  /**
   * Create a new pixel buffer with default values.
   * The buffer is used in `timecode` in order to hold the current frame's
   * frame number.
   */
  createPixelBuffer(): WebGLBuffer {
    const { gl } = this;
    const pixelBuffer = gl.createBuffer();
    if (!pixelBuffer) {
      throw new Error("Failed to create WebGL pixel buffer");
    }
    gl.bindBuffer(gl.PIXEL_PACK_BUFFER, pixelBuffer);
    gl.bufferData(
      gl.PIXEL_PACK_BUFFER,
      TIMECODE_PIXEL_BUFFER_WIDTH * TIMECODE_PIXEL_BUFFER_HEIGHT * TIMECODE_PIXEL_STRIDE,
      gl.STATIC_COPY
    );
    gl.bindBuffer(gl.PIXEL_PACK_BUFFER, null);
    return pixelBuffer;
  }
}
