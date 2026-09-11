import { createHash } from "node:crypto";
import { performance } from "node:perf_hooks";
import { stableStringify } from "@unified-ai-system/policy-engine";
import { compileNaturalLanguageCapability, describeRuntimeProfiles, executeSandboxAutoRuntime,
  normalizeProfileArguments, normalizeProfileParameters, runtimeProfileHash } from "@unified-ai-system/taiji-beidou-engine";
import { containsSensitivePublicationText } from "../security/secretSafety.js";
import { TaijiCapabilityStateStore, taijiStateError } from "./taijiCapabilityState.ts";
import type { TaijiCandidate, TaijiCapability, TaijiEvaluation, TaijiOwner, TaijiRun, TaijiState } from "./taijiCapabilityState.ts";
import { feedbackSummary, proposedTaijiWeight, proposeTaijiRepair, readTaijiFeedbackRun, selectTaijiCapability } from "./taijiCapabilityFeedback.ts";
import type { TaijiSelection } from "./taijiCapabilityFeedback.ts";
import { taijiCapabilityEffects } from "./taijiCapabilityReview.ts";

type Data = Record<string, unknown>;
export type TaijiOperation = "evaluate" | "activate" | "execute" | "repair" | "reweight" | "prune";
type Operation = TaijiOperation;
export type PreparedTaijiOperation = { params: Data; review: Data; replay?: TaijiRun };
export type TaijiExecutionAuthority = {
  policyHash: string; approvalId: string; signal: AbortSignal;
  assertActive: () => Promise<unknown>;
};
const ID = /^[A-Za-z0-9][A-Za-z0-9_.:-]{0,127}$/;
const HASH = /^sha256:[a-f0-9]{64}$/;

export function taijiDigest(value: unknown): string { return `sha256:${createHash("sha256").update(stableStringify(value), "utf8").digest("hex")}`; }
export function normalizeTaijiOwner(value: TaijiOwner): TaijiOwner {
  if (!value || [value.tenantId, value.userId, value.agentId].some(item => typeof item !== "string" || item.trim() !== item
    || !item || Buffer.byteLength(item) > 256 || /[\u0000-\u0020\u007f]/u.test(item))) throw failure("IDENTITY_REQUIRED", "A complete authenticated Agent owner is required.", 403);
  return { tenantId: value.tenantId, userId: value.userId, agentId: value.agentId };
}

