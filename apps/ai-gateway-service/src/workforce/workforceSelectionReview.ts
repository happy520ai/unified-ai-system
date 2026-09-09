import { createHash } from "node:crypto";
import { stableStringify } from "@unified-ai-system/policy-engine";
import type { WorkforceRoleContribution, WorkforceRoleContributionReceipt, WorkforceRoleExecutionProfile,
  WorkforceSelectionDecision, WorkforceSelectionFeedback } from "@unified-ai-system/shared-contracts";
import { containsSensitivePublicationText } from "../security/secretSafety.js";
import { readFrozenWorkforceRoleExecutionProfile } from "./workforceRoleExecutionProfile.ts";

const trustedFeedback = new WeakSet<object>();
/** Only constructor-owned, deeply frozen facts can bypass heuristic hash redaction. */
export function isTrustedWorkforceSelectionFeedback(value: unknown): value is WorkforceSelectionFeedback {
  return value !== null && typeof value === "object" && trustedFeedback.has(value);
}

/** Exact durable review of the existing deterministic v1 decision; never an eligibility authority. */
export function readFrozenWorkforceSelectionReview(value: unknown, profileValue: unknown): WorkforceSelectionDecision {
  const profile = readSelectionProfile(profileValue);
  const source = record(value, ["version", "catalogHash", "selectionHash", "taskType", "roleIds", "executionMode",
    "assignments", "rejected", "maxConcurrentRoles", "maxTotalRequests"]);
  if (source.version !== 1 || !sha(source.catalogHash) || !sha(source.selectionHash)
    || (source.executionMode !== "fake" && source.executionMode !== "real")) throw invalid();
  const taskType = identifier(source.taskType);
  const roleIds = tags(source.roleIds, 3);
  if (stableStringify(roleIds) !== stableStringify(profile.bindings.map(item => item.roleId))
    || source.maxConcurrentRoles !== profile.maxConcurrentRoles || source.maxTotalRequests !== profile.maxTotalRequests) throw invalid();
  const assignments = Object.freeze(array(source.assignments, 3).map((value, index) => {
    const item = record(value, ["binding", "qualification"]);
    const binding = record(item.binding, ["roleId", "employeeId", "providerId", "modelId", "maxRequests", "maxInputTokens", "maxOutputTokens", "timeoutMs"]);
    const expected = profile.bindings[index];
    if (!expected || stableStringify(binding) !== stableStringify(expected)) throw invalid();
    const q = record(item.qualification, ["qualificationId", "employeeId", "providerId", "modelId", "roleIds", "taskTypes",
      "status", "origin", "executionMode", "evidenceHash", "validUntil"]);
    const qualifiedRoles = tags(q.roleIds, 7); const taskTypes = tags(q.taskTypes, 16);
    if (q.employeeId !== expected.employeeId || q.providerId !== expected.providerId || q.modelId !== expected.modelId
      || !qualifiedRoles.includes(expected.roleId) || !taskTypes.includes(taskType) || q.status !== "accepted"
      || q.executionMode !== source.executionMode || (q.origin !== "synthetic" && q.origin !== "reviewed")
      || (q.origin === "synthetic" && q.executionMode !== "fake") || !sha(q.evidenceHash)
      || typeof q.validUntil !== "string" || !Number.isFinite(Date.parse(q.validUntil))
      || new Date(q.validUntil).toISOString() !== q.validUntil) throw invalid();
    return Object.freeze({ binding: expected, qualification: Object.freeze({ qualificationId: identifier(q.qualificationId),
      employeeId: expected.employeeId, providerId: expected.providerId, modelId: expected.modelId,
      roleIds: qualifiedRoles, taskTypes, status: "accepted" as const, origin: q.origin as "synthetic" | "reviewed",
      executionMode: q.executionMode as "fake" | "real", evidenceHash: q.evidenceHash, validUntil: q.validUntil }) });
  }));
  if (assignments.length !== profile.bindings.length || new Set(assignments.map(item => item.binding.employeeId)).size !== assignments.length) throw invalid();
  const rejected = Object.freeze(array(source.rejected, 5).map(value => {
    const item = record(value, ["employeeId", "reason"]);
    if (item.reason !== "not_enabled" && item.reason !== "not_qualified" && item.reason !== "not_selected") throw invalid();
    return Object.freeze({ employeeId: identifier(item.employeeId), reason: item.reason });
  }));
  if (assignments.length + rejected.length > 5 || new Set(rejected.map(item => item.employeeId)).size !== rejected.length
    || rejected.some(item => assignments.some(assignment => assignment.binding.employeeId === item.employeeId))) throw invalid();
  // S1 hashes this explicit insertion order, rather than the approval envelope's canonical JSON.
  const decision: Omit<WorkforceSelectionDecision, "selectionHash"> = { version: 1 as const, catalogHash: source.catalogHash, taskType, roleIds,
    executionMode: source.executionMode, assignments, rejected,
    maxConcurrentRoles: profile.maxConcurrentRoles, maxTotalRequests: profile.maxTotalRequests };
  if (source.selectionHash !== digest(decision) || profile.profileId !== `selection-${source.selectionHash.slice(7)}`) throw invalid();
  return Object.freeze({ ...decision, selectionHash: source.selectionHash });
}

