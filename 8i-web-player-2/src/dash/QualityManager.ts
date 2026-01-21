import { isIOS, isMobile, isSafari } from "react-device-detect";
import { Constants, Debug } from "dashjs";
import update from "immutability-helper";
import * as dashjs from "dashjs";
import { TriangularLogger } from "../classes/TriangularLogger";
import {
  DASH_PLAYER_EVENT_INITIALIZED,
  EVENT_ERROR,
  MEDIA_TYPE_AUDIO,
  MEDIA_TYPE_MESH,
  MEDIA_TYPE_VIDEO,
} from "../lib/constants";
import { DashPlayer, EVENT_TYPE_FRAMERATE_CHANGE, EVENT_TYPE_QUALITY_CHANGE } from "../DashPlayer";
import { DASH_JS_DEFAULT_SETTINGS } from "../lib/defaultSettings";
import { isDefined } from "../lib/validators";
import { parseFrameRate } from "./parseFrameRate";
import { fileLogger } from "../classes/FileLogger";

export const BITRATE_INTERVAL = 5;

export const sortByBandwidth = (representations) => representations.sort((a, b) => a.bandwidth - b.bandwidth);

type VideoRepresentation = {
  id: string;
  fps: number;
  bandwidth: number;
  width: number;
  height: number;
};

type MeshRepresentation = {
  id: string;
  fps: number;
  bandwidth: number;
  codecs: string;
};

export class QualityManager extends EventTarget {
  player: DashPlayer;
  logger: TriangularLogger;

  useDecodedByteCount = false;
  lastDecodedByteCount = 0;

  // progress = 0;
  // currentTime = 0;
  // duration = 0;

  framerates: number[] = [];
  videoRepresentations: VideoRepresentation[] = [];
  meshRepresentations: MeshRepresentation[] = [];

  currentRepresentations = {
    [MEDIA_TYPE_AUDIO]: null,
    [MEDIA_TYPE_VIDEO]: null,
    [MEDIA_TYPE_MESH]: null,
  };

  // TODO: Map or object
  bitrate = NaN;
  // TODO
  resolution: [number, number] = [0, 0];
  fps = 0;
  // TODO: Map or object
  // bufferLevel = 0;

  targetFPS = -1;

  constructor(player: DashPlayer) {
    super();
    const {
      options: { targetFPS },
    } = player;

    this.player = player;
    this.targetFPS = targetFPS;
    this.logger = new TriangularLogger("QualityManager");

    // Test whether the user agent supports `webkitVideoDecodedByteCount`.

    try {
      const video = document.createElement("video");
      this.useDecodedByteCount = isDefined(video.webkitVideoDecodedByteCount);
      // eslint-disable-next-line no-empty
    } catch {}

    this.bindEvents();

    // window.setTimeout(this.pollMetrics, 1000);
    // window.setInterval(this.pollMetrics, 5e3);
  }

  async configure() {
    const {
      logger,
      player,
      player: { player: dashPlayer },
    } = this;

    logger.info(`Configuring Player (is mobile: ${isMobile}, is iOS: ${isIOS})`);

    dashPlayer.updateSettings(this.getDashSettings());

    if (isMobile && isIOS) {
      player.options.maximumTextureSize = 512;
    }
  }

  bindEvents() {
    const {
      player,
      player: { player: dashPlayer },
    } = this;
    player.addEventListener(DASH_PLAYER_EVENT_INITIALIZED, this.onDashPlayerInitialized);
    dashPlayer.on(dashjs.MediaPlayer.events.FRAGMENT_LOADING_COMPLETED, this.onFragmentLoadingCompleted);
    dashPlayer.on(dashjs.MediaPlayer.events.QUALITY_CHANGE_REQUESTED, this.onQualityChangeRequested);
    dashPlayer.on(dashjs.MediaPlayer.events.QUALITY_CHANGE_RENDERED, this.onQualityChangeRendered);
    // TODO: Attempt to trigger playback by subscribing to onbufferempty/onbufferloaded events
    // player.on(dashjs.MediaPlayer.events.BUFFER_EMPTY, this.onBufferEmpty);
    // player.on(dashjs.MediaPlayer.events.BUFFER_LOADED, this.onBufferLoaded);
  }

