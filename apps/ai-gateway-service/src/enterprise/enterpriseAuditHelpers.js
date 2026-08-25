import { open } from "node:fs/promises";

function readOptionalString(value) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

// Audit queries read a bounded tail of the JSONL file instead of loading the
// whole history into memory; `since` filters older than the tail window
// simply find no entries rather than degrading the event loop.
const AUDIT_TAIL_MAX_BYTES = 5 * 1024 * 1024;

export async function readAuditFile(path, options = {}) {
  const maxBytes = options.maxBytes ?? AUDIT_TAIL_MAX_BYTES;
  let handle;
  try {
    handle = await open(path, "r");
  } catch (error) {
    if (error?.code === "ENOENT") {
      return [];
    }
    throw error;
  }
  try {
    const { size } = await handle.stat();
    const readStart = Math.max(0, size - maxBytes);
    const buffer = Buffer.alloc(size - readStart);
    await handle.read(buffer, 0, buffer.length, readStart);
    let text = buffer.toString("utf8");
    if (readStart > 0) {
      // Drop the partial leading line from the mid-file start offset.
      const firstNewline = text.indexOf("\n");
      text = firstNewline >= 0 ? text.slice(firstNewline + 1) : "";
    }
    return text
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => {
        try {
          return JSON.parse(line);
        } catch {
          // A single malformed line must not blank the whole query result.
          return null;
        }
      })
      .filter(Boolean);
  } finally {
    await handle.close();
  }
}

export function filterAuditEntries(entries, filters = {}) {
  const sanitized = sanitizeAuditFilters(filters);
  return entries.filter((entry) => {
    if (sanitized.outcome && entry.outcome !== sanitized.outcome) return false;
    if (sanitized.code && entry.code !== sanitized.code) return false;
    if (sanitized.path && entry.path !== sanitized.path) return false;
    if (sanitized.userId && entry.userId !== sanitized.userId) return false;
    if (sanitized.tenantId && entry.tenantId !== sanitized.tenantId) return false;
    if (sanitized.since && Date.parse(entry.timestamp) < Date.parse(sanitized.since)) return false;
    if (sanitized.until && Date.parse(entry.timestamp) > Date.parse(sanitized.until)) return false;
    return true;
  });
}

export function sanitizeAuditFilters(filters = {}) {
  return {
    outcome: readOptionalString(filters.outcome),
    code: readOptionalString(filters.code),
    path: readOptionalString(filters.path),
    userId: readOptionalString(filters.userId),
    tenantId: readOptionalString(filters.tenantId),
    since: normalizeOptionalDate(filters.since),
    until: normalizeOptionalDate(filters.until),
  };
}

function normalizeOptionalDate(value) {
  const normalized = readOptionalString(value);
  if (!normalized) {
    return null;
  }
  if (!Number.isFinite(Date.parse(normalized))) {
    return null;
  }
  return normalized;
}
