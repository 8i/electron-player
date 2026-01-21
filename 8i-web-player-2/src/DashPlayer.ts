import { WebGLRenderer } from "three";
import * as dashjs from "dashjs";
import * as THREE from "three";
import { isDesktop, isMobile, isSafari, isTablet } from "react-device-detect";
import { getHumanFileSize } from "./lib/getHumanFileSize";
import { delay } from "./lib/delay";
import { isValidURL } from "./lib/validators";
import {
  MIME_TYPE_MESH_FB,
  MIME_TYPE_MESH_MP4,
  TIMECODE_NUM_BITS,
  MIN_VIDEO_SIZE,
  DASH_PLAYER_EVENT_INITIALIZED,
  TIMECODE_PIXEL_STRIDE,
  TIMECODE_WIDTH,
  MEDIA_TYPE_AUDIO,
  EVENT_ERROR,
  ERR_NOT_IMPLEMENTED,
  DEFAULT_OPACITY,
  DEFAULT_CONTRAST,
} from "./lib/constants";

import { TriangularLogger } from "./classes/TriangularLogger";
import { fileLogger } from "./classes/FileLogger";
import { CustomSourceBuffer } from "./dash/CustomSourceBuffer";
import { isWebGL2Supported } from "./dash/helpers";
import { QualityManager } from "./dash/QualityManager";
import {
  PlaybackManager,
  PLAYBACK_STATE_INITIALIZED,
  PLAYBACK_STATE_PAUSED,
  PLAYBACK_STATE_PLAYING,
  TIMECODE_PIXEL_BUFFER_HEIGHT,
  TIMECODE_PIXEL_BUFFER_WIDTH,
} from "./dash/PlaybackManager";
import { isValidNumber } from "./lib/validators";
// import "requestidlecallback-polyfill";

import "fpsmeter";
import { getErrorTitle } from "./lib/getNormalizedError";

const DEBUG_CANVAS_WIDTH = 320;
const DEBUG_CANVAS_HEIGHT = TIMECODE_WIDTH * 4;

const DEBUG_TIMECODE_HEIGHT = TIMECODE_WIDTH;

export const MIN_FPS = -1;
export const MAX_FPS = 60;
export const DOT_WIDTH = 5;

export const MAX_TIMECODE_VALUE = 1 << TIMECODE_NUM_BITS;
export const HALF_MAX_TIMECODE_VALUE = MAX_TIMECODE_VALUE >> 1;

export const EVENT_TYPE_MANIFEST_LOADING = "manifestloading";
export const EVENT_TYPE_MANIFEST_LOADED = "manifestloaded";
export const EVENT_TYPE_QUALITY_CHANGE = "qualitychange";
export const EVENT_TYPE_FRAMERATE_CHANGE = "frameratechange";
export const EVENT_TYPE_DESTROY = "destroy";
export const EVENT_TYPE_DECRYPTION_KEY_RECEIVED = "keyreceived";

export const CRYPTO_PERMISSION_DECRYPT = "decrypt";
export const CRYPTO_ALGORITHM_JWK = "jwk";
export const CRYPTO_ALGORITHM_AES_CTR = "AES-CTR";
export const CRYPTO_ALGORITHM_A128CTR = "A128CTR";

export const WEB_XR_SESSION_IMMERSIVE_VR = "immersive-vr";
export const WEB_XR_SESSION_IMMERSIVE_AR = "immersive-ar";

export const DEFAULT_OPTIONS: DashPlayerOptions = {
  abr: true,
  loop: true,
  autoplay: false,
  muted: true,
  video: undefined,
  targetFPS: -1,
  maximumTextureSize: Infinity,
  displayDebugCanvas: true, //process.env.NODE_ENV === "development",
  displayFrameDebug: true,
  displayVideoTimecode: false,
  displayFramerate: true, //process.env.NODE_ENV === "development",
  licenseServerURL: undefined,
  enableDirectionalLight: !isMobile,
  opacity: DEFAULT_OPACITY,
  contrast: DEFAULT_CONTRAST,
};

type DashPlayerOptions = {
  abr?: boolean;
  loop?: boolean;
  autoplay?: boolean;
  muted?: boolean;
  targetFPS?: number;
  video?: HTMLVideoElement | null;
  maximumTextureSize: number;
  licenseServerURL?: string | undefined;
  displayDebugCanvas: boolean;
  displayFrameDebug: boolean;
  displayVideoTimecode: boolean;
  displayFramerate: boolean;
  enableDirectionalLight: boolean;
  opacity?: number;
  contrast?: number;
};

type DeviceCapabilities = {
  isMobile: boolean;
  isTablet: boolean;
  isDesktop: boolean;
  isSafari: boolean;
  webGL2: boolean;
  requestVideoFrameCallback: boolean;
  anisotropicExtension: boolean;
  webWorkers: boolean;
  supportImmersiveVR: boolean;
  supportImmersiveAR: boolean;
};

/**
 * A rewrite of the original 8i Dash player
 */
export class DashPlayer extends EventTarget {
  logger: TriangularLogger = null;
  // Whether the underlying video, textures etc have been successfully initialized.
  isInitialized = false;
  isRendering = false;

