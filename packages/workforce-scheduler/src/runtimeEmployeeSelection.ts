import { createHash } from "node:crypto";
import type { WorkforceSelectionCandidate, WorkforceSelectionQualification, WorkforceSelectionDecision,
  WorkforceSelectionTask } from "../../shared-contracts/src/contracts/workforce.ts";

const CONFIG_ERROR = "WORKFORCE_SELECTION_CONFIG_INVALID";
const compare = (a: string, b: string) => a < b ? -1 : a > b ? 1 : 0;

/** The constructor receives accepted server records; select accepts task requirements only. */
export function createRuntimeEmployeeSelector(value: unknown) {
  const source = fields(value, ["version", "catalogId", "catalogRevision", "maxCandidates", "maxSelectedRoles", "maxConcurrentRoles", "maxTotalRequests", "candidates", "qualifications"]);
  if (source.version !== 1) throw invalid();
  const maxCandidates = integer(source.maxCandidates, 1, 5);
  const maxSelectedRoles = integer(source.maxSelectedRoles, 1, 3);
  const maxConcurrentRoles = integer(source.maxConcurrentRoles, 1, maxSelectedRoles);
  const maxTotalRequests = integer(source.maxTotalRequests, 1, 15);
  const candidates = array(source.candidates, maxCandidates).map(candidate).sort((a, b) => compare(a.employeeId, b.employeeId));
  const qualifications = array(source.qualifications, 64).map(qualification).sort((a, b) => compare(a.qualificationId, b.qualificationId));
  if (new Set(candidates.map((item) => item.employeeId)).size !== candidates.length
    || new Set(qualifications.map((item) => item.qualificationId)).size !== qualifications.length) throw invalid();
  const snapshot = Object.freeze({ version: 1, catalogId: identifier(source.catalogId), catalogRevision: identifier(source.catalogRevision),
    maxCandidates, maxSelectedRoles, maxConcurrentRoles, maxTotalRequests, candidates: Object.freeze(candidates), qualifications: Object.freeze(qualifications) });
  const catalogHash = digest(snapshot);
  const enabled = candidates.filter((item): item is WorkforceSelectionCandidate => item.status === "enabled")
    .sort((a, b) => a.priority - b.priority || compare(a.employeeId, b.employeeId));
  const accepted = qualifications.filter((item): item is WorkforceSelectionQualification => item.status === "accepted");
  return Object.freeze({ catalogHash, select(value: WorkforceSelectionTask): WorkforceSelectionDecision {
    let task: WorkforceSelectionTask;
    try {
      const input = fields(value, ["taskType", "roleIds", "executionMode"]);
      if (input.executionMode !== "fake" && input.executionMode !== "real") throw invalid();
      task = Object.freeze({ taskType: identifier(input.taskType), roleIds: tags(input.roleIds, 7), executionMode: input.executionMode });
    } catch { throw invalid("WORKFORCE_SELECTION_TASK_INVALID"); }
    if (task.roleIds.length > maxSelectedRoles) throw invalid("WORKFORCE_SELECTION_ROLE_LIMIT");
    if (task.roleIds.length > maxTotalRequests) throw invalid("WORKFORCE_SELECTION_REQUEST_LIMIT");
    const eligible = new Map(task.roleIds.map((roleId) => [roleId, enabled.flatMap((entry) => {
      const acceptedQualification = accepted.find((q) => q.employeeId === entry.employeeId && q.providerId === entry.providerId && q.modelId === entry.modelId
        && q.executionMode === task.executionMode && q.roleIds.includes(roleId) && q.taskTypes.includes(task.taskType));
      return entry.roleIds.includes(roleId) && entry.taskTypes.includes(task.taskType) && acceptedQualification
        ? [{ entry, qualification: acceptedQualification }] : [];
    })]));
    const roleOrder = [...task.roleIds].sort((a, b) => eligible.get(a)!.length - eligible.get(b)!.length || compare(a, b));
    const chosen = new Map<string, { entry: WorkforceSelectionCandidate; qualification: WorkforceSelectionQualification }>();
    const used = new Set<string>();
    const assign = (index: number): boolean => {
      if (index === roleOrder.length) return true;
      const roleId = roleOrder[index];
      for (const option of eligible.get(roleId)!) {
        if (used.has(option.entry.employeeId)) continue;
        chosen.set(roleId, option); used.add(option.entry.employeeId);
        if (assign(index + 1)) return true;
        chosen.delete(roleId); used.delete(option.entry.employeeId);
      }
      return false;
    };
    if (!assign(0)) throw invalid("WORKFORCE_SELECTION_INCOMPLETE");
    const assignments = Object.freeze(task.roleIds.map((roleId) => {
      const selected = chosen.get(roleId)!;
      return Object.freeze({ binding: Object.freeze({ roleId, employeeId: selected.entry.employeeId,
        providerId: selected.entry.providerId, modelId: selected.entry.modelId, ...selected.entry.limits }), qualification: selected.qualification });
    }));
    const rejected = Object.freeze(candidates.filter((entry) => !used.has(entry.employeeId)).map((entry) => Object.freeze({ employeeId: entry.employeeId,
      reason: entry.status !== "enabled" ? "not_enabled" as const
        : [...eligible.values()].some((options) => options.some((option) => option.entry.employeeId === entry.employeeId)) ? "not_selected" as const : "not_qualified" as const })));
    const decision = { version: 1 as const, catalogHash, ...task, assignments, rejected,
      maxConcurrentRoles: Math.min(maxConcurrentRoles, assignments.length),
      maxTotalRequests: Math.min(maxTotalRequests, assignments.reduce((sum, item) => sum + item.binding.maxRequests, 0)) };
    return Object.freeze({ ...decision, selectionHash: digest(decision) });
  } });
}

