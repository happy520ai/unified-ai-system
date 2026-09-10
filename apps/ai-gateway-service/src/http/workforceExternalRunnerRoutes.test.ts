// @test-isolation process
// Real HTTP, Agent Governance, approval store and controller descriptors/recovery IDs.
// Native admission/effect boundaries are substituted; runtime/process execution has separate component tests.
import { createHash } from "node:crypto";
import { once } from "node:events";
import { mkdir, mkdtemp, realpath, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { stableStringify } from "@unified-ai-system/policy-engine";
import type { AgentGovernanceToolProxy } from "../agent-governance/toolProxy.ts";
import { createGatewayApplication } from "../application/createGatewayApplication.js";
import { createGatewayHttpServer } from "./httpServer.js";
import { createControlledExecutor } from "../workforce/workforceControlledExecutor.js";
import { createExecutionLifecycle } from "../workforce/executionLifecycle.js";
import { createWorkforceExternalRunnerReview } from "../workforce/workforceExternalRunnerProfile.ts";
import { createExternalRunnerMetadata, createExternalRunnerState, advanceExternalRunnerState } from "../workforce/workforceExternalRunnerState.ts";
import * as nativeRuntime from "../workforce/workforceExternalRunnerRuntime.ts";

const hash = (value: string) => createHash("sha256").update(value).digest("hex");
const cleanups: Array<() => Promise<void>> = [];
const fullPrompt = "Implement the approved source change.\nRead the complete supplied source and immutable test.\n"
  + JSON.stringify({ files: [{ path: "src/value.mjs", content: "export const value = 1;\n" }, { path: "test/value.test.mjs", content: "assert.equal(value, 2);\n" }] })
  + "\n保留这一整行，不截断。\n";
beforeEach(() => vi.restoreAllMocks());
afterEach(async () => { for (const cleanup of cleanups.splice(0).reverse()) await cleanup(); vi.restoreAllMocks(); });

async function fixture() {
  const root = await mkdtemp(join(await realpath(tmpdir()), "native-runner-routes-")), workspace = join(root, "workspace"); await mkdir(workspace);
  cleanups.push(async () => { expect(await realpath(root)).toBe(root); expect(dirname(root)).toBe(await realpath(tmpdir())); await rm(root, { recursive: true, force: false }); });
  const identity = { tenantId: "native-route-tenant", userId: "native-route-owner", role: "admin", permissions: ["*"] };
  const token = "native-route-fixture-admin";
  const env = { NODE_ENV: "test", AI_GATEWAY_PROVIDER_MODE: "fake", AI_GATEWAY_REAL_PROVIDER_ENABLED: "false",
    PME_RUNTIME_CREDENTIAL_STORE_MODE: "memory", KNOWLEDGE_STORAGE_MODE: "memory", AI_GATEWAY_RATE_LIMIT_WHITELIST: "127.0.0.1",
    AI_GATEWAY_MODEL_LIBRARY_STATE_PATH: join(root, "models.json"), WORKFLOW_OUTPUT_DIR: join(root, "artifacts"),
    WORKFORCE_PLAN_STORE_PATH: join(root, "plans.json"), WORKFORCE_EXECUTION_DIR: join(root, "execution"), WORKFORCE_EXECUTION_ENABLED: "true", AI_GATEWAY_USAGE_LOG_DIR: join(root, "usage"),
    AI_GATEWAY_AGENT_EXEC_WORKING_DIRECTORY: workspace, AI_GATEWAY_AGENT_GOVERNANCE_ENABLED: "true", AI_GATEWAY_AGENT_GOVERNANCE_DATA_DIR: join(root, "governance"),
    AI_GATEWAY_AGENT_GOVERNANCE_HMAC_KEY: "native-route-fixture-signing-0123456789", AI_GATEWAY_LOCAL_CLIENT_REGISTRY_PATH: join(root, "clients.json"),
    AI_GATEWAY_LOCAL_CLIENT_EXECUTION_LOG_PATH: join(root, "clients.jsonl"), AI_GATEWAY_LOCAL_CLIENT_EXECUTION_CONTROL_DIR: join(root, "client-control"),
    PME_ENTERPRISE_AUTH_ENABLED: "true", PME_AUTH_TOKEN: token, PME_AUTH_USER_ID: identity.userId, PME_AUTH_TENANT_ID: identity.tenantId, PME_AUTH_ROLE: "admin",
    PME_ENTERPRISE_PLATFORM_TENANT_ID: identity.tenantId, PME_ENTERPRISE_USER_STORE_PATH: join(root, "users.json"), PME_API_KEY_STORE_PATH: join(root, "keys.json"),
    PME_AUDIT_LOG_PATH: join(root, "audit.jsonl"), PME_AUDIT_CHAIN_PATH: join(root, "audit-chain.jsonl") };
  const app = createGatewayApplication(env) as any, service = app.agentGovernance.service;
  const toolProxy = app.agentGovernance.toolProxy as AgentGovernanceToolProxy;
  cleanups.push(async () => { await app.workforceExecutor.close(); });
  const provider = vi.spyOn(app.providerRegistry.get("local-fake-provider"), "generate");
  const tools = ["workforce_execute", "workforce_external_runner_recover", "file_read", "file_write", "file_edit", "workforce_verify_snapshot"];
  await service.createPolicyVersion({ policyKey: "execution-family", version: 3, policyType: "family", scopeKey: "execution", content: {
    capabilityCeiling: tools, toolRules: { ...Object.fromEntries(tools.map(name => [name, "allow"])), workforce_execute: "require_approval" },
    limits: { maxSteps: 30, maxToolCalls: 60, maxRuntimeSeconds: 180, maxWorkforceRoles: 12 },
    permissions: { canCreateChildren: true, canWrite: true, canSendExternalMessage: false, canExecuteCode: true } } }, identity);
  await service.activatePolicyVersion("execution-family", 3, identity);
  const agentInput = { name: "native-route", task: "执行代码修改任务", requestedTools: tools, ttlSeconds: 3600, proposedTraits: ["write_capable", "code_execution"], proposedRiskLevel: "high" };
  const agent = await service.generateAgent(agentInput, identity);
  const draft: any = { version: 1, mode: "codex-app-server-owned-worktree", profileId: "native-route", projectId: "fixture", roleId: "backend-engineer", baselineRevision: "a".repeat(40),
    binary: { path: process.platform === "win32" ? join(root, "codex.exe") : join(root, "codex"), sha256: "b".repeat(64), version: "0.153.4", platform: process.platform },
    nativeModel: { modelId: "fixture-native-model", providerId: "openai" }, disabledMcpServers: ["fixture_server"],
    limits: { timeoutMs: 30000, maxInputBytes: 16384, maxMessageBytes: 65536, maxEvents: 64 }, artifact: { readPaths: ["src/value.mjs", "test/value.test.mjs"], writePaths: ["src/value.mjs"],
      verification: { verificationId: "immutable-tests", command: "node --test test/value.test.mjs", immutableTests: [{ path: "test/value.test.mjs", sha256: "c".repeat(64) }],
        image: "node@sha256:" + "d".repeat(64), workspaceMode: "ro", networkAccess: false, timeoutMs: 10000, maxMemoryMB: 128, maxOutputBytes: 8192, pidsLimit: 32, cpus: 1 },
      artifactLimits: { maxChangedFiles: 1, maxFileBytes: 8192, maxDiffBytes: 16384 } } };
  const nativeFactory = nativeRuntime.createWorkforceExternalRunnerFactory({ repoRoot: workspace, enginePath: join(root, "fixture-engine"),
    windowsHost: { path: join(root, "workforce-native-job-host.exe"), sha256: "e".repeat(64) } });
  let prompt = fullPrompt;
  const events: string[] = [], capabilities = new WeakMap<object, any>();
  vi.spyOn(nativeRuntime, "reviewWorkforceExternalRunner").mockImplementation(async (_factory, profile, goal) => createWorkforceExternalRunnerReview({ profile, goal,
    configuredRepositoryHash: "sha256:" + "f".repeat(64), sourceFilesHash: "1".repeat(64), prompt }));
  const preflight = vi.spyOn(nativeRuntime, "preflightWorkforceExternalRunner").mockImplementation(async (factory, input) => {
    events.push("native-preflight"); const capability = Object.freeze({ kind: "workforce-external-runner-preflight" as const }); capabilities.set(capability, { factory, ...input }); return capability;
  });
  vi.spyOn(nativeRuntime, "assertWorkforceExternalRunnerPreflight").mockImplementation((value, expected) => {
    const bound = capabilities.get(value as object);
    if (!bound || expected.factory !== undefined && expected.factory !== bound.factory || expected.agentId !== bound.context.agentId
      || expected.tenantId !== bound.identity.tenantId || expected.userId !== bound.identity.userId || expected.planId !== bound.planId
      || expected.planDigest !== bound.planDigest || expected.policyHash !== bound.policy.policyHash) throw Object.assign(new Error("Fixture native admission mismatch"), { code: "WORKFORCE_EXTERNAL_RUNNER_PREFLIGHT_REQUIRED", statusCode: 409 });
  });
  const nativeRun = vi.spyOn(nativeRuntime, "runWorkforceExternalRunner").mockRejectedValue(new Error("Native execution is outside route tests"));
  const recovery = vi.spyOn(nativeRuntime, "recoverWorkforceExternalRunner").mockImplementation(async (_factory, input) => {
    events.push("native-original-read"); return Object.freeze({ state: input.state, recoveredOriginal: true, newNativeTurns: 0, parentAutomaticallyResumed: false });
  });
  const lifecycle = createExecutionLifecycle({ lifecycleDir: join(root, "lifecycle") });
  const executor = createControlledExecutor({ env, repoRoot: workspace, executionDir: env.WORKFORCE_EXECUTION_DIR,
    externalRunnerProfiles: [draft], externalRunnerFactory: nativeFactory, executionLifecycle: lifecycle,
    tierGovernor: { getCurrentTier: async () => ({ autonomyMode: "controlled-execution" }) } } as any);
  await app.workforceExecutor.close(); app.workforceExecutor = executor;
  const input = { goal: "Implement the complete reviewed source change", planId: "native-route-plan", autonomyMode: "controlled-execution",
    agentId: agent.agentId, externalRunner: { profileId: draft.profileId } };
  const descriptor = await executor.describeExecution({ ...input, userId: identity.userId, tenantId: identity.tenantId }), review = descriptor.externalRunner;
  if (!review) throw new Error("The configured native route fixture requires its complete review.");
  const executionId = "native-route-original", metadata = createExternalRunnerMetadata({ agentId: agent.agentId, planId: descriptor.planId, planDigest: descriptor.planDigest, review });
  let saved = createExternalRunnerState({ executionId, taskId: "native-task-original", metadata, identity,
    worktree: { worktreeId: "wt_original", path: workspace, directoryHash: "sha256:" + "2".repeat(64), baselineRevision: draft.baselineRevision, sourceFilesHash: review.sourceFilesHash } });
  await lifecycle.initialize(executionId, { tenantFingerprint: "idfp_" + hash(identity.tenantId).slice(0, 16), subjectFingerprint: "idfp_" + hash(identity.userId).slice(0, 16), externalRunner: metadata });
  await lifecycle.start(executionId); await lifecycle.recordExternalRunnerState(executionId, saved);
  for (const patch of [{ status: "starting", processClosed: false, processIdentity: { kind: "windows-job", hostPid: 9001, childPid: 9002, hostCreated: "134335354337170864", childCreated: "134335354337632843" } },
    { status: "thread_ready", threadId: "thread-original" }, { status: "dispatching" }, { status: "running", turnId: "turn-original", nativeStatus: "inProgress" },
    { status: "unknown", error: { code: "NATIVE_LOST", outcomeUnknown: true } }] as const) {
    saved = advanceExternalRunnerState(saved, metadata, patch); await lifecycle.recordExternalRunnerState(executionId, saved);
  }
  await lifecycle.complete(executionId, "failed");
  const sourceReceipt = { success: true, executionStatus: "completed", executionId, planId: descriptor.planId,
    externalRunner: { metadata, state: saved }, recoveryRequired: true };
  const dispatch = vi.spyOn(executor, "execute").mockImplementation(async (request: any, executionOptions: any) => {
    // Only the native effect is substituted; the real plan approval is still checked before this fixture can return a result.
    const approved = await executor.checkApproval(request, identity.userId);
    if (!approved.approved) throw Object.assign(new Error("Fixture plan approval missing"), { code: "WORKFORCE_APPROVAL_REQUIRED", statusCode: 403 });
    expect(executionOptions.externalRunnerToolProxy).toBe(app.agentGovernance.toolProxy);
    expect(capabilities.has(executionOptions.externalRunnerPreflight)).toBe(true); events.push("native-dispatch"); return structuredClone(sourceReceipt);
  });
  const enforced = vi.spyOn(toolProxy, "enforce");
  const server = createGatewayHttpServer(app) as any;
  cleanups.push(async () => { await new Promise<void>(closed => { server.close(() => closed()); server.closeAllConnections(); }); await server.shutdownResources?.(); await executor.close(); });
  server.listen(0, "127.0.0.1"); await once(server, "listening"); const address = server.address();
  const send = async (path: string, body: unknown, authenticated = true) => {
    const response = await fetch("http://127.0.0.1:" + address.port + path, { method: "POST", headers: { "content-type": "application/json", ...(authenticated ? { authorization: "Bearer " + token } : {}) }, body: JSON.stringify(body) });
    return { status: response.status, payload: await response.json() as any };
  };
  async function approve() {
    const plan = await send("/workforce/execute/approve", { ...input, approvedScopes: descriptor.requiredScopes }); expect(plan.status, JSON.stringify(plan.payload)).toBe(200);
    const pending = await send("/workforce/execute", input); expect(pending.status, JSON.stringify(pending.payload)).toBe(202);
    const human = await send("/v1/approvals/decide", { approvalId: pending.payload.data.approvalId, decision: "approve" }); expect(human.status, JSON.stringify(human.payload)).toBe(200);
    return pending;
  }
  events.length = 0; preflight.mockClear(); enforced.mockClear();
  return { app, service, toolProxy, identity, agent, agentInput, input, descriptor, review, saved, sourceReceipt, executionId, lifecycle, executor, send, approve,
    dispatch, preflight, enforced, recovery, nativeRun, provider, events, setPrompt: (value: string) => { prompt = value; } };
}

it("returns the complete review over real HTTP and preserves it through safe arguments, optionsHash and the approval store", async () => {
  const f = await fixture(); const reviewed = await f.send("/workforce/execute/review", { ...f.input, userId: "spoofed", tenantId: "spoofed" });
  expect(reviewed.status, JSON.stringify(reviewed.payload)).toBe(200); expect(reviewed.payload.data.externalRunner).toEqual(f.review);
  expect(reviewed.payload.data.externalRunner.prompt).toBe(fullPrompt);
  expect(f.preflight.mock.calls[0]![1].identity).toMatchObject(f.identity); expect(f.dispatch).not.toHaveBeenCalled();
  const pending = await f.send("/workforce/execute", f.input); expect(pending.status, JSON.stringify(pending.payload)).toBe(202);
  const call = f.enforced.mock.calls.find(([value]) => value.toolName === "workforce_execute")![0];
  const params = call.params as { options: { externalRunner: typeof f.review } };
  expect(params.options.externalRunner).toEqual(f.review);
  const approval = (await f.service.listApprovals(f.agent.agentId, f.identity.tenantId)).find((record: any) => record.id === pending.payload.data.approvalId);
  expect(approval.review.workforce.options.externalRunner).toEqual(f.review);
  expect(approval.review.workforce.optionsHash).toBe("sha256:" + hash(stableStringify(approval.review.workforce.options)));
  expect(f.dispatch).not.toHaveBeenCalled(); expect(f.nativeRun).not.toHaveBeenCalled(); expect(f.provider).not.toHaveBeenCalled();
}, 30000);

it("requires native preflight and a human approval before the native dispatch boundary", async () => {
  const f = await fixture(); await f.approve(); expect(f.dispatch).not.toHaveBeenCalled();
  const result = await f.send("/workforce/execute", f.input); expect(result.status, JSON.stringify(result.payload)).toBe(200);
  expect(result.payload.data.externalRunner).toEqual(f.sourceReceipt.externalRunner); expect(f.dispatch).toHaveBeenCalledOnce();
  expect(f.events.indexOf("native-preflight")).toBeLessThan(f.events.indexOf("native-dispatch")); expect(f.provider).not.toHaveBeenCalled();
}, 30000);

it("does not consume a previous human approval after any complete prompt change", async () => {
  const f = await fixture(); await f.approve(); f.setPrompt(fullPrompt + "Another explicitly reviewed instruction.\n");
  const result = await f.send("/workforce/execute", f.input); expect(result.status, JSON.stringify(result.payload)).toBe(202); expect(f.dispatch).not.toHaveBeenCalled();
  const approvals = await f.service.listApprovals(f.agent.agentId, f.identity.tenantId);
  expect(approvals.some((record: any) => record.review.workforce.options.externalRunner.prompt.endsWith("Another explicitly reviewed instruction.\n"))).toBe(true);
}, 30000);

it("rejects a non-owning Agent, unauthenticated request and extra selector authority before dispatch", async () => {
  const f = await fixture(), other = await f.service.generateAgent({ ...f.agentInput, name: "other-owner" }, { ...f.identity, userId: "other-owner" });
  const foreign = await f.send("/workforce/execute/review", { ...f.input, agentId: other.agentId }); expect(foreign.status).toBe(403);
  const missingAuth = await f.send("/workforce/execute/review", f.input, false); expect(missingAuth.status).toBe(401);
  const injected = await f.send("/workforce/execute/review", { ...f.input, externalRunner: { profileId: "native-route", args: ["unapproved"] } }); expect(injected.status).toBe(400);
  expect(f.preflight).not.toHaveBeenCalled(); expect(f.dispatch).not.toHaveBeenCalled();
}, 30000);

it("fails native preflight before either approval store or dispatch is reached", async () => {
  const f = await fixture(); f.preflight.mockRejectedValue(Object.assign(new Error("Fixture native unavailable"), { code: "WORKFORCE_EXTERNAL_RUNNER_UNAVAILABLE", statusCode: 503 }));
  for (const path of ["/workforce/execute/review", "/workforce/execute/approve", "/workforce/execute"]) {
    const result = await f.send(path, { ...f.input, approvedScopes: f.descriptor.requiredScopes }); expect(result.status, JSON.stringify(result.payload)).toBe(503);
  }
  expect(await f.service.listApprovals(f.agent.agentId, f.identity.tenantId)).toEqual([]); expect(f.enforced).not.toHaveBeenCalled(); expect(f.dispatch).not.toHaveBeenCalled();
}, 30000);

it("validates recovery JSON and original IDs in the actual route/controller before native observation", async () => {
  const f = await fixture(), body = { executionId: f.executionId, operationId: f.saved.operationId, agentId: f.agent.agentId };
  for (const value of [{ ...body, newTurn: true }, { ...body, operationId: "../wrong" }, { ...body, agentId: "not-an-agent" }]) {
    expect((await f.send("/workforce/execute/external-runner/recover", value)).status).toBe(400);
  }
  const wrong = await f.send("/workforce/execute/external-runner/recover", { ...body, operationId: "other-operation" });
  expect(wrong.status, JSON.stringify(wrong.payload)).toBe(403); expect(wrong.payload.error.code).toBe("WORKFORCE_EXTERNAL_RUNNER_ORIGINAL_MISMATCH");
  const absent = await f.send("/workforce/execute/external-runner/recover", { ...body, executionId: "unknown-execution" }); expect(absent.status).toBe(403);
  expect(f.recovery).not.toHaveBeenCalled(); expect(f.dispatch).not.toHaveBeenCalled();
}, 30000);

it("returns the original recovery receipt without dispatching a new turn or rewriting the saved record", async () => {
  const f = await fixture();
  const before = await f.lifecycle.getStatus(f.executionId) as { externalRunner: typeof f.sourceReceipt.externalRunner };
  const audited = vi.spyOn(f.toolProxy, "enforceResult");
  const result = await f.send("/workforce/execute/external-runner/recover", { executionId: f.executionId, operationId: f.saved.operationId, agentId: f.agent.agentId });
  const metered = await audited.mock.results[0]!.value;
  expect(metered.result).toEqual(audited.mock.calls[0]![0].result);
  expect(result.status, JSON.stringify(result.payload)).toBe(200);
  expect(result.payload.data).toMatchObject({ recoveredOriginal: true, newNativeTurns: 0, parentAutomaticallyResumed: false, parentExecutionResumed: false, employeeRolesRerun: false });
  const after = await f.lifecycle.getStatus(f.executionId) as typeof before;
  expect(result.payload.data.state).toEqual(f.saved); expect(after.externalRunner).toEqual(before.externalRunner);
  expect(f.recovery).toHaveBeenCalledOnce(); expect(f.dispatch).not.toHaveBeenCalled(); expect(f.nativeRun).not.toHaveBeenCalled(); expect(f.provider).not.toHaveBeenCalled();
}, 30000);

it("refuses a confirmed native result when terminal governance changes its record", async () => {
  const f = await fixture(); await f.approve(); const original = f.app.agentGovernance.toolProxy.enforceResult.bind(f.app.agentGovernance.toolProxy);
  vi.spyOn(f.app.agentGovernance.toolProxy, "enforceResult").mockImplementation(async (input: any) => {
    const result = await original(input); return { ...result, result: { ...result.result, externalRunner: { changed: true } } };
  });
  const result = await f.send("/workforce/execute", f.input);
  expect(result.status, JSON.stringify(result.payload)).toBe(503); expect(result.payload.error.code).toBe("WORKFORCE_EXTERNAL_EFFECT_OUTCOME_UNCERTAIN");
  expect(result.payload.error.details).toMatchObject({ outcomeUnknown: true, retrySafe: false }); expect(result.payload.data).toBeUndefined(); expect(f.dispatch).toHaveBeenCalledOnce();
}, 30000);

it("refuses a recovery receipt changed by terminal governance", async () => {
  const f = await fixture(), original = f.app.agentGovernance.toolProxy.enforceResult.bind(f.app.agentGovernance.toolProxy);
  vi.spyOn(f.app.agentGovernance.toolProxy, "enforceResult").mockImplementation(async (input: any) => {
    const result = await original(input); return { ...result, result: { ...result.result, newNativeTurns: 1 } };
  });
  const result = await f.send("/workforce/execute/external-runner/recover", { executionId: f.executionId, operationId: f.saved.operationId, agentId: f.agent.agentId });
  expect(result.status, JSON.stringify(result.payload)).toBe(503); expect(result.payload.error.code).toBe("WORKFORCE_EXTERNAL_RUNNER_RECOVERY_RESULT_UNAVAILABLE");
  expect(result.payload.data).toBeUndefined(); expect(f.recovery).toHaveBeenCalledOnce(); expect(f.nativeRun).not.toHaveBeenCalled();
}, 30000);
