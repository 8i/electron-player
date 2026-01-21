import { NOOP } from "../lib/utils";
import { TriangularLogger } from "../classes/TriangularLogger";
import { DashPlayer, EVENT_TYPE_QUALITY_CHANGE } from "../DashPlayer";
import {
  TIMECODE_WIDTH,
  TIMECODE_NUM_BITS,
  TIMECODE_PIXEL_STRIDE,
  DASH_PLAYER_EVENT_INITIALIZED,
} from "../lib/constants";
import { isTimeWithinBuffered } from "../lib/isTimeWithinBuffered";
import { QualityManager } from "./QualityManager";

export const PLAYBACK_SEEK_TIMEOUT = 5e3;

export const PLAYBACK_MANAGER_EVENT_TYPE_RESET = "reset";
export const PLAYBACK_MANAGER_EVENT_TYPE_STATE_CHANGED = "statechanged";
export const PLAYBACK_MANAGER_EVENT_TYPE_PLAY = "PLAY";
export const PLAYBACK_MANAGER_EVENT_TYPE_PAUSE = "PAUSE";
export const PLAYBACK_MANAGER_EVENT_TYPE_VOLUME_CHANGE = "volumechange";
export const PLAYBACK_MANAGER_EVENT_TYPE_TIME_UPDATE = "timeupdate";

export const VIDEO_EVENT_CAN_PLAY = "canplay";
export const VIDEO_EVENT_CAN_PLAY_THROUGH = "canplaythrough";
export const VIDEO_EVENT_COMPLETE = "complete";
export const VIDEO_EVENT_DURATION_CHANGE = "durationchange";
export const VIDEO_EVENT_EMPTIED = "emptied";
export const VIDEO_EVENT_ENDED = "ended";
export const VIDEO_EVENT_ERROR = "error";
export const VIDEO_EVENT_LOADED_DATA = "loadeddata";
export const VIDEO_EVENT_LOADED_METADATA = "loadedmetadata";
export const VIDEO_EVENT_LOAD_START = "loadstart";
export const VIDEO_EVENT_PAUSE = "pause";
export const VIDEO_EVENT_PLAY = "play";
export const VIDEO_EVENT_PLAYING = "playing";
export const VIDEO_EVENT_PROGRESS = "progress";
export const VIDEO_EVENT_RATE_CHANGE = "ratechange";
export const VIDEO_EVENT_SEEKED = "seeked";
export const VIDEO_EVENT_SEEKING = "seeking";
export const VIDEO_EVENT_STALLED = "stalled";
export const VIDEO_EVENT_SUSPEND = "suspend";
export const VIDEO_EVENT_TIME_UPDATE = "timeupdate";
export const VIDEO_EVENT_VOLUME_CHANGE = "volumechange";
export const VIDEO_EVENT_WAITING = "waiting";

export const TIMECODE_HEIGHT = TIMECODE_WIDTH;
export const TIMECODE_PIXEL_BUFFER_WIDTH = TIMECODE_NUM_BITS * TIMECODE_WIDTH;
export const TIMECODE_PIXEL_BUFFER_HEIGHT = 1;
export const TIMECODE_READ_OFFSET = TIMECODE_WIDTH >> 1;

export const PLAYBACK_STATE_NONE = "none";
export const PLAYBACK_STATE_FAILED = "failed";
export const PLAYBACK_STATE_INITIALIZING = "initializing";
export const PLAYBACK_STATE_INITIALIZED = "initialized";
export const PLAYBACK_STATE_SEEKING = "seeking";
export const PLAYBACK_STATE_BUFFERING = "buffering";
export const PLAYBACK_STATE_PLAYING = "playing";
export const PLAYBACK_STATE_PAUSED = "paused";

/**
 * - Reads the timecode into a `TIMECODE_PIXEL_BUFFER_WIDTH`x`TIMECODE_PIXEL_BUFFER_HEIGHT` frame
 * buffer and obtains the timecode.
 * - Subscribes to video events and ensures that `CustomSourceBuffer` can play
 * back the current range.
 */
