import { createHash, randomUUID } from "node:crypto";
import { isAbsolute, resolve } from "node:path";
import { realpath } from "node:fs/promises";
import { tmpdir } from "node:os";
import { ContainerSandboxBackend } from "@unified-ai-system/forge-core";
import { stableStringify } from "@unified-ai-system/policy-engine";
import type { EffectiveAgentPolicy, WorkforceCodeDeliveryProfile, WorkforceCodeDeliveryReview, WorkforceRoleExecutionProfile } from "@unified-ai-system/shared-contracts";
import { createForgeGatewayService, createForgeGovernedExecution } from "../forge/forgeGatewayService.js";
import { effectiveGovernedToolDecision, evaluateGovernedToolScope, readWorkforceCodeDeliveryToolProxy } from "../agent-governance/toolProxy.ts";
import { assertOwnedWorkforceWorktree } from "./worktreeIsolation.js";
import { createWorkforceGit } from "./workforceGit.ts";
import { readWorkforceCodeDeliveryReview, readFrozenWorkforceCodeDeliveryProfile, codeDeliveryError } from "./workforceCodeDeliveryProfile.ts";
import { readFrozenWorkforceRoleExecutionProfile } from "./workforceRoleExecutionProfile.ts";
import { captureApprovedCodeFiles, createApprovedCodeSnapshot, createCodeDeliveryArtifact } from "./workforceCodeDeliveryArtifacts.ts";
import { assertWorkforceCodeTaskFence } from "./workforceDagExecutor.ts";
import { readWorkforceCodeRoleOperation } from "./workforceRoleProvider.ts";

export const WORKFORCE_VERIFY_SNAPSHOT_TOOL = "workforce_verify_snapshot";
export interface WorkforceCodeDeliveryFactory { readonly kind: "workforce-code-delivery-factory" }
export interface WorkforceCodeDeliveryPreflight { readonly kind: "workforce-code-delivery-preflight" }
type Identity = { tenantId: string; userId: string; role: string; permissions: readonly string[] };
type Context = { agentId: string; tenantId: string; userId?: string; requestId?: string };
type Fence = { assertActive(phase: "reserve" | "commit"): Promise<unknown>; signal?: AbortSignal };
type ToolProxy = { enforce(input: any): Promise<any>; enforceResult(input: any): Promise<any> };
type RoleOperation = { binding: { roleId: string; employeeId: string; providerId: string; modelId: string }; generate(input: any): Promise<any> };
type ForgeGatewayPort = { orchestrate(input: Record<string, unknown>): Promise<any>;
  listRuns(input: { tenantIdentity: Identity }): { runs: Array<Record<string, any>> } };
type Config = { repoRoot: string; enginePath: string; scratchRoot: string; drainTimeoutMs: number };
type Prepared = { factory: WorkforceCodeDeliveryFactory; review: WorkforceCodeDeliveryReview; roleProfile: WorkforceRoleExecutionProfile;
  identity: Identity; context: Context; policyHash: string; planId: string; planDigest: string; deadlineAt: number;
  signal: AbortSignal; toolProxy: ToolProxy; baselineFilesHash: string; used: boolean };
type SnapshotCall = { context: Context; policyHash: string; paramsHash: string; admitted: boolean; used: boolean;
  toolProxy: ToolProxy; assertActive(): Promise<void>; run(): Promise<any> };
const factories = new WeakMap<object, Config>();
const preflights = new WeakMap<object, Prepared>();
const snapshotCalls = new WeakMap<object, SnapshotCall>();
const verifiedResults = new WeakMap<object, Readonly<Record<string, any>>>();
const evidenceIndexes = new WeakSet<object>();

export function createWorkforceCodeDeliveryEvidenceIndex(value: unknown,
  binding: { executionId: string; taskId: string; agentId: string }, persisted: any) {
  const verified = readVerifiedWorkforceCodeDeliveryResult(value, binding);
  if (persisted?.status !== "verified" || persisted.profileHash !== verified.profileHash
    || persisted.artifact?.diffSha256 !== verified.artifact.diffSha256) throw fail("EVIDENCE_UNVERIFIED", 503);
  const index = Object.freeze({ version: 1, ...binding, profileHash: verified.profileHash,
    diffSha256: verified.artifact.diffSha256, evidenceHash: hash(JSON.stringify(persisted)) });
  evidenceIndexes.add(index);
  return index;
}
export function readTrustedWorkforceCodeDeliveryEvidenceIndex(value: unknown): ReturnType<typeof createWorkforceCodeDeliveryEvidenceIndex> | null {
  return value && typeof value === "object" && evidenceIndexes.has(value) ? value as ReturnType<typeof createWorkforceCodeDeliveryEvidenceIndex> : null;
}