  qualityManager: QualityManager = null;
  playbackManager: PlaybackManager = null;
  meshSourceBuffer: CustomSourceBuffer = null;

  renderer: WebGLRenderer = null;
  video: HTMLVideoElement = null;

  fpsMeter: any = null;
  canvas?: HTMLCanvasElement = null;
  private videoDebugAbortController: AbortController | null = null;

  lastFrame = 0;

  gl: WebGLRenderingContext = null;
  player = null;

  manifestSrc = null;
  defaultMaterial: THREE.ShaderMaterial = null;
  mesh: THREE.Mesh = null;

  stagingTexture: THREE.Texture = null;
  renderTexture: THREE.Texture = null;
  pixelBuffer: THREE.WebGLRenderTarget = null;
  framebuffer: THREE.WebGLRenderTarget = null;

  // Used in `WebGLImplementation` in order to determine whether to use
  // `copyTexImage2D` or `copyTexSubImage2D`.
  private isTextureAllocated = false;
  private previousVideoWidth = 0;
  private previousVideoHeight = 0;

  options = {
    ...DEFAULT_OPTIONS,
  };

  deviceCapabilities: DeviceCapabilities = {
    isMobile,
    isTablet,
    isDesktop,
    isSafari,
    webGL2: false,
    requestVideoFrameCallback: false,
    anisotropicExtension: false,
    webWorkers: false,
    supportImmersiveVR: false,
    supportImmersiveAR: false,
  };

  constructor(renderer: WebGLRenderer, implementation, options: DashPlayerOptions) {
    super();

    this.logger = new TriangularLogger("8i Web Player");

    this.options = { ...this.options, ...options };

    this.renderer = renderer;

    this.logger.silly(`DashPlayer settings:`, this.options);

    this.gl = renderer.getContext();

    this.checkDeviceCapabilities();
    this.setupVideoElement();
    this.setupDebugCanvasElement();

    implementation.setup(this);

    // Must be implemented in Implementation
    this.setupTextures();
    this.setupMaterials();
    this.setupMesh();

    this.setupDashPlayer();
    this.setupQualityManager();
    this.setupPlaybackManager();
  }

  initialize = () => {
    if (this.isInitialized) {
      return;
    }

    this.installMediaSourcePolyfills();
    this.setupPlayerEventListeners();
    this.setupPublicAPI();
    // TODO: We should make use of await, but this creates a race condition
    // at the moment.
    this.checkAsyncDeviceCapabilities();
    this.isInitialized = true;
  };

  setupTextures() {
    throw new Error(ERR_NOT_IMPLEMENTED);
  }

  setupMaterials() {
    throw new Error(ERR_NOT_IMPLEMENTED);
  }

  setupMesh() {
    throw new Error(ERR_NOT_IMPLEMENTED);
  }

  copyVideoToStagingTexture() {
    throw new Error(ERR_NOT_IMPLEMENTED);
  }

  handleVideoResolutionChange() {
    const {
      logger,
      video: { videoWidth, videoHeight },
    } = this;
    logger.debug(`Video resolution changed to ${videoWidth}x${videoHeight}`);
  }

  processTimecode() {
    throw new Error(ERR_NOT_IMPLEMENTED);
  }

  async saveFrameAsGLTF() {
    throw new Error(ERR_NOT_IMPLEMENTED);
  }

  async saveFrameAsScreenshot() {
    throw new Error(ERR_NOT_IMPLEMENTED);
  }

  /**
   * Updates the render texture with the current video frame.
   */
  updateRenderTexture() {
    throw new Error(ERR_NOT_IMPLEMENTED);
  }

  setupDashPlayer() {
    this.player = dashjs.MediaPlayer().create();
  }

  setupQualityManager() {
    this.qualityManager = new QualityManager(this);
  }

  setupPlaybackManager() {
    this.playbackManager = new PlaybackManager(this);
  }

  async reset() {
    const { logger, player, meshSourceBuffer, playbackManager } = this;
    logger.debug("Resetting instance.");

    if (player) {
      player.reset();
    }
    if (playbackManager) {
      playbackManager.reset();
    }
    if (meshSourceBuffer) {
      meshSourceBuffer.reset();
    }
  }

