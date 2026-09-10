import { createHash } from "node:crypto";
import { stableStringify } from "@unified-ai-system/policy-engine";
import type { WorkforceHookBinding, WorkforceHookCatalogEntry, WorkforceHookEvent, WorkforceHookKind,
  WorkforceHookPayloads, WorkforceHookReceipt, WorkforceLifecycleHookInfo } from "@unified-ai-system/shared-contracts";
import { containsSensitivePublicationText } from "../security/secretSafety.js";

const runtimeReceipts = new WeakSet<object>();
const recordSettlements = new WeakMap<object, Promise<void>>();

/** Internal coordination only: observes completion without exposing record results or failures. */
export function awaitWorkforceHookSettlement(error: unknown): Promise<void> | undefined {
  return error !== null && typeof error === "object" ? recordSettlements.get(error) : undefined;
}
const CATALOG: readonly WorkforceHookCatalogEntry[] = Object.freeze([
  Object.freeze({ kind: "plan", event: "beforePlan", handlerId: "goal.guard", access: "read-only" }),
  Object.freeze({ kind: "plan", event: "afterPlan", handlerId: "plan.audit", access: "plan-record" }),
  Object.freeze({ kind: "export", event: "beforeExport", handlerId: "export.guard", access: "read-only" }),
  Object.freeze({ kind: "workflow", event: "beforeWorkflowRun", handlerId: "workflow.guard", access: "read-only" }),
]);
const SEQUENCE: Record<WorkforceHookKind, readonly WorkforceHookEvent[]> = { plan: ["beforePlan", "afterPlan"], export: ["beforeExport"], workflow: ["beforeWorkflowRun"] };
const HASH = /^sha256:[a-f0-9]{64}$/u, OPERATION = /^hkop_[a-f0-9]{64}$/u;
type Payload = WorkforceHookPayloads[WorkforceHookEvent];
type State = { binding: WorkforceHookBinding; signal?: AbortSignal; deadlineAt?: number; lastTime: number;
  index: number; attempted: Set<WorkforceHookEvent>; busy: boolean; closed: boolean; goal?: string };
export function isRuntimeWorkforceHookReceipt(value: unknown): value is WorkforceHookReceipt {
  return Boolean(value && typeof value === "object" && runtimeReceipts.has(value));
}
type BeginInput = { kind: WorkforceHookKind; operationId: string; requestHash: string;
  identity: { tenantId: string; userId: string; permissions: readonly string[] }; signal?: AbortSignal; deadlineAt?: number };

