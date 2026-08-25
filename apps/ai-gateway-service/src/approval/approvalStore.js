import { randomUUID } from "node:crypto";

const DEFAULT_FORBIDDEN_PATHS = ["legacy/", "PROJECT_CONTEXT.md", ".env", ".git", "node_modules"];

export function createApprovalStore() {
  const records = new Map();

  return {
    list(tenantId) {
      // Fail-closed: without a tenant scope no record is visible.
      if (!isPresentTenantId(tenantId)) return [];
      return Array.from(records.values())
        .filter((record) => isTenantMatch(record, tenantId))
        .sort((left, right) => String(right.createdAt).localeCompare(String(left.createdAt)));
    },
    get(id, tenantId) {
      const record = records.get(String(id || "").trim()) ?? null;
      // Cross-tenant or unscoped reads are indistinguishable from missing records.
      if (!record || !isTenantMatch(record, tenantId)) return null;
      return record;
    },
    create(input = {}, tenantId) {
      const scopedTenantId = requireTenantId(tenantId);
      const id = buildApprovalId();
      const record = normalizeApprovalRecord({
        ...input,
        id,
        tenantId: scopedTenantId,
        createdAt: new Date().toISOString(),
        status: "pending",
      });
      records.set(id, record);
      return record;
    },
    approve(id, input = {}, tenantId) {
      const current = mustGet(records, id, tenantId);
      // A decision must not rewrite the approved content: allowedFiles,
      // patchProposal, and every other record field stay exactly as they
      // were created; only the decision outcome and note change.
      const next = normalizeApprovalRecord({
        ...current,
        id: current.id,
        tenantId: current.tenantId,
        createdAt: current.createdAt,
        status: "approved",
        approvedAt: new Date().toISOString(),
        summary: typeof input?.summary === "string" && input.summary.trim()
          ? input.summary.trim()
          : current.summary,
      });
      records.set(next.id, next);
      return next;
    },
    reject(id, input = {}, tenantId) {
      const current = mustGet(records, id, tenantId);
      const next = normalizeApprovalRecord({
        ...current,
        id: current.id,
        tenantId: current.tenantId,
        createdAt: current.createdAt,
        status: "rejected",
        rejectedAt: new Date().toISOString(),
      });
      records.set(next.id, next);
      return next;
    },
  };
}

function normalizeApprovalRecord(input = {}) {
  return {
    id: String(input.id || "").trim(),
    tenantId: input.tenantId ? String(input.tenantId).trim() : null,
    title: String(input.title || "审批任务").trim(),
    reason: String(input.reason || "需要人工审批后执行。").trim(),
    featureId: String(input.featureId || "generic-approval").trim(),
    operationId: String(input.operationId || "").trim(),
    permissionMode: String(input.permissionMode || "manual").trim(),
    scope: input.scope === "task" ? "task" : "patch",
    status: normalizeStatus(input.status),
    createdAt: String(input.createdAt || new Date().toISOString()),
    approvedAt: input.approvedAt ? String(input.approvedAt) : null,
    rejectedAt: input.rejectedAt ? String(input.rejectedAt) : null,
    allowedFiles: normalizePaths(input.allowedFiles),
    forbiddenPaths: normalizePaths(input.forbiddenPaths, DEFAULT_FORBIDDEN_PATHS),
    patchProposal: input.patchProposal ?? null,
    intentPreview: input.intentPreview ?? null,
    operationPlan: input.operationPlan ?? null,
    approvalRecord: input.approvalRecord ?? null,
    summary: String(input.summary || "").trim(),
  };
}

function normalizeStatus(value) {
  return value === "approved" || value === "rejected" ? value : "pending";
}

function normalizePaths(input, fallback = []) {
  const source = Array.isArray(input) ? input : fallback;
  return Array.from(new Set(source.map((item) => String(item || "").replace(/\\/g, "/").trim()).filter(Boolean)));
}

function requireTenantId(tenantId) {
  if (!isPresentTenantId(tenantId)) {
    const error = new Error("Approval tenant id is required.");
    error.code = "approval_tenant_required";
    throw error;
  }
  return String(tenantId).trim();
}

function isPresentTenantId(tenantId) {
  return typeof tenantId === "string" && tenantId.trim() !== "";
}

// A record is visible only to callers presenting the exact owning tenant.
// Records without a tenant stamp (legacy) are never visible — fail-closed.
function isTenantMatch(record, tenantId) {
  return isPresentTenantId(tenantId)
    && isPresentTenantId(record?.tenantId)
    && record.tenantId === tenantId.trim();
}

function mustGet(records, id, tenantId) {
  const record = records.get(String(id || "").trim());
  // Cross-tenant access is reported as not-found to avoid leaking existence.
  if (!record || !isTenantMatch(record, tenantId)) {
    const error = new Error("Approval record not found.");
    error.code = "approval_not_found";
    throw error;
  }
  return record;
}

function buildApprovalId() {
  return `approval-${randomUUID()}`;
}
