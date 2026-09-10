import { createHash } from "node:crypto";
import { stableStringify } from "@unified-ai-system/policy-engine";
import { normalizeProfileArguments, normalizeProfileParameters, runtimeProfileHash } from "@unified-ai-system/taiji-beidou-engine";
import { taijiStateError } from "./taijiCapabilityState.ts";
import type { TaijiCandidate, TaijiCapability, TaijiOwner, TaijiRun, TaijiState } from "./taijiCapabilityState.ts";

type Data = Record<string, unknown>;
const hash = (value: unknown) => `sha256:${createHash("sha256").update(stableStringify(value), "utf8").digest("hex")}`;
const qualityFailures = new Set(["TAIJI_VERIFICATION_FAILED", "TAIJI_FACT_RECOVERY_FAILED", "TAIJI_RUNTIME_TIMEOUT"]);
export type TaijiSelection = { profileId: string; selectedCapabilityId: string; candidates: Array<{
  capabilityId: string; revision: number; lifecycleRevision: number; activationEpoch: number; candidateHash: string; weight: number;
}>; selectionHash: string };

export function selectTaijiCapability(state: TaijiState, owner: TaijiOwner, profileId: string, verificationIsCurrent: (candidate: TaijiCandidate) => boolean): TaijiSelection {
  const implementationHash = runtimeProfileHash(profileId as Parameters<typeof runtimeProfileHash>[0]);
  const candidates: TaijiSelection["candidates"] = [];
  for (const capability of Object.values(state.capabilities)) {
    if (hash(capability.owner) !== hash(owner)) continue;
    const activation = capability.activation, version = capability.versions.find(item => item.revision === activation?.revision);
    if (!activation || !version || version.status !== "evaluated" || version.profileId !== profileId || version.implementationHash !== implementationHash
      || !version.evaluation?.passed || !verificationIsCurrent(version) || activation.expiresAt <= Date.now() || activation.runningId
      || activation.requests >= activation.maxRequests || activation.elapsedMs >= activation.maxRuntimeMs || version.weight <= 0) continue;
    candidates.push({ capabilityId: capability.id, revision: version.revision, lifecycleRevision: capability.lifecycleRevision,
      activationEpoch: activation.epoch, candidateHash: version.candidateHash, weight: version.weight });
  }
  candidates.sort((a, b) => b.weight - a.weight || (a.capabilityId < b.capabilityId ? -1 : a.capabilityId > b.capabilityId ? 1 : 0));
  if (!candidates.length) throw taijiStateError("SELECTION_UNAVAILABLE", "No current verified active capability has capacity for this profile.");
  return { profileId, selectedCapabilityId: candidates[0].capabilityId, candidates, selectionHash: hash({ profileId, candidates }) };
}

export function readTaijiFeedbackRun(state: TaijiState, owner: TaijiOwner, capability: TaijiCapability, revision: number, runId: unknown): TaijiRun {
  if (typeof runId !== "string") throw taijiStateError("FEEDBACK_INVALID", "A recorded run ID is required.", 400);
  const run = state.runs[hash([owner, runId])];
  if (!run || run.capabilityId !== capability.id || run.revision !== revision || hash(run.owner) !== hash(owner)
    || run.result?.actualExecution !== true || run.result?.workerClosed !== true
    || run.status !== "passed" && !(run.status === "failed" && qualityFailures.has(run.result?.blockedReason as string))) {
    throw taijiStateError("FEEDBACK_UNVERIFIED", "Feedback must reference an owned, terminal, executed quality result; cancellation and unknown outcomes are not quality evidence.");
  }
  return run;
}
export function feedbackSummary(run: TaijiRun) { return { runId: run.id, status: run.status,
  resultHash: hash(run.result), argumentsHash: run.argumentsHash, code: run.result?.blockedReason ?? null }; }
export function proposedTaijiWeight(version: TaijiCandidate, run: TaijiRun): number {
  if ((version.feedback ?? []).some(item => item.operation === "reweight" && item.runId === run.id)) throw taijiStateError("FEEDBACK_ALREADY_USED", "This result has already changed this version's weight.");
  const proposed = Math.round((run.status === "passed" ? Math.min(0.8, version.weight + 0.1) : Math.max(0, version.weight - 0.25)) * 100) / 100;
  if (proposed === version.weight) throw taijiStateError("WEIGHT_UNCHANGED", "This feedback does not change the bounded runtime weight.");
  return proposed;
}
export function proposeTaijiRepair(capability: TaijiCapability, version: TaijiCandidate, run: TaijiRun, argsValue: unknown, additionsValue: unknown) {
  if (version.profileId !== "risk-classification-v1" || run.status !== "failed" || run.result?.blockedReason !== "TAIJI_VERIFICATION_FAILED") {
    throw taijiStateError("REPAIR_UNSUPPORTED", "Automatic candidate repair currently supports missed keyword classifications with an unchanged expected result.");
  }
  const args = normalizeProfileArguments("risk-classification-v1", argsValue);
  if (hash(args) !== run.argumentsHash || !Array.isArray(args.expectedSignals) || !args.expectedSignals.length) throw taijiStateError("REGRESSION_CHANGED", "Repair must retain the exact failed input and expected signals.");
  const additions = normalizeProfileParameters("risk-classification-v1", { additionalRiskKeywords: additionsValue });
  const previous = normalizeProfileParameters("risk-classification-v1", version.parameters);
  const mapping = { ...(previous.additionalRiskKeywords ?? {}) };
  for (const [signal, keywords] of Object.entries(additions.additionalRiskKeywords ?? {})) {
    if (!args.expectedSignals.includes(signal) || keywords.some(keyword => !(args.text as string).toLowerCase().includes(keyword))) {
      throw taijiStateError("REPAIR_SCOPE_INVALID", "Every added keyword must explain the original missed expected signal.");
    }
    mapping[signal] = [...new Set([...(mapping[signal] ?? []), ...keywords])];
  }
  const parameters = normalizeProfileParameters("risk-classification-v1", { additionalRiskKeywords: mapping });
  const attempts = capability.versions.filter(item => item.regression?.runId === run.id);
  if (attempts.length >= 3) throw taijiStateError("REPAIR_LIMIT", "This failure has reached its three-candidate repair limit.");
  if (hash(parameters) === hash(previous) || attempts.some(item => hash(item.parameters) === hash(parameters))) throw taijiStateError("REPAIR_UNCHANGED", "Repair must propose a new, bounded parameter change.");
  return { parameters, regression: { runId: run.id, arguments: args as Data, argumentsHash: run.argumentsHash, resultHash: hash(run.result) } };
}
