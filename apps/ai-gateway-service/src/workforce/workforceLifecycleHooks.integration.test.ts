// @test-isolation process
import { once } from "node:events";
import { mkdtemp, realpath, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { afterEach, expect, it, vi } from "vitest";
import { createGatewayApplication } from "../application/createGatewayApplication.js";
import { createGatewayHttpServer } from "../http/httpServer.js";
import { createGatewayClient } from "@unified-ai-system/shared-sdk";
import { readPlanHookAudit } from "./workforceHookOperations.ts";
import { readWorkforceHookReceipt } from "./workforceLifecycleHooks.ts";

const cleanup: (() => Promise<unknown>)[] = [];
afterEach(async () => { for (const close of cleanup.splice(0).reverse()) await close(); vi.restoreAllMocks(); });
async function fixture() {
  const parent = await realpath(tmpdir()), root = await mkdtemp(join(parent, "workforce-lifecycle-http-"));
  cleanup.push(async () => { expect(await realpath(root)).toBe(root); expect(dirname(root)).toBe(parent); await rm(root, { recursive: true, force: true }); });
  const token = "workforce-lifecycle-fixture", tenantId = "lifecycle-tenant";
  const env = { NODE_ENV: "test", AI_GATEWAY_PROVIDER_MODE: "fake", AI_GATEWAY_REAL_PROVIDER_ENABLED: "false",
    AI_GATEWAY_WORKFORCE_LIFECYCLE_HOOKS_ENABLED: "true", PME_RUNTIME_CREDENTIAL_STORE_MODE: "memory", KNOWLEDGE_STORAGE_MODE: "memory",
    AI_GATEWAY_RATE_LIMIT_WHITELIST: "127.0.0.1", AI_GATEWAY_MODEL_LIBRARY_STATE_PATH: join(root, "models.json"),
    WORKFORCE_PLAN_STORE_PATH: join(root, "plans.db"), WORKFORCE_PLAN_STORE_MODE: "sqlite", WORKFORCE_EXECUTION_DIR: join(root, "execution"),
    WORKFLOW_OUTPUT_DIR: join(root, "artifacts"), AI_GATEWAY_USAGE_LOG_DIR: join(root, "usage"),
    AI_GATEWAY_LOCAL_CLIENT_REGISTRY_PATH: join(root, "clients.json"), AI_GATEWAY_LOCAL_CLIENT_EXECUTION_LOG_PATH: join(root, "clients.jsonl"),
    AI_GATEWAY_LOCAL_CLIENT_EXECUTION_CONTROL_DIR: join(root, "client-control"),
    PME_ENTERPRISE_AUTH_ENABLED: "true", PME_AUTH_TOKEN: token, PME_AUTH_USER_ID: "lifecycle-owner", PME_AUTH_TENANT_ID: tenantId,
    PME_AUTH_ROLE: "admin", PME_ENTERPRISE_PLATFORM_TENANT_ID: tenantId, PME_ENTERPRISE_USER_STORE_PATH: join(root, "users.json"),
    PME_API_KEY_STORE_PATH: join(root, "keys.json"), PME_AUDIT_LOG_PATH: join(root, "audit.jsonl"), PME_AUDIT_CHAIN_PATH: join(root, "audit-chain.jsonl") };
  const open = async () => {
    const app = createGatewayApplication(env) as any, server = createGatewayHttpServer(app) as any;
    let closed = false;
    const close = async () => { if (closed) return; closed = true; await new Promise<void>(resolve => { server.close(() => resolve()); server.closeAllConnections(); }); await server.shutdownResources(); };
    cleanup.push(close); server.listen(0, "127.0.0.1"); await once(server, "listening");
    const url = "http://127.0.0.1:" + server.address().port;
    const send = async (path: string, body?: unknown, auth = true) => { const response = await fetch(url + path, {
      method: body === undefined ? "GET" : "POST", headers: { ...(auth ? { authorization: "Bearer " + token } : {}), "content-type": "application/json" },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }) }); return { status: response.status, data: await response.json() as any }; };
    const client = createGatewayClient({ baseUrl: url, timeoutMs: 10000, headers: { authorization: "Bearer " + token } });
    return { app, close, send, client };
  };
  return { open, tenantId };
}
it("executes the actual authenticated plan/save/export API and reuses its SQLite audit after application restart", async () => {
  const f = await fixture(), first = await f.open();
  const generate = vi.spyOn(first.app.providerRegistry.get("local-fake-provider"), "generate");
  const body = { operationId: "http-original-operation", goal: "Review the bounded lifecycle report" };
  const initial = await first.send("/workforce/plan", body);
  expect(initial.status, JSON.stringify(initial.data)).toBe(200);
  const saved = initial.data.data;
  expect(saved).toMatchObject({ autoSaved: true, hookReplayed: false, goal: body.goal });
  const audit = readPlanHookAudit(saved.hookAudit);
  expect(audit.receipts.map(r => r.event)).toEqual(["beforePlan", "afterPlan"]);
  const exported = await first.send("/workforce/plans/" + saved.planId + "/export");
  expect(exported.status, JSON.stringify(exported.data)).toBe(200);
  expect(readWorkforceHookReceipt(exported.data.data.lifecycleHooks.receipts[0])).toMatchObject({ event: "beforeExport", outcome: "passed" });
  expect(exported.data.data.lifecycleHooks.persisted).toBe(false);
  const sdkExport = await first.client.workforcePlanExport(saved.planId) as any;
  expect(sdkExport.data.lifecycleHooks.receipts[0].payload.planId).toBe(saved.planId);
  const get = await first.send("/workforce/plans/" + saved.planId);
  expect(get.data.data.taskPackage.hookAudit).toEqual(audit);
  expect(get.data.data.taskPackage.lifecycleHooks).toBeUndefined();
  expect(generate).not.toHaveBeenCalled();
  await first.close();
  const restarted = await f.open(), model = vi.spyOn(restarted.app.providerRegistry.get("local-fake-provider"), "generate");
  const replay = await restarted.client.workforcePlan(body) as any;
  expect(replay.data).toMatchObject({ planId: saved.planId, hookReplayed: true, autoSave: { savedAt: saved.autoSave.savedAt } });
  expect(replay.data.hookAudit).toEqual(audit);
  const health = await restarted.send("/workforce/health");
  expect(health.data.data.lifecycleHooks).toMatchObject({ enabled: true, enabledByDefault: false, catalog: expect.arrayContaining([{ kind: "plan", event: "afterPlan", handlerId: "plan.audit", access: "plan-record" }]) });
  expect(model).not.toHaveBeenCalled();
});
it("enforces actual HTTP identity, stable input, and forged-handler boundaries on every planning path", async () => {
  const f = await fixture(), server = await f.open();
  const body = { goal: "Save via the public goal entry", operationId: "save-goal-once" };
  expect((await server.send("/workforce/plan", body, false)).status).toBe(401);
  const missing = await server.send("/workforce/plan", { goal: body.goal });
  expect(missing.status).toBe(400); expect(missing.data.error.code).toBe("WORKFORCE_HOOK_OPERATION_REQUIRED");
  const initial = await server.send("/workforce/plans/save", body);
  expect(initial.status, JSON.stringify(initial.data)).toBe(200);
  const audit = readPlanHookAudit(initial.data.data.taskPackage.hookAudit);
  const duplicate = await server.send("/workforce/plans/save", body);
  expect(duplicate.data.data).toMatchObject({ planId: initial.data.data.planId, hookReplayed: true });
  const changed = await server.send("/workforce/plans/save", { ...body, goal: "Different goal" });
  expect(changed.status).toBe(409);
  const forged = await server.send("/workforce/plan", { ...body, operationId: "forged", hooks: [{ event: "afterPlan", command: "do-not-run" }] });
  expect(forged.status).toBe(400);
  const uploaded = await server.send("/workforce/plans/save", { plan: initial.data.data.taskPackage });
  expect(uploaded.status, JSON.stringify(uploaded.data)).toBe(200);
  expect(uploaded.data.data.taskPackage.hookAudit).toBeUndefined();
  expect((await server.send("/workforce/plans/" + initial.data.data.planId)).data.data.taskPackage.hookAudit).toEqual(audit);
  await expect(server.app.workforceService.getPlan(initial.data.data.planId, "other-tenant")).rejects.toMatchObject({ code: "WORKFORCE_PLAN_NOT_FOUND" });
  const localBody = { goal: "Run local deterministic template roles", operationId: "local-plan-once" };
  const local = await server.send("/workforce/run-local", localBody);
  expect(local.status, JSON.stringify(local.data)).toBe(200);
  expect(readPlanHookAudit(local.data.data.hookAudit).receipts.map(r => r.event)).toEqual(["beforePlan", "afterPlan"]);
  const localAgain = await server.send("/workforce/run-local", localBody);
  expect(localAgain.status, JSON.stringify(localAgain.data)).toBe(200);
  expect(localAgain.data.data).toMatchObject({ planId: local.data.data.planId, hookReplayed: true, providerCallsMade: false });
  expect(localAgain.data.data.hookAudit).toEqual(local.data.data.hookAudit);
});
