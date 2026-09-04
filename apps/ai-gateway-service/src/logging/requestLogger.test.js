import { describe, expect, it } from "vitest";
import { mkdirSync, mkdtempSync, readdirSync, rmSync, writeFileSync } from "node:fs";
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
        agentId: "agt_usage_agent",
        agentRunId: "agr_usage_run",
        agentPolicyHash: `sha256:${"a".repeat(64)}`,
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
        agentId: "agt_usage_agent",
        agentRunId: "agr_usage_run",
        agentPolicyHash: `sha256:${"a".repeat(64)}`,
      }));
      expect(logger.query({ agentId: "agt_usage_agent" })).toHaveLength(1);
      expect(logger.query({ agentId: "agt_other" })).toHaveLength(0);
      expect(stats.byAgent).toEqual({
        agt_usage_agent: { count: 1, tokens: 8, cost: 0.000016, errors: 0 },
      });
      expect(stats.unknownCostRecords).toBe(0);
      expect(stats).toMatchObject({
        partial: false,
        truncated: false,
        recordsConsidered: 1,
        recordLimit: 10000,
        scope: "current-day-file-window",
      });

      const health = logger.getHealth();
      expect(health.status).toBe("ready");
      expect(health).not.toHaveProperty("logDir");
      logger.close();
    } finally {
      rmSync(logDir, { recursive: true, force: true });
    }
  });

  it("fsyncs every durable record and exposes durable health", () => {
    const logDir = mkdtempSync(join(tmpdir(), "request-logger-durable-"));
    try {
      const logger = createRequestLogger({ logDir, durableWrites: true });
      expect(logger.assertDurable()).toBe(true);
      logger.log({
        tenantId: "tenant-a",
        method: "POST",
        path: "/v1/chat/completions",
        statusCode: 200,
        provider: "real-provider",
        model: "real-model",
        totalTokens: 12,
        providerCallAttempted: true,
        billable: true,
      });

      expect(logger.query({ tenantId: "tenant-a" })).toHaveLength(1);
      expect(logger.getHealth()).toEqual(expect.objectContaining({
        status: "ready",
        persistence: "bounded-local-file",
        durableWritesRequired: true,
        bufferSize: 0,
        totalWriteFailures: 0,
        consecutiveWriteFailures: 0,
        lastWriteSuccessAt: expect.any(String),
      }));
      logger.close();
    } finally {
      rmSync(logDir, { recursive: true, force: true });
    }
  });

  it("marks by-Agent statistics partial when the bounded file window truncates", () => {
    const logDir = mkdtempSync(join(tmpdir(), "request-logger-truncated-stats-"));
    try {
      const logger = createRequestLogger({ logDir, enableBodyLogging: false });
      logger.log({ tenantId: "tenant-a", agentId: "agt_truncated", totalTokens: 1 });
      logger.flush();
      const logFile = readdirSync(logDir).find((name) => name.endsWith(".jsonl"));
      expect(logFile).toBeTruthy();
      const baseTimestamp = Date.now();
      const lines = Array.from({ length: 10_001 }, (_, index) => JSON.stringify({
        id: `record-${index}`,
        timestamp: baseTimestamp - index,
        tenantId: "tenant-a",
        agentId: "agt_truncated",
        statusCode: 200,
        latencyMs: 1,
        totalTokens: 1,
        estimatedCostUsd: 0,
        costEstimateAvailable: true,
      }));
      writeFileSync(join(logDir, logFile), `${lines.join("\n")}\n`, "utf8");

      expect(logger.getStats({ tenantId: "tenant-a", agentId: "agt_truncated" })).toMatchObject({
        totalRequests: 10_000,
        partial: true,
        truncated: true,
        recordsConsidered: 10_000,
        recordLimit: 10_000,
        scope: "current-day-file-window",
        byAgent: {
          agt_truncated: { count: 10_000, tokens: 10_000, cost: 0, errors: 0 },
        },
      });
      logger.close();
    } finally {
      rmSync(logDir, { recursive: true, force: true });
    }
  });

  it("separates concurrent process files while aggregating their usage", () => {
    const logDir = mkdtempSync(join(tmpdir(), "request-logger-multi-instance-"));
    try {
      const first = createRequestLogger({ logDir, durableWrites: true });
      const second = createRequestLogger({ logDir, durableWrites: true });
      first.log({ tenantId: "tenant-a", provider: "provider-a", totalTokens: 3 });
      second.log({ tenantId: "tenant-a", provider: "provider-b", totalTokens: 5 });

      const records = first.query({ tenantId: "tenant-a" });
      expect(records).toHaveLength(2);
      expect(new Set(records.map((record) => record.provider))).toEqual(new Set(["provider-a", "provider-b"]));
      expect(first.getStats({ tenantId: "tenant-a" }).totalTokens).toBe(8);
      first.close();
      second.close();
    } finally {
      rmSync(logDir, { recursive: true, force: true });
    }
  });

  it("reports write-ahead attempts as unresolved until a terminal record commits", () => {
    const logDir = mkdtempSync(join(tmpdir(), "request-logger-attempt-"));
    try {
      const logger = createRequestLogger({ logDir, durableWrites: true });
      logger.log({
        usageAttemptId: "attempt-1",
        usageEventType: "attempt-started",
        provider: "real-provider",
        providerCallAttempted: true,
        billable: true,
        costEstimateAvailable: false,
      });
      expect(logger.getStats({})).toEqual(expect.objectContaining({
        totalRequests: 0,
        unknownCostRecords: 1,
        unresolvedBillableAttempts: 1,
      }));

      logger.log({
        usageAttemptId: "attempt-1",
        usageEventType: "attempt-completed",
        provider: "real-provider",
        providerCallAttempted: true,
        billable: true,
        totalTokens: 9,
        estimatedCostUsd: 0.001,
        costEstimateAvailable: true,
      });
      expect(logger.getStats({})).toEqual(expect.objectContaining({
        totalRequests: 1,
        totalTokens: 9,
        unknownCostRecords: 0,
        unresolvedBillableAttempts: 0,
      }));
      logger.close();
    } finally {
      rmSync(logDir, { recursive: true, force: true });
    }
  });

  it("fails closed when durable storage is unavailable and recovers buffered evidence", () => {
    const root = mkdtempSync(join(tmpdir(), "request-logger-durable-failure-"));
    const logDir = join(root, "logs");
    mkdirSync(logDir);
    try {
      const logger = createRequestLogger({ logDir, durableWrites: true });
      rmSync(logDir, { recursive: true, force: true });
      writeFileSync(logDir, "not a directory", "utf8");

      expect(() => logger.log({
        method: "POST",
        path: "/v1/chat/completions",
        statusCode: 200,
        providerCallAttempted: true,
        billable: true,
      })).toThrowError(expect.objectContaining({ code: "USAGE_LEDGER_WRITE_FAILED" }));
      expect(logger.getHealth()).toEqual(expect.objectContaining({
        status: "degraded",
        bufferSize: 1,
        totalWriteFailures: 1,
        consecutiveWriteFailures: 1,
      }));

      rmSync(logDir, { force: true });
      mkdirSync(logDir);
      expect(logger.assertDurable()).toBe(true);
      expect(logger.query({})).toHaveLength(1);
      expect(logger.getHealth()).toEqual(expect.objectContaining({
        status: "ready",
        bufferSize: 0,
        consecutiveWriteFailures: 0,
      }));
      logger.close();
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("refuses to construct a durable logger on a memory-only or invalid path", () => {
    expect(() => createRequestLogger({ logDir: "", durableWrites: true }))
      .toThrowError(expect.objectContaining({ code: "USAGE_LEDGER_UNAVAILABLE" }));

    const root = mkdtempSync(join(tmpdir(), "request-logger-durable-invalid-"));
    try {
      const blocker = join(root, "blocker");
      writeFileSync(blocker, "not a directory", "utf8");
      expect(() => createRequestLogger({ logDir: join(blocker, "logs"), durableWrites: true }))
        .toThrowError(expect.objectContaining({ code: "USAGE_LEDGER_UNAVAILABLE" }));
    } finally {
      rmSync(root, { recursive: true, force: true });
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
