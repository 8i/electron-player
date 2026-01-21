import MP4Box from "mp4box";
import * as THREE from "three";
import { delay } from "../lib/delay";
import {
  DRACO_NUMBER_SAMPLES,
  DRACO_WORKER_CONCURRENCY,
  EVENT_ABORT,
  EVENT_UPDATE,
  EVENT_UPDATE_END,
  EVENT_UPDATE_START,
  MESH_INIT_SEGMENT_MAX_LENGTH,
  SAMPLE_TYPE_FULL,
  // SAMPLE_TYPE_DELTA,
  // SAMPLE_TYPE_INTERPOLATED,
} from "../lib/constants";
import { TriangularLogger } from "../classes/TriangularLogger";
import { WorkerPool } from "../classes/WorkerPool";
import { CRYPTO_ALGORITHM_AES_CTR } from "../DashPlayer";
import { decodeDracoSample } from "./decodeDracoSample";

export const APPEND_MODE_SEGMENTS = "segments";
export const APPEND_MODE_SEQUENCE = "sequence";

export const MAXIMUM_BUFFER_SIZE = 40 << 20;
export const MAXIMUM_FRAME_SIZE = 30 * 10;
export const SAMPLE_QUEUE_TIMEOUT = 250;

type DecodedSample = {
  geometry: THREE.BufferGeometry;
  timestamp: number;
  duration: number;
  type: string;
  // Add other properties as needed
};

export const getQuotaExceededError = (message) => {
  const error = new Error(message);
  error.name = "QuotaExceededError";
  error.code = 22;
  return error;
};

export const getInvalidStateError = (message) => {
  const error = new Error(message);
  error.name = "InvalidStateError";
  error.code = 11;
  return error;
};

export class CustomSourceBuffer extends EventTarget {
  _timestampOffset = 0;
  fileStart = 0;
  bytesReceived = 0;
  _isInitialized = false;
  useSync = false;
  video = null;

  workerPool: WorkerPool = null;

  // indicates whether the asynchronous continuation of an operation
  // is still being processed
  // see https://w3c.github.io/media-source/#widl-SourceBuffer-updating
  updating = false;
  timescale = 0;
  frameDuration = 0;
  logger: TriangularLogger = null;
  parser: any = null;
  mimeType = "application/octet-stream";

  // TODO: Use correct type interface

  key: any = null;

  // TODO: Evaluate options to restrict memory utilization

  // TODO: Indicates the timestamp offset mode
  mode: AppendMode = APPEND_MODE_SEGMENTS;

  // Raw decoded DRACO samples. The function `onProcessSamples` processes
  // them as soon as there are at least two.
  samples = [];

  // Queued samples which will be played back as soon as decryption key becomes
  // available.
  queuedSamples = [];

  frames = new Map();

  ranges = [];

  // Not implemented for brevity, but would be in a full implementation
  appendWindowStart = 0;
  appendWindowEnd = Infinity;

  constructor(mimeType: string, useSync: boolean, video: HTMLVideoElement) {
    super();
    this.mimeType = mimeType;
    this.useSync = useSync;
    this.video = video;

    const logger = new TriangularLogger("CustomSourceBuffer");
    this.logger = logger;

    // logger.silly(`Creating new ${mimeType} ${useSync ? "async" : "sync"} SourceBuffer`);

    const parser = MP4Box.createFile();
    this.parser = parser;

    const workerPool = new WorkerPool(DRACO_WORKER_CONCURRENCY);
    this.workerPool = workerPool;

    workerPool.onmessage = this.onWorkerMessage;

    Object.defineProperty(this, "timestampOffset", {
      get() {
        return this._timestampOffset;
      },
      set(value) {
        if (typeof value === "number") {
          this._timestampOffset = value;
        }
      },
    });

    Object.defineProperty(this, "buffered", {
      get() {
        const { ranges } = this;
        return {
          length: ranges.length,
          start: (i) => ranges[i][0],
          end: (i) => ranges[i][1],
        };
      },
    });

    parser.onSamples = useSync ? this.onSamplesSync : this.onSamplesAsync;

    parser.onMoovStart = () => {
      // logger.silly(`onMoovStart`);
      parser.onMoovStart = undefined;
    };

    parser.onReady = (info) => {
      const { tracks } = info;
      if (tracks.length === 0) {
        throw new Error("No tracks found.");
      }

      for (const track of tracks) {
        // logger.silly(`Track: ${track.id}`);
        parser.setExtractionOptions(track.id, null, {
          nbSamples: DRACO_NUMBER_SAMPLES,
        });
      }

      parser.onReady = undefined;
      parser.start();
    };
  }

