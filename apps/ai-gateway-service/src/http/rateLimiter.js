/**
 * Rate Limiter Middleware
 * Sliding-window rate limiter per IP address.
 *
 * Two storage modes:
 *  - "memory" (default): in-process Map, no dependencies, single-instance.
 *  - "sqlite": cross-process-safe counting via SQLite atomic upsert, so
 *    multiple gateway instances sharing one DB enforce a combined limit.
 */

import { createRateLimiterSqliteBackend } from "./rateLimiter-sqlite.js";

const DEFAULT_WINDOW_MS = 60_000; // 1 minute
const DEFAULT_MAX_REQUESTS = 60;
const DEFAULT_SQLITE_PATH = ".data/rate-limits.sqlite";

export const RATE_LIMIT_RESPONSE_HEADERS = Object.freeze({
  limit: "X-RateLimit-Limit",
  remaining: "X-RateLimit-Remaining",
  window: "X-RateLimit-Window",
  reset: "X-RateLimit-Reset",
  requestLimit: "x-ratelimit-limit-requests",
  requestRemaining: "x-ratelimit-remaining-requests",
  requestReset: "x-ratelimit-reset-requests",
  retryAfter: "Retry-After",
});

/**
 * Create a rate limiter middleware.
 * @param {Object} options
 * @param {number} options.windowMs - Window duration in ms (default 60s)
 * @param {number} options.maxRequests - Max requests per window (default 60)
 * @param {string[]} options.whitelist - IPs exempt from limiting
 * @param {string} [options.storeMode] - "memory" (default) or "sqlite"
 * @param {string} [options.storePath] - SQLite DB path (default ".data/rate-limits.sqlite")
 * @param {string} [options.storeNamespace] - Isolates this limiter within a shared DB (default "default")
 * @returns {Function} middleware(req, res, next) or null if allowed
 */
export function createRateLimiter(options = {}) {
  const windowMs = options.windowMs ?? DEFAULT_WINDOW_MS;
  const maxRequests = options.maxRequests ?? DEFAULT_MAX_REQUESTS;
  const whitelist = new Set(options.whitelist ?? ["127.0.0.1", "::1", "::ffff:127.0.0.1"]);
  const storeMode = String(options.storeMode ?? "memory").trim().toLowerCase();
  const buckets = new Map();

  const backend = storeMode === "sqlite"
    ? createRateLimiterSqliteBackend({
      dbPath: options.storePath ?? DEFAULT_SQLITE_PATH,
      namespace: options.storeNamespace ?? "default",
    })
    : null;

  // Cleanup expired buckets every 5 minutes
  const cleanupInterval = setInterval(() => {
    const now = Date.now();
    if (backend) {
      const oldestIndex = Math.floor(now / windowMs) - 1;
      try {
        backend.cleanup(oldestIndex);
      } catch {
        // cleanup is best-effort; never break limiting on cleanup failure
      }
      return;
    }
    for (const [ip, bucket] of buckets) {
      if (now - bucket.windowStart > windowMs * 2) {
        buckets.delete(ip);
      }
    }
  }, 300_000);

  // Allow cleanup to not prevent process exit
  if (cleanupInterval.unref) cleanupInterval.unref();

  /**
   * Check if a request from this IP should be allowed.
   * @param {string} ip
   * @returns {{ allowed: boolean, remaining: number, retryAfterMs: number, resetAfterMs: number }}
   */
  function check(ip) {
    if (whitelist.has(ip)) {
      return { allowed: true, remaining: maxRequests, retryAfterMs: 0, resetAfterMs: 0 };
    }

    const now = Date.now();

    if (backend) {
      // Fixed-window atomic counting (cross-process safe).
      const windowIndex = Math.floor(now / windowMs);
      const count = backend.increment(ip, windowIndex);
      const resetAfterMs = Math.max(0, (windowIndex + 1) * windowMs - now);
      if (count > maxRequests) {
        return { allowed: false, remaining: 0, retryAfterMs: resetAfterMs, resetAfterMs };
      }
      return { allowed: true, remaining: maxRequests - count, retryAfterMs: 0, resetAfterMs };
    }

    // In-memory sliding window (single-instance).
    let bucket = buckets.get(ip);
    if (!bucket || now - bucket.windowStart > windowMs) {
      bucket = { windowStart: now, count: 0 };
      buckets.set(ip, bucket);
    }

    bucket.count++;
    const resetAfterMs = Math.max(0, windowMs - (now - bucket.windowStart));

    if (bucket.count > maxRequests) {
      return { allowed: false, remaining: 0, retryAfterMs: resetAfterMs, resetAfterMs };
    }

    return { allowed: true, remaining: maxRequests - bucket.count, retryAfterMs: 0, resetAfterMs };
  }

  /**
   * Apply rate limit to an HTTP request.
   * Returns null if allowed, or writes 429 response and returns the response.
   * @param {import("node:http").IncomingMessage} req
   * @param {import("node:http").ServerResponse} res
   * @returns {null|import("node:http").ServerResponse}
   */
  function apply(req, res) {
    const ip = req.socket?.remoteAddress || "unknown";
    const result = check(ip);

    // Always set rate limit headers
    res.setHeader(RATE_LIMIT_RESPONSE_HEADERS.limit, String(maxRequests));
    res.setHeader(RATE_LIMIT_RESPONSE_HEADERS.remaining, String(result.remaining));
    res.setHeader(RATE_LIMIT_RESPONSE_HEADERS.window, String(Math.round(windowMs / 1000)) + "s");
    const resetAfterSeconds = Math.max(0, Math.ceil(result.resetAfterMs / 1000));
    res.setHeader(RATE_LIMIT_RESPONSE_HEADERS.reset, String(Math.ceil((Date.now() + result.resetAfterMs) / 1000)));
    res.setHeader(RATE_LIMIT_RESPONSE_HEADERS.requestLimit, String(maxRequests));
    res.setHeader(RATE_LIMIT_RESPONSE_HEADERS.requestRemaining, String(result.remaining));
    res.setHeader(RATE_LIMIT_RESPONSE_HEADERS.requestReset, `${resetAfterSeconds}s`);

    if (!result.allowed) {
      res.setHeader(RATE_LIMIT_RESPONSE_HEADERS.retryAfter, String(Math.ceil(result.retryAfterMs / 1000)));
      res.writeHead(429, { "content-type": "application/json" });
      res.end(JSON.stringify({
        status: "error",
        error: {
          code: "RATE_LIMITED",
          message: `Rate limit exceeded. Try again in ${Math.ceil(result.retryAfterMs / 1000)}s.`,
          retryAfterMs: result.retryAfterMs,
        },
      }));
      return res;
    }

    return null;
  }

  /**
   * Get current stats.
   */
  function getStats() {
    if (backend) {
      const oldestIndex = Math.floor(Date.now() / windowMs) - 1;
      return {
        activeBuckets: backend.activeCount(oldestIndex),
        windowMs,
        maxRequests,
        whitelistSize: whitelist.size,
        storeMode: "sqlite",
      };
    }
    return {
      activeBuckets: buckets.size,
      windowMs,
      maxRequests,
      whitelistSize: whitelist.size,
      storeMode: "memory",
    };
  }

  /**
   * Release resources (stop the cleanup timer and close the SQLite handle).
   */
  function close() {
    clearInterval(cleanupInterval);
    if (backend) backend.close();
  }

  return { check, apply, getStats, close };
}