export class PlaybackManager extends EventTarget {
  logger: TriangularLogger;
  timecodeBuffer: Uint8ClampedArray;

  player: DashPlayer = null;
  qualityManager: QualityManager = null;
  timecodeByteLength = 0;
  useWebGL2 = true;

  currentPoll = null;

  // TODO: Implement seeking in the video, need to correct time
  // seekTargetTime = 0;
  // requestKeyframe = false;

  state = PLAYBACK_STATE_NONE;

  constructor(dashPlayerInstance) {
    super();
    const { deviceCapabilities, qualityManager } = dashPlayerInstance;

    const logger = new TriangularLogger("PlaybackManager");
    const timecodeByteLength = TIMECODE_PIXEL_STRIDE * TIMECODE_PIXEL_BUFFER_WIDTH * TIMECODE_PIXEL_BUFFER_HEIGHT;

    this.player = dashPlayerInstance;

    this.logger = logger;

    this.timecodeByteLength = timecodeByteLength;
    this.timecodeBuffer = new Uint8ClampedArray(timecodeByteLength);
    this.useWebGL2 = Boolean(deviceCapabilities.webGL2);

    this.qualityManager = qualityManager;

    // logger.silly(`Using WebGL ${this.useWebGL2 ? 2 : 1} to process timecode`);

    this.bindEvents();
  }

  bindEvents() {
    const {
      player,
      player: { video, qualityManager },
    } = this;

    player.addEventListener(DASH_PLAYER_EVENT_INITIALIZED, this.onDashPlayerInitialized);

    qualityManager.addEventListener(EVENT_TYPE_QUALITY_CHANGE, this.onQualityChange);

    video.addEventListener(VIDEO_EVENT_CAN_PLAY, this.onCanPlay);
    video.addEventListener(VIDEO_EVENT_CAN_PLAY_THROUGH, this.onCanPlayThrough);
    video.addEventListener(VIDEO_EVENT_COMPLETE, this.onComplete);
    video.addEventListener(VIDEO_EVENT_DURATION_CHANGE, this.onDurationChange);
    video.addEventListener(VIDEO_EVENT_EMPTIED, this.onEmptied);
    video.addEventListener(VIDEO_EVENT_ENDED, this.onEnded);
    video.addEventListener(VIDEO_EVENT_ERROR, this.onError);
    video.addEventListener(VIDEO_EVENT_LOADED_DATA, this.onLoadedData);
    video.addEventListener(VIDEO_EVENT_LOADED_METADATA, this.onLoadedMetadata);
    video.addEventListener(VIDEO_EVENT_LOAD_START, this.onLoadStart);
    video.addEventListener(VIDEO_EVENT_PAUSE, this.onPause);
    video.addEventListener(VIDEO_EVENT_PLAY, this.onPlay);
    video.addEventListener(VIDEO_EVENT_PLAYING, this.onPlaying);
    // TODO: Build UI for this? Check log levels?
    video.addEventListener(VIDEO_EVENT_PROGRESS, this.onProgress);
    video.addEventListener(VIDEO_EVENT_RATE_CHANGE, this.onRateChange);
    video.addEventListener(VIDEO_EVENT_SEEKED, this.onSeeked);
    video.addEventListener(VIDEO_EVENT_SEEKING, this.onSeeking);
    video.addEventListener(VIDEO_EVENT_STALLED, this.onStalled);
    video.addEventListener(VIDEO_EVENT_SUSPEND, this.onSuspend);
    video.addEventListener(VIDEO_EVENT_TIME_UPDATE, this.onTimeUpdate);
    video.addEventListener(VIDEO_EVENT_VOLUME_CHANGE, this.onVolumeChange);
    video.addEventListener(VIDEO_EVENT_WAITING, this.onWaiting);
  }