/** Facts from the server-owned B contribution/receipt; no inferred quality, latency or qualification. */
export function createWorkforceSelectionFeedback(input: {
  selection: WorkforceSelectionDecision; profile: WorkforceRoleExecutionProfile; executionId: string;
  roleId: string; employeeId: string; taskId: string; receipt: WorkforceRoleContributionReceipt;
  contribution?: WorkforceRoleContribution | null;
}): WorkforceSelectionFeedback {
  const source = record(input, ["selection", "profile", "executionId", "roleId", "employeeId", "taskId", "receipt",
    ...(Object.hasOwn(input, "contribution") ? ["contribution"] : [])]) as typeof input;
  const profile = readSelectionProfile(source.profile);
  input = { ...source, profile, selection: readFrozenWorkforceSelectionReview(source.selection, profile),
    receipt: record(source.receipt, ["version", "level", "status", "executionMode", "gatewayRequestId", "providerId", "modelId",
      "providerCallAttempted", "inputTokens", "outputTokens", "totalTokens", "estimatedCostUsd", "errorCode"]) as unknown as WorkforceRoleContributionReceipt,
  };
  if (!/^wf-scope-[a-f0-9]{64}$/u.test(input.executionId) || !/^[A-Za-z0-9][A-Za-z0-9._:-]{0,159}$/u.test(input.taskId)
    || identifier(input.taskId) !== input.taskId
    || input.receipt.version !== 1 || input.receipt.level !== "gateway-provider-operation"
    || !["succeeded", "failed", "blocked", "cancelled", "outcome_unknown"].includes(input.receipt.status)
    || !["fake", "real", "unknown"].includes(input.receipt.executionMode)
    || (input.receipt.providerCallAttempted !== null && typeof input.receipt.providerCallAttempted !== "boolean")
    || (input.receipt.gatewayRequestId !== null && identifier(input.receipt.gatewayRequestId) !== input.receipt.gatewayRequestId)
    || (input.receipt.errorCode !== null && (!/^[A-Z][A-Z0-9_]{0,95}$/u.test(input.receipt.errorCode)
      || identifier(input.receipt.errorCode) !== input.receipt.errorCode))) throw invalid();
  const binding = input.profile.bindings.find(item => item.roleId === input.roleId && item.employeeId === input.employeeId);
  const contribution = input.contribution == null ? null : record(input.contribution, ["version", "employeeId", "roleId", "governedAgentId",
    "agentRunId", "executionId", "taskId", "planId", "planDigest", "profileHash", "contributionText", "receipt"]) as unknown as WorkforceRoleContribution;
  if (!binding || !input.selection.assignments.some(item => stableStringify(item.binding) === stableStringify(binding))
    || (input.receipt.providerId !== null && input.receipt.providerId !== binding.providerId)
    || (input.receipt.modelId !== null && input.receipt.modelId !== binding.modelId)
    || (input.receipt.executionMode !== "unknown" && input.receipt.executionMode !== input.selection.executionMode)
    || (contribution && (contribution.profileHash !== input.profile.profileHash || contribution.executionId !== input.executionId
      || contribution.roleId !== input.roleId || contribution.employeeId !== input.employeeId || contribution.taskId !== input.taskId
      || stableStringify(contribution.receipt) !== stableStringify(input.receipt)))) throw invalid();
  const feedback: WorkforceSelectionFeedback = Object.freeze({ version: 1, selectionHash: input.selection.selectionHash, catalogHash: input.selection.catalogHash,
    profileHash: input.profile.profileHash, executionId: input.executionId, roleId: input.roleId, employeeId: input.employeeId,
    taskId: input.taskId, receipt: Object.freeze({ status: input.receipt.status, executionMode: input.receipt.executionMode,
      gatewayRequestId: input.receipt.gatewayRequestId, providerId: input.receipt.providerId, modelId: input.receipt.modelId,
      providerCallAttempted: input.receipt.providerCallAttempted, errorCode: input.receipt.errorCode }), contributionHash: contribution?.contributionText == null ? null
      : `sha256:${createHash("sha256").update(contribution.contributionText, "utf8").digest("hex")}`,
    quality: "unassessed", qualityScore: null });
  trustedFeedback.add(feedback);
  return feedback;
}