export function createTaijiCapabilityService(options: { dataDir: string; secret: string; enabled: () => boolean }) {
  const preparedObjects = new WeakMap<object, { owner: TaijiOwner; operation: Operation; params: Data }>();
  const store = new TaijiCapabilityStateStore(options);
  const controllers = new Map<string, { controller: AbortController; revision: number; epoch?: number }>();
  const pending = new Set<Promise<unknown>>();
  let closed = false;
  const active = () => !closed && options.enabled();
  const keyFor = (owner: TaijiOwner, id: string) => taijiDigest([owner, id]);
  const assertEnabled = () => { if (!active()) throw failure("RUNTIME_DISABLED", "Taiji runtime is disabled; preview remains available.", 503); };

  async function status(ownerValue: TaijiOwner) {
    const owner = normalizeTaijiOwner(ownerValue), state = await store.snapshot();
    return { enabled: active(), storageMode: "single-process-signed-json", restartRequiresApproval: true,
      profiles: describeRuntimeProfiles(), capabilities: Object.values(state.capabilities).filter(item => sameOwner(item.owner, owner)),
      runs: Object.values(state.runs).filter(item => sameOwner(item.owner, owner)).map(run => ({ ...run, result: safeRunResult(run.result) })) };
  }

  async function prepare(operation: Operation, value: unknown, ownerValue: TaijiOwner): Promise<PreparedTaijiOperation> {
    assertEnabled();
    const owner = normalizeTaijiOwner(ownerValue), state = await store.snapshot();
    let input = data(value), selection: TaijiSelection | undefined;
    if (operation === "execute" && input.selection !== undefined) {
      keys(input, ["selection", "runId", "arguments"]); const requested = data(input.selection); keys(requested, ["profileId"]);
      selection = selectTaijiCapability(state, owner, profile(requested.profileId), currentEvaluation);
      const target = selection.candidates[0];
      input = { capabilityId: target.capabilityId, revision: target.revision, expectedLifecycleRevision: target.lifecycleRevision,
        runId: input.runId, arguments: input.arguments };
    }
    const id = identifier(input.capabilityId);
    const capability = state.capabilities[keyFor(owner, id)];
    const lifecycleRevision = capability?.lifecycleRevision ?? 0;
    if (input.expectedLifecycleRevision !== lifecycleRevision) throw failure("REVISION_CONFLICT", "Read the current capability state before preparing this operation.");
    let params: Data;
    if (operation === "evaluate") {
      keys(input, ["capabilityId", "expectedLifecycleRevision", "request", "profileId"], ["parameters"]);
      const profileId = profile(input.profileId), request = safeText(input.request, 4000);
      if ((capability?.versions.length ?? 0) >= 20) throw failure("VERSION_CAPACITY", "Capability version capacity is exhausted.", 503);
      const revision = (capability?.versions.at(-1)?.revision ?? 0) + 1;
      const spec = compileNaturalLanguageCapability(request, { capabilityId: id });
      params = { operation, capabilityId: id, lifecycleRevision, revision, request, profileId,
        implementationHash: runtimeProfileHash(profileId), compiledSpec: spec, parameters: normalizeProfileParameters(profileId, input.parameters),
        suiteHash: taijiDigest(evaluationCases(profileId)) };
    } else {
      const version = candidate(capability, input.revision);
      if (["activate", "execute"].includes(operation) && (version.status !== "evaluated" || version.evaluation?.passed !== true
        || version.evaluation.suiteHash !== taijiDigest(evaluationCases(profile(version.profileId), version.regression))
        || version.implementationHash !== runtimeProfileHash(profile(version.profileId)))) throw failure("CANDIDATE_NOT_VERIFIED", "A current, evaluated, non-revoked candidate is required.");
      if (operation === "repair") {
        keys(input, ["capabilityId", "expectedLifecycleRevision", "revision", "sourceRunId", "sourceArguments", "addRiskKeywords"]);
        if (capability!.versions.length >= 20) throw failure("VERSION_CAPACITY", "Capability version capacity is exhausted.", 503);
        const source = readTaijiFeedbackRun(state, owner, capability!, version.revision, input.sourceRunId);
        const repair = proposeTaijiRepair(capability!, version, source, input.sourceArguments, input.addRiskKeywords);
        const revision = capability!.versions.at(-1)!.revision + 1;
        params = { operation, capabilityId: id, lifecycleRevision, revision, baseRevision: version.revision,
          request: version.request, profileId: version.profileId, implementationHash: runtimeProfileHash(profile(version.profileId)),
          compiledSpec: compileNaturalLanguageCapability(version.request, { capabilityId: id }), ...repair,
          addRiskKeywords: normalizeProfileParameters("risk-classification-v1", { additionalRiskKeywords: input.addRiskKeywords }).additionalRiskKeywords,
          feedback: feedbackSummary(source), suiteHash: taijiDigest(evaluationCases(profile(version.profileId), repair.regression)) };
      } else if (operation === "reweight" || operation === "prune") {
        keys(input, ["capabilityId", "expectedLifecycleRevision", "revision", "sourceRunId"]);
        if (version.status !== "evaluated") throw failure("CANDIDATE_NOT_VERIFIED", "Only an evaluated non-revoked version can receive feedback.");
        const source = readTaijiFeedbackRun(state, owner, capability!, version.revision, input.sourceRunId);
        if (operation === "prune" && (version.weight >= 0.2 || source.status !== "failed")) throw failure("PRUNE_NOT_ELIGIBLE", "Pruning requires a verified failure and runtime weight below 0.2.");
        params = { operation, capabilityId: id, lifecycleRevision, revision: version.revision, candidateHash: version.candidateHash,
          profileId: version.profileId, implementationHash: version.implementationHash, parameters: version.parameters,
          feedback: feedbackSummary(source), previousWeight: version.weight,
          proposedWeight: operation === "reweight" ? proposedTaijiWeight(version, source) : 0 };
      } else if (operation === "activate") {
        keys(input, ["capabilityId", "expectedLifecycleRevision", "revision"], ["limits"]);
        const limits = activationLimits(input.limits);
        params = { operation, capabilityId: id, lifecycleRevision, revision: version.revision, candidateHash: version.candidateHash,
          profileId: version.profileId, implementationHash: version.implementationHash, parameters: version.parameters, evaluationHash: taijiDigest(version.evaluation), limits };
      } else {
        keys(input, ["capabilityId", "expectedLifecycleRevision", "revision", "runId", "arguments"]);
        const activation = currentActivation(capability!, version.revision);
        const args = normalizeProfileArguments(profile(version.profileId), input.arguments);
        rejectSensitive(args);
        const runId = identifier(input.runId);
        params = { operation, capabilityId: id, lifecycleRevision, revision: version.revision, candidateHash: version.candidateHash,
          profileId: version.profileId, implementationHash: version.implementationHash, parameters: version.parameters, activationEpoch: activation.epoch,
          runId, arguments: args, argumentsHash: taijiDigest(args), ...(selection ? { selection } : {}) };
        const previous = state.runs[keyFor(owner, runId)];
        if (previous) {
          if (previous.capabilityId !== id || previous.revision !== version.revision || previous.argumentsHash !== params.argumentsHash
            || previous.activationEpoch !== activation.epoch) throw failure("RUN_CONFLICT", "This run ID is already bound to another execution.");
          return { params, review: {}, replay: { ...previous, result: safeRunResult(previous.result) } };
        }
      }
    }
    rejectSensitive(params);
    const frozenParams = JSON.parse(stableStringify({ ...params, ownerHash: taijiDigest(owner), authorityEpoch: state.ownerEpoch })) as Data;
    const review = { schemaVersion: 1, reviewable: true, effectType: "taiji:capability", policyHash: "pending",
      taiji: { operation, params: frozenParams, paramsHash: taijiDigest(frozenParams),
        effect: taijiCapabilityEffects[operation] } };
    const prepared = Object.freeze({ params: frozenParams, review });
    preparedObjects.set(prepared, { owner, operation, params: structuredClone(frozenParams) });
    return prepared;
  }

  async function execute(prepared: PreparedTaijiOperation, authority: TaijiExecutionAuthority) {
    const binding = preparedObjects.get(prepared);
    if (!binding || taijiDigest(prepared.params) !== taijiDigest(binding.params) || !authority || !HASH.test(authority.policyHash)
      || typeof authority.approvalId !== "string" || !authority.approvalId || !authority.signal || typeof authority.assertActive !== "function") throw failure("EXECUTION_AUTHORITY_REQUIRED", "A prepared operation and consumed approval are required.", 403);
    preparedObjects.delete(prepared);
    const work = executeBound(binding, authority); pending.add(work);
    try { return await work; } finally { pending.delete(work); }
  }

  async function executeBound(binding: { owner: TaijiOwner; operation: Operation; params: Data }, authority: TaijiExecutionAuthority) {
    assertEnabled(); await authority.assertActive(); if (authority.signal.aborted) throw failure("CANCELLED", "Capability operation was cancelled.");
    const { owner, operation, params } = binding, capabilityKey = keyFor(owner, params.capabilityId as string);
    if (params.implementationHash !== runtimeProfileHash(profile(params.profileId))) throw failure("IMPLEMENTATION_CHANGED", "Capability implementation changed after review.");
    if (operation === "reweight" || operation === "prune") {
      const changed = await store.update(state => {
        const capability = state.capabilities[capabilityKey]; assertRevision(capability, params.lifecycleRevision);
        const version = candidate(capability, params.revision);
        const source = readTaijiFeedbackRun(state, owner, capability, version.revision, (params.feedback as Data).runId);
        if (version.status !== "evaluated" || version.candidateHash !== params.candidateHash || version.weight !== params.previousWeight
          || taijiDigest(feedbackSummary(source)) !== taijiDigest(params.feedback)) throw failure("FEEDBACK_CHANGED", "The reviewed feedback or version changed.");
        if (operation === "reweight" && proposedTaijiWeight(version, source) !== params.proposedWeight) throw failure("FEEDBACK_CHANGED", "The weight proposal changed.");
        if (operation === "prune" && (version.weight >= 0.2 || source.status !== "failed")) throw failure("PRUNE_NOT_ELIGIBLE", "The version is no longer eligible for pruning.");
        version.weight = params.proposedWeight as number;
        version.feedback.push({ operation, runId: source.id });
        if (operation === "prune") { version.status = "revoked"; if (capability.activation?.revision === version.revision) capability.activation = null; }
        capability.lifecycleRevision++; history(capability, operation, `Recorded ${source.status} result ${source.id}; weight=${version.weight}.`);
        return capability;
      });
      if (operation === "prune") abortCapability(capabilityKey, { revision: params.revision as number });
      return { status: operation === "prune" ? "pruned" : "reweighted", capability: changed, stateCommitted: true, realLocalExecution: false };
    }
    if (operation === "evaluate" || operation === "repair") {
      const record = await store.update(state => {
        const existing = state.capabilities[capabilityKey]; assertRevision(existing, params.lifecycleRevision);
        if (!existing && Object.keys(state.capabilities).length >= 100) throw failure("CAPACITY", "Capability capacity is exhausted.", 503);
        const capability: TaijiCapability = existing ?? { id: params.capabilityId as string, owner, lifecycleRevision: 0, versions: [], activation: null,
          totalRequests: 0, totalElapsedMs: 0, history: [] };
        if (params.revision !== (capability.versions.at(-1)?.revision ?? 0) + 1) throw failure("REVISION_CONFLICT", "Candidate version changed after review.");
        if (operation === "repair") {
          const base = candidate(capability, params.baseRevision), source = readTaijiFeedbackRun(state, owner, capability, base.revision, (params.feedback as Data).runId);
          const repair = proposeTaijiRepair(capability, base, source, (params.regression as Data).arguments, params.addRiskKeywords);
          if (taijiDigest(repair) !== taijiDigest({ parameters: params.parameters, regression: params.regression })
            || taijiDigest(feedbackSummary(source)) !== taijiDigest(params.feedback)) throw failure("FEEDBACK_CHANGED", "Repair no longer matches its original recorded failure.");
          base.feedback.push({ operation: "repair", runId: source.id });
        }
        const version: TaijiCandidate = { revision: params.revision as number, request: params.request as string, profileId: params.profileId as string,
          implementationHash: params.implementationHash as string, candidateHash: taijiDigest(params), status: "evaluating", evaluation: null, createdAt: new Date().toISOString(),
          parameters: normalizeProfileParameters(profile(params.profileId), params.parameters), weight: 0.5, feedback: [],
          regression: operation === "repair" ? structuredClone(params.regression) as TaijiCandidate["regression"] : null };
        capability.versions.push(version); capability.lifecycleRevision++;
        history(capability, operation, "Candidate evaluation started; this does not activate it.");
        state.capabilities[capabilityKey] = capability;
        return version;
      });
      const controller = new AbortController(), operationKey = `${capabilityKey}:${record.revision}`;
      controllers.set(operationKey, { controller, revision: record.revision });
      const signal = AbortSignal.any([authority.signal, controller.signal]);
      const evaluation: TaijiEvaluation = { suiteHash: params.suiteHash as string, passed: false, tests: [] };
      const began = performance.now();
      try {
        for (const fixture of evaluationCases(profile(record.profileId), record.regression)) {
          const remaining = Math.floor(30_000 - (performance.now() - began));
          if (remaining < 1) throw failure("RUNTIME_TIMEOUT", "Candidate evaluation exceeded its fixed local budget.");
          const result = await executeSandboxAutoRuntime({ capability: { capabilityId: params.capabilityId, profileId: record.profileId, implementationHash: record.implementationHash, parameters: record.parameters },
            lease: localLease(params.capabilityId as string, remaining), arguments: fixture.arguments }, {
            enabled: active, signal, assertActive: async () => {
              await authority.assertActive();
              const current = candidate((await store.snapshot()).capabilities[capabilityKey], record.revision);
              if (current.status !== "evaluating" || current.candidateHash !== record.candidateHash) throw failure("REVOKED", "Candidate evaluation is no longer authorized.");
            },
          });
          evaluation.tests.push({ id: fixture.id, status: result.executionStatus, code: result.blockedReason,
            artifactHash: result.artifact?.sha256 ?? null, durationMs: result.durationMs, workerClosed: result.workerClosed, actualExecution: result.actualExecution });
          if (result.executionStatus !== "passed" || !result.actualExecution || !result.workerClosed) break;
        }
        await authority.assertActive();
        evaluation.passed = !signal.aborted && active() && evaluation.tests.length === evaluationCases(profile(record.profileId), record.regression).length
          && evaluation.tests.every(test => test.status === "passed" && test.workerClosed && test.artifactHash !== null);
      } catch (error) {
        evaluation.tests.push({ id: "execution-boundary", status: "failed", code: errorCode(error), artifactHash: null, durationMs: performance.now() - began, workerClosed: true, actualExecution: false });
      } finally { controllers.delete(operationKey); }
      return store.update(state => {
        const capability = state.capabilities[capabilityKey], version = candidate(capability, record.revision);
        version.evaluation = evaluation;
        if (version.status === "evaluating") version.status = evaluation.passed ? "evaluated" : "failed";
        else evaluation.passed = false;
        history(capability, "evaluation-finished", version.status);
        return { status: version.status, capability: capability, stateCommitted: true, realLocalExecution: evaluation.tests.some(test => test.actualExecution), activated: false };
      });
    }
    if (operation === "activate") {
      const result = await store.update(state => {
        const capability = state.capabilities[capabilityKey]; assertRevision(capability, params.lifecycleRevision);
        const version = candidate(capability, params.revision);
        if (version.status !== "evaluated" || version.candidateHash !== params.candidateHash || version.evaluation?.passed !== true
          || taijiDigest(version.evaluation) !== params.evaluationHash) throw failure("CANDIDATE_NOT_VERIFIED", "Evaluation changed after approval.");
        const limits = activationLimits(params.limits);
        capability.lifecycleRevision++;
        capability.activation = { revision: version.revision, epoch: capability.lifecycleRevision, policyHash: authority.policyHash,
          approvalId: authority.approvalId, expiresAt: Date.now() + limits.ttlSeconds * 1000, maxRequests: limits.maxRequests,
          maxRuntimeMs: limits.maxRuntimeMs, requests: 0, elapsedMs: 0, runningId: null };
        history(capability, "activate", `Explicit approval ${authority.approvalId}; cumulative usage is retained.`);
        return capability;
      });
      abortCapability(capabilityKey, { oldEpochsBefore: result.activation!.epoch });
      return { status: "active", capability: result, stateCommitted: true, realLocalExecution: false };
    }
    const runKey = keyFor(owner, params.runId as string);
    const claim = await store.update(state => {
      const capability = state.capabilities[capabilityKey]; assertRevision(capability, params.lifecycleRevision);
      if (params.selection) {
        const current = selectTaijiCapability(state, owner, (params.selection as Data).profileId as string, currentEvaluation);
        if (taijiDigest(current) !== taijiDigest(params.selection)) throw failure("SELECTION_CHANGED", "Candidate eligibility or weights changed after review; inspect and approve the current selection.");
      }
      const version = candidate(capability, params.revision), activation = currentActivation(capability, version.revision);
      if (activation.policyHash !== authority.policyHash || activation.epoch !== params.activationEpoch || version.candidateHash !== params.candidateHash) throw failure("ACTIVATION_CHANGED", "Activation or policy changed; fresh review is required.");
      if (state.runs[runKey]) throw failure("RUN_CONFLICT", "Run already exists; inspect it instead of repeating the effect.");
      if (activation.runningId) throw failure("BUSY", "This capability already has an active execution.");
      if (activation.requests >= activation.maxRequests || activation.elapsedMs >= activation.maxRuntimeMs) throw failure("BUDGET_EXHAUSTED", "Activation budget is exhausted; review a new activation explicitly.");
      if (Object.keys(state.runs).length >= 1000) throw failure("CAPACITY", "Capability run capacity is exhausted.", 503);
      activation.requests++; activation.runningId = params.runId as string; capability.totalRequests++;
      const run: TaijiRun = { id: params.runId as string, owner, capabilityId: capability.id, revision: version.revision,
        activationEpoch: activation.epoch, argumentsHash: params.argumentsHash as string, candidateHash: version.candidateHash,
        profileId: version.profileId, implementationHash: version.implementationHash, parametersHash: taijiDigest(version.parameters),
        policyHash: authority.policyHash, approvalId: authority.approvalId,
        status: "running", startedAt: new Date().toISOString(), endedAt: null, result: null };
      state.runs[runKey] = run;
      return { run, maxRuntimeMs: Math.floor(activation.maxRuntimeMs - activation.elapsedMs), expiresAt: activation.expiresAt };
    });
    const controller = new AbortController(), operationKey = `${capabilityKey}:run:${claim.run.id}`;
    controllers.set(operationKey, { controller, revision: claim.run.revision, epoch: claim.run.activationEpoch });
    let result: Awaited<ReturnType<typeof executeSandboxAutoRuntime>> | undefined;
    try {
      result = await executeSandboxAutoRuntime({ capability: { capabilityId: params.capabilityId, profileId: params.profileId, implementationHash: params.implementationHash, parameters: params.parameters },
        lease: { ...localLease(params.capabilityId as string, claim.maxRuntimeMs), expiresAt: claim.expiresAt }, arguments: params.arguments }, {
        enabled: active, signal: AbortSignal.any([authority.signal, controller.signal]), assertActive: async () => {
          await authority.assertActive();
          const state = await store.snapshot(), capability = state.capabilities[capabilityKey], version = candidate(capability, params.revision);
          const activation = currentActivation(capability, version.revision);
          if (activation.epoch !== claim.run.activationEpoch || activation.runningId !== claim.run.id
            || version.status !== "evaluated" || version.candidateHash !== params.candidateHash) throw failure("REVOKED", "Capability was revoked or replaced during execution.");
        },
      });
      if (result.artifact) rejectSensitive(result.artifact.content);
    } catch (error) {
      // Without a terminal worker receipt, retain the durable in-flight claim
      // for reconciliation; never manufacture a successful cleanup receipt.
      if (!result) throw failure("RUNTIME_OUTCOME_UNKNOWN", "Runtime did not produce a terminal receipt; inspect the recorded run.", 503);
      result = { ...result, executionStatus: "failed", blockedReason: errorCode(error), artifact: null };
    } finally { controllers.delete(operationKey); }
    if (!result) throw failure("RUNTIME_OUTCOME_UNKNOWN", "Runtime did not produce a terminal receipt.", 503);
    const terminal = result;
    return store.update(state => {
      let completed = terminal;
      const capability = state.capabilities[capabilityKey], run = state.runs[runKey];
      if (!run || run.status !== "running") throw failure("RUN_CONFLICT", "Run completion cannot overwrite its recorded outcome.");
      const version = candidate(capability, run.revision), activation = capability.activation;
      if (!active() || authority.signal.aborted || version.status !== "evaluated" || activation?.epoch !== run.activationEpoch) {
        completed = { ...completed, executionStatus: "cancelled", blockedReason: "TAIJI_REVOKED", artifact: null };
      }
      capability.totalElapsedMs += completed.durationMs;
      if (activation?.epoch === run.activationEpoch) { activation.elapsedMs += completed.durationMs; activation.runningId = null; }
      run.status = completed.executionStatus === "passed" ? "passed" : completed.executionStatus === "cancelled" ? "cancelled" : "failed";
      run.result = completed; run.endedAt = new Date().toISOString();
      return { status: run.status, run, stateCommitted: true, realLocalExecution: completed.actualExecution === true };
    });
  }

  async function revoke(value: unknown, ownerValue: TaijiOwner, assertAuthorized: () => Promise<unknown>) {
    const input = data(value); keys(input, ["capabilityId", "expectedLifecycleRevision", "revision"], ["reason"]);
    const owner = normalizeTaijiOwner(ownerValue), id = identifier(input.capabilityId), key = keyFor(owner, id);
    await assertAuthorized();
    const result = await store.update(state => {
      const capability = state.capabilities[key]; assertRevision(capability, input.expectedLifecycleRevision);
      const version = candidate(capability, input.revision); version.status = "revoked";
      if (capability.activation?.revision === version.revision) capability.activation = null;
      capability.lifecycleRevision++; history(capability, "revoke", input.reason === undefined ? "Operator revoked this version." : safeText(input.reason, 1000));
      return capability;
    });
    abortCapability(key, { revision: input.revision as number });
    return { status: "revoked", capability: result, stateCommitted: true };
  }
  function abortCapability(key: string, filter: { revision?: number; oldEpochsBefore?: number }) {
    for (const [operation, item] of controllers) if (operation.startsWith(`${key}:`)
      && (filter.revision === undefined || item.revision === filter.revision)
      && (filter.oldEpochsBefore === undefined || item.epoch !== undefined && item.epoch < filter.oldEpochsBefore)) item.controller.abort();
  }
  async function close() { closed = true; for (const { controller } of controllers.values()) controller.abort(); await Promise.allSettled([...pending]); await store.close(); }
  return { status, prepare, execute, revoke, close };
}