  setState(newState) {
    const { logger } = this;
    const oldState = this.state;
    if (oldState === newState) {
      return;
    }
    if (oldState === PLAYBACK_STATE_FAILED) {
      throw new Error(`Cannot transition from state ${oldState}`);
    }
    logger.warn(`${PLAYBACK_MANAGER_EVENT_TYPE_STATE_CHANGED} ${oldState} -> ${newState}`);
    this.state = newState;
    const event = new CustomEvent(PLAYBACK_MANAGER_EVENT_TYPE_STATE_CHANGED, {
      detail: {
        newState,
        oldState,
      },
    });
    this.dispatchEvent(event);
  }

  reset() {
    const { logger } = this;
    logger.info("Resetting PlaybackManager.");
    this.state = PLAYBACK_STATE_NONE;
    const event = new CustomEvent(PLAYBACK_MANAGER_EVENT_TYPE_RESET);
    this.dispatchEvent(event);
  }

  process() {
    const { timecodeBuffer } = this;

    let timecodeFrame = 0;

    for (let i = 0, index = 0; i < TIMECODE_NUM_BITS; ++i) {
      const pixelValue = timecodeBuffer[index + TIMECODE_READ_OFFSET];
      timecodeFrame = (timecodeFrame << 1) | (pixelValue > 127 ? 1 : 0);
      index += TIMECODE_PIXEL_STRIDE * TIMECODE_WIDTH;
    }

    return timecodeFrame;
  }

  isPaused() {
    const {
      player: { player: dashPlayer },
    } = this;
    return dashPlayer.isPaused();
  }

  pause() {
    const {
      logger,
      player: { player: dashPlayer },
    } = this;
    logger.silly(`Pause`);
    try {
      dashPlayer.pause();
    } catch (e) {
      logger.error(e);
    }
  }

  play() {
    const {
      logger,
      player: { player: dashPlayer },
    } = this;
    logger.silly(`Play`);
    try {
      dashPlayer.play();
    } catch (e) {
      logger.error(e);
    }
  }

  /**
   * Checks whether `currentTime` is buffered.
   */
  checkPlayback(currentTime, bufferTime = 0) {
    const {
      player: {
        video: { buffered },
        meshSourceBuffer,
      },
    } = this;

    const hasFrameMesh = meshSourceBuffer.canPlay(currentTime, bufferTime);
    // TODO: Check whether time is buffered in video
    // const hasFrameTexture = meshSourceBuffer.canPlay(currentTime);

    if (!hasFrameMesh) {
      return false;
    }

    return isTimeWithinBuffered(buffered, currentTime, bufferTime);
  }

  cancelPreviousPollForTime = async () => {
    const { pollForTimeTimerId, currentPoll } = this;

    window.clearTimeout(pollForTimeTimerId);

    if (currentPoll) {
      currentPoll.reject(new Error("ERR_NEW_POLL_REQUEST"));
      this.currentPoll = null;
    }
  };

  requestPollForTime(time, wasPaused) {
    const {
      logger,
      player: { meshSourceBuffer },
    } = this;

    if (!meshSourceBuffer._isInitialized) {
      return Promise.resolve();
    }

    this.cancelPreviousPollForTime();

    const currentPoll = {
      time,
      wasPaused,
      resolve: NOOP,
      reject: NOOP,
    };

    logger.debug(`Requesting poll for time ${time} (was paused: ${wasPaused})`);
    const promise = new Promise((resolve, reject) => {
      // TODO: Add timeout for request
      currentPoll.reject = (value) => {
        currentPoll.resolved = true;
        reject(value);
      };
      currentPoll.resolve = (value) => {
        currentPoll.resolved = true;
        resolve(value);
      };
      currentPoll.resolved = false;

      const onTimeout = () => {
        if (currentPoll.resolved) {
          return;
        }
        logger.warn(`Could not seek to ${time} after timeout reached of ${PLAYBACK_SEEK_TIMEOUT}`);
        // TODO: We need custom errors and events.
        currentPoll.reject(new Error("ERR_SEEK_TIMEOUT"));
        this.cancelPreviousPollForTime();
      };

      const onPoll = () => {
        if (currentPoll.resolved) {
          return;
        }

        const {
          player: { video, meshSourceBuffer },
        } = this;

        if (video && meshSourceBuffer) {
          if (this.checkPlayback(time)) {
            this.currentPoll = null;
            logger.debug(`Resolved polling for ${time} (was paused: ${wasPaused})`);
            currentPoll.resolve(undefined);
            return;
          }
        }

        this.pollForTimeTimerId = window.setTimeout(onPoll, 100);
      };

      onPoll();

      window.setTimeout(onTimeout, PLAYBACK_SEEK_TIMEOUT);
    });

    this.currentPoll = currentPoll;

    return promise;
  }

