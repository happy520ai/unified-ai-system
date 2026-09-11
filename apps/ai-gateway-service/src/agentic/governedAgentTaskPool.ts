import { AgentPoolManager } from "@unified-ai-system/forge-core";
import type { IncomingMessage } from "node:http";
import type { createGovernedAgentTaskRuntime } from "./governedAgentTaskRuntime.ts";
import type { TaskQueueManager } from "../workforce/taskQueueManager.js";
import { bindVirtualKeyRequestAccounting, type VirtualKeyRequestAccounting } from "../enterprise/virtualKeyRequestAccounting.ts";
import { externalRunnerHash as hash } from "../workforce/workforceExternalRunnerProfile.ts";
import { createResidentExecution, issueResidentGrant, residentTaskError, type ResidentAuthorityReference } from "./governedAgentTaskResident.ts";

type Runtime = ReturnType<typeof createGovernedAgentTaskRuntime>;
type Identity = Parameters<Runtime["prepare"]>[0];
type Reference = Pick<Identity, "tenantId" | "userId" | "agentId"> & { taskId: string; profileHash: string };
type Admission = {
  identity: Omit<Identity, "agentId" | "execution">; identityHash: string; accounting?: VirtualKeyRequestAccounting;
  expiresAt: string | null; assertActive(): Promise<void>;
};
export type GovernedAgentTaskPoolConfiguration = Readonly<{
  maxConcurrentWorkers: number; maxGoals: number; chunkIterations: number; maxDurationMs: number;
}>;
type Pointer = Reference & { goalId: string; projectId: string; reviewHash: string; planHash: string;
  residentAuthorizationHash: string; bindingHash: string; revision: number };