  async loadManifest(src: string) {
    const { logger, mesh } = this;

    // TODO: This will trigger a new DASH_PLAYER_EVENT_INITIALIZED each time
    // a manifest is loading.
    this.isRendering = false;

    logger.debug(`Loading manifest: ${src}`);

    this.dispatchEvent(new CustomEvent(EVENT_TYPE_MANIFEST_LOADING, { detail: src }));

    this.isTextureAllocated = false;

    if (mesh.visible) {
      mesh.visible = false;
    }

    const {
      player,
      qualityManager,
      video,
      options: { licenseServerURL, autoplay },
    } = this;
    if (this.isInitialized) {
      await this.reset();
    } else {
      await this.initialize();
    }
    try {
      this.manifestSrc = src;

      await this.qualityManager.configure();
      // player.updateSettings(qualityManager.getDashSettings());

      let protData = undefined;

      if (isValidURL(licenseServerURL)) {
        protData = {
          "org.w3.clearkey": {
            serverURL: licenseServerURL,
          },
        };
      }

      if (protData) {
        player.setProtectionData(protData);
        // TODO: Prevent race condition. In some constellations,
        // `meshSourceBuffer` doesn't have yet a key.
        player.registerLicenseResponseFilter(async (response) => {
          const {
            url,
            data: { type: licenseType, keys },
          } = response;
          if (!this.meshSourceBuffer) {
            throw new Error(`No CustomSourceBuffer instance available`);
          }

          logger.info(`Retrieved ${keys.length} ${licenseType} key(s) from ${url}.`);

          for (const key of response.data.keys) {
            const importedKey = await window.crypto.subtle.importKey(
              CRYPTO_ALGORITHM_JWK,
              {
                kty: key.kty,
                k: key.k.replace(/=/g, ""),
                alg: CRYPTO_ALGORITHM_A128CTR,
                ext: true,
              },
              { name: CRYPTO_ALGORITHM_AES_CTR },
              false,
              [CRYPTO_PERMISSION_DECRYPT]
            );
            // TODO: Handle multiple keys, if applicable.
            this.meshSourceBuffer.setKey(importedKey);
          }
          const event = new CustomEvent(EVENT_TYPE_DECRYPTION_KEY_RECEIVED);
          this.dispatchEvent(event);
          return response;
        });
      }

      player.registerCustomCapabilitiesFilter(qualityManager.filterRepresentation);
      player.initialize(video, src, Boolean(autoplay));
    } catch (e) {
      const message = getErrorTitle(e);
      const event = new CustomEvent(EVENT_ERROR, {
        detail: `Could not load manifest: ${message}`,
      });
      this.dispatchEvent(event);
    }
  }

  async setTargetFPS(fps: number) {
    const { qualityManager, logger } = this;

    if (!isValidNumber(fps)) {
      throw new Error(`Expected a number, received: ${fps}`);
    }

    if (fps < MIN_FPS || fps > MAX_FPS) {
      throw new Error(`Expected target framerate within range ${MIN_FPS}-${MAX_FPS}`);
    }

    logger.debug(`Set target FPS to ${fps}`);

    qualityManager.targetFPS = fps;

    // TODO: Find a way to switch online between FPS
    // player.refreshManifest();
    return this.loadManifest(this.manifestSrc);
  }

  setOpacity(/*value: number*/) {
    throw new Error(ERR_NOT_IMPLEMENTED);
  }

  setContrast(/*value: number*/) {
    throw new Error(ERR_NOT_IMPLEMENTED);
  }

  destroy() {
    const { logger, player, mesh, qualityManager } = this;

    this.dispatchEvent(new CustomEvent(EVENT_TYPE_DESTROY));

    logger.debug("Destroying instance.");

    if (player) {
      player.off(dashjs.MediaPlayer.events.MANIFEST_LOADED, this.onManifestLoaded);
      player.off(dashjs.MediaPlayer.events.STREAM_INITIALIZED, this.onStreamInitialized);
      player.off(dashjs.MediaPlayer.events.ERROR, this.onPlayerError);
    }

    qualityManager.unbindEvents();

    try {
      player.destroy();
      // eslint-disable-next-line no-empty
    } catch {}

    this.player = null;

    if (mesh.parent) {
      try {
        mesh.parent.remove(mesh);
        // eslint-disable-next-line no-empty
      } catch {}
    }

    this.removeVideoElement();
  }

  setupPlayerEventListeners() {
    const { player, qualityManager } = this;
    player.on(dashjs.MediaPlayer.events.MANIFEST_LOADED, this.onManifestLoaded);
    player.on(dashjs.MediaPlayer.events.STREAM_INITIALIZED, this.onStreamInitialized);
    player.on(dashjs.MediaPlayer.events.ERROR, this.onPlayerError);
    qualityManager.addEventListener(EVENT_TYPE_QUALITY_CHANGE, this.onQualityChange);
    qualityManager.addEventListener(EVENT_TYPE_FRAMERATE_CHANGE, this.onFramerateChange);
  }

  setupPublicAPI() {
    const { player, qualityManager, playbackManager } = this;

    this.play = (...args) => {
      return playbackManager.play(...args);
    };

    this.isPaused = () => playbackManager.isPaused();
    this.isMuted = () => player.isMuted();
    this.setIsMuted = (value) => player.setMute(Boolean(value));
    this.setVolume = (value) => player.setVolume(value);

    this.getCurrentFrame = () => {
      const { fps } = qualityManager;
      return Math.floor(player.time() * fps);
    };

    this.getCurrentTime = () => player.time();
    this.getDuration = () => player.duration();
    this.getVideo = () => player.getVideoElement();
    this.getMeshSourceBuffer = () => this.meshSourceBuffer;

    this.pause = (...args) => {
      return playbackManager.pause(...args);
    };

    this.seek = (...args) => {
      return playbackManager.seek(...args);
    };
  }

