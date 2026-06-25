/**
 * Phase E — Persistent Audit Logger
 *
 * Writes audit events to JSONL files with daily rotation.
 * Complements the in-memory AuditLogger from forge-core.
 *
 * Env vars:
 *   AUDIT_LOG_DIR — Directory for audit logs (default: .data/audit)
 *   AUDIT_LOG_MAX_SIZE — Max bytes per file before rotation (default: 50MB)
 *   AUDIT_LOG_RETENTION_DAYS — Days to keep old logs (default: 90)
 */

import { appendFile, mkdir, readdir, unlink, stat } from "node:fs/promises";
import { join } from "node:path";

const DEFAULT_LOG_DIR = ".data/audit";
const DEFAULT_MAX_SIZE = 50 * 1024 * 1024; // 50MB
const DEFAULT_RETENTION_DAYS = 90;

/**
 * Create a persistent audit logger.
 *
 * @param {object} options
 * @param {string} [options.logDir] — Directory for audit log files
 * @param {number} [options.maxFileSize] — Max bytes per log file
 * @param {number} [options.retentionDays] — Days to retain old logs
 */
export function createPersistentAuditLogger(options = {}) {
  const logDir = options.logDir ?? DEFAULT_LOG_DIR;
  const maxFileSize = options.maxFileSize ?? DEFAULT_MAX_SIZE;
  const retentionDays = options.retentionDays ?? DEFAULT_RETENTION_DAYS;

  let initialized = false;
  let currentFile = null;
  let currentSize = 0;
  let eventCount = 0;

  async function ensureInit() {
    if (initialized) return;
    await mkdir(logDir, { recursive: true });
    currentFile = getLogFileName();
    try {
      const s = await stat(currentFile);
      currentSize = s.size;
    } catch {
      currentSize = 0;
    }
    initialized = true;
  }

  function getLogFileName(date = new Date()) {
    const day = date.toISOString().slice(0, 10);
    return join(logDir, `audit-${day}.jsonl`);
  }

  /**
   * Record an audit event.
   *
   * @param {object} event
   * @param {string} event.action — Action identifier (e.g., "auth.login", "provider.call")
   * @param {string} [event.actor] — Who performed the action
   * @param {string} [event.resource] — What was acted upon
   * @param {string} [event.outcome] — "success" | "failure" | "blocked"
   * @param {object} [event.details] — Additional context (will be JSON serialized)
   */
  async function record(event) {
    await ensureInit();

    const entry = {
      timestamp: new Date().toISOString(),
      action: event.action ?? "unknown",
      actor: event.actor ?? "system",
      resource: event.resource ?? null,
      outcome: event.outcome ?? "success",
      details: event.details ?? null,
    };

    const line = JSON.stringify(entry) + "\n";

    // Rotate if needed
    const targetFile = getLogFileName();
    if (targetFile !== currentFile) {
      currentFile = targetFile;
      currentSize = 0;
    }

    if (currentSize + line.length > maxFileSize) {
      // Rotate to a new file with sequence number
      const seq = String(eventCount).padStart(6, "0");
      currentFile = join(logDir, `audit-${new Date().toISOString().slice(0, 10)}-${seq}.jsonl`);
      currentSize = 0;
    }

    await appendFile(currentFile, line, "utf8");
    currentSize += line.length;
    eventCount++;

    return { recorded: true, file: currentFile, eventCount };
  }

  /**
   * Record a batch of audit events.
   */
  async function recordBatch(events) {
    const results = [];
    for (const event of events) {
      results.push(await record(event));
    }
    return results;
  }

  /**
   * Cleanup old audit files beyond retention period.
   */
  async function cleanup() {
    await ensureInit();
    const cutoff = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000);
    const cutoffStr = cutoff.toISOString().slice(0, 10);

    const files = await readdir(logDir);
    let removed = 0;
    for (const file of files) {
      if (!file.startsWith("audit-") || !file.endsWith(".jsonl")) continue;
      const dateStr = file.replace("audit-", "").slice(0, 10);
      if (dateStr < cutoffStr) {
        try {
          await unlink(join(logDir, file));
          removed++;
        } catch {
          // Non-fatal: file may be in use
        }
      }
    }
    return { removed, retentionDays, cutoffDate: cutoffStr };
  }

  /**
   * Get logger stats.
   */
  function getStats() {
    return {
      logDir,
      maxFileSize,
      retentionDays,
      currentFile,
      currentSize,
      eventCount,
      initialized,
    };
  }

  return { record, recordBatch, cleanup, getStats };
}
