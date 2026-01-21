import { TriangularLogger } from "../classes/TriangularLogger";
import {
  TIMECODE_WIDTH,
  TIMECODE_NUM_BITS,
  TIMECODE_PIXEL_STRIDE,
  VIDEO_MAX_WIDTH,
} from "../lib/constants";

export const TIMECODE_HEIGHT = 1;

export class TimecodeProcessor {
  logger: TriangularLogger;
  timecodeBuffer: Uint8ClampedArray;

  gl: WebGLRenderingContext | WebGL2RenderingContext = null;
  pbo: WebGLBuffer = null;
  framebuffer: WebGLFramebuffer = null;
  byteLength = 0;
  useWebGL2 = true;

  constructor(gl, pbo, framebuffer, useWebGL2 = false) {
    const logger = new TriangularLogger("TimecodeProcessor");

    this.logger = logger;

    const length = VIDEO_MAX_WIDTH * TIMECODE_HEIGHT * TIMECODE_PIXEL_STRIDE;
    this.byteLength = length;
    this.timecodeBuffer = new Uint8ClampedArray(length);
    this.framebuffer = framebuffer;
    this.gl = gl;
    this.pbo = pbo;
    this.useWebGL2 = Boolean(useWebGL2);

    logger.silly(`Using WebGL ${this.useWebGL2 ? 2 : 1} to process timecode`);
  }

  copyData(videoWidth) {
    const { useWebGL2, timecodeBuffer, framebuffer, gl, pbo } = this;

    if (useWebGL2) {
      gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer);
      gl.bindBuffer(gl.PIXEL_PACK_BUFFER, pbo);
      gl.bufferData(
        gl.PIXEL_PACK_BUFFER,
        VIDEO_MAX_WIDTH * TIMECODE_HEIGHT * TIMECODE_PIXEL_STRIDE,
        gl.STATIC_COPY,
      );
      gl.readPixels(
        videoWidth - TIMECODE_NUM_BITS * TIMECODE_WIDTH - 1,
        1,
        VIDEO_MAX_WIDTH,
        TIMECODE_HEIGHT,
        gl.RGBA,
        gl.UNSIGNED_BYTE,
        0,
      );
      gl.getBufferSubData(gl.PIXEL_PACK_BUFFER, 0, timecodeBuffer);
    } else {
      gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer);
      gl.readPixels(
        videoWidth - TIMECODE_NUM_BITS * TIMECODE_WIDTH - 1,
        1,
        VIDEO_MAX_WIDTH,
        TIMECODE_HEIGHT,
        gl.RGBA,
        gl.UNSIGNED_BYTE,
        timecodeBuffer,
      );
    }
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  }

  readTimecode() {
    const { timecodeBuffer } = this;
    const digitStride = TIMECODE_WIDTH * TIMECODE_PIXEL_STRIDE;
    let frameNum = 0;

    for (
      let position = 0, x = 0, value = 0;
      position < TIMECODE_NUM_BITS;
      position++
    ) {
      x = TIMECODE_NUM_BITS - position;
      value = timecodeBuffer[x * digitStride];
      if (value > 127) {
        frameNum += 1 << position;
      }
    }

    return frameNum;
  }

  process(videoWidth, videoHeight) {
    this.copyData(videoWidth, videoHeight);
    return this.readTimecode();
  }
}