  async seek(time) {
    const {
      logger,
      currentPoll,
      player: { player: dashPlayer, video },
    } = this;

    if (!this.checkPlayback(time)) {
      logger.warn(`Cannot seek to ${time}.`);
      return;
    }

    const wasPaused = currentPoll ? currentPoll.wasPaused : this.state !== PLAYBACK_STATE_PLAYING || video.paused;

    logger.debug(`Seeking to: ${time}, was paused: ${wasPaused}`);
    this.setState(PLAYBACK_STATE_SEEKING);

    if (wasPaused) {
      this.pause();
    }

    try {
      // TODO: Implement this differently:
      // - A new seek request cancels the previous one.
      // - Request can be cancelled, rejects the returned promise.
      // - Request resolves when enough buffered.
      // - Implement a function which checks whther the buffer is filled enough.
      dashPlayer.seek(time);

      await this.requestPollForTime(time, wasPaused);

      // Necessary in order to trigger onPause/onPlay events (not for PLAYBACK_STATE_SEEKING and PLAYBACK_STATE_BUFFERING)
      this.setState(PLAYBACK_STATE_PAUSED);
      if (!wasPaused) {
        logger.debug(`Resuming video playback, as video was not paused earlier`);
        await this.play();
        // TODO: The status doesn't always properly in the `onPlay` callback.
        this.setState(PLAYBACK_STATE_PLAYING);
      }
    } catch (e) {
      logger.debug(`Could not seek to ${time}: ${e.message}`);
    }
  }

  onDashPlayerInitialized = async () => {
    const { logger } = this;

    logger.silly(`Player is initialized, setting ${PLAYBACK_STATE_PAUSED}`);
    this.setState(PLAYBACK_STATE_PAUSED);
  };

  onQualityChange = async () => {
    const {
      logger,
      currentPoll,
      player: { video },
    } = this;

    const wasPaused = currentPoll ? currentPoll.wasPaused : video.paused;

    this.setState(PLAYBACK_STATE_BUFFERING);

    const time = video.currentTime;
    if (!wasPaused) {
      this.pause();
    }
    logger.silly(`onQualityChange at ${video.currentTime} for ${time} (was paused: ${wasPaused})`);

    try {
      if (video.currentTime - time > 0) {
        await this.requestPollForTime(time, wasPaused);
      } else {
        logger.silly(`onQualityChange: Prevented polling.`);
      }
      // Necessary in order to trigger onPause/onPlay events (not for PLAYBACK_STATE_SEEKING and PLAYBACK_STATE_BUFFERING)
      this.setState(PLAYBACK_STATE_PAUSED);
      if (!wasPaused) {
        logger.debug(`Resuming video playback, as video was not paused earlier`);
        this.play();
      }
    } catch (e) {
      logger.debug(`Could not await ${time} becoming available after quality change: ${e.message}`);
    }
  };

  onCanPlay = () => {
    // const {
    //   logger,
    // } = this;
    // logger.silly(`onCanPlay: ${video.src}`);

    if (this.state === PLAYBACK_STATE_INITIALIZING) {
      this.setState(PLAYBACK_STATE_INITIALIZED);
      // TODO: Try to ensure that we can play back the video from 0
    }
  };

  onCanPlayThrough = () => {
    // const {
    // logger,
    // } = this;
    // logger.silly(`onCanPlayThrough`);
  };

  onComplete = () => {
    // const {
    // logger,
    // } = this;
    logger.silly(`onComplete`);
  };

  onDurationChange = () => {
    // const {
    // logger,
    // } = this;
    // logger.silly(`onDurationChange: ${video.duration}`);
  };

