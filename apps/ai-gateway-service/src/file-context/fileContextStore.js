const BLOCKED_FILE_PATTERN = /(^|[\\/])\.env(\.|$)|secret|token|credential/i;

export function createFileContextStore() {
  const selections = [];

  return {
    list() {
      return selections.slice();
    },
    select(input = {}) {
      const files = Array.isArray(input.files) ? input.files : [];
      const accepted = [];
      const blocked = [];

      for (const file of files) {
        const normalized = normalizeFile(file);
        if (!normalized.name) {
          continue;
        }
        if (BLOCKED_FILE_PATTERN.test(normalized.name) || BLOCKED_FILE_PATTERN.test(normalized.path)) {
          blocked.push({ name: normalized.name, reason: "blocked-sensitive-file" });
          continue;
        }
        accepted.push(normalized);
      }

      const record = {
        selectedAt: new Date().toISOString(),
        accepted,
        blocked,
      };
      selections.push(record);
      return {
        ok: blocked.length === 0,
        selectedAt: record.selectedAt,
        accepted,
        blocked,
        filesSelected: accepted.length,
        filesBlocked: blocked.length,
      };
    },
  };
}

function normalizeFile(file = {}) {
  return {
    name: String(file.name || "").trim(),
    path: String(file.path || file.name || "").replace(/\\/g, "/").trim(),
    size: Number(file.size || 0),
    type: String(file.type || "").trim(),
    contentLength: Number(file.contentLength || 0),
  };
}
