import { execFile } from "node:child_process";
import { access, mkdir, mkdtemp, readFile, readdir, realpath, rm, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { tmpdir } from "node:os";
import { promisify } from "node:util";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createGatewayApplication } from "../application/createGatewayApplication.js";
import { createAgentApprovalStore } from "../agent-governance/agentApprovalStore.ts";
import { AGENT_GOVERNANCE_EXECUTION_CONTEXT, GatewayService } from "../core/gatewayService.js";
import { createWorkforceRoutes } from "../http/workforceRoutes.js";
import { createFakeProvider } from "../providers/fakeProvider.js";
import { ProviderRegistry } from "../providers/providerRegistry.js";
import { createControlledExecutor } from "./workforceControlledExecutor.js";
import { createWorkforceRoleProviderFactory } from "./workforceRoleProvider.ts";
import { freezeWorkforceRoleExecutionProfile } from "./workforceRoleExecutionProfile.ts";
import { createWorktreeIsolation } from "./worktreeIsolation.js";
import { createGitWorkspaceGuard } from "./gitWorkspaceGuard.js";
import { createSecurityReviewCheckpoint } from "./securityReviewCheckpoint.js";
import { createTaskEvidenceCapture } from "./taskEvidenceCapture.js";

const cleanups: Array<() => Promise<unknown>> = [];
const execFileAsync = promisify(execFile);
afterEach(async () => { for (const cleanup of cleanups.splice(0).reverse()) await cleanup(); vi.restoreAllMocks(); });
const identity = { tenantId: "tenant-fixture", userId: "user-fixture", role: "developer", permissions: ["workflow:run"] };
const input = { planId: "bounded-plan", goal: "Describe one concrete acceptance criterion for a task report",
  autonomyMode: "controlled-execution", agentId: "agt_fixture", userId: identity.userId, tenantId: identity.tenantId };