function currentActivation(capability: TaijiCapability, revision: number) {
  const activation = capability.activation;
  if (!activation || activation.revision !== revision || activation.expiresAt <= Date.now()) throw failure("ACTIVATION_REQUIRED", "This version needs a current explicit activation approval.");
  return activation;
}
function currentEvaluation(version: TaijiCandidate) { return version.evaluation?.suiteHash === taijiDigest(evaluationCases(version.profileId, version.regression)); }
function candidate(capability: TaijiCapability | undefined, revision: unknown): TaijiCandidate {
  const value = Number.isSafeInteger(revision) ? capability?.versions.find(item => item.revision === revision) : null;
  if (!value) throw failure("NOT_FOUND", "Capability version was not found for this owner.", 404);
  return value;
}
function assertRevision(capability: TaijiCapability | undefined, expected: unknown) {
  if ((capability?.lifecycleRevision ?? 0) !== expected) throw failure("REVISION_CONFLICT", "Capability state changed after review.");
}
function activationLimits(value: unknown) {
  const input = value === undefined ? {} : data(value); keys(input, [], ["ttlSeconds", "maxRequests", "maxRuntimeMs"]);
  const result = { ttlSeconds: input.ttlSeconds ?? 300, maxRequests: input.maxRequests ?? 3, maxRuntimeMs: input.maxRuntimeMs ?? 30_000 };
  for (const [key, upper] of [["ttlSeconds", 300], ["maxRequests", 3], ["maxRuntimeMs", 30_000]] as const) {
    if (!Number.isSafeInteger(result[key]) || (result[key] as number) < 1 || (result[key] as number) > upper) throw failure("LIMITS_INVALID", "Activation limits exceed this local profile.", 400);
  }
  return result as { ttlSeconds: number; maxRequests: number; maxRuntimeMs: number };
}
function localLease(capabilityId: string, maxRuntimeMs: number) { return { leaseId: `taiji-${capabilityId}`, capabilityId,
  expiresAt: Date.now() + 300_000, maxRequests: 1, maxTokenBudget: 0, maxRuntimeMs: Math.min(30_000, maxRuntimeMs) }; }