/** AgentPool owns scheduling; signed original tasks, current auth and their runtime own all effects. */
export function createGovernedAgentTaskPool(options: {
  queue: TaskQueueManager; runtimes: ReadonlyMap<string, Runtime>; config: GovernedAgentTaskPoolConfiguration;
  enterprise: { captureResidentAuthority(request: IncomingMessage): ResidentAuthorityReference;
    authorizeResidentAuthority(reference: ResidentAuthorityReference): Admission | Promise<Admission> };
  signal: AbortSignal;
}) {
  const { queue, runtimes, config, enterprise } = options;
  const pending = new Set<Promise<unknown>>();
  const safeCode = (error: unknown) => {
    const code = (error as { code?: unknown })?.code;
    return typeof code === "string" && /^[A-Za-z][A-Za-z0-9_]{0,127}$/u.test(code) ? code.toUpperCase() : "AGENT_POOL_ADMISSION_FAILED";
  };
  let closed = false;
  const refs = () => queue.listRetainedTaskReferences() as Reference[];
  function reference(taskId: string, userId: string): Reference {
    const row = refs().find(item => item.taskId === taskId && item.userId === userId);
    if (!row || !runtimes.has(row.profileHash)) throw residentTaskError("NOT_FOUND", 404);
    return row;
  }
  function runtimeFor(ref: Reference) {
    const runtime = runtimes.get(ref.profileHash);
    if (!runtime) throw residentTaskError("PROFILE_CHANGED"); return runtime;
  }
  async function stopIdle(ref: Reference, grantHash: string, originalError: unknown) {
    try { await runtimeFor(ref).stopResident(ref.taskId, ref, grantHash, safeCode(originalError)); }
    catch (stopError) {
      if (originalError instanceof Error) {
        Object.assign(originalError, { persistenceOutcomeUnknown: true });
        if (stopError !== originalError) Object.defineProperty(originalError, "controlPersistenceError", { value: stopError, configurable: true });
      }
      throw originalError;
    }
  }
  async function inspect(ref: Reference) {
    const state = await runtimeFor(ref).inspectResident(ref.taskId, ref), grant = state.resident?.grant;
    if (!grant || grant.taskId !== ref.taskId || grant.tenantId !== ref.tenantId || grant.userId !== ref.userId || grant.agentId !== ref.agentId
      || grant.profileHash !== ref.profileHash || grant.reviewHash !== state.review.reviewHash || grant.planHash !== state.plan?.planHash) throw residentTaskError("BINDING_CHANGED");
    return { ...state, grant };
  }
  function pointer(ref: Reference, state: Awaited<ReturnType<typeof inspect>>): Pointer {
    const body = { goalId: ref.taskId, taskId: ref.taskId, userId: ref.userId, tenantId: ref.tenantId, agentId: ref.agentId,
      projectId: state.review.profile.projectId, profileHash: ref.profileHash, reviewHash: state.review.reviewHash,
      planHash: state.plan!.planHash, residentAuthorizationHash: state.grant.grantHash };
    return Object.freeze({ ...body, bindingHash: hash(body), revision: state.revision });
  }
  async function currentAdmission(ref: Reference, state: Awaited<ReturnType<typeof inspect>>) {
    const admission = await enterprise.authorizeResidentAuthority(state.grant.authority);
    if (admission.identityHash !== state.grant.authorityIdentityHash || admission.identity.tenantId !== ref.tenantId
      || admission.identity.userId !== ref.userId) throw residentTaskError("AUTHORITY_CHANGED", 403);
    await admission.assertActive(); return admission;
  }
  async function executeChunk({ goal, signal }: { goal: Pointer; signal: AbortSignal }) {
    const ref = reference(goal.taskId, goal.userId), initial = await inspect(ref), expected = pointer(ref, initial);
    if (expected.bindingHash !== goal.bindingHash || expected.revision !== goal.revision || !initial.resident?.enabled
      || initial.phase !== "paused" || initial.pendingOperation) throw residentTaskError("NOT_RESUMABLE");
    const runtime = runtimeFor(ref);
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      if (Date.now() >= initial.grant.expiresAt || initial.resident.chunks >= initial.grant.maxChunks) throw residentTaskError("GRANT_EXHAUSTED");
      const admission = await currentAdmission(ref, initial);
      const controller = new AbortController();
    const combined = AbortSignal.any([signal, options.signal, controller.signal]);
    const deadlineAt = Math.min(initial.grant.expiresAt, Date.now() + runtime.profile.limits.chunkTimeoutMs);
    timer = setTimeout(() => controller.abort(residentTaskError("CHUNK_DEADLINE", 504)), Math.max(1, deadlineAt - Date.now())); timer.unref?.();
    const source = Object.freeze({ signal: combined, timeoutMs: Math.max(1, deadlineAt - Date.now()), deadlineAt });
    if (admission.accounting) bindVirtualKeyRequestAccounting(source, admission.accounting);
    const execution = createResidentExecution({ grant: initial.grant, source, async assertActive() {
      combined.throwIfAborted();
      if (Date.now() >= initial.grant.expiresAt) throw residentTaskError("GRANT_EXPIRED");
      await admission.assertActive();
      const current = await inspect(ref);
      if (current.grant.grantHash !== initial.grant.grantHash || !current.resident?.enabled) throw residentTaskError("AUTHORITY_CHANGED", 403);
    } });
    const identity: Identity = { ...admission.identity, agentId: ref.agentId, execution };
      await runtime.run(ref.taskId, identity, { revision: initial.revision, maxIterations: initial.grant.chunkIterations });
    } catch (error) {
      const current = await inspect(ref);
      // The original runtime, not an exception or a file's existence, owns the terminal result.
      if (!["failed", "cancelled", "unknown", "paused"].includes(current.phase)) throw error;
      if (current.phase === "paused" && current.resident?.enabled) {
        await stopIdle(ref, initial.grant.grantHash, error);
      }
    } finally { clearTimeout(timer); }
    const after = await inspect(ref);
    const status = after.phase === "paused" ? after.resident?.enabled ? "continue" as const : "paused" as const
      : after.phase === "completed" ? "completed" as const : after.phase === "cancelled" ? "cancelled" as const
        : after.phase === "failed" ? "failed" as const : "unknown" as const;
    return { goalId: ref.taskId, taskId: ref.taskId, bindingHash: goal.bindingHash, revision: after.revision,
      status,
      ...(after.errorCode ? { errorCode: after.errorCode } : {}) };
  }
  const executor = {
    async admit({ goalId, userId }: { goalId: string; userId: string }) {
      if (closed || options.signal.aborted) throw residentTaskError("STOPPED");
      const ref = reference(goalId, userId), state = await inspect(ref);
      if (state.phase !== "paused" || state.pendingOperation || !state.resident?.enabled) throw residentTaskError("NOT_RESUMABLE");
      try {
        if (Date.now() >= state.grant.expiresAt || state.resident.chunks >= state.grant.maxChunks) throw residentTaskError("GRANT_EXHAUSTED");
        await currentAdmission(ref, state);
      } catch (error) {
        await stopIdle(ref, state.grant.grantHash, error); throw error;
      }
      return pointer(ref, state);
    },
    executeChunk,
    async cancel({ goal, reason }: { goal: Pointer; reason: "pause" | "cancel" | "shutdown" }) {
      const ref = reference(goal.taskId, goal.userId), state = await inspect(ref);
      if (["completed", "cancelled", "failed", "unknown"].includes(state.phase)) return;
      if (pointer(ref, state).bindingHash !== goal.bindingHash) throw residentTaskError("BINDING_CHANGED");
      if (reason === "shutdown") {
        await runtimeFor(ref).drainResident(ref.taskId, ref, state.grant.grantHash); return;
      }
      const admission = await currentAdmission(ref, state);
      const execution = { signal: new AbortController().signal, timeoutMs: 10000, deadlineAt: Date.now() + 10000 };
      // Control has no provider operation and does not reuse the executing chunk's admission.
      await runtimeFor(ref).control(ref.taskId, { ...admission.identity, agentId: ref.agentId, execution }, state.revision,
        reason === "cancel" ? "cancel" : "pause");
    },
    async recoverableGoals() {
      const result: Array<{ goalId: string; userId: string }> = [];
      for (const ref of refs()) {
        if (!runtimes.has(ref.profileHash)) continue;
        const state = await runtimeFor(ref).inspectResident(ref.taskId, ref);
        if (state.resident?.enabled && state.phase === "paused" && !state.pendingOperation) result.push({ goalId: ref.taskId, userId: ref.userId });
      }
      return result;
    },
  };
  const pool = new AgentPoolManager({ governedChunkExecutor: executor, maxGoals: config.maxGoals,
    maxQueuedGoals: config.maxGoals, maxConcurrent: config.maxConcurrentWorkers });
  function observe(completion: Promise<unknown>) {
    pending.add(completion); void completion.finally(() => pending.delete(completion)).catch(() => {});
  }
  return Object.freeze({
    async schedule(runtime: Runtime, taskId: string, identity: Identity, revision: number, request: IncomingMessage) {
      if (closed) throw residentTaskError("STOPPED");
      // Authoritative capture must precede persisting the resident grant; body JSON carries no identity.
      const authority = enterprise.captureResidentAuthority(request), admission = await enterprise.authorizeResidentAuthority(authority);
      if (admission.identity.tenantId !== identity.tenantId || admission.identity.userId !== identity.userId) throw residentTaskError("AUTHORITY_CHANGED", 403);
      await admission.assertActive();
      const state = await runtime.read(taskId, identity);
      if (!state.plan || state.revision !== revision || state.phase !== "paused" || state.pendingOperation) throw residentTaskError("NOT_RESUMABLE");
      const expiresAt = Math.min(Date.now() + config.maxDurationMs, admission.expiresAt ? Date.parse(admission.expiresAt) : Infinity);
      const grant = issueResidentGrant({ taskId, tenantId: identity.tenantId, userId: identity.userId, agentId: identity.agentId,
        profileHash: runtime.profile.profileHash, reviewHash: state.review.reviewHash, planHash: state.plan.planHash,
        authority, authorityIdentityHash: admission.identityHash, expiresAt, chunkIterations: config.chunkIterations,
        maxChunks: runtime.profile.limits.maxIterations + 1 });
      await runtime.schedule(taskId, identity, revision, grant);
      try {
        const queued = await pool.enqueueGovernedGoal(taskId, identity.userId, "submit"); observe(queued.completion);
      } catch (error) {
        await stopIdle(reference(taskId, identity.userId), grant.grantHash, error); throw error;
      }
      return runtime.read(taskId, identity);
    },
    async control(runtime: Runtime, taskId: string, identity: Identity, revision: number, action: "pause" | "cancel") {
      const observed = await runtime.read(taskId, identity);
      if (observed.revision !== revision) throw residentTaskError("CONTROL_REVISION_CHANGED");
      if (!pool.hasGovernedGoal(taskId)) return runtime.control(taskId, identity, revision, action);
      const ref = reference(taskId, identity.userId), admitted = await inspect(ref);
      if (admitted.revision !== revision) throw residentTaskError("CONTROL_REVISION_CHANGED");
      const expected = pointer(ref, admitted);
      if (action === "cancel") await pool.cancelGoal(taskId, identity.userId, expected.bindingHash);
      else await pool.pauseGoal(taskId, identity.userId, expected.bindingHash);
      const current = await runtime.read(taskId, identity);
      const after = await inspect(ref);
      if (after.grant.grantHash !== admitted.grant.grantHash) throw residentTaskError("BINDING_CHANGED");
      return runtime.control(taskId, identity, current.revision, action);
    },
    async recover() {
      const result = await pool.recoverInterruptedGoals();
      if (Array.isArray(result) || !result || result.legacyTasksReplayed !== false
        || !Array.isArray(result.admitted) || !Array.isArray(result.rejected)) throw residentTaskError("RECOVERY_UNCONFIRMED");
      for (const rejection of result.rejected) {
        const row = refs().find(ref => ref.taskId === rejection.goalId);
        if (!row || !runtimes.has(row.profileHash)) continue;
        const state = await inspect(row);
        if (state.phase === "paused" && !state.pendingOperation && state.resident?.enabled) {
          await stopIdle(row, state.grant.grantHash, Object.assign(Error("Resident recovery was not admitted."), { code: rejection.code }));
        }
      }
      return result;
    },
    async close() { closed = true; await pool.shutdown(); await Promise.allSettled([...pending]); },
  });
}