  // Custom Class methods

  setKey(key) {
    this.key = key;
  }

  getFrame(frameNumber) {
    const { frames } = this;
    return frames.get(frameNumber);
  }

  canPlay(currentTime, bufferTime = 0) {
    const { ranges } = this;

    for (let i = 0; i < ranges.length; i++) {
      const start = ranges[i][0];
      const end = ranges[i][1];

      if (currentTime >= start - bufferTime && currentTime <= end + bufferTime) {
        return true;
      }
    }
    return false;
  }

  beginUpdate() {
    // const { logger } = this;
    // logger.silly(`CustomSourceBuffer: ${EVENT_UPDATE_START}`);
    this.dispatchEvent(new Event(EVENT_UPDATE_START));
    this.updating = true;
  }

  endUpdate() {
    // const { logger } = this;
    // logger.silly(`CustomSourceBuffer: ${EVENT_UPDATE_END}`);
    this.updating = false;
    this.dispatchEvent(new Event(EVENT_UPDATE_END));
  }

  // Custom implementation of SourceBuffer API

  abort() {
    if (this.updating) {
      // TODO: If this.updating is true, abort all operations.
      this.reset();
      // TODO: Dispatch abort event, followed by updateend.
      this.updating = false;
      this.dispatchEvent(new Event(EVENT_ABORT));
      this.dispatchEvent(new Event(EVENT_UPDATE_END));
    }
  }

  destroy() {
    const { logger, parser } = this;
    logger.silly("Destroying CustomSourceBuffer.");
    parser.stop();
  }

  // Override appendBuffer to handle Draco decoding
  async appendBuffer(data: Uint8Array): void {
    // TODO: Respect appendWindowStart and appendWindowEnd by discarding data outside this time range.
    // TODO: Throw QuotaExceededError if appending data exceeds buffer size limits.
    const { logger, parser, fileStart } = this;
    const { byteLength } = data;

    // const currentMemorySize = frames.values().toArray().reduce((prev, curr) => prev + curr.size, 0);

    // if (currentMemorySize > MAXIMUM_BUFFER_SIZE) {
    //   throw getQuotaExceededError(`Exceeded maximum value of ${MAXIMUM_BUFFER_SIZE}`)
    // }

    // if (frames.size > MAXIMUM_FRAME_SIZE) {
    //   throw getQuotaExceededError(`Exceeded maximum value of ${MAXIMUM_FRAME_SIZE}`);
    // }

    if (this.updating) {
      // TODO: Throw appropriate exceptions for invalid operations (e.g., InvalidStateError, QuotaExceededError).
      // TODO: Check whether `MediaSource` is in closed state.
      throw getInvalidStateError("SourceBuffer.append() cannot be called while an update is in progress");
    }

    if (byteLength <= MESH_INIT_SEGMENT_MAX_LENGTH) {
      logger.warn("Initial segment received..");
      this.reset();
    }

    data.fileStart = fileStart;
    // eslint-disable-next-line @typescript-eslint/no-unused-vars

    const continuedFileStart = fileStart + byteLength;
    const newFilesStart = parser.appendBuffer(data);

    if (continuedFileStart !== newFilesStart) {
      logger.info(`Gap at ${newFilesStart}.`);
    }

    this.fileStart = newFilesStart;

    this.bytesReceived += byteLength;
    // logger.debug(`Appended ${byteLength} bytes (${getHumanFileSize(byteLength)}) - received: ${getHumanFileSize(this.fileStart)}.`);
    // eslint-disable-next-line no-empty
  }

  reset() {
    const { logger } = this;
    logger.warn("Resetting CustomSourceBuffer.", this._isInitialized);

    if (!this._isInitialized) {
      return;
    }

    this.fileStart = 0;
    this.samples.length = 0;
    this.frames.clear();
    this.calculateRanges();
  }