  onEmptied = () => {
    const { logger } = this;
    logger.silly("onEmptied: The video element is now empty.");
  };

  onEnded = () => {
    const { logger } = this;
    logger.silly(`onEnded`);
  };

  onError = () => {
    const {
      logger,
      player: { video },
    } = this;
    // TODO
    logger.error(`onError: ${video.error}`);
  };

  onLoadedData = () => {
    const { logger } = this;
    logger.silly(`onLoadedData`);
  };

  onLoadedMetadata = () => {
    // const {
    //   logger,
    //   player: { video },
    // } = this;
    // logger.silly(`onLoadedMetadata: ${video.duration}`);
  };

  onLoadStart = () => {
    const { logger } = this;
    logger.silly(`onLoadStart`);
    this.setState(PLAYBACK_STATE_INITIALIZING);
  };

  onPause = () => {
    // const {
    //   logger,
    //   player: { video },
    // } = this;
    // logger.silly(`onPause: ${video?.currentTime}`);
    if (this.state !== PLAYBACK_STATE_SEEKING && this.state !== PLAYBACK_STATE_BUFFERING) {
      this.setState(PLAYBACK_STATE_PAUSED);
    }

    const event = new CustomEvent(PLAYBACK_MANAGER_EVENT_TYPE_PAUSE);
    this.dispatchEvent(event);
  };

  onPlay = () => {
    // const {
    // logger,
    // player: { video },
    // } = this;
    // logger.silly(`onPlay`);
    if (this.state !== PLAYBACK_STATE_SEEKING && this.state !== PLAYBACK_STATE_BUFFERING) {
      this.setState(PLAYBACK_STATE_PLAYING);
    }

    const event = new CustomEvent(PLAYBACK_MANAGER_EVENT_TYPE_PLAY);
    this.dispatchEvent(event);
  };

  onPlaying = () => {
    // const {
    //   logger,
    //   player: { video },
    // } = this;
    // logger.silly(`onPlaying: ${video?.currentTime}`);
  };

  onProgress = () => {
    // const {
    //   logger,
    //   player: { video },
    // } = this;
    // logger.silly(`onProgress`);
  };

  onRateChange = () => {
    const {
      logger,
      player: { video },
    } = this;
    logger.debug(`onRateChange: ${video.playbackRate}`);
  };

  onSeeked = async () => {
    const {
      logger,
      player: { video },
    } = this;
    // TODO: Heuristic
    // if (this.state === PLAYBACK_STATE_INITIALIZED) {
    //   if (video.currentTime !== 0) {
    //     logger.warn(`Trying to mitigate non-zero currentTime: ${video.currentTime}`)
    //     await this.seek(0);
    //     return;
    //   }
    // }
    logger.silly(`onSeeked: ${video?.currentTime}`);
  };

  onSeeking = () => {
    const {
      logger,
      player: { video },
    } = this;
    logger.silly(`onSeeking: ${video?.currentTime}`);
  };

  onStalled = () => {
    const { logger } = this;
    logger.silly("onStalled: The video data is no longer available.");
  };

  onSuspend = () => {
    const { logger } = this;
    logger.silly("onSuspend: Video data loading has been suspended.");
  };

  onTimeUpdate = () => {
    const {
      player: { video },
    } = this;
    if (!video) {
      return;
    }
    // TODO: Include in detail: duration? currentTime?
    // logger.silly(`onTimeUpdate: Current Time = ${video?.currentTime}`);
    this.dispatchEvent(new CustomEvent(PLAYBACK_MANAGER_EVENT_TYPE_TIME_UPDATE, { detail: { target: video } }));
  };

  onVolumeChange = () => {
    const {
      logger,
      player: { video },
    } = this;
    logger.silly(`onVolumeChange: Volume = ${video?.volume}, Muted = ${video?.muted}`);
    this.dispatchEvent(new CustomEvent(PLAYBACK_MANAGER_EVENT_TYPE_VOLUME_CHANGE));
  };

  onWaiting = () => {
    const { logger } = this;
    logger.silly("onWaiting: Video is waiting for more data.");
  };
}
