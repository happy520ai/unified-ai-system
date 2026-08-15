import { describe, expect, it } from "vitest";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createRequestLogger } from "./requestLogger.js";

describe("requestLogger persistence", () => {
  it("fails open when the log directory cannot be created", () => {
    const dir = mkdtempSync(join(tmpdir(), "request-logger-ro-"));
    try {
      // 用一个文件作为父"目录"：mkdir 必然失败（ENOTDIR/EACCES）。
      const blocker = join(dir, "blocker");
      writeFileSync(blocker, "not a directory");
      const logger = createRequestLogger({ logDir: join(blocker, "logs"), enableBodyLogging: false });
      expect(() =>
        logger.log({ method: "GET", path: "/healthz", statusCode: 200, latencyMs: 1 }),
      ).not.toThrow();
      expect(() => logger.flush()).not.toThrow();
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("logs, flushes, queries and summarizes usage entries", () => {
    const logDir = mkdtempSync(join(tmpdir(), "request-logger-"));
    try {
      const logger = createRequestLogger({ logDir, enableBodyLogging: false });
      logger.log({
        method: "POST",
        path: "/v1/chat/completions",
        statusCode: 200,
        latencyMs: 42,
        provider: "fake",
        model: "fake-model",
        inputTokens: 3,
        outputTokens: 5,
        totalTokens: 8,
        estimatedCostUsd: 0.000016,
        traceId: "trace-1",
      });
      logger.flush();

      const stats = logger.getStats({});
      expect(stats.totalRequests).toBe(1);
      expect(stats.totalTokens).toBe(8);
      expect(stats.avgLatencyMs).toBe(42);

      const records = logger.query({ provider: "fake" });
      expect(records).toHaveLength(1);
      expect(records[0].totalTokens).toBe(8);

      const health = logger.getHealth();
      expect(health.status).toBe("ready");
    } finally {
      rmSync(logDir, { recursive: true, force: true });
    }
  });
});
