// @test-isolation process
// Actual app/HTTP, Agent Governance, signed queue, AgentPool, Gateway and Git tools.
// The Node test oracle and container result are synthetic here; no one-run authentication key is created or observed.
import { createHash } from "node:crypto";
import { once } from "node:events";
import { mkdir, mkdtemp, readFile, realpath, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { afterEach, expect, it, vi } from "vitest";
import { AgentPoolManager, ContainerSandboxBackend } from "@unified-ai-system/forge-core";
import { stableStringify } from "@unified-ai-system/policy-engine";
import { createGatewayApplication } from "../application/createGatewayApplication.js";
import { createGatewayHttpServer } from "../http/httpServer.js";
import { createWorkforceGit } from "../workforce/workforceGit.ts";
import * as oracle from "../workforce/workforceNodeTestVerification.ts";
import * as runtimeModule from "./governedAgentTaskRuntime.ts";

const digest = (value: string) => createHash("sha256").update(value).digest("hex");
const cleanup: Array<() => Promise<void>> = [];
afterEach(async () => { try { for (const close of cleanup.splice(0).reverse()) await close(); } finally { vi.restoreAllMocks(); } });
function deferred() { let resolve!: () => void; const promise = new Promise<void>(done => { resolve = done; }); return { promise, resolve }; }
async function waitForRelease(gate: ReturnType<typeof deferred>, signal: AbortSignal) {
  if (signal.aborted) throw signal.reason;
  await new Promise<void>((resolve, reject) => {
    const abort = () => { signal.removeEventListener("abort", abort); reject(signal.reason); };
    signal.addEventListener("abort", abort, { once: true });
    void gate.promise.then(() => { signal.removeEventListener("abort", abort); resolve(); });
  });
}
function response(text: string, id?: string, name?: string, args?: Record<string, unknown>) {
  const calls = id ? [{ id, type: "function", function: { name, arguments: JSON.stringify(args) } }] : undefined;
  return { text, message: { role: "assistant", content: text, ...(calls ? { tool_calls: calls } : {}) },
    ...(calls ? { toolCalls: [{ id, name, arguments: args }] } : {}), usage: { inputTokens: 101, outputTokens: 29, totalTokens: 130 }, executionStatus: "success", latencyMs: 0,
    raw: { finishReason: id ? "tool_calls" : "stop", workforceObservation: { contentPresent: true, usageReported: { inputTokens: true, outputTokens: true, totalTokens: true } } }, warnings: [] };
}
async function fixture() {
  const root = await mkdtemp(join(await realpath(tmpdir()), "agent-pool-http-"));
  let safeToRemove = true;
  cleanup.push(async () => { if (!safeToRemove) return; expect(await realpath(root)).toBe(root); expect(dirname(root)).toBe(await realpath(tmpdir())); await rm(root, { recursive: true, force: false }); });
  const projects = await Promise.all(["a", "b"].map(async id => {
    const base = join(root, id), repoRoot = join(base, "repo"), scratchRoot = join(base, "scratch"), worktreeRoot = join(base, "worktrees");
    await mkdir(repoRoot, { recursive: true }); await mkdir(scratchRoot);
    const initial = id === "a" ? 1 : 10, target = id === "a" ? 2 : 20;
    const source = `export const value = ${initial};\n`, test = `import test from 'node:test'; import assert from 'node:assert/strict'; import {value} from './source.mjs'; test('value ${id}',()=>assert.equal(value,${target}));\n`;
    await writeFile(join(repoRoot, "source.mjs"), source); await writeFile(join(repoRoot, "test.mjs"), test);
    const git = createWorkforceGit(repoRoot); await git.run(["-c", "init.templateDir=", "init", "--initial-branch=main"]); await git.run(["add", "source.mjs", "test.mjs"]);
    await git.run(["-c", "user.name=Pool Fixture", "-c", "user.email=fixture@example.invalid", "-c", "commit.gpgSign=false", "commit", "-m", "Fixture"]);
    const profile = { version: 1, mode: "governed-agent-long-task", profileId: "pool-" + id, projectId: "project-" + id,
      baselineRevision: (await git.run(["rev-parse", "HEAD"])).stdout.trim(), model: { providerId: "local-fake-provider", modelId: "local-fake-model", maxInputTokens: 16384, maxOutputTokens: 2048 },
      limits: { maxPlanSteps: 3, maxIterations: 6, maxModelCalls: 7, maxTotalTokens: 129024, maxRepairAttempts: 1, chunkTimeoutMs: 30000, maxInputBytes: 65536 },
      verificationResult: { version: 1, adapter: "node-test", minimumPassed: 1, requiredChecks: [{ file: "test.mjs", name: "value " + id }] },
      artifact: { readPaths: ["source.mjs", "test.mjs"], writePaths: ["source.mjs"], verification: { verificationId: "fixed-" + id, command: "node --test 'test.mjs'",
        immutableTests: [{ path: "test.mjs", sha256: digest(test) }], image: "node@sha256:" + "d".repeat(64), workspaceMode: "ro", networkAccess: false,
        timeoutMs: 10000, maxMemoryMB: 128, maxOutputBytes: 4096, pidsLimit: 32, cpus: 1 }, artifactLimits: { maxChangedFiles: 1, maxFileBytes: 4096, maxDiffBytes: 8192 } } };
    return { id, initial, target, source, test, git, repoRoot, scratchRoot, worktreeRoot, profile, gate: deferred(), entered: false };
  }));
  // Synthetic oracle boundary: public contract/snapshot inputs only. No production prepare operation or authenticator is invoked.
  vi.spyOn(oracle, "prepareNodeTestVerification").mockImplementation((contract, _files, snapshotHash) => ({
    command: "synthetic-node-test", stdin: "", close() {}, read(stdout: string, exitCode: number) {
      const value = JSON.parse(stdout), passed = value.passed === true;
      expect(exitCode).toBe(passed ? 0 : 1);
      return { stdout: "synthetic immutable-test result", checkResult: { version: 1, adapter: "node-test", contractHash: "sha256:" + digest(stableStringify(contract)),
        runnerHash: oracle.NODE_TEST_RUNNER_HASH, snapshotHash, verdict: passed ? "passed" : "failed", reason: passed ? "checks-passed" : "checks-failed",
        counts: { tests: 1, passed: Number(passed), failed: Number(!passed), cancelled: 0, skipped: 0, todo: 0, suites: 0, topLevel: 1 }, executedPassed: Number(passed),
        requiredChecks: contract.requiredChecks.map(check => ({ ...check, status: passed ? "passed" : "failed" })) } };
    },
  }));
  const backend = vi.spyOn(ContainerSandboxBackend.prototype, "run").mockImplementation(async (input: any) => {
    expect(input.workspaceMode).toBe("ro"); expect(input.networkAccess).toBe(false);
    const test = await readFile(join(input.workspace, "test.mjs"), "utf8"), project = projects.find(project => project.test === test)!;
    expect(project).toBeDefined(); expect(input.workspace.startsWith(project.scratchRoot)).toBe(true);
    const passed = await readFile(join(input.workspace, "source.mjs"), "utf8") === `export const value = ${project.target};\n`;
    return { backend: "container", exitCode: passed ? 0 : 1, stdout: JSON.stringify({ passed }), stderr: "", killed: false, oomKilled: false, truncated: false, cleanupUncertain: false } as any;
  });
  const created = vi.spyOn(runtimeModule, "createGovernedAgentTaskRuntime"), enqueue = vi.spyOn(AgentPoolManager.prototype, "enqueueGovernedGoal");
  const env = { NODE_ENV: "test", AI_GATEWAY_PROVIDER_MODE: "fake", AI_GATEWAY_REAL_PROVIDER_ENABLED: "false", PME_RUNTIME_CREDENTIAL_STORE_MODE: "memory", KNOWLEDGE_STORAGE_MODE: "memory",
    AI_GATEWAY_RATE_LIMIT_WHITELIST: "127.0.0.1", AI_GATEWAY_MODEL_LIBRARY_STATE_PATH: join(root, "models.json"), WORKFLOW_OUTPUT_DIR: join(root, "artifacts"),
    WORKFORCE_PLAN_STORE_PATH: join(root, "plans.json"), WORKFORCE_EXECUTION_DIR: join(root, "execution"), AI_GATEWAY_USAGE_LOG_DIR: join(root, "usage"),
    AI_GATEWAY_AGENT_EXEC_WORKING_DIRECTORY: projects[0]!.repoRoot, AI_GATEWAY_AGENT_GOVERNANCE_ENABLED: "true", AI_GATEWAY_AGENT_GOVERNANCE_DATA_DIR: join(root, "governance"),
    AI_GATEWAY_AGENT_GOVERNANCE_HMAC_KEY: "pool-fixture-signing-0123456789abcdef", AI_GATEWAY_LOCAL_CLIENT_REGISTRY_PATH: join(root, "clients.json"),
    AI_GATEWAY_LOCAL_CLIENT_EXECUTION_LOG_PATH: join(root, "clients.jsonl"), AI_GATEWAY_LOCAL_CLIENT_EXECUTION_CONTROL_DIR: join(root, "client-control"),
    PME_ENTERPRISE_AUTH_ENABLED: "true", PME_AUTH_TOKEN: "pool-fixture-bootstrap", PME_AUTH_USER_ID: "bootstrap", PME_AUTH_TENANT_ID: "tenant-a", PME_AUTH_ROLE: "admin", PME_ENTERPRISE_PLATFORM_TENANT_ID: "tenant-a",
    PME_ENTERPRISE_USER_STORE_PATH: join(root, "users.json"), PME_API_KEY_STORE_PATH: join(root, "keys.json"), PME_AUDIT_LOG_PATH: join(root, "audit.jsonl"), PME_AUDIT_CHAIN_PATH: join(root, "audit-chain.jsonl"),
    AI_GATEWAY_AGENT_LONG_TASK_CONFIG_JSON: JSON.stringify({ version: 1, projects: projects.map(project => ({ profile: project.profile, repoRoot: project.repoRoot,
      worktreeRoot: project.worktreeRoot, scratchRoot: project.scratchRoot, enginePath: join(root, "fixture-engine") })),
      pool: { maxConcurrentWorkers: 2, maxGoals: 2, chunkIterations: 1, maxDurationMs: 60000 } }) };
  const app = createGatewayApplication(env) as any, service = app.agentGovernance.service, enterprise = app.enterpriseGovernanceService;
  cleanup.push(async () => { for (const project of projects) project.gate.resolve(); try { await app.closeAgentLongTaskRuntime(); await app.workforceExecutor.close(); }
    catch (error) { safeToRemove = false; console.error("Owned pool fixture retained after shutdown failure:", root); throw error; } });
  const manager = enterprise.getApiKeyManager(), keys = projects.map(project => manager.create({ role: "admin", tenantId: "tenant-" + project.id,
    budget: { limitTokens: 1000000, window: "daily" }, rateLimit: { requestsPerMinute: 60 } }));
  const tools = ["file_read", "file_write", "file_edit", "workforce_verify_snapshot"], admin = { tenantId: "tenant-a", userId: "bootstrap", role: "admin", permissions: ["*"] };
  await service.createPolicyVersion({ policyKey: "execution-family", version: 3, policyType: "family", scopeKey: "execution", content: { capabilityCeiling: tools,
    toolRules: Object.fromEntries(tools.map(name => [name, "allow"])), requirements: { sandboxRequired: false }, limits: { maxSteps: 30, maxToolCalls: 50, maxRuntimeSeconds: 180 },
    permissions: { canCreateChildren: true, canWrite: true, canExecuteCode: true, canSendExternalMessage: false } } }, admin);
  await service.activatePolicyVersion("execution-family", 3, admin);
  const capture = vi.spyOn(enterprise, "captureResidentAuthority"), authorize = vi.spyOn(enterprise, "authorizeResidentAuthority");
  const calls: Array<{ projectId: string; planning: boolean; route: string; toolIds: string[] }> = [];
  let active = 0, maximumActive = 0;
  vi.spyOn(app.providerRegistry.get("local-fake-provider"), "generate").mockImplementation(async (input: any) => {
    const payload = JSON.parse(input.request.messages[1].content), project = projects.find(project => project.profile.projectId === payload.review.profile.projectId)!;
    expect(project).toBeDefined(); const index = projects.indexOf(project), key = keys[index];
    expect(input.request.enterpriseIdentity).toMatchObject({ tenantId: "tenant-" + project.id, userId: "api-key:" + key.record.keyFingerprint, apiKeyFingerprint: key.record.keyFingerprint });
    const planning = !input.request.tools?.length, toolIds = input.request.messages.filter((message: any) => message.role === "tool").map((message: any) => message.toolCallId ?? message.tool_call_id);
    calls.push({ projectId: project.profile.projectId, planning, route: input.execution.providerDispatchRoute, toolIds });
    if (planning) return response(JSON.stringify({ version: 1, reviewHash: payload.review.reviewHash, steps: [
      { id: "inspect", kind: "inspect", title: "Read original source", paths: ["source.mjs"] }, { id: "implement", kind: "implement", title: "Implement reviewed value", paths: ["source.mjs"] },
      { id: "verify", kind: "verify", title: "Execute immutable test", paths: ["test.mjs"] }] }));
    expect(input.execution.providerDispatchRoute).toMatch(/^\/internal\/agent-pool\/[a-f0-9-]{36}\/run$/u);
    expect(input.execution.providerDispatchKeyHash).toMatch(/^[a-f0-9]{64}$/u);
    if (!toolIds.includes(project.id + "-read")) {
      project.entered = true; active++; maximumActive = Math.max(maximumActive, active);
      try { await waitForRelease(project.gate, input.execution.signal); } finally { active--; }
      return response("", project.id + "-read", "file_read", { file_path: "source.mjs" });
    }
    if (!toolIds.includes(project.id + "-write")) return response("", project.id + "-write", "file_write", { file_path: "source.mjs", content: `export const value = ${project.target};\n` });
    return response("The implementation is ready for independent verification.");
  });
  const server = createGatewayHttpServer(app) as any;
  cleanup.push(async () => { for (const project of projects) project.gate.resolve(); try { await server.shutdownResources(); }
    catch (error) { safeToRemove = false; console.error("Owned pool fixture retained after server shutdown failure:", root); throw error; }
    finally { await new Promise<void>(done => { server.close(() => done()); server.closeAllConnections(); }); } });
  server.listen(0, "127.0.0.1"); await once(server, "listening"); const port = server.address().port;
  const send = async (index: number, path: string, body?: unknown) => {
    const result = await fetch(`http://127.0.0.1:${port}${path}`, { method: body === undefined ? "GET" : "POST", headers: { authorization: "Bearer " + keys[index].key, "content-type": "application/json" },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }) }); return { status: result.status, payload: await result.json() as any };
  };
  const tasks: Array<{ index: number; path: string; taskId: string; agentId: string; confirmed: Record<string, any>;
    identity: { agentId: string; tenantId: string; userId: string } }> = [];
  for (const [index, project] of projects.entries()) {
    const agent = await send(index, "/v1/agents/generate", { name: "pool-" + project.id, task: "执行代码修改任务", requestedTools: tools,
      ttlSeconds: 3600, proposedTraits: ["write_capable", "code_execution"], proposedRiskLevel: "high" });
    expect(agent.status, JSON.stringify(agent.payload)).toBe(200); const base = `/v1/agents/${agent.payload.data.agentId}/tasks`;
    const prepared = await send(index, base, { goal: "Set the reviewed project value", prompt: `Change only project ${project.id}, then verify its original test.`, projectId: project.profile.projectId });
    expect(prepared.status, JSON.stringify(prepared.payload)).toBe(200); const taskId = prepared.payload.data.taskId, path = base + "/" + taskId;
    const plan = await send(index, path + "/plan", { revision: prepared.payload.data.revision }); expect(plan.status, JSON.stringify(plan.payload)).toBe(200);
    const human = await send(index, "/v1/approvals/decide", { approvalId: plan.payload.data.approvalId, decision: "approve" }); expect(human.status, JSON.stringify(human.payload)).toBe(200);
    const confirmed = await send(index, path + "/confirm", { revision: plan.payload.data.revision, reviewHash: plan.payload.data.review.reviewHash,
      planHash: plan.payload.data.plan.planHash, approvalId: plan.payload.data.approvalId }); expect(confirmed.status, JSON.stringify(confirmed.payload)).toBe(200);
    tasks.push({ index, path, taskId, agentId: agent.payload.data.agentId, confirmed: confirmed.payload.data,
      identity: { agentId: agent.payload.data.agentId, tenantId: "tenant-" + project.id, userId: "api-key:" + keys[index].record.keyFingerprint } });
  }
  const rawRuntime = (index: number) => created.mock.results.map(result => result.value).find(runtime => runtime.profile.projectId === projects[index]!.profile.projectId)!;
  const inspect = async (index: number) => {
    const task = tasks[index]!, state = await rawRuntime(index).inspectResident(task.taskId, task.identity);
    const queue = created.mock.calls.find(([input]) => input.workspace.profile.projectId === projects[index]!.profile.projectId)![0].queue;
    // inspectResident has just verified the signed store. Read only the same original task's result fields for test assertions.
    const saved = queue.readRetainedTask(task.taskId, task.identity);
    return { ...state, taskId: saved.taskId, stepReceipts: saved.continuation.state.stepReceipts, workspaceReceipt: saved.continuation.state.workspaceReceipt };
  };
  const schedule = async (index: number) => { const task = tasks[index]!; const result = await send(index, task.path + "/schedule", { revision: task.confirmed.revision });
    expect(result.status, JSON.stringify(result.payload)).toBe(200); return result; };
  const completions = async () => { const queued = await Promise.all(enqueue.mock.results.map(result => result.value)); return Promise.allSettled(queued.map(entry => entry.completion)); };
  return { root, app, projects, tasks, keys, manager, send, schedule, inspect, completions, backend, calls, capture, authorize, enqueue,
    maximumActive: () => maximumActive, waitBoth: () => vi.waitFor(() => expect(projects.every(project => project.entered)).toBe(true), { timeout: 30000, interval: 50 }) };
}

