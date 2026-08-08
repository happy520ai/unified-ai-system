// Unit tests for the file logger. These run without writing to a real
// disk-mounted path so they work in any sandbox.

import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { createLogger, loggerInternals } from "./logger.js";

test("logger writes structured lines and supports level tags", async () => {
  const dir = mkdtempSync(join(tmpdir(), "mcp-logger-"));
  try {
    const logPath = join(dir, "test.log");
    const logger = createLogger({
      filePath: logPath,
      teeToStderr: false,
      component: "test",
    });
    logger.info("hello", { user: "alice" });
    logger.warn("watch out");
    await logger.close();

    const text = readFileSync(logPath, "utf8");
    const lines = text.trim().split("\n");
    assert.equal(lines.length, 2);
    assert.match(lines[0], / INFO test \{"user":"alice"\} hello/);
    assert.match(lines[1], / WARN test watch out/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("logger queue is non-blocking on multiple writes", async () => {
  const dir = mkdtempSync(join(tmpdir(), "mcp-logger-"));
  try {
    const logPath = join(dir, "burst.log");
    const logger = createLogger({
      filePath: logPath,
      teeToStderr: false,
    });
    for (let i = 0; i < 50; i += 1) {
      logger.info(`msg-${i}`);
    }
    await logger.close();
    const text = readFileSync(logPath, "utf8");
    const lines = text.trim().split("\n");
    assert.equal(lines.length, 50);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("safeString handles errors and non-string values without throwing", () => {
  const errorInfo = loggerInternals.safeString(new Error("boom"));
  assert.match(errorInfo, /Error: boom/);
  const objInfo = loggerInternals.safeString({ a: 1 });
  assert.match(objInfo, /"a":1/);
});
