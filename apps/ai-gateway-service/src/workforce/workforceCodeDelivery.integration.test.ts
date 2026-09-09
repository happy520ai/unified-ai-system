// @test-isolation process
import { once } from "node:events";
import { mkdir, mkdtemp, realpath, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { afterEach, expect, it, vi } from "vitest";
import { createGatewayApplication } from "../application/createGatewayApplication.js";
import { createGatewayHttpServer } from "../http/httpServer.js";
import { createControlledExecutor } from "./workforceControlledExecutor.js";
import { createWorkforcePlan } from "./workforcePlanner.js";
import { freezeWorkforceRoleExecutionProfile } from "./workforceRoleExecutionProfile.ts";

const cleanups: (() => Promise<unknown>)[] = [];
afterEach(async () => { for (const cleanup of cleanups.splice(0).reverse()) await cleanup(); vi.restoreAllMocks(); });
function profile(): any {
  return { version: 1, mode: "forge-owned-worktree-artifact", profileId: "code-fixture", projectId: "fixture",
    baselineRevision: "a".repeat(40), roleId: "backend-engineer", readPaths: ["src/value.mjs", "test/value.test.mjs"],
    writePaths: ["src/value.mjs"], verification: { verificationId: "existing-tests", command: "node --test test/value.test.mjs",
      immutableTests: [{ path: "test/value.test.mjs", sha256: "b".repeat(64) }], image: "node-fixture@sha256:" + "c".repeat(64),
      workspaceMode: "ro", networkAccess: false, timeoutMs: 10000, maxMemoryMB: 128, maxOutputBytes: 65536, pidsLimit: 32, cpus: 1 },
    artifactLimits: { maxChangedFiles: 1, maxFileBytes: 65536, maxDiffBytes: 262144 } };
}
async function fixture() {
  const root = await mkdtemp(join(await realpath(tmpdir()), "code-delivery-http-"));
  cleanups.push(async () => { expect(await realpath(root)).toBe(root); expect(dirname(root)).toBe(await realpath(tmpdir())); await rm(root, { recursive: true, force: true }); });
  const workspace = join(root, "workspace"); await mkdir(workspace);
  const token = "code-delivery-fixture-admin";
  const env = { NODE_ENV: "test", AI_GATEWAY_PROVIDER_MODE: "fake", AI_GATEWAY_REAL_PROVIDER_ENABLED: "false",
    PME_RUNTIME_CREDENTIAL_STORE_MODE: "memory", KNOWLEDGE_STORAGE_MODE: "memory", AI_GATEWAY_RATE_LIMIT_WHITELIST: "127.0.0.1",
    AI_GATEWAY_MODEL_LIBRARY_STATE_PATH: join(root, "models.json"), WORKFLOW_OUTPUT_DIR: join(root, "artifacts"),
    WORKFORCE_PLAN_STORE_PATH: join(root, "plans.json"), WORKFORCE_EXECUTION_DIR: join(root, "execution"),
    WORKFORCE_EXECUTION_ENABLED: "true", AI_GATEWAY_USAGE_LOG_DIR: join(root, "usage"),
    AI_GATEWAY_AGENT_EXEC_WORKING_DIRECTORY: workspace, AI_GATEWAY_AGENT_GOVERNANCE_ENABLED: "true",
    AI_GATEWAY_AGENT_GOVERNANCE_DATA_DIR: join(root, "governance"), AI_GATEWAY_AGENT_GOVERNANCE_HMAC_KEY: "code-fixture-signing-material-0123456789",
    AI_GATEWAY_LOCAL_CLIENT_REGISTRY_PATH: join(root, "clients.json"), AI_GATEWAY_LOCAL_CLIENT_EXECUTION_LOG_PATH: join(root, "clients.jsonl"),
    AI_GATEWAY_LOCAL_CLIENT_EXECUTION_CONTROL_DIR: join(root, "client-control"),
    PME_ENTERPRISE_AUTH_ENABLED: "true", PME_AUTH_TOKEN: token, PME_AUTH_USER_ID: "code-owner", PME_AUTH_TENANT_ID: "code-tenant",
    PME_AUTH_ROLE: "admin", PME_ENTERPRISE_PLATFORM_TENANT_ID: "code-tenant", PME_ENTERPRISE_USER_STORE_PATH: join(root, "users.json"),
    PME_API_KEY_STORE_PATH: join(root, "keys.json"), PME_AUDIT_LOG_PATH: join(root, "audit.jsonl"), PME_AUDIT_CHAIN_PATH: join(root, "audit-chain.jsonl") };
  const app = createGatewayApplication(env) as any;
  const calls = vi.spyOn(app.providerRegistry.get("local-fake-provider"), "generate");
  const plan = createWorkforcePlan({ goal: "Implement a bounded source change" });
  const bindings = plan.taskBreakdown.map((task: any) => ({ roleId: task.roleId, employeeId: "employee-" + task.roleId,
    providerId: "local-fake-provider", modelId: "local-fake-model", maxRequests: task.roleId === "backend-engineer" ? 3 : 1,
    maxInputTokens: 100000, maxOutputTokens: 16384, timeoutMs: 30000 }));
  const roleProfile = freezeWorkforceRoleExecutionProfile({ version: 1, mode: "gateway-llm-required", profileId: "code-role-fixture",
    maxTotalRequests: bindings.length + 2, maxConcurrentRoles: 1, bindings });
  const approval = { approve: vi.fn(async () => ({ approved: true, approval: { approvalId: "fixture-approved" } })),
    check: vi.fn(async () => ({ approved: true })), consume: vi.fn(async () => ({ approved: false, code: "fixture-no-approval" })) };
  const worktree = { getInfo: () => ({}), create: vi.fn(async () => ({ success: false })), remove: vi.fn() };
  const forRun = vi.fn(() => { throw new Error("Role dispatch is not available in this static fixture"); });
  const fakeFactory = { ready: true, supportsIsolatedProjectRoot: true, preflight: vi.fn(async () => {}),
    forTask: vi.fn(async () => ({ execute: async () => ({ success: true }) })) };
  const profiles = [profile()];
  const executor = createControlledExecutor({ env, repoRoot: workspace, executionDir: env.WORKFORCE_EXECUTION_DIR,
    codeDeliveryProfiles: profiles, codeDeliveryFactory: fakeFactory, roleProviderFactory: { profile: roleProfile, forRun },
    approvalGate: approval, executionLifecycle: { getInfo: () => ({}) }, taskQueueManager: { close: async () => {} },
    worktreeIsolation: worktree, workspaceGuard: { check: async () => ({ clean: true }) },
    securityCheckpoint: { preExecutionCheck: async () => ({ result: "pass" }) }, evidenceCapture: {},
    sandboxMerger: {}, tierGovernor: { getCurrentTier: async () => ({ autonomyMode: "controlled-execution" }) } } as any);
  await app.workforceExecutor.close(); app.workforceExecutor = executor;
  const enforced = vi.spyOn(app.agentGovernance.toolProxy, "enforce");
  const server = createGatewayHttpServer(app) as any;
  cleanups.push(async () => { await new Promise<void>(resolve => { server.close(() => resolve()); server.closeAllConnections(); }); await server.shutdownResources?.(); await executor.close(); });
  server.listen(0, "127.0.0.1"); await once(server, "listening");
  const address = server.address(); if (!address || typeof address === "string") throw new Error("Fixture listener missing");
  const send = async (path: string, body: unknown) => {
    const response = await fetch("http://127.0.0.1:" + address.port + path, { method: "POST",
      headers: { authorization: "Bearer " + token, "content-type": "application/json" }, body: JSON.stringify(body) });
    return { status: response.status, payload: await response.json() as any };
  };
  const agent = await send("/v1/agents/generate", { name: "code-fixture", task: "Review bounded source work",
    requestedTools: ["workforce_execute"], ttlSeconds: 3600 });
  expect(agent.status, JSON.stringify(agent.payload)).toBe(200);
  enforced.mockClear();
  const input = { goal: "Implement a bounded source change", planId: "code-plan", autonomyMode: "controlled-execution",
    agentId: agent.payload.data.agentId, codeDelivery: { profileId: "code-fixture" } };
  return { executor, input, send, approval, worktree, forRun, calls, enforced, fakeFactory, profiles, roleProfile, workspace };
}

it("keeps every real HTTP and direct code entry before both approvals, Provider and worktree effects", async () => {
  const f = await fixture();
  const descriptor = await f.executor.describeExecution(f.input);
  expect.soft(descriptor.codeDeliveryReadiness).toMatchObject({ executionAllowed: false, implementation: "unavailable",
    container: "not-checked", policy: "not-checked", worktree: "not-created", verification: "not-run" });
  expect.soft(descriptor.codeDelivery?.profile.profileId).toBe("code-fixture");
  f.profiles[0].verification.command = "must-not-be-adopted";
  expect.soft((await f.executor.describeExecution(f.input)).codeDelivery?.profile.verification.command).toBe("node --test test/value.test.mjs");
  for (const path of ["/workforce/execute", "/workforce/execute/approve"]) {
    const result = await f.send(path, { ...f.input, approvedScopes: ["workforce:execute"],
      codeDeliveryFactory: { ready: true }, codeDeliveryRuntime: { implemented: true } });
    expect.soft(result.status, path + JSON.stringify(result.payload)).toBe(503);
    expect.soft(result.payload.error?.code).toBe("WORKFORCE_CODE_DELIVERY_IMPLEMENTATION_UNAVAILABLE");
  }
  for (const operation of [() => f.executor.approveExecution(f.input, "code-owner", ["workforce:execute"]),
    () => f.executor.checkApproval(f.input, "code-owner"), () => f.executor.execute(f.input)]) {
    await expect.soft(operation()).rejects.toMatchObject({ code: "WORKFORCE_CODE_DELIVERY_IMPLEMENTATION_UNAVAILABLE" });
  }
  for (const spy of [f.enforced, f.approval.approve, f.approval.check, f.approval.consume,
    f.worktree.create, f.forRun, f.calls, f.fakeFactory.preflight, f.fakeFactory.forTask]) expect.soft(spy).not.toHaveBeenCalled();
}, 30000);

it("validates the exact selector and keeps absent codeDelivery descriptors unchanged", async () => {
  const f = await fixture();
  const { codeDelivery: _unused, ...analysis } = f.input;
  const baseline = await f.executor.describeExecution(analysis);
  expect(baseline).not.toHaveProperty("codeDelivery"); expect(baseline).not.toHaveProperty("codeDeliveryReadiness");
  for (const value of [null, false, "code-fixture", {}, { profileId: "code-fixture", ready: true }]) {
    await expect(f.executor.describeExecution({ ...analysis, codeDelivery: value })).rejects.toMatchObject({ code: "WORKFORCE_CODE_DELIVERY_REQUEST_INVALID" });
  }
  await expect(f.executor.describeExecution({ ...analysis, codeDelivery: { profileId: "absent" } })).rejects.toMatchObject({ code: "WORKFORCE_CODE_DELIVERY_PROFILE_NOT_FOUND" });
  expect(await f.executor.describeExecution(analysis)).toEqual(baseline);
  expect(f.enforced).not.toHaveBeenCalled(); expect(f.approval.approve).not.toHaveBeenCalled(); expect(f.worktree.create).not.toHaveBeenCalled();
}, 30000);
