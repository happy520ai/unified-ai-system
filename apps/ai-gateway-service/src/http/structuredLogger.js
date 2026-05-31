/**
 * Structured Logger
 * Lightweight structured JSON logger for production use.
 * No external dependencies - uses console.error for stderr output.
 */

const LOG_LEVELS = { debug: 0, info: 1, warn: 2, error: 3 };
const DEFAULT_LEVEL = "info";

/**
 * Create a structured logger instance.
 * @param {Object} options
 * @param {string} options.level - Minimum log level (debug|info|warn|error)
 * @param {string} options.app - Application name
 * @returns {Object} Logger with debug/info/warn/error methods
 */
export function createLogger(options = {}) {
  const minLevel = LOG_LEVELS[options.level ?? DEFAULT_LEVEL] ?? 1;
  const app = options.app ?? "ai-gateway-service";

  function log(level, event, data = {}) {
    const levelNum = LOG_LEVELS[level];
    if (levelNum === undefined || levelNum < minLevel) return;

    const entry = {
      timestamp: new Date().toISOString(),
      level,
      app,
      event,
      ...data,
    };

    // Remove undefined values
    for (const key of Object.keys(entry)) {
      if (entry[key] === undefined) delete entry[key];
    }

    console.error(JSON.stringify(entry));
  }

  return {
    debug(event, data) { log("debug", event, data); },
    info(event, data) { log("info", event, data); },
    warn(event, data) { log("warn", event, data); },
    error(event, data) { log("error", event, data); },

    /**
     * Create a child logger with additional context fields.
     */
    child(context = {}) {
      return {
        debug(event, data) { log("debug", event, { ...context, ...data }); },
        info(event, data) { log("info", event, { ...context, ...data }); },
        warn(event, data) { log("warn", event, { ...context, ...data }); },
        error(event, data) { log("error", event, { ...context, ...data }); },
      };
    },
  };
}

/**
 * Create a request-scoped logger with timing.
 */
export function createRequestLogger(logger, request) {
  const startedAt = Date.now();
  const requestId = request?.headers?.["x-request-id"] || `req_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;

  return {
    ...logger.child({ requestId }),
    requestId,
    startedAt,
    finish(event, data = {}) {
      logger.info(event, {
        ...data,
        requestId,
        durationMs: Date.now() - startedAt,
      });
    },
  };
}