export function assertWorkforceCodeDeliveryPreflight(token: unknown, expected: {
  factory?: unknown; tenantId: string; userId: string; agentId: string; planId: string; planDigest: string; policyHash: string;
}) {
  const prepared = token && typeof token === "object" ? preflights.get(token) : undefined;
  if (!prepared || prepared.used || expected.factory !== undefined && prepared.factory !== expected.factory
    || prepared.identity.tenantId !== expected.tenantId || prepared.identity.userId !== expected.userId
    || prepared.context.agentId !== expected.agentId || prepared.planId !== expected.planId
    || prepared.planDigest !== expected.planDigest || prepared.policyHash !== expected.policyHash) throw fail("PREFLIGHT_REQUIRED");
  active(prepared.signal, prepared.deadlineAt);
}

/** Persistence can preserve only metadata constructed after actual snapshot validation. */
export function readVerifiedWorkforceCodeDeliveryResult(value: unknown, binding: { executionId: string; taskId: string; agentId: string }) {
  const verified = value && typeof value === "object" ? verifiedResults.get(value) : undefined;
  if (!verified || Object.entries(binding).some(([key, entry]) => verified[key] !== entry)) throw fail("EVIDENCE_UNVERIFIED", 503);
  return verified;
}

/** Only this concrete implementation can create a recognized factory. No execution callbacks are accepted. */
export function createWorkforceCodeDeliveryFactory(options: {
  repoRoot: string; enginePath: string; scratchRoot?: string; drainTimeoutMs?: number;
}): WorkforceCodeDeliveryFactory {
  if (!options || !isAbsolute(options.repoRoot) || !isAbsolute(options.enginePath)
    || options.scratchRoot !== undefined && !isAbsolute(options.scratchRoot)
    || Object.keys(options).some(key => !["repoRoot", "enginePath", "scratchRoot", "drainTimeoutMs"].includes(key))) throw fail("CONFIGURATION_INVALID");
  const drainTimeoutMs = options.drainTimeoutMs ?? 30000;
  if (!Number.isSafeInteger(drainTimeoutMs) || drainTimeoutMs < 100 || drainTimeoutMs > 30000) throw fail("CONFIGURATION_INVALID");
  const factory = Object.freeze({ kind: "workforce-code-delivery-factory" as const });
  factories.set(factory, Object.freeze({ repoRoot: resolve(options.repoRoot), enginePath: options.enginePath,
    scratchRoot: options.scratchRoot ?? tmpdir(), drainTimeoutMs }));
  return factory;
}
export function isWorkforceCodeDeliveryFactory(value: unknown): value is WorkforceCodeDeliveryFactory {
  return Boolean(value && typeof value === "object" && factories.has(value));
}

export async function preflightWorkforceCodeDelivery(factory: WorkforceCodeDeliveryFactory, input: {
  review: WorkforceCodeDeliveryReview; roleProfile: WorkforceRoleExecutionProfile; identity: Identity; context: Context;
  policy: EffectiveAgentPolicy; usage: { toolCalls: number; steps: number; records: number };
  planId: string; planDigest: string; signal: AbortSignal; deadlineAt: number; toolProxy: ToolProxy;
}): Promise<WorkforceCodeDeliveryPreflight> {
  const config = factoryConfig(factory);
  if (!readWorkforceCodeDeliveryToolProxy(input.toolProxy)) throw fail("TOOL_PROXY_REQUIRED", 403);
  const roleProfile = readFrozenWorkforceRoleExecutionProfile(input.roleProfile);
  const review = readWorkforceCodeDeliveryReview(input.review, roleProfile);
  const identity = freezeIdentity(input.identity), context = freezeContext(input.context);
  if (context.tenantId !== identity.tenantId || context.userId !== identity.userId
    || context.agentId !== input.policy.agentId || !/^sha256:[a-f0-9]{64}$/u.test(input.policy.policyHash)
    || !/^[a-f0-9]{64}$/u.test(input.planDigest) || !input.planId) throw fail("BINDING_INVALID");
  const configured = resolve(config.repoRoot).replaceAll("\\", "/");
  const configuredHash = "sha256:" + hash(JSON.stringify(["workforce-code-repository-config/v1",
    process.platform === "win32" ? configured.toLowerCase() : configured]));
  if (review.configuredRepositoryHash !== configuredHash) throw fail("BINDING_INVALID");
  const { signal, deadlineAt, planId, planDigest } = input;
  const policyHash = input.policy.policyHash;
  active(signal, deadlineAt);
  if (!Number.isFinite(Date.parse(input.policy.expiresAt)) || Date.parse(input.policy.expiresAt) <= Date.now()) throw fail("POLICY_EXPIRED", 403);
  assertPolicy(input.policy, identity.tenantId, review, input.usage, roleProfile.bindings.length);
  await assertRepository(config.repoRoot, review.profile.baselineRevision);
  const files = await captureApprovedCodeFiles(config.repoRoot, review.profile, signal);
  const scratchRoot = await realpath(config.scratchRoot);
  const backend = new ContainerSandboxBackend({ enginePath: config.enginePath, image: review.profile.verification.image,
    workspaceRoots: [scratchRoot], allowNetwork: false });
  try { await backend.attest(); } catch { throw fail("CONTAINER_UNAVAILABLE", 503); }
  active(signal, deadlineAt);
  const token = Object.freeze({ kind: "workforce-code-delivery-preflight" as const });
  preflights.set(token, { factory, review, roleProfile, identity, context, policyHash,
    planId, planDigest, deadlineAt, signal, toolProxy: input.toolProxy, baselineFilesHash: files.filesHash, used: false });
  return token;
}