it("schedules two authenticated tenants through one real AgentPool and isolates identical relative filenames in their approved projects", async () => {
  const f = await fixture(); await f.schedule(0); await f.schedule(1); await f.waitBoth();
  expect(f.maximumActive()).toBe(2); expect(new Set(f.enqueue.mock.contexts).size).toBe(1);
  for (const project of f.projects) project.gate.resolve(); await f.completions();
  const states = await Promise.all(f.tasks.map((_task, index) => f.inspect(index)));
  for (const [index, state] of states.entries()) {
    expect(state.phase).toBe("completed"); expect(state.taskId).toBe(f.tasks[index]!.taskId);
    expect(state.agentRunId).toBe(f.tasks[index]!.confirmed.agentRunId); expect(state.resident?.chunks).toBeGreaterThanOrEqual(3);
    expect(state.stepReceipts.map((receipt: any) => receipt.toolName)).toEqual(["file_read", "file_write"]);
    const project = f.projects[index]!; expect(await readFile(join(project.repoRoot, "source.mjs"), "utf8")).toBe(project.source);
    expect(await readFile(join(project.worktreeRoot, state.workspaceReceipt!.worktreeId, "source.mjs"), "utf8")).toBe(`export const value = ${project.target};\n`);
    expect(f.calls.filter(call => call.projectId === project.profile.projectId && call.planning)).toHaveLength(1);
    expect((await f.send(1 - index, f.tasks[index]!.path)).status).toBe(404);
  }
  expect(f.capture).toHaveBeenCalledTimes(2); expect(f.authorize.mock.calls.length).toBeGreaterThanOrEqual(8); expect(f.backend).toHaveBeenCalledTimes(2);
  const pool = f.enqueue.mock.contexts[0] as any; expect(pool).toBeInstanceOf(AgentPoolManager); expect(pool.getStatus()).toMatchObject({ activeWorkers: 0, maxConcurrent: 2, activeGoals: 0 });
}, 90000);

