// @test-isolation process
import { once } from "node:events";
import { mkdir, mkdtemp, readFile, realpath, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { afterEach, expect, it, vi } from "vitest";
import { createGatewayApplication } from "../application/createGatewayApplication.js";
import { createGatewayHttpServer } from "../http/httpServer.js";
import { createControlledExecutor } from "./workforceControlledExecutor.js";
import { createWorkforceGit } from "./workforceGit.ts";
import { createWorktreeIsolation } from "./worktreeIsolation.js";
import { createWorkflowRunHandoff } from "./workflowRunHandoff.js";
import { runCli } from "../../../agent-console/src/cli-core.js";

const cleanups: (() => Promise<unknown>)[] = [];
afterEach(async () => { for (const cleanup of cleanups.splice(0).reverse()) await cleanup(); vi.restoreAllMocks(); });
async function fixture(fileDecision: "allow" | "require_approval" = "require_approval") {
  const root = await mkdtemp(join(await realpath(tmpdir()), "workflow-handoff-http-"));
  cleanups.push(async () => { expect(await realpath(root)).toBe(root); expect(dirname(root)).toBe(await realpath(tmpdir())); await rm(root, { recursive: true, force: true }); });
  const repo = join(root, "repo"); await mkdir(repo); await writeFile(join(repo, "README.md"), "Owned workflow fixture.\n");
  const git = createWorkforceGit(repo);
  await git.run(["-c", "init.templateDir=", "init", "--initial-branch=main"]); await git.run(["add", "README.md"]);
  await git.run(["-c", "user.name=Handoff Fixture", "-c", "user.email=handoff@example.invalid", "-c", "commit.gpgSign=false", "commit", "-m", "Owned workflow fixture"]);
  const token = "local-workflow-handoff-fixture", identity = { tenantId: "handoff-tenant", userId: "handoff-owner", role: "admin", permissions: ["*"] };
  const env = { NODE_ENV: "test", AI_GATEWAY_PROVIDER_MODE: "fake", AI_GATEWAY_REAL_PROVIDER_ENABLED: "false",
    PME_RUNTIME_CREDENTIAL_STORE_MODE: "memory", KNOWLEDGE_STORAGE_MODE: "memory", AI_GATEWAY_RATE_LIMIT_WHITELIST: "127.0.0.1",
    AI_GATEWAY_MODEL_LIBRARY_STATE_PATH: join(root, "models.json"), WORKFLOW_OUTPUT_DIR: join(root, "artifacts"),
    WORKFORCE_PLAN_STORE_PATH: join(root, "plans.json"), WORKFORCE_EXECUTION_DIR: join(root, "execution"),
    WORKFORCE_EXECUTION_ENABLED: "true", AI_GATEWAY_USAGE_LOG_DIR: join(root, "usage"),
    AI_GATEWAY_AGENT_EXEC_WORKING_DIRECTORY: repo, AI_GATEWAY_AGENT_GOVERNANCE_ENABLED: "true",
    AI_GATEWAY_AGENT_GOVERNANCE_DATA_DIR: join(root, "governance"), AI_GATEWAY_AGENT_GOVERNANCE_HMAC_KEY: "handoff-fixture-signing-material-0123456789",
    AI_GATEWAY_LOCAL_CLIENT_REGISTRY_PATH: join(root, "clients.json"), AI_GATEWAY_LOCAL_CLIENT_EXECUTION_LOG_PATH: join(root, "clients.jsonl"),
    AI_GATEWAY_LOCAL_CLIENT_EXECUTION_CONTROL_DIR: join(root, "client-control"),
    PME_ENTERPRISE_AUTH_ENABLED: "true", PME_AUTH_TOKEN: token, PME_AUTH_USER_ID: identity.userId, PME_AUTH_TENANT_ID: identity.tenantId,
    PME_AUTH_ROLE: "admin", PME_ENTERPRISE_PLATFORM_TENANT_ID: identity.tenantId, PME_ENTERPRISE_USER_STORE_PATH: join(root, "users.json"),
    PME_API_KEY_STORE_PATH: join(root, "keys.json"), PME_AUDIT_LOG_PATH: join(root, "audit.jsonl"), PME_AUDIT_CHAIN_PATH: join(root, "audit-chain.jsonl") };
  const app = createGatewayApplication(env) as any;
  const retrieve = vi.spyOn(app.knowledgeService, "retrieve"), generate = vi.spyOn(app.providerRegistry.get("local-fake-provider"), "generate");
  const worktrees = createWorktreeIsolation({ repoRoot: repo, worktreeRoot: join(root, "worktrees") });
  const created = vi.spyOn(worktrees, "create");
  const makeExecutor = () => createControlledExecutor({ env, repoRoot: repo, executionDir: env.WORKFORCE_EXECUTION_DIR,
    worktreeIsolation: worktrees, workflowHandoffRuntime: createWorkflowRunHandoff({ workflowService: app.workflowService }) } as any);
  const executor = makeExecutor(); await app.workforceExecutor.close(); app.workforceExecutor = executor;
  const server = createGatewayHttpServer(app) as any;
  cleanups.push(async () => { await new Promise<void>(resolve => { server.close(() => resolve()); server.closeAllConnections(); }); await server.shutdownResources?.(); await executor.close(); });
  server.listen(0, "127.0.0.1"); await once(server, "listening"); const address = server.address();
  const send = async (path: string, body?: unknown) => {
    const response = await fetch("http://127.0.0.1:" + address.port + path, { method: body === undefined ? "GET" : "POST",
      headers: { authorization: "Bearer " + token, "content-type": "application/json" }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
    return { status: response.status, payload: await response.json() as any };
  };
  const tools = ["workforce_execute", "file_write"];
  await app.agentGovernance.service.createPolicyVersion({ policyKey: "execution-family", version: 3, policyType: "family", scopeKey: "execution",
    content: { capabilityCeiling: tools, toolRules: { workforce_execute: "require_approval", file_write: fileDecision, shell_exec: "deny", code_run: "deny" },
      limits: { maxSteps: 20, maxToolCalls: 30, maxRuntimeSeconds: 180, maxWorkforceRoles: 8 },
      permissions: { canCreateChildren: true, canWrite: true, canSendExternalMessage: false, canExecuteCode: false } } }, identity);
  await app.agentGovernance.service.activatePolicyVersion("execution-family", 3, identity);
  const agent = await send("/v1/agents/generate", { name: "handoff-runtime", task: "执行本地报告写入任务", requestedTools: tools,
    ttlSeconds: 3600, proposedTraits: ["write_capable"], proposedRiskLevel: "high" });
  expect(agent.status, JSON.stringify(agent.payload)).toBe(200);
  const input = { goal: "Implement a bounded release report", planId: "handoff-approved-plan", autonomyMode: "controlled-execution",
    agentId: agent.payload.data.agentId, workflowHandoff: { roleId: "ceo", query: "release evidence", topK: 2, sourceIds: [] } };
  const cli = async (args: string[]) => {
    let stdout = "", stderr = "";
    const code = await runCli([...args, "--url", "http://127.0.0.1:" + address.port, "--json"], {
      env: { AGENT_CONSOLE_ADMIN_KEY: token }, stdout: { write: (text: string) => { stdout += text; } },
      stderr: { write: (text: string) => { stderr += text; } } });
    return { code, stdout, stderr, data: code === 0 ? JSON.parse(stdout) : null };
  };
  return { app, executor, makeExecutor, send, input, identity, retrieve, generate, git, created, cli, root };
}

it("uses both actual HTTP approvals, backwrites the child reference, and recovers its frozen report without rerunning Workforce", async () => {
  const f = await fixture();
  const descriptor = await f.executor.describeExecution({ ...f.input, ...f.identity });
  expect(descriptor.workflowHandoff).toMatchObject({ roleId: "ceo", query: "release evidence", goal: f.input.goal });
  const planApproval = await f.send("/workforce/execute/approve", { ...f.input, approvedScopes: descriptor.requiredScopes });
  expect(planApproval.status, JSON.stringify(planApproval.payload)).toBe(200);
  const pending = await f.send("/workforce/execute", f.input);
  expect(pending.status, JSON.stringify(pending.payload)).toBe(202);
  expect(f.retrieve).not.toHaveBeenCalled(); expect(f.created).not.toHaveBeenCalled();
  const approvals = await f.send("/v1/approvals?status=pending");
  expect(approvals.status, JSON.stringify(approvals.payload)).toBe(200);
  const approval = approvals.payload.data.approvals.find((item: any) => item.approvalId === pending.payload.data.approvalId || item.id === pending.payload.data.approvalId);
  expect(approval?.review?.workforce?.options?.workflowHandoff).toEqual(descriptor.workflowHandoff);
  expect((await f.send("/v1/approvals/decide", { approvalId: pending.payload.data.approvalId, decision: "approve" })).status).toBe(200);
  const first = await f.send("/workforce/execute", f.input);
  expect(first.status, JSON.stringify(first.payload)).toBe(422);
  const parent = first.payload.data;
  expect(parent).toMatchObject({ success: false, executionStatus: "failed", workflowHandoff: { originVerified: true, canResume: true, result: null } });
  expect(parent.workflowHandoff.error.approvalId).toMatch(/^appr_/u);
  const cliStatus = await f.cli(["workforce", "status", parent.executionId]);
  expect(cliStatus.code, cliStatus.stderr).toBe(0);
  expect(cliStatus.data.data.workflowHandoff).toMatchObject({ error: { approvalId: parent.workflowHandoff.error.approvalId }, canResume: true });
  const scope = { executionId: parent.executionId, taskId: parent.workflowHandoff.taskId, workflowId: parent.workflowHandoff.workflowId };
  expect((await f.send("/workforce/execute/handoff/recover", { ...scope, query: "unreviewed replacement" })).status).toBe(400);
  expect((await f.send("/workforce/execute/handoff/recover", { ...scope, taskId: "unrelated-task" })).status).toBe(403);
  const fileApproval = await f.send("/v1/approvals/decide", { approvalId: parent.workflowHandoff.error.approvalId, decision: "approve" });
  expect(fileApproval.status, JSON.stringify(fileApproval.payload)).toBe(200);
  const recoveryPath = join(f.root, "recovery.json"); await writeFile(recoveryPath, JSON.stringify(scope));
  const recovered = await f.cli(["workforce", "handoff-recover", "--input", recoveryPath, "--yes"]);
  expect(recovered.code, recovered.stderr).toBe(0);
  expect(recovered.data.data).toMatchObject({ parentExecutionStatus: "failed", parentExecutionResumed: false, employeeRolesRerun: false, status: "completed", artifactVerified: true });
  const status = await f.send("/workforce/execute/status", { executionId: parent.executionId });
  expect(status.status, JSON.stringify(status.payload)).toBe(200);
  expect(status.payload.data).toMatchObject({ status: "failed", workflowHandoff: { status: "completed", artifactVerified: true } });
  expect(await readFile(status.payload.data.workflowHandoff.result.artifact.absolutePath, "utf8")).toContain(f.input.goal);
  await f.executor.close(); const reopened = f.makeExecutor();
  try {
    expect(await reopened.getStatus(parent.executionId, f.identity)).toMatchObject({ status: "failed", workflowHandoff: { status: "completed", artifactVerified: true } });
    await expect(reopened.getStatus(parent.executionId, { ...f.identity, userId: "other-owner" })).rejects.toMatchObject({ code: "WORKFORCE_EXECUTION_FORBIDDEN" });
  } finally { await reopened.close(); }
  expect(f.retrieve).toHaveBeenCalledOnce(); expect(f.created).toHaveBeenCalledOnce(); expect(f.generate).not.toHaveBeenCalled();
  expect((await f.git.run(["status", "--porcelain=v1"])).stdout).toBe("");
}, 60000);

it("completes the actual parent task with a verified report and rejects JSON handoff authority", async () => {
  const f = await fixture("allow");
  for (const key of ["workforceHandoff", "workflowHandoffContext"]) {
    const forbidden = await f.send("/workflow/run", { workflowId: "forged-handoff", agentId: f.input.agentId, goal: f.input.goal, [key]: {} });
    expect(forbidden.status, JSON.stringify(forbidden.payload)).toBe(403);
  }
  expect(f.retrieve).not.toHaveBeenCalled();
  const descriptor = await f.executor.describeExecution({ ...f.input, ...f.identity });
  const plan = await f.send("/workforce/execute/approve", { ...f.input, approvedScopes: descriptor.requiredScopes });
  expect(plan.status, JSON.stringify(plan.payload)).toBe(200);
  const pending = await f.send("/workforce/execute", f.input); expect(pending.status).toBe(202);
  expect((await f.send("/v1/approvals/decide", { approvalId: pending.payload.data.approvalId, decision: "approve" })).status).toBe(200);
  const result = await f.send("/workforce/execute", f.input);
  expect(result.status, JSON.stringify(result.payload)).toBe(200);
  expect(result.payload.data).toMatchObject({ success: true, executionStatus: "completed", worktree: { cleanedUp: true },
    roleResults: { ceo: { workflowHandoff: { status: "completed", artifactVerified: true } } },
    workflowHandoff: { status: "completed", artifactVerified: true }, safety: { workflowArtifactWrite: true, providerCallsMade: false } });
  expect(f.retrieve).toHaveBeenCalledOnce(); expect(f.generate).not.toHaveBeenCalled();
  expect((await f.git.run(["status", "--porcelain=v1"])).stdout).toBe("");
}, 60000);

it("cancels the actual HTTP task during retrieval and leaves no completed child or extra role execution", async () => {
  const f = await fixture("allow");
  const descriptor = await f.executor.describeExecution({ ...f.input, ...f.identity });
  const plan = await f.send("/workforce/execute/approve", { ...f.input, approvedScopes: descriptor.requiredScopes });
  expect(plan.status).toBe(200);
  const pending = await f.send("/workforce/execute", f.input); expect(pending.status).toBe(202);
  expect((await f.send("/v1/approvals/decide", { approvalId: pending.payload.data.approvalId, decision: "approve" })).status).toBe(200);
  let entered!: () => void;
  const retrieving = new Promise<void>(resolve => { entered = resolve; });
  f.retrieve.mockImplementationOnce(async (_request: any, context: any) => new Promise((_resolve, reject) => {
    if (context.signal.aborted) reject(context.signal.reason);
    else context.signal.addEventListener("abort", () => reject(context.signal.reason), { once: true });
    entered();
  }));
  const running = f.send("/workforce/execute", f.input);
  await retrieving;
  const activeRecovery = await f.send("/workforce/execute/handoff/recover", { executionId: plan.payload.data.execution.executionId, taskId: "attempted-active-task", workflowId: "attempted-active-workflow" });
  expect(activeRecovery.status, JSON.stringify(activeRecovery.payload)).toBe(409);
  const cancelled = await f.send("/workforce/execute/cancel", { executionId: plan.payload.data.execution.executionId, reason: "fixture operator cancellation" });
  expect(cancelled.status, JSON.stringify(cancelled.payload)).toBe(200);
  const final = await running;
  expect(final.status, JSON.stringify(final.payload)).toBe(422);
  expect(final.payload.data).toMatchObject({ success: false, executionStatus: "cancelled", workflowHandoff: { result: null } });
  expect(final.payload.data.workflowHandoff.status).not.toBe("completed");
  expect(f.retrieve).toHaveBeenCalledOnce(); expect(f.generate).not.toHaveBeenCalled();
  expect((await f.git.run(["status", "--porcelain=v1"])).stdout).toBe("");
}, 60000);
