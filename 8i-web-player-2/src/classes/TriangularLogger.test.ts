// import { vi, afterEach, beforeEach, describe, expect, it } from "vitest";
import { LOG_LEVEL_DEBUG } from "../lib/constants";
import { TriangularLogger } from "./TriangularLogger";

describe("TriangularLogger", () => {
  let logger: TriangularLogger;

  beforeEach(() => {
    logger = new TriangularLogger("TriangularLogger", {
      logLevel: LOG_LEVEL_DEBUG,
    });
  });

  it("should create a new instance of TriangularLogger", () => {
    expect(logger).toBeInstanceOf(TriangularLogger);
  });

  // TODO: Fix these tests
  // it("should have a default log level of DEBUG", () => {
  //   // console.log(typeof logger.logger.settings.minLevel, typeof LOG_LEVEL_DEBUG)
  //   expect(logger.logger?.settings.minLevel).toBe(LOG_LEVEL_DEBUG);
  // });

  // it("should log messages at different levels", () => {
  //   const debugSpy = vi.spyOn(logger.logger!, "debug");
  //   const errorSpy = vi.spyOn(logger.logger!, "error");

  //   logger.debug("This is a debug message");
  //   logger.error("This is an error message");

  //   expect(debugSpy).toHaveBeenCalledWith("This is a debug message");
  //   expect(errorSpy).toHaveBeenCalledWith("This is an error message");
  // });

  // it("should get a sub-logger with a valid name", () => {
  //   const subLogger = logger.getSubLogger("mySubLogger");
  //   expect(subLogger.settings.name).toBe("mySubLogger");
  // });

  // it("should throw an error when getting a sub-logger with an invalid name", () => {
  //   expect(() => logger.getSubLogger("")).toThrowError('Invalid name ""');
  // });

  // it("should destroy the logger instance", () => {
  //   const sillySpy = vi.spyOn(logger.logger!, "silly");
  //   logger.destroy();
  //   logger.silly("This message should not be logged");
  //   expect(sillySpy).not.toHaveBeenCalled();
  // });
});
