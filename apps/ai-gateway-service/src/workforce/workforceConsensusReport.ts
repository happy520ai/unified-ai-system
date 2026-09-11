import { createHash } from "node:crypto";
import { stableStringify } from "@unified-ai-system/policy-engine";
import type { WorkforceConsensusReview, WorkforceConsensusOpinion, WorkforceRoleContributionReceipt } from "@unified-ai-system/shared-contracts";
import { buildConsensusMessages, deriveConsensusDecision, parseConsensusOpinion, readConsensusReview } from "./workforceConsensusReview.ts";
import type { WorkforceRoleInputReceipt } from "./workforceRoleProvider.ts";

type Data = Record<string, any>;
export type WorkforceConsensusMetadata = { version: 1; agentId: string; agentRunId: string; planId: string;
  planDigest: string; profileHash: string; review: WorkforceConsensusReview };
export type WorkforceConsensusEntry = { roleId: string; taskId: string | null; responseText: string | null;
  responseHash: string | null; errorCode: string | null; inputReceipt: WorkforceRoleInputReceipt | null };
type UsageEntry = { roleId: string; employeeId: string; taskId: string; receipt: WorkforceRoleContributionReceipt };
const terminal = new Set(["completed", "failed", "cancelled", "force_stopped"]);
const states = new Set(["succeeded", "failed", "blocked", "cancelled", "outcome_unknown"]);
export const consensusHash = (value: unknown) => "sha256:" + createHash("sha256").update(stableStringify(value)).digest("hex");
export const consensusTextHash = (value: string) => "sha256:" + createHash("sha256").update(value).digest("hex");
export const consensusError = (code: string, message: string, statusCode = 409) => Object.assign(new Error(message), { code, statusCode, retryable: false });
const invalid = () => consensusError("WORKFORCE_CONSENSUS_RECORD_INVALID", "The consensus record no longer matches its reviewed inputs and observed contributions.");
const identifier = (value: unknown): value is string => typeof value === "string" && /^[A-Za-z0-9][A-Za-z0-9._:/-]{0,511}$/u.test(value);
const digest = (value: unknown, prefix = true): value is string => typeof value === "string" && (prefix ? /^sha256:[a-f0-9]{64}$/u : /^[a-f0-9]{64}$/u).test(value);
const same = (a: unknown, b: unknown) => stableStringify(a) === stableStringify(b);
function keys(value: any, expected: string[]): asserts value is Data {
  if (!value || typeof value !== "object" || Array.isArray(value) || ![Object.prototype, null].includes(Object.getPrototypeOf(value))
    || Reflect.ownKeys(value).length !== expected.length || Object.keys(value).sort().join() !== [...expected].sort().join()
    || Object.values(Object.getOwnPropertyDescriptors(value)).some(field => !("value" in field))) throw invalid();
}
export function readWorkforceConsensusMetadata(value: unknown): WorkforceConsensusMetadata {
  keys(value, ["version", "agentId", "agentRunId", "planId", "planDigest", "profileHash", "review"]);
  if (value.version !== 1 || !/^agt_[A-Za-z0-9_-]{1,128}$/u.test(value.agentId) || !/^agr_[A-Za-z0-9_-]{1,128}$/u.test(value.agentRunId)
    || !identifier(value.planId) || !digest(value.planDigest, false) || !digest(value.profileHash)) throw invalid();
  return Object.freeze({ version: 1, agentId: value.agentId, agentRunId: value.agentRunId, planId: value.planId,
    planDigest: value.planDigest, profileHash: value.profileHash, review: readConsensusReview(value.review) });
}
function receipt(value: unknown, binding: Data): WorkforceRoleContributionReceipt {
  keys(value, ["version", "level", "status", "executionMode", "gatewayRequestId", "providerId", "modelId", "providerCallAttempted", "inputTokens", "outputTokens", "totalTokens", "estimatedCostUsd", "errorCode"]);
  if (value.version !== 1 || value.level !== "gateway-provider-operation" || !states.has(value.status)
    || !["fake", "real", "unknown"].includes(value.executionMode) || ![true, false, null].includes(value.providerCallAttempted)
    || ![value.gatewayRequestId, value.providerId, value.modelId].every(id => id === null || identifier(id))
    || ![value.inputTokens, value.outputTokens, value.totalTokens].every(n => n === null || Number.isSafeInteger(n) && n >= 0)
    || value.estimatedCostUsd !== null || value.errorCode !== null && !/^[A-Z][A-Z0-9_]{0,95}$/u.test(value.errorCode)
    || value.status === "succeeded" && (value.providerCallAttempted !== true || value.providerId !== binding.providerId
      || value.modelId !== binding.modelId || !identifier(value.gatewayRequestId) || value.errorCode !== null || value.executionMode === "unknown")) throw invalid();
  return Object.freeze({ ...value }) as WorkforceRoleContributionReceipt;
}