  calculateRanges() {
    const { frames, timescale, frameDuration } = this;
    const ranges = [];
    for (const sample of frames.values()) {
      const { timestamp, duration } = sample;
      const start = timestamp / timescale;
      const sampleDuration = duration || frameDuration;
      const end = start + sampleDuration / timescale;

      if (ranges.length === 0) {
        ranges.push([start, end]);
      } else {
        const lastRangeIndex = ranges.length - 1;
        const lastRange = ranges[lastRangeIndex];
        lastRange[1] = end;
      }
    }
    this.ranges = ranges;
  }

  /**
   * Remove mesh within the given time range.
   *
   * @link https://developer.mozilla.org/en-US/docs/Web/API/SourceBuffer/remove
   * @param {Double} start start of the section to remove
   * @param {Double} end end of the section to remove
   */
  remove = (start, end) => {
    const { logger, video } = this;
    if (this.updating === true) {
      // TODO: Throw appropriate exceptions for invalid operations (e.g., InvalidStateError, QuotaExceededError).
      // TODO: Check whether `MediaSource` is in closed state.
      const error = new Error("SourceBuffer.remove() cannot be called while an update is in progress");
      error.name = "InvalidStateError";
      error.code = 11;
      throw error;
    }

    this.beginUpdate();

    const { frames, timescale, frameDuration } = this;

    const timestampStart = start * timescale;
    const timestampEnd = end * timescale;

    const startFrame = Math.floor(timestampStart / frameDuration);
    const endFrame = Math.floor(timestampEnd / frameDuration);

    const currentCount = frames.size;

    if (!this._isInitialized) {
      logger.silly(`Preventing removing frames while CustomSourceBuffer is not initialized.`);
    } else if (video.paused) {
      logger.silly(`Preventing removing frames while video is paused`);
    } else if (video.currentTime >= start && video.currentTime <= end) {
      logger.silly(`Preventing removing frames at current time ${video.currentTime}`);
    } else {
      for (let frameNumber = startFrame; frameNumber < endFrame; frameNumber++) {
        frames.delete(frameNumber);
      }
    }

    const count = currentCount - frames.size;
    if (count === 0) {
      logger.silly(
        `Attempted to remove samples in range ${start}-${end} (Frames ${startFrame}-${endFrame}) Total: ${frames.size} frames.`
      );
    } else {
      logger.silly(
        `Removed ${count} samples in range ${start}-${end} (Frames ${startFrame}-${endFrame}). Total: ${frames.size} frames.`
      );
    }
    this.calculateRanges();

    this.dispatchEvent(new Event(EVENT_UPDATE));

    this.endUpdate();
  };

  /**
   *  Queues the provided samples for processing. This is only applicable in
   *  case of the playback of a W3C ClearKey-encrypted stream, when the
   *  decryption keys are not yet available.
   */
  queueSamples = (id, user, samples) => {
    const { logger, queuedSamples, parser } = this;
    logger.silly(`Queueing a batch of ${samples.length} sample(s).`);

    queuedSamples.push(samples);

    window.clearInterval(this.pollKeyIntervalId);

    // Start polling for `key`.
    this.pollKeyIntervalId = window.setInterval(async () => {
      if (!this.key) {
        return;
      }
      window.clearInterval(this.pollKeyIntervalId);
      logger.silly(`Processing ${this.queuedSamples.length} queued sample(s)`);
      parser.start();
      // TODO: Currently, new samples are not being added.
      while (this.queuedSamples.length > 0) {
        const samples = this.queuedSamples.shift();
        parser.onSamples(id, user, samples);
        await delay(500);
      }
    }, SAMPLE_QUEUE_TIMEOUT);
  };

  // Callbacks

  preprocessSamples = (id, user, samples) => {
    const { key, parser } = this;
    const hasEncryptedSamples = samples.some(({ encrypted }) => Boolean(encrypted));
    if (hasEncryptedSamples && !key) {
      parser.stop();
      // TODO: Determine whether we can prevent the buffer from
      // initialization when Dash.js hasn't received keys yet.
      this.queueSamples(id, user, samples);
      this.endUpdate();
      return true;
    }
    return false;
  };