function record(value: unknown, keys: string[]): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value) || ![Object.prototype, null].includes(Object.getPrototypeOf(value))
    || Reflect.ownKeys(value).length !== keys.length || Object.keys(value).length !== keys.length
    || Object.keys(value).some(key => !keys.includes(key))
    || Object.values(Object.getOwnPropertyDescriptors(value)).some(property => !("value" in property))) throw invalid();
  const descriptors = Object.getOwnPropertyDescriptors(value);
  return Object.fromEntries(keys.map(key => [key, descriptors[key].value]));
}
function array(value: unknown, maximum: number): unknown[] {
  if (!Array.isArray(value) || Object.getPrototypeOf(value) !== Array.prototype || value.length > maximum
    || Reflect.ownKeys(value).length !== value.length + 1) throw invalid();
  const snapshot: unknown[] = [];
  for (let index = 0; index < value.length; index++) {
    const property = Object.getOwnPropertyDescriptor(value, String(index));
    if (!property || !("value" in property)) throw invalid();
    snapshot.push(property.value);
  }
  return snapshot;
}
function readSelectionProfile(value: unknown): WorkforceRoleExecutionProfile {
  const source = record(value, ["version", "mode", "profileId", "maxTotalRequests", "maxConcurrentRoles", "bindings", "profileHash"]);
  return readFrozenWorkforceRoleExecutionProfile({ ...source, bindings: array(source.bindings, 3).map(value => record(value,
    ["roleId", "employeeId", "providerId", "modelId", "maxRequests", "maxInputTokens", "maxOutputTokens", "timeoutMs"])) });
}
function tags(value: unknown, maximum: number): readonly string[] {
  const values = array(value, maximum).map(identifier);
  if (!values.length || new Set(values).size !== values.length || JSON.stringify([...values].sort()) !== JSON.stringify(values)) throw invalid();
  return Object.freeze(values);
}
function identifier(value: unknown): string {
  if (typeof value !== "string" || !/^[A-Za-z0-9][A-Za-z0-9._:/-]{0,255}$/u.test(value) || containsSensitivePublicationText(value)) throw invalid();
  return value;
}
function sha(value: unknown): value is string { return typeof value === "string" && /^sha256:[a-f0-9]{64}$/u.test(value); }
function digest(value: unknown): string { return `sha256:${createHash("sha256").update(JSON.stringify(value)).digest("hex")}`; }
function invalid() { return Object.assign(new Error("Workforce selection review is incomplete, unsafe, or inconsistent with its profile."), {
  code: "WORKFORCE_SELECTION_REVIEW_INVALID", retryable: false, statusCode: 409,
}); }
