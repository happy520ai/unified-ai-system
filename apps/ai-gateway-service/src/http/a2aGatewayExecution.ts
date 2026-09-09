import { createExecutionAbortError, createLinkedAbortController, EXECUTION_ABORT_CODES } from "@unified-ai-system/shared-utils";
import { AsyncLocalStorage } from "node:async_hooks";
import { inheritVirtualKeyRequestAccounting } from "../enterprise/virtualKeyRequestAccounting.ts";
import { bindFakeProviderExecution } from "../core/gatewayService.js";

type Identity = Readonly<Record<string, unknown>>;
type Execution = Record<string, any>;
type Call = { identity?: Identity; execution: Execution };
const calls = new WeakMap<object, Call>();

/** The SDK clones requests, but preserves this server-created context object. */
export function bindA2AGatewayCall(context: object, identity: unknown, execution: Execution = {}): void {
  let projection: Identity | undefined;
  if (identity && typeof identity === "object") {
    const source = identity as Record<string, unknown>;
    const safe: Record<string, unknown> = {};
    for (const key of ["userId", "subject", "id", "tenantId", "role", "apiKeyFingerprint", "managedClientId"]) {
      if (typeof source[key] === "string") safe[key] = source[key];
    }
    if (Array.isArray(source.permissions)) safe.permissions = Object.freeze(source.permissions.filter(value => typeof value === "string"));
    projection = Object.freeze(safe);
  }
  const base = Object.freeze({ ...execution });
  inheritVirtualKeyRequestAccounting(execution, base);
  calls.set(context, { identity: projection, execution: base });
}

export function releaseA2AGatewayCall(context: object): void { calls.delete(context); }

type Invocation = {
  readonly identity?: Identity;
  readonly execution: Execution & { signal: AbortSignal };
  readonly contextId: string;
  readonly done: Promise<void>;
  readonly cancelled: boolean;
  abort(reason: Error, cancelled?: boolean): void;
  finish(): void;
};

/** Per-executor ownership; multiple sends on one task retain separate calls. */
export function createA2AGatewayExecutionLifecycle() {
  const active = new Map<string, Set<Invocation>>();
  const cancellationContext = new AsyncLocalStorage<object>();
  let closed = false;
  const keyFor = (context: any, taskId: string) => JSON.stringify([context?.tenant || "default", context?.user?.userName || "unknown", taskId]);
  return {
    withCancellation<T>(context: object, action: () => Promise<T>): Promise<T> { return cancellationContext.run(context, action); },
    cancellationContext(): object | undefined { return cancellationContext.getStore(); },
    begin(context: object, taskId: string, contextId: string): Invocation {
      if (closed) throw createExecutionAbortError(EXECUTION_ABORT_CODES.GATEWAY_SHUTDOWN, "A2A gateway is closed.", { retryable: false });
      const call = context && calls.get(context);
      if (context) calls.delete(context);
      const base = call?.execution ?? {};
      const remaining = Number.isFinite(base.deadlineAt) ? base.deadlineAt - Date.now() : 30_000;
      const deadlineError = () => createExecutionAbortError(EXECUTION_ABORT_CODES.GATEWAY_DEADLINE_EXCEEDED, "A2A execution deadline exceeded.", { retryable: false });
      const linked = createLinkedAbortController({ signal: base.signal, timeoutMs: Math.max(1, Math.min(2_147_483_647, remaining)), timeoutReason: deadlineError });
      if (remaining <= 0) linked.controller.abort(deadlineError());
      const execution = Object.freeze({ ...base, signal: linked.signal });
      inheritVirtualKeyRequestAccounting(base, execution);
      bindFakeProviderExecution(execution, { providerId: "local-fake-provider", modelId: "local-fake-model" });
      const key = keyFor(context, taskId);
      const group = active.get(key) ?? new Set<Invocation>();
      let resolveDone!: () => void;
      let finished = false; let cancelled = false;
      const invocation: Invocation = Object.freeze({
        identity: call?.identity, execution, contextId,
        done: new Promise<void>(resolve => { resolveDone = resolve; }),
        get cancelled() { return cancelled; },
        abort(reason: Error, explicitCancellation = false) {
          cancelled ||= explicitCancellation;
          if (!linked.signal.aborted) linked.controller.abort(reason);
        },
        finish() {
          if (finished) return;
          finished = true; linked.cleanup(); group.delete(invocation);
          if (!group.size) active.delete(key);
          resolveDone();
        },
      });
      group.add(invocation); active.set(key, group);
      return invocation;
    },
    contextId(context: object, taskId: string): string | undefined {
      return active.get(keyFor(context, taskId))?.values().next().value?.contextId;
    },
    cancel(context: object, taskId: string): void {
      const reason = createExecutionAbortError(EXECUTION_ABORT_CODES.CLIENT_DISCONNECTED, "A2A task cancellation requested.", { retryable: false });
      for (const invocation of active.get(keyFor(context, taskId)) ?? []) invocation.abort(reason, true);
    },
    async close(): Promise<void> {
      closed = true;
      const invocations = [...active.values()].flatMap(group => [...group]);
      const reason = createExecutionAbortError(EXECUTION_ABORT_CODES.GATEWAY_SHUTDOWN, "A2A gateway is shutting down.", { retryable: false });
      for (const invocation of invocations) invocation.abort(reason);
      await Promise.allSettled(invocations.map(invocation => invocation.done));
    },
  };
}
