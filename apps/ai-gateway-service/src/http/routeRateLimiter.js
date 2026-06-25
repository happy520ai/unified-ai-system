/**
 * Phase E — Route-specific Rate Limiter
 *
 * Applies different rate limits per URL path pattern.
 * Falls back to the global rate limiter for unmatched routes.
 */

import { createRateLimiter } from "./rateLimiter.js";

const DEFAULT_ROUTE_LIMITS = Object.freeze({
  // Chat endpoints — moderate limits (provider calls are expensive)
  "/chat": { windowMs: 60_000, maxRequests: 20 },
  "/chat/stream": { windowMs: 60_000, maxRequests: 20 },
  "/chat/rag": { windowMs: 60_000, maxRequests: 20 },
  "/chat/rag/stream": { windowMs: 60_000, maxRequests: 20 },

  // Chat gateway execution — tight limits (real provider calls)
  "/chat-gateway/execute": { windowMs: 60_000, maxRequests: 10 },

  // Workforce execution — very tight (heavy compute)
  "/workforce/execute": { windowMs: 60_000, maxRequests: 5 },
  "/workforce/run-local": { windowMs: 60_000, maxRequests: 10 },

  // Model import — moderate (may call external APIs)
  "/models/import": { windowMs: 60_000, maxRequests: 15 },

  // Knowledge load — moderate
  "/knowledge/load": { windowMs: 60_000, maxRequests: 30 },

  // Health/readiness — generous (monitoring)
  "/health/check": { windowMs: 60_000, maxRequests: 600 },
  "/setup/readiness": { windowMs: 60_000, maxRequests: 300 },
});

/**
 * Create a route-aware rate limiter.
 *
 * @param {object} options
 * @param {object} [options.routeLimits] — Override default per-route limits
 * @param {number} [options.globalWindowMs] — Global fallback window (default 60s)
 * @param {number} [options.globalMaxRequests] — Global fallback max requests (default 120)
 * @param {string[]} [options.whitelist] — IPs exempt from limiting
 */
export function createRouteRateLimiter(options = {}) {
  const routeLimits = { ...DEFAULT_ROUTE_LIMITS, ...(options.routeLimits ?? {}) };
  const whitelist = options.whitelist ?? ["127.0.0.1", "::1", "::ffff:127.0.0.1"];

  // Global fallback limiter
  const globalLimiter = createRateLimiter({
    windowMs: options.globalWindowMs ?? 60_000,
    maxRequests: options.globalMaxRequests ?? 120,
    whitelist,
  });

  // Per-route limiters (lazily created)
  const routeLimiters = new Map();

  function getRouteLimiter(pathname) {
    // Find matching route pattern (exact prefix match)
    for (const [pattern, limits] of Object.entries(routeLimits)) {
      if (pathname === pattern || pathname.startsWith(pattern + "/")) {
        const key = pattern;
        if (!routeLimiters.has(key)) {
          routeLimiters.set(key, createRateLimiter({
            windowMs: limits.windowMs,
            maxRequests: limits.maxRequests,
            whitelist,
          }));
        }
        return { limiter: routeLimiters.get(key), pattern: key, limits };
      }
    }
    return null;
  }

  /**
   * Apply route-aware rate limiting.
   * Checks route-specific limit first, then global limit.
   *
   * @param {import("node:http").IncomingMessage} req
   * @param {import("node:http").ServerResponse} res
   * @returns {null|import("node:http").ServerResponse} — null if allowed
   */
  function apply(req, res) {
    const url = new URL(req.url ?? "/", `http://${req.headers.host ?? "localhost"}`);
    const routeMatch = getRouteLimiter(url.pathname);

    if (routeMatch) {
      const routeResult = routeMatch.limiter.apply(req, res);
      if (routeResult) {
        // Route-specific limit hit — add route info header
        res.setHeader("X-RateLimit-Route", routeMatch.pattern);
        return routeResult;
      }
    }

    // Global fallback
    return globalLimiter.apply(req, res);
  }

  function getStats() {
    const stats = { global: globalLimiter.getStats(), routes: {} };
    for (const [pattern, limiter] of routeLimiters) {
      stats.routes[pattern] = limiter.getStats();
    }
    return stats;
  }

  return { apply, getStats };
}