  onSamplesSync = async (id, user, samples) => {
    if (this.preprocessSamples(id, user, samples)) {
      return;
    }

    this.beginUpdate();

    const decodedSamples = await Promise.all(samples.map(decodeDracoSample));
    for (const samples of decodedSamples) {
      this.samples.push(...samples);
    }

    this.onProcessSamples();
  };

  onSamplesAsync = async (id, user, samples) => {
    if (this.preprocessSamples(id, user, samples)) {
      return;
    }

    const { workerPool } = this;
    this.beginUpdate();
    for (const sample of samples) {
      if (sample.encrypted) {
        const iv = new Uint8Array(16);
        iv.set(sample.InitializationVector);
        const ab = await window.crypto.subtle.decrypt(
          {
            name: CRYPTO_ALGORITHM_AES_CTR,
            counter: iv,
            length: 128,
          },
          this.key,
          sample.data
        );
        sample.data = new Uint8Array(ab);
      }

      workerPool.postMessage(sample);
    }
  };

  onWorkerMessage = async (e: MessageEvent<DecodedSample[]>) => {
    const { samples } = this;
    const workerSamples = e.data;

    for (const sample of workerSamples) {
      const { geometry } = sample;

      if (geometry instanceof THREE.BufferGeometry || geometry.isBufferGeometry) {
        Object.setPrototypeOf(geometry, THREE.BufferGeometry.prototype);
        Object.setPrototypeOf(geometry.index, THREE.BufferAttribute.prototype);

        for (const name in geometry.attributes) {
          const { array, itemSize } = geometry.attributes[name];
          let attribute;

          // Reconstruct each attribute and set its prototype
          switch (true) {
            case array instanceof Float32Array:
              // Assuming itemSize components per vertex
              attribute = new THREE.Float32BufferAttribute(array, itemSize);
              break;
            case array instanceof Uint16Array:
              attribute = new THREE.Uint16BufferAttribute(array, itemSize);
              break;
            case array instanceof Uint32Array:
              attribute = new THREE.Uint32BufferAttribute(array, itemSize);
              break;
          }

          // Set the prototype to ensure methods like onUploadCallback are available
          Object.setPrototypeOf(attribute, THREE.BufferAttribute.prototype);

          geometry.attributes[name] = attribute;
        }
      } else {
        throw new Error("Geometry is not a BufferGeometry");
      }

      samples.push(sample);
    }

    // Prevent multiple executions of `onProcessSamples` before the next tick.
    window.clearTimeout(this.processSamplesTimeout);
    this.processSamplesTimeout = window.setTimeout(this.onProcessSamples, 0);
  };

  onProcessSamples = async () => {
    const { logger, frames } = this;
    await delay(1e3);

    const { samples } = this;

    // The correct order of samples is not guaranteed when using web workers.
    // We need to ensure that `frames` is populated in the right order.
    samples.sort((a, b) => a.timestamp - b.timestamp);

    // TODO: Adjust timestampOffset, if needed.

    // Check if we have a key available

    const firstSample = samples[0];
    const secondSample = samples[1];
    if (firstSample && secondSample) {
      if (firstSample.type === SAMPLE_TYPE_FULL) {
        // Intentionally obtain `timescale` and `frameDuration` every time we find a
        // `SAMPLE_TYPE_FULL` sample, as these value might change when
        // switching between different frame rate representations.
        const { timescale, duration } = firstSample;
        this.timescale = timescale;

        const frameDuration = duration;
        this.frameDuration = frameDuration;
        if (!this._isInitialized) {
          this._isInitialized = true;
          logger.silly(`Initialized - timescale: ${this.timescale}, frame duration: ${this.frameDuration}`);
        }
      }
    }

    if (!this._isInitialized) {
      logger.silly(
        `CustomSourceBuffer is not initialized after initial samples have been processed - awaiting additional samples: ${samples.length}`
      );
      return;
    }

    this.dispatchEvent(new Event(EVENT_UPDATE));

    for (const sample of samples) {
      const { timestamp, duration } = sample;
      const frameNumber = Math.floor(timestamp / duration);
      frames.set(frameNumber, sample);
    }
    // logger.debug(`Added ${samples.length},`);

    samples.length = 0;

    this.calculateRanges();
    this.endUpdate();
  };
}
