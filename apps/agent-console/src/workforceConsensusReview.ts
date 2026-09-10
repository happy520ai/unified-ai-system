import { createHash } from "node:crypto";
import { parseContextJson } from "@unified-ai-system/context-codec-core";
import { sanitizeOperatorData } from "./operatorCommands.ts";
import type { WorkforceConsensusReview, WorkforceConsensusReport } from "../../../packages/shared-contracts/src/contracts/workforce.ts";

type Data = Record<string, any>;
const PERSPECTIVES = ["Critic", "Planner", "Architect"], ROLES = ["ceo", "pm", "architect"];
const RULE = "any-objection-holds-plan-v1";
const FORBIDDEN = new Set(["__proto__", "prototype", "constructor"]);
const SECRET = /\b(?:xox[abprs]-[A-Za-z0-9-]{10,}|xapp-[A-Za-z0-9-]{20,}|(?:sk_live_|rk_live_|whsec_)[A-Za-z0-9]{16,}|npm_[A-Za-z0-9]{20,}|tp-[A-Za-z0-9_-]{20,}|nvapi-[A-Za-z0-9_-]{12,}|sk-[A-Za-z0-9_-]{16,}|AIza[0-9A-Za-z_-]{20,}|hf_[A-Za-z0-9_-]{16,}|gh[pousr]_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{20,}|glpat-[A-Za-z0-9_-]{20,}|(?:AKIA|ASIA)[A-Z0-9]{16})\b|\bAuthorization\s*:\s*(?:Bearer|Basic)\s+\S{8,}|\b[A-Z0-9_]*(?:API[_-]?KEY|TOKEN|SECRET|PASSWORD|PRIVATE[_-]?KEY|ACCESS[_-]?KEY)[A-Z0-9_]*\s*[:=]\s*["']?[^\s"'<>#,;]{4,}|\b[a-z][a-z0-9+.-]*:\/\/[^:\s/@]+:[^@\s/]+@|-----BEGIN [A-Z ]*PRIVATE KEY-----/iu;
const same = (left: unknown, right: unknown) => stable(left) === stable(right);
const sha = (value: string) => "sha256:" + createHash("sha256").update(value, "utf8").digest("hex");
const hash = (value: unknown) => sha(stable(value));
const digest = (value: unknown, prefix = true) => typeof value === "string" && (prefix ? /^sha256:[a-f0-9]{64}$/u : /^[a-f0-9]{64}$/u).test(value);
const code = (value: unknown) => value === null || typeof value === "string" && /^[A-Z][A-Z0-9_]{0,95}$/u.test(value);
function invalid(): never { throw new Error("Invalid or incomplete Workforce consensus review or report."); }

export function projectWorkforceConsensusReview(value: unknown): WorkforceConsensusReview {
  const source = record(value, ["version", "rule", "goal", "perspectives", "proposal", "criteria", "evidence", "sourceHash", "reviewHash"]);
  if (source.version !== 1 || source.rule !== RULE) invalid();
  const perspectives = array(source.perspectives, 3, 3).map((value, index) => {
    const item = record(value, ["perspective", "roleId", "employeeId", "providerId", "modelId"]);
    if (item.perspective !== PERSPECTIVES[index] || item.roleId !== ROLES[index]) invalid();
    return { perspective: item.perspective, roleId: item.roleId, employeeId: reviewIdentifier(item.employeeId),
      providerId: identifier(item.providerId, 256), modelId: identifier(item.modelId, 256) };
  });
  if (new Set(perspectives.map(item => item.employeeId)).size !== 3) invalid();
  const proposal = unique(array(source.proposal, 1, 12).map(value => {
    const item = record(value, ["id", "title", "verification"]);
    return { id: reviewIdentifier(item.id), title: text(item.title, 600), verification: text(item.verification, 600) };
  }));
  const criteria = unique(array(source.criteria, 1, 6).map(value => {
    const item = record(value, ["id", "question", "verification"]);
    return { id: reviewIdentifier(item.id), question: text(item.question, 600), verification: text(item.verification, 600) };
  }));
  let totalBytes = 0;
  const evidence = unique(array(source.evidence, 1, 12).map(value => {
    const item = record(value, ["id", "title", "content", "sha256"]), content = text(item.content, 4000, true, true);
    totalBytes += Buffer.byteLength(content); if (totalBytes > 16000 || item.sha256 !== sha(content)) invalid();
    return { id: reviewIdentifier(item.id), title: text(item.title, 600), content, sha256: item.sha256 };
  }));
  const material = { goal: text(source.goal, 1000), proposal, criteria, evidence };
  const review = { version: 1, rule: RULE, ...material, perspectives, sourceHash: hash(material) };
  if (!same(source, { ...review, reviewHash: hash(review) })) invalid();
  return freeze({ ...review, reviewHash: hash(review) }) as unknown as WorkforceConsensusReview;
}

export function projectWorkforceConsensusApproval(value: unknown): WorkforceConsensusReview {
  const body = record(value, ["goal", "goalDigest", "goalBytes", "planId", "planDigest", "autonomyMode", "requiredScopes", "optionsHash", "options"]);
  const options = record(body.options), review = projectWorkforceConsensusReview(options.consensusReview);
  if (Object.keys(options).some(key => !["selectedRoleCount", "templateSelected", "roleExecution", "selectionReview", "codeDelivery", "workflowHandoff", "consensusReview"].includes(key))) invalid();
  if (body.goal !== review.goal || body.goalDigest !== sha(review.goal) || body.goalBytes !== Buffer.byteLength(review.goal)
    || !digest(body.planDigest) || typeof body.planId !== "string" || !/^[A-Za-z0-9][A-Za-z0-9._:-]{0,159}$/u.test(body.planId) || body.optionsHash !== hash(options)
    || options.selectedRoleCount !== 3 || typeof options.templateSelected !== "boolean") invalid();
  text(body.autonomyMode, 64); const scopes = array(body.requiredScopes, 0, 8);
  if (new Set(scopes).size !== scopes.length || scopes.some(value => typeof value !== "string" || !/^[A-Za-z0-9][A-Za-z0-9:_-]{0,127}$/u.test(value))) invalid();
  const profile = record(options.roleExecution, ["version", "mode", "profileId", "profileHash", "maxTotalRequests", "maxConcurrentRoles", "bindings"]);
  if (profile.version !== 1 || profile.mode !== "gateway-llm-required" || profile.maxTotalRequests < 3
    || !Number.isSafeInteger(profile.maxTotalRequests) || !Number.isSafeInteger(profile.maxConcurrentRoles)
    || profile.maxConcurrentRoles < 1 || profile.maxConcurrentRoles > 3) invalid();
  reviewIdentifier(profile.profileId);
  const bindings = array(profile.bindings, 3, 3).map(value => record(value, ["roleId", "employeeId", "providerId", "modelId", "maxRequests", "maxInputTokens", "maxOutputTokens", "timeoutMs"]));
  for (const binding of bindings) {
    const expected = review.perspectives.find(item => item.roleId === binding.roleId);
    if (!expected || ["employeeId", "providerId", "modelId"].some(key => binding[key] !== (expected as any)[key])
      || !Number.isSafeInteger(binding.maxRequests) || binding.maxRequests < 1 || binding.maxRequests > 5
      || ["maxInputTokens", "maxOutputTokens"].some(key => !Number.isSafeInteger(binding[key]) || binding[key] < 1 || binding[key] > 1000000)
      || !Number.isSafeInteger(binding.timeoutMs) || binding.timeoutMs < 1000 || binding.timeoutMs > 3600000) invalid();
  }
  if (new Set(bindings.map(item => item.roleId)).size !== 3 || profile.maxTotalRequests > bindings.reduce((sum, item) => sum + item.maxRequests, 0)) invalid();
  const { profileHash, ...profileFields } = profile; if (profileHash !== hash(profileFields)) invalid();
  return review;
}
export function assertConsensusOptionsHash(options: unknown, expected: unknown): void { if (!digest(expected) || hash(options) !== expected) invalid(); }
export function formatWorkforceConsensusReview(review: WorkforceConsensusReview): string[] {
  return [`Consensus review: ${review.rule}; model opinions do not establish semantic truth.`, `Goal: ${review.goal}`,
    `Source hash: ${review.sourceHash}; review hash: ${review.reviewHash}`, "Three independent employee perspectives:", JSON.stringify(review.perspectives, null, 2),
    "Original proposal:", JSON.stringify(review.proposal, null, 2), "Criteria and verification:", JSON.stringify(review.criteria, null, 2),
    ...review.evidence.flatMap(item => [`Evidence ${item.id}: ${item.title}; SHA256=${item.sha256}`, item.content, `End evidence ${item.id}.`]),
    "Consensus produces advice only. Plan execution remains on hold and requires new approval."];
}

export function projectWorkforceConsensusReport(value: unknown, executionId: string, parentStatus: string): WorkforceConsensusReport {
  const source = record(value, ["version", "executionId", "metadata", "executionStatus", "status", "independentInputsVerified", "evidenceLevel", "semanticTruthVerified", "automaticallyExecutedPlan", "decision", "entries", "receipts", "dispatchCount", "usage", "reportHash"]);
  const { reportHash, ...reportFields } = source;
  if (source.version !== 1 || source.executionId !== executionId || source.executionStatus !== parentStatus
    || !["completed", "failed", "cancelled", "force_stopped"].includes(parentStatus) || reportHash !== hash(reportFields)
    || source.semanticTruthVerified !== false || source.automaticallyExecutedPlan !== false
    || !Number.isSafeInteger(source.dispatchCount) || source.dispatchCount < 0 || source.dispatchCount > 3) invalid();
  const metadata = record(source.metadata, ["version", "agentId", "agentRunId", "planId", "planDigest", "profileHash", "review"]);
  if (metadata.version !== 1 || !/^agt_[A-Za-z0-9_-]{1,128}$/u.test(metadata.agentId) || !/^agr_[A-Za-z0-9_-]{1,128}$/u.test(metadata.agentRunId)
    || !digest(metadata.planDigest, false) || !digest(metadata.profileHash)) invalid();
  identifier(metadata.planId); const review = projectWorkforceConsensusReview(metadata.review);
  const receipts = array(source.receipts, 0, 3).map(value => {
    const item = record(value, ["roleId", "employeeId", "taskId", "receipt"]), binding = review.perspectives.find(binding => binding.roleId === item.roleId);
    if (!binding || binding.employeeId !== item.employeeId) invalid(); identifier(item.taskId);
    receipt(item.receipt, binding); return item;
  });
  if (new Set(receipts.map(item => item.roleId)).size !== receipts.length || receipts.filter(item => item.receipt.providerCallAttempted === true).length > source.dispatchCount) invalid();
  const opinions: Data[] = [], requestIds = new Set<string>(), messageHashes = new Set<string>();
  const entries = array(source.entries, 3, 3);
  entries.forEach((value, index) => {
    const item = record(value, ["roleId", "taskId", "responseText", "responseHash", "errorCode", "inputReceipt", "perspective", "employeeId", "opinion", "contributionStatus"]);
    const binding = review.perspectives[index], observed = receipts.find(receipt => receipt.roleId === binding.roleId);
    if (item.roleId !== binding.roleId || item.perspective !== binding.perspective || item.employeeId !== binding.employeeId
      || item.taskId !== null && !identifier(item.taskId) || !code(item.errorCode) || observed && observed.taskId !== item.taskId) invalid();
    if (item.responseText !== null) {
      if (typeof item.responseText !== "string" || Buffer.byteLength(item.responseText) > 65536 || item.responseHash !== sha(item.responseText)
        || item.errorCode !== null || item.contributionStatus !== "opinion" || !observed || observed.receipt.status !== "succeeded") invalid();
      const parsed = opinion(parseContextJson(item.responseText), review, binding.perspective);
      if (!same(parsed, item.opinion)) invalid(); opinions.push(parsed);
      const proof = record(item.inputReceipt, ["version", "profile", "messageCount", "sourceMessagesHash", "gatewayInputHash", "providerInputHash", "gatewayRequestId"]);
      if (proof.version !== 1 || proof.profile !== "off" || proof.messageCount !== 2 || !digest(proof.sourceMessagesHash)
        || !digest(proof.gatewayInputHash, false) || proof.gatewayInputHash !== proof.providerInputHash
        || proof.gatewayRequestId !== observed.receipt.gatewayRequestId || requestIds.has(proof.gatewayRequestId) || messageHashes.has(proof.sourceMessagesHash)) invalid();
      requestIds.add(proof.gatewayRequestId); messageHashes.add(proof.sourceMessagesHash);
    } else if (item.responseHash !== null || item.inputReceipt !== null || item.opinion !== null
      || item.contributionStatus !== (item.errorCode ? "failed" : "not_observed")) invalid();
  });
  const complete = parentStatus === "completed" && opinions.length === 3 && source.dispatchCount === 3;
  if (source.status !== (complete ? "complete" : "incomplete") || source.independentInputsVerified !== complete
    || source.evidenceLevel !== (receipts.length && receipts.every(item => item.receipt.executionMode === "real") ? "real-model-responses" : "synthetic-or-incomplete-responses")
    || !same(source.decision, decision(review, opinions, parentStatus))) invalid();
  const usage = { source: "gateway-provider-operation-receipts", networkRetryCountKnown: false, costUsd: null,
    inputTokens: totalUsage(receipts, "inputTokens", source.dispatchCount), outputTokens: totalUsage(receipts, "outputTokens", source.dispatchCount) };
  if (!same(source.usage, usage)) invalid();
  return freeze(copy(source)) as WorkforceConsensusReport;
}
function opinion(value: unknown, review: WorkforceConsensusReview, perspective: string): Data {
  const source = record(value, ["version", "perspective", "criteria"]);
  if (source.version !== 1 || source.perspective !== perspective) invalid();
  const seen = new Set<string>(), criteria = array(source.criteria, review.criteria.length, review.criteria.length).map(value => {
    const item = record(value, ["criterionId", "verdict", "support", "reason", "proposedChange"]);
    if (!review.criteria.some(criterion => criterion.id === item.criterionId) || seen.has(item.criterionId)
      || !["supported", "contradicted", "insufficient"].includes(item.verdict)) invalid(); seen.add(item.criterionId);
    const support = array(item.support, item.verdict === "insufficient" ? 0 : 1, 12).map(value => {
      const entry = record(value, ["evidenceId", "quote"]), quote = text(entry.quote, 512, true, true);
      if (Buffer.byteLength(quote) < 8 || !review.evidence.find(evidence => evidence.id === entry.evidenceId)?.content.includes(quote)) invalid();
      return { evidenceId: entry.evidenceId, quote };
    });
    if (item.verdict === "supported" && item.proposedChange !== null || item.verdict !== "supported" && item.proposedChange === null) invalid();
    return { criterionId: item.criterionId, verdict: item.verdict, support, reason: text(item.reason, 1000, false, false, true),
      proposedChange: item.proposedChange === null ? null : text(item.proposedChange, 600, false, false, true) };
  });
  return { version: 1, perspective, criteria: review.criteria.map(criterion => criteria.find(item => item.criterionId === criterion.id)) };
}
function decision(review: WorkforceConsensusReview, opinions: Data[], parentStatus: string): Data {
  const missingPerspectives = PERSPECTIVES.filter(perspective => !opinions.some(item => item.perspective === perspective));
  const criteria = review.criteria.map(criterion => {
    const assessments = opinions.map(item => ({ ...item.criteria.find((row: Data) => row.criterionId === criterion.id), perspective: item.perspective }));
    return { criterionId: criterion.id, disagreement: new Set(assessments.map(item => item.verdict)).size > 1, assessments };
  });
  const requiredRevisions = criteria.flatMap(criterion => criterion.assessments.filter(item => item.verdict !== "supported")
    .map(item => ({ criterionId: criterion.criterionId, perspective: item.perspective, proposedChange: item.proposedChange, reason: item.reason })));
  return { version: 1, rule: RULE, sourceHash: review.sourceHash, reviewHash: review.reviewHash,
    status: parentStatus !== "completed" || missingPerspectives.length ? "incomplete" : requiredRevisions.length ? "revise" : "recommend-proceed",
    missingPerspectives, criteria, proposedPlan: { goal: review.goal, steps: review.proposal, requiredRevisions }, holdExecution: true, requiresNewApproval: true };
}
function receipt(value: unknown, binding: Data): void {
  const item = record(value, ["version", "level", "status", "executionMode", "gatewayRequestId", "providerId", "modelId", "providerCallAttempted", "inputTokens", "outputTokens", "totalTokens", "estimatedCostUsd", "errorCode"]);
  if (item.version !== 1 || item.level !== "gateway-provider-operation" || !["succeeded", "failed", "blocked", "cancelled", "outcome_unknown"].includes(item.status)
    || !["fake", "real", "unknown"].includes(item.executionMode) || ![null, true, false].includes(item.providerCallAttempted)
    || ![item.inputTokens, item.outputTokens, item.totalTokens].every(value => value === null || Number.isSafeInteger(value) && value >= 0)
    || item.estimatedCostUsd !== null || !code(item.errorCode)) invalid();
  [item.gatewayRequestId, item.providerId, item.modelId].forEach(value => { if (value !== null) identifier(value); });
  if (item.status === "succeeded" && (item.providerCallAttempted !== true || item.providerId !== binding.providerId || item.modelId !== binding.modelId
    || item.gatewayRequestId === null || item.errorCode !== null || item.executionMode === "unknown")) invalid();
}
function totalUsage(receipts: Data[], key: string, dispatchCount: number): number | null {
  if (receipts.some(item => item.receipt[key] === null || item.receipt.providerCallAttempted === null)
    || receipts.filter(item => item.receipt.providerCallAttempted === true).length !== dispatchCount) return null;
  const sum = receipts.reduce((count, item) => count + item.receipt[key], 0); return Number.isSafeInteger(sum) ? sum : null;
}
function text(value: unknown, maximum: number, multiline = false, bytes = false, trim = false): string {
  if (typeof value !== "string" || !value.trim() || (bytes ? Buffer.byteLength(value) : value.length) > maximum
    || /[\u007f-\u009f\u200b-\u200f\u202a-\u202e\u2066-\u2069\ufeff]/u.test(value) || !multiline && /[\t\r\n]/u.test(value)
    || !multiline && !trim && value.trim() !== value || SECRET.test(value) || sanitizeOperatorData(value, true) !== value) invalid();
  return trim ? value.trim() : value;
}
function identifier(value: unknown, maximum = 512): string { const result = text(value, maximum); if (!/^[A-Za-z0-9][A-Za-z0-9._:/-]*$/u.test(result)) invalid(); return result; }
function reviewIdentifier(value: unknown): string { const result = identifier(value, 128); if (!/^[A-Za-z0-9][A-Za-z0-9._-]*$/u.test(result)) invalid(); return result; }
function unique<T extends { id: string }>(items: T[]): T[] { if (new Set(items.map(item => item.id)).size !== items.length) invalid(); return items; }
function record(value: unknown, expected?: readonly string[]): Data {
  if (!value || typeof value !== "object" || Array.isArray(value) || ![Object.prototype, null].includes(Object.getPrototypeOf(value))) invalid();
  const keys = Reflect.ownKeys(value); if (keys.length > 128 || keys.some(key => typeof key !== "string" || FORBIDDEN.has(key))
    || expected && (keys.length !== expected.length || expected.some(key => !Object.hasOwn(value, key)))) invalid();
  return Object.fromEntries(keys.map(key => { const property = Object.getOwnPropertyDescriptor(value, key);
    if (!property || !("value" in property) || !property.enumerable) invalid(); return [key, property.value]; }));
}
function array(value: unknown, minimum: number, maximum: number): any[] {
  if (!Array.isArray(value) || Object.getPrototypeOf(value) !== Array.prototype || value.length < minimum || value.length > maximum || Reflect.ownKeys(value).length !== value.length + 1) invalid();
  return Array.from({ length: value.length }, (_, index) => { const field = Object.getOwnPropertyDescriptor(value, String(index)); if (!field || !("value" in field)) invalid(); return field.value; });
}
function stable(value: any, depth = 0): string {
  if (depth > 24) invalid();
  if (value === null || typeof value === "string" || typeof value === "boolean" || typeof value === "number" && Number.isFinite(value)) return JSON.stringify(value);
  if (Array.isArray(value)) return `[${array(value, 0, 128).map(item => stable(item, depth + 1)).join(",")}]`;
  const source = record(value); return `{${Object.keys(source).sort().map(key => `${JSON.stringify(key)}:${stable(source[key], depth + 1)}`).join(",")}}`;
}
function copy(value: any): any { return JSON.parse(stable(value)); }
function freeze<T>(value: T): T { if (value && typeof value === "object") { Object.values(value).forEach(freeze); Object.freeze(value); } return value; }