it.each(["cancel", "revoke"] as const)("stops tenant A after %s while tenant B completes independently", async action => {
  const f = await fixture(); await f.schedule(0); await f.schedule(1); await f.waitBoth();
  expect((await f.send(1, f.tasks[0]!.path + "/cancel", { revision: f.tasks[0]!.confirmed.revision })).status).toBe(404);
  if (action === "cancel") {
    const current = await f.send(0, f.tasks[0]!.path); expect(current.status).toBe(200);
    const cancelled = await f.send(0, f.tasks[0]!.path + "/cancel", { revision: current.payload.data.revision }); expect(cancelled.status, JSON.stringify(cancelled.payload)).toBe(200);
  } else f.manager.revoke({ keyId: f.keys[0].record.keyId });
  for (const project of f.projects) project.gate.resolve(); await f.completions();
  // Server-only inspection checks signed original state; it neither mints authority nor resumes either task.
  const [a, b] = await Promise.all([f.inspect(0), f.inspect(1)]);
  expect(["cancelled", "unknown", "failed", "paused"]).toContain(a.phase); expect(a.resident?.enabled).toBe(false);
  expect(a.stepReceipts.some((receipt: any) => ["file_write", "file_edit"].includes(receipt.toolName))).toBe(false);
  expect(b.phase).toBe("completed"); expect(b.taskId).toBe(f.tasks[1]!.taskId); expect(f.backend).toHaveBeenCalledOnce();
  const bProject = f.projects[1]!; expect(await readFile(join(bProject.worktreeRoot, b.workspaceReceipt!.worktreeId, "source.mjs"), "utf8")).toBe("export const value = 20;\n");
  expect(f.calls.filter(call => call.projectId === "project-a" && !call.planning)).toHaveLength(1);
  expect((f.enqueue.mock.contexts[0] as any).getStatus()).toMatchObject({ activeWorkers: 0, activeGoals: 0 });
}, 90000);
