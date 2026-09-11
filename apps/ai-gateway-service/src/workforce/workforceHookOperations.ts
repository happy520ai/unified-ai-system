import { createHash } from "node:crypto";
import { stableStringify } from "@unified-ai-system/policy-engine";
import { throwIfExecutionAborted } from "@unified-ai-system/shared-utils";
import { containsSensitivePublicationText } from "../security/secretSafety.js";
import { isRuntimeWorkforceHookReceipt, readWorkforceHookReceipt, awaitWorkforceHookSettlement } from "./workforceLifecycleHooks.ts";
import type { WorkforceHookBinding, WorkforceHookReceipt } from "@unified-ai-system/shared-contracts";

type Data = Record<string, any>;
export type PlanHookAudit = { version: 1; binding: WorkforceHookBinding; receipts: WorkforceHookReceipt[]; auditHash: string };
export type HookRequestScope = { identity?: { tenantId?: unknown; userId?: unknown; permissions?: unknown }; signal?: AbortSignal; deadlineAt?: number };
const commits = new WeakMap<object, { signal?: AbortSignal; deadlineAt?: number }>();
const plain = (value: unknown): value is Data => Boolean(value && typeof value === "object" && !Array.isArray(value)
  && [Object.prototype, null].includes(Object.getPrototypeOf(value)));