  /**
   * Check capabilities of the current device.
   */
  checkDeviceCapabilities = async () => {
    const { gl, logger, deviceCapabilities } = this;
    deviceCapabilities.webGL2 = isWebGL2Supported();

    // TODO: Obtain device type

    // TODO: Check whether there is a better way to detect API support.
    deviceCapabilities.requestVideoFrameCallback = "requestVideoFrameCallback" in HTMLVideoElement.prototype;

    deviceCapabilities.anisotropicExtension =
      gl.getExtension("EXT_texture_filter_anisotropic") ||
      gl.getExtension("MOZ_EXT_texture_filter_anisotropic") ||
      gl.getExtension("WEBKIT_EXT_texture_filter_anisotropic");

    deviceCapabilities.webWorkers = Boolean(window.Worker);

    let supportImmersiveVR = false;

    try {
      if (!navigator.xr || !navigator.xr.isSessionSupported || !navigator.xr.requestSession) {
        throw new Error("Immersive VR support cannot be determined.");
      }
      supportImmersiveVR = await navigator.xr.isSessionSupported(WEB_XR_SESSION_IMMERSIVE_VR);
    } catch (e) {
      console.warn(`Could not determine immersive VR support: ${e.stack}`);
    }

    deviceCapabilities.supportImmersiveVR = supportImmersiveVR;

    logger.silly("Capabilities:", deviceCapabilities);
  };

  checkAsyncDeviceCapabilities = async () => {
    const { logger, deviceCapabilities } = this;

    let supportImmersiveVR = false;
    let supportImmersiveAR = false;

    try {
      if (!navigator.xr || !navigator.xr.isSessionSupported || !navigator.xr.requestSession) {
        throw new Error("Immersive VR support cannot be determined.");
      }
      supportImmersiveVR = await navigator.xr.isSessionSupported(WEB_XR_SESSION_IMMERSIVE_VR);
    } catch (e) {
      console.warn(`Could not determine immersive VR support: ${e.stack}`);
    }

    deviceCapabilities.supportImmersiveVR = supportImmersiveVR;

    try {
      if (!navigator.xr || !navigator.xr.isSessionSupported || !navigator.xr.requestSession) {
        throw new Error("Immersive VR support cannot be determined.");
      }
      supportImmersiveAR = await navigator.xr.isSessionSupported(WEB_XR_SESSION_IMMERSIVE_AR);
    } catch (e) {
      console.warn(`Could not determine immersive VR support: ${e.stack}`);
    }

    deviceCapabilities.supportImmersiveAR = supportImmersiveAR;

    logger.silly("Capabilities:", deviceCapabilities);
  };

  /**
   * Creates the underlying video element which is used in order to play back the actual stream. On iOS, it is required
   * that the video element is in view.
   */
  setupVideoElement() {
    const {
      options: { loop, muted, displayVideoTimecode, video: videoElementFromOptions },
    } = this;
    const video = videoElementFromOptions ? videoElementFromOptions : document.createElement("video");
    if (!videoElementFromOptions) {
      if (displayVideoTimecode) {
        video.style.position = "absolute";
        video.style.top = "0px";
        video.style.right = "0px";
      } else {
        video.style.position = "fixed";
        video.style.top = "0px";
        video.style.right = "0px";
        video.style.width = "2px";
        video.style.height = "2px";
        video.style.zIndex = "998";
        video.style.display = "block";
        video.style.opacity = "0.01";
      }
      video.style.pointerEvents = "none";
    }

    video.setAttribute("crossorigin", "anonymous");
    video.setAttribute("playsinline", "playsinline");

    // Prevent the decryption of the raw video stream.
    video.setMediaKeys = () => Promise.resolve();

    if (!videoElementFromOptions) {
      let container;
      if (displayVideoTimecode) {
        container = document.createElement("div");
        container.style.left = `${DEBUG_CANVAS_WIDTH - TIMECODE_PIXEL_BUFFER_WIDTH}px`;
        container.style.overflow = "hidden";
        container.style.zIndex = "998";
        container.style.display = "block";

        container.style.pointerEvents = "none";
        document.body.append(container);
        container.style.position = "fixed";
        container.style.width = TIMECODE_PIXEL_BUFFER_WIDTH;
        container.style.height = "16px";
        container.style.top = `${DEBUG_CANVAS_HEIGHT}px`;
        container.append(video);
      } else {
        document.body.append(video);
      }
    }

    this.video = video;

    video.muted = Boolean(muted);
    video.loop = Boolean(loop);

    this.installVideoDebugLogging();
  }

