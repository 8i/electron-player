import { isValidInteger } from "../lib/validators";
import {
  LOG_LEVEL_SILLY,
  LOG_LEVEL_TRACE,
  LOG_LEVEL_DEBUG,
  LOG_LEVEL_INFO,
  LOG_LEVEL_WARN,
  LOG_LEVEL_ERROR,
  LOG_LEVEL_FATAL,
} from "../lib/constants";

const LOG_LEVEL_NAMES = new Map<number, string>([
  [LOG_LEVEL_SILLY, "SILLY"],
  [LOG_LEVEL_TRACE, "TRACE"],
  [LOG_LEVEL_DEBUG, "DEBUG"],
  [LOG_LEVEL_INFO, "INFO "],
  [LOG_LEVEL_WARN, "WARN "],
  [LOG_LEVEL_ERROR, "ERROR"],
  [LOG_LEVEL_FATAL, "FATAL"],
]);

type TriangularLoggerSettings = {
  logLevel?: number;
};

export class TriangularLogger {
  name: string;
  logLevel: number;
  prettyLogTemplate: string[] = [];

  constructor(name = "Triangular", settings: TriangularLoggerSettings = {}) {
    this.name = name;

    const { prettyLogTemplate } = this;
    let logLevel = settings?.logLevel;

    if (!isValidInteger(logLevel)) {
      logLevel = process.env.NODE_ENV === "production" ? LOG_LEVEL_ERROR : LOG_LEVEL_DEBUG;
    }

    this.logLevel = logLevel;

    prettyLogTemplate.push(`{{logLevelName}}`, `{{nameWithDelimiterSuffix}}`);

    if (logLevel > LOG_LEVEL_DEBUG) {
      prettyLogTemplate.unshift("{{dateIsoStr}}");
    }
  }

  formatLog(logLevel, ...args: any[]): any[] {
    const { prettyLogTemplate, name } = this;
    const dateIsoStr = new Date().toISOString();
    const nameWithDelimiterSuffix = name ? `${name}:` : "";
    const logLevelName = LOG_LEVEL_NAMES.get(logLevel);

    // Replace placeholders in the prettyLogTemplate
    let formattedLog = prettyLogTemplate.join(" ");
    formattedLog = formattedLog
      .replace("{{logLevelName}}", logLevelName)
      .replace("{{dateIsoStr}}", dateIsoStr)
      .replace("{{nameWithDelimiterSuffix}}", nameWithDelimiterSuffix);

    return [formattedLog, ...args];
  }

  setLogLevel(logLevel: number) {
    this.logLevel = logLevel;
  }

  silly(...args: any[]) {
    const { logLevel } = this;
    if (logLevel > LOG_LEVEL_SILLY) {
      return;
    }

    console.debug(...this.formatLog(LOG_LEVEL_SILLY, ...args));
  }

  trace(...args: any[]) {
    const { logLevel } = this;
    if (logLevel > LOG_LEVEL_TRACE) {
      return;
    }
    console.trace(...this.formatLog(LOG_LEVEL_TRACE, ...args));
  }

  debug(...args: any[]) {
    const { logLevel } = this;
    if (logLevel > LOG_LEVEL_DEBUG) {
      return;
    }
    console.debug(...this.formatLog(LOG_LEVEL_DEBUG, ...args));
  }

  info(...args: any[]) {
    const { logLevel } = this;
    if (logLevel > LOG_LEVEL_INFO) {
      return;
    }
    console.info(...this.formatLog(LOG_LEVEL_INFO, ...args));
  }

  warn(...args: any[]) {
    const { logLevel } = this;
    if (logLevel > LOG_LEVEL_WARN) {
      return;
    }
    console.warn(...this.formatLog(LOG_LEVEL_WARN, ...args));
  }

  error(...args: any[]) {
    const { logLevel } = this;
    if (logLevel > LOG_LEVEL_ERROR) {
      return;
    }
    console.error(...this.formatLog(LOG_LEVEL_ERROR, ...args));
  }

  fatal(...args: any[]) {
    const { logLevel } = this;
    if (logLevel > LOG_LEVEL_FATAL) {
      return;
    }
    console.error(...this.formatLog(LOG_LEVEL_FATAL, "FATAL:", ...args));
  }
}
