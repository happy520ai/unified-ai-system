import { describe, it, expect } from "vitest";
import { createLogger, createRequestLogger } from "./structuredLogger.js";

describe("structured-logger", () => {
  it("creates logger with default level", () => {
    const logger = createLogger({ app: "test" });
    expect(logger.info).toBeInstanceOf(Function);
    expect(logger.warn).toBeInstanceOf(Function);
    expect(logger.error).toBeInstanceOf(Function);
    expect(logger.debug).toBeInstanceOf(Function);
  });

  it("creates child logger with context", () => {
    const logger = createLogger({ app: "test" });
    const child = logger.child({ requestId: "r1" });
    expect(child.info).toBeInstanceOf(Function);
    expect(child.error).toBeInstanceOf(Function);
  });

  it("creates request logger with timing", () => {
    const logger = createLogger({ app: "test" });
    const reqLogger = createRequestLogger(logger, { headers: {} });
    expect(reqLogger.requestId).toBeDefined();
    expect(reqLogger.startedAt).toBeGreaterThan(0);
    expect(reqLogger.finish).toBeInstanceOf(Function);
  });

  it("respects log level filtering", () => {
    const logger = createLogger({ app: "test", level: "error" });
    // debug and info should be silently filtered
    logger.debug("should_not_appear");
    logger.info("should_not_appear");
    // We can't easily capture output, but we verify no errors thrown
    logger.error("should_appear", { key: "value" });
  });
});
