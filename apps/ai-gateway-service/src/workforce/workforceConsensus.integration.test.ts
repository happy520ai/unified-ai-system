// @test-isolation process
import { once } from "node:events";
import { mkdir, mkdtemp, readFile, realpath, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { afterEach, expect, it, vi } from "vitest";
import { createGatewayApplication } from "../application/createGatewayApplication.js";
import { createGatewayHttpServer } from "../http/httpServer.js";
import { createControlledExecutor } from "./workforceControlledExecutor.js";
import { createWorkforceRoleProviderFactory } from "./workforceRoleProvider.ts";
import { freezeWorkforceRoleExecutionProfile } from "./workforceRoleExecutionProfile.ts";
import { createWorkforceGit } from "./workforceGit.ts";
import { createWorktreeIsolation } from "./worktreeIsolation.js";
import { consensusHash } from "./workforceConsensusReport.ts";
import { createLifecycleStatePath } from "./executionLifecycleHelpers.js";
import { runCli } from "../../../agent-console/src/cli-core.js";

const cleanups: (() => Promise<unknown>)[] = [];
afterEach(async () => { for (const cleanup of cleanups.splice(0).reverse()) await cleanup(); vi.restoreAllMocks(); });
async function fixture(scenario: "agree" | "disagree" | "invalid" = "agree") {
  const root = await mkdtemp(join(await realpath(tmpdir()), "workforce-consensus-http-"));
  cleanups.push(async () => { expect(await realpath(root)).toBe(root); expect(dirname(root)).toBe(await realpath(tmpdir())); await rm(root, { recursive: true, force: true }); });
  const repo = join(root, "repo"); await mkdir(repo); await writeFile(join(repo, "README.md"), "Owned consensus fixture.\n");
  const git = createWorkforceGit(repo);
  await git.run(["-c", "init.templateDir=", "init", "--initial-branch=main"]); await git.run(["add", "README.md"]);
  await git.run(["-c", "user.name=Consensus Fixture", "-c", "user.email=consensus@example.invalid", "-c", "commit.gpgSign=false", "commit", "-m", "Owned consensus fixture"]);
  const token = "local-consensus-fixture", identity = { tenantId: "review-tenant", userId: "review-owner", role: "admin", permissions: ["*"] };
  const env = { NODE_ENV: "test", AI_GATEWAY_PROVIDER_MODE: "fake", AI_GATEWAY_REAL_PROVIDER_ENABLED: "false",
    PME_RUNTIME_CREDENTIAL_STORE_MODE: "memory", KNOWLEDGE_STORAGE_MODE: "memory", AI_GATEWAY_RATE_LIMIT_WHITELIST: "127.0.0.1",
    AI_GATEWAY_MODEL_LIBRARY_STATE_PATH: join(root, "models.json"), WORKFLOW_OUTPUT_DIR: join(root, "artifacts"),
    WORKFORCE_PLAN_STORE_PATH: join(root, "plans.json"), WORKFORCE_EXECUTION_DIR: join(root, "execution"),
    WORKFORCE_EXECUTION_ENABLED: "true", AI_GATEWAY_USAGE_LOG_DIR: join(root, "usage"),
    AI_GATEWAY_AGENT_EXEC_WORKING_DIRECTORY: repo, AI_GATEWAY_AGENT_GOVERNANCE_ENABLED: "true",
    AI_GATEWAY_AGENT_GOVERNANCE_DATA_DIR: join(root, "governance"), AI_GATEWAY_AGENT_GOVERNANCE_HMAC_KEY: "consensus-fixture-signing-material-0123456789",
    AI_GATEWAY_LOCAL_CLIENT_REGISTRY_PATH: join(root, "clients.json"), AI_GATEWAY_LOCAL_CLIENT_EXECUTION_LOG_PATH: join(root, "clients.jsonl"),
    AI_GATEWAY_LOCAL_CLIENT_EXECUTION_CONTROL_DIR: join(root, "client-control"),
    PME_ENTERPRISE_AUTH_ENABLED: "true", PME_AUTH_TOKEN: token, PME_AUTH_USER_ID: identity.userId, PME_AUTH_TENANT_ID: identity.tenantId,
    PME_AUTH_ROLE: "admin", PME_ENTERPRISE_PLATFORM_TENANT_ID: identity.tenantId, PME_ENTERPRISE_USER_STORE_PATH: join(root, "users.json"),
    PME_API_KEY_STORE_PATH: join(root, "keys.json"), PME_AUDIT_LOG_PATH: join(root, "audit.jsonl"), PME_AUDIT_CHAIN_PATH: join(root, "audit-chain.jsonl") };
  const app = createGatewayApplication(env) as any;
  const profile = freezeWorkforceRoleExecutionProfile({ version: 1, mode: "gateway-llm-required", profileId: "review-three",
    maxTotalRequests: 3, maxConcurrentRoles: 1, bindings: ["ceo", "pm", "architect"].map(roleId => ({ roleId, employeeId: "employee-" + roleId,
      providerId: "local-fake-provider", modelId: "local-fake-model", maxRequests: 1, maxInputTokens: 16000, maxOutputTokens: 2048, timeoutMs: 15000 })) });
  const worktrees = createWorktreeIsolation({ repoRoot: repo, worktreeRoot: join(root, "worktrees") });
  const makeExecutor = () => createControlledExecutor({ env, repoRoot: repo, executionDir: env.WORKFORCE_EXECUTION_DIR,
    worktreeIsolation: worktrees, roleProviderFactory: createWorkforceRoleProviderFactory({ gatewayService: app.gatewayService, providerRegistry: app.providerRegistry, profile }) } as any);
  const executor = makeExecutor(); await app.workforceExecutor.close(); app.workforceExecutor = executor;
  const executed = vi.spyOn(executor, "execute");
  const server = createGatewayHttpServer(app) as any;
  cleanups.push(async () => { await new Promise<void>(resolve => { server.close(() => resolve()); server.closeAllConnections(); }); await server.shutdownResources?.(); await executor.close(); });
  server.listen(0, "127.0.0.1"); await once(server, "listening"); const address = server.address();
  const send = async (path: string, body?: unknown) => {
    const response = await fetch("http://127.0.0.1:" + address.port + path, { method: body === undefined ? "GET" : "POST",
      headers: { authorization: "Bearer " + token, "content-type": "application/json" }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
    return { status: response.status, payload: await response.json() as any };
  };
  await app.agentGovernance.service.createPolicyVersion({ policyKey: "execution-family", version: 3, policyType: "family", scopeKey: "execution",
    content: { capabilityCeiling: ["workforce_execute"], toolRules: { workforce_execute: "require_approval", file_write: "deny", shell_exec: "deny", code_run: "deny" },
      limits: { maxSteps: 10, maxToolCalls: 20, maxRuntimeSeconds: 180, maxWorkforceRoles: 3 },
      permissions: { canCreateChildren: true, canWrite: true, canSendExternalMessage: false, canExecuteCode: false } } }, identity);
  await app.agentGovernance.service.activatePolicyVersion("execution-family", 3, identity);
  const agent = await send("/v1/agents/generate", { name: "consensus-runtime", task: "执行三角色计划分析任务", requestedTools: ["workforce_execute"], ttlSeconds: 3600 });
  expect(agent.status, JSON.stringify(agent.payload)).toBe(200);
  const source = scenario === "disagree" ? "Owner checks are implemented. Plan identifier checks are absent." : "Owner and plan identifier checks are both implemented before execution.";
  const input = { goal: "Review a bounded task authorization plan", planId: "consensus-plan", autonomyMode: "controlled-execution", agentId: agent.payload.data.agentId,
    consensusReview: { proposal: [{ id: "verify-owner", title: "Verify task identity", verification: "Inspect the current checks and their tests." }],
      criteria: [{ id: "binding", question: "Does the proposal cover owner and plan identity?", verification: "Read the quoted implementation evidence." }],
      evidence: [{ id: "source", title: "Synthetic implementation evidence", content: source }] } };
  const provider = app.providerRegistry.get("local-fake-provider"), original = provider.generate.bind(provider);
  const generated = vi.spyOn(provider, "generate").mockImplementation(async (request: any) => {
    const index = generated.mock.calls.length - 1, perspective = ["Critic", "Planner", "Architect"][index];
    const response = await original(request);
    const text = scenario === "invalid" ? '{"version":1,"version":1}' : JSON.stringify({ version: 1, perspective,
      criteria: [{ criterionId: "binding", verdict: scenario === "disagree" && perspective === "Critic" ? "contradicted" : "supported",
        support: [{ evidenceId: "source", quote: source }], reason: "Independent synthetic opinion from " + perspective,
        proposedChange: scenario === "disagree" && perspective === "Critic" ? "Add a plan identity check and its negative test." : null }] });
    return { ...response, text, message: { role: "assistant", content: text } };
  });
  const approve = async () => {
    const descriptor = await executor.describeExecution({ ...input, ...identity });
    const plan = await send("/workforce/execute/approve", { ...input, approvedScopes: descriptor.requiredScopes }); expect(plan.status, JSON.stringify(plan.payload)).toBe(200);
    const pending = await send("/workforce/execute", input); expect(pending.status, JSON.stringify(pending.payload)).toBe(202);
    const list = await send("/v1/approvals?status=pending");
    const review = list.payload.data.approvals.find((a: any) => (a.id ?? a.approvalId) === pending.payload.data.approvalId);
    expect(review.review.workforce.options.consensusReview).toEqual(descriptor.consensusReview);
    expect(generated).not.toHaveBeenCalled();
    expect((await send("/v1/approvals/decide", { approvalId: pending.payload.data.approvalId, decision: "approve" })).status).toBe(200);
    return { ...descriptor, executionId: plan.payload.data.execution.executionId };
  };
  const cli = async (args: string[]) => {
    let stdout = "", stderr = "";
    const code = await runCli([...args, "--url", "http://127.0.0.1:" + address.port, "--json"], {
      env: { AGENT_CONSOLE_ADMIN_KEY: token }, stdout: { write: (text: string) => { stdout += text; } }, stderr: { write: (text: string) => { stderr += text; } } });
    return { code, stdout, stderr, data: code === 0 ? JSON.parse(stdout) : null };
  };
  return { app, executor, makeExecutor, send, input, identity, generated, git, source, approve, root, env, executed, cli };
}

it.each(["agree", "disagree"] as const)("collects three actual independent role requests and persists the %s decision", async scenario => {
  const f = await fixture(scenario); await f.approve();
  const result = await f.send("/workforce/execute", f.input);
  const observed = await f.executed.mock.results.at(-1)?.value as any;
  expect(result.status, JSON.stringify({ http: result.payload, errors: observed?.errors,
    entries: observed?.consensusReport?.entries.map((entry: any) => ({ roleId: entry.roleId, errorCode: entry.errorCode })) })).toBe(200);
  const report = result.payload.data.consensusReport;
  expect(report).toMatchObject({ status: "complete", independentInputsVerified: true, semanticTruthVerified: false, dispatchCount: 3,
    evidenceLevel: "synthetic-or-incomplete-responses", decision: { status: scenario === "agree" ? "recommend-proceed" : "revise", holdExecution: true, requiresNewApproval: true } });
  expect(report.decision.criteria[0].disagreement).toBe(scenario === "disagree");
  expect(report.decision.proposedPlan.requiredRevisions).toHaveLength(scenario === "disagree" ? 1 : 0);
  expect(report.decision.proposedPlan.steps).toEqual(f.input.consensusReview.proposal);
  expect(f.generated).toHaveBeenCalledTimes(3);
  const messages = f.generated.mock.calls.map(([request]: any) => request.request.messages);
  expect(new Set(messages.map(m => m[1].content)).size).toBe(1);
  for (const m of messages) { expect(m[1].content).toContain(f.source); expect(JSON.stringify(m)).not.toContain("Independent synthetic opinion from"); }
  const status = await f.send("/workforce/execute/status", { executionId: result.payload.data.executionId });
  expect(status.status).toBe(200); expect(status.payload.data.consensusReport).toEqual(report);
  const cliStatus = await f.cli(["workforce", "status", result.payload.data.executionId]);
  expect(cliStatus.code, cliStatus.stderr).toBe(0);
  expect(cliStatus.data).toMatchObject({ status: scenario === "agree" ? "advice-recorded" : "revision-required", data: { consensusReport: report } });
  if (scenario === "agree") {
    const policy = await f.app.agentGovernance.service.getEffectivePolicy(f.input.agentId, f.identity.tenantId);
    const context = { agentId: f.input.agentId, ...f.identity };
    const denied = await f.app.agentGovernance.toolProxy.enforceResult({ context, toolName: "workforce_execute", result: observed, descriptor: null,
      policy: { ...policy, scope: { ...policy.scope, deniedOutputFields: ["inputTokens"] } } });
    expect(denied.result.consensusReport.usage.inputTokens).toBe("***REDACTED***");
    const forged = structuredClone(observed); forged.consensusReport.usage.inputTokens = "SECRET_COUNTER_LOOKALIKE";
    const { reportHash: _oldHash, ...changed } = forged.consensusReport; forged.consensusReport.reportHash = consensusHash(changed);
    const redacted = await f.app.agentGovernance.toolProxy.enforceResult({ context, toolName: "workforce_execute", result: forged, descriptor: null, policy });
    expect(redacted.result.consensusReport.usage.inputTokens).toBe("***REDACTED***");
  }
  await f.executor.close(); const reopened = f.makeExecutor();
  try {
    expect((await reopened.getStatus(result.payload.data.executionId, f.identity)).consensusReport).toEqual(report);
    await expect(reopened.getStatus(result.payload.data.executionId, { ...f.identity, userId: "other-owner" })).rejects.toMatchObject({ code: "WORKFORCE_EXECUTION_FORBIDDEN" });
  } finally { await reopened.close(); }
  expect((await f.git.run(["status", "--porcelain=v1"])).stdout).toBe("");
}, 60000);

it("rejects changed approved materials before dispatch and retrieves a lost terminal response without rerunning models", async () => {
  const f = await fixture(); await f.approve();
  const changed = structuredClone(f.input); changed.consensusReview.evidence[0].content += " Unapproved source change.";
  const denied = await f.send("/workforce/execute", changed);
  expect(denied.status, JSON.stringify(denied.payload)).toBe(202); expect(f.generated).not.toHaveBeenCalled();
  const enforceResult = vi.spyOn(f.app.agentGovernance.toolProxy, "enforceResult");
  enforceResult.mockRejectedValueOnce(new Error("synthetic terminal reply unavailable"));
  const result = await f.send("/workforce/execute", f.input);
  expect(result.status, JSON.stringify(result.payload)).toBe(503);
  expect(result.payload.error.code).toBe("WORKFORCE_EXTERNAL_EFFECT_OUTCOME_UNCERTAIN");
  const executionId = result.payload.error.details.reconciliation.executionId;
  const recovered = await f.cli(["workforce", "status", executionId]);
  expect(recovered.code, recovered.stderr).toBe(0); expect(recovered.data.data.consensusReport.status).toBe("complete");
  expect(f.generated).toHaveBeenCalledTimes(3);
}, 60000);

it("records an interrupted model request as incomplete and keeps its original cancellation history", async () => {
  const f = await fixture(); const approved = await f.approve();
  let entered!: () => void; const dispatched = new Promise<void>(resolve => { entered = resolve; });
  f.generated.mockImplementationOnce(async (input: any) => new Promise((_resolve, reject) => {
    if (input.execution.signal.aborted) reject(input.execution.signal.reason);
    else input.execution.signal.addEventListener("abort", () => reject(input.execution.signal.reason), { once: true });
    entered();
  }));
  const running = f.send("/workforce/execute", f.input); await dispatched;
  expect((await f.send("/workforce/execute/cancel", { executionId: approved.executionId, reason: "fixture review cancellation" })).status).toBe(200);
  const cancelled = await running;
  expect(cancelled.status, JSON.stringify(cancelled.payload)).toBe(422);
  expect(cancelled.payload.data).toMatchObject({ executionStatus: "cancelled", consensusReport: { status: "incomplete", dispatchCount: 1, independentInputsVerified: false } });
  expect(cancelled.payload.data.consensusReport.receipts[0].receipt).toMatchObject({ providerCallAttempted: true, status: "outcome_unknown" });
  expect(f.generated).toHaveBeenCalledOnce();
  const reopened = f.makeExecutor();
  try { expect(await reopened.getStatus(approved.executionId, f.identity)).toMatchObject({ status: "cancelled", consensusReport: { status: "incomplete" } }); }
  finally { await reopened.close(); }
}, 60000);

it("refuses a corrupted persisted report without rewriting it or redispatching the original task", async () => {
  const f = await fixture(); await f.approve();
  const result = await f.send("/workforce/execute", f.input); expect(result.status).toBe(200);
  const path = createLifecycleStatePath(f.env.WORKFORCE_EXECUTION_DIR, result.payload.data.executionId);
  const state = JSON.parse(await readFile(path, "utf8")); state.summary.consensusReport.decision.status = "revise";
  const changed = JSON.stringify(state); await writeFile(path, changed);
  await f.executor.close(); const reopened = f.makeExecutor();
  try { await expect(reopened.getStatus(result.payload.data.executionId, f.identity)).rejects.toMatchObject({ code: "WORKFORCE_CONSENSUS_RECORD_INVALID" }); }
  finally { await reopened.close(); }
  expect(await readFile(path, "utf8")).toBe(changed); expect(f.generated).toHaveBeenCalledTimes(3);
}, 60000);

it("keeps invalid model opinion incomplete with its attempted-call receipt and no template consensus", async () => {
  const f = await fixture("invalid"); await f.approve();
  const result = await f.send("/workforce/execute", f.input);
  expect(result.status, JSON.stringify(result.payload)).toBe(422);
  const report = result.payload.data.consensusReport;
  expect(report).toMatchObject({ status: "incomplete", independentInputsVerified: false, dispatchCount: 1, decision: { status: "incomplete" } });
  expect(report.entries.find((entry: any) => entry.roleId === "ceo")).toMatchObject({ responseText: null, contributionStatus: "failed" });
  expect(report.receipts[0].receipt).toMatchObject({ status: "succeeded", providerCallAttempted: true, executionMode: "fake" });
  expect(f.generated).toHaveBeenCalledOnce();
  const status = await f.send("/workforce/execute/status", { executionId: result.payload.data.executionId });
  expect(status.payload.data.consensusReport).toEqual(report);
}, 60000);
