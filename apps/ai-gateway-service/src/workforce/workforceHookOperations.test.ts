import { mkdtemp, realpath, rm } from "node:fs/promises";
import { dirname, join } from "node:path";
import { tmpdir } from "node:os";
import { afterEach, expect, it, vi } from "vitest";
import { createWorkforceService } from "./workforceService.js";
import { createWorkforcePlanStore } from "./workforcePlanStore.js";
import { createWorkforcePlan } from "./workforcePlanner.js";
import { createWorkforceLifecycleHooks, readWorkforceHookReceipt, awaitWorkforceHookSettlement } from "./workforceLifecycleHooks.ts";
import { createWorkforcePlanOperation, readPlanHookAudit } from "./workforceHookOperations.ts";

const cleanups: (() => unknown | Promise<unknown>)[] = [];
afterEach(async () => { for (const fn of cleanups.splice(0).reverse()) await fn(); });
const identity = { tenantId: "hook-tenant", userId: "hook-owner", permissions: ["*"] };
const scope = { identity };
async function fixture(mode = "sqlite") {
  const parent = await realpath(tmpdir()), root = await mkdtemp(join(parent, "workforce-hooks-"));
  cleanups.push(async () => { expect(await realpath(root)).toBe(root); expect(dirname(root)).toBe(parent); await rm(root, { recursive: true, force: true }); });
  const env = { WORKFORCE_PLAN_STORE_PATH: join(root, mode === "sqlite" ? "plans.db" : "plans.json"), WORKFORCE_PLAN_STORE_MODE: mode };
  const make = () => { const service = createWorkforceService({ env, lifecycleHooks: createWorkforceLifecycleHooks({ enabled: true }) });
    cleanups.push(() => service.close()); return service; };
  return { make, env };
}
for (const mode of ["sqlite", "json"]) it(`${mode}: saves once, replays after restart, and rejects changed input without overwriting`, async () => {
  const f = await fixture(mode), service = f.make(), body = { operationId: "original-operation", goal: "Implement traceable recovery" };
  const [first, concurrent] = await Promise.all([service.planAndSave(body, scope), service.planAndSave(body, scope)]);
  expect(first.replayed).toBe(false); expect(concurrent.replayed).toBe(true);
  expect(first.saved.planId).toBe(concurrent.saved.planId);
  const audit = readPlanHookAudit(first.plan.hookAudit);
  expect(audit.receipts.map(r => [r.event, r.outcome])).toEqual([["beforePlan", "passed"], ["afterPlan", "passed"]]);
  expect((await service.listPlans(identity.tenantId)).count).toBe(1);
  const reopened = f.make(), replay = await reopened.planAndSave(body, scope);
  expect(replay.replayed).toBe(true); expect(replay.saved.savedAt).toBe(first.saved.savedAt);
  expect(replay.plan.hookAudit).toEqual(audit);
  await expect(reopened.planAndSave({ ...body, goal: "Changed goal" }, scope)).rejects.toMatchObject({ code: "WORKFORCE_HOOK_AUDIT_INVALID" });
  expect((await reopened.getPlan(first.saved.planId, identity.tenantId)).taskPackage.hookAudit).toEqual(audit);
  await expect(reopened.getPlan(first.saved.planId, "different-tenant")).rejects.toMatchObject({ code: "WORKFORCE_PLAN_NOT_FOUND" });
  const other = await reopened.planAndSave(body, { identity: { ...identity, userId: "different-owner" } });
  expect(other.saved.planId).not.toBe(first.saved.planId);
});
it("runs beforeExport only at the owned export entry and never imports claimed receipts", async () => {
  const f = await fixture(), service = f.make();
  const first = await service.planAndSave({ operationId: "export-source", goal: "Export bounded plan" }, scope);
  const exported = await service.exportPlan(first.saved.planId, identity.tenantId, scope) as any;
  expect(exported.lifecycleHooks.persisted).toBe(false);
  expect(readWorkforceHookReceipt(exported.lifecycleHooks.receipts[0])).toMatchObject({ event: "beforeExport", outcome: "passed", access: "read-only" });
  expect((await service.getPlan(first.saved.planId, identity.tenantId)).taskPackage.lifecycleHooks).toBeUndefined();
  await expect(service.exportPlan(first.saved.planId, identity.tenantId, { identity: { ...identity, permissions: ["workflow:run"] } })).rejects.toMatchObject({ code: "WORKFORCE_HOOK_PERMISSION_REQUIRED" });
  const imported = await service.savePlan({ plan: { ...first.plan, hookAudit: first.plan.hookAudit, lifecycleHooks: exported.lifecycleHooks } }, identity.tenantId);
  expect(imported.taskPackage.hookAudit).toBeUndefined(); expect(imported.taskPackage.lifecycleHooks).toBeUndefined();
  await expect(service.planAndSave({ operationId: "forged", goal: "Goal", hookAudit: first.plan.hookAudit }, scope)).rejects.toMatchObject({ code: "WORKFORCE_HOOK_OPERATION_REQUIRED" });
  await expect(service.planAndSave({ operationId: "denied", goal: "Goal" }, { identity: { ...identity, permissions: ["dashboard:read"] } })).rejects.toMatchObject({ code: "WORKFORCE_HOOK_PERMISSION_REQUIRED" });
});
it("returns unknown after a committed record loses its acknowledgement and recovers without replanning", async () => {
  const f = await fixture(), store = createWorkforcePlanStore({ env: f.env }); cleanups.push(() => store.close());
  const plan = vi.fn(createWorkforcePlan), actualSave = store.save.bind(store), save = vi.fn(async (...args: any[]) => {
    await actualSave(...args); throw new Error("private storage acknowledgement lost");
  });
  const operation = createWorkforcePlanOperation({ hooks: createWorkforceLifecycleHooks({ enabled: true }),
    store: { findHookOperation: store.findHookOperation.bind(store), save }, plan });
  const body = { operationId: "acknowledgement-lost", goal: "Preserve original result" };
  await expect(operation(body, scope)).rejects.toMatchObject({ code: "WORKFORCE_HOOK_RECORD_UNKNOWN", details: { requestedOperationId: body.operationId, effectMayHaveCommitted: true } });
  const recovered = await operation(body, scope);
  expect(recovered.replayed).toBe(true); expect(plan).toHaveBeenCalledTimes(1); expect(save).toHaveBeenCalledTimes(1);
  expect(readPlanHookAudit(recovered.plan.hookAudit).receipts[1].outcome).toBe("passed");
});
it("blocks a cancelled request before plan creation or persistence", async () => {
  const f = await fixture(), service = f.make(), controller = new AbortController(); controller.abort();
  await expect(service.planAndSave({ operationId: "cancelled", goal: "No write" }, { ...scope, signal: controller.signal })).rejects.toMatchObject({ code: "WORKFORCE_HOOK_CANCELLED" });
  expect((await service.listPlans(identity.tenantId)).count).toBe(0);
});
it("keeps the original operation locked while a cancelled record callback is still pending", async () => {
  const f = await fixture(), store = createWorkforcePlanStore({ env: f.env }); cleanups.push(() => store.close());
  let release!: () => void, entered!: () => void;
  const gate = new Promise<void>(resolve => { release = resolve; }), started = new Promise<void>(resolve => { entered = resolve; });
  const actualSave = store.save.bind(store), plan = vi.fn(createWorkforcePlan), save = vi.fn(async (...args: any[]) => {
    const saved = await actualSave(...args); entered(); await gate; return saved;
  });
  const operation = createWorkforcePlanOperation({ hooks: createWorkforceLifecycleHooks({ enabled: true }),
    store: { findHookOperation: store.findHookOperation.bind(store), save }, plan });
  const body = { operationId: "cancel-during-acknowledgement", goal: "Keep the original operation" }, owner = new AbortController();
  const pending = operation(body, { ...scope, signal: owner.signal }).catch(error => error);
  await started;
  const duplicateController = new AbortController();
  const duplicate = operation(body, { ...scope, signal: duplicateController.signal }).catch(error => error);
  duplicateController.abort();
  expect(await duplicate).toMatchObject({ code: "WORKFORCE_HOOK_WAIT_CANCELLED", details: { originalOperationMayBeActive: true } });
  expect(save).toHaveBeenCalledTimes(1);
  owner.abort(); const unknown = await pending;
  expect(unknown).toMatchObject({ code: "WORKFORCE_HOOK_RECORD_UNKNOWN" });
  await expect(operation(body, scope)).rejects.toBe(unknown);
  expect(plan).toHaveBeenCalledTimes(1); expect(save).toHaveBeenCalledTimes(1);
  release(); await awaitWorkforceHookSettlement(unknown);
  const recovered = await operation(body, scope);
  expect(recovered.replayed).toBe(true); expect(save).toHaveBeenCalledTimes(1);
});
it("honors a duplicate caller deadline without cancelling the original pending record", async () => {
  const f = await fixture(), store = createWorkforcePlanStore({ env: f.env }); cleanups.push(() => store.close());
  let release!: () => void, entered!: () => void;
  const gate = new Promise<void>(resolve => { release = resolve; }), started = new Promise<void>(resolve => { entered = resolve; });
  const actualSave = store.save.bind(store), save = vi.fn(async (...args: any[]) => { const saved = await actualSave(...args); entered(); await gate; return saved; });
  const operation = createWorkforcePlanOperation({ hooks: createWorkforceLifecycleHooks({ enabled: true }), store: { findHookOperation: store.findHookOperation.bind(store), save }, plan: createWorkforcePlan });
  const body = { operationId: "duplicate-deadline", goal: "Keep original ownership" }, pending = operation(body, scope);
  await started; vi.useFakeTimers();
  let settled = false;
  const duplicate = operation(body, { ...scope, deadlineAt: Date.now() + 20 }).catch(error => { settled = true; return error; });
  try {
    await vi.advanceTimersByTimeAsync(20);
    expect(settled).toBe(true);
    expect(await duplicate).toMatchObject({ code: "WORKFORCE_HOOK_DEADLINE_EXCEEDED", details: { originalOperationMayBeActive: true } });
    expect(save).toHaveBeenCalledTimes(1);
  } finally { release(); vi.useRealTimers(); await pending; await duplicate; }
});
it("recovers retained original operations after hooks are disabled and does not silently create a replacement", async () => {
  const f = await fixture(), enabled = f.make(), body = { operationId: "retained-after-disable", goal: "Preserve the reviewed plan" };
  const original = await enabled.planAndSave(body, scope);
  const disabled = createWorkforceService({ env: f.env }); cleanups.push(() => disabled.close());
  const recovered = await disabled.planAndSave(body, scope);
  expect(recovered.replayed).toBe(true); expect(recovered.saved.planId).toBe(original.saved.planId);
  expect(recovered.plan.hookAudit).toEqual(original.plan.hookAudit);
  const throughSave = await disabled.savePlan(body, identity.tenantId, scope);
  expect(throughSave.planId).toBe(original.saved.planId);
  await expect(disabled.planAndSave({ ...body, operationId: "missing-original" }, scope)).rejects.toMatchObject({ code: "WORKFORCE_HOOK_DISABLED" });
  expect((await disabled.listPlans(identity.tenantId)).count).toBe(1);
  const legacy = await disabled.planAndSave({ goal: "Ordinary preview" }, scope);
  expect(legacy.plan.hookAudit).toBeUndefined(); expect(legacy.replayed).toBe(false);
});