  private installVideoDebugLogging() {
    const { video } = this;
    if (!video) {
      return;
    }

    // Tear down any previous listeners.
    if (this.videoDebugAbortController) {
      try {
        this.videoDebugAbortController.abort();
        // eslint-disable-next-line no-empty
      } catch {}
    }

    const abortController = new AbortController();
    this.videoDebugAbortController = abortController;

    const getBufferedRanges = () => {
      const ranges: Array<{ start: number; end: number }> = [];
      try {
        const b = video.buffered;
        for (let i = 0; i < b.length; i++) {
          ranges.push({ start: b.start(i), end: b.end(i) });
        }
      } catch {}
      return ranges;
    };

    const getBufferedAhead = (t: number) => {
      try {
        const b = video.buffered;
        for (let i = 0; i < b.length; i++) {
          const s = b.start(i);
          const e = b.end(i);
          if (t >= s && t <= e) {
            return e - t;
          }
        }
      } catch {}
      return NaN;
    };

    const getPlaybackQuality = () => {
      try {
        // Standard API (Chrome/Edge)
        if (typeof (video as any).getVideoPlaybackQuality === "function") {
          return (video as any).getVideoPlaybackQuality();
        }
        // WebKit counters
        return {
          webkitDecodedFrameCount: (video as any).webkitDecodedFrameCount,
          webkitDroppedFrameCount: (video as any).webkitDroppedFrameCount,
          webkitVideoDecodedByteCount: (video as any).webkitVideoDecodedByteCount,
        };
      } catch {
        return null;
      }
    };

    const logVideoEvent = (type: string) => {
      const currentTime = video.currentTime;
      const readyState = video.readyState;
      const networkState = video.networkState;
      const bufferedRanges = getBufferedRanges();
      const bufferedAhead = getBufferedAhead(currentTime);
      const error = video.error
        ? {
            code: video.error.code,
            message: (video.error as any).message,
          }
        : null;

      fileLogger.debug("VIDEO_EVENT", {
        type,
        currentTime,
        readyState,
        networkState,
        paused: video.paused,
        ended: video.ended,
        seeking: video.seeking,
        playbackRate: video.playbackRate,
        bufferedRanges,
        bufferedAhead,
        error,
        playbackQuality: getPlaybackQuality(),
      });
    };

    const opts: AddEventListenerOptions & { signal: AbortSignal } = { passive: true, signal: abortController.signal };

    // High-signal events for diagnosing stalls.
    video.addEventListener("waiting", () => logVideoEvent("waiting"), opts);
    video.addEventListener("stalled", () => logVideoEvent("stalled"), opts);
    video.addEventListener("error", () => logVideoEvent("error"), opts);
    video.addEventListener("canplay", () => logVideoEvent("canplay"), opts);
    video.addEventListener("canplaythrough", () => logVideoEvent("canplaythrough"), opts);
    video.addEventListener("playing", () => logVideoEvent("playing"), opts);
    video.addEventListener("pause", () => logVideoEvent("pause"), opts);
    video.addEventListener("seeking", () => logVideoEvent("seeking"), opts);
    video.addEventListener("seeked", () => logVideoEvent("seeked"), opts);
    video.addEventListener("ratechange", () => logVideoEvent("ratechange"), opts);

    // Snapshot once at install time.
    logVideoEvent("install");
  }

  /**
   * Creates the underlying video element which is used in order to play back the actual stream. On iOS, it is required
   * that the video element is in view.
   */
  setupDebugCanvasElement() {
    const {
      options: { displayDebugCanvas, displayFramerate },
    } = this;

    if (displayDebugCanvas) {
      const canvas = document.createElement("canvas");
      canvas.style.position = "fixed";
      canvas.style.top = `0px`;
      canvas.style.left = "0px";
      canvas.style.zIndex = "998";
      // canvas.style.opacity = "0.5";
      canvas.style.pointerEvents = "none";

      document.body.append(canvas);
      this.canvas = canvas;
    }

    const top = displayDebugCanvas ? 64 : 0;

    if (displayFramerate) {
      const fpsMeter = new FPSMeter({
        interval: 1e3,
        top,
        left: 0,
        zIndex: 1000,
      });
      this.fpsMeter = fpsMeter;
    }
  }

  /**
   * Removes the video element, if applicable.
   */
  removeVideoElement() {
    const { video } = this;
    if (!video) {
      return;
    }

    if (this.videoDebugAbortController) {
      try {
        this.videoDebugAbortController.abort();
        // eslint-disable-next-line no-empty
      } catch {}
      this.videoDebugAbortController = null;
    }

    if (!video.paused) {
      try {
        video.pause();
        // eslint-disable-next-line no-empty
      } catch {}
    }

    if (video.parentElement) {
      video.parentElement.removeChild(video);
    }
    this.video = null;
  }

  attachVideoFrameCallback() {
    const { /*logger, */ video } = this;

    // logger.silly(`Attaching \`requestVideoFrameCallback\` render loop to video:`, video);

    const onUpdate = () => {
      if (!this.video) {
        // logger.silly(`Stopping \`requestVideoFrameCallback\` render loop.`);
        return;
      }
      this.update();
      video.requestVideoFrameCallback(onUpdate);
    };

    video.requestVideoFrameCallback(onUpdate);

    if (window.requestIdleCallback) {
      const onFallbackUpdate = () => {
        if (!this.video) {
          return;
        }
        if (this.video.paused) {
          this.update();
        }
        window.requestIdleCallback(onFallbackUpdate);
      };
      window.requestIdleCallback(onFallbackUpdate);
    } else {
      const onFallbackUpdate = () => {
        if (!this.video) {
          return;
        }
        if (this.video.paused) {
          this.update();
        }
        window.requestAnimationFrame(onFallbackUpdate);
      };
      window.requestAnimationFrame(onFallbackUpdate);
    }
  }

