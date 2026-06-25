/**
 * SessionStore — Save and restoring full agentic session state.
 * Supports export/import, auto-save, and session listing.
 *
 * @module sessionStore
 */

import { readFile, writeFile, readdir, stat, unlink, mkdir, access } from "node:fs/promises";
import { constants as fsConstants } from "node:fs";
import { join } from "node:path";
import { randomUUID } from "node:crypto";

const DEFAULT_STORE_DIR = ".agent-sessions";

/** Validate sessionId format to prevent path traversal */
const SESSION_ID_PATTERN = /^[a-zA-Z0-9_\-]+$/;

export function createSessionStore(options = {}) {
  const storeDir = options.storageDir || options.storeDir || join(process.cwd(), DEFAULT_STORE_DIR);

  /** Per-sessionId mutex to prevent concurrent save race conditions */
  const _saveMutex = new Map();

  /**
   * Save a complete session snapshot.
   * Supports two signatures:
   *   save(sessionId, data)  — data merged with sessionId
   *   save(sessionData)      — sessionData must include sessionId
   */
  async function save(sessionIdOrData, maybeData) {
    await mkdir(storeDir, { recursive: true });

    let sessionId, data;
    if (maybeData !== undefined) {
      // Two-arg form: save(sessionId, data)
      sessionId = sessionIdOrData;
      data = maybeData;
    } else {
      // Single-arg form: save(sessionData)
      data = sessionIdOrData;
      sessionId = data.sessionId;
    }

    // Auto-generate ID when sessionId is null/undefined
    if (!sessionId) {
      sessionId = randomUUID();
    }

    // Security: validate sessionId format to prevent path traversal
    if (!SESSION_ID_PATTERN.test(String(sessionId))) {
      throw new Error(`Invalid sessionId format: must match ${SESSION_ID_PATTERN}`);
    }

    // Mutex: chain saves for the same sessionId to prevent race conditions
    const prev = _saveMutex.get(sessionId) || Promise.resolve();
    const current = prev.then(async () => {
      const snapshot = {
        id: sessionId,
        sessionId,
        goal: data.goal,
        status: data.status || "saved",
        messages: data.messages || [],
        trace: data.trace || [],
        usage: data.usage || {},
        iterations: data.iterations || 0,
        plan: data.plan || null,
        toolUsage: data.toolUsage || {},
        durationMs: data.durationMs || 0,
        savedAt: new Date().toISOString(),
        metadata: data.metadata || {},
      };

      // Size guard: cap snapshot at 10 MB to prevent disk exhaustion
      const MAX_SNAPSHOT_BYTES = 10 * 1024 * 1024;
      let snapshotJson = JSON.stringify(snapshot, null, 2);
      if (snapshotJson.length > MAX_SNAPSHOT_BYTES) {
        // Truncate messages and trace from the front (keep recent entries)
        const KEEP_MESSAGES = Math.max(10, Math.floor((snapshot.messages?.length || 0) * 0.3));
        const KEEP_TRACE = Math.max(20, Math.floor((snapshot.trace?.length || 0) * 0.3));
        if (Array.isArray(snapshot.messages) && snapshot.messages.length > KEEP_MESSAGES) {
          snapshot.messages = snapshot.messages.slice(-KEEP_MESSAGES);
          snapshot._truncatedMessages = true;
        }
        if (Array.isArray(snapshot.trace) && snapshot.trace.length > KEEP_TRACE) {
          snapshot.trace = snapshot.trace.slice(-KEEP_TRACE);
          snapshot._truncatedTrace = true;
        }
        snapshotJson = JSON.stringify(snapshot, null, 2);
        // If still too large after truncation, hard-reject
        if (snapshotJson.length > MAX_SNAPSHOT_BYTES) {
          throw new Error(`Session snapshot too large: ${snapshotJson.length} bytes exceeds ${MAX_SNAPSHOT_BYTES} byte limit even after truncation`);
        }
      }

      const filePath = join(storeDir, `session-${sessionId}.json`);
      const tmpPath = filePath + ".tmp";
      await writeFile(tmpPath, snapshotJson, "utf-8");
      const { rename: renameAsync } = await import("node:fs/promises");
      await renameAsync(tmpPath, filePath);
      return { saved: true, path: filePath, sessionId, id: sessionId };
    }).catch((err) => {
      throw err;
    });
    _saveMutex.set(sessionId, current.catch((err) => { console.warn("[sessionStore] save mutex swallowed error:", err?.message); }));
    return current;
  }

  /**
   * Load a session snapshot by ID. Returns null if not found.
   */
  async function load(sessionId) {
    if (!sessionId) return null;
    // Security: validate sessionId format to prevent path traversal
    if (!SESSION_ID_PATTERN.test(String(sessionId))) return null;
    const filePath = join(storeDir, `session-${sessionId}.json`);
    try {
      const content = await readFile(filePath, "utf-8");
      return JSON.parse(content);
    } catch { return null; }
  }

  /**
   * List all saved sessions with basic metadata.
   * Accepts either list({ limit }) or list(limit).
   */
  async function list(optsOrLimit = 20) {
    const limit = typeof optsOrLimit === "object" ? (optsOrLimit.limit || 20) : optsOrLimit;
    try { await access(storeDir, fsConstants.F_OK); } catch { return { sessions: [] }; }

    try {
      const files = await readdir(storeDir);
      const sessionFiles = files.filter(f => f.startsWith("session-") && f.endsWith(".json"));

      const filesWithStats = await Promise.all(
        sessionFiles.map(async (f) => {
          const fileStat = await stat(join(storeDir, f));
          return { file: f, modifiedAt: fileStat.mtime.toISOString() };
        })
      );

      const sorted = filesWithStats
        .sort((a, b) => b.modifiedAt.localeCompare(a.modifiedAt))
        .slice(0, limit);

      const sessions = await Promise.all(
        sorted.map(async (f) => {
          try {
            const content = await readFile(join(storeDir, f.file), "utf-8");
            const data = JSON.parse(content);
            return {
              sessionId: data.sessionId,
              goal: data.goal,
              status: data.status,
              iterations: data.iterations,
              savedAt: data.savedAt,
            };
          } catch {
            return { sessionId: f.file, goal: "(unreadable)", status: "unknown" };
          }
        })
      );

      return { sessions };
    } catch { return { sessions: [] }; }
  }

  /**
   * Delete a saved session. Returns boolean.
   */
  async function remove(sessionId) {
    if (!sessionId || !SESSION_ID_PATTERN.test(String(sessionId))) return false;
    const filePath = join(storeDir, `session-${sessionId}.json`);
    try { await unlink(filePath); return true; } catch { return false; }
  }

  /**
   * Get the most recently saved session.
   */
  async function getLatest() {
    const result = await list({ limit: 1 });
    const sessions = result.sessions || [];
    if (sessions.length === 0) return null;
    return load(sessions[0].sessionId);
  }

  /**
   * Export session data in a portable format.
   */
  async function exportSession(sessionId) {
    const session = await load(sessionId);
    if (!session) return null;

    return {
      version: "1.0",
      exportedAt: new Date().toISOString(),
      session,
    };
  }

  /**
   * Import a previously exported session.
   */
  async function importSession(exportData) {
    if (!exportData?.session) return { imported: false, reason: "Invalid export data" };
    return save(exportData.session);
  }

  return {
    // Primary API (test-compatible)
    save,
    load,
    remove,
    list,
    getLatest,
    // Legacy aliases
    saveSession: save,
    loadSession: load,
    listSessions: async (limit) => (await list(limit)).sessions,
    deleteSession: async (id) => ({ deleted: await remove(id), sessionId: id }),
    exportSession,
    importSession,
    getStoreDir: () => storeDir,
    getSessionCount: async () => {
      try {
        await access(storeDir, fsConstants.F_OK);
        const files = await readdir(storeDir);
        return files.filter(f => f.startsWith("session-") && f.endsWith(".json")).length;
      } catch { return 0; }
    },
  };
}