  unbindEvents() {
    const {
      player,
      player: { player: dashPlayer },
    } = this;

    player.removeEventListener(DASH_PLAYER_EVENT_INITIALIZED, this.onDashPlayerInitialized);
    if (dashPlayer) {
      dashPlayer.off(dashjs.MediaPlayer.events.FRAGMENT_LOADING_COMPLETED, this.onFragmentLoadingCompleted);
      dashPlayer.off(dashjs.MediaPlayer.events.QUALITY_CHANGE_REQUESTED, this.onQualityChangeRequested);
      dashPlayer.off(dashjs.MediaPlayer.events.QUALITY_CHANGE_RENDERED, this.onQualityChangeRendered);
      // dashPlayer.off(dashjs.MediaPlayer.events.BUFFER_EMPTY, this.onBufferEmpty);
      // dashPlayer.off(dashjs.MediaPlayer.events.BUFFER_LOADED, this.onBufferLoaded);
    }
  }

  onDashPlayerInitialized = () => {
    const {
      logger,
      currentRepresentations,
      player: { player: dashPlayer },
    } = this;
    // logger.silly("Obtaining current representation after player initialization.");

    for (const mediaType in currentRepresentations) {
      const representation = dashPlayer.getCurrentRepresentationForType(mediaType);
      if (!representation) {
        logger.warn(`Could not get current representation for ${mediaType}`);
        continue;
      }
      currentRepresentations[mediaType] = representation.id;

      // It is possible that the video and mesh representations have a mismatching
      // frame rate. Ensure that we have the correct mesh representation selected.
      if (mediaType === MEDIA_TYPE_VIDEO) {
        this.selectMeshRepresentation(representation);
      }
    }

    // TODO: Detect mismatching frame rates in video and mesh representations
  };

  onFragmentLoadingCompleted = (e) => {
    const {
      player: { player: dashPlayer },
    } = this;

    // dash.js payload shape varies a bit across versions; be defensive.
    const req = e?.request || e?.data?.request || e?.requestData;
    if (!req) {
      return;
    }

    const mediaType = req.mediaType || req.type || req.streamType || "unknown";
    const url = req.url;
    const bytesLoaded =
      Number(req.bytesLoaded ?? req._bytesLoaded ?? req.bytes ?? req.size ?? req.response?.byteLength ?? NaN) || NaN;

    const trequest = Number(req.trequest ?? req._trequest ?? NaN);
    const tresponse = Number(req.tresponse ?? req._tresponse ?? NaN);
    const tfinish = Number(req.tfinish ?? req._tfinish ?? req._tFinish ?? NaN);

    // Prefer response->finish when available (pure download time), otherwise request->finish.
    const downloadMs =
      Number.isFinite(tfinish) && Number.isFinite(tresponse)
        ? Math.max(0, tfinish - tresponse)
        : Number.isFinite(tfinish) && Number.isFinite(trequest)
          ? Math.max(0, tfinish - trequest)
          : NaN;

    const throughputMbps =
      Number.isFinite(bytesLoaded) && Number.isFinite(downloadMs) && downloadMs > 0
        ? (bytesLoaded * 8) / (downloadMs / 1000) / 1e6
        : NaN;

    const currentRep = dashPlayer?.getCurrentRepresentationForType?.(mediaType);
    const repBandwidthBps = Number(currentRep?.bandwidth ?? NaN);
    const repBandwidthMbps = Number.isFinite(repBandwidthBps) ? repBandwidthBps / 1e6 : NaN;

    // If the fragment is slower than the representation bitrate (or just "slow"), log it.
    const slowVsRep =
      Number.isFinite(throughputMbps) && Number.isFinite(repBandwidthMbps) ? throughputMbps < repBandwidthMbps * 1.1 : false;
    const slowAbsolute = Number.isFinite(throughputMbps) ? throughputMbps < 50 : false; // heuristic "this is slow"

    if (slowVsRep || slowAbsolute) {
      fileLogger.debug("DASH_FRAGMENT_SLOW", {
        mediaType,
        url,
        bytesLoaded,
        downloadMs,
        throughputMbps,
        repBandwidthMbps,
        repId: currentRep?.id,
        quality: req.quality,
        startTime: req.startTime,
        duration: req.duration,
        range: req.range,
        responseCode: req.responsecode ?? req.responseCode,
      });
    }
  };

