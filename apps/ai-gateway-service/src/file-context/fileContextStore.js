import { requireEnterpriseTenantId } from "../enterprise/enterpriseTenantPolicy.ts";

const BLOCKED_FILE_PATTERN = /(^|[\\/])\.env(\.|$)|secret|token|credential/i;
const DEFAULT_MAX_SELECTIONS_PER_TENANT = 32;
const DEFAULT_MAX_FILES_PER_SELECTION = 128;
const MAX_FILE_NAME_CHARS = 256;
const MAX_FILE_PATH_CHARS = 1_024;

export function createFileContextStore(options = {}) {
  const maxSelectionsPerTenant = normalizeLimit(
    options.maxSelectionsPerTenant,
    DEFAULT_MAX_SELECTIONS_PER_TENANT,
  );
  const maxFilesPerSelection = normalizeLimit(
    options.maxFilesPerSelection,
    DEFAULT_MAX_FILES_PER_SELECTION,
  );
  const selectionsByTenant = new Map();

  return {
    list(identity) {
      const tenantId = requireEnterpriseTenantId(identity);
      return (selectionsByTenant.get(tenantId) ?? []).map(cloneRecord);
    },
    select(input = {}, identity) {
      const tenantId = requireEnterpriseTenantId(identity);
      const inputFiles = Array.isArray(input.files) ? input.files : [];
      const files = inputFiles.slice(0, maxFilesPerSelection);
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

      if (inputFiles.length > maxFilesPerSelection) {
        blocked.push({
          name: "",
          reason: "too-many-files",
          count: inputFiles.length - maxFilesPerSelection,
        });
      }

      const record = {
        selectedAt: new Date().toISOString(),
        accepted,
        blocked,
      };
      const tenantSelections = selectionsByTenant.get(tenantId) ?? [];
      tenantSelections.push(record);
      if (tenantSelections.length > maxSelectionsPerTenant) {
        tenantSelections.splice(0, tenantSelections.length - maxSelectionsPerTenant);
      }
      selectionsByTenant.set(tenantId, tenantSelections);
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
    name: String(file.name || "").trim().slice(0, MAX_FILE_NAME_CHARS),
    path: String(file.path || file.name || "").replace(/\\/g, "/").trim().slice(0, MAX_FILE_PATH_CHARS),
    size: normalizeNonNegativeNumber(file.size),
    type: String(file.type || "").trim().slice(0, 128),
    contentLength: normalizeNonNegativeNumber(file.contentLength),
  };
}

function normalizeLimit(value, fallback) {
  const numeric = Number(value);
  return Number.isInteger(numeric) && numeric > 0 ? Math.min(numeric, 1_000) : fallback;
}

function normalizeNonNegativeNumber(value) {
  const numeric = Number(value);
  return Number.isFinite(numeric) && numeric > 0 ? numeric : 0;
}

function cloneRecord(record) {
  return {
    selectedAt: record.selectedAt,
    accepted: record.accepted.map((file) => ({ ...file })),
    blocked: record.blocked.map((file) => ({ ...file })),
  };
}