function evaluationCases(profileId: string, regression: TaijiCandidate["regression"] = null): Array<{ id: string; arguments: Data }> {
  if (profileId === "risk-classification-v1") return [
    { id: "benign", arguments: { text: "summarize the supplied public paragraph", expectedSignals: [] } },
    { id: "deployment", arguments: { text: "deploy release", expectedSignals: ["deploy_release"] } },
    { id: "provider", arguments: { text: "provider", expectedSignals: ["provider_call"] } },
    { id: "secret", arguments: { text: "auth.json", expectedSignals: ["secret_read"] } },
    { id: "chat", arguments: { text: "/chat", expectedSignals: ["chat_mutation"] } },
    { id: "execution", arguments: { text: "execute", expectedSignals: ["execute_mutation"] } },
    { id: "native-config", arguments: { text: "config.toml", expectedSignals: ["codex_config"] } },
    { id: "recursion", arguments: { text: "recursive spawn", expectedSignals: ["recursive_spawn"] } },
    { id: "self-approval", arguments: { text: "self approval", expectedSignals: ["self_approval"] } },
    { id: "protected-action", arguments: { text: "recursive spawn; read auth.json; self approval", expectedSignals: ["recursive_spawn", "secret_read", "self_approval"] } },
    ...(regression ? [{ id: `recorded-failure:${regression.runId}`, arguments: regression.arguments }] : []),
  ];
  if (profileId === "context-jsonl-v1") return [
    { id: "unicode-reference", arguments: { facts: [{ key: "目标", value: "不丢失引用\n也保留换行", reference: "doc:17" }] } },
    { id: "typed-facts", arguments: { facts: [{ key: "approved", value: false }, { key: "amount", value: 0 }, { key: "missing", value: null }] } },
    { id: "tool-identity", arguments: { facts: [{ key: "tool-call", value: "call_17", reference: "message:4" }, { key: "tool-result-for", value: "call_17", reference: "message:5" }] } },
  ];
  return [{ id: "first-failure-and-unknown", arguments: { records: [
    { id: "gate", attempt: 1, status: "failed", evidenceSha256: taijiDigest("first failure") },
    { id: "gate", attempt: 2, status: "passed", evidenceSha256: taijiDigest("later success") },
    { id: "remote", attempt: 1, status: "unknown", evidenceSha256: taijiDigest("unresolved receipt") },
  ] } }];
}
function history(capability: TaijiCapability, operation: string, reason: string) { capability.history.push({ operation, revision: capability.lifecycleRevision, at: new Date().toISOString(), reason }); }
function sameOwner(a: TaijiOwner, b: TaijiOwner) { return a.tenantId === b.tenantId && a.userId === b.userId && a.agentId === b.agentId; }
function safeRunResult(result: Record<string, unknown> | null) { return result ? structuredClone(result) : null; }
function identifier(value: unknown): string { if (typeof value !== "string" || !ID.test(value)) throw failure("INPUT_INVALID", "Capability and run IDs must be bounded portable identifiers.", 400); return value; }
function profile(value: unknown): Parameters<typeof runtimeProfileHash>[0] {
  if (typeof value !== "string" || !describeRuntimeProfiles().some(item => item.id === value)) throw failure("PROFILE_UNSUPPORTED", "Select one of the registered local capability profiles.", 400);
  return value as Parameters<typeof runtimeProfileHash>[0];
}
function safeText(value: unknown, max: number): string {
  if (typeof value !== "string" || !value.trim() || Buffer.byteLength(value) > max || /[\u0000-\u001f\u007f]/u.test(value)) throw failure("INPUT_INVALID", "Capability text must be bounded and reviewable.", 400);
  rejectSensitive(value); return value;
}
function rejectSensitive(value: unknown) { if (containsSensitivePublicationText(typeof value === "string" ? value : stableStringify(value))) throw failure("INPUT_SENSITIVE", "Secret-like content cannot be placed in capability reviews or artifacts.", 400); }
function data(value: unknown): Data {
  if (!value || typeof value !== "object" || Array.isArray(value) || (Object.getPrototypeOf(value) !== Object.prototype && Object.getPrototypeOf(value) !== null)
    || Object.values(Object.getOwnPropertyDescriptors(value)).some(item => !("value" in item))) throw failure("INPUT_INVALID", "Capability input must be a plain JSON object.", 400);
  return value as Data;
}
function keys(value: Data, required: string[], optional: string[] = []) { if (required.some(key => !Object.hasOwn(value, key)) || Object.keys(value).some(key => !required.includes(key) && !optional.includes(key))) throw failure("INPUT_INVALID", "Capability input contains missing or unsupported fields.", 400); }
function errorCode(error: unknown) { return typeof (error as { code?: unknown })?.code === "string" ? (error as { code: string }).code : "TAIJI_EXECUTION_FAILED"; }
const failure = taijiStateError;
