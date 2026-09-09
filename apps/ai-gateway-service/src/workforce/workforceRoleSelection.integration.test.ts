import { execFile } from "node:child_process";
import { once } from "node:events";
import { mkdir, mkdtemp, readFile, readdir, realpath, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { promisify } from "node:util";
import { afterEach, expect, it, vi } from "vitest";
import { createGatewayApplication } from "../application/createGatewayApplication.js";
import { createGatewayHttpServer } from "../http/httpServer.js";
import { createControlledExecutor } from "./workforceControlledExecutor.js";
import { createConfiguredWorkforceRoleSelection } from "./workforceRoleSelection.ts";
import { createWorktreeIsolation } from "./worktreeIsolation.js";
import { createLifecycleStatePath } from "./executionLifecycleHelpers.js";

const run = promisify(execFile);
const cleanups: Array<() => Promise<unknown>> = [];
afterEach(async () => { for (const cleanup of cleanups.splice(0).reverse()) await cleanup(); vi.restoreAllMocks(); });

function configuration(): any {
  const candidates = ["ceo", "pm", "architect"].map((roleId, priority) => ({ employeeId: `emp-${roleId}`, status: "enabled",
    roleIds: [roleId], taskTypes: ["feature-development"], providerId: "local-fake-provider", modelId: "local-fake-model", priority,
    limits: { maxRequests: 1, maxInputTokens: 4096, maxOutputTokens: 1024, timeoutMs: 5000 } }));
  return { version: 1, executionMode: "fake", catalog: { version: 1, catalogId: "accepted-fixture", catalogRevision: "r1",
    maxCandidates: 5, maxSelectedRoles: 3, maxConcurrentRoles: 2, maxTotalRequests: 3,
    candidates: [...candidates, { employeeId: "onet-inactive", status: "occupation_candidate", capabilities: [], maxConcurrency: 0 }],
    qualifications: candidates.map(item => ({ qualificationId: `q-${item.employeeId}`, employeeId: item.employeeId,
      providerId: item.providerId, modelId: item.modelId, roleIds: item.roleIds, taskTypes: item.taskTypes, status: "accepted",
      origin: "synthetic", executionMode: "fake", evidenceHash: "sha256:" + "e".repeat(64), validUntil: "2099-01-01T00:00:00.000Z" })),
  } };
}

async function fixture(useVirtualKey = false) {
  const root = await mkdtemp(join(await realpath(tmpdir()), "uai-selection-http-"));
  cleanups.push(async () => { expect(await realpath(root)).toBe(root); expect(dirname(root)).toBe(await realpath(tmpdir())); await rm(root, { recursive: true, force: true }); });
  const repo = join(root, "repo"); const hooks = join(root, "hooks"); await mkdir(repo); await mkdir(hooks);
  const git = (...args: string[]) => run("git", ["-C", repo, "-c", `core.hooksPath=${hooks}`, "-c", "commit.gpgSign=false",
    "-c", "user.name=Selection Fixture", "-c", "user.email=selection@example.invalid", ...args], { cwd: root });
  await git("-c", "init.templateDir=", "init", "--initial-branch=main"); await writeFile(join(repo, "README.md"), "# Owned selection fixture\n");
  await git("add", "README.md"); await git("commit", "-m", "Synthetic fixture");
  const token = "selection-http-fixture-admin"; const configurationValue = configuration();
  const env = { NODE_ENV: "test", AI_GATEWAY_PROVIDER_MODE: "fake", AI_GATEWAY_REAL_PROVIDER_ENABLED: "false",
    PME_RUNTIME_CREDENTIAL_STORE_MODE: "memory", KNOWLEDGE_STORAGE_MODE: "memory", AI_GATEWAY_RATE_LIMIT_WHITELIST: "127.0.0.1",
    AI_GATEWAY_MODEL_LIBRARY_STATE_PATH: join(root, "models.json"), WORKFLOW_OUTPUT_DIR: join(root, "artifacts"),
    WORKFORCE_PLAN_STORE_PATH: join(root, "plans.json"), WORKFORCE_EXECUTION_DIR: join(root, "execution"),
    WORKFORCE_EXECUTION_ENABLED: "true", WORKFORCE_EXECUTION_TIMEOUT_MS: "10000", AI_GATEWAY_USAGE_LOG_DIR: join(root, "usage"),
    AI_GATEWAY_AGENT_EXEC_WORKING_DIRECTORY: repo, AI_GATEWAY_AGENT_GOVERNANCE_ENABLED: "true", AI_GATEWAY_AGENT_GOVERNANCE_DATA_DIR: join(root, "governance"),
    AI_GATEWAY_AGENT_GOVERNANCE_HMAC_KEY: "selection-http-fixture-hmac-material-0123456789",
    AI_GATEWAY_LOCAL_CLIENT_REGISTRY_PATH: join(root, "clients.json"), AI_GATEWAY_LOCAL_CLIENT_EXECUTION_LOG_PATH: join(root, "client-execution.jsonl"),
    AI_GATEWAY_LOCAL_CLIENT_EXECUTION_CONTROL_DIR: join(root, "client-control"),
    PME_ENTERPRISE_AUTH_ENABLED: "true", PME_AUTH_TOKEN: token, PME_AUTH_USER_ID: "selection-owner", PME_AUTH_TENANT_ID: "selection-tenant",
    PME_AUTH_ROLE: "admin", PME_ENTERPRISE_PLATFORM_TENANT_ID: "selection-tenant",
    PME_ENTERPRISE_USER_STORE_PATH: join(root, "users.json"), PME_API_KEY_STORE_PATH: join(root, "keys.json"),
    PME_AUDIT_LOG_PATH: join(root, "audit.jsonl"), PME_AUDIT_CHAIN_PATH: join(root, "audit-chain.jsonl"),
    AI_GATEWAY_WORKFORCE_ROLE_SELECTION_JSON: JSON.stringify(configurationValue),
  };
  const app = createGatewayApplication(env) as any;
  const keyManager = app.enterpriseGovernanceService.getApiKeyManager();
  const virtualKey = useVirtualKey ? keyManager.create({ role: "admin", tenantId: "selection-tenant",
    budget: { limitTokens: 10_000, window: "daily" }, rateLimit: { requestsPerMinute: 1 } }) : null;
  const requestToken = virtualKey?.key ?? token;
  const keyCharges = vi.spyOn(keyManager, "recordUsage");
  const provider = app.providerRegistry.get("local-fake-provider"); const generate = vi.spyOn(provider, "generate");
  let time = Date.now();
  const worktree = createWorktreeIsolation({ repoRoot: repo, worktreeRoot: join(root, "worktrees") }) as {
    create(input: { planId: string }): Promise<unknown>; remove(id: string): Promise<unknown>; getInfo(): unknown;
  };
  const worktreeCreate = vi.spyOn(worktree, "create");
  const makeExecutor = (value: unknown) => createControlledExecutor({ env, repoRoot: repo, executionDir: env.WORKFORCE_EXECUTION_DIR,
    worktreeIsolation: worktree, roleSelection: createConfiguredWorkforceRoleSelection({ configuration: value,
      gatewayService: app.gatewayService, providerRegistry: app.providerRegistry, now: () => time }),
  });
  const productionExecutor = app.workforceExecutor;
  app.workforceExecutor = makeExecutor(configurationValue);
  const comparison = { goal: "Compare the approved selection", planId: "selection-compare", selectedRoles: ["ceo"],
    autonomyMode: "controlled-execution", tenantId: "selection-tenant" };
  expect(await app.workforceExecutor.describeExecution(comparison)).toEqual(await productionExecutor.describeExecution(comparison));
  await productionExecutor.close();
  const server = createGatewayHttpServer(app) as ReturnType<typeof createGatewayHttpServer> & { shutdownResources?: () => Promise<void> };
  cleanups.push(async () => { await new Promise<void>(resolve => { server.close(() => resolve()); server.closeAllConnections(); }); await server.shutdownResources?.(); await app.workforceExecutor.close(); });
  server.listen(0, "127.0.0.1"); await once(server, "listening"); const address = server.address();
  if (!address || typeof address === "string") throw new Error("Missing fixture listener");
  const url = `http://127.0.0.1:${address.port}`;
  const send = async (route: string, body?: unknown, authenticated = true) => {
    const response = await fetch(url + route, { method: body === undefined ? "GET" : "POST", headers: {
      ...(authenticated ? { authorization: `Bearer ${requestToken}` } : {}), "content-type": "application/json",
    }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
    const raw = await response.json() as any; return { status: response.status, data: raw.data ?? raw, raw };
  };
  const agent = await send("/v1/agents/generate", { name: "selection-worker", task: "Produce a bounded selected employee contribution",
    requestedTools: ["workforce_execute"], ttlSeconds: 3600, instanceRules: { toolRules: { workforce_execute: "require_approval" } } });
  expect(agent.status, JSON.stringify(agent.raw)).toBe(200);
  const input = { goal: "Produce a concise bounded analysis", planId: "selection-plan", selectedRoles: ["ceo"],
    autonomyMode: "controlled-execution", agentId: agent.data.agentId };
  const approve = async () => {
    const pending = await send("/workforce/execute", input); expect(pending.status).toBe(202);
    const list = await send("/v1/approvals"); const approval = list.data.approvals.find((item: any) => item.id === pending.data.approvalId);
    expect(approval.review.workforce.options.selectionReview).toMatchObject({ version: 1, executionMode: "fake",
      rejected: [{ employeeId: "emp-architect", reason: "not_qualified" }, { employeeId: "emp-pm", reason: "not_qualified" }, { employeeId: "onet-inactive", reason: "not_enabled" }] });
    expect((await send("/v1/approvals/decide", { approvalId: pending.data.approvalId, decision: "approve" })).status).toBe(200);
    const workforceApproval = await send("/workforce/execute/approve", { ...input, approvedScopes: ["workforce:execute"] });
    expect(workforceApproval.status).toBe(200);
    expect(workforceApproval.data.execution.selectionReview).toEqual(approval.review.workforce.options.selectionReview);
    return { approval, workforceApproval };
  };
  return { root, repo, app, env, configurationValue, provider, generate, input, send, approve, worktreeCreate, git, keyCharges,
    keyUsage: () => keyManager.describeUsage({ keyId: virtualKey.record.keyId }).usage,
    setTime: (value: number) => { time = value; }, replaceExecutor: async (value: unknown) => { await app.workforceExecutor.close(); app.workforceExecutor = makeExecutor(value); } };
}

it("retains virtual-key admission and settlement through production role selection projections", async () => {
  const f = await fixture(true); await f.approve();
  expect(f.keyUsage().requestCount).toBe(0);
  const result = await f.send("/workforce/execute", f.input);
  expect(result.status, JSON.stringify(result.raw)).toBe(200); expect(result.data.success).toBe(true);
  expect(f.generate).toHaveBeenCalledOnce(); expect(f.keyCharges).toHaveBeenCalledOnce();
  const providerResult = await f.generate.mock.results[0]!.value as any;
  const tokens = providerResult.usage.totalTokens;
  expect(tokens).toBeGreaterThan(0);
  expect(result.data.roleResults.ceo.workforceContribution.receipt.totalTokens).toBeNull(); // Fake contribution proof does not claim an invoice.
  expect(f.keyUsage()).toMatchObject({ requestCount: 1, rateRequestCount: 1, tokensUsed: tokens });
}, 30_000);

it("executes a production-selected profile through real HTTP approvals and persists actual fake contribution feedback", async () => {
  const f = await fixture();
  const unauthorized = await f.send("/workforce/execute", f.input, false); expect(unauthorized.status).toBe(401);
  const { approval } = await f.approve(); expect(f.generate).not.toHaveBeenCalled();
  const result = await f.send("/workforce/execute", f.input); expect(result.status).toBe(200); expect(result.data.success).toBe(true);
  expect(f.generate).toHaveBeenCalledTimes(1); expect(f.worktreeCreate).toHaveBeenCalledTimes(1);
  const feedback = result.data.selectionFeedback[0]; const contribution = result.data.roleResults.ceo.workforceContribution;
  expect(feedback).toMatchObject({ roleId: "ceo", employeeId: "emp-ceo", taskId: contribution.taskId, executionId: result.data.executionId,
    selectionHash: approval.review.workforce.options.selectionReview.selectionHash, profileHash: result.data.roleExecution.profile.profileHash,
    receipt: { status: "succeeded", executionMode: "fake", providerCallAttempted: true, gatewayRequestId: contribution.receipt.gatewayRequestId },
    contributionHash: expect.stringMatching(/^sha256:[a-f0-9]{64}$/), quality: "unassessed", qualityScore: null });
  expect(feedback.receipt).not.toHaveProperty("totalTokens");
  expect(result.data.roleResults.ceo.selectionFeedback).toEqual(feedback);
  const status = await f.app.workforceExecutor.getStatus(result.data.executionId, { tenantId: "selection-tenant", userId: "selection-owner" });
  expect(status.status).toBe("completed");
  const persisted = await readFile(createLifecycleStatePath(join(f.root, "execution"), result.data.executionId), "utf8");
  expect(JSON.parse(persisted).summary.selectionFeedback).toEqual(result.data.selectionFeedback);
  const queueFiles = await readdir(join(f.root, "execution", "task-queue"));
  expect((await Promise.all(queueFiles.filter(file => file.endsWith(".json")).map(file => readFile(join(f.root, "execution", "task-queue", file), "utf8")))).join("\n")).toContain(feedback.selectionHash);
  expect(result.data.worktree).toMatchObject({ created: true, cleanedUp: true }); expect((await f.git("status", "--porcelain")).stdout).toBe("");
}, 30_000);

it("rejects request-supplied selection authority and ambiguous production profile configuration", async () => {
  const f = await fixture();
  for (const key of ["selectionReview", "catalog", "qualifications", "employeeId", "providerId", "modelId", "executionMode"]) {
    const result = await f.send("/workforce/execute", { ...f.input, [key]: "untrusted" });
    expect(result.status).toBe(400); expect(JSON.stringify(result.raw)).toContain("WORKFORCE_SELECTION_AUTHORITY_FORBIDDEN");
  }
  expect(() => createGatewayApplication({ ...f.env, AI_GATEWAY_WORKFORCE_ROLE_EXECUTION_PROFILE_JSON: "{}" })).toThrow("not both");
  expect(f.generate).not.toHaveBeenCalled(); expect(f.worktreeCreate).not.toHaveBeenCalled();
}, 30_000);

it.each(["disabled", "expired", "new-catalog"])("blocks approved selection after %s without selecting a replacement", async change => {
  const f = await fixture(); const { approval } = await f.approve();
  const before = await f.app.workforceExecutor.describeExecution({ ...f.input, tenantId: "selection-tenant" });
  if (change === "disabled") f.provider.descriptor.models[0].enabled = false;
  if (change === "expired") f.setTime(Date.parse("2100-01-01T00:00:00.000Z"));
  if (change === "new-catalog") { const updated = structuredClone(f.configurationValue); updated.catalog.catalogRevision = "r2"; await f.replaceExecutor(updated); }
  const result = await f.send("/workforce/execute", f.input);
  if (change === "new-catalog") {
    expect(result.status).toBe(202); expect(result.data.approvalId).not.toBe(approval.id);
    const after = await f.app.workforceExecutor.describeExecution({ ...f.input, tenantId: "selection-tenant" });
    expect(after.roleExecution.bindings).toEqual(before.roleExecution.bindings); expect(after.planDigest).not.toBe(before.planDigest);
    expect((await f.app.workforceExecutor.checkApproval({ ...f.input, tenantId: "selection-tenant" }, "selection-owner")).approved).toBe(false);
  } else {
    expect(result.status).toBeGreaterThanOrEqual(400);
    expect(JSON.stringify(result.raw)).toContain(change === "disabled" ? "WORKFORCE_SELECTION_TARGET_UNAVAILABLE" : "WORKFORCE_SELECTION_QUALIFICATION_EXPIRED");
    if (change === "disabled") expect(await f.app.workforceExecutor.describeExecution({ ...f.input, tenantId: "selection-tenant" })).toEqual(before);
  }
  expect(f.generate).not.toHaveBeenCalled(); expect(f.worktreeCreate).not.toHaveBeenCalled();
}, 30_000);

it("records unknown outcome receipt facts without treating an attempted call as quality evaluation", async () => {
  const f = await fixture(); await f.approve();
  f.generate.mockRejectedValueOnce(Object.assign(new Error("Synthetic provider failure"), { code: "FIXTURE_FAILURE" }));
  const result = await f.send("/workforce/execute", f.input);
  expect(result.status).toBe(422); expect(result.data.success).toBe(false); expect(f.generate).toHaveBeenCalledTimes(1);
  expect(result.data.selectionFeedback).toHaveLength(1);
  expect(result.data.selectionFeedback[0]).toMatchObject({ roleId: "ceo", employeeId: "emp-ceo", quality: "unassessed", qualityScore: null,
    contributionHash: null, receipt: { status: "outcome_unknown", executionMode: "fake", providerCallAttempted: true, errorCode: "FIXTURE_FAILURE" } });
  const status = await f.app.workforceExecutor.getStatus(result.data.executionId, { tenantId: "selection-tenant", userId: "selection-owner" });
  expect(status.status).toBe("failed");
  const persisted = JSON.parse(await readFile(createLifecycleStatePath(join(f.root, "execution"), result.data.executionId), "utf8"));
  expect(persisted.summary.selectionFeedback).toEqual(result.data.selectionFeedback);
}, 30_000);
