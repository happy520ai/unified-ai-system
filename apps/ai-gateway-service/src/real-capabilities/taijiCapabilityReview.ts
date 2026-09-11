import { createHash } from "node:crypto";
import { stableStringify } from "@unified-ai-system/policy-engine";
import { compileNaturalLanguageCapability, normalizeProfileArguments, normalizeProfileParameters } from "@unified-ai-system/taiji-beidou-engine";
import type { AgentToolApprovalReview } from "@unified-ai-system/shared-contracts";
import { containsSensitivePublicationText } from "../security/secretSafety.js";

export const taijiCapabilityEffects = {
  evaluate: "Run fixed local verification cases and save a candidate version",
  activate: "Activate this exact evaluated version within the reviewed limits",
  execute: "Execute this exact input using the approved active local adapter",
  repair: "Evaluate an additive candidate repair against the unchanged recorded failure and fixed calibration cases",
  reweight: "Update actual capability selection weight using the referenced executed feedback once",
  prune: "Disable this low-weight version using verified failure evidence while retaining its history",
} as const;
type Data = Record<string, unknown>;
const hash = (value: unknown) => `sha256:${createHash("sha256").update(stableStringify(value), "utf8").digest("hex")}`;
const isHash = (value: unknown) => typeof value === "string" && /^sha256:[a-f0-9]{64}$/.test(value);
const bounded = (value: unknown, max: number, min = 1) => Number.isSafeInteger(value) && (value as number) >= min && (value as number) <= max;

export function readTaijiApprovalReview(value: unknown): AgentToolApprovalReview {
  const review = object(value); exact(review, ["schemaVersion", "reviewable", "effectType", "policyHash", "taiji"]);
  const taiji = object(review.taiji); exact(taiji, ["operation", "params", "paramsHash", "effect"]);
  const operation = taiji.operation as keyof typeof taijiCapabilityEffects;
  if (review.schemaVersion !== 1 || review.reviewable !== true || review.effectType !== "taiji:capability" || !isHash(review.policyHash)
    || !Object.hasOwn(taijiCapabilityEffects, operation) || taiji.effect !== taijiCapabilityEffects[operation]) throw invalid();
  const params = object(taiji.params);
  const common = ["operation", "capabilityId", "lifecycleRevision", "revision", "profileId", "implementationHash", "ownerHash", "authorityEpoch", "parameters"];
  exact(params, [...common, ...(operation === "evaluate" ? ["request", "compiledSpec", "suiteHash"]
    : operation === "repair" ? ["request", "compiledSpec", "suiteHash", "baseRevision", "regression", "addRiskKeywords", "feedback"]
      : operation === "reweight" || operation === "prune" ? ["candidateHash", "feedback", "previousWeight", "proposedWeight"]
    : operation === "activate" ? ["candidateHash", "evaluationHash", "limits"]
      : ["candidateHash", "activationEpoch", "runId", "arguments", "argumentsHash"])], operation === "execute" ? ["selection"] : []);
  if (params.operation !== operation || typeof params.capabilityId !== "string" || !/^[A-Za-z0-9][A-Za-z0-9_.:-]{0,127}$/.test(params.capabilityId)
    || !bounded(params.lifecycleRevision, Number.MAX_SAFE_INTEGER, 0) || !bounded(params.revision, 20)
    || !["risk-classification-v1", "context-jsonl-v1", "evidence-summary-v1"].includes(params.profileId as string)
    || !isHash(params.implementationHash) || !isHash(params.ownerHash) || typeof params.authorityEpoch !== "string"
    || !/^[a-f0-9-]{36}$/.test(params.authorityEpoch) || taiji.paramsHash !== hash(params)) throw invalid();
  if (stableStringify(params.parameters) !== stableStringify(normalizeProfileParameters(params.profileId as Parameters<typeof normalizeProfileParameters>[0], params.parameters))) throw invalid();
  if (operation === "evaluate" || operation === "repair") {
    if (typeof params.request !== "string" || !params.request.trim() || Buffer.byteLength(params.request) > 4000
      || /[\u0000-\u001f\u007f]/u.test(params.request) || !isHash(params.suiteHash)
      || stableStringify(params.compiledSpec) !== stableStringify(compileNaturalLanguageCapability(params.request, { capabilityId: params.capabilityId }))) throw invalid();
    if (operation === "repair") {
      const regression = object(params.regression); exact(regression, ["runId", "arguments", "argumentsHash", "resultHash"]);
      const feedback = readFeedback(params.feedback);
      if (params.profileId !== "risk-classification-v1" || !bounded(params.baseRevision, 20) || (params.baseRevision as number) >= (params.revision as number)
        || feedback.status !== "failed" || feedback.code !== "TAIJI_VERIFICATION_FAILED"
        || regression.runId !== feedback.runId || regression.resultHash !== feedback.resultHash
        || regression.argumentsHash !== feedback.argumentsHash || regression.argumentsHash !== hash(regression.arguments)
        || stableStringify(regression.arguments) !== stableStringify(normalizeProfileArguments("risk-classification-v1", regression.arguments))) throw invalid();
      normalizeProfileParameters("risk-classification-v1", { additionalRiskKeywords: params.addRiskKeywords });
    }
  } else if (operation === "reweight" || operation === "prune") {
    const feedback = readFeedback(params.feedback), previous = params.previousWeight, proposed = params.proposedWeight;
    if (!isHash(params.candidateHash) || typeof previous !== "number" || previous < 0 || previous > 1
      || typeof proposed !== "number" || proposed < 0 || proposed > 1 || !Number.isFinite(previous) || !Number.isFinite(proposed)) throw invalid();
    if (operation === "prune" ? previous >= 0.2 || feedback.status !== "failed" || proposed !== 0
      : proposed !== Math.round((feedback.status === "passed" ? Math.min(0.8, previous + 0.1) : Math.max(0, previous - 0.25)) * 100) / 100) throw invalid();
  } else if (operation === "activate") {
    const limits = object(params.limits); exact(limits, ["ttlSeconds", "maxRequests", "maxRuntimeMs"]);
    if (!isHash(params.candidateHash) || !isHash(params.evaluationHash) || !bounded(limits.ttlSeconds, 300)
      || !bounded(limits.maxRequests, 3) || !bounded(limits.maxRuntimeMs, 30_000)) throw invalid();
  } else {
    if (!isHash(params.candidateHash) || !bounded(params.activationEpoch, Number.MAX_SAFE_INTEGER)
      || typeof params.runId !== "string" || !/^[A-Za-z0-9][A-Za-z0-9_.:-]{0,127}$/.test(params.runId)
      || params.argumentsHash !== hash(params.arguments)
      || stableStringify(params.arguments) !== stableStringify(normalizeProfileArguments(params.profileId as Parameters<typeof normalizeProfileArguments>[0], params.arguments))) throw invalid();
    if (params.selection !== undefined) {
      const selection = object(params.selection); exact(selection, ["profileId", "selectedCapabilityId", "candidates", "selectionHash"]);
      if (selection.profileId !== params.profileId || selection.selectedCapabilityId !== params.capabilityId
        || !Array.isArray(selection.candidates) || !selection.candidates.length || selection.candidates.length > 100
        || selection.selectionHash !== hash({ profileId: selection.profileId, candidates: selection.candidates })) throw invalid();
      const first = object(selection.candidates[0]);
      if (first.capabilityId !== params.capabilityId || first.revision !== params.revision || first.activationEpoch !== params.activationEpoch) throw invalid();
      for (const value of selection.candidates) {
        const candidate = object(value); exact(candidate, ["capabilityId", "revision", "lifecycleRevision", "activationEpoch", "candidateHash", "weight"]);
        if (typeof candidate.capabilityId !== "string" || !/^[A-Za-z0-9][A-Za-z0-9_.:-]{0,127}$/.test(candidate.capabilityId)
          || !bounded(candidate.revision, 20) || !bounded(candidate.lifecycleRevision, Number.MAX_SAFE_INTEGER)
          || !bounded(candidate.activationEpoch, Number.MAX_SAFE_INTEGER) || !isHash(candidate.candidateHash)
          || typeof candidate.weight !== "number" || !Number.isFinite(candidate.weight) || candidate.weight <= 0 || candidate.weight > 1) throw invalid();
      }
    }
  }
  const serialized = stableStringify(review);
  if (Buffer.byteLength(serialized) > 80_000 || containsSensitivePublicationText(serialized)) throw invalid();
  return JSON.parse(serialized) as AgentToolApprovalReview;
}

