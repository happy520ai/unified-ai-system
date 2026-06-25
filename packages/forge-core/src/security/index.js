/**
 * Security Module — Hardening utilities for Forge.
 *
 * Components:
 *   1. HttpRateLimiter  — Per-IP token bucket rate limiter
 *   2. SecurityHeaders   — Standard security response headers
 *   3. AuditLogger       — Structured audit log for security events
 *   4. PathGuard         — Path traversal protection
 *   5. sanitizeError     — Strip sensitive info from error responses
 *   6. sanitizeValue     — Mask sensitive values in output
 */

import { createHash, timingSafeEqual } from 'node:crypto';
import { resolve, sep } from 'node:path';
import { EventEmitter } from 'node:events';

// ── HTTP Rate Limiter (Token Bucket) ─────────────────────────────────────

/**
 * Per-key (typically IP) token bucket rate limiter.
 * Each key gets a bucket that fills at a steady rate and drains per request.
 */
export class HttpRateLimiter {
  #buckets = new Map(); // key → { tokens, lastRefill }
  #maxTokens;
  #refillRate; // tokens per ms
  #cleanupInterval;
  #cleanupTimer = null;

  /**
   * @param {object} [opts]
   * @param {number} [opts.maxTokens=100] — bucket capacity
   * @param {number} [opts.refillPerSecond=10] — refill rate (tokens/sec)
   * @param {number} [opts.cleanupIntervalMs=60000] — stale bucket cleanup interval
   */
  constructor(opts = {}) {
    this.#maxTokens = opts.maxTokens ?? 100;
    this.#refillRate = (opts.refillPerSecond ?? 10) / 1000;
    this.#cleanupInterval = opts.cleanupIntervalMs ?? 60000;
  }

