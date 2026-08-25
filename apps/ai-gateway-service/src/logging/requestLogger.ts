/**
 * requestLogger 的类型声明（JSONL 台账：每次真实 chat 调用落一条 token/成本/延迟记录）。
 * 接口对照 logging/requestLogger.js 实际导出。
 */

export interface RequestLogEntry {
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
  cacheHit?: boolean;
  fallbackUsed?: boolean;
  fallbackFrom?: string;
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
  cacheHit: boolean;
  fallbackUsed: boolean;
  fallbackFrom?: string;
  error?: string;
  userAgent?: string;
  clientIp?: string;
  traceId?: string;
  userId?: string;
  requestPreview?: string;
  responsePreview?: string;
}

export interface RequestLogQuery {
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
  errorRate: number;
  cacheHitRate: number;
  fallbackRate: number;
  byProvider: Record<string, { count: number; tokens: number; cost: number; errors: number }>;
  byModel: Record<string, { count: number; tokens: number; cost: number }>;
}

export interface RequestLogger {
  log(entry: RequestLogEntry): void;
  flush(): void;
  query(filter?: RequestLogQuery): RequestLogRecord[];
  getStats(filter?: RequestLogQuery): RequestLogStats;
  getHealth(): Record<string, unknown>;
}

export interface RequestLoggerOptions {
  logDir?: string;
  maxLogSizeBytes?: number;
  enableBodyLogging?: boolean;
  maxBodyLogSize?: number;
}

export declare function createRequestLogger(options?: RequestLoggerOptions): RequestLogger;
