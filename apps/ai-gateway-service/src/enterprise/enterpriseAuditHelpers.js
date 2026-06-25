import { readFile } from "node:fs/promises";

function readOptionalString(value) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

export async function readAuditFile(path) {
  try {
    const text = await readFile(path, "utf8");
    return text
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => JSON.parse(line));
  } catch (error) {
    if (error?.code === "ENOENT") {
      return [];
    }
    throw error;
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