  /**
   * Start periodic cleanup of stale buckets.
   */
  startCleanup() {
    if (this.#cleanupTimer) return;
    this.#cleanupTimer = setInterval(() => this.#cleanup(), this.#cleanupInterval);
    if (this.#cleanupTimer.unref) this.#cleanupTimer.unref();
  }

  /**
   * Stop cleanup timer.
   */
  stopCleanup() {
    if (this.#cleanupTimer) {
      clearInterval(this.#cleanupTimer);
      this.#cleanupTimer = null;
    }
  }

  /**
   * Check if a request from the given key is allowed.
   * @param {string} key — typically IP address
   * @returns {{ allowed: boolean, remaining: number, retryAfterMs: number }}
   */
  check(key) {
    const now = Date.now();
    let bucket = this.#buckets.get(key);

    if (!bucket) {
      bucket = { tokens: this.#maxTokens, lastRefill: now };
      this.#buckets.set(key, bucket);
    }

    // Refill tokens
    const elapsed = now - bucket.lastRefill;
    bucket.tokens = Math.min(this.#maxTokens, bucket.tokens + elapsed * this.#refillRate);
    bucket.lastRefill = now;

    if (bucket.tokens >= 1) {
      bucket.tokens -= 1;
      return { allowed: true, remaining: Math.floor(bucket.tokens), retryAfterMs: 0 };
    }

    const retryAfterMs = Math.ceil((1 - bucket.tokens) / this.#refillRate);
    return { allowed: false, remaining: 0, retryAfterMs };
  }

  /**
   * Reset a specific bucket.
   */
  reset(key) {
    this.#buckets.delete(key);
  }

  /**
   * Clear all buckets.
   */
  clear() {
    this.#buckets.clear();
  }

  /**
   * Get status summary.
   */
  getStatus() {
    return {
      totalBuckets: this.#buckets.size,
      maxTokens: this.#maxTokens,
      refillPerSecond: this.#refillRate * 1000,
    };
  }

  #cleanup() {
    const cutoff = Date.now() - this.#cleanupInterval * 2;
    for (const [key, bucket] of this.#buckets) {
      if (bucket.lastRefill < cutoff) {
        this.#buckets.delete(key);
      }
    }
  }
}

// ── Security Headers ─────────────────────────────────────────────────────

/** Default security headers to apply to all HTTP responses. */
const DEFAULT_SECURITY_HEADERS = {
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'X-XSS-Protection': '0',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Cache-Control': 'no-store',
  'Content-Security-Policy': "default-src 'self'; script-src 'self' 'unsafe-inline' https://cdnjs.cloudflare.com; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self' ws: wss:;",
};

/**
 * Apply security headers to an HTTP response.
 * @param {http.ServerResponse} res
 * @param {object} [overrides] — custom header values (null to remove a header)
 */
export function applySecurityHeaders(res, overrides = {}) {
  const headers = { ...DEFAULT_SECURITY_HEADERS, ...overrides };
  for (const [key, value] of Object.entries(headers)) {
    if (value !== null && value !== undefined) {
      res.setHeader(key, value);
    }
  }
}

// ── Audit Logger ─────────────────────────────────────────────────────────

/**
 * Structured audit logger for security-relevant events.
 * Events are stored in a ring buffer and emitted via EventEmitter.
 */
export class AuditLogger extends EventEmitter {
  #events = [];
  #maxEvents;

  /**
   * @param {object} [opts]
   * @param {number} [opts.maxEvents=5000] — ring buffer size
   */
  constructor(opts = {}) {
    super();
    this.#maxEvents = opts.maxEvents ?? 5000;
  }

  /**
   * Log an audit event.
   * @param {object} entry
   * @param {string} entry.action — e.g. 'auth.success', 'auth.failure', 'goal.submit', 'file.write'
   * @param {string} [entry.userId] — user who performed the action
   * @param {string} [entry.ip] — client IP
   * @param {string} [entry.resource] — affected resource
   * @param {string} [entry.outcome] — 'success' | 'failure' | 'denied'
   * @param {object} [entry.details] — additional structured data
   */
  log(entry) {
    const record = {
      timestamp: new Date().toISOString(),
      action: entry.action || 'unknown',
      userId: entry.userId || null,
      ip: entry.ip || null,
      resource: entry.resource || null,
      outcome: entry.outcome || 'success',
      details: entry.details || {},
    };
    this.#events.push(record);
    if (this.#events.length > this.#maxEvents) {
      this.#events = this.#events.slice(-this.#maxEvents);
    }
    this.emit('audit', record);
    return record;
  }

  /**
   * Query events matching a filter.
   * @param {object} filter — key/value pairs to match
   * @param {number} [limit=50]
   * @returns {object[]}
   */
  query(filter = {}, limit = 50) {
    const entries = filter.action
      ? this.#events.filter(e => e.action === filter.action)
      : [...this.#events];

    if (filter.userId) {
      return entries.filter(e => e.userId === filter.userId).slice(-limit);
    }
    if (filter.outcome) {
      return entries.filter(e => e.outcome === filter.outcome).slice(-limit);
    }
    return entries.slice(-limit);
  }

  /**
   * Get all events (for testing/export).
   */
  getEvents() {
    return [...this.#events];
  }

  /**
   * Get summary statistics.
   */
  getStatus() {
    const actions = {};
    const outcomes = { success: 0, failure: 0, denied: 0 };
    for (const e of this.#events) {
      actions[e.action] = (actions[e.action] || 0) + 1;
      if (outcomes[e.outcome] !== undefined) outcomes[e.outcome]++;
    }
    return {
      totalEvents: this.#events.length,
      maxEvents: this.#maxEvents,
      actions,
      outcomes,
    };
  }

  /**
   * Clear all events.
   */
  clear() {
    this.#events = [];
  }
}

// ── Path Guard ───────────────────────────────────────────────────────────

/**
 * Validate that a file path stays within an allowed base directory.
 *
 * @param {string} basePath — the allowed root directory
 * @param {string} requestedPath — the user-supplied path
 * @returns {{ safe: boolean, resolved: string }} — safe flag + resolved absolute path
 */
export function guardPath(basePath, requestedPath) {
  const resolvedBase = resolve(basePath);
  const resolved = resolve(resolvedBase, requestedPath || '');

  // Ensure the resolved path starts with the base path + separator
  // (or equals the base path exactly)
  const isSafe = resolved === resolvedBase ||
    resolved.startsWith(resolvedBase + sep);

  return { safe: isSafe, resolved };
}

// ── Error Sanitizer ──────────────────────────────────────────────────────

/**
 * Sanitize an error for safe client-facing responses.
 * Strips file paths, stack traces, and internal details.
 *
 * @param {Error} err
 * @param {boolean} [isProduction=true] — in dev mode, include more detail
 * @returns {{ error: string, code?: string }}
 */
export function sanitizeError(err, isProduction = true) {
  if (!err) return { error: 'Unknown error' };

  const msg = err.message || 'Internal server error';

  if (!isProduction) {
    return { error: msg };
  }

  // Map known error patterns to safe messages
  if (err.status === 401 || msg.includes('Authentication')) {
    return { error: 'Authentication required' };
  }
  if (err.status === 403 || msg.includes('Forbidden') || msg.includes('not allowed')) {
    return { error: 'Access denied' };
  }
  if (err.status === 404 || msg.includes('Not Found')) {
    return { error: 'Not found' };
  }
  if (err.status === 413) {
    return { error: 'Request too large' };
  }
  if (err.status === 429 || msg.includes('rate limit')) {
    return { error: 'Too many requests' };
  }

  // For unexpected errors, return a generic message
  return { error: 'Internal server error' };
}

// ── Value Sanitizer ──────────────────────────────────────────────────────

/** Sensitive key patterns to mask in output. */
const SENSITIVE_PATTERNS = [
  /api[_-]?key/i, /secret/i, /password/i, /token/i,
  /credential/i, /auth/i, /private[_-]?key/i,
];

/**
 * Mask a potentially sensitive value for display.
 * @param {string} key — the config key name
 * @param {*} value — the value
 * @returns {string} masked or original value
 */
export function sanitizeValue(key, value) {
  if (value === null || value === undefined) return '--';
  const strValue = String(value);

  const isSensitive = SENSITIVE_PATTERNS.some(p => p.test(key));
  if (isSensitive && strValue.length > 4) {
    return strValue.slice(0, 4) + '****';
  }
  return strValue;
}

// ── API Key Hashing ──────────────────────────────────────────────────────

/**
 * Hash an API key for storage using SHA-256.
 * @param {string} apiKey
 * @returns {string} hex-encoded hash
 */
export function hashApiKey(apiKey) {
  return createHash('sha256').update(apiKey).digest('hex');
}

/**
 * Verify an API key against a stored hash using constant-time comparison.
 * @param {string} apiKey — the key to check
 * @param {string} storedHash — the stored SHA-256 hash
 * @returns {boolean}
 */
export function verifyApiKey(apiKey, storedHash) {
  const inputHash = createHash('sha256').update(apiKey).digest();
  const stored = Buffer.from(storedHash, 'hex');
  if (inputHash.length !== stored.length) return false;
  return timingSafeEqual(inputHash, stored);
}
