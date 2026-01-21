import { Debug, Constants } from "dashjs";
// console.log( HTTPRequest, Debug, Constants)

export const HTTP_REQUEST_MPD_TYPE = "MPD";
export const HTTP_REQUEST_XLINK_EXPANSION_TYPE = "XLinkExpansion";
export const HTTP_REQUEST_MEDIA_SEGMENT_TYPE = "MediaSegment";
export const HTTP_REQUEST_INIT_SEGMENT_TYPE = "InitializationSegment";
export const HTTP_REQUEST_BITSTREAM_SWITCHING_SEGMENT_TYPE = "BitstreamSwitchingSegment";
export const HTTP_REQUEST_INDEX_SEGMENT_TYPE = "IndexSegment";
export const HTTP_REQUEST_MSS_FRAGMENT_INFO_SEGMENT_TYPE = "FragmentInfoSegment";
export const HTTP_REQUEST_LICENSE = "license";
export const HTTP_REQUEST_OTHER_TYPE = "other";

export const DASH_JS_DEFAULT_SETTINGS = {
  debug: {
    logLevel: Debug.LOG_LEVEL_WARNING,
    dispatchEvent: false,
  },
  streaming: {
    abandonLoadTimeout: 10000,
    wallclockTimeUpdateInterval: 100,
    manifestUpdateRetryInterval: 100,
    liveUpdateTimeThresholdInMilliseconds: 0,
    cacheInitSegments: false,
    applyServiceDescription: true,
    applyProducerReferenceTime: true,
    applyContentSteering: true,
    eventControllerRefreshDelay: 100,
    enableManifestDurationMismatchFix: true,
    parseInbandPrft: false,
    enableManifestTimescaleMismatchFix: false,
    capabilities: {
      filterUnsupportedEssentialProperties: true,
      supportedEssentialProperties: [
        { schemeIdUri: Constants.FONT_DOWNLOAD_DVB_SCHEME },
        {
          schemeIdUri: Constants.COLOUR_PRIMARIES_SCHEME_ID_URI,
          value: /1|5|6|7/,
        },
        {
          schemeIdUri: Constants.MATRIX_COEFFICIENTS_SCHEME_ID_URI,
          value: /0|1|5|6/,
        },
        {
          schemeIdUri: Constants.TRANSFER_CHARACTERISTICS_SCHEME_ID_URI,
          value: /1|6|13|14|15/,
        },
        ...Constants.THUMBNAILS_SCHEME_ID_URIS.map((ep) => {
          return { schemeIdUri: ep };
        }),
      ],
      useMediaCapabilitiesApi: true,
      filterVideoColorimetryEssentialProperties: false,
      filterHDRMetadataFormatEssentialProperties: false,
    },
    timeShiftBuffer: {
      calcFromSegmentTimeline: false,
      fallbackToSegmentTimeline: true,
    },
    metrics: {
      maxListDepth: 100,
    },
    delay: {
      liveDelayFragmentCount: NaN,
      liveDelay: NaN,
      useSuggestedPresentationDelay: true,
    },
    protection: {
      keepProtectionMediaKeys: false,
      ignoreEmeEncryptedEvent: false,
      detectPlayreadyMessageFormat: true,
    },
    buffer: {
      enableSeekDecorrelationFix: false,
      fastSwitchEnabled: true,
      flushBufferAtTrackSwitch: false,
      reuseExistingSourceBuffers: true,
      bufferPruningInterval: 10,
      bufferToKeep: 20,
      bufferTimeAtTopQuality: 30,
      bufferTimeAtTopQualityLongForm: 60,
      initialBufferLevel: NaN,
      bufferTimeDefault: 18,
      longFormContentDurationThreshold: 600,
      stallThreshold: 0.3,
      useAppendWindow: true,
      setStallState: true,
      avoidCurrentTimeRangePruning: false,
      useChangeType: true,
      mediaSourceDurationInfinity: true,
      resetSourceBuffersForTrackSwitch: false,
    },
    gaps: {
      jumpGaps: true,
      jumpLargeGaps: true,
      smallGapLimit: 1.5,
      threshold: 0.3,
      enableSeekFix: true,
      enableStallFix: false,
      stallSeek: 0.1,
    },
    utcSynchronization: {
      enabled: true,
      useManifestDateHeaderTimeSource: true,
      backgroundAttempts: 2,
      timeBetweenSyncAttempts: 30,
      maximumTimeBetweenSyncAttempts: 600,
      minimumTimeBetweenSyncAttempts: 2,
      timeBetweenSyncAttemptsAdjustmentFactor: 2,
      maximumAllowedDrift: 100,
      enableBackgroundSyncAfterSegmentDownloadError: true,
      defaultTimingSource: {
        scheme: "urn:mpeg:dash:utc:http-xsdate:2014",
        value: "https://time.akamai.com/?iso&ms",
      },
    },
    scheduling: {
      defaultTimeout: 500,
      lowLatencyTimeout: 0,
      scheduleWhilePaused: true,
    },
    text: {
      defaultEnabled: true,
      dispatchForManualRendering: false,
      extendSegmentedCues: true,
      imsc: {
        displayForcedOnlyMode: false,
        enableRollUp: true,
      },
      webvtt: {
        customRenderingEnabled: false,
      },
    },
    liveCatchup: {
      maxDrift: NaN,
      playbackRate: {
        min: NaN,
        max: NaN,
      },
      playbackBufferMin: 0.5,
      enabled: null,
      mode: Constants.LIVE_CATCHUP_MODE_DEFAULT,
    },
    lastBitrateCachingInfo: {
      enabled: true,
      ttl: 360000,
    },
    lastMediaSettingsCachingInfo: {
      enabled: true,
      ttl: 360000,
    },
    saveLastMediaSettingsForCurrentStreamingSession: true,
    cacheLoadThresholds: {
      video: 50,
      audio: 5,
    },
    trackSwitchMode: {
      audio: Constants.TRACK_SWITCH_MODE_ALWAYS_REPLACE,
      video: Constants.TRACK_SWITCH_MODE_NEVER_REPLACE,
    },
    selectionModeForInitialTrack: Constants.TRACK_SELECTION_MODE_HIGHEST_SELECTION_PRIORITY,
    fragmentRequestTimeout: 20000,
    fragmentRequestProgressTimeout: -1,
    manifestRequestTimeout: 10000,
    retryIntervals: {
      [HTTP_REQUEST_MPD_TYPE]: 500,
      [HTTP_REQUEST_XLINK_EXPANSION_TYPE]: 500,
      [HTTP_REQUEST_MEDIA_SEGMENT_TYPE]: 1000,
      [HTTP_REQUEST_INIT_SEGMENT_TYPE]: 1000,
      [HTTP_REQUEST_BITSTREAM_SWITCHING_SEGMENT_TYPE]: 1000,
      [HTTP_REQUEST_INDEX_SEGMENT_TYPE]: 1000,
      [HTTP_REQUEST_MSS_FRAGMENT_INFO_SEGMENT_TYPE]: 1000,
      [HTTP_REQUEST_LICENSE]: 1000,
      [HTTP_REQUEST_OTHER_TYPE]: 1000,
      lowLatencyReductionFactor: 10,
    },
    retryAttempts: {
      [HTTP_REQUEST_MPD_TYPE]: 3,
      [HTTP_REQUEST_XLINK_EXPANSION_TYPE]: 1,
      [HTTP_REQUEST_MEDIA_SEGMENT_TYPE]: 3,
      [HTTP_REQUEST_INIT_SEGMENT_TYPE]: 3,
      [HTTP_REQUEST_BITSTREAM_SWITCHING_SEGMENT_TYPE]: 3,
      [HTTP_REQUEST_INDEX_SEGMENT_TYPE]: 3,
      [HTTP_REQUEST_MSS_FRAGMENT_INFO_SEGMENT_TYPE]: 3,
      [HTTP_REQUEST_LICENSE]: 3,
      [HTTP_REQUEST_OTHER_TYPE]: 3,
      lowLatencyMultiplyFactor: 5,
    },
    abr: {
      limitBitrateByPortal: false,
      usePixelRatioInLimitBitrateByPortal: false,
      enableSupplementalPropertyAdaptationSetSwitching: true,
      rules: {
        throughputRule: {
          active: true,
        },
        bolaRule: {
          active: true,
        },
        insufficientBufferRule: {
          active: true,
          parameters: {
            throughputSafetyFactor: 0.7,
            segmentIgnoreCount: 2,
          },
        },
        switchHistoryRule: {
          active: true,
          parameters: {
            sampleSize: 8,
            switchPercentageThreshold: 0.075,
          },
        },
        droppedFramesRule: {
          active: false,
          parameters: {
            minimumSampleSize: 375,
            droppedFramesPercentageThreshold: 0.15,
          },
        },
        abandonRequestsRule: {
          active: true,
          parameters: {
            abandonDurationMultiplier: 1.8,
            minSegmentDownloadTimeThresholdInMs: 500,
            minThroughputSamplesThreshold: 6,
          },
        },
        l2ARule: {
          active: false,
        },
        loLPRule: {
          active: false,
        },
      },
      throughput: {
        averageCalculationMode: Constants.THROUGHPUT_CALCULATION_MODES.EWMA,
        lowLatencyDownloadTimeCalculationMode: Constants.LOW_LATENCY_DOWNLOAD_TIME_CALCULATION_MODE.MOOF_PARSING,
        useResourceTimingApi: true,
        useNetworkInformationApi: {
          xhr: false,
          fetch: true,
        },
        useDeadTimeLatency: true,
        bandwidthSafetyFactor: 0.9,
        sampleSettings: {
          live: 3,
          vod: 4,
          enableSampleSizeAdjustment: true,
          decreaseScale: 0.7,
          increaseScale: 1.3,
          maxMeasurementsToKeep: 20,
          averageLatencySampleAmount: 4,
        },
        ewma: {
          throughputSlowHalfLifeSeconds: 8,
          throughputFastHalfLifeSeconds: 3,
          latencySlowHalfLifeCount: 2,
          latencyFastHalfLifeCount: 1,
          weightDownloadTimeMultiplicationFactor: 0.0015,
        },
      },
      maxBitrate: {
        audio: -1,
        video: -1,
      },
      minBitrate: {
        audio: -1,
        video: -1,
      },
      initialBitrate: {
        audio: -1,
        video: -1,
      },
      autoSwitchBitrate: {
        audio: true,
        video: true,
      },
    },
    cmcd: {
      applyParametersFromMpd: true,
      enabled: false,
      sid: null,
      cid: null,
      rtp: null,
      rtpSafetyFactor: 5,
      mode: Constants.CMCD_MODE_QUERY,
      enabledKeys: Constants.CMCD_AVAILABLE_KEYS,
      includeInRequests: ["segment", "mpd"],
    },
    cmsd: {
      enabled: false,
      abr: {
        applyMb: false,
        etpWeightRatio: 0,
      },
    },
    defaultSchemeIdUri: {
      viewpoint: "",
      audioChannelConfiguration: "urn:mpeg:mpegB:cicp:ChannelConfiguration",
      role: "urn:mpeg:dash:role:2011",
      accessibility: "urn:mpeg:dash:role:2011",
    },
  },
  errors: {
    recoverAttempts: {
      mediaErrorDecode: 5,
    },
  },
};
