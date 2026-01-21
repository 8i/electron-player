export const ERR_NOT_IMPLEMENTED = "Not implemented";
export const ERR_NO_DECRYPTION_KEY = "No decryption key available";

// TriangularLogger log levels
export const LOG_LEVEL_SILLY = 0;
export const LOG_LEVEL_TRACE = 1;
export const LOG_LEVEL_DEBUG = 2;
export const LOG_LEVEL_INFO = 3;
export const LOG_LEVEL_WARN = 4;
export const LOG_LEVEL_ERROR = 5;
export const LOG_LEVEL_FATAL = 6;

export const DASH_PLAYER_EVENT_INITIALIZED = "initialized";
export const DASH_PLAYER_EVENT_ERROR = "error";

// Generic events
export const EVENT_ERROR = "error";

// SourceBuffer API events
export const EVENT_UPDATE_START = "updatestart";
export const EVENT_UPDATE = "update";
export const EVENT_UPDATE_END = "updateend";
export const EVENT_ABORT = "abort";

// @deprecate
export const VIDEO_MAX_WIDTH = 4096;
export const FRAME_BUFFER_WIDTH = 2048;
export const FRAME_BUFFER_HEIGHT = 2048;
export const MAX_BONE_TRANSFORMS = 25;
export const REQUEST_VIDEO_FRAME_CALLBACK = "requestVideoFrameCallback";
export const MESH_INIT_SEGMENT_MAX_LENGTH = 740;
export const DEFAULT_CONTRAST = 0.98;
export const DEFAULT_OPACITY = 1.0;

export const MIME_TYPE_MESH_FB = 'mesh/fb;codecs="draco.514"';
export const MIME_TYPE_MESH_MP4 = 'mesh/mp4;codecs="draco.514"';
export const MIME_TYPE_JPEG = "image/jpeg";
export const MIME_TYPE_PNG = "image/png";

export const MEDIA_TYPE_AUDIO = "audio";
export const MEDIA_TYPE_VIDEO = "video";
export const MEDIA_TYPE_MESH = "mesh";

export const MIN_VIDEO_SIZE = 4;

export const TIMECODE_HEIGHT = 1;
export const TIMECODE_WIDTH = 16;
export const TIMECODE_PIXEL_STRIDE = 4;
export const TIMECODE_NUM_BITS = 10;

export const DRACO_LIBRARY_PATH = "/draco/";
export const DRACO_WORKER_CONCURRENCY = 4;
export const DRACO_NUMBER_SAMPLES = 1;

export const ENTRY_STRING = "StringEntry";
export const ENTRY_INT_ARRAY = "IntEntryArray";
export const ENTRY_INT = "IntEntry";
export const ENTRY_DOUBLE_ARRAY = "DoubleEntry";

export const SAMPLE_TYPE_FULL = "full";
export const SAMPLE_TYPE_DELTA = "delta";
export const SAMPLE_TYPE_INTERPOLATED = "interpolated";