  startRenderLoop() {
    // const { logger, video } = this;
    // logger.silly(`Attaching \`requestAnimationFrame\` render loop to video:`, video);

    const onUpdate = () => {
      // logger.silly(`Stopping \`requestAnimationFrame\` render loop.`);
      if (!this.video) {
        return;
      }
      this.update();
      window.requestAnimationFrame(onUpdate);
    };
    window.requestAnimationFrame(onUpdate);
  }

  async installMediaSourcePolyfills() {
    const {
      /*logger,*/
      video,
      deviceCapabilities: { webWorkers },
    } = this;
    // logger.silly("Installing Polyfills.");
    // eslint-disable-next-line @typescript-eslint/no-this-alias
    const self = this;
    const mediaSource = window.MediaSource || window.ManagedMediaSource;

    // MediaSource API not available
    if (typeof mediaSource === "undefined") {
      const event = new CustomEvent(EVENT_ERROR, {
        detail: `MediaSource API not available.`,
      });

      this.dispatchEvent(event);
      await delay(1e3);
      alert("MediaSource API not available.");
      return;
    }

    // Use a polyfill on the video's MediaSource API to intercept calls to addSourceBuffer
    const originalAddSourceBuffer = mediaSource.prototype.addSourceBuffer;

    // Usage of web workers depends on device support for web workers.
    const useSync = webWorkers === false;

    // The MPEG-DASH streams contain audio, video and mesh.
    const addSourceBuffer = function (...args) {
      const mimeType = args[0];
      if (mimeType === MIME_TYPE_MESH_FB || mimeType === MIME_TYPE_MESH_MP4) {
        // TODO: Ensure that all resources are freed up completely.
        if (self.meshSourceBuffer) {
          // logger.info(`Destroying existing CustomSourceBuffer`);
          self.meshSourceBuffer.abort();
          self.meshSourceBuffer.destroy();
        }

        const meshSourceBuffer = new CustomSourceBuffer(mimeType, useSync, video);

        // logger.silly(
        //   `Created new (${useSync ? "synchronous" : "asynchronous)"}) CustomSourceBuffer for ${mimeType}:`,
        //   meshSourceBuffer
        // );
        self.meshSourceBuffer = meshSourceBuffer;

        return meshSourceBuffer;
      }
      return originalAddSourceBuffer.apply(this, args);
    };

    if (window.MediaSource) {
      window.MediaSource.prototype.addSourceBuffer = addSourceBuffer;
    }

    if (window.ManagedMediaSource) {
      window.ManagedMediaSource.prototype.addSourceBuffer = addSourceBuffer;
    }

    const originalIsTypeSupported = mediaSource.isTypeSupported;

    const isTypeSupported = function (codec) {
      if (codec === MIME_TYPE_MESH_FB || codec === MIME_TYPE_MESH_MP4) {
        return true;
      } else {
        return originalIsTypeSupported(codec);
      }
    };

    if (window.MediaSource) {
      window.MediaSource.isTypeSupported = isTypeSupported;
    }

    if (window.ManagedMediaSource) {
      window.ManagedMediaSource.isTypeSupported = isTypeSupported;
    }
  }

  onManifestLoaded = ({ data: manifest }) => {
    const { qualityManager } = this;

    try {
      qualityManager.parseManifest(manifest);

      const { framerates, meshRepresentations, videoRepresentations } = qualityManager;

      const event = new CustomEvent(EVENT_TYPE_MANIFEST_LOADED, {
        detail: {
          framerates,
          meshRepresentations,
          videoRepresentations,
        },
      });

      this.dispatchEvent(event);
    } catch (error) {
      const message = getErrorTitle(error);
      const event = new CustomEvent(EVENT_ERROR, {
        detail: `Could not parse manifest: ${message}`,
      });

      this.dispatchEvent(event);
    }
  };

  onStreamInitialized = (e) => {
    const { logger } = this;

    logger.silly("onStreamInitialized", e);
  };

  onPlayerError = (e) => {
    const { logger } = this;
    const { error } = e;

    const message = getErrorTitle(error);

    if (error.code === dashjs.MediaPlayer.errors.MEDIA_KEY_MESSAGE_NO_LICENSE_SERVER_URL_ERROR_CODE) {
      const event = new CustomEvent(EVENT_ERROR, {
        detail: `Could not obtain stream keys: ${message}`,
      });

      this.dispatchEvent(event);
      return;
    }
    logger.error(message);
    const event = new CustomEvent(EVENT_ERROR, {
      detail: message,
    });

    this.dispatchEvent(event);
  };

  onQualityChange = (e) => {
    // const { video } = this;
    const event = new CustomEvent(EVENT_TYPE_QUALITY_CHANGE, {
      detail: e.detail,
    });

    this.dispatchEvent(event);
  };

  onFramerateChange = (e) => {
    // const { video } = this;
    const event = new CustomEvent(EVENT_TYPE_FRAMERATE_CHANGE, {
      detail: e.detail,
    });

    this.dispatchEvent(event);
  };

