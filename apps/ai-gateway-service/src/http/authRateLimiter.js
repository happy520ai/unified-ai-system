/**
 * Authentication Rate Limiter — Brute-force protection for auth endpoints.
 *
 * Tracks failed authentication attempts per key (IP or userId).
 * After maxAttempts failures within windowMs, locks the key for lockoutMs.
 * Successful authentication clears the failure record.
 *
 * Zero external dependencies.
 */

export function createAuthRateLimiter(options = {}) {
  const maxAttempts = options.maxAttempts ?? 5;
  const windowMs = options.windowMs ?? 300_000;   // 5 minutes
  const lockoutMs = options.lockoutMs ?? 900_000; // 15 minutes
  const attempts = new Map(); // key -> { count, firstAttemptAt, lockedUntil }

  // Cleanup stale entries every 5 minutes
  const cleanupInterval = setInterval(() => {
    const now = Date.now();
    for (const [key, record] of attempts) {
      if (record.lockedUntil && now > record.lockedUntil) {
        attempts.delete(key);
      } else if (!record.lockedUntil && now - record.firstAttemptAt > windowMs * 2) {
        attempts.delete(key);
      }
    }
  }, 300_000);
  if (cleanupInterval.unref) cleanupInterval.unref();

  function recordFailure(key) {
    const now = Date.now();
    let record = attempts.get(key);

    if (!record || (record.firstAttemptAt && now - record.firstAttemptAt > windowMs)) {
      // Window expired — reset
      record = { count: 0, firstAttemptAt: now, lockedUntil: null };
    }

    record.count++;
    attempts.set(key, record);

    if (record.count >= maxAttempts) {
      record.lockedUntil = now + lockoutMs;
    }

    return {
      count: record.count,
      locked: record.count >= maxAttempts,
      lockedUntil: record.lockedUntil,
      remaining: Math.max(0, maxAttempts - record.count),
    };
  }

  function recordSuccess(key) {
    attempts.delete(key);
  }

  function check(key) {
    const now = Date.now();
    const record = attempts.get(key);

    if (!record) {
      return { allowed: true, remaining: maxAttempts, lockedUntil: null, retryAfterMs: 0 };
    }

    // Check lockout
    if (record.lockedUntil && now < record.lockedUntil) {
      const retryAfterMs = record.lockedUntil - now;
      return { allowed: false, remaining: 0, lockedUntil: record.lockedUntil, retryAfterMs };
    }

    // Lockout expired — clean up
    if (record.lockedUntil && now >= record.lockedUntil) {
      attempts.delete(key);
      return { allowed: true, remaining: maxAttempts, lockedUntil: null, retryAfterMs: 0 };
    }

    // Window expired — clean up
    if (now - record.firstAttemptAt > windowMs) {
      attempts.delete(key);
      return { allowed: true, remaining: maxAttempts, lockedUntil: null, retryAfterMs: 0 };
    }

    // Within window, under limit
    return {
      allowed: true,
      remaining: Math.max(0, maxAttempts - record.count),
      lockedUntil: null,
      retryAfterMs: 0,
    };
  }

  function getStats() {
    let lockedCount = 0;
    const now = Date.now();
    for (const record of attempts.values()) {
      if (record.lockedUntil && now < record.lockedUntil) lockedCount++;
    }
    return {
      trackedKeys: attempts.size,
      lockedKeys: lockedCount,
      maxAttempts,
      windowMs,
      lockoutMs,
    };
  }

  return { recordFailure, recordSuccess, check, getStats };
}