const policyHash = `sha256:${"a".repeat(64)}`;
function profileInput(roles = ["ceo"]) {
  return { version: 1, mode: "gateway-llm-required", profileId: "explicit-fixture", maxTotalRequests: roles.length,
    maxConcurrentRoles: 1, bindings: roles.map((roleId) => ({ roleId, employeeId: `employee-${roleId}`,
      providerId: "fixture", modelId: "fixture-model", maxRequests: 1, maxInputTokens: 4096, maxOutputTokens: 1024, timeoutMs: 5000 })) };
}
async function tempRoot() {
  const root = await mkdtemp(join(await realpath(tmpdir()), "uai-workforce-runtime-"));
  cleanups.push(async () => {
    expect(await realpath(root)).toBe(root); expect(dirname(root)).toBe(await realpath(tmpdir()));
    await rm(root, { recursive: true, force: true });
  });
  return root;
}
async function fixture(options: { profile?: any; disabled?: boolean; pending?: boolean; root?: string; realRepo?: string } = {}) {
  const root = options.root ?? await tempRoot();
  const controller = new AbortController();
  const roleProfile = freezeWorkforceRoleExecutionProfile(options.profile ?? profileInput());
  const provider = createFakeProvider({ providerId: "fixture", modelId: "fixture-model", providerType: "fake", capabilities: ["chat"], enabled: true } as any);
  const originalGenerate = provider.generate.bind(provider);
  const calls = vi.spyOn(provider, "generate");
  const registry = new (ProviderRegistry as any)({ enabledProviders: ["fixture"] }); registry.register(provider);
  const gateway = new GatewayService({ providerRegistry: registry, runtimeConfig: { providerMode: "fake", realProviderEnabled: false } });
  const gatewayCalls = vi.spyOn(gateway, "execute");
  const worktree: any = options.realRepo ? createWorktreeIsolation({ repoRoot: options.realRepo, worktreeRoot: join(root, "worktrees") })
    : { getInfo: () => ({}), create: vi.fn(async () => ({ success: true, worktree: { worktreeId: "fixture-worktree", path: root } })),
      remove: vi.fn(async () => ({ success: true })) };
  if (options.realRepo) { vi.spyOn(worktree, "create"); vi.spyOn(worktree, "remove"); }
  const executor = createControlledExecutor({ env: { WORKFORCE_EXECUTION_ENABLED: options.disabled ? "false" : "true",
    WORKFORCE_EXECUTION_TIMEOUT_MS: "5000", AI_GATEWAY_WORKFORCE_CONTROL_POLL_MS: "5000" }, executionDir: join(root, "execution"),
    roleProviderFactory: createWorkforceRoleProviderFactory({ gatewayService: gateway as any, providerRegistry: registry, profile: roleProfile }),
    ...(options.realRepo ? { repoRoot: options.realRepo } : {}),
    worktreeIsolation: worktree, workspaceGuard: options.realRepo ? createGitWorkspaceGuard({ cwd: options.realRepo }) : { check: async () => ({ clean: true }) },
    securityCheckpoint: options.realRepo ? createSecurityReviewCheckpoint({ auditLogDir: join(root, "security-audit") })
      : { getInfo: () => ({}), preExecutionCheck: async () => ({ result: "pass", findings: [] }), postExecutionCheck: async () => ({ result: "pass", findings: [] }) },
    evidenceCapture: options.realRepo ? createTaskEvidenceCapture({ evidenceDir: join(root, "evidence") }) : { startCapture: () => null },
    sandboxMerger: { getInfo: () => ({}) },
    tierGovernor: { getInfo: () => ({}), getCurrentTier: async () => ({ autonomyMode: "controlled-execution" }) },
  });
  cleanups.push(() => executor.close());
  const executionLease = { signal: controller.signal, assertActive: vi.fn(async () => {
    if (controller.signal.aborted) throw controller.signal.reason;
    return true;
  }), release: vi.fn() };
  const policy = { policyHash, limits: { maxSteps: 10, maxWorkforceRoles: 7, maxRuntimeSeconds: 30 } };
  const requestExecution = { signal: new AbortController().signal, deadlineAt: Date.now() + 30_000, timeoutMs: 30_000,
    providerDispatchRoute: "/workforce/execute", providerDispatchKeyHash: "c".repeat(64) };
  const executeOptions = { identity, requestExecution, signal: requestExecution.signal,
    agentGovernance: { context: { ...identity, agentId: input.agentId }, policy, executionLease, remainingSteps: 10,
      reserveStep: vi.fn(async () => ({ allowed: true })) } };
  const enforce = vi.fn(async (_request: any) => options.pending ? { outcome: "approval_required", approvalId: "pending-fixture" }
    : { outcome: "allow", executionLease: { release: vi.fn() } });
  const writeJson = vi.fn(); const writeErrorResponse = vi.fn();
  const routes = createWorkforceRoutes({ workforceExecutor: executor, workforceService: {}, workflowService: {}, agentGovernance: {
    service: { authorizeAgentExecution: async () => ({ record: { agentId: input.agentId, parentAgentId: null, generationDepth: 0 }, policy, executionLease }),
      getUsage: async () => ({ toolCalls: 0, steps: 0, records: 0 }), reserveUsage: async () => ({ allowed: true }) },
    toolProxy: { enforce, enforceResult: async ({ result }: any) => ({ verdict: "allow", result }) },
  } }, { requestExecution, writeJson, writeErrorResponse, writeServiceLog: vi.fn(), readCapabilityJson: vi.fn(),
    createOkEnvelope: (data: any) => data, createErrorEnvelope: (data: any) => data });
  const invoke = async (body = input) => {
    writeJson.mockClear(); writeErrorResponse.mockClear();
    await (routes.handlers.get("POST /workforce/execute") as any).handler({ enterpriseIdentity: identity }, {}, { body, startedAt: new Date() });
    return { status: writeJson.mock.calls[0]?.[1], data: writeJson.mock.calls[0]?.[2], error: writeErrorResponse.mock.calls[0]?.[0]?.error };
  };
  return { root, executor, roleProfile, provider, originalGenerate, calls, gatewayCalls, registry, worktree, controller,
    executeOptions, enforce, invoke, approve: () => executor.approveExecution(input, identity.userId, ["workforce:execute"]) };
}

