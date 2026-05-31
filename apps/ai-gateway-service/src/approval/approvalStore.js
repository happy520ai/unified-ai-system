const DEFAULT_FORBIDDEN_PATHS = ["legacy/", "PROJECT_CONTEXT.md", ".env", ".git", "node_modules"];

export function createApprovalStore() {
  const records = new Map();

  return {
    list() {
      return Array.from(records.values()).sort((left, right) => String(right.createdAt).localeCompare(String(left.createdAt)));
    },
    get(id) {
      return records.get(String(id || "").trim()) ?? null;
    },
    create(input = {}) {
      const id = buildApprovalId();
      const record = normalizeApprovalRecord({
        ...input,
        id,
        createdAt: new Date().toISOString(),
        status: "pending",
      });
      records.set(id, record);
      return record;
    },
    approve(id, input = {}) {
      const current = mustGet(records, id);
      const next = normalizeApprovalRecord({
        ...current,
        ...input,
        id: current.id,
        createdAt: current.createdAt,
        status: "approved",
        approvedAt: new Date().toISOString(),
      });
      records.set(next.id, next);
      return next;
    },
    reject(id, input = {}) {
      const current = mustGet(records, id);
      const next = normalizeApprovalRecord({
        ...current,
        ...input,
        id: current.id,
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

function mustGet(records, id) {
  const record = records.get(String(id || "").trim());
  if (!record) {
    const error = new Error("Approval record not found.");
    error.code = "approval_not_found";
    throw error;
  }
  return record;
}

function buildApprovalId() {
  return `approval-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}