/** Tool Proxy admission only. A DTO, another request or a consumed object can never satisfy this check. */
export async function consumeWorkforceSnapshotCapability(capability: unknown, context: Context, params: unknown, policyHash: string,
  toolProxy?: unknown): Promise<boolean> {
  const record = capability && typeof capability === "object" ? snapshotCalls.get(capability) : undefined;
  if (!record || record.admitted || record.used || record.toolProxy !== toolProxy || record.policyHash !== policyHash
    || contextKey(record.context) !== contextKey(context) || record.paramsHash !== hash(stableStringify(params))) return false;
  try { await record.assertActive(); } catch { record.used = true; return false; }
  if (record.admitted || record.used || contextKey(record.context) !== contextKey(context)
    || record.paramsHash !== hash(stableStringify(params))) return false;
  record.admitted = true;
  return true;
}

/** Both concrete code runners use this private-capability, immutable container verification boundary. */
export async function verifyWorkforceCodeSnapshot(input: {
  source: Awaited<ReturnType<typeof captureApprovedCodeFiles>>; profile: WorkforceCodeDeliveryProfile;
  scratchRoot: string; enginePath: string; context: Context; policyHash: string; planId: string; planDigest: string;
  executionId: string; taskId: string; toolProxy: ToolProxy; signal: AbortSignal; deadlineAt: number;
  assertActive(phase?: "reserve" | "commit"): Promise<unknown>;
}): Promise<Readonly<{ status: "passed"; command: string; image: string; snapshotHash: string;
  exitCode: 0; cleanupConfirmed: true; stdout: string; stderr: string }>> {
  let snapshot: Awaited<ReturnType<typeof createApprovedCodeSnapshot>> | null = null;
  let cleanupUncertain = false, verificationStarted = false, outcomeUnknown = false, preparationRetained = false;
  const capability = Object.freeze(Object.create(null));
  let lease: any, failure: Error | undefined;
  try {
    const operations = readWorkforceCodeDeliveryToolProxy(input.toolProxy);
    if (!operations) throw fail("TOOL_PROXY_REQUIRED", 403);
    const profile = readFrozenWorkforceCodeDeliveryProfile(input.profile), { source, signal, deadlineAt } = input;
    const context = freezeContext(input.context);
    if (!isAbsolute(input.enginePath) || !isAbsolute(input.scratchRoot) || source.profileHash !== profile.profileHash
      || !/^sha256:[a-f0-9]{64}$/u.test(input.policyHash) || !/^[a-f0-9]{64}$/u.test(input.planDigest)
      || !input.planId || !input.executionId || !input.taskId || typeof input.assertActive !== "function") throw fail("BINDING_INVALID");
    const check = async (phase: "reserve" | "commit" = "commit") => {
      active(signal, deadlineAt); await input.assertActive(phase); active(signal, deadlineAt);
    };
    await check();
    snapshot = await createApprovedCodeSnapshot(source, input.scratchRoot, signal);
    const snapshotContext = Object.freeze({ ...context, requestId: "wf-verify-" + randomUUID() });
    const params = Object.freeze({ executionId: input.executionId, taskId: input.taskId, planId: input.planId,
      planDigest: input.planDigest, profileHash: profile.profileHash, verificationId: profile.verification.verificationId,
      command: profile.verification.command, image: profile.verification.image, snapshotHash: snapshot.filesHash });
    const backend = new ContainerSandboxBackend({ enginePath: input.enginePath, image: profile.verification.image,
      workspaceRoots: [snapshot.workspace], allowNetwork: false });
    const runBackend = backend.run.bind(backend), capturedSnapshot = snapshot;
    const call: SnapshotCall = { context: snapshotContext, policyHash: input.policyHash, paramsHash: hash(stableStringify(params)),
      admitted: false, used: false, toolProxy: input.toolProxy, assertActive: () => check(), run: () => runBackend({
        command: profile.verification.command, workspace: capturedSnapshot.workspace, workspaceMode: "ro", networkAccess: false, env: {},
        timeoutMs: Math.min(profile.verification.timeoutMs, deadlineAt - Date.now()),
        maxMemoryMB: profile.verification.maxMemoryMB, maxOutputBytes: profile.verification.maxOutputBytes,
        pidsLimit: profile.verification.pidsLimit, cpus: profile.verification.cpus, signal }) };
    snapshotCalls.set(capability, call);
    await check("reserve");
    const verdict = await operations.enforce({ context: snapshotContext, toolName: WORKFORCE_VERIFY_SNAPSHOT_TOOL, params,
      resourceContext: { resourceKeys: { projectId: profile.projectId, planId: input.planId, taskId: input.taskId },
        resources: [...profile.readPaths], workforceSnapshotCapability: capability } });
    lease = verdict?.executionLease;
    if (verdict?.outcome !== "allow" || !verdict.policy || typeof lease?.release !== "function" || !call.admitted || call.used) throw fail("SNAPSHOT_ADMISSION_REQUIRED", 403);
    call.used = true;
    await check();
    if ((await captureApprovedCodeFiles(snapshot.workspace, profile, signal)).filesHash !== snapshot.filesHash) throw fail("SNAPSHOT_CHANGED");
    verificationStarted = true;
    let verification;
    try { verification = await call.run(); }
    catch (error) { cleanupUncertain = (error as { cleanupUncertain?: unknown })?.cleanupUncertain === true; throw fail("VERIFICATION_FAILED", 503); }
    cleanupUncertain = verification.cleanupUncertain !== false;
    if (verification.exitCode !== 0 || verification.killed || verification.oomKilled || verification.truncated
      || cleanupUncertain || verification.backend !== "container") throw fail("VERIFICATION_FAILED", 503);
    const verifiedResult = { status: "passed" as const, command: profile.verification.command, image: profile.verification.image,
      snapshotHash: snapshot.filesHash, exitCode: 0 as const, cleanupConfirmed: true as const,
      stdout: verification.stdout, stderr: verification.stderr };
    let audited;
    try { audited = await operations.enforceResult({ context: snapshotContext, toolName: WORKFORCE_VERIFY_SNAPSHOT_TOOL,
      policy: verdict.policy, result: verifiedResult, descriptor: { kind: "zero-records" } }); }
    catch { outcomeUnknown = true; throw fail("OUTCOME_UNKNOWN", 503); }
    if (!audited || !Object.hasOwn(audited, "result") || audited.verdict === "replace") { outcomeUnknown = true; throw fail("OUTCOME_UNKNOWN", 503); }
    if (["status", "command", "image", "snapshotHash", "exitCode", "cleanupConfirmed"].some(key =>
      (audited.result as Record<string, unknown>)?.[key] !== verifiedResult[key as keyof typeof verifiedResult])) throw fail("EVIDENCE_UNREVIEWABLE", 503);
    await check();
    if ((await captureApprovedCodeFiles(snapshot.workspace, profile, signal)).filesHash !== snapshot.filesHash) throw fail("SNAPSHOT_CHANGED");
    if ((await captureApprovedCodeFiles(source.root, profile, signal)).filesHash !== source.filesHash) throw fail("VALIDATED_SOURCE_CHANGED");
    await snapshot.cleanup(); snapshot = null;
    return Object.freeze({ ...(audited.result as Record<string, unknown>) }) as Readonly<typeof verifiedResult>;
  } catch (error) {
    preparationRetained = (error as { code?: unknown })?.code === "WORKFORCE_CODE_SNAPSHOT_CLEANUP_UNCERTAIN";
    cleanupUncertain ||= preparationRetained;
    if (snapshot && !cleanupUncertain) {
      try { await snapshot.cleanup(); snapshot = null; } catch { cleanupUncertain = true; }
    }
    failure = Object.assign(error instanceof Error ? error : fail("FAILED"), {
      snapshotRetained: snapshot !== null || preparationRetained, cleanupUncertain, verificationStarted,
      outcomeUnknown: outcomeUnknown || cleanupUncertain,
    });
    throw failure;
  } finally {
    snapshotCalls.delete(capability);
    try { await lease?.release?.(); }
    catch {
      if (failure) Object.assign(failure, { outcomeUnknown: true });
      else throw Object.assign(fail("OUTCOME_UNKNOWN", 503), {
        snapshotRetained: snapshot !== null, cleanupUncertain, verificationStarted, outcomeUnknown: true,
      });
    }
  }
}