  onBufferEmpty = () => {
    // const { logger } = this;
    // logger.silly("onBufferEmpty");
  };

  onBufferLoaded = () => {
    // const { logger } = this;
    // logger.silly("onBufferLoaded");
  };

  update() {
    const { fpsMeter } = this;

    if (fpsMeter) {
      fpsMeter.tickStart();
    }
    this.updateVideo();
    if (fpsMeter) {
      fpsMeter.tick();
    }
  }

  updateVideo() {
    const {
      canvas,
      options: { displayFrameDebug },
      logger,
      video,
      meshSourceBuffer,
      qualityManager,
      mesh,
      playbackManager,
    } = this;

    if (!this.isInitialized) {
      return;
    }

    if (!video || !meshSourceBuffer || !meshSourceBuffer._isInitialized) {
      logger.debug(`No video or source buffer not initialized.`);
      return;
    }

    const currentTime = video.currentTime;

    const { readyState, videoWidth, videoHeight } = video;

    if (this.previousVideoWidth !== videoWidth || this.previousVideoHeight !== videoHeight) {
      this.handleVideoResolutionChange();
      this.previousVideoWidth = videoWidth;
      this.previousVideoHeight = videoHeight;
    }

    let canvasContext;

    if (canvas) {
      canvas.width = DEBUG_CANVAS_WIDTH;
      canvas.height = DEBUG_CANVAS_HEIGHT;
      canvasContext = canvas.getContext("2d");

      canvasContext.fillStyle = "#222222";
      canvasContext.fillRect(0, 0, DEBUG_CANVAS_WIDTH, DEBUG_CANVAS_HEIGHT);

      if (displayFrameDebug) {
        const timecodeLeft = DEBUG_CANVAS_WIDTH - TIMECODE_PIXEL_BUFFER_WIDTH;
        const pmImageData = canvasContext.createImageData(TIMECODE_PIXEL_BUFFER_WIDTH, TIMECODE_PIXEL_BUFFER_HEIGHT);
        pmImageData.data.set(playbackManager.timecodeBuffer);

        for (let i = 0; i < TIMECODE_WIDTH; ++i) {
          canvasContext.putImageData(pmImageData, timecodeLeft, i);
        }
        let timecodeString = "";

        for (let i = 0, index = 0; i < TIMECODE_NUM_BITS; ++i) {
          const x = i * TIMECODE_WIDTH + (TIMECODE_WIDTH >> 1);
          const y = DEBUG_TIMECODE_HEIGHT >> 1;

          const pixelValue1 = pmImageData.data[index];

          if (pixelValue1 < 127) {
            canvasContext.fillStyle = "red";
            timecodeString += "0";
          } else {
            canvasContext.fillStyle = "blue";
            timecodeString += "1";
          }
          canvasContext.fillRect(timecodeLeft + (x - DOT_WIDTH / 2), y - DOT_WIDTH / 2, DOT_WIDTH, DOT_WIDTH);
          index += TIMECODE_PIXEL_STRIDE * TIMECODE_WIDTH;
        }
        canvasContext.fillStyle = "#ffffff";
        canvasContext.fillText(`${timecodeString}`, timecodeLeft, DEBUG_TIMECODE_HEIGHT + 12);
      }

      canvasContext.fillStyle = "#ffffff";

      const chunks = [];

      for (const key in qualityManager.currentRepresentations) {
        if (key === MEDIA_TYPE_AUDIO) {
          continue;
        }
        chunks.push(`${key}: ${qualityManager.currentRepresentations[key]}`);
      }

      canvasContext.fillText(chunks.join(", "), 8, 12);
      canvasContext.fillText(`${qualityManager.fps} FPS`, 8, DEBUG_TIMECODE_HEIGHT + 12);
      canvasContext.fillText(
        `${getHumanFileSize(meshSourceBuffer.bytesReceived)} received`,
        50,
        DEBUG_TIMECODE_HEIGHT + 12
      );
    }

    // TODO: Update internal state
    if (readyState < video.HAVE_ENOUGH_DATA) {
      if (canvas) {
        canvasContext.fillText(`Not enough data`, 8, DEBUG_TIMECODE_HEIGHT * 2.75);
      }
      logger.debug(`Not enough data - video ready state: ${readyState}`);

      // Detailed file logging for debugging buffer issues
      const videoBuffered = video.buffered;
      const videoBufferedRanges: Array<{start: number, end: number}> = [];
      for (let i = 0; i < videoBuffered.length; i++) {
        videoBufferedRanges.push({
          start: videoBuffered.start(i),
          end: videoBuffered.end(i)
        });
      }

      const meshCanPlay = meshSourceBuffer?.canPlay?.(currentTime);
      const meshRanges = meshSourceBuffer?.ranges || [];
      const meshFrameCount = meshSourceBuffer?.frames?.size || 0;

      fileLogger.debug('NOT_ENOUGH_DATA', {
        currentTime,
        readyState,
        readyStateNames: ['HAVE_NOTHING', 'HAVE_METADATA', 'HAVE_CURRENT_DATA', 'HAVE_FUTURE_DATA', 'HAVE_ENOUGH_DATA'],
        readyStateName: ['HAVE_NOTHING', 'HAVE_METADATA', 'HAVE_CURRENT_DATA', 'HAVE_FUTURE_DATA', 'HAVE_ENOUGH_DATA'][readyState],
        videoWidth,
        videoHeight,
        videoPaused: video.paused,
        videoEnded: video.ended,
        videoBufferedRanges,
        meshCanPlay,
        meshRanges,
        meshFrameCount,
        meshBytesReceived: meshSourceBuffer?.bytesReceived || 0,
        playbackState: playbackManager?.state,
        fps: qualityManager?.fps
      });

      return;
    }

    // Skip processing the video frame in case it is too small.
    if (videoWidth <= MIN_VIDEO_SIZE || videoHeight <= MIN_VIDEO_SIZE) {
      if (canvas) {
        canvasContext.fillText(`Video too small`, 8, DEBUG_TIMECODE_HEIGHT * 2.75);
      }
      logger.debug(`Video too small: ${videoWidth}x${videoHeight}`);
      return;
    }
    if (canvas) {
      if (
        playbackManager.state !== PLAYBACK_STATE_PAUSED &&
        playbackManager.state !== PLAYBACK_STATE_PLAYING &&
        playbackManager.state !== PLAYBACK_STATE_INITIALIZED
      ) {
        canvasContext.fillText(`Mismatching playback state: ${playbackManager.state}`, 8, DEBUG_TIMECODE_HEIGHT * 3.75);
        // return;
      } else {
        canvasContext.fillText(playbackManager.state, 8, DEBUG_TIMECODE_HEIGHT * 3.6);
      }
    }

    // Check whether the current time is buffered in video and mesh track
    const isBuffered = playbackManager.checkPlayback(currentTime);

    if (!isBuffered) {
      if (canvas) {
        canvasContext.fillStyle = "#ffffff";
        canvasContext.fillText(`NO MESH AVAILABLE AT TIME`, 8, DEBUG_TIMECODE_HEIGHT * 2.75);
      }

      // Detailed file logging for mesh availability issues
      const videoBuffered = video.buffered;
      const videoBufferedRanges: Array<{start: number, end: number}> = [];
      for (let i = 0; i < videoBuffered.length; i++) {
        videoBufferedRanges.push({
          start: videoBuffered.start(i),
          end: videoBuffered.end(i)
        });
      }

      fileLogger.debug('NO_MESH_AVAILABLE', {
        currentTime,
        meshCanPlay: meshSourceBuffer?.canPlay?.(currentTime),
        meshRanges: meshSourceBuffer?.ranges || [],
        meshFrameCount: meshSourceBuffer?.frames?.size || 0,
        meshBytesReceived: meshSourceBuffer?.bytesReceived || 0,
        videoBufferedRanges,
        playbackState: playbackManager?.state,
        fps: qualityManager?.fps
      });

      // TODO: Implement heuristics in PlaybackManager in order to pause the
      // video while buffering.
      return;
    }

    this.copyVideoToStagingTexture();

    this.processTimecode(videoWidth);

    const timecodeFrame = playbackManager.process();

    const { timescale, frameDuration } = meshSourceBuffer;
    const scaledTime = currentTime * timescale;
    const alignedTime = Math.round(scaledTime / frameDuration) * frameDuration;
    const estimatedIdx = alignedTime / frameDuration;
    const bucketIndex = Math.floor(estimatedIdx / MAX_TIMECODE_VALUE) * MAX_TIMECODE_VALUE;

    // TODO: Consider frame look up using timestamps

    const wrappedFrameNum = bucketIndex + timecodeFrame;

    if (canvas) {
      canvasContext.fillStyle = "#ffffff";
      canvasContext.fillText(`${wrappedFrameNum}`, 8, DEBUG_TIMECODE_HEIGHT * 2.75);
    }

    const sample = meshSourceBuffer.getFrame(wrappedFrameNum);

    const sampleNotFound = false;

    if (!sample) {
      if (canvas) {
        canvasContext.fillText(`MISS`, 50, DEBUG_TIMECODE_HEIGHT * 2.75);
      }
      logger.debug(`Could not find sample at frame: ${wrappedFrameNum}, current time: ${currentTime}`);
      return;
    }

    if (sampleNotFound) {
      if (canvas) {
        canvasContext.fillText(`MISS (fix: time)`, 50, DEBUG_TIMECODE_HEIGHT * 2.75);
      }
    }

    this.lastFrame = wrappedFrameNum;
    const { geometry } = sample;

    // Update the geometry with the new decoded one.
    mesh.geometry.dispose();
    mesh.geometry = geometry;

    if (!mesh.visible) {
      mesh.visible = true;
    }

    if (!this.isRendering) {
      logger.silly(`Initial sample can be rendered at frame: ${wrappedFrameNum}, current time: ${currentTime}`);
      this.isRendering = true;
      this.dispatchEvent(new Event(DASH_PLAYER_EVENT_INITIALIZED));
    }
    this.updateRenderTexture();
  }
}
