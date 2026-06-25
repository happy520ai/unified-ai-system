// =============================================================================
// pinoLogger.js — pino 日志包装器
// 替代 structuredLogger，提供高性能结构化日志
// =============================================================================

import pino from "pino";

/**
 * 创建 pino logger
 * @param {Object} options - { app, level, transport }
 * @returns {pino.Logger}
 */
export function createPinoLogger(options = {}) {
  const app = options.app ?? "ai-gateway-service";
  const level = options.level ?? process.env.LOG_LEVEL ?? "info";

  // 生产环境用 JSON 格式，开发环境用 pretty 格式
  const isProduction = process.env.NODE_ENV === "production";

  const logger = pino({
    name: app,
    level,
    // 全部用 JSON 格式（高性能，生产级）
    // 开发时可通过 `| pino-pretty` 管道美化：node app.js | npx pino-pretty
    // 序列化器
    serializers: {
      err: pino.stdSerializers.err,
      req: pino.stdSerializers.req,
      res: pino.stdSerializers.res,
    },
    // 基础字段
    base: {
      app,
      pid: process.pid,
    },
    // 时间戳
    timestamp: pino.stdTimeFunctions.isoTime,
  });

  return logger;
}

/**
 * 创建请求级 logger（带 requestId）
 * @param {pino.Logger} parent
 * @param {Object} context - { requestId, traceId, method, path }
 * @returns {pino.Logger}
 */
export function createRequestLogger(parent, context = {}) {
  return parent.child({
    requestId: context.requestId,
    traceId: context.traceId,
    method: context.method,
    path: context.path,
  });
}

// 默认 logger 实例
let defaultLogger = null;

/**
 * 获取默认 logger
 * @returns {pino.Logger}
 */
export function getLogger() {
  if (!defaultLogger) {
    defaultLogger = createPinoLogger();
  }
  return defaultLogger;
}

/**
 * 替代 console.log 的安全日志方法
 * 在生产路径中使用 logger 代替 console.*
 */
export const safeLog = {
  info: (...args) => getLogger().info(...args),
  warn: (...args) => getLogger().warn(...args),
  error: (...args) => getLogger().error(...args),
  debug: (...args) => getLogger().debug(...args),
  fatal: (...args) => getLogger().fatal(...args),
};