  onQualityChangeRequested = (e) => {
    const { logger } = this;
    const { mediaType, newRepresentation } = e;
    logger.silly(
      `onQualityChangeRequested - mediaType: ${mediaType}, id: ${newRepresentation.id}, codecFamily: ${newRepresentation.codecFamily}, codecs: ${newRepresentation.codecs}`
    );
    // const { mediaType, newRepresentation } = e;

    // if (mediaType === MEDIA_TYPE_VIDEO) {
    //   this.selectMeshRepresentation(newRepresentation);
    // }
  };

  onQualityChangeRendered = (e) => {
    const { logger, currentRepresentations } = this;

    const { mediaType, newRepresentation } = e;

    currentRepresentations[mediaType] = newRepresentation.id;

    logger.silly(
      `onQualityChangeRendered - mediaType: ${mediaType}, id: ${newRepresentation.id}, codecFamily: ${newRepresentation.codecFamily}, codecs: ${newRepresentation.codecs}`
    );

    if (mediaType === MEDIA_TYPE_VIDEO) {
      this.selectMeshRepresentation(newRepresentation);

      // Obtain the current FPS from the id of the new representation.
      // const { id } = newRepresentation;
      // const chunks = id.split("-");
      // const framerateString = chunks[1].replace(/fps$/, "");
      // const fps = parseFloat(framerateString);
      // logger.debug(`Setting current frame rate to ${fps}`);
      // this.fps = fps;
      const event = new CustomEvent(EVENT_TYPE_QUALITY_CHANGE, { detail: newRepresentation });
      this.dispatchEvent(event);
    }

    // TODO: Consider using ABR for meshes instead.
    if (mediaType === MEDIA_TYPE_MESH) {
      // Obtain the current FPS from the id of the new representation.
      const { id } = newRepresentation;
      const framerateString = id.replace(/fps$/, "");
      const fps = parseFloat(framerateString);
      this.setCurrentFrameRate(fps);
      // logger.debug(`Setting current frame rate to ${fps}`);
      // this.fps = fps;
    }
  };

  setCurrentFrameRate(fps) {
    this.fps = fps;
    // const hasChanged = this.fps !== fps;
    // if (hasChanged) {
    //   this.logger.debug(`Frame rate changed to  ${fps} (Previous: ${this.fps})`);
    // } else {
    //   this.logger.silly(`Setting frame rate to  ${fps} (no change)`);
    // }
    const event = new CustomEvent(EVENT_TYPE_FRAMERATE_CHANGE, {
      detail: fps,
    });
    this.dispatchEvent(event);
  }

  enableABR() {
    const {
      logger,
      player: { player: dashPlayer },
    } = this;

    logger.info(`Enabling ABR`);

    dashPlayer.updateSettings({
      streaming: {
        abr: {
          autoSwitchBitrate: {
            [MEDIA_TYPE_VIDEO]: true,
          },
        },
      },
    });
  }

  disableABR() {
    const {
      logger,
      player: { player: dashPlayer },
    } = this;

    logger.info(`Disabling ABR`);

    dashPlayer.updateSettings({
      streaming: {
        abr: {
          autoSwitchBitrate: {
            [MEDIA_TYPE_VIDEO]: false,
          },
        },
      },
    });
  }

  // TODO: Implement a method for changing the current FPS.
  updateMeshRepresentation = () => {
    const {
      player: { player: dashPlayer },
    } = this;

    const currentVideoRepresentation = dashPlayer.getCurrentRepresentationForType(MEDIA_TYPE_VIDEO);
    this.selectMeshRepresentation(currentVideoRepresentation);
  };