/** Builds and rechecks bounded reports. These records are protected local journal data, not external signatures. */
export function createWorkforceConsensusReport(input: { executionId: string; metadata: WorkforceConsensusMetadata;
  executionStatus: string; entries: WorkforceConsensusEntry[]; receipts: readonly UsageEntry[]; dispatchCount: number }): Data {
  const metadata = readWorkforceConsensusMetadata(input.metadata), review = metadata.review;
  if (!identifier(input.executionId) || !terminal.has(input.executionStatus) || !Number.isSafeInteger(input.dispatchCount)
    || input.dispatchCount < 0 || input.dispatchCount > 3 || !Array.isArray(input.entries) || input.entries.length !== 3
    || !Array.isArray(input.receipts) || input.receipts.length > 3) throw invalid();
  const observations = input.receipts.map(item => {
    keys(item, ["roleId", "employeeId", "taskId", "receipt"]);
    const binding = review.perspectives.find(p => p.roleId === item.roleId);
    if (!binding || binding.employeeId !== item.employeeId || !identifier(item.taskId)) throw invalid();
    return { roleId: item.roleId, employeeId: item.employeeId, taskId: item.taskId, receipt: receipt(item.receipt, binding) };
  });
  if (new Set(observations.map(item => item.roleId)).size !== observations.length
    || observations.filter(item => item.receipt.providerCallAttempted === true).length > input.dispatchCount) throw invalid();
  const opinions: WorkforceConsensusOpinion[] = [], requestIds = new Set<string>();
  const entries = review.perspectives.map(binding => {
    const matches = input.entries.filter(entry => entry.roleId === binding.roleId);
    if (matches.length !== 1) throw invalid();
    const entry = matches[0]; keys(entry, ["roleId", "taskId", "responseText", "responseHash", "errorCode", "inputReceipt"]);
    if (entry.taskId !== null && !identifier(entry.taskId) || entry.errorCode !== null && !/^[A-Z][A-Z0-9_]{0,95}$/u.test(entry.errorCode)) throw invalid();
    const observed = observations.find(item => item.roleId === binding.roleId);
    if (observed && observed.taskId !== entry.taskId) throw invalid();
    let opinion: WorkforceConsensusOpinion | null = null;
    if (entry.responseText !== null) {
      if (typeof entry.responseText !== "string" || Buffer.byteLength(entry.responseText) > 65536 || entry.errorCode !== null
        || entry.responseHash !== consensusTextHash(entry.responseText) || !observed || observed.receipt.status !== "succeeded") throw invalid();
      opinion = parseConsensusOpinion(entry.responseText, review, binding.perspective);
      const proof = entry.inputReceipt;
      keys(proof, ["version", "profile", "messageCount", "sourceMessagesHash", "gatewayInputHash", "providerInputHash", "gatewayRequestId"]);
      const messages = buildConsensusMessages(review, binding.perspective);
      if (proof.version !== 1 || proof.profile !== "off" || proof.messageCount !== messages.length
        || proof.sourceMessagesHash !== consensusTextHash(JSON.stringify(messages)) || !digest(proof.gatewayInputHash, false)
        || proof.gatewayInputHash !== proof.providerInputHash || proof.gatewayRequestId !== observed.receipt.gatewayRequestId
        || requestIds.has(proof.gatewayRequestId)) throw invalid();
      requestIds.add(proof.gatewayRequestId); opinions.push(opinion);
    } else if (entry.responseHash !== null || entry.inputReceipt !== null) throw invalid();
    return { ...entry, perspective: binding.perspective, employeeId: binding.employeeId, opinion,
      contributionStatus: opinion ? "opinion" : entry.errorCode ? "failed" : "not_observed" };
  });
  const derived = deriveConsensusDecision(review, opinions);
  const decision = input.executionStatus === "completed" ? derived : { ...derived, status: "incomplete" };
  const complete = input.executionStatus === "completed" && opinions.length === 3 && input.dispatchCount === 3;
  const result = { version: 1, executionId: input.executionId, metadata, executionStatus: input.executionStatus,
    status: complete ? "complete" : "incomplete", independentInputsVerified: complete,
    evidenceLevel: observations.length && observations.every(item => item.receipt.executionMode === "real") ? "real-model-responses" : "synthetic-or-incomplete-responses",
    semanticTruthVerified: false, automaticallyExecutedPlan: false, decision,
    entries, receipts: observations, dispatchCount: input.dispatchCount,
    usage: { source: "gateway-provider-operation-receipts", networkRetryCountKnown: false, costUsd: null,
      inputTokens: totalUsage(observations, "inputTokens", input.dispatchCount),
      outputTokens: totalUsage(observations, "outputTokens", input.dispatchCount) } };
  // A JSON report is a tree; shared proposal/support arrays must not look like cycles to output governance.
  return freezeData(JSON.parse(JSON.stringify({ ...result, reportHash: consensusHash(result) })));
}
function freezeData(value: any): any {
  if (value && typeof value === "object") { for (const nested of Object.values(value)) freezeData(nested); Object.freeze(value); }
  return value;
}
function totalUsage(observations: UsageEntry[], key: "inputTokens" | "outputTokens", dispatchCount: number): number | null {
  if (observations.some(item => item.receipt[key] === null || item.receipt.providerCallAttempted === null)
    || observations.filter(item => item.receipt.providerCallAttempted === true).length !== dispatchCount) return null;
  const sum = observations.reduce((count, item) => count + item.receipt[key]!, 0);
  return Number.isSafeInteger(sum) ? sum : null;
}
export function readWorkforceConsensusReport(value: unknown, expected?: { executionId: string; metadata: WorkforceConsensusMetadata }): Data {
  keys(value, ["version", "executionId", "metadata", "executionStatus", "status", "independentInputsVerified", "evidenceLevel", "semanticTruthVerified",
    "automaticallyExecutedPlan", "decision", "entries", "receipts", "dispatchCount", "usage", "reportHash"]);
  if (value.version !== 1 || !Array.isArray(value.entries) || expected && (value.executionId !== expected.executionId || !same(value.metadata, expected.metadata))) throw invalid();
  const entries = value.entries.map((entry: Data) => { keys(entry, ["roleId", "taskId", "responseText", "responseHash", "errorCode", "inputReceipt", "perspective", "employeeId", "opinion", "contributionStatus"]);
    return { roleId: entry.roleId, taskId: entry.taskId, responseText: entry.responseText, responseHash: entry.responseHash, errorCode: entry.errorCode, inputReceipt: entry.inputReceipt }; });
  const rebuilt = createWorkforceConsensusReport({ executionId: value.executionId, metadata: value.metadata,
    executionStatus: value.executionStatus, entries, receipts: value.receipts, dispatchCount: value.dispatchCount });
  if (!same(rebuilt, value)) throw invalid();
  return rebuilt;
}
export function attachWorkforceConsensusResult(state: Data, executionId: string, value: unknown): Data {
  const metadata = readWorkforceConsensusMetadata(state.metadata?.consensusReview);
  const report = readWorkforceConsensusReport(value, { executionId, metadata });
  if (state.status !== report.executionStatus || !terminal.has(state.status)) throw invalid();
  if (state.summary?.consensusReport && !same(state.summary.consensusReport, report)) {
    throw consensusError("WORKFORCE_CONSENSUS_REPORT_EXISTS", "The original consensus report cannot be replaced.");
  }
  return { ...(state.summary ?? {}), consensusReport: report };
}