export const hookHash = (value: unknown) => "sha256:" + createHash("sha256").update(stableStringify(value)).digest("hex");
export const hookError = (code: string, message: string, statusCode = 409) => Object.assign(new Error(message), { code, message, statusCode, retryable: false });
const invalid = () => hookError("WORKFORCE_HOOK_AUDIT_INVALID", "The stored hook audit does not match its original operation.");
export function hookOperationId(kind: string, key: string, identity: { tenantId: string; userId: string }): string {
  return "hkop_" + hookHash(["workforce-hook-operation-v1", kind, identity.tenantId, identity.userId, key]).slice(7);
}
export function hookPlanId(binding: WorkforceHookBinding): string {
  if (!/^hkop_[a-f0-9]{64}$/u.test(binding.operationId)) throw invalid();
  return "wfp_" + binding.operationId.slice(5, 17);
}
export function hookIdentity(scope: HookRequestScope = {}) {
  const identity = scope.identity;
  if (typeof identity?.tenantId !== "string" || !identity.tenantId.trim() || typeof identity.userId !== "string" || !identity.userId.trim()
    || !Array.isArray(identity.permissions) || identity.permissions.some(p => typeof p !== "string")) {
    throw hookError("WORKFORCE_HOOK_IDENTITY_REQUIRED", "Hooks require the authenticated operator identity.", 403);
  }
  return { tenantId: identity.tenantId.trim(), userId: identity.userId.trim(), permissions: [...identity.permissions] as string[] };
}
export function assertHookScopeActive(scope: { signal?: AbortSignal; deadlineAt?: number }) {
  throwIfExecutionAborted(scope.signal);
  if (scope.deadlineAt !== undefined && (!Number.isFinite(scope.deadlineAt) || Date.now() >= scope.deadlineAt)) {
    throw hookError("WORKFORCE_HOOK_DEADLINE_EXCEEDED", "The hook operation deadline expired.", 408);
  }
}
function waitForOriginalPlan(promise: Promise<any>, scope: HookRequestScope, operationId: string) {
  assertHookScopeActive(scope);
  if (!scope.signal && scope.deadlineAt === undefined) return promise;
  const signal = scope.signal;
  return new Promise<any>((resolve, reject) => {
    let finished = false, timer: ReturnType<typeof setTimeout> | undefined;
    const finish = (error: unknown, value?: unknown) => {
      if (finished) return;
      finished = true; signal?.removeEventListener("abort", onAbort); if (timer !== undefined) clearTimeout(timer);
      if (error) reject(error); else resolve(value);
    };
    const stopped = (code: string, status: number) => finish(Object.assign(hookError(code, "Waiting stopped; the original planning operation retains ownership.", status),
        { details: { operationId, originalOperationMayBeActive: true } }));
    const onAbort = () => stopped("WORKFORCE_HOOK_WAIT_CANCELLED", 499);
    const checkDeadline = () => {
      if (scope.deadlineAt === undefined || finished) return;
      const remaining = scope.deadlineAt - Date.now();
      if (remaining <= 0) stopped("WORKFORCE_HOOK_DEADLINE_EXCEEDED", 408);
      else { timer = setTimeout(checkDeadline, Math.min(2_147_483_647, remaining)); timer.unref?.(); }
    };
    signal?.addEventListener("abort", onAbort, { once: true });
    promise.then(value => finish(null, value), error => finish(error));
    if (signal?.aborted) onAbort(); else checkDeadline();
  });
}
export function createPlanHookAudit(binding: WorkforceHookBinding, receipts: WorkforceHookReceipt[], scope: HookRequestScope): PlanHookAudit {
  if (receipts.length !== 2 || receipts.some(receipt => !isRuntimeWorkforceHookReceipt(receipt))) throw invalid();
  const body = { version: 1 as const, binding, receipts };
  const audit = readPlanHookAudit({ ...body, auditHash: hookHash(body) });
  commits.set(audit, { signal: scope.signal, deadlineAt: scope.deadlineAt });
  return audit;
}
export function assertRuntimePlanHookAudit(value: unknown): asserts value is PlanHookAudit {
  if (!value || typeof value !== "object" || !commits.has(value)) throw invalid();
  readPlanHookAudit(value); assertHookScopeActive(commits.get(value)!);
}
export function readPlanHookAudit(value: unknown, expected?: { binding?: WorkforceHookBinding; plan?: Data }): PlanHookAudit {
  if (!plain(value) || Object.keys(value).sort().join() !== "auditHash,binding,receipts,version" || value.version !== 1
    || !Array.isArray(value.receipts) || value.receipts.length !== 2) throw invalid();
  const receipts = value.receipts.map(readWorkforceHookReceipt);
  const binding = value.binding;
  if (!plain(binding) || Object.keys(binding).sort().join() !== "kind,operationId,requestHash,subjectFingerprint,tenantFingerprint" || binding.kind !== "plan"
    || receipts.some((r, i) => r.event !== (i === 0 ? "beforePlan" : "afterPlan") || r.outcome !== "passed"
      || r.operationId !== binding.operationId || r.requestHash !== binding.requestHash || r.tenantFingerprint !== binding.tenantFingerprint || r.subjectFingerprint !== binding.subjectFingerprint)
    || expected?.binding && stableStringify(binding) !== stableStringify(expected.binding)) throw invalid();
  const before = receipts[0].payload as Data, after = receipts[1].payload as Data;
  if (before.goal.trim() !== after.goal || expected?.plan && (expected.plan.goal !== after.goal || expected.plan.workforceId !== after.workforceId)) throw invalid();
  const body = { version: 1 as const, binding: { ...binding } as WorkforceHookBinding, receipts };
  if (value.auditHash !== hookHash(body)) throw invalid();
  return Object.freeze({ ...body, binding: Object.freeze(body.binding), receipts: Object.freeze(receipts) as unknown as WorkforceHookReceipt[], auditHash: value.auditHash });
}
/** Uploaded JSON never imports server-created hook authority or a claimed prior invocation. */
export function withoutHookClaims(value: unknown): any {
  if (Array.isArray(value)) return value.map(withoutHookClaims);
  if (!plain(value)) return value;
  return Object.fromEntries(Object.entries(value).filter(([key]) => !["hookAudit", "lifecycleHooks", "hookReceipts"].includes(key))
    .map(([key, nested]) => [key, withoutHookClaims(nested)]));
}