  /**
   * In case the video track changes, adapt to suitable representation of the
   * mesh.
   */
  selectMeshRepresentation(newRepresentation) {
    const {
      logger,
      player: { player: dashPlayer },
    } = this;
    const { id, mediaType } = newRepresentation;

    if (mediaType === MEDIA_TYPE_VIDEO) {
      throw new Error(`Expected ${MEDIA_TYPE_VIDEO}, but received ${mediaType}.`);
    }

    const currentMeshRpresentation = dashPlayer.getCurrentRepresentationForType(MEDIA_TYPE_MESH);

    // TODO: It might be reasonable to disable ABR for meshes after an initial representation has been selected.
    // dashPlayer.updateSettings({
    //   streaming: {
    //     abr: {
    //       autoSwitchBitrate: {
    //         [MEDIA_TYPE_VIDEO]: false,
    //         [MEDIA_TYPE_MESH]: false,
    //       },
    //     },
    //   },
    // });

    if (currentMeshRpresentation && id.endsWith(currentMeshRpresentation.id)) {
      // No need to change the FPS.
      logger.silly(`Mesh representation (already) selected for video ${id}:  ${currentMeshRpresentation.id}`);

      const fps = parseFloat(currentMeshRpresentation.id.replace("fps", ""));
      this.setCurrentFrameRate(fps);
      return;
    }

    const meshRepresentations = dashPlayer.getRepresentationsByType(MEDIA_TYPE_MESH);
    const meshRepresentation = meshRepresentations.find((rep) => id.endsWith(rep.id));

    if (!meshRepresentation) {
      throw new Error(`No mesh representation found for ${id}.`);
    } else {
      logger.silly(`Selecting mesh representation for video ${id}: ${meshRepresentation.id}`);
      const fps = parseFloat(meshRepresentation.id.replace("fps", ""));
      this.setCurrentFrameRate(fps);
      dashPlayer.setRepresentationForTypeById(MEDIA_TYPE_MESH, meshRepresentation.id, true);
    }
  }

  /**
   * In case the mesh track changes, adapt to suitable representation of the
   * video.
   */
  selectVideoRepresentation(newRepresentation) {
    const {
      logger,
      player: { player: dashPlayer },
    } = this;
    const { id, mediaType } = newRepresentation;
    if (mediaType === MEDIA_TYPE_MESH) {
      throw new Error(`
          Expected ${MEDIA_TYPE_MESH}, but received ${mediaType}.
          `);
    }

    const currentVideoRepresentation = dashPlayer.getCurrentRepresentationForType(MEDIA_TYPE_VIDEO);
    if (currentVideoRepresentation && currentVideoRepresentation.id.endsWith(id)) {
      logger.info(`Video representation selected for mesh ${id}:  ${currentVideoRepresentation.id}`);
      return;
    }
    const videoRepresentations = dashPlayer.getRepresentationsByType(MEDIA_TYPE_VIDEO);
    const videoRepresentation = videoRepresentations.find((rep) => rep.id.endsWith(id));
    if (!videoRepresentation) {
      throw new Error(`No video representation found for ${id}.`);
    } else {
      logger.info(`Selecting video representation for mesh ${id}: ${videoRepresentation.id}`);
      dashPlayer.setRepresentationForTypeById(MEDIA_TYPE_VIDEO, videoRepresentation.id, true);
    }
  }

  //   pollMetrics = () => {
  //     return;
  //     const {
  //       logger,
  //       useDecodedByteCount,
  //       lastDecodedByteCount,
  //       player: { meshSourceBuffer, video, player: dashPlayer },
  //     } = this;

  //     const activeStream = dashPlayer.getActiveStream();

  //     if (!activeStream) {
  //       return;
  //     }
  //     const streamInfo = activeStream.getStreamInfo();
  //     const dashMetrics = dashPlayer.getDashMetrics();
  //     const dashAdapter = dashPlayer.getDashAdapter();

  //     if (!dashMetrics || !streamInfo) {
  //       return;
  //     }
  //     const periodIdx = streamInfo.index;
  //     const repSwitch = dashMetrics.getCurrentRepresentationSwitch(MEDIA_TYPE_VIDEO, true);
  //     const bufferLevel = dashMetrics.getCurrentBufferLevel(MEDIA_TYPE_VIDEO, true);

