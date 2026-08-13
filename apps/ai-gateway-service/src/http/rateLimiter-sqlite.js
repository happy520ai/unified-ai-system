/**
 * SQLite storage backend for the rate limiter.
 *
 * Provides cross-process-safe request counting via atomic upsert
 * (`ON CONFLICT ... DO UPDATE SET count = count + 1`), so multiple
 * gateway instances sharing the same SQLite file enforce a single
 * combined limit instead of independent per-process limits.
 *
 * Uses fixed-window counting keyed by `(namespace, ip, window_index)`
 * where `window_index = floor(now / windowMs)`. A namespace isolates
 * different limiter instances (global vs per-route) sharing one file.
 *
 * @module rateLimiter-sqlite
 */

import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { DatabaseSync } from "node:sqlite";

/**
 * Create a SQLite-backed rate-limit counter.
 *
 * @param {object} options
 * @param {string} options.dbPath - Path to the SQLite database file.
 * @param {string} [options.namespace] - Namespace isolating this limiter (default "default").
 * @returns {{ increment: Function, countActive: Function, close: Function }}
 */
export function createRateLimiterSqliteBackend({ dbPath, namespace = "default" }) {
  mkdirSync(dirname(dbPath), { recursive: true });

  const db = new DatabaseSync(dbPath);
  db.exec("PRAGMA busy_timeout = 5000");
  // WAL is a write operation requiring an exclusive lock; it can fail under
  // multi-process open contention. It only optimizes concurrent reads, so a
  // failure is non-fatal — fall back to the default journal mode.
  try {
    db.exec("PRAGMA journal_mode = WAL");
  } catch {
    // keep default journal mode
  }

  db.exec(`
    CREATE TABLE IF NOT EXISTS rate_limits (
      namespace TEXT NOT NULL,
      ip TEXT NOT NULL,
      window_index INTEGER NOT NULL,
      count INTEGER NOT NULL DEFAULT 0,
      PRIMARY KEY (namespace, ip, window_index)
    );
    CREATE INDEX IF NOT EXISTS idx_rate_limits_window ON rate_limits (window_index);
  `);

  const upsert = db.prepare(`
    INSERT INTO rate_limits (namespace, ip, window_index, count)
    VALUES (?, ?, ?, 1)
    ON CONFLICT(namespace, ip, window_index) DO UPDATE SET count = count + 1
  `);
  const select = db.prepare(
    "SELECT count FROM rate_limits WHERE namespace = ? AND ip = ? AND window_index = ?",
  );
  const countActive = db.prepare(
    "SELECT COUNT(*) AS n FROM rate_limits WHERE namespace = ? AND window_index >= ?",
  );
  const deleteExpired = db.prepare("DELETE FROM rate_limits WHERE window_index < ?");

  /**
   * Atomically increment the count for a window and return the new count.
   * @param {string} ip
   * @param {number} windowIndex
   * @returns {number} the post-increment count
   */
  function increment(ip, windowIndex) {
    upsert.run(namespace, ip, windowIndex);
    const row = select.get(namespace, ip, windowIndex);
    return row ? row.count : 0;
  }

  /**
   * Count active windows (for stats).
   * @param {number} oldestIndex
   * @returns {number}
   */
  function activeCount(oldestIndex) {
    const row = countActive.get(namespace, oldestIndex);
    return row ? row.n : 0;
  }

  /**
   * Remove expired windows older than the given index.
   * @param {number} oldestIndex
   */
  function cleanup(oldestIndex) {
    deleteExpired.run(oldestIndex);
  }

  return {
    increment,
    activeCount,
    cleanup,
    close: () => db.close(),
  };
}