/** One existing planning/save operation; no alternate planner or background queue. */
export function createWorkforcePlanOperation(input: { hooks: any; store: any; plan(body: Data): Data }) {
  const active = new Map<string, { requestHash: string; promise: Promise<any> }>();
  return async (body: Data, scope: HookRequestScope = {}) => {
    const enabled = input.hooks.getInfo().enabled;
    if (!enabled && (!plain(body) || !Object.hasOwn(body, "operationId"))) {
      const plan = input.plan(body); const saved = await input.store.save(plan, scope.identity?.tenantId);
      return { plan, saved, replayed: false };
    }
    if (!plain(body) || typeof body.operationId !== "string" || !/^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/u.test(body.operationId)
      || containsSensitivePublicationText(body.operationId) || ["hooks", "hookHandlers", "hookRuntime", "hookAudit", "hookReceipts", "lifecycleHooks"].some(key => Object.hasOwn(body, key))) {
      throw hookError("WORKFORCE_HOOK_OPERATION_REQUIRED", "Provide a stable operationId and ordinary planning input, never handlers or hook receipts.", 400);
    }
    const identity = hookIdentity(scope), { operationId: key, ...planning } = body;
    const serialized = stableStringify(planning);
    if (Buffer.byteLength(serialized) > 131072) throw hookError("WORKFORCE_HOOK_INPUT_TOO_LARGE", "Planning hook input exceeds 128 KiB.", 413);
    const requestHash = hookHash(planning), operationId = hookOperationId("plan", key, identity);
    if (!enabled) {
      assertHookScopeActive(scope);
      if (!identity.permissions.includes("*") && !identity.permissions.includes("workflow:run")) {
        throw hookError("WORKFORCE_HOOK_PERMISSION_REQUIRED", "Planning recovery requires workflow:run.", 403);
      }
      const binding = { kind: "plan", operationId, requestHash, tenantFingerprint: hookHash(["workforce-hook-tenant-v1", identity.tenantId]),
        subjectFingerprint: hookHash(["workforce-hook-subject-v1", identity.tenantId, identity.userId]) };
      const recovered = await input.store.findHookOperation(binding, identity.tenantId);
      assertHookScopeActive(scope);
      if (recovered) return { plan: { ...recovered.taskPackage.exportableJson, ...recovered.taskPackage }, saved: recovered, replayed: true };
      throw hookError("WORKFORCE_HOOK_DISABLED", "Hooks are disabled and no original saved operation exists. Inspect the original record before changing the request.");
    }
    const operation = input.hooks.begin({ kind: "plan", operationId, requestHash, identity, signal: scope.signal, deadlineAt: scope.deadlineAt });
    const existing = active.get(operationId);
    if (existing) {
      if (existing.requestHash !== requestHash) throw hookError("WORKFORCE_HOOK_OPERATION_CONFLICT", "This operationId already belongs to different input.");
      const result = await waitForOriginalPlan(existing.promise, scope, operationId); assertHookScopeActive(scope); return { ...result, replayed: true };
    }
    if (active.size >= 64) throw hookError("WORKFORCE_HOOK_CAPACITY", "Too many planning hook operations are active.", 503);
    const work = async () => {
      const recovered = await input.store.findHookOperation(operation.binding, identity.tenantId);
      assertHookScopeActive(scope);
      if (recovered) return { plan: { ...recovered.taskPackage.exportableJson, ...recovered.taskPackage }, saved: recovered, replayed: true };
      const before = await input.hooks.run(operation.handle, "beforePlan", { goal: planning.goal });
      const plan = input.plan(planning);
      const after = await input.hooks.run(operation.handle, "afterPlan", { goal: plan.goal, workforceId: plan.workforceId,
        roleCount: plan.selectedRoles.length, previewOnly: plan.safety?.previewOnly === true },
      async (receipt: WorkforceHookReceipt) => {
        const audit = createPlanHookAudit(operation.binding, [before.receipt, receipt], scope);
        const saved = await input.store.save(plan, identity.tenantId, audit);
        const checked = await input.store.findHookOperation(operation.binding, identity.tenantId);
        if (!checked || checked.planId !== saved.planId) throw invalid();
        return { ...checked, hookReplayed: saved.hookReplayed === true };
      });
      const saved = after.result;
      return { plan: { ...plan, hookAudit: saved.taskPackage.hookAudit }, saved, replayed: saved.hookReplayed === true };
    };
    const promise = work(); active.set(operationId, { requestHash, promise });
    let pendingEffect: Promise<void> | undefined;
    try { return await promise; }
    catch (error: any) {
      pendingEffect = awaitWorkforceHookSettlement(error);
      Object.assign(error, { details: { ...(error.details ?? {}), requestedOperationId: key,
        ...(error.outcomeUnknown === true ? { outcomeUnknown: true } : {}) } }); throw error;
    }
    finally {
      if (pendingEffect) void pendingEffect.then(() => active.delete(operationId));
      else active.delete(operationId);
    }
  };
}
