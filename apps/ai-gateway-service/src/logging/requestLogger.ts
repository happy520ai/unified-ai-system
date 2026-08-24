/**
 * requestLogger 的类型声明（JSONL 台账：每次真实 chat 调用落一条 token/成本/延迟记录）。
 * 接口对照 logging/requestLogger.js 实际导出。
 */

export interface RequestLogEntry {
  usageAttemptId?: string;
  usageEventType?: "attempt-started" | "attempt-completed" | "attempt-failed";
  tenantId?: string;
  method?: string;
  path?: string;
  statusCode?: number;
  latencyMs?: number;
  provider?: string;
  model?: string;
  inputTokens?: number;
  outputTokens?: number;
  totalTokens?: number;
  estimatedCostUsd?: number;
  costSource?: string;
  costEstimateAvailable?: boolean;
  cacheHit?: boolean;
  fallbackUsed?: boolean;
  fallbackFrom?: string;
  shadow?: boolean;
  providerCallAttempted?: boolean;
  billable?: boolean;
  error?: string;
  userAgent?: string;
  clientIp?: string;
  traceId?: string;
  userId?: string;
  requestBody?: unknown;
  responseBody?: unknown;
}

export interface RequestLogRecord {
  id: string;
  timestamp: number;
  usageAttemptId?: string;
  usageEventType?: "attempt-started" | "attempt-completed" | "attempt-failed";
  tenantId: string;
  method?: string;
  path?: string;
  statusCode?: number;
  latencyMs?: number;
  provider?: string;
  model?: string;
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  estimatedCostUsd: number;
  costSource?: string;
  costEstimateAvailable: boolean;
  cacheHit: boolean;
  fallbackUsed: boolean;
  fallbackFrom?: string;
  shadow: boolean;
  providerCallAttempted: boolean;
  billable: boolean;
  error?: string;
  userAgent?: string;
  clientIp?: string;
  traceId?: string;
  userId?: string;
  requestPreview?: string;
  responsePreview?: string;
}

export interface RequestLogQuery {
  tenantId?: string;
  since?: number;
  until?: number;
  provider?: string;
  model?: string;
  statusCode?: number;
  minLatency?: number;
  maxLatency?: number;
  cacheHit?: boolean;
  limit?: number;
  offset?: number;
}

export interface RequestLogStats {
  totalRequests: number;
  avgLatencyMs: number;
  totalTokens: number;
  totalCostUsd: number;
  unknownCostRecords: number;
  unresolvedBillableAttempts: number;
  errorRate: number;
  cacheHitRate: number;
  fallbackRate: number;
  byProvider: Record<string, { count: number; tokens: number; cost: number; errors: number }>;
  byModel: Record<string, { count: number; tokens: number; cost: number }>;
}

export interface RequestLogger {
  log(entry: RequestLogEntry): void;
  flush(options?: { throwOnFailure?: boolean }): boolean;
  assertDurable(): boolean;
  query(filter?: RequestLogQuery): RequestLogRecord[];
  getStats(filter?: RequestLogQuery): RequestLogStats;
  getHealth(): Record<string, unknown>;
  close(): void;
}

export interface RequestLoggerOptions {
  logDir?: string;
  maxLogSizeBytes?: number;
  enableBodyLogging?: boolean;
  enableIdentityLogging?: boolean;
  maxBodyLogSize?: number;
  maxRetentionDays?: number;
  durableWrites?: boolean;
}

export declare function createRequestLogger(options?: RequestLoggerOptions): RequestLogger;