function candidate(value: unknown): WorkforceSelectionCandidate | { employeeId: string; status: "ineligible" } {
  const source = record(value); const employeeId = identifier(source.employeeId);
  if (source.status !== "enabled") return Object.freeze({ employeeId, status: "ineligible" });
  fields(source, ["employeeId", "status", "roleIds", "taskTypes", "providerId", "modelId", "priority", "limits"]);
  const limits = fields(source.limits, ["maxRequests", "maxInputTokens", "maxOutputTokens", "timeoutMs"]);
  return Object.freeze({ employeeId, status: "enabled", roleIds: tags(source.roleIds, 7), taskTypes: tags(source.taskTypes, 16),
    providerId: identifier(source.providerId), modelId: identifier(source.modelId), priority: integer(source.priority, 0, 1000),
    limits: Object.freeze({ maxRequests: integer(limits.maxRequests, 1, 5), maxInputTokens: integer(limits.maxInputTokens, 1, 1_000_000),
      maxOutputTokens: integer(limits.maxOutputTokens, 1, 1_000_000), timeoutMs: integer(limits.timeoutMs, 1000, 3_600_000) }) });
}
function qualification(value: unknown): WorkforceSelectionQualification | { qualificationId: string; status: "ineligible" } {
  const source = record(value); const qualificationId = identifier(source.qualificationId);
  if (source.status !== "accepted") return Object.freeze({ qualificationId, status: "ineligible" });
  fields(source, ["qualificationId", "employeeId", "providerId", "modelId", "roleIds", "taskTypes", "status", "origin", "executionMode", "evidenceHash", "validUntil"]);
  if ((source.origin !== "synthetic" && source.origin !== "reviewed") || (source.executionMode !== "fake" && source.executionMode !== "real")
    || source.origin === "synthetic" && source.executionMode !== "fake" || typeof source.evidenceHash !== "string" || !/^sha256:[a-f0-9]{64}$/.test(source.evidenceHash)
    || typeof source.validUntil !== "string" || !Number.isFinite(Date.parse(source.validUntil))
    || new Date(source.validUntil).toISOString() !== source.validUntil) throw invalid();
  return Object.freeze({ qualificationId, employeeId: identifier(source.employeeId), providerId: identifier(source.providerId), modelId: identifier(source.modelId),
    roleIds: tags(source.roleIds, 7), taskTypes: tags(source.taskTypes, 16), status: "accepted", origin: source.origin,
    executionMode: source.executionMode, evidenceHash: source.evidenceHash, validUntil: new Date(source.validUntil).toISOString() });
}
function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value) || ![Object.prototype, null].includes(Object.getPrototypeOf(value)) || Object.getOwnPropertySymbols(value).length
    || Object.values(Object.getOwnPropertyDescriptors(value)).some((property) => !("value" in property))) throw invalid();
  return value as Record<string, unknown>;
}
function fields(value: unknown, keys: string[]): Record<string, unknown> {
  const source = record(value); if (Object.keys(source).length !== keys.length || Object.keys(source).some((key) => !keys.includes(key))) throw invalid(); return source;
}
function array(value: unknown, maximum: number): unknown[] {
  if (!Array.isArray(value) || Object.getPrototypeOf(value) !== Array.prototype || Object.getOwnPropertySymbols(value).length || value.length > maximum
    || Object.getOwnPropertyNames(value).length !== value.length + 1) throw invalid();
  for (let index = 0; index < value.length; index += 1) {
    const property = Object.getOwnPropertyDescriptor(value, String(index)); if (!property || !("value" in property)) throw invalid();
  }
  return value;
}
function tags(value: unknown, maximum: number): readonly string[] {
  const result = array(value, maximum).map(identifier).sort(compare); if (!result.length || new Set(result).size !== result.length) throw invalid(); return Object.freeze(result);
}
function identifier(value: unknown): string { if (typeof value !== "string" || !/^[A-Za-z0-9][A-Za-z0-9._:/-]{0,255}$/.test(value)) throw invalid(); return value; }
function integer(value: unknown, minimum: number, maximum: number): number { if (!Number.isSafeInteger(value) || Number(value) < minimum || Number(value) > maximum) throw invalid(); return Number(value); }
function digest(value: unknown): string { return `sha256:${createHash("sha256").update(JSON.stringify(value)).digest("hex")}`; }
function invalid(code = CONFIG_ERROR) { return Object.assign(new Error(`Workforce selection was rejected: ${code}.`), { code, retryable: false }); }
