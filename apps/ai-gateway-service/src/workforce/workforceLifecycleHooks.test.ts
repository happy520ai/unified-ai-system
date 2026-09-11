import { createHash } from "node:crypto";
import { describe, expect, it, vi } from "vitest";
import { stableStringify } from "@unified-ai-system/policy-engine";
import type { WorkforceHookKind } from "@unified-ai-system/shared-contracts";
import { awaitWorkforceHookSettlement, createWorkforceLifecycleHooks, isRuntimeWorkforceHookReceipt, readWorkforceHookReceipt } from "./workforceLifecycleHooks.ts";

const GOAL = "Prepare a bounded local plan", OPERATION = "hkop_" + "a".repeat(64), REQUEST = "sha256:" + "b".repeat(64);
const hash = (value: unknown) => "sha256:" + createHash("sha256").update(stableStringify(value)).digest("hex");
function context(kind: WorkforceHookKind = "plan", extra: Record<string, unknown> = {}) {
  return { kind, operationId: OPERATION, requestHash: REQUEST,
    identity: { tenantId: "tenant-private", userId: "owner-private", permissions: ["workflow:run", "dashboard:read"] }, ...extra };
}
const after = { goal: GOAL, workforceId: "workforce-one", roleCount: 3, previewOnly: true };
const exported = { goal: GOAL, workforceId: "workforce-one", planId: "plan-one", previewOnly: true };
const workflow = { goal: GOAL, planId: "plan-one", workflowId: "workflow-one", taskId: "task-one", agentId: "agt_owned",
  reviewHash: REQUEST, outputRootHash: "c".repeat(64) };
async function caught(operation: Promise<unknown>) { try { await operation; throw new Error("Expected rejection"); } catch (error: any) { return error; } }