describe("approved Workforce employee runtime through the HTTP route", () => {
  it("executes with real isolation and security components against an owned synthetic Git repository", async () => {
    const root = await tempRoot(); const repo = join(root, "synthetic-repo"); const hooks = join(root, "empty-hooks");
    await mkdir(repo); await mkdir(hooks);
    const git = (...args: string[]) => execFileAsync("git", ["-C", repo, "-c", "core.hooksPath=" + hooks,
      "-c", "commit.gpgSign=false", "-c", "user.name=Workforce Fixture", "-c", "user.email=workforce-fixture@example.invalid", ...args], { cwd: root });
    await git("-c", "init.templateDir=", "init", "--initial-branch=main");
    const content = "# Owned synthetic Workforce fixture\nNo product files or credentials.\n";
    await writeFile(join(repo, "README.md"), content, "utf8"); await git("add", "README.md"); await git("commit", "-m", "Create synthetic fixture");
    expect((await git("ls-files")).stdout.trim()).toBe("README.md");
    expect((await readdir(repo)).sort()).toEqual([".git", "README.md"]);
    expect((await git("status", "--porcelain=v1")).stdout).toBe("");
    const head = (await git("rev-parse", "HEAD")).stdout.trim();
    const f = await fixture({ root, realRepo: repo }); await f.approve();
    let createdPath = "";
    f.calls.mockImplementation(async (request: any) => {
      const created = await f.worktree.create.mock.results[0].value;
      createdPath = created.worktree.path;
      expect(dirname(await realpath(createdPath))).toBe(await realpath(join(root, "worktrees")));
      expect((await readdir(createdPath)).sort()).toEqual([".git", "README.md"]);
      expect((await readFile(join(createdPath, "README.md"), "utf8")).replace(/\r\n/g, "\n")).toBe(content);
      expect(f.worktree.getInfo().activeWorktrees).toBe(1);
      return f.originalGenerate(request);
    });
    const result = await f.invoke();
    expect(result.error).toBeUndefined(); expect(result.status).toBe(200);
    expect(result.data).toMatchObject({ success: true, totalRoles: 1, rolesExecuted: 1,
      security: { preScan: "pass", postScan: "pass", workspaceCheck: true }, worktree: { created: true, cleanedUp: true },
      roleExecution: { requestsDispatched: 1, fakeContributions: 1, realContributions: 0 } });
    expect(f.calls).toHaveBeenCalledTimes(1); expect(f.worktree.create).toHaveBeenCalledTimes(1); expect(f.worktree.remove).toHaveBeenCalledTimes(1);
    await expect(access(createdPath)).rejects.toMatchObject({ code: "ENOENT" });
    expect(f.worktree.getInfo().activeWorktrees).toBe(0);
    expect((await git("worktree", "list", "--porcelain")).stdout.match(/^worktree /gm)).toHaveLength(1);
    expect((await git("branch", "--format=%(refname:short)")).stdout.trim()).toBe("main");
    expect((await git("status", "--porcelain=v1")).stdout).toBe("");
    expect((await git("rev-parse", "HEAD")).stdout.trim()).toBe(head);
    expect((await readdir(root)).sort()).toEqual(["empty-hooks", "evidence", "execution", "security-audit", "synthetic-repo", "worktrees"]);
  });

  it("runs one dependency-free employee through route, durable approval/claim, employee package and Gateway", async () => {
    const f = await fixture(); await f.approve();
    const result = await f.invoke({ ...input, tenantId: "forged", userId: "forged", roleExecution: { mode: "forged" } } as any);
    expect(result.error).toBeUndefined(); expect(result.status).toBe(200);
    expect(result.data).toMatchObject({ success: true, totalRoles: 1, rolesExecuted: 1,
      roleExecution: { requestsDispatched: 1, fakeContributions: 1, realContributions: 0 }, safety: { providerCallsMade: true } });
    expect(f.calls).toHaveBeenCalledTimes(1);
    const contribution = result.data.roleResults.ceo.workforceContribution;
    expect(contribution).toMatchObject({ employeeId: "employee-ceo", roleId: "ceo", governedAgentId: input.agentId,
      profileHash: f.roleProfile.profileHash, receipt: { status: "succeeded", executionMode: "fake", estimatedCostUsd: null } });
    expect(contribution.agentRunId).toMatch(/^agr_/); expect(contribution.taskId).toBeTruthy();
    expect(result.data.roleResults.ceo.templateBaseline).toBeUndefined();
    expect(f.gatewayCalls.mock.calls[0][0].enterpriseIdentity).toMatchObject(identity);
    expect((f.gatewayCalls.mock.calls[0][0] as any)[AGENT_GOVERNANCE_EXECUTION_CONTEXT]).toMatchObject({ runId: contribution.agentRunId, tenantId: identity.tenantId });
    expect(f.worktree.remove).toHaveBeenCalledTimes(1);
    const reviewRequest = f.enforce.mock.calls[0][0] as any;
    expect(reviewRequest.resourceContext.approvalReview.workforce.options.roleExecution).toEqual(f.roleProfile);
    const store = createAgentApprovalStore({ storePath: join(f.root, "agent-approvals.json"), secret: "fixture-only-approval-signing-material" });
    const stored = await store.create({ agentId: input.agentId, tenantId: identity.tenantId, toolName: "workforce_execute",
      arguments: reviewRequest.params, review: { ...reviewRequest.resourceContext.approvalReview, policyHash } });
    expect(stored.review.workforce?.options.roleExecution).toEqual(f.roleProfile);
  });

  it("keeps both pending Tool Proxy approval and absent plan approval at zero Provider calls", async () => {
    const pending = await fixture({ pending: true }); await pending.approve();
    expect((await pending.invoke()).status).toBe(202); expect(pending.calls).not.toHaveBeenCalled();
    const absent = await fixture(); const result = await absent.invoke();
    expect(result.data).toMatchObject({ success: false, executionStatus: "blocked", code: "approval_required" });
    expect(absent.calls).not.toHaveBeenCalled(); expect(absent.worktree.create).not.toHaveBeenCalled();
  });

  it("does not upgrade a previously approved profile after target or budget changes", async () => {
    const original = await fixture(); await original.approve();
    const changed = profileInput(); changed.bindings[0].maxOutputTokens = 256;
    const replacement = await fixture({ root: original.root, profile: changed });
    const result = await replacement.invoke();
    expect(result.data?.success).toBe(false); expect(replacement.calls).not.toHaveBeenCalled();
    expect(replacement.worktree.create).not.toHaveBeenCalled();
  });

  it("rejects unknown roles, missing dependencies, caller-selected roles and unavailable targets before dispatch", async () => {
    for (const roles of [["unknown"], ["architect"]]) {
      const f = await fixture({ profile: profileInput(roles) });
      await expect(f.approve()).rejects.toMatchObject({ code: roles[0] === "unknown" ? "WORKFORCE_ROLE_BINDING_REQUIRED" : "WORKFORCE_ROLE_DEPENDENCY_REQUIRED" });
      expect(f.calls).not.toHaveBeenCalled();
    }
    const f = await fixture();
    await expect(f.executor.describeExecution({ ...input, selectedRoles: ["pm"] })).rejects.toMatchObject({ code: "WORKFORCE_ROLE_BINDING_REQUIRED" });
    await f.approve(); f.provider.descriptor.models[0].enabled = false;
    expect((await f.invoke()).error).toMatchObject({ code: "WORKFORCE_ROLE_PROVIDER_UNSUPPORTED" });
    expect(f.calls).not.toHaveBeenCalled(); expect(f.worktree.create).not.toHaveBeenCalled();
    const mixed = profileInput(["ceo", "pm"]); mixed.bindings[1].modelId = "missing-model";
    const laterUnsupported = await fixture({ profile: mixed }); await laterUnsupported.approve();
    expect((await laterUnsupported.invoke()).error).toMatchObject({ code: "WORKFORCE_ROLE_PROVIDER_UNSUPPORTED" });
    expect(laterUnsupported.calls).not.toHaveBeenCalled(); expect(laterUnsupported.worktree.create).not.toHaveBeenCalled();
  });

  it("reports a Provider failure and never fabricates a template contribution or completes dependent roles", async () => {
    const f = await fixture({ profile: profileInput(["ceo", "pm"]) }); await f.approve();
    f.calls.mockRejectedValue(Object.assign(new Error("Fixture provider failure"), { code: "FIXTURE_FAILED", retryable: false }));
    const result = await f.invoke();
    expect(result.status).toBe(422); expect(result.data.success).toBe(false); expect(f.calls).toHaveBeenCalledTimes(1);
    expect(result.data.roleExecution).toMatchObject({ requestsDispatched: 1, realContributions: 0, fakeContributions: 0 });
    expect(result.data.roleExecution.receipts[0].receipt.status).not.toBe("succeeded");
    expect(result.data.roleResults).toEqual({}); expect(result.data.safety.providerCallsMade).toBe(true);
  });

  it("requires trusted governance and keeps configured-but-disabled execution as a preview", async () => {
    const f = await fixture(); await f.approve();
    await expect(f.executor.execute(input, { signal: new AbortController().signal })).rejects.toMatchObject({ code: "WORKFORCE_ROLE_GOVERNANCE_REQUIRED" });
    expect(f.calls).not.toHaveBeenCalled();
    const disabled = await fixture({ disabled: true }); const result = await disabled.invoke();
    expect(result.data.safety.providerCallsMade).toBe(false); expect(disabled.calls).not.toHaveBeenCalled();
  });

  it("drains a cancelled active Provider call and leaves its result uncertain without starting dependents", async () => {
    const f = await fixture({ profile: profileInput(["ceo", "pm"]) }); await f.approve();
    let announce: () => void = () => {}; const started = new Promise<void>((resolve) => { announce = resolve; });
    let drained = false;
    f.calls.mockImplementation(async (request: any) => {
      announce();
      try { await new Promise((_resolve, reject) => request.execution.signal.addEventListener("abort", () => reject(request.execution.signal.reason), { once: true })); }
      finally { drained = true; }
      throw new Error("Unreachable fixture path");
    });
    const execution = f.invoke(); await started;
    f.controller.abort(Object.assign(new Error("Fixture Agent revoked"), { code: "AGENT_EXECUTION_FENCED" }));
    const result = await execution;
    expect(drained).toBe(true); expect(f.calls).toHaveBeenCalledTimes(1); expect(result.data.success).toBe(false);
    expect(result.data.roleExecution).toMatchObject({ requestsDispatched: 1, realContributions: 0, fakeContributions: 0 });
    expect(result.data.roleExecution.receipts[0].receipt).toMatchObject({ status: "outcome_unknown", providerCallAttempted: true });
    expect(f.worktree.remove).toHaveBeenCalledTimes(1);
  });

  it("rejects unsafe contribution text before completing a role or persisting its output", async () => {
    const f = await fixture(); await f.approve();
    f.calls.mockImplementation(async (request: any) => ({ ...await f.originalGenerate(request), text: "password=fixture-sensitive-value",
      message: { role: "assistant", content: "password=fixture-sensitive-value" } }));
    const result = await f.invoke();
    expect(result.data.success).toBe(false); expect(result.data.roleResults).toEqual({});
    expect(result.data.roleExecution).toMatchObject({ requestsDispatched: 1, fakeContributions: 0, realContributions: 0 });
    expect(result.data.roleExecution.receipts[0].receipt).toMatchObject({ status: "failed", errorCode: "WORKFORCE_ROLE_CONTRIBUTION_UNSAFE" });
    expect(JSON.stringify(result.data)).not.toContain("fixture-sensitive-value");
    const queueState = await readFile(join(f.root, "execution", "task-queue", "task-queue.json"), "utf8");
    expect(queueState).not.toContain("fixture-sensitive-value");
    expect(JSON.parse(queueState).completedTasks).toEqual([expect.objectContaining({
      status: "failed", result: null, error: "The Workforce role Provider operation could not complete within its approved binding.",
    })]);
  });
});