  //     if (!useDecodedByteCount) {
  //       this.bitrate = repSwitch
  //         ? Math.round(dashAdapter.getBandwidthForRepresentation(repSwitch.to, periodIdx) / 1000)
  //         : NaN;
  //     } else {
  //       this.bitrate = (((video.webkitVideoDecodedByteCount - lastDecodedByteCount) / 1000) * 8) / BITRATE_INTERVAL;
  //       this.lastDecodedByteCount = video.webkitVideoDecodedByteCount;
  //     }

  //     const adaptation = dashAdapter.getAdaptationForType(periodIdx, MEDIA_TYPE_VIDEO, streamInfo);

  //     if (!adaptation) {
  //       return;
  //     }

  //     // const meshBitRates = dashPlayer.getBitrateInfoListFor(MEDIA_TYPE_MESH);

  //     const currentRep = adaptation.Representation.find((rep) => rep.id === repSwitch.to);

  //     // const currentRepFramerate = parseFrameRate(currentRep.framerate);

  //     // const meshRepresentation = this.meshRepresentations.find((rep) => {
  //     //   return rep.framerate === currentRepFramerate;
  //     // });

  //     // const bitrate = meshBitRates.find((bitrate) => bitrate.bitrate === meshRepresentation.bandwidth);
  //     const { currentTime, duration } = video;

  //     this.currentTime = currentTime;
  //     this.duration = duration;
  //     this.progress = currentTime / duration;

  //     this.fps = currentRep.framerate;
  //     this.resolution = [currentRep.width, currentRep.height];
  //     this.bufferLevel = bufferLevel;

  //     if (!meshSourceBuffer) {
  //       return;
  //     }

  //     logger.debug(
  //       `
  // Polling stream condition:

  // Progress:     ${this.progress}
  // FPS:          ${this.fps}
  // Resolution:   ${this.resolution.join("x")}
  // Bitrate:      ${this.bitrate}
  // Buffer Level: ${this.bufferLevel}
  // Received:     ${getHumanFileSize(meshSourceBuffer.bytesReceived)}
  //       `.trim()
  //     );
  //   };

  parseManifest(manifest) {
    const {
      logger,
      player,
      player: {
        options: { maximumTextureSize },
      },
    } = this;
    logger.silly("Parsing manifest:", manifest);

    const videoAdaptationSet = manifest.Period[0].AdaptationSet.find((as) => as.contentType === MEDIA_TYPE_VIDEO);

    const videoRepresentations = sortByBandwidth(
      videoAdaptationSet.Representation.map((rep) => {
        const { id, framerate, bandwidth, width, height } = rep;

        return {
          id,
          bandwidth,
          framerate: parseFrameRate(framerate),
          width,
          height,
        };
      })
    );

    const filteredVideoRepresentations = videoRepresentations.filter(({ width }) => width <= maximumTextureSize);

    if (filteredVideoRepresentations.length === 0) {
      const availableResolutions = Array.from(
        new Set(videoRepresentations.map(({ width, height }) => `${width}x${height}`))
      );
      const event = new CustomEvent(EVENT_ERROR, {
        detail: `Could not find video stream smaller than the maximum size of ${maximumTextureSize}x${maximumTextureSize}.\n\nAvailable: ${availableResolutions.join(", ")}`,
      });
      player.dispatchEvent(event);
      return;
      // logger.warn(`Disabling current maxmium texture size ${maximumTextureSize}, as no video textures would be available.`);
      // player.options.maximumTextureSize = Infinity;
    }

    const meshAdaptationSet = manifest.Period[0].AdaptationSet.find((as) => as.contentType === MEDIA_TYPE_MESH);

    const meshRepresentations = sortByBandwidth(
      meshAdaptationSet.Representation.map((rep) => {
        const { id, framerate, bandwidth, codecs } = rep;

        return {
          id,
          bandwidth,
          framerate: parseFrameRate(framerate),
          codecs,
        };
      })
    );

    const framerates: number[] = Array.from(new Set(videoRepresentations.map(({ framerate }) => framerate)));
    const frameratesList = framerates.join(", ");

    let { targetFPS } = this;

    if (targetFPS === -1) {
      logger.silly(`Selecting frame rate automatically. Available framerates in this manifest: ${frameratesList}.`);
    } else {
      if (framerates.includes(targetFPS)) {
        logger.silly(
          `Selecting target frame rate ${targetFPS} from available frame rates in this manifest: ${frameratesList}.`
        );
      } else {
        // Use reduce to find the frame rate with the smallest difference to the targetFPS
        const closestFPS: number = framerates.reduce((prev: number, curr: number) => {
          return Math.abs(curr - targetFPS) < Math.abs(prev - targetFPS) ? curr : prev;
        });

        logger.warn(
          `Target frame rate ${targetFPS} not available in frame rates: ${framerates.join(
            ", "
          )}. Selecting closest frame rate ${closestFPS}.`
        );
        targetFPS = closestFPS;
      }
    }

    this.targetFPS = targetFPS;

    // logger.debug(`Available framerates: ${frameratesList}`, framerates);

    // TODO: Obtain current representation?

    this.videoRepresentations = videoRepresentations;
    this.meshRepresentations = meshRepresentations;
    this.framerates = framerates;
  }

