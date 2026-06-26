/**
 * Rate Limiter Middleware
 * Simple sliding-window rate limiter per IP address.
 * No external dependencies required.
 */

const DEFAULT_WINDOW_MS = 60_000; // 1 minute
const DEFAULT_MAX_REQUESTS = 60;

/**
 * Create a rate limiter middleware.
 * @param {Object} options
 * @param {number} options.windowMs - Window duration in ms (default 60s)
 * @param {number} options.maxRequests - Max requests per window (default 60)
 * @param {string[]} options.whitelist - IPs exempt from limiting
 * @returns {Function} middleware(req, res, next) or null if allowed
 */
export function createRateLimiter(options = {}) {
  const windowMs = options.windowMs ?? DEFAULT_WINDOW_MS;
  const maxRequests = options.maxRequests ?? DEFAULT_MAX_REQUESTS;
  const MAX_BUCKETS = 100_000; // Hard cap to prevent memory exhaustion
  const whitelist = new Set(options.whitelist ?? ["127.0.0.1", "::1", "::ffff:127.0.0.1"]);
  const buckets = new Map();

  // Cleanup expired buckets every 5 minutes
  const cleanupInterval = setInterval(() => {
    const now = Date.now();
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
   * @returns {{ allowed: boolean, remaining: number, retryAfterMs: number }}
   */
  function check(ip) {
    if (whitelist.has(ip)) {
      return { allowed: true, remaining: maxRequests, retryAfterMs: 0 };
    }

    const now = Date.now();
    let bucket = buckets.get(ip);

    if (!bucket || now - bucket.windowStart > windowMs) {
      // Reject new entries if at capacity (DDoS protection)
      if (buckets.size >= MAX_BUCKETS && !buckets.has(ip)) {
        return { allowed: false, remaining: 0, retryAfterMs: windowMs };
      }
      bucket = { windowStart: now, count: 0 };
      buckets.set(ip, bucket);
    }

    bucket.count++;

    if (bucket.count > maxRequests) {
      const retryAfterMs = windowMs - (now - bucket.windowStart);
      return { allowed: false, remaining: 0, retryAfterMs: Math.max(0, retryAfterMs) };
    }

    return { allowed: true, remaining: maxRequests - bucket.count, retryAfterMs: 0 };
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
    res.setHeader("X-RateLimit-Limit", String(maxRequests));
    res.setHeader("X-RateLimit-Remaining", String(result.remaining));
    res.setHeader("X-RateLimit-Window", `${String(Math.round(windowMs / 1000))  }s`);

    if (!result.allowed) {
      res.setHeader("Retry-After", String(Math.ceil(result.retryAfterMs / 1000)));
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
    return {
      activeBuckets: buckets.size,
      windowMs,
      maxRequests,
      whitelistSize: whitelist.size,
    };
  }

  return { check, apply, getStats };
}