it("production construction requires an explicit profile and preserves the default non-model Workforce lane", async () => {
  const root = await tempRoot();
  const env = { AI_GATEWAY_AGENT_GOVERNANCE_ENABLED: "false", PME_RUNTIME_CREDENTIAL_STORE_MODE: "memory", KNOWLEDGE_STORAGE_MODE: "memory",
    AI_GATEWAY_LOCAL_CLIENT_REGISTRY_PATH: join(root, "clients.json"), AI_GATEWAY_LOCAL_CLIENT_EXECUTION_LOG_PATH: join(root, "clients.jsonl"),
    AI_GATEWAY_LOCAL_CLIENT_DISCOVERY_HINTS_PATH: join(root, "discovery.json"), AI_GATEWAY_LOCAL_CLIENT_EXECUTION_CONTROL_DIR: join(root, "client-control"),
    AI_GATEWAY_MODEL_LIBRARY_STATE_PATH: join(root, "models.json"), AI_GATEWAY_USAGE_LOG_DIR: join(root, "usage"), WORKFORCE_EXECUTION_DIR: join(root, "workforce"),
    WORKFLOW_OUTPUT_DIR: join(root, "workflow"), PME_API_KEY_STORE_PATH: join(root, "api-keys.json"), PME_ENTERPRISE_USER_STORE_PATH: join(root, "users.json"), PME_AUDIT_LOG_PATH: join(root, "audit.jsonl") };
  expect(() => createGatewayApplication({ ...env, AI_GATEWAY_WORKFORCE_ROLE_EXECUTION_PROFILE_JSON: "{invalid-profile" })).toThrow("must contain a valid execution profile");
  for (const withProfile of [false, true]) {
    const application = createGatewayApplication({ ...env,
      ...(withProfile ? { AI_GATEWAY_WORKFORCE_ROLE_EXECUTION_PROFILE_JSON: JSON.stringify(profileInput()) } : {}) });
    cleanups.push(async () => { await application.workforceExecutor.close(); await application.requestLogger.close();
      await application.providerDispatchGate.close(); await application.externalEffectGate.close(); });
    expect(application.workforceExecutor.getInfo().executionEnabled).toBe(false);
    expect(application.workforceExecutor.getInfo().roleExecution?.profileId ?? null).toBe(withProfile ? "explicit-fixture" : null);
  }
});