  filterRepresentation = (representation) => {
    const {
      logger,
      player: {
        options: { maximumTextureSize },
      },
    } = this;

    const { targetFPS } = this;

    const { mimeType } = representation;
    if (mimeType.startsWith("video")) {
      // TODO: Allow more fine-grained control about this.
      if (representation.width > maximumTextureSize) {
        logger.silly(`Representation rejected on mobile for ${mimeType}: ${representation.id}`);
        return false;
      }
    }

    if ("framerate" in representation && targetFPS !== -1) {
      const isMatchingFrameRate = representation.framerate === `${targetFPS}/1`;
      if (!isMatchingFrameRate) {
        return false;
      }
    }

    logger.silly(`Representation selected for ${mimeType}: ${representation.id}`);
    return true;
  };

  getDashSettings() {
    const {
      logger,
      player: {
        options: { abr },
      },
    } = this;
    const updateSpec = {
      debug: {
        $merge: {
          logLevel: Debug.LOG_LEVEL_WARNING,
        },
      },
      streaming: {
        buffer: {
          $merge: {
            // See also https://github.com/Dash-Industry-Forum/dash.js/issues/3595
            fastSwitchEnabled: true,
            reuseExistingSourceBuffers: false,
            flushBufferAtTrackSwitch: true,
            resetSourceBuffersForTrackSwitch: true,
            bufferTimeAtTopQualityLongForm: 15,
            bufferTimeAtTopQuality: 12,
          },
        },
        gaps: {
          $merge: {
            jumpGaps: false,
            jumpLargeGaps: false,
            enableSeekFix: true,
            enableStallFix: true,
          },
        },
        abr: {
          $merge: {
            autoSwitchBitrate: {
              audio: false,
              video: Boolean(abr),
              // The mesh is selected in onQualityChangeRendered
              mesh: false,
            },
            rules: {
              throughputRule: {
                active: true,
              },
              bolaRule: {
                active: false,
              },
              insufficientBufferRule: {
                active: true,
              },
              switchHistoryRule: {
                active: true,
              },
              droppedFramesRule: {
                active: true,
              },
              abandonRequestsRule: {
                active: true,
              },
            },
          },
        },
        trackSwitchMode: {
          $merge: {
            audio: Constants.TRACK_SWITCH_MODE_ALWAYS_REPLACE,
            video: Constants.TRACK_SWITCH_MODE_ALWAYS_REPLACE,
            mesh: Constants.TRACK_SWITCH_MODE_ALWAYS_REPLACE,
          },
        },
      },
    };

    // TODO: Modify settings for iOS
    if (isIOS || isSafari) {
      // iOS we have to reduce buffer time in live to prevent Safari crashing
      // The higher default time is fine w/ offline HLS streams, but HLS-LL explodes
      updateSpec.streaming.buffer.$merge.bufferToKeep = 10;
      updateSpec.streaming.buffer.$merge.bufferTimeAtTopQuality = 10;
      updateSpec.streaming.buffer.$merge.bufferTimeAtTopQualityLongForm = 10;
      updateSpec.streaming.buffer.$merge.bufferPruningInterval = 4;
    }

    const settings = update(DASH_JS_DEFAULT_SETTINGS, updateSpec);

    logger.silly(`dash.js settings:`, settings);

    return settings;
  }
}