describe("fixed Workforce lifecycle hooks", () => {
  it("defaults to disabled with the complete immutable catalog and never calls record", async () => {
    const hooks = createWorkforceLifecycleHooks(), record = vi.fn();
    expect(hooks.getInfo()).toMatchObject({ enabled: false, enabledByDefault: false, mode: "fixed-workforce-lifecycle" });
    expect(hooks.getInfo().catalog.map(item => [item.event, item.handlerId, item.access])).toEqual([
      ["beforePlan", "goal.guard", "read-only"], ["afterPlan", "plan.audit", "plan-record"],
      ["beforeExport", "export.guard", "read-only"], ["beforeWorkflowRun", "workflow.guard", "read-only"]]);
    expect(Object.isFrozen(hooks.getInfo().catalog)).toBe(true); expect(hooks.getInfo().catalog.every(Object.isFrozen)).toBe(true);
    expect(hooks.begin({} as never)).toBeNull();
    await expect(hooks.run(null, "afterPlan", after, record)).rejects.toMatchObject({ code: "WORKFORCE_HOOK_DISABLED" });
    expect(record).not.toHaveBeenCalled();
  });

  it("binds private identity hashes and records exactly the immutable successful plan receipt", async () => {
    const hooks = createWorkforceLifecycleHooks({ enabled: true, clock: () => 1000 }), operation = hooks.begin(context())!;
    expect(operation.binding.tenantFingerprint).toBe(hash(["workforce-hook-tenant-v1", "tenant-private"]));
    expect(operation.binding.subjectFingerprint).toBe(hash(["workforce-hook-subject-v1", "tenant-private", "owner-private"]));
    expect(JSON.stringify(operation)).not.toMatch(/tenant-private|owner-private/);
    expect(Object.isFrozen(operation.binding)).toBe(true);
    const first = await hooks.run(operation.handle, "beforePlan", { goal: "  " + GOAL + "  " });
    expect(first.receipt.payload).toEqual({ goal: GOAL }); expect(first.receipt.outcome).toBe("passed");
    const record = vi.fn(async receipt => {
      expect(isRuntimeWorkforceHookReceipt(receipt)).toBe(true); expect(Object.isFrozen(receipt)).toBe(true); expect(Object.isFrozen(receipt.payload)).toBe(true);
      return { status: "saved", planId: "plan-one" };
    });
    const result = await hooks.run(operation.handle, "afterPlan", after, record);
    expect(record).toHaveBeenCalledOnce(); expect(record.mock.calls[0][0]).toBe(result.receipt); expect(result.result).toEqual({ status: "saved", planId: "plan-one" });
    const { receiptHash, ...fields } = result.receipt; expect(receiptHash).toBe(hash(fields)); expect(result.receipt.payloadHash).toBe(hash(after));
    const restored = readWorkforceHookReceipt(JSON.parse(JSON.stringify(result.receipt)));
    expect(restored).toEqual(result.receipt); expect(isRuntimeWorkforceHookReceipt(restored)).toBe(false);
  });

  it("uses exact permissions and refuses forged or other-runtime handles", async () => {
    const hooks = createWorkforceLifecycleHooks({ enabled: true }), other = createWorkforceLifecycleHooks({ enabled: true });
    for (const [kind, permission] of [["plan", "dashboard:read"], ["workflow", "dashboard:read"], ["export", "workflow:run"]] as const) {
      expect(() => hooks.begin(context(kind, { identity: { tenantId: "tenant", userId: "owner", permissions: [permission] } }))).toThrowError(expect.objectContaining({ code: "WORKFORCE_HOOK_PERMISSION_REQUIRED" }));
    }
    const own = hooks.begin(context())!, foreign = other.begin(context())!;
    for (const handle of [JSON.parse(JSON.stringify(own.handle)), foreign.handle, own.binding]) {
      await expect(hooks.run(handle, "afterPlan", after, vi.fn())).rejects.toMatchObject({ code: "WORKFORCE_HOOK_HANDLE_INVALID" });
    }
    expect(() => hooks.begin(context("plan", { operationId: "hkop-forged" }))).toThrow();
    expect(() => hooks.begin(context("plan", { requestHash: "b".repeat(64) }))).toThrow();
  });

  it("enforces plan event order, normalized goal and single-use event execution", async () => {
    const hooks = createWorkforceLifecycleHooks({ enabled: true }), wrong = hooks.begin(context())!, record = vi.fn();
    const wrongOrder = await caught(hooks.run(wrong.handle, "afterPlan", after, record));
    expect(wrongOrder).toMatchObject({ code: "WORKFORCE_HOOK_EVENT_INVALID", details: { receipt: { outcome: "failed" } } });
    expect(record).not.toHaveBeenCalled();
    const operation = hooks.begin(context())!; await hooks.run(operation.handle, "beforePlan", { goal: GOAL });
    await expect(hooks.run(operation.handle, "beforePlan", { goal: GOAL })).rejects.toMatchObject({ code: "WORKFORCE_HOOK_EVENT_REUSED" });
    await expect(hooks.run(operation.handle, "afterPlan", { ...after, goal: "A different goal" }, record)).rejects.toMatchObject({ code: "WORKFORCE_HOOK_GOAL_MISMATCH" });
    expect(record).not.toHaveBeenCalled();
  });

  it("rejects concurrent and repeated recording without invoking the callback again", async () => {
    const hooks = createWorkforceLifecycleHooks({ enabled: true }), operation = hooks.begin(context())!;
    await hooks.run(operation.handle, "beforePlan", { goal: GOAL });
    let finish!: (value: string) => void;
    const record = vi.fn(() => new Promise<string>(resolve => { finish = resolve; }));
    const pending = hooks.run(operation.handle, "afterPlan", after, record);
    await expect(hooks.run(operation.handle, "afterPlan", after, record)).rejects.toMatchObject({ code: "WORKFORCE_HOOK_EVENT_REUSED" });
    expect(record).toHaveBeenCalledOnce(); finish("stored"); expect((await pending).result).toBe("stored");
    await expect(hooks.run(operation.handle, "afterPlan", after, record)).rejects.toMatchObject({ code: "WORKFORCE_HOOK_EVENT_REUSED" });
    expect(record).toHaveBeenCalledOnce();
  });

  it.each(["record-error", "cancel-after-record", "expire-after-record"])("preserves an unknown commit boundary for %s without leaking the cause", async mode => {
    let now = 1000; const controller = new AbortController(), hooks = createWorkforceLifecycleHooks({ enabled: true, clock: () => now });
    const operation = hooks.begin(context("plan", { signal: controller.signal, deadlineAt: 1100 }))!;
    await hooks.run(operation.handle, "beforePlan", { goal: GOAL });
    const record = vi.fn(async () => { if (mode === "record-error") throw new Error("private-record-error-detail");
      if (mode === "cancel-after-record") controller.abort(new Error("private-cancel-detail")); else now = 1100; return "possibly-committed"; });
    const error = await caught(hooks.run(operation.handle, "afterPlan", after, record));
    expect(error).toMatchObject({ code: "WORKFORCE_HOOK_RECORD_UNKNOWN", statusCode: 502, outcomeUnknown: true,
      details: { operationId: OPERATION, effectMayHaveCommitted: true, receipt: { outcome: "unknown", event: "afterPlan" } } });
    expect(String(error) + JSON.stringify(error)).not.toMatch(/private-record|private-cancel|possibly-committed/);
    expect(readWorkforceHookReceipt(error.details.receipt)).toEqual(error.details.receipt);
    await expect(hooks.run(operation.handle, "afterPlan", after, record)).rejects.toMatchObject({ code: "WORKFORCE_HOOK_EVENT_REUSED" });
    expect(record).toHaveBeenCalledOnce();
  });

  it.each(["abort", "deadline"])("returns unknown promptly on %s while recording is still blocked", async mode => {
    vi.useFakeTimers();
    let now = 1000, finish!: (value: string) => void, observed: unknown, settled = false, settlement: Promise<void> | undefined;
    const controller = new AbortController(), hooks = createWorkforceLifecycleHooks({ enabled: true, clock: () => now });
    const operation = hooks.begin(context("plan", { signal: controller.signal, deadlineAt: 1100 }))!;
    await hooks.run(operation.handle, "beforePlan", { goal: GOAL });
    const record = vi.fn(() => new Promise<string>(resolve => { finish = resolve; }));
    const completed = hooks.run(operation.handle, "afterPlan", after, record).then(
      result => { observed = result; }, error => { observed = error; });
    try {
      if (mode === "abort") controller.abort(new Error("private-blocked-cancel")); else now = 1100;
      await vi.advanceTimersByTimeAsync(mode === "abort" ? 0 : 100);
      expect(observed).toMatchObject({ code: "WORKFORCE_HOOK_RECORD_UNKNOWN", statusCode: 502, retryable: false, outcomeUnknown: true,
        details: { operationId: OPERATION, effectMayHaveCommitted: true, receipt: { event: "afterPlan", outcome: "unknown", operationId: OPERATION } } });
      expect(String(observed) + JSON.stringify(observed)).not.toContain("private-blocked-cancel");
      settlement = awaitWorkforceHookSettlement(observed);
      expect(settlement).toBeInstanceOf(Promise); void settlement!.then(() => { settled = true; });
      await Promise.resolve(); expect(settled).toBe(false); expect(vi.getTimerCount()).toBe(0);
      await expect(hooks.run(operation.handle, "afterPlan", after, record)).rejects.toMatchObject({ code: "WORKFORCE_HOOK_EVENT_REUSED" });
      expect(record).toHaveBeenCalledOnce();
    } finally { finish("possibly-committed"); await completed; await settlement; vi.useRealTimers(); }
    expect(settled).toBe(true);
  });

  it("observes a late record rejection after abort without changing or exposing the unknown receipt", async () => {
    const controller = new AbortController(), hooks = createWorkforceLifecycleHooks({ enabled: true });
    const operation = hooks.begin(context("plan", { signal: controller.signal }))!;
    await hooks.run(operation.handle, "beforePlan", { goal: GOAL });
    let rejectRecord!: (error: Error) => void;
    const record = vi.fn(() => new Promise<void>((_resolve, reject) => { rejectRecord = reject; }));
    const pending = caught(hooks.run(operation.handle, "afterPlan", after, record));
    controller.abort();
    const error = await pending, receipt = error.details.receipt, settlement = awaitWorkforceHookSettlement(error);
    expect(settlement).toBeInstanceOf(Promise);
    expect(awaitWorkforceHookSettlement({ ...error })).toBeUndefined();
    expect(awaitWorkforceHookSettlement(null)).toBeUndefined();
    rejectRecord(new Error("private-late-record-failure"));
    await expect(settlement).resolves.toBeUndefined();
    expect(error.details.receipt).toBe(receipt); expect(readWorkforceHookReceipt(receipt)).toEqual(receipt);
    expect(String(error) + JSON.stringify(error)).not.toContain("private-late-record-failure");
    await expect(hooks.run(operation.handle, "afterPlan", after, record)).rejects.toMatchObject({ code: "WORKFORCE_HOOK_EVENT_REUSED" });
    expect(record).toHaveBeenCalledOnce();
  });

  it("rejects cancellation and expiry before recording and returns bounded cancellation receipts", async () => {
    for (const cancelled of [true, false]) {
      let now = 1000; const controller = new AbortController(), hooks = createWorkforceLifecycleHooks({ enabled: true, clock: () => now });
      const operation = hooks.begin(context("plan", { signal: controller.signal, deadlineAt: 1100 }))!;
      await hooks.run(operation.handle, "beforePlan", { goal: GOAL });
      if (cancelled) controller.abort(new Error("private-reason")); else now = 1100;
      const record = vi.fn(), error = await caught(hooks.run(operation.handle, "afterPlan", after, record));
      expect(error.details).toMatchObject({ effectMayHaveCommitted: false, receipt: { outcome: "cancelled", payload: null } });
      expect(readWorkforceHookReceipt(error.details.receipt)).toEqual(error.details.receipt); expect(record).not.toHaveBeenCalled();
    }
  });

  it("keeps export/workflow read-only and rejects unknown, accessor, unsafe or non-preview payloads", async () => {
    const hooks = createWorkforceLifecycleHooks({ enabled: true });
    for (const [kind, event, payload] of [["export", "beforeExport", exported], ["workflow", "beforeWorkflowRun", workflow]] as const) {
      const rejected = hooks.begin(context(kind))!, effect = vi.fn();
      await expect(hooks.run(rejected.handle, event, payload, effect)).rejects.toMatchObject({ code: "WORKFORCE_HOOK_RECORD_CALLBACK_INVALID" }); expect(effect).not.toHaveBeenCalled();
      expect((await hooks.run(hooks.begin(context(kind))!.handle, event, payload)).receipt).toMatchObject({ outcome: "passed", access: "read-only" });
    }
    const getter = vi.fn(() => GOAL), accessor = Object.defineProperty({}, "goal", { enumerable: true, get: getter });
    for (const payload of [{ goal: "password=private-value" }, { goal: "x".repeat(4001) }, { goal: GOAL, command: "unapproved-command" },
      { goal: () => GOAL }, JSON.parse('{"goal":"safe goal","__proto__":{}}'), accessor]) {
      const error = await caught(hooks.run(hooks.begin(context())!.handle, "beforePlan", payload));
      expect(error.details.receipt).toMatchObject({ outcome: "failed", payload: null }); expect(() => readWorkforceHookReceipt(error.details.receipt)).not.toThrow();
    }
    expect(getter).not.toHaveBeenCalled();
    await expect(hooks.run(hooks.begin(context("export"))!.handle, "beforeExport", { ...exported, previewOnly: false })).rejects.toMatchObject({ code: "WORKFORCE_HOOK_PAYLOAD_INVALID" });
  });

  it("recomputes all receipt fields and never grants runtime branding to JSON evidence", async () => {
    const hooks = createWorkforceLifecycleHooks({ enabled: true }), receipt = (await hooks.run(hooks.begin(context())!.handle, "beforePlan", { goal: GOAL })).receipt;
    for (const value of [{ ...receipt, handlerId: "plan.audit" }, { ...receipt, payload: { goal: "Changed" } }, { ...receipt, receiptHash: REQUEST },
      { ...receipt, access: "plan-record" }, { ...receipt, event: "beforeExport" }, { ...receipt, payload: null }, { ...receipt, extra: true }]) {
      expect(() => readWorkforceHookReceipt(value)).toThrowError(expect.objectContaining({ code: "WORKFORCE_HOOK_RECEIPT_INVALID" }));
    }
    const { receiptHash: _old, ...fields } = { ...receipt, outcome: "unknown", code: "WORKFORCE_HOOK_RECORD_UNKNOWN" };
    expect(() => readWorkforceHookReceipt({ ...fields, receiptHash: hash(fields) })).toThrow();
    expect(isRuntimeWorkforceHookReceipt(receipt)).toBe(true); expect(isRuntimeWorkforceHookReceipt(JSON.parse(JSON.stringify(receipt)))).toBe(false);
  });
});
