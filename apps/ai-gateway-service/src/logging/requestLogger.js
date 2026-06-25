// =============================================================================
// requestLogger.js — 请求/响应日志持久化
// 每个请求完整记录：输入、输出、延迟、Token 数、成本、模型、Provider
// =============================================================================

import { randomUUID } from "node:crypto";
import { existsSync, mkdirSync, appendFileSync, readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";

/**
 * 创建请求日志记录器
 * @param {Object} options
 * @returns {Object}
 */
export function createRequestLogger(options = {}) {
  const logDir = options.logDir ?? resolve(process.cwd(), ".data/request-logs");
  if (!existsSync(logDir)) mkdirSync(logDir, { recursive: true });

  const maxLogSizeBytes = options.maxLogSizeBytes ?? 100 * 1024 * 1024; // 100MB
  const enableBodyLogging = options.enableBodyLogging ?? true;
  const maxBodyLogSize = options.maxBodyLogSize ?? 4096; // 4KB per body

  // 内存缓冲区（批量写入）
  const buffer = [];
  const BUFFER_FLUSH_SIZE = 50;
  const BUFFER_FLUSH_INTERVAL_MS = 5000;

  /**
   * 记录一个请求
   * @param {Object} entry
   */
  function log(entry) {
    const record = {
      id: randomUUID(),
      timestamp: Date.now(),
      method: entry.method,
      path: entry.path,
      statusCode: entry.statusCode,
      latencyMs: entry.latencyMs,
      provider: entry.provider,
      model: entry.model,
      inputTokens: entry.inputTokens ?? 0,
      outputTokens: entry.outputTokens ?? 0,
      totalTokens: entry.totalTokens ?? 0,
      estimatedCostUsd: entry.estimatedCostUsd ?? 0,
      cacheHit: entry.cacheHit ?? false,
      fallbackUsed: entry.fallbackUsed ?? false,
      fallbackFrom: entry.fallbackFrom,
      error: entry.error,
      userAgent: entry.userAgent,
      clientIp: entry.clientIp,
      traceId: entry.traceId,
      userId: entry.userId,
    };

    // 可选：记录请求/响应体（截断）
    if (enableBodyLogging) {
      if (entry.requestBody) {
        record.requestPreview = truncate(JSON.stringify(entry.requestBody), maxBodyLogSize);
      }
      if (entry.responseBody) {
        record.responsePreview = truncate(JSON.stringify(entry.responseBody), maxBodyLogSize);
      }
    }

    buffer.push(record);

    // 缓冲区满时刷新
    if (buffer.length >= BUFFER_FLUSH_SIZE) {
      flush();
    }
  }

  /**
   * 刷新缓冲区到磁盘
   */
  function flush() {
    if (buffer.length === 0) return;

    const today = new Date().toISOString().slice(0, 10);
    const logFile = resolve(logDir, `requests-${today}.jsonl`);

    const lines = buffer.splice(0).map((r) => JSON.stringify(r)).join("\n") + "\n";
    try {
      appendFileSync(logFile, lines, "utf8");
    } catch (err) {
      console.error("[requestLogger] Failed to write log:", err.message);
    }
  }

  /**
   * 查询请求日志
   * @param {Object} filter - { since, until, provider, model, statusCode, limit, offset }
   * @returns {Array}
   */
  function query(filter = {}) {
    const results = [];
    const today = new Date().toISOString().slice(0, 10);
    const logFile = resolve(logDir, `requests-${today}.jsonl`);

    if (!existsSync(logFile)) return [];

    const lines = readFileSync(logFile, "utf8").split("\n").filter(Boolean);
    for (const line of lines) {
      try {
        const record = JSON.parse(line);
        if (filter.since && record.timestamp < filter.since) continue;
        if (filter.until && record.timestamp > filter.until) continue;
        if (filter.provider && record.provider !== filter.provider) continue;
        if (filter.model && record.model !== filter.model) continue;
        if (filter.statusCode && record.statusCode !== filter.statusCode) continue;
        if (filter.minLatency && record.latencyMs < filter.minLatency) continue;
        if (filter.maxLatency && record.latencyMs > filter.maxLatency) continue;
        if (filter.cacheHit !== undefined && record.cacheHit !== filter.cacheHit) continue;
        results.push(record);
      } catch (err) { console.error("[requestLogger]:", err?.message || err); }
    }

    // 排序（最新的在前）
    results.sort((a, b) => b.timestamp - a.timestamp);

    // 分页
    const offset = filter.offset ?? 0;
    const limit = filter.limit ?? 100;
    return results.slice(offset, offset + limit);
  }

  /**
   * 获取统计摘要
   * @param {Object} filter
   * @returns {Object}
   */
  function getStats(filter = {}) {
    const records = query({ ...filter, limit: 10000 });
    if (records.length === 0) {
      return { totalRequests: 0, avgLatencyMs: 0, totalTokens: 0, totalCostUsd: 0 };
    }

    const totalRequests = records.length;
    const totalLatency = records.reduce((s, r) => s + (r.latencyMs ?? 0), 0);
    const totalTokens = records.reduce((s, r) => s + (r.totalTokens ?? 0), 0);
    const totalCost = records.reduce((s, r) => s + (r.estimatedCostUsd ?? 0), 0);
    const errorCount = records.filter((r) => r.statusCode >= 400).length;
    const cacheHits = records.filter((r) => r.cacheHit).length;
    const fallbacks = records.filter((r) => r.fallbackUsed).length;

    // 按 Provider 分组
    const byProvider = {};
    for (const r of records) {
      const p = r.provider ?? "unknown";
      if (!byProvider[p]) byProvider[p] = { count: 0, tokens: 0, cost: 0, errors: 0 };
      byProvider[p].count++;
      byProvider[p].tokens += r.totalTokens ?? 0;
      byProvider[p].cost += r.estimatedCostUsd ?? 0;
      if (r.statusCode >= 400) byProvider[p].errors++;
    }

    // 按模型分组
    const byModel = {};
    for (const r of records) {
      const m = r.model ?? "unknown";
      if (!byModel[m]) byModel[m] = { count: 0, tokens: 0, cost: 0 };
      byModel[m].count++;
      byModel[m].tokens += r.totalTokens ?? 0;
      byModel[m].cost += r.estimatedCostUsd ?? 0;
    }

    return {
      totalRequests,
      avgLatencyMs: Math.round(totalLatency / totalRequests),
      totalTokens,
      totalCostUsd: Math.round(totalCost * 10000) / 10000,
      errorRate: errorCount / totalRequests,
      cacheHitRate: cacheHits / totalRequests,
      fallbackRate: fallbacks / totalRequests,
      byProvider,
      byModel,
    };
  }

  /**
   * 获取日志健康状态
   */
  function getHealth() {
    const today = new Date().toISOString().slice(0, 10);
    const logFile = resolve(logDir, `requests-${today}.jsonl`);
    const fileSize = existsSync(logFile) ? readFileSync(logFile).length : 0;

    return {
      status: "ready",
      logDir,
      bufferSize: buffer.length,
      todayFileSize: fileSize,
      maxLogSizeBytes,
      bodyLoggingEnabled: enableBodyLogging,
    };
  }

  // 定期刷新缓冲区
  const flushTimer = setInterval(flush, BUFFER_FLUSH_INTERVAL_MS);
  flushTimer.unref();

  // 进程退出时刷新
  process.on("beforeExit", flush);
  process.on("SIGINT", flush);
  process.on("SIGTERM", flush);

  return { log, flush, query, getStats, getHealth };
}

function truncate(str, maxLen) {
  if (!str || str.length <= maxLen) return str;
  return str.slice(0, maxLen) + "...[truncated]";
}
