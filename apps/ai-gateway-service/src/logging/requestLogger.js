import { randomUUID } from "node:crypto";
import {
  appendFileSync,
  chmodSync,
  closeSync,
  existsSync,
  mkdirSync,
  openSync,
  readSync,
  readdirSync,
  renameSync,
  rmSync,
  statSync,
} from "node:fs";
import { resolve } from "node:path";
import {
  sanitizeLogText,
  sanitizeLogValue,
  summarizeErrorForLog,
} from "../security/logSanitizationPolicy.ts";

const BUFFER_FLUSH_SIZE = 50;
const BUFFER_FLUSH_INTERVAL_MS = 5000;
const MAX_MEMORY_RECORDS = BUFFER_FLUSH_SIZE * 4;

export function createRequestLogger(options = {}) {
  const persistenceEnabled = options.logDir !== "";
  const logDir = options.logDir ?? resolve(process.cwd(), ".data/request-logs");
  const maxLogSizeBytes = clampInteger(
    options.maxLogSizeBytes,
    16 * 1024 * 1024,
    64 * 1024,
    1024 * 1024 * 1024,
  );
  const maxRetentionDays = clampInteger(options.maxRetentionDays, 7, 1, 90);
  const enableBodyLogging = options.enableBodyLogging === true;
  const enableIdentityLogging = options.enableIdentityLogging === true;
  const maxBodyLogSize = clampInteger(options.maxBodyLogSize, 4096, 256, 64 * 1024);

  let logDirWritable = persistenceEnabled;
  if (persistenceEnabled) {
    try {
      mkdirSync(logDir, { recursive: true, mode: 0o700 });
      if (!statSync(logDir).isDirectory()) {
        throw new Error("configured log path is not a directory");
      }
      try {
        chmodSync(logDir, 0o700);
      } catch {
        // POSIX mode is not the Windows ACL boundary.
      }
    } catch {
      logDirWritable = false;
      console.warn(
        "[requestLogger] log directory unavailable; request logs stay in bounded memory only.",
      );
    }
  }

  const buffer = [];
  let lastRetentionPruneDate = "";

  function log(entry = {}) {
    const record = sanitizeLogValue({
      id: randomUUID(),
      timestamp: Date.now(),
      tenantId: sanitizeLogText(entry.tenantId ?? "default", 256),
      method: sanitizeLogText(entry.method, 16),
      path: sanitizeLogText(entry.path, 2048),
      statusCode: finiteNumber(entry.statusCode),
      latencyMs: finiteNumber(entry.latencyMs),
      provider: optionalText(entry.provider, 256),
      model: optionalText(entry.model, 256),
      inputTokens: finiteNumber(entry.inputTokens, 0),
      outputTokens: finiteNumber(entry.outputTokens, 0),
      totalTokens: finiteNumber(entry.totalTokens, 0),
      estimatedCostUsd: finiteNumber(entry.estimatedCostUsd, 0),
      cacheHit: entry.cacheHit === true,
      fallbackUsed: entry.fallbackUsed === true,
      fallbackFrom: optionalText(entry.fallbackFrom, 256),
      error: entry.error ? sanitizeLogValue(entry.error) : undefined,
      traceId: optionalText(entry.traceId, 256),
      ...(enableIdentityLogging
        ? {
            userAgent: optionalText(entry.userAgent, 1024),
            clientIp: optionalText(entry.clientIp, 128),
            userId: optionalText(entry.userId, 256),
          }
        : {}),
    });

    if (enableBodyLogging) {
      if (entry.requestBody !== undefined) {
        record.requestPreview = createSafePreview(entry.requestBody, maxBodyLogSize);
      }
      if (entry.responseBody !== undefined) {
        record.responsePreview = createSafePreview(entry.responseBody, maxBodyLogSize);
      }
    }

    buffer.push(record);
    if (buffer.length >= BUFFER_FLUSH_SIZE) {
      flush();
    }
  }

  function flush() {
    if (buffer.length === 0) return;
    if (!logDirWritable) {
      if (buffer.length > MAX_MEMORY_RECORDS) {
        buffer.splice(0, buffer.length - MAX_MEMORY_RECORDS);
      }
      return;
    }

    const today = new Date().toISOString().slice(0, 10);
    const logFile = resolve(logDir, "requests-" + today + ".jsonl");
    const pending = buffer.splice(0);
    const lines = serializeBoundedRecords(pending, maxLogSizeBytes);
    if (!lines) return;

    try {
      if (lastRetentionPruneDate !== today) {
        pruneExpiredLogFiles(logDir, today, maxRetentionDays);
        lastRetentionPruneDate = today;
      }
      rotateLogFileIfNeeded(logFile, Buffer.byteLength(lines), maxLogSizeBytes);
      appendFileSync(logFile, lines, { encoding: "utf8", mode: 0o600 });
      try {
        chmodSync(logFile, 0o600);
      } catch {
        // POSIX mode is not the Windows ACL boundary.
      }
    } catch (error) {
      console.error("[requestLogger] log write failed:", summarizeErrorForLog(error));
    }
  }

  function query(filter = {}) {
    if (!logDirWritable) return [];

    const today = new Date().toISOString().slice(0, 10);
    const logFile = resolve(logDir, "requests-" + today + ".jsonl");
    if (!existsSync(logFile) && !existsSync(logFile + ".1")) return [];

    const limit = clampInteger(filter.limit, 100, 1, 10000);
    const offset = clampInteger(filter.offset, 0, 0, 10000);
    const targetCount = limit + offset;
    const lines = [
      ...readBoundedLogLines(logFile + ".1", maxLogSizeBytes),
      ...readBoundedLogLines(logFile, maxLogSizeBytes),
    ];
    const results = [];
    let parseFailures = 0;

    for (let index = lines.length - 1; index >= 0; index -= 1) {
      try {
        const record = JSON.parse(lines[index]);
        if (filter.tenantId && record.tenantId !== filter.tenantId) continue;
        if (filter.since && record.timestamp < filter.since) continue;
        if (filter.until && record.timestamp > filter.until) continue;
        if (filter.provider && record.provider !== filter.provider) continue;
        if (filter.model && record.model !== filter.model) continue;
        if (filter.statusCode && record.statusCode !== filter.statusCode) continue;
        if (filter.minLatency && record.latencyMs < filter.minLatency) continue;
        if (filter.maxLatency && record.latencyMs > filter.maxLatency) continue;
        if (filter.cacheHit !== undefined && record.cacheHit !== filter.cacheHit) continue;
        results.push(record);
        if (results.length >= targetCount) break;
      } catch {
        parseFailures += 1;
      }
    }

    if (parseFailures > 0) {
      console.warn("[requestLogger] ignored malformed bounded log records:", parseFailures);
    }
    return results.slice(offset, offset + limit);
  }

  function getStats(filter = {}) {
    const records = query({ ...filter, limit: 10000 });
    if (records.length === 0) {
      return { totalRequests: 0, avgLatencyMs: 0, totalTokens: 0, totalCostUsd: 0 };
    }

    const totalRequests = records.length;
    const totalLatency = records.reduce((sum, record) => sum + (record.latencyMs ?? 0), 0);
    const totalTokens = records.reduce((sum, record) => sum + (record.totalTokens ?? 0), 0);
    const totalCost = records.reduce((sum, record) => sum + (record.estimatedCostUsd ?? 0), 0);
    const errorCount = records.filter((record) => record.statusCode >= 400).length;
    const cacheHits = records.filter((record) => record.cacheHit).length;
    const fallbacks = records.filter((record) => record.fallbackUsed).length;

    // 真实延迟分位数（nearest-rank）：对最近最多 10000 条记录排序取 p50/p95/p99。
    const sortedLatencies = records
      .map((record) => Number(record.latencyMs ?? 0))
      .filter((value) => Number.isFinite(value))
      .sort((a, b) => a - b);
    const latencyQuantile = (q) => (sortedLatencies.length === 0
      ? 0
      : sortedLatencies[
        Math.min(sortedLatencies.length - 1, Math.max(0, Math.ceil(q * sortedLatencies.length) - 1))
      ]);
    const latencyQuantiles = sortedLatencies.length > 0
      ? {
        p50: latencyQuantile(0.5),
        p95: latencyQuantile(0.95),
        p99: latencyQuantile(0.99),
      }
      : undefined;

    const byProvider = {};
    const byModel = {};
    for (const record of records) {
      const provider = record.provider || "unknown";
      if (!byProvider[provider]) {
        byProvider[provider] = { count: 0, tokens: 0, cost: 0, errors: 0 };
      }
      byProvider[provider].count += 1;
      byProvider[provider].tokens += record.totalTokens ?? 0;
      byProvider[provider].cost += record.estimatedCostUsd ?? 0;
      if (record.statusCode >= 400) byProvider[provider].errors += 1;

      const model = record.model || "unknown";
      if (!byModel[model]) {
        byModel[model] = { count: 0, tokens: 0, cost: 0 };
      }
      byModel[model].count += 1;
      byModel[model].tokens += record.totalTokens ?? 0;
      byModel[model].cost += record.estimatedCostUsd ?? 0;
    }

    return {
      totalRequests,
      avgLatencyMs: Math.round(totalLatency / totalRequests),
      ...(latencyQuantiles ? { latencyQuantiles } : {}),
      totalTokens,
      totalCostUsd: Math.round(totalCost * 1000000) / 1000000,
      errorRate: errorCount / totalRequests,
      cacheHitRate: cacheHits / totalRequests,
      fallbackRate: fallbacks / totalRequests,
      byProvider,
      byModel,
    };
  }

  function getHealth() {
    const today = new Date().toISOString().slice(0, 10);
    const logFile = logDirWritable ? resolve(logDir, "requests-" + today + ".jsonl") : "";
    const activeBytes = logFile && existsSync(logFile) ? safeFileSize(logFile) : 0;
    const archiveBytes = logFile && existsSync(logFile + ".1") ? safeFileSize(logFile + ".1") : 0;

    return {
      status: "ready",
      persistence: logDirWritable ? "bounded-local-file" : "memory-only",
      bufferSize: buffer.length,
      todayStoredBytes: activeBytes + archiveBytes,
      maxLogSizeBytes,
      maxRetentionDays,
      bodyLoggingEnabled: enableBodyLogging,
      identityLoggingEnabled: enableIdentityLogging,
    };
  }

  const flushTimer = setInterval(flush, BUFFER_FLUSH_INTERVAL_MS);
  flushTimer.unref();

  const flushOnExit = () => flush();
  process.on("beforeExit", flushOnExit);
  process.on("SIGINT", flushOnExit);
  process.on("SIGTERM", flushOnExit);

  let closed = false;
  function close() {
    if (closed) return;
    closed = true;
    clearInterval(flushTimer);
    flush();
    process.off("beforeExit", flushOnExit);
    process.off("SIGINT", flushOnExit);
    process.off("SIGTERM", flushOnExit);
  }

  return { log, flush, query, getStats, getHealth, close };
}

