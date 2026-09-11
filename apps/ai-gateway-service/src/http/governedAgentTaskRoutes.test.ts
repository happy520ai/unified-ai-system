// @test-isolation process
// Actual HTTP/application, signed queue, Git repository, Agent policy and approvals; only the fake model response is scripted.
import { createHash, randomUUID } from "node:crypto";
import { once } from "node:events";
import { existsSync } from "node:fs";
import { mkdir, mkdtemp, realpath, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { Readable } from "node:stream";
import { afterEach, expect, it, vi } from "vitest";
import { createGatewayApplication } from "../application/createGatewayApplication.js";
import { createWorkforceGit } from "../workforce/workforceGit.ts";
import { createGatewayHttpServer } from "./httpServer.js";
import { createRouteConcurrencyAdmission } from "./routeConcurrencyAdmission.ts";
import { createRouteRateLimiter } from "./routeRateLimiter.js";
import { resolveRuntimeRoutePermissionOverride } from "./runtimeRouteAccessManifest.ts";
import { dispatchGovernedAgentTaskRoutes } from "./governedAgentTaskRoutes.ts";
import { bindVirtualKeyRequestAccounting, createVirtualKeyRequestAccounting, getVirtualKeyRequestAccounting } from "../enterprise/virtualKeyRequestAccounting.ts";

const cleanup: Array<() => Promise<void>> = [];
afterEach(async () => { for (const close of cleanup.splice(0).reverse()) await close(); vi.restoreAllMocks(); });
const digest = (value: string) => createHash("sha256").update(value).digest("hex");
const prompt = "  Preserve this entire original instruction.\r\n检查原始源码并修改为二。\n";
async function fixture(configured = true) {
  const root = await mkdtemp(join(await realpath(tmpdir()), "governed-task-routes-")), repoRoot = join(root, "repo");
  cleanup.push(async () => { expect(await realpath(root)).toBe(root); expect(dirname(root)).toBe(await realpath(tmpdir())); await rm(root, { recursive: true, force: false }); });
  await mkdir(repoRoot); await mkdir(join(root, "scratch"));
  const test = "import test from 'node:test'; import assert from 'node:assert/strict'; import {value} from './source.mjs'; test('actual value',()=>assert.equal(value,2));\n";
  await writeFile(join(repoRoot, "source.mjs"), "export const value = 1;\n"); await writeFile(join(repoRoot, "test.mjs"), test);
  const git = createWorkforceGit(repoRoot);
  await git.run(["-c", "init.templateDir=", "init", "--initial-branch=main"]); await git.run(["add", "source.mjs", "test.mjs"]);
  await git.run(["-c", "user.name=Route Fixture", "-c", "user.email=fixture@example.invalid", "-c", "commit.gpgSign=false", "commit", "-m", "Fixture"]);
  const profile = { version: 1, mode: "governed-agent-long-task", profileId: "route-profile", projectId: "route-project",
    baselineRevision: (await git.run(["rev-parse", "HEAD"])).stdout.trim(),
    model: { providerId: "local-fake-provider", modelId: "local-fake-model", maxInputTokens: 16384, maxOutputTokens: 2048 },
    limits: { maxPlanSteps: 3, maxIterations: 6, maxModelCalls: 7, maxTotalTokens: 129024, maxRepairAttempts: 1, chunkTimeoutMs: 30000, maxInputBytes: 65536 },
    verificationResult: { version: 1, adapter: "node-test", minimumPassed: 1, requiredChecks: [{ file: "test.mjs", name: "actual value" }] },
    artifact: { readPaths: ["source.mjs", "test.mjs"], writePaths: ["source.mjs"], verification: { verificationId: "fixed-test", command: "node --test 'test.mjs'",
      immutableTests: [{ path: "test.mjs", sha256: digest(test) }], image: "node@sha256:" + "d".repeat(64), workspaceMode: "ro", networkAccess: false,
      timeoutMs: 10000, maxMemoryMB: 128, maxOutputBytes: 4096, pidsLimit: 32, cpus: 1 }, artifactLimits: { maxChangedFiles: 1, maxFileBytes: 4096, maxDiffBytes: 8192 } } };
  const configuration = { profile, repoRoot, worktreeRoot: join(root, "worktrees"), scratchRoot: join(root, "scratch"), enginePath: join(root, "fixture-engine") };
  const token = "route-fixture-local-admin", identity = { tenantId: "route-tenant", userId: "route-owner", role: "admin", permissions: ["*"] };
  const env = { NODE_ENV: "test", AI_GATEWAY_PROVIDER_MODE: "fake", AI_GATEWAY_REAL_PROVIDER_ENABLED: "false", PME_RUNTIME_CREDENTIAL_STORE_MODE: "memory",
    KNOWLEDGE_STORAGE_MODE: "memory", AI_GATEWAY_RATE_LIMIT_WHITELIST: "127.0.0.1", AI_GATEWAY_MODEL_LIBRARY_STATE_PATH: join(root, "models.json"),
    WORKFLOW_OUTPUT_DIR: join(root, "artifacts"), WORKFORCE_PLAN_STORE_PATH: join(root, "plans.json"), WORKFORCE_EXECUTION_DIR: join(root, "execution"),
    AI_GATEWAY_USAGE_LOG_DIR: join(root, "usage"), AI_GATEWAY_AGENT_EXEC_WORKING_DIRECTORY: repoRoot,
    AI_GATEWAY_AGENT_GOVERNANCE_ENABLED: "true", AI_GATEWAY_AGENT_GOVERNANCE_DATA_DIR: join(root, "governance"),
    AI_GATEWAY_AGENT_GOVERNANCE_HMAC_KEY: "route-fixture-signing-0123456789abcdef", AI_GATEWAY_LOCAL_CLIENT_REGISTRY_PATH: join(root, "clients.json"),
    AI_GATEWAY_LOCAL_CLIENT_EXECUTION_LOG_PATH: join(root, "clients.jsonl"), AI_GATEWAY_LOCAL_CLIENT_EXECUTION_CONTROL_DIR: join(root, "client-control"),
    PME_ENTERPRISE_AUTH_ENABLED: "true", PME_AUTH_TOKEN: token, PME_AUTH_USER_ID: identity.userId, PME_AUTH_TENANT_ID: identity.tenantId, PME_AUTH_ROLE: "admin",
    PME_ENTERPRISE_PLATFORM_TENANT_ID: identity.tenantId, PME_ENTERPRISE_USER_STORE_PATH: join(root, "users.json"), PME_API_KEY_STORE_PATH: join(root, "keys.json"),
    PME_AUDIT_LOG_PATH: join(root, "audit.jsonl"), PME_AUDIT_CHAIN_PATH: join(root, "audit-chain.jsonl"),
    ...(configured ? { AI_GATEWAY_AGENT_LONG_TASK_CONFIG_JSON: JSON.stringify(configuration) } : {}) };
  const app = createGatewayApplication(env) as any, service = app.agentGovernance.service;
  cleanup.push(async () => { await app.closeAgentLongTaskRuntime(); await app.workforceExecutor.close(); });
  const tools = ["file_read", "file_write", "file_edit", "workforce_verify_snapshot"];
  await service.createPolicyVersion({ policyKey: "execution-family", version: 3, policyType: "family", scopeKey: "execution", content: {
    capabilityCeiling: tools, toolRules: Object.fromEntries(tools.map(name => [name, "allow"])), requirements: { sandboxRequired: false },
    limits: { maxSteps: 30, maxToolCalls: 60, maxRuntimeSeconds: 180 }, permissions: { canCreateChildren: true, canWrite: true, canSendExternalMessage: false, canExecuteCode: true } } }, identity);
  await service.activatePolicyVersion("execution-family", 3, identity);
  const agentInput = { name: "route-task", task: "执行代码修改任务", requestedTools: tools, ttlSeconds: 3600, proposedTraits: ["write_capable", "code_execution"], proposedRiskLevel: "high" };
  const agent = await service.generateAgent(agentInput, identity);
  const generate = vi.spyOn(app.providerRegistry.get("local-fake-provider"), "generate").mockImplementation(async (input: any) => {
    const data = JSON.parse(input.request.messages[1].content);
    const text = JSON.stringify({ version: 1, reviewHash: data.review.reviewHash, steps: [
      { id: "inspect", kind: "inspect", title: "Read the entire source", paths: ["source.mjs"] },
      { id: "implement", kind: "implement", title: "Set the source to two", paths: ["source.mjs"] },
      { id: "verify", kind: "verify", title: "Run the immutable test", paths: ["test.mjs"] }] });
    return { text, message: { role: "assistant", content: text }, usage: { inputTokens: 101, outputTokens: 29, totalTokens: 130 }, executionStatus: "success",
      latencyMs: 0, raw: { finishReason: "stop", workforceObservation: { contentPresent: true, usageReported: { inputTokens: true, outputTokens: true, totalTokens: true } } }, warnings: [] };
  });
  const server = createGatewayHttpServer(app) as any;
  cleanup.push(async () => { await server.shutdownResources(); await new Promise<void>(done => { server.close(() => done()); server.closeAllConnections(); }); });
  server.listen(0, "127.0.0.1"); await once(server, "listening"); const port = server.address().port;
  const send = async (path: string, body?: unknown, authenticated = true) => {
    const response = await fetch(`http://127.0.0.1:${port}${path}`, { method: body === undefined ? "GET" : "POST",
      headers: { "content-type": "application/json", ...(authenticated ? { authorization: "Bearer " + token } : {}) },
      ...(body === undefined ? {} : { body: typeof body === "string" ? body : JSON.stringify(body) }) });
    return { status: response.status, payload: await response.json() as any };
  };
  const base = `/v1/agents/${agent.agentId}/tasks`, prepare = () => send(base, { goal: "Set value to two", prompt });
  return { app, env, configuration, root, repoRoot, service, agent, agentInput, identity, base, prepare, send, generate, server,
    queueFile: join(root, "governance", "agent-long-tasks.json") };
}

it("stays dormant without configuration and refuses malformed or distributed configuration explicitly", async () => {
  const f = await fixture(false); expect(existsSync(f.queueFile)).toBe(false);
  const result = await f.prepare(); expect(result.status).toBe(503); expect(existsSync(f.queueFile)).toBe(false); expect(f.generate).not.toHaveBeenCalled();
  for (const value of ["", "{", "{}", JSON.stringify({ ...f.configuration, extra: true })]) {
    expect(() => createGatewayApplication({ ...f.env, AI_GATEWAY_AGENT_LONG_TASK_CONFIG_JSON: value })).toThrow();
  }
  for (const extra of [{ AI_GATEWAY_MULTI_INSTANCE: "true" }, { AI_GATEWAY_WORKFORCE_CLAIM_STORE_MODE: "postgres" }, { AI_GATEWAY_AGENT_GOVERNANCE_ENABLED: "false" }]) {
    expect(() => createGatewayApplication({ ...f.env, ...extra, AI_GATEWAY_AGENT_LONG_TASK_CONFIG_JSON: JSON.stringify(f.configuration) })).toThrow();
  }
});
it("initializes once and preserves complete review through plan and existing human approval over actual HTTP", async () => {
  const f = await fixture(); expect(existsSync(f.queueFile)).toBe(false);
  await expect(f.app.getAgentLongTaskRuntime()).resolves.toHaveProperty("profile.profileHash");
  const prepared = await f.prepare(); expect(prepared.status, JSON.stringify(prepared.payload)).toBe(200);
  const task = prepared.payload.data, path = `${f.base}/${task.taskId}`;
  expect(task.review.prompt).toBe(prompt); expect(task.sourceFiles).toHaveLength(2); expect(task.phase).toBe("prepared");
  expect(task.review.profile.verificationResult).toEqual({ version: 1, adapter: "node-test", minimumPassed: 1,
    requiredChecks: [{ file: "test.mjs", name: "actual value" }] });
  expect(task.review.profile.artifact.verification.command).toBe("node --test 'test.mjs'");
  const runtimes = await Promise.all([f.app.getAgentLongTaskRuntime(), f.app.getAgentLongTaskRuntime()]); expect(runtimes[0]).toBe(runtimes[1]);
  const planned = await f.send(path + "/plan", { revision: task.revision }); expect(planned.status, JSON.stringify(planned.payload)).toBe(200);
  const plan = planned.payload.data; expect(plan.phase).toBe("awaiting_confirmation"); expect(plan.modelReceipts).toHaveLength(1);
  expect(f.generate).toHaveBeenCalledOnce(); expect(JSON.parse((f.generate.mock.calls[0]![0] as any).request.messages[1].content).review.prompt).toBe(prompt);
  const confirmation = { revision: plan.revision, reviewHash: plan.review.reviewHash, planHash: plan.plan.planHash, approvalId: plan.approvalId };
  const rejected = await f.send(path + "/confirm", confirmation); expect(rejected.status).toBe(403);
  const human = await f.send("/v1/approvals/decide", { approvalId: plan.approvalId, decision: "approve" }); expect(human.status, JSON.stringify(human.payload)).toBe(200);
  const current = await f.send(path); const confirmed = await f.send(path + "/confirm", { ...confirmation, revision: current.payload.data.revision });
  expect(confirmed.status, JSON.stringify(confirmed.payload)).toBe(200); expect(confirmed.payload.data.phase).toBe("paused");
  expect(confirmed.payload.data.confirmedApprovalId).toBe(plan.approvalId); expect(f.generate).toHaveBeenCalledOnce();
  f.generate.mockImplementationOnce(async () => ({ text: "", message: { role: "assistant", content: "", tool_calls: [
    { id: "read-source", type: "function", function: { name: "file_read", arguments: JSON.stringify({ file_path: "source.mjs" }) } }] },
    toolCalls: [{ id: "read-source", name: "file_read", arguments: { file_path: "source.mjs" } }],
    usage: { inputTokens: 101, outputTokens: 29, totalTokens: 130 }, executionStatus: "success", latencyMs: 0,
    raw: { finishReason: "tool_calls", workforceObservation: { contentPresent: true, usageReported: { inputTokens: true, outputTokens: true, totalTokens: true } } }, warnings: [] }));
  const paused = await f.send(path + "/run", { revision: confirmed.payload.data.revision, maxIterations: 1 });
  expect(paused.status, JSON.stringify(paused.payload)).toBe(200);
  expect(paused.payload.data).toMatchObject({ taskId: task.taskId, agentRunId: task.agentRunId, phase: "paused", stepIndex: 1,
    counters: { iterations: 1, modelCalls: 2 }, pendingOperation: null });
  expect(paused.payload.data.stepReceipts[0]).toMatchObject({ stepId: "inspect", toolName: "file_read", fullRead: true });
  expect(f.generate).toHaveBeenCalledTimes(2);
}, 30000);
it("rejects missing authentication, malformed JSON and authority overrides before opening the queue", async () => {
  const f = await fixture(); expect((await f.send(f.base, { goal: "x", prompt }, false)).status).toBe(401);
  expect((await f.send(f.base, "{")).status).toBe(400);
  for (const override of [{ tenantId: "other" }, { agentId: "agt_other" }, { model: "other" }, { profileId: "other" }, { repoRoot: f.repoRoot }, { tools: [] }]) {
    expect((await f.send(f.base, { goal: "x", prompt, ...override })).status).toBe(400);
  }
  const taskPath = `${f.base}/${randomUUID()}`;
  for (const action of ["plan", "confirm", "run", "pause", "cancel"]) {
    expect((await f.send(taskPath + "/" + action, { revision: 0, override: true })).status).toBe(400);
  }
  expect((await f.send(taskPath + "/run", { revision: 0, maxIterations: 11 })).status).toBe(400);
  expect((await f.send(f.base + "?profileId=other", { goal: "x", prompt })).status).toBe(400);
  expect(existsSync(f.queueFile)).toBe(false); expect(f.generate).not.toHaveBeenCalled();
});
it("preserves explicit Agent delegation while binding every retained operation to the original task owner and Agent", async () => {
  const f = await fixture(), created = await f.prepare(); expect(created.status, JSON.stringify(created.payload)).toBe(200);
  const other = await f.service.generateAgent(f.agentInput, { ...f.identity, userId: "other-owner" });
  const delegated = await f.send(`/v1/agents/${other.agentId}/tasks`, { goal: "x", prompt }); expect(delegated.status).toBe(200);
  expect((await f.send(`/v1/agents/${other.agentId}/tasks/${delegated.payload.data.taskId}`)).status).toBe(200);
  const runtime = await f.app.getAgentLongTaskRuntime(), execution = { signal: new AbortController().signal, timeoutMs: 30000, deadlineAt: Date.now() + 30000 };
  await expect(runtime.prepare({ ...f.identity, agentId: other.agentId, role: "operator", permissions: ["workflow:run"], execution }, { goal: "x", prompt }))
    .rejects.toMatchObject({ statusCode: 403 });
  const original = await runtime.prepare({ ...f.identity, userId: "other-owner", agentId: other.agentId, execution }, { goal: "other owner's original", prompt });
  const foreignPath = `/v1/agents/${other.agentId}/tasks/${original.taskId}`;
  expect((await f.send(foreignPath)).status).toBe(404);
  for (const action of ["plan", "confirm", "run", "pause", "cancel"]) {
    const body = { revision: original.revision, ...(action === "confirm" ? { reviewHash: original.review.reviewHash, planHash: "sha256:" + "a".repeat(64), approvalId: "approval_fixture" } : {}) };
    expect((await f.send(foreignPath + "/" + action, body)).status).toBe(404);
  }
  const ownOther = await f.service.generateAgent(f.agentInput, f.identity);
  const read = await f.send(`/v1/agents/${ownOther.agentId}/tasks/${created.payload.data.taskId}`);
  expect(read.status).toBe(404); expect(f.generate).not.toHaveBeenCalled();
}, 30000);
it("refuses run before approved planning and stale revision while keeping cancel and reads available", async () => {
  const f = await fixture(), prepared = await f.prepare(); expect(prepared.status, JSON.stringify(prepared.payload)).toBe(200);
  const path = `${f.base}/${prepared.payload.data.taskId}`;
  expect((await f.send(path + "/run", { revision: 999 })).status).toBe(409);
  expect((await f.send(path + "/run", { revision: prepared.payload.data.revision })).status).toBe(403);
  const current = await f.send(path); expect(current.status).toBe(200);
  const stopped = await f.send(path + "/cancel", { revision: current.payload.data.revision });
  expect(stopped.status, JSON.stringify(stopped.payload)).toBe(200); expect(stopped.payload.data.phase).toBe("cancelled"); expect(f.generate).not.toHaveBeenCalled();
});
it("aborts and drains the active model call before releasing the signed queue on application shutdown", async () => {
  const f = await fixture(), prepared = await f.prepare(); expect(prepared.status, JSON.stringify(prepared.payload)).toBe(200);
  let started!: () => void; const entered = new Promise<void>(resolve => { started = resolve; }); let drained = false;
  f.generate.mockImplementationOnce((input: any) => new Promise((_resolve, reject) => {
    const abort = () => { drained = true; reject(input.execution.signal.reason); };
    input.execution.signal.addEventListener("abort", abort, { once: true }); started();
  }));
  const request = f.send(`${f.base}/${prepared.payload.data.taskId}/plan`, { revision: prepared.payload.data.revision });
  await entered; await f.app.closeAgentLongTaskRuntime(); expect(drained).toBe(true);
  expect((await request).status).toBeGreaterThanOrEqual(400);
  await expect(f.app.getAgentLongTaskRuntime()).rejects.toMatchObject({ code: "AGENT_LONG_TASK_UNAVAILABLE" });
}, 30000);
it("shares bounded execution admission across task IDs while control and read retain independent capacity", async () => {
  const task = `/v1/agents/agt_example/tasks/${randomUUID()}`;
  expect(resolveRuntimeRoutePermissionOverride("POST", task + "/confirm")).toBe("workflow:approve");
  expect(resolveRuntimeRoutePermissionOverride("POST", task + "/run")).toBe("workflow:run");
  expect(resolveRuntimeRoutePermissionOverride("GET", task)).toBe("dashboard:read");
  const admission = createRouteConcurrencyAdmission({ rawConfig: { "/agent-long-tasks/execute": 1 } }), first = admission.tryAcquire(task + "/plan", "tenant");
  expect(first.allowed).toBe(true); expect(admission.tryAcquire(task.replace(/[^/]+$/u, randomUUID()) + "/run", "tenant").allowed).toBe(false);
  expect(admission.tryAcquire(task + "/cancel", "tenant").allowed).toBe(true); if (first.allowed) first.release();
  const limiter = createRouteRateLimiter({ whitelist: [] });
  const response: any = { setHeader: vi.fn(), writeHead: vi.fn(), end: vi.fn() };
  limiter.apply({ url: task + "/run", method: "POST", headers: { host: "fixture" }, socket: { remoteAddress: "192.0.2.1" } } as any, response);
  expect(response.setHeader).toHaveBeenCalledWith("X-RateLimit-Route", "/agent-long-tasks/execute"); await limiter.close();
});
it("projects trusted actor, virtual-key capability and exact execution context without accepting JSON authority", async () => {
  const path = `/v1/agents/agt_original/tasks/${randomUUID()}/run`, controller = new AbortController();
  const execution = { signal: controller.signal, deadlineAt: Date.now() + 30000, timeoutMs: 30000,
    providerDispatchRoute: path, providerDispatchKeyHash: "a".repeat(64) };
  const capability = createVirtualKeyRequestAccounting({ keyFingerprint: "123456abcdef", onEvent() {}, manager: {
    authorizeUsage() {}, checkContinuation() {}, recordUsage() {}, describeUsage() {},
  } as any });
  bindVirtualKeyRequestAccounting(execution, capability);
  const request = Object.assign(Readable.from([Buffer.from(JSON.stringify({ revision: 3, maxIterations: 2 }))]), { method: "POST", headers: {},
    enterpriseIdentity: { tenantId: "tenant", userId: "owner", role: "operator", permissions: ["workflow:run"], actorAgentId: "agt_actor", apiKeyFingerprint: "123456abcdef" } });
  const response: any = { writableEnded: false, destroyed: false, setHeader: vi.fn(), writeHead: vi.fn(), end: vi.fn() };
  const run = vi.fn(async (_taskId, identity, input) => {
    expect(identity).toMatchObject({ agentId: "agt_original", ...request.enterpriseIdentity, requestId: "request-original" });
    expect(identity.execution).toBe(execution); expect(getVirtualKeyRequestAccounting(identity.execution)).toBe(capability);
    expect(input).toEqual({ revision: 3, maxIterations: 2 }); return { phase: "paused" };
  });
  await dispatchGovernedAgentTaskRoutes({ request: request as any, response, startedAt: Date.now(), url: new URL(path, "http://fixture"), requestId: "request-original",
    requestExecution: execution, application: { getAgentLongTaskRuntime: async () => ({ run }) as any } });
  expect(run).toHaveBeenCalledOnce(); expect(response.writeHead).toHaveBeenCalledWith(200, expect.anything());
});
it("returns only explicit uncertainty booleans and original task ID, without leaking exception details or inventing certainty", async () => {
  const taskId = randomUUID(), path = `/v1/agents/agt_original/tasks/${taskId}/run`;
  for (const flags of [{ outcomeUnknown: true }, { persistenceOutcomeUnknown: true }, { outcomeUnknown: false }, { outcomeUnknown: "false", persistenceOutcomeUnknown: null }, {}]) {
    const request = Object.assign(Readable.from([Buffer.from('{"revision":0}')]), { method: "POST", headers: {},
      enterpriseIdentity: { tenantId: "tenant", userId: "owner", role: "operator", permissions: ["workflow:run"] } });
    const response: any = { writableEnded: false, destroyed: false, setHeader: vi.fn(), writeHead: vi.fn(), end: vi.fn() };
    await dispatchGovernedAgentTaskRoutes({ request: request as any, response, startedAt: Date.now(), url: new URL(path, "http://fixture"),
      requestExecution: { signal: new AbortController().signal, timeoutMs: 30000, deadlineAt: Date.now() + 30000 },
      application: { getAgentLongTaskRuntime: async () => ({ run: async () => { throw Object.assign(Error("private fixture exception message"),
        { code: "AGENT_LONG_TASK_STATE_UNCERTAIN", statusCode: 503, taskId: "forged-error-task", cause: "private fixture cause", ...flags }); } }) as any } });
    const payload = JSON.parse(String(response.end.mock.calls[0][0]));
    expect(payload.error.details).toEqual({ taskId,
      ...(typeof flags.outcomeUnknown === "boolean" ? { outcomeUnknown: flags.outcomeUnknown } : {}),
      ...(typeof flags.persistenceOutcomeUnknown === "boolean" ? { persistenceOutcomeUnknown: flags.persistenceOutcomeUnknown } : {}) });
    expect(JSON.stringify(payload)).not.toMatch(/private fixture|forged-error-task|stack|cause/u);
  }
});