export async function runWorkforceCodeDelivery(factory: WorkforceCodeDeliveryFactory, token: WorkforceCodeDeliveryPreflight, task: {
  executionId: string; taskId: string; agentRunId: string; planApprovalId: string; manager: unknown; worktreeId: string;
  roleProviderOperation: RoleOperation; agentFence: Fence; taskFence: Fence; toolProxy: ToolProxy;
  signal: AbortSignal; abort(reason: Error): void; goal: string;
}) {
  const config = factoryConfig(factory), prepared = preflights.get(token);
  if (!prepared || prepared.factory !== factory || prepared.used) throw fail("PREFLIGHT_REQUIRED");
  const operations = readWorkforceCodeDeliveryToolProxy(task.toolProxy);
  if (!operations || task.toolProxy !== prepared.toolProxy) throw fail("TOOL_PROXY_REQUIRED", 403);
  const executionId = "wf-scope-" + hash(prepared.identity.tenantId + "\0" + prepared.identity.userId + "\0" + prepared.planId + "\0" + task.planApprovalId);
  if (!task.planApprovalId || executionId !== task.executionId || !task.taskId || typeof task.abort !== "function"
    || typeof task.agentFence?.assertActive !== "function" || typeof task.taskFence?.assertActive !== "function"
    || typeof task.toolProxy?.enforce !== "function" || typeof task.toolProxy?.enforceResult !== "function") throw fail("BINDING_INVALID");
  const binding = prepared.roleProfile.bindings.find(item => item.roleId === prepared.review.profile.roleId);
  if (!binding || ["roleId", "employeeId", "providerId", "modelId"].some(key =>
    task.roleProviderOperation?.binding?.[key as keyof RoleOperation["binding"]] !== binding[key as keyof typeof binding])) throw fail("BINDING_INVALID");
  const profile = prepared.review.profile;
  const roleBinding = { executionId: task.executionId, planId: prepared.planId, planDigest: prepared.planDigest,
    profileHash: prepared.roleProfile.profileHash, agentId: prepared.context.agentId, agentRunId: task.agentRunId,
    taskId: task.taskId, roleId: profile.roleId, agentFence: task.agentFence, taskFence: task.taskFence };
  const { generate } = readWorkforceCodeRoleOperation(task.roleProviderOperation, roleBinding);
  const taskBinding = { executionId: task.executionId, agentId: prepared.context.agentId, agentRunId: task.agentRunId,
    taskId: task.taskId, roleId: profile.roleId, agentFence: task.agentFence };
  await assertWorkforceCodeTaskFence(task.taskFence, taskBinding, "reserve");
  if (prepared.used) throw fail("PREFLIGHT_REQUIRED");
  prepared.used = true;
  const signal = AbortSignal.any([prepared.signal, task.signal,
    ...(task.agentFence.signal ? [task.agentFence.signal] : []), ...(task.taskFence.signal ? [task.taskFence.signal] : [])]);
  const assertAgent = task.agentFence.assertActive.bind(task.agentFence);
  const { enforce, enforceResult } = operations;
  let poisoned: Error | null = null, outcomeUnknown = false, mutationAttempted = false, writesObserved = false, verificationStarted = false;
  let snapshotRetained = false, snapshotCleanupAllowed = true;
  const pending = new Set<Promise<unknown>>(), modelReceipts: unknown[] = [];
  const poison = (error: Error) => { poisoned ??= error; task.abort(error); };
  const check = async (phase: "reserve" | "commit" = "commit") => {
    if (poisoned) throw poisoned;
    active(signal, prepared.deadlineAt);
    await assertAgent(phase); await assertWorkforceCodeTaskFence(task.taskFence, taskBinding, phase);
    active(signal, prepared.deadlineAt);
    await assertOwnedWorkforceWorktree(task.manager, task.worktreeId,
      { planId: task.executionId, baselineRevision: profile.baselineRevision });
    active(signal, prepared.deadlineAt);
  };
  const owned = await assertOwnedWorkforceWorktree(task.manager, task.worktreeId,
    { planId: task.executionId, baselineRevision: profile.baselineRevision });
  if (comparePath(owned.repositoryRoot) !== comparePath(await realpath(config.repoRoot))) throw fail("BINDING_INVALID");
  const context = Object.freeze({ ...prepared.context, requestId: "wf-code-" + randomUUID() });
  const toolContext = (request: any) => ({ ...request.resourceContext, resourceKeys: {
    ...request.resourceContext?.resourceKeys, projectId: profile.projectId, planId: prepared.planId,
    executionId: task.executionId, taskId: task.taskId } });
  const scopedProxy = {
    async enforce(request: any) {
      await check("reserve");
      const action = request.resourceContext?.resourceKeys?.forgeAction;
      const path = request.params?.file_path;
      const allowed = action === "read" ? profile.readPaths : profile.writePaths;
      if (!["read", "write", "edit"].includes(action) || typeof path !== "string" || !allowed.includes(path)
        || comparePath(request.resourceContext?.resourceKeys?.projectRoot ?? "") !== comparePath(owned.path)
        || comparePath(request.resourceContext?.resourceKeys?.canonicalPath ?? "") !== comparePath(resolve(owned.path, path))
        || action === "write" && Buffer.byteLength(String(request.params?.content ?? "")) > profile.artifactLimits.maxFileBytes) {
        const error = fail("ACTION_DENIED", 403); poison(error); throw error;
      }
      const verdict = await enforce({ ...request, context, resourceContext: toolContext(request) });
      if (verdict?.outcome !== "allow") { const error = fail("ACTION_DENIED", 403); poison(error); throw error; }
      if (action !== "read") mutationAttempted = true;
      return verdict;
    },
    async enforceResult(event: any) {
      try {
        const result = await enforceResult(event);
        if (!result || !Object.hasOwn(result, "result") || result.verdict === "replace") throw fail("OUTCOME_UNKNOWN", 503);
        return result;
      } catch {
        outcomeUnknown = true; const error = fail("OUTCOME_UNKNOWN", 503); poison(error); throw error;
      }
    },
  };
  const governed = createForgeGovernedExecution({ context, toolProxy: scopedProxy,
    executionLease: { signal, assertActive: check }, signal } as any);
  const governedExecution = Object.freeze({ ...governed, async afterAction(event: any) {
    if (["write", "edit"].includes(event.actionType) && event.result?.modified === true) writesObserved = true;
    if (event.error) {
      outcomeUnknown ||= event.actionType !== "read";
      const error = fail(outcomeUnknown ? "OUTCOME_UNKNOWN" : "ACTION_DENIED", outcomeUnknown ? 503 : 403);
      poison(error); throw error;
    }
    return governed.afterAction(event);
  } });
  const facade = { execute(input: any) {
    const operation = (async () => {
      await check("reserve");
      const requestedTokens = Number(input.options?.maxOutputTokens);
      const maxOutputTokens = Number.isSafeInteger(requestedTokens) && requestedTokens > 0
        ? Math.min(requestedTokens, binding.maxOutputTokens) : binding.maxOutputTokens;
      const response = await generate({ request: { messages: input.messages, options: { maxOutputTokens } } });
      if (response?.workforceReceipt?.status !== "succeeded") throw fail("MODEL_RECEIPT_UNCONFIRMED", 503);
      modelReceipts.push(response.workforceReceipt);
      active(signal, prepared.deadlineAt);
      return { success: true, data: { message: response.message ?? { role: "assistant", content: response.text },
        usage: response.usage, selectedModel: binding.modelId } };
    })().catch(error => {
      const receipt = error?.workforceReceipt;
      if (receipt) modelReceipts.push(receipt);
      outcomeUnknown ||= !receipt || receipt.status === "outcome_unknown";
      poison(fail(outcomeUnknown ? "MODEL_OUTCOME_UNKNOWN" : "MODEL_CALL_FAILED", 503)); throw error;
    });
    pending.add(operation); void operation.then(() => pending.delete(operation), () => pending.delete(operation));
    return operation;
  } };
  try {
    await check();
    const before = await captureApprovedCodeFiles(owned.path, profile, signal);
    if (before.filesHash !== prepared.baselineFilesHash) throw fail("BASELINE_CHANGED");
    // The existing JS service's null defaults infer narrower types than its documented server-bound API.
    const forge = createForgeGatewayService({ gatewayService: facade, governanceRequired: true,
      env: { FORGE_LANE_ENABLED: "true", FORGE_ACTION_GOVERNANCE_REQUIRED: "true", AI_GATEWAY_FORGE_WORKING_DIRECTORY: owned.path } } as any) as unknown as ForgeGatewayPort;
    const result: any = await forge.orchestrate({ goal: task.goal, tenantIdentity: prepared.identity, gatewayService: facade,
      governedExecution, governanceRequired: true, signal, options: { maxConcurrent: 1, enableCodeIntel: false, checkpointAfter: [] } });
    const run = forge.listRuns({ tenantIdentity: prepared.identity }).runs.find((entry: any) => entry.runId === result.runId);
    if (result.ok !== true || result.result?.status !== "completed" || result.result?.failedTasks !== 0
      || run?.cleanup?.ok !== true) throw fail("FORGE_INCOMPLETE", 503);
    await check();
    await assertChangedPaths(owned.path, profile.writePaths);
    const after = await captureApprovedCodeFiles(owned.path, profile, signal);
    const artifact = createCodeDeliveryArtifact(before, after, profile);
    const verification = await verifyWorkforceCodeSnapshot({ source: after, profile, scratchRoot: config.scratchRoot,
      enginePath: config.enginePath, context, policyHash: prepared.policyHash, planId: prepared.planId,
      planDigest: prepared.planDigest, executionId: task.executionId, taskId: task.taskId, toolProxy: task.toolProxy,
      signal, deadlineAt: prepared.deadlineAt, assertActive: check });
    verificationStarted = true;
    const completed = Object.freeze({ version: 1, status: "verified", forgeRunId: result.runId, baselineRevision: profile.baselineRevision,
      profileHash: profile.profileHash, artifact, verification, modelRequestCount: modelReceipts.length,
      projectFileWrites: true, verificationStarted, outcomeUnknown: false, localQuiescenceConfirmed: true });
    verifiedResults.set(completed, Object.freeze({ executionId: task.executionId, taskId: task.taskId,
      agentId: prepared.context.agentId, planId: prepared.planId, planDigest: prepared.planDigest,
      profileHash: profile.profileHash, baselineRevision: profile.baselineRevision, artifact, verification, completed }));
    return completed;
  } catch (error) {
    const snapshotFailure = error as { snapshotRetained?: boolean; cleanupUncertain?: boolean; verificationStarted?: boolean; outcomeUnknown?: boolean };
    snapshotRetained = snapshotFailure?.snapshotRetained === true;
    snapshotCleanupAllowed = snapshotFailure?.cleanupUncertain !== true;
    verificationStarted ||= snapshotFailure?.verificationStarted === true;
    outcomeUnknown ||= snapshotFailure?.outcomeUnknown === true;
    poison(error instanceof Error ? error : fail("FAILED"));
    const drained = await drain(pending, config.drainTimeoutMs);
    const failure = fail(outcomeUnknown || !drained || !snapshotCleanupAllowed ? "OUTCOME_UNKNOWN" : "FAILED", 503);
    Object.assign(failure, { details: { outcomeUnknown: outcomeUnknown || !drained || !snapshotCleanupAllowed,
      quiescenceUncertain: !drained || !snapshotCleanupAllowed, recoveryRequired: mutationAttempted || verificationStarted,
      projectFileWrites: writesObserved ? true : mutationAttempted ? null : false,
      projectWriteAttempted: mutationAttempted, snapshotRetained, verificationStarted, retrySafe: false } });
    throw failure;
  }
}