function createSafePreview(value, maxLength) {
  try {
    return truncate(JSON.stringify(sanitizeLogValue(value)), maxLength);
  } catch {
    return "[unserializable]";
  }
}

function serializeBoundedRecords(records, maxBytes) {
  const selected = [];
  let totalBytes = 0;
  for (let index = records.length - 1; index >= 0; index -= 1) {
    const line = JSON.stringify(records[index]) + "\n";
    const bytes = Buffer.byteLength(line);
    if (bytes > maxBytes) continue;
    if (totalBytes + bytes > maxBytes) break;
    selected.push(line);
    totalBytes += bytes;
  }
  return selected.reverse().join("");
}

function rotateLogFileIfNeeded(logFile, incomingBytes, maxBytes) {
  const currentBytes = existsSync(logFile) ? safeFileSize(logFile) : 0;
  if (currentBytes + incomingBytes <= maxBytes) return;
  const archive = logFile + ".1";
  rmSync(archive, { force: true });
  if (existsSync(logFile)) renameSync(logFile, archive);
}

function readBoundedLogLines(filePath, maxBytes) {
  if (!existsSync(filePath)) return [];
  const size = safeFileSize(filePath);
  if (size <= 0) return [];
  const length = Math.min(size, maxBytes);
  const offset = Math.max(0, size - length);
  const buffer = Buffer.alloc(length);
  const descriptor = openSync(filePath, "r");
  try {
    readSync(descriptor, buffer, 0, length, offset);
  } finally {
    closeSync(descriptor);
  }
  let text = buffer.toString("utf8");
  if (offset > 0) {
    const firstNewline = text.indexOf("\n");
    text = firstNewline >= 0 ? text.slice(firstNewline + 1) : "";
  }
  return text.split("\n").filter(Boolean);
}

function pruneExpiredLogFiles(logDir, today, retentionDays) {
  const cutoff = new Date(today + "T00:00:00.000Z");
  cutoff.setUTCDate(cutoff.getUTCDate() - retentionDays);
  const cutoffDate = cutoff.toISOString().slice(0, 10);
  for (const name of readdirSync(logDir).slice(0, 10000)) {
    const match = /^requests-(\d{4}-\d{2}-\d{2})\.jsonl(?:\.1)?$/.exec(name);
    if (match && match[1] < cutoffDate) {
      rmSync(resolve(logDir, name), { force: true });
    }
  }
}

function safeFileSize(filePath) {
  try {
    return statSync(filePath).size;
  } catch {
    return 0;
  }
}

function finiteNumber(value, fallback) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function optionalText(value, maxLength) {
  if (value === undefined || value === null || value === "") return undefined;
  return sanitizeLogText(value, maxLength);
}

function clampInteger(value, fallback, min, max) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(Math.max(Math.trunc(parsed), min), max);
}

function truncate(value, maxLength) {
  if (!value || value.length <= maxLength) return value;
  return value.slice(0, maxLength) + "...[truncated]";
}