export function createWorkforceLifecycleHooks(options: { enabled?: boolean; clock?: () => number } = {}) {
  const configuration = record(options, ["enabled", "clock"], []);
  if (configuration.enabled !== undefined && typeof configuration.enabled !== "boolean"
    || configuration.clock !== undefined && typeof configuration.clock !== "function") throw failure("WORKFORCE_HOOK_CONFIGURATION_INVALID");
  const enabled = configuration.enabled === true, clock = (configuration.clock ?? Date.now) as () => number;
  const states = new WeakMap<object, State>();
  const info: WorkforceLifecycleHookInfo = Object.freeze({ version: 1, enabled, enabledByDefault: false, mode: "fixed-workforce-lifecycle", catalog: CATALOG });
  const active = (state: State) => {
    if (state.signal?.aborted) throw failure("WORKFORCE_HOOK_CANCELLED", 499);
    const now = readClock(clock);
    if (now < state.lastTime) throw failure("WORKFORCE_HOOK_CLOCK_INVALID");
    state.lastTime = now;
    if (state.signal?.aborted) throw failure("WORKFORCE_HOOK_CANCELLED", 499);
    if (state.deadlineAt !== undefined && now >= state.deadlineAt) throw failure("WORKFORCE_HOOK_DEADLINE_EXCEEDED", 408);
  };
  return Object.freeze({
    getInfo: () => info,
    begin(input: BeginInput): { handle: object; binding: WorkforceHookBinding } | null {
      if (!enabled) return null;
      const source = record(input, ["kind", "operationId", "requestHash", "identity", "signal", "deadlineAt"], ["kind", "operationId", "requestHash", "identity"]);
      if (typeof source.kind !== "string" || !["plan", "export", "workflow"].includes(source.kind) || typeof source.operationId !== "string" || !OPERATION.test(source.operationId)
        || !isHash(source.requestHash) || source.signal !== undefined && !(source.signal instanceof AbortSignal)
        || source.deadlineAt !== undefined && (!Number.isSafeInteger(source.deadlineAt) || Number(source.deadlineAt) < 0)) throw failure("WORKFORCE_HOOK_BINDING_INVALID");
      const identity = record(source.identity, ["tenantId", "userId", "permissions"]);
      const tenantId = safeText(identity.tenantId, 256), userId = safeText(identity.userId, 256);
      const permissions = array(identity.permissions, 128).map(value => safeText(value, 128));
      const kind = source.kind as WorkforceHookKind;
      if (!permissions.includes("*") && !permissions.includes(kind === "export" ? "dashboard:read" : "workflow:run")) throw failure("WORKFORCE_HOOK_PERMISSION_REQUIRED", 403);
      const binding: WorkforceHookBinding = Object.freeze({ kind, operationId: source.operationId, requestHash: source.requestHash,
        tenantFingerprint: hash(["workforce-hook-tenant-v1", tenantId]), subjectFingerprint: hash(["workforce-hook-subject-v1", tenantId, userId]) });
      const state: State = { binding, signal: source.signal as AbortSignal | undefined, deadlineAt: source.deadlineAt as number | undefined,
        lastTime: readClock(clock), index: 0, attempted: new Set(), busy: false, closed: false };
      active(state);
      const handle = Object.freeze(Object.create(null)) as object;
      states.set(handle, state); return Object.freeze({ handle, binding });
    },
    async run<T = unknown>(handle: object | null, event: WorkforceHookEvent, payload: unknown,
      record?: (receipt: WorkforceHookReceipt) => T | Promise<T>): Promise<{ receipt: WorkforceHookReceipt; result?: T }> {
      if (!enabled) throw failure("WORKFORCE_HOOK_DISABLED", 403);
      const state = handle && typeof handle === "object" ? states.get(handle) : undefined;
      if (!state) throw failure("WORKFORCE_HOOK_HANDLE_INVALID", 403);
      const expected = SEQUENCE[state.binding.kind][state.index] ?? SEQUENCE[state.binding.kind].at(-1)!;
      const entry = CATALOG.find(item => item.event === event) ?? CATALOG.find(item => item.event === expected)!;
      if (state.busy || state.closed || state.attempted.has(event)) throw rejected(state, entry, null, "WORKFORCE_HOOK_EVENT_REUSED");
      if (event !== expected || entry.kind !== state.binding.kind) { state.closed = true; throw rejected(state, entry, null, "WORKFORCE_HOOK_EVENT_INVALID"); }
      state.busy = true; state.attempted.add(event);
      let normalized: Payload | null = null, effectStarted = false, settlement: Promise<void> | undefined;
      try {
        active(state);
        if (event === "afterPlan" ? typeof record !== "function" : record !== undefined) throw failure("WORKFORCE_HOOK_RECORD_CALLBACK_INVALID");
        normalized = projectPayload(event, payload);
        if (event === "afterPlan" && normalized.goal !== state.goal) throw failure("WORKFORCE_HOOK_GOAL_MISMATCH");
        active(state);
        const receipt = makeReceipt(state.binding, entry, normalized, "passed", null, state.lastTime);
        let result: T | undefined;
        if (event === "afterPlan") {
          effectStarted = true;
          const effect = (async () => record!(receipt))();
          settlement = effect.then(() => undefined, () => undefined);
          result = await waitForRecord(effect, state, active);
        }
        active(state);
        if (event === "beforePlan") state.goal = normalized.goal;
        state.index += 1; state.closed = state.index === SEQUENCE[state.binding.kind].length;
        return Object.freeze({ receipt, ...(result === undefined ? {} : { result }) });
      } catch (error) {
        state.closed = true;
        if (effectStarted) {
          const receipt = makeReceipt(state.binding, entry, normalized!, "unknown", "WORKFORCE_HOOK_RECORD_UNKNOWN", state.lastTime);
          const unknown = Object.assign(failure("WORKFORCE_HOOK_RECORD_UNKNOWN", 502), { outcomeUnknown: true,
            details: { operationId: state.binding.operationId, receipt, effectMayHaveCommitted: true } });
          if (settlement) recordSettlements.set(unknown, settlement);
          throw unknown;
        }
        const code = state.signal?.aborted ? "WORKFORCE_HOOK_CANCELLED" : safeCode(error);
        throw rejected(state, entry, normalized, code);
      } finally { state.busy = false; }
    },
  });
}
function waitForRecord<T>(effect: Promise<T>, state: State, active: (state: State) => void): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    let done = false, timer: ReturnType<typeof setTimeout> | undefined;
    const finish = (success: boolean, value: unknown) => {
      if (done) return;
      done = true;
      if (timer !== undefined) clearTimeout(timer);
      state.signal?.removeEventListener("abort", onAbort);
      if (success) resolve(value as T); else reject(value);
    };
    const onAbort = () => finish(false, failure("WORKFORCE_HOOK_CANCELLED", 499));
    const checkDeadline = () => {
      try {
        active(state);
        if (state.deadlineAt !== undefined) {
          timer = setTimeout(checkDeadline, Math.min(2_147_483_647, Math.max(1, state.deadlineAt - state.lastTime)));
          timer.unref?.();
        }
      } catch (error) { finish(false, error); }
    };
    effect.then(value => finish(true, value), error => finish(false, error));
    state.signal?.addEventListener("abort", onAbort, { once: true });
    checkDeadline();
  });
}
export function readWorkforceHookReceipt(value: unknown): WorkforceHookReceipt {
  try {
    const source = record(value, ["version", "event", "handlerId", "access", "operationId", "requestHash", "tenantFingerprint", "subjectFingerprint", "payload", "payloadHash", "outcome", "code", "recordedAt", "receiptHash"]);
    const entry = CATALOG.find(item => item.event === source.event);
    if (!entry || source.version !== 1 || source.handlerId !== entry.handlerId || source.access !== entry.access
      || typeof source.operationId !== "string" || !OPERATION.test(source.operationId)
      || ![source.requestHash, source.tenantFingerprint, source.subjectFingerprint].every(isHash)
      || typeof source.outcome !== "string" || !["passed", "failed", "cancelled", "unknown"].includes(source.outcome)
      || (source.outcome === "passed" ? source.code !== null : typeof source.code !== "string" || !/^WORKFORCE_HOOK_[A-Z_]{1,80}$/u.test(source.code))) throw failure("WORKFORCE_HOOK_RECEIPT_INVALID");
    if (source.outcome === "unknown" && entry.event !== "afterPlan" || source.payload === null && !["failed", "cancelled"].includes(String(source.outcome))) throw failure("WORKFORCE_HOOK_RECEIPT_INVALID");
    const payload = source.payload === null ? null : projectPayload(entry.event, source.payload);
    if (typeof source.recordedAt !== "string" || !Number.isFinite(Date.parse(source.recordedAt)) || new Date(source.recordedAt).toISOString() !== source.recordedAt) throw failure("WORKFORCE_HOOK_RECEIPT_INVALID");
    const { receiptHash, ...fields } = source;
    if (hash(payload) !== source.payloadHash || !same(payload, source.payload) || receiptHash !== hash(fields)) throw failure("WORKFORCE_HOOK_RECEIPT_INVALID");
    return Object.freeze({ ...source, payload }) as unknown as WorkforceHookReceipt;
  } catch { throw failure("WORKFORCE_HOOK_RECEIPT_INVALID"); }
}
function projectPayload(event: WorkforceHookEvent, value: unknown): Payload {
  const keys = { beforePlan: ["goal"], afterPlan: ["goal", "workforceId", "roleCount", "previewOnly"],
    beforeExport: ["goal", "workforceId", "planId", "previewOnly"], beforeWorkflowRun: ["goal", "planId", "workflowId", "taskId", "agentId", "reviewHash", "outputRootHash"] }[event];
  const source = record(value, keys), goal = safeText(source.goal, 4000, true);
  if (event === "beforePlan") return Object.freeze({ goal });
  if (event === "afterPlan") {
    if (source.previewOnly !== true || !Number.isSafeInteger(source.roleCount) || Number(source.roleCount) < 0 || Number(source.roleCount) > 128) throw failure("WORKFORCE_HOOK_PAYLOAD_INVALID");
    return Object.freeze({ goal, workforceId: identifier(source.workforceId), roleCount: Number(source.roleCount), previewOnly: true });
  }
  if (event === "beforeExport") {
    if (source.previewOnly !== true) throw failure("WORKFORCE_HOOK_PAYLOAD_INVALID");
    return Object.freeze({ goal, workforceId: identifier(source.workforceId), planId: identifier(source.planId), previewOnly: true });
  }
  if (typeof source.agentId !== "string" || !/^agt_[A-Za-z0-9_-]{1,128}$/u.test(source.agentId) || !isHash(source.reviewHash)
    || typeof source.outputRootHash !== "string" || !/^[a-f0-9]{64}$/u.test(source.outputRootHash)) throw failure("WORKFORCE_HOOK_PAYLOAD_INVALID");
  return Object.freeze({ goal, planId: identifier(source.planId), workflowId: identifier(source.workflowId), taskId: identifier(source.taskId),
    agentId: source.agentId, reviewHash: source.reviewHash, outputRootHash: source.outputRootHash });
}
function makeReceipt(binding: WorkforceHookBinding, entry: WorkforceHookCatalogEntry, payload: Payload | null,
  outcome: WorkforceHookReceipt["outcome"], code: string | null, now: number): WorkforceHookReceipt {
  const fields = { version: 1 as const, event: entry.event, handlerId: entry.handlerId, access: entry.access,
    operationId: binding.operationId, requestHash: binding.requestHash, tenantFingerprint: binding.tenantFingerprint, subjectFingerprint: binding.subjectFingerprint,
    payload, payloadHash: hash(payload), outcome, code, recordedAt: new Date(now).toISOString() };
  const receipt = Object.freeze({ ...fields, receiptHash: hash(fields) }); runtimeReceipts.add(receipt); return receipt;
}
function rejected(state: State, entry: WorkforceHookCatalogEntry, payload: Payload | null, code: string) {
  const cancelled = code === "WORKFORCE_HOOK_CANCELLED" || code === "WORKFORCE_HOOK_DEADLINE_EXCEEDED";
  return Object.assign(failure(code, cancelled ? 499 : 400), { details: { operationId: state.binding.operationId,
    receipt: makeReceipt(state.binding, entry, payload, cancelled ? "cancelled" : "failed", code, state.lastTime), effectMayHaveCommitted: false } });
}
function record(value: unknown, allowed: readonly string[], required: readonly string[] = allowed): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value) || ![Object.prototype, null].includes(Object.getPrototypeOf(value))) throw failure("WORKFORCE_HOOK_PAYLOAD_INVALID");
  const keys = Reflect.ownKeys(value);
  if (keys.length > allowed.length || keys.some(key => typeof key !== "string" || ["__proto__", "constructor", "prototype"].includes(key) || !allowed.includes(key))
    || required.some(key => !Object.hasOwn(value, key))) throw failure("WORKFORCE_HOOK_PAYLOAD_INVALID");
  return Object.fromEntries(keys.map(key => { const field = Object.getOwnPropertyDescriptor(value, key);
    if (!field || !("value" in field) || !field.enumerable) throw failure("WORKFORCE_HOOK_PAYLOAD_INVALID"); return [key, field.value]; }));
}
function array(value: unknown, maximum: number): unknown[] {
  if (!Array.isArray(value) || Object.getPrototypeOf(value) !== Array.prototype || value.length > maximum || Reflect.ownKeys(value).length !== value.length + 1) throw failure("WORKFORCE_HOOK_BINDING_INVALID");
  return Array.from({ length: value.length }, (_, index) => { const field = Object.getOwnPropertyDescriptor(value, String(index));
    if (!field || !("value" in field) || !field.enumerable) throw failure("WORKFORCE_HOOK_BINDING_INVALID"); return field.value; });
}
function safeText(value: unknown, maximum: number, multiline = false): string {
  if (typeof value !== "string" || !value.trim() || value.length > maximum || containsSensitivePublicationText(value)
    || /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f-\u009f\u200b-\u200f\u202a-\u202e\u2066-\u2069\ufeff]/u.test(value)
    || (multiline ? /\r(?!\n)/u : /[\t\r\n]/u).test(value)) throw failure("WORKFORCE_HOOK_PAYLOAD_INVALID");
  return value.trim();
}
function identifier(value: unknown): string { const text = safeText(value, 256); if (!/^[A-Za-z0-9][A-Za-z0-9._:-]{0,255}$/u.test(text)) throw failure("WORKFORCE_HOOK_PAYLOAD_INVALID"); return text; }
function isHash(value: unknown): value is string { return typeof value === "string" && HASH.test(value); }
function hash(value: unknown) { return `sha256:${createHash("sha256").update(stableStringify(value), "utf8").digest("hex")}`; }
function same(left: unknown, right: unknown) { return stableStringify(left) === stableStringify(right); }
function readClock(clock: () => number): number { try { const value = clock(); if (!Number.isSafeInteger(value) || value < 0 || value > 8_640_000_000_000_000) throw new Error(); return value; } catch { throw failure("WORKFORCE_HOOK_CLOCK_INVALID"); } }
function safeCode(error: unknown): string { const code = error instanceof Error ? Object.getOwnPropertyDescriptor(error, "code")?.value : undefined;
  return typeof code === "string" && /^WORKFORCE_HOOK_[A-Z_]{1,80}$/u.test(code) ? code : "WORKFORCE_HOOK_FAILED"; }
function failure(code: string, statusCode = 400) { return Object.assign(new Error("The fixed Workforce lifecycle hook did not complete safely."), { code, statusCode, retryable: false }); }