function assertPolicy(policy: EffectiveAgentPolicy, tenantId: string, review: WorkforceCodeDeliveryReview,
  usage: { toolCalls: number; steps: number; records: number }, roleCount: number) {
  if (policy.permissions.canWrite !== true || policy.permissions.canExecuteCode !== true || policy.requirements.sandboxRequired === true
    || policy.limits.maxRecords !== undefined) throw fail("POLICY_UNSUPPORTED", 403);
  const requiredOutputKeys = ["codeDelivery", "status", "profileHash", "baselineRevision", "artifact", "sourceFilesHash",
    "diffSha256", "diffBytes", "filesChanged", "path", "change", "beforeSha256", "afterSha256", "patch",
    "verification", "command", "image", "snapshotHash", "exitCode", "cleanupConfirmed"];
  if (policy.scope?.deniedOutputFields?.some(field => requiredOutputKeys.some(key => key.toLowerCase().includes(field.toLowerCase())))) throw fail("POLICY_UNSUPPORTED", 403);
  for (const tool of ["file_read", "file_write", "file_edit", WORKFORCE_VERIFY_SNAPSHOT_TOOL]) {
    if (effectiveGovernedToolDecision(policy, tool) !== "allow") throw fail("POLICY_UNSUPPORTED", 403);
  }
  for (const path of review.profile.readPaths) {
    if (!evaluateGovernedToolScope(policy, tenantId, { file_path: path },
      { resourceKeys: { projectId: review.profile.projectId, path }, resources: [path] }).allowed) throw fail("POLICY_UNSUPPORTED", 403);
  }
  if (!Number.isSafeInteger(usage.toolCalls) || !Number.isSafeInteger(usage.steps)
    || policy.limits.maxToolCalls !== undefined && policy.limits.maxToolCalls - usage.toolCalls < 3
    || policy.limits.maxSteps !== undefined && policy.limits.maxSteps - usage.steps < roleCount) throw fail("BUDGET_INSUFFICIENT", 403);
}
async function assertRepository(root: string, baseline: string) {
  if (comparePath(await realpath(root)) !== comparePath(root)) throw fail("ROOT_INVALID");
  const git = createWorkforceGit(root); await git.assertSafe();
  const top = (await git.run(["rev-parse", "--show-toplevel"])).stdout.trim();
  const head = (await git.run(["rev-parse", "--verify", "HEAD"])).stdout.trim();
  if (comparePath(top) !== comparePath(root) || head !== baseline) throw fail("BASELINE_CHANGED");
  if ((await git.run(["status", "--porcelain=v1", "-z", "--untracked-files=all"])).stdout) throw fail("WORKSPACE_DIRTY");
}
async function assertChangedPaths(root: string, approved: readonly string[]) {
  const git = createWorkforceGit(root); await git.assertSafe();
  const entries = (await git.run(["status", "--porcelain=v1", "-z", "--untracked-files=all"])).stdout.split("\0").filter(Boolean);
  for (const entry of entries) {
    if (![" M", " D", "??"].includes(entry.slice(0, 2)) || !approved.includes(entry.slice(3))) throw fail("UNAPPROVED_CHANGE");
  }
}
function freezeIdentity(value: Identity): Identity {
  if (!value || !value.tenantId || !value.userId || !value.role || !Array.isArray(value.permissions)) throw fail("BINDING_INVALID");
  return Object.freeze({ tenantId: value.tenantId, userId: value.userId, role: value.role, permissions: Object.freeze([...value.permissions]) });
}
function freezeContext(value: Context): Context {
  if (!value || !/^agt_[A-Za-z0-9_-]{1,128}$/u.test(value.agentId) || !value.tenantId || !value.userId) throw fail("BINDING_INVALID");
  return Object.freeze({ agentId: value.agentId, tenantId: value.tenantId, userId: value.userId, ...(value.requestId ? { requestId: value.requestId } : {}) });
}
function contextKey(value: Context) { return stableStringify([value?.agentId, value?.tenantId, value?.userId, value?.requestId]); }
function factoryConfig(value: WorkforceCodeDeliveryFactory) { const config = factories.get(value); if (!config) throw fail("IMPLEMENTATION_UNAVAILABLE", 503); return config; }
function hash(value: string) { return createHash("sha256").update(value).digest("hex"); }
function comparePath(path: string) { const value = resolve(path); return process.platform === "win32" ? value.toLowerCase() : value; }
function active(signal: AbortSignal, deadline: number) { if (!(signal instanceof AbortSignal) || signal.aborted || !Number.isFinite(deadline) || Date.now() >= deadline) throw fail("CANCELLED", 499); }
function fail(suffix: string, status = 409) { return codeDeliveryError("WORKFORCE_CODE_DELIVERY_" + suffix, status, "The governed code delivery boundary could not complete: " + suffix + "."); }
async function drain(pending: Set<Promise<unknown>>, timeoutMs: number) {
  if (!pending.size) return true;
  let timer: ReturnType<typeof setTimeout> | undefined;
  try { return await Promise.race([Promise.allSettled([...pending]).then(() => true), new Promise<false>(resolve => { timer = setTimeout(() => resolve(false), timeoutMs); })]); }
  finally { clearTimeout(timer); }
}
