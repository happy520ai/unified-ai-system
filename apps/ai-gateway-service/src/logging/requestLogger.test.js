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
      logger.close();
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
        costSource: "provider-reported",
        costEstimateAvailable: true,
        shadow: true,
        providerCallAttempted: true,
        billable: true,
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
      expect(records[0]).toEqual(expect.objectContaining({
        costSource: "provider-reported",
        costEstimateAvailable: true,
        shadow: true,
        providerCallAttempted: true,
        billable: true,
      }));
      expect(stats.unknownCostRecords).toBe(0);

      const health = logger.getHealth();
      expect(health.status).toBe("ready");
      expect(health).not.toHaveProperty("logDir");
      logger.close();
    } finally {
      rmSync(logDir, { recursive: true, force: true });
    }
  });

  it("defaults body logging off and isolates tenant queries", () => {
    const logDir = mkdtempSync(join(tmpdir(), "request-logger-tenant-"));
    try {
      const logger = createRequestLogger({ logDir });
      logger.log({
        tenantId: "tenant-a",
        method: "POST",
        path: "/v1/chat/completions",
        statusCode: 200,
        requestBody: { apiKey: "sk-" + "never-log", prompt: "private prompt" },
      });
      logger.log({
        tenantId: "tenant-b",
        method: "POST",
        path: "/v1/chat/completions",
        statusCode: 200,
      });
      logger.flush();

      const tenantA = logger.query({ tenantId: "tenant-a" });
      const tenantB = logger.query({ tenantId: "tenant-b" });
      expect(tenantA).toHaveLength(1);
      expect(tenantB).toHaveLength(1);
      expect(tenantA[0]).not.toHaveProperty("requestPreview");
      expect(JSON.stringify(tenantA)).not.toContain("sk-" + "never-log");
      expect(logger.getStats({ tenantId: "tenant-a" }).totalRequests).toBe(1);
      logger.close();
    } finally {
      rmSync(logDir, { recursive: true, force: true });
    }
  });

  it("sanitizes explicitly enabled body previews", () => {
    const logDir = mkdtempSync(join(tmpdir(), "request-logger-body-"));
    try {
      const logger = createRequestLogger({ logDir, enableBodyLogging: true });
      logger.log({
        tenantId: "tenant-a",
        method: "POST",
        path: "/providers/runtime-credential",
        statusCode: 200,
        requestBody: {
          apiKey: "sk-" + "provider-value-that-must-disappear",
          nested: { authorization: "Bearer private-bearer-value" },
          safe: "visible",
        },
      });
      logger.flush();
      const [record] = logger.query({ tenantId: "tenant-a" });
      expect(record.requestPreview).toContain("visible");
      expect(record.requestPreview).not.toContain("sk-" + "provider-value-that-must-disappear");
      expect(record.requestPreview).not.toContain("private-bearer-value");
      logger.close();
    } finally {
      rmSync(logDir, { recursive: true, force: true });
    }
  });
});
