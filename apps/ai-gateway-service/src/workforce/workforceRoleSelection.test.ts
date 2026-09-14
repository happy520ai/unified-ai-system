// @test-isolation process
import { execFile } from "node:child_process";
import { access, mkdir, mkdtemp, readFile, readdir, realpath, rm, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { tmpdir } from "node:os";
import { promisify } from "node:util";
import { afterEach, expect, it, vi } from "vitest";
import { createWorkforceRoleSelection } from "./workforceRoleSelection.ts";
import { createControlledExecutor } from "./workforceControlledExecutor.js";
import { createWorktreeIsolation } from "./worktreeIsolation.js";
import { createFakeProvider } from "../providers/fakeProvider.js";
import { ProviderRegistry } from "../providers/providerRegistry.js";
import { AGENT_GOVERNANCE_EXECUTION_CONTEXT, GatewayService } from "../core/gatewayService.js";
import { createAgentGovernanceService } from "../agent-governance/agentGovernanceService.ts";
import { createAgentGovernanceToolProxy } from "../agent-governance/toolProxy.ts";
import { createWorkforceRoutes } from "../http/workforceRoutes.js";
import { createRuntimeGatewayBrainAdapter } from "@unified-ai-system/employee-brain-adapter";

const execFileAsync = promisify(execFile);
const cleanups: Array<() => Promise<unknown>> = [];
afterEach(async () => { for (const cleanup of cleanups.splice(0).reverse()) await cleanup(); vi.restoreAllMocks(); });
function config(): any {
  const candidates = ["ceo", "pm", "architect"].map((roleId, priority) => ({ employeeId: `emp-${roleId}`, status: "enabled", roleIds: [roleId], taskTypes: ["analysis"],
    providerId: "fixture", modelId: "fixture-model", priority, limits: { maxRequests: 1, maxInputTokens: 4096, maxOutputTokens: 1024, timeoutMs: 5000 } }));
  return { version: 1, catalogId: "accepted-fixture", catalogRevision: "r1", maxCandidates: 5, maxSelectedRoles: 3, maxConcurrentRoles: 2, maxTotalRequests: 3,
    candidates, qualifications: candidates.map((item) => ({ qualificationId: `q-${item.employeeId}`, employeeId: item.employeeId,
      providerId: item.providerId, modelId: item.modelId, roleIds: item.roleIds, taskTypes: item.taskTypes, status: "accepted", origin: "synthetic", executionMode: "fake",
      evidenceHash: `sha256:${"a".repeat(64)}`, validUntil: "2099-01-01T00:00:00.000Z" })) };
}
const task = { taskType: "analysis", roleIds: ["ceo"], executionMode: "fake" } as const;

it("rejects role arrays with custom iterators, methods or prototypes before invoking them", () => {
  let executed = 0;
  const selector = createWorkforceRoleSelection({ configuration: config(), gatewayService: { execute: async () => ({}) }, providerRegistry: { get: () => null } });
  for (const variant of ["iterator", "method", "prototype"]) {
    const roles = ["ceo"];
    const iterator = function* () { executed += 1; yield "ceo"; };
    if (variant === "iterator") Object.defineProperty(roles, Symbol.iterator, { value: iterator });
    if (variant === "method") Object.defineProperty(roles, "forEach", { value: (fn: any) => { executed += 1; fn("ceo"); } });
    if (variant === "prototype") Object.setPrototypeOf(roles, Object.assign(Object.create(Array.prototype), { [Symbol.iterator]: iterator }));
    expect(() => selector.resolve({ ...task, roleIds: roles })).toThrow(expect.objectContaining({ code: "WORKFORCE_SELECTION_TASK_INVALID" }));
  }
  expect(executed).toBe(0);
});

it.each([["availability", "await"], ["qualification", "await"], ["availability", "microtask"], ["qualification", "microtask"]])("rechecks %s after the task fence final commit %s before an actual A/B dispatch", async (change, timing) => {
  const provider = createFakeProvider({ providerId: "fixture", modelId: "fixture-model", providerType: "fake", capabilities: ["chat"], enabled: true } as any);
  const calls = vi.spyOn(provider, "generate"); const registry = new (ProviderRegistry as any)({ enabledProviders: ["fixture"] }); registry.register(provider);
  const gateway = new GatewayService({ providerRegistry: registry, runtimeConfig: { providerMode: "fake", realProviderEnabled: false } }); let time = Date.now();
  const selected = createWorkforceRoleSelection({ configuration: config(), gatewayService: gateway as any, providerRegistry: registry, now: () => time }).resolve(task);
  const signal = new AbortController().signal;
  const context = { identity: { tenantId: "tenant-fence", userId: "operator", role: "admin", permissions: ["*"] }, agentId: "agt_fence", agentRunId: "agr_fence",
    policyHash: `sha256:${"a".repeat(64)}`, executionId: "execution-fence", planId: "plan-fence", planDigest: "b".repeat(64), profileHash: selected.profile.profileHash,
    signal, agentFence: { assertActive: async () => true }, requestExecution: { signal, timeoutMs: 30000, deadlineAt: Date.now() + 30000,
      providerDispatchRoute: "/workforce/execute", providerDispatchKeyHash: "c".repeat(64) } };
  const run = selected.roleProviderFactory.forRun(context);
  const role = run.createRoleAdapter({ roleId: "ceo", taskId: "task-fence", signal, taskFence: { async assertActive(phase) {
    if (phase === "commit") {
      const invalidate = () => { if (change === "availability") provider.descriptor.models[0].enabled = false; else time = Date.parse("2100-01-01T00:00:00.000Z"); };
      if (timing === "microtask") queueMicrotask(() => queueMicrotask(invalidate));
      else { await Promise.resolve(); invalidate(); }
    }
  } } });
  const brain = createRuntimeGatewayBrainAdapter({ providerAdapter: role, context: { employeeId: "emp-ceo", roleId: "ceo", governedAgentId: context.agentId,
    agentRunId: context.agentRunId, executionId: context.executionId, taskId: "task-fence", planId: context.planId, planDigest: context.planDigest, profileHash: context.profileHash } });
  await expect(brain.generate({ request: { messages: [{ role: "user", content: "Produce a bounded contribution" }] } })).rejects.toMatchObject({
    code: "WORKFORCE_PROVIDER_DISPATCH_DENIED",
    workforceReceipt: { status: "blocked", providerCallAttempted: false, errorCode: "WORKFORCE_PROVIDER_DISPATCH_DENIED" },
  });
  expect(calls).not.toHaveBeenCalled(); expect(run.getUsage().totalRequests).toBe(0);
});
async function fixture(configuration = config()) {
  const root = await mkdtemp(join(await realpath(tmpdir()), "uai-selection-"));
  cleanups.push(async () => { expect(await realpath(root)).toBe(root); expect(dirname(root)).toBe(await realpath(tmpdir())); await rm(root, { recursive: true, force: true }); });
  const repo = join(root, "repo"); const hooks = join(root, "hooks"); await mkdir(repo); await mkdir(hooks);
  const git = (...args: string[]) => execFileAsync("git", ["-C", repo, "-c", "core.hooksPath=" + hooks, "-c", "commit.gpgSign=false",
    "-c", "user.name=Selection Fixture", "-c", "user.email=selection@example.invalid", ...args], { cwd: root });
  await git("-c", "init.templateDir=", "init", "--initial-branch=main"); await writeFile(join(repo, "README.md"), "# Synthetic selection fixture\n", "utf8");
  await git("add", "README.md"); await git("commit", "-m", "Synthetic fixture"); expect((await git("ls-files")).stdout.trim()).toBe("README.md");
  const registry = new (ProviderRegistry as any)({ enabledProviders: ["fixture"] });
  const provider = createFakeProvider({ providerId: "fixture", modelId: "fixture-model", providerType: "fake", capabilities: ["chat"], enabled: true } as any);
  const calls = vi.spyOn(provider, "generate"); registry.register(provider);
  const gateway = new GatewayService({ providerRegistry: registry, runtimeConfig: { providerMode: "fake", realProviderEnabled: false } });
  const gatewayCalls = vi.spyOn(gateway, "execute"); let time = Date.now();
  const selection = createWorkforceRoleSelection({ configuration, gatewayService: gateway as any, providerRegistry: registry, now: () => time });
  const service = createAgentGovernanceService({ dataDir: join(root, "governance"), env: { AI_GATEWAY_AGENT_GOVERNANCE_HMAC_KEY: "selection-fixture-only-material-0123456789" } });
  const proxy = createAgentGovernanceToolProxy({ service }); let sequence = 0;
  const prepare = async (requestTask = task as { taskType: string; roleIds: readonly string[]; executionMode: "fake" | "real" }, tenant = "tenant-a") => {
    const selected = selection.resolve(requestTask); const current = ++sequence;
    const identity = { tenantId: tenant, userId: `operator-${current}`, role: "admin", permissions: ["*"] };
    const agent = await service.generateAgent({ name: `selected-worker-${current}`, task: "Run a bounded selected employee contribution", requestedTools: ["workforce_execute"],
      ttlSeconds: 3600, parentAgentId: null, instanceRules: { toolRules: { workforce_execute: "require_approval" } } }, identity);
    const worktree = createWorktreeIsolation({ repoRoot: repo, worktreeRoot: join(root, "worktrees") }); const create = vi.spyOn(worktree, "create");
    const executor = createControlledExecutor({ env: { WORKFORCE_EXECUTION_ENABLED: "true", WORKFORCE_EXECUTION_TIMEOUT_MS: "10000" },
      repoRoot: repo, executionDir: join(root, `execution-${current}`), worktreeIsolation: worktree, roleProviderFactory: selected.roleProviderFactory });
    cleanups.push(() => executor.close());
    const input = { goal: "Produce a concise bounded analysis", planId: `selection-plan-${current}`, autonomyMode: "controlled-execution", agentId: agent.agentId };
    let output: any; let status: number; let failure: any;
    const routes = createWorkforceRoutes({ workforceExecutor: executor, workforceService: {}, workflowService: {}, agentGovernance: { service, toolProxy: proxy } }, {
      requestExecution: { signal: new AbortController().signal, timeoutMs: 30_000, deadlineAt: Date.now() + 30_000, providerDispatchRoute: "/workforce/execute", providerDispatchKeyHash: "c".repeat(64) },
      writeJson: (_response: unknown, code: number, value: unknown) => { status = code; output = value; }, writeErrorResponse: ({ error }: any) => { failure = error; },
      writeServiceLog: () => {}, readCapabilityJson: () => {}, createOkEnvelope: (value: unknown) => value, createErrorEnvelope: () => {},
    });
    const invoke = async () => { output = null; status = 0; failure = null;
      await (routes.handlers.get("POST /workforce/execute") as any).handler({ enterpriseIdentity: identity }, {}, { body: input, startedAt: new Date() });
      return { status, output, failure }; };
    const pending = await invoke(); expect(pending.status).toBe(202); expect(pending.output.approvalId).toMatch(/^appr_/);
    await service.decideApproval(pending.output.approvalId, "approve", identity);
    await executor.approveExecution({ ...input, tenantId: identity.tenantId }, identity.userId, ["workforce:execute"]);
    return { selected, input, invoke, executor, worktree, create, identity, agentId: agent.agentId };
  };
  return { root, repo, git, selection, prepare, provider, calls, gatewayCalls, setTime: (value: number) => { time = value; } };
}

it.each([["ceo"], ["pm", "architect"]])("selection consumes the real A/B contract with approvals, claims, security and owned Git isolation: %j", async (...roles) => {
  const roleIds = roles as string[]; const f = await fixture(); const prepared = await f.prepare({ ...task, roleIds });
  const head = (await f.git("rev-parse", "HEAD")).stdout; const result = await prepared.invoke();
  expect(result.failure).toBeNull(); expect(result.status).toBe(200); expect(result.output.success).toBe(true);
  const expected = roleIds.length === 1 ? ["ceo"] : ["architect", "ceo", "pm"];
  expect(prepared.selected.profile.bindings.map((binding) => binding.roleId)).toEqual(expected);
  expect(result.output.roleExecution).toMatchObject({ requestsDispatched: expected.length, fakeContributions: expected.length, realContributions: 0 });
  expect(result.output.security).toMatchObject({ preScan: "pass", postScan: "pass", workspaceCheck: true });
  for (const roleId of expected) {
    expect(result.output.roleResults[roleId].workforceContribution).toMatchObject({ employeeId: `emp-${roleId}`, profileHash: prepared.selected.profile.profileHash,
      governedAgentId: prepared.agentId, receipt: { executionMode: "fake", inputTokens: null, outputTokens: null, totalTokens: null, estimatedCostUsd: null } });
  }
  expect(f.calls).toHaveBeenCalledTimes(expected.length); const created = await prepared.create.mock.results[0].value;
  expect(created.success).toBe(true);
  if (!created.worktree) throw new Error("The owned selection fixture worktree was not created.");
  expect(dirname(created.worktree.path)).toBe(join(f.root, "worktrees")); await expect(access(created.worktree.path)).rejects.toMatchObject({ code: "ENOENT" });
  expect(prepared.worktree.getInfo().activeWorktrees).toBe(0); expect((await f.git("branch", "--format=%(refname:short)")).stdout.trim()).toBe("main");
  expect((await f.git("status", "--porcelain=v1")).stdout).toBe(""); expect((await f.git("rev-parse", "HEAD")).stdout).toBe(head);
});

it("adds every dependency or refuses missing coverage and over-budget closure before any Provider call", async () => {
  const missing = config(); missing.candidates = missing.candidates.filter((candidate: any) => candidate.roleIds[0] !== "ceo");
  const f = await fixture(missing);
  expect(() => f.selection.resolve({ ...task, roleIds: ["architect"] })).toThrow(expect.objectContaining({ code: "WORKFORCE_SELECTION_INCOMPLETE" }));
  expect(() => f.selection.resolve({ ...task, roleIds: ["backend-engineer"] })).toThrow(expect.objectContaining({ code: "WORKFORCE_SELECTION_ROLE_LIMIT" }));
  expect(() => f.selection.resolve({ ...task, roleIds: ["UX Researcher"] })).toThrow(expect.objectContaining({ code: "WORKFORCE_SELECTION_ROLE_UNSUPPORTED" }));
  expect(f.calls).not.toHaveBeenCalled();
});

it("keeps approved choices stable when targets become unavailable or accepted qualification expires", async () => {
  const configured = config(); configured.candidates.push({ ...configured.candidates[0], employeeId: "emp-standby", priority: 99 });
  configured.qualifications.push({ ...configured.qualifications[0], qualificationId: "q-standby", employeeId: "emp-standby" });
  const f = await fixture(configured); const prepared = await f.prepare(); const before = await prepared.executor.describeExecution(prepared.input);
  f.provider.descriptor.models[0].enabled = false;
  expect(f.selection.resolve(task).profile).toEqual(prepared.selected.profile);
  expect((await prepared.invoke()).failure).toMatchObject({ code: "WORKFORCE_SELECTION_TARGET_UNAVAILABLE" });
  expect(await prepared.executor.describeExecution(prepared.input)).toEqual(before); expect(f.calls).not.toHaveBeenCalled();
  expect(prepared.create).not.toHaveBeenCalled();
  f.provider.descriptor.models[0].enabled = true; const expired = await f.prepare(); f.setTime(Date.parse("2100-01-01T00:00:00.000Z"));
  expect((await expired.invoke()).failure).toMatchObject({ code: "WORKFORCE_SELECTION_QUALIFICATION_EXPIRED" });
  expect(f.calls).not.toHaveBeenCalled();
  f.setTime(Date.now()); const modeChanged = await f.prepare();
  (f.provider.descriptor.metadata as any).providerType = "http-llm";
  expect((await modeChanged.invoke()).failure).toMatchObject({ code: "WORKFORCE_SELECTION_EXECUTION_MODE_MISMATCH" });
  expect(f.calls).not.toHaveBeenCalled();
});

it("keeps concurrently executing tenants and Agent/run dispatch contexts separate", async () => {
  const f = await fixture(); const a = await f.prepare(task, "tenant-a"); const b = await f.prepare(task, "tenant-b");
  const results = await Promise.all([a.invoke(), b.invoke()]); expect(results.map((result) => result.status)).toEqual([200, 200]);
  const contexts = f.gatewayCalls.mock.calls.map(([input]) => (input as any)[AGENT_GOVERNANCE_EXECUTION_CONTEXT]);
  expect(new Set(contexts.map((context) => context.tenantId))).toEqual(new Set(["tenant-a", "tenant-b"]));
  expect(new Set(contexts.map((context) => context.runId)).size).toBe(2);
  expect(new Set(f.gatewayCalls.mock.calls.map(([, execution]) => execution?.providerDispatchKeyHash)).size).toBe(2);
  expect(results.every((result) => result.output.roleResults.ceo.workforceContribution.employeeId === "emp-ceo")).toBe(true);
});

it("does not retry another selected candidate or fall back to a template after Provider failure", async () => {
  const f = await fixture(); const prepared = await f.prepare(); f.calls.mockRejectedValue(Object.assign(new Error("fixture failure"), { code: "FIXTURE_FAILURE", retryable: false }));
  const result = await prepared.invoke(); expect(result.status).toBe(422); expect(result.output.roleResults).toEqual({});
  expect(result.output.roleExecution).toMatchObject({ requestsDispatched: 1, fakeContributions: 0, realContributions: 0 });
  expect(f.calls).toHaveBeenCalledTimes(1);
});
