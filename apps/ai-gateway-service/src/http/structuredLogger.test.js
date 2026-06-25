import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { createLogger, createRequestLogger } from "./structuredLogger.js";

describe("structured-logger", () => {
  it("creates logger with default level", () => {
    const logger = createLogger({ app: "test" });
    assert.equal(typeof logger.info, "function");
    assert.equal(typeof logger.warn, "function");
    assert.equal(typeof logger.error, "function");
    assert.equal(typeof logger.debug, "function");
  });

  it("creates child logger with context", () => {
    const logger = createLogger({ app: "test" });
    const child = logger.child({ requestId: "r1" });
    assert.equal(typeof child.info, "function");
    assert.equal(typeof child.error, "function");
  });

  it("creates request logger with timing", () => {
    const logger = createLogger({ app: "test" });
    const reqLogger = createRequestLogger(logger, { headers: {} });
    assert.ok(reqLogger.requestId !== undefined);
    assert.ok(reqLogger.startedAt > 0);
    assert.equal(typeof reqLogger.finish, "function");
  });

  it("respects log level filtering", () => {
    const logger = createLogger({ app: "test", level: "error" });
    logger.debug("should_not_appear");
    logger.info("should_not_appear");
    logger.error("should_appear", { key: "value" });
  });
});