export function assertTaijiReviewArguments(review: AgentToolApprovalReview, args: unknown, toolName: string): void {
  const normalized = readTaijiApprovalReview(review);
  if (toolName !== "taiji_capability" || stableStringify(args) !== stableStringify(normalized.taiji?.params)) throw invalid();
}
function object(value: unknown): Data {
  if (!value || typeof value !== "object" || Array.isArray(value)
    || (Object.getPrototypeOf(value) !== Object.prototype && Object.getPrototypeOf(value) !== null)
    || Object.values(Object.getOwnPropertyDescriptors(value)).some(item => !("value" in item))) throw invalid();
  return value as Data;
}
function exact(value: Data, keys: string[], optional: string[] = []) { if (Object.keys(value).some(key => !keys.includes(key) && !optional.includes(key)) || keys.some(key => !Object.hasOwn(value, key))) throw invalid(); }
function readFeedback(value: unknown): Data {
  const feedback = object(value); exact(feedback, ["runId", "status", "resultHash", "argumentsHash", "code"]);
  if (typeof feedback.runId !== "string" || !/^[A-Za-z0-9][A-Za-z0-9_.:-]{0,127}$/.test(feedback.runId)
    || !["passed", "failed"].includes(feedback.status as string) || !isHash(feedback.resultHash) || !isHash(feedback.argumentsHash)
    || feedback.status === "failed" && !["TAIJI_VERIFICATION_FAILED", "TAIJI_FACT_RECOVERY_FAILED", "TAIJI_RUNTIME_TIMEOUT"].includes(feedback.code as string)) throw invalid();
  return feedback;
}
function invalid() { return Object.assign(new Error("Taiji approval review is incomplete or no longer matches its exact parameters."), { code: "TAIJI_APPROVAL_INVALID" }); }
