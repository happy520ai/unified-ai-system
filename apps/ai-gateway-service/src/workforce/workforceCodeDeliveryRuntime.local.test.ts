// @test-scope local
// @test-isolation process
import { createHash } from "node:crypto";
import { once } from "node:events";
import { mkdir, mkdtemp, readFile, readdir, realpath, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { afterEach, expect, it, vi } from "vitest";
import { ContainerSandboxBackend } from "@unified-ai-system/forge-core";
import { captureApprovedCodeFiles, createApprovedCodeSnapshot } from "./workforceCodeDeliveryArtifacts.ts";
import { createWorkforceCodeDeliveryFactory, isWorkforceCodeDeliveryFactory, preflightWorkforceCodeDelivery,
  consumeWorkforceSnapshotCapability } from "./workforceCodeDeliveryRuntime.ts";
import { freezeWorkforceCodeDeliveryProfile, createWorkforceCodeDeliveryReview } from "./workforceCodeDeliveryProfile.ts";
import { freezeWorkforceRoleExecutionProfile } from "./workforceRoleExecutionProfile.ts";
import { createWorkforceGit } from "./workforceGit.ts";
import { createAgentGovernanceToolProxy } from "../agent-governance/toolProxy.ts";
import { createGatewayApplication } from "../application/createGatewayApplication.js";
import { createGatewayHttpServer } from "../http/httpServer.js";
import { createControlledExecutor } from "./workforceControlledExecutor.js";
import { createWorkforceRoleProviderFactory } from "./workforceRoleProvider.ts";
import { createWorktreeIsolation } from "./worktreeIsolation.js";
import { createTaskEvidenceCapture } from "./taskEvidenceCapture.js";
import * as codeRuntime from "./workforceCodeDeliveryRuntime.ts";

const enabled = process.env.AI_GATEWAY_CODE_DELIVERY_CONTAINER_TEST === "1";
const enginePath = process.env.AI_GATEWAY_CODE_DELIVERY_TEST_ENGINE ?? "";
const image = process.env.AI_GATEWAY_CODE_DELIVERY_TEST_IMAGE ?? "";
const roots: string[] = [];
const retained = new Set<string>();
afterEach(async () => { for (const root of roots.splice(0)) {
  if (retained.has(root)) continue;
  expect(await realpath(root)).toBe(root); expect(dirname(root)).toBe(await realpath(tmpdir()));
  await rm(root, { recursive: true, force: true });
} vi.unstubAllEnvs(); vi.restoreAllMocks(); });
const hash = (text: string) => createHash("sha256").update(text).digest("hex");

it.skipIf(!enabled)("runs the current approved-file snapshot in a real pinned container, observing failed then corrected source", async () => {
  const root = await mkdtemp(join(await realpath(tmpdir()), "code-real-snapshot-")); roots.push(root);
  const repo = join(root, "repo"), scratch = join(root, "scratch");
  await mkdir(join(repo, "src"), { recursive: true }); await mkdir(join(repo, "test")); await mkdir(scratch);
  const testText = "import test from 'node:test';\nimport assert from 'node:assert/strict';\nimport { existsSync } from 'node:fs';\nimport { value } from '../src/value.mjs';\ntest('actual approved value and exact file scope', () => { assert.equal(value, 2); assert.equal(existsSync('/workspace/unapproved.txt'), false); });\n";
  await writeFile(join(repo, "src/value.mjs"), "export const value = 1;\n");
  await writeFile(join(repo, "test/value.test.mjs"), testText);
  await writeFile(join(repo, "unapproved.txt"), "Not mounted.");
  const git = createWorkforceGit(repo);
  await git.run(["-c", "init.templateDir=", "init", "--initial-branch=main"]);
  await git.run(["add", "src/value.mjs", "test/value.test.mjs", "unapproved.txt"]);
  await git.run(["-c", "user.name=Code Snapshot Fixture", "-c", "user.email=snapshot@example.invalid", "-c", "commit.gpgSign=false", "commit", "-m", "Owned snapshot fixture"]);
  const baselineRevision = (await git.run(["rev-parse", "HEAD"])).stdout.trim();
  const profile = freezeWorkforceCodeDeliveryProfile({ version: 1, mode: "forge-owned-worktree-artifact",
    profileId: "real-snapshot", projectId: "fixture", baselineRevision, roleId: "backend-engineer",
    readPaths: ["src/value.mjs", "test/value.test.mjs"], writePaths: ["src/value.mjs"],
    verification: { verificationId: "fixed-node-test", command: "node --test test/value.test.mjs",
      immutableTests: [{ path: "test/value.test.mjs", sha256: hash(testText) }], image, workspaceMode: "ro", networkAccess: false,
      timeoutMs: 15000, maxMemoryMB: 128, maxOutputBytes: 65536, pidsLimit: 32, cpus: 1 },
    artifactLimits: { maxChangedFiles: 1, maxFileBytes: 65536, maxDiffBytes: 262144 } });
  const roleProfile = freezeWorkforceRoleExecutionProfile({ version: 1, mode: "gateway-llm-required", profileId: "fixture",
    maxTotalRequests: 3, maxConcurrentRoles: 1, bindings: [{ roleId: "backend-engineer", employeeId: "backend",
      providerId: "fake", modelId: "fake", maxRequests: 3, maxInputTokens: 100000, maxOutputTokens: 16384, timeoutMs: 30000 }] });
  const normalized = repo.replaceAll("\\", "/"), configuredRepositoryHash = "sha256:" + hash(JSON.stringify([
    "workforce-code-repository-config/v1", process.platform === "win32" ? normalized.toLowerCase() : normalized]));
  const review = createWorkforceCodeDeliveryReview({ profile, roleExecution: roleProfile, configuredRepositoryHash });
  const factory = createWorkforceCodeDeliveryFactory({ repoRoot: repo, enginePath, scratchRoot: scratch });
  expect(isWorkforceCodeDeliveryFactory(factory)).toBe(true);
  expect(isWorkforceCodeDeliveryFactory(JSON.parse(JSON.stringify(factory)))).toBe(false);
  const identity = { tenantId: "fixture", userId: "owner", role: "admin", permissions: ["*"] };
  const context = { agentId: "agt_snapshot", tenantId: "fixture", userId: "owner" };
  const policy: any = { agentId: context.agentId, policyHash: "sha256:" + "a".repeat(64), expiresAt: new Date(Date.now() + 90000).toISOString(),
    grantedTools: ["file_read", "file_write", "file_edit", "workforce_verify_snapshot"],
    toolDecisions: { file_read: "allow", file_write: "allow", file_edit: "allow", workforce_verify_snapshot: "allow" },
    permissions: { canWrite: true, canExecuteCode: true }, limits: { maxToolCalls: 20, maxSteps: 10 }, requirements: {}, scope: {} };
  // Policy is a MODEL snapshot here. This test proves real Git/file/container behavior, not HTTP approval admission.
  const preflight = await preflightWorkforceCodeDelivery(factory, { review, roleProfile, identity, context, policy,
    toolProxy: createAgentGovernanceToolProxy({ service: {} as any }),
    usage: { toolCalls: 0, steps: 0, records: 0 }, planId: "snapshot-plan", planDigest: "b".repeat(64),
    signal: new AbortController().signal, deadlineAt: Date.now() + 90000 });
  expect(preflight.kind).toBe("workforce-code-delivery-preflight");
  expect(await consumeWorkforceSnapshotCapability({ ready: true }, context, {}, policy.policyHash)).toBe(false);
  const run = async () => {
    const files = await captureApprovedCodeFiles(repo, profile), snapshot = await createApprovedCodeSnapshot(files, scratch);
    expect((await readdir(snapshot.workspace)).sort()).toEqual(["src", "test"]);
    const backend = new ContainerSandboxBackend({ enginePath, image, workspaceRoots: [snapshot.workspace], allowNetwork: false });
    let outcome;
    try { outcome = await backend.run({ command: profile.verification.command, workspace: snapshot.workspace,
      workspaceMode: "ro", networkAccess: false, env: {}, timeoutMs: 15000, maxMemoryMB: 128, maxOutputBytes: 65536, pidsLimit: 32, cpus: 1 }); }
    catch (error) { if ((error as { cleanupUncertain?: boolean })?.cleanupUncertain) retained.add(root); throw error; }
    if (outcome.cleanupUncertain !== false) retained.add(root);
    expect(outcome.cleanupUncertain).toBe(false); expect(outcome.killed).toBe(false); expect(outcome.truncated).toBe(false);
    expect(outcome.backend).toBe("container");
    await snapshot.cleanup();
    return outcome;
  };
  const first = await run(); expect(first.exitCode).not.toBe(0); expect(first.stdout).toContain("not ok");
  await writeFile(join(repo, "src/value.mjs"), "export const value = 2;\n");
  const corrected = await run(); expect(corrected.exitCode).toBe(0); expect(corrected.stdout).toContain("# pass 1");
  expect(await readFile(join(repo, "test/value.test.mjs"), "utf8")).toBe(testText);
  expect((await git.run(["rev-parse", "HEAD"])).stdout.trim()).toBe(baselineRevision);
  expect(await readdir(scratch)).toEqual([]);
}, 90000);

it.skipIf(!enabled).each(["verified", "verification-failed", "evidence-failed", "preflight-race", "cleanup-failed"])("delivers approved code through actual HTTP with %s outcome", async (scenario) => {
  vi.stubEnv("TOKEN_GUARD_PER_REQUEST_MAX_OUTPUT_TOKENS", "16384");
  const root = await mkdtemp(join(await realpath(tmpdir()), "code-real-http-")); roots.push(root);
  const repo = join(root, "repo"), scratch = join(root, "scratch"), workspace = join(root, "agent-workspace");
  await mkdir(join(repo, "src"), { recursive: true }); await mkdir(join(repo, "test")); await mkdir(scratch); await mkdir(workspace);
  const immutableTest = "import test from 'node:test';\nimport assert from 'node:assert/strict';\nimport { existsSync } from 'node:fs';\nimport { value } from '../src/value.mjs';\ntest('approved delivery', () => { assert.equal(value, 2); assert.equal(existsSync('/workspace/unapproved.txt'), false); });\n";
  await writeFile(join(repo, "src/value.mjs"), "export const value = 1;\n");
  await writeFile(join(repo, "test/value.test.mjs"), immutableTest); await writeFile(join(repo, "unapproved.txt"), "Not approved for model or container.");
  const git = createWorkforceGit(repo);
  await git.run(["-c", "init.templateDir=", "init", "--initial-branch=main"]);
  await git.run(["add", "src/value.mjs", "test/value.test.mjs", "unapproved.txt"]);
  await git.run(["-c", "user.name=Code HTTP Fixture", "-c", "user.email=code@example.invalid", "-c", "commit.gpgSign=false", "commit", "-m", "Owned code fixture"]);
  const baselineRevision = (await git.run(["rev-parse", "HEAD"])).stdout.trim();
  const codeProfile: any = { version: 1, mode: "forge-owned-worktree-artifact", profileId: "http-code", projectId: "fixture",
    baselineRevision, roleId: "backend-engineer", readPaths: ["src/value.mjs", "test/value.test.mjs"], writePaths: ["src/value.mjs"],
    verification: { verificationId: "fixed-tests", command: "node --test test/value.test.mjs", immutableTests: [{ path: "test/value.test.mjs", sha256: hash(immutableTest) }],
      image, workspaceMode: "ro", networkAccess: false, timeoutMs: 15000, maxMemoryMB: 128, maxOutputBytes: 65536, pidsLimit: 32, cpus: 1 },
    artifactLimits: { maxChangedFiles: 1, maxFileBytes: 65536, maxDiffBytes: 262144 } };
  const identity = { tenantId: "code-tenant", userId: "code-owner", role: "admin", permissions: ["*"] };
  const token = "local-code-http-fixture";
  const env = { NODE_ENV: "test", AI_GATEWAY_PROVIDER_MODE: "fake", AI_GATEWAY_REAL_PROVIDER_ENABLED: "false",
    PME_RUNTIME_CREDENTIAL_STORE_MODE: "memory", KNOWLEDGE_STORAGE_MODE: "memory", AI_GATEWAY_RATE_LIMIT_WHITELIST: "127.0.0.1",
    AI_GATEWAY_MODEL_LIBRARY_STATE_PATH: join(root, "models.json"), WORKFLOW_OUTPUT_DIR: join(root, "artifacts"),
    WORKFORCE_PLAN_STORE_PATH: join(root, "plans.json"), WORKFORCE_EXECUTION_DIR: join(root, "execution"),
    WORKFORCE_EXECUTION_ENABLED: "true", WORKFORCE_EXECUTION_TIMEOUT_MS: "120000", AI_GATEWAY_USAGE_LOG_DIR: join(root, "usage"),
    TOKEN_GUARD_PER_REQUEST_MAX_OUTPUT_TOKENS: "16384",
    AI_GATEWAY_AGENT_EXEC_WORKING_DIRECTORY: workspace, AI_GATEWAY_AGENT_GOVERNANCE_ENABLED: "true",
    AI_GATEWAY_AGENT_GOVERNANCE_DATA_DIR: join(root, "governance"), AI_GATEWAY_AGENT_GOVERNANCE_HMAC_KEY: "local-code-fixture-signing-0123456789",
    AI_GATEWAY_LOCAL_CLIENT_REGISTRY_PATH: join(root, "clients.json"), AI_GATEWAY_LOCAL_CLIENT_EXECUTION_LOG_PATH: join(root, "clients.jsonl"),
    AI_GATEWAY_LOCAL_CLIENT_EXECUTION_CONTROL_DIR: join(root, "client-control"),
    PME_ENTERPRISE_AUTH_ENABLED: "true", PME_AUTH_TOKEN: token, PME_AUTH_USER_ID: identity.userId, PME_AUTH_TENANT_ID: identity.tenantId,
    PME_AUTH_ROLE: "admin", PME_ENTERPRISE_PLATFORM_TENANT_ID: identity.tenantId, PME_ENTERPRISE_USER_STORE_PATH: join(root, "users.json"),
    PME_API_KEY_STORE_PATH: join(root, "keys.json"), PME_AUDIT_LOG_PATH: join(root, "audit.jsonl"), PME_AUDIT_CHAIN_PATH: join(root, "audit-chain.jsonl") };
  const app = createGatewayApplication(env) as any;
  const roles = ["ceo", "pm", "architect", "backend-engineer"];
  const roleProfile = freezeWorkforceRoleExecutionProfile({ version: 1, mode: "gateway-llm-required", profileId: "http-roles",
    maxTotalRequests: 6, maxConcurrentRoles: 1, bindings: roles.map(roleId => ({ roleId, employeeId: "employee-" + roleId,
      providerId: "local-fake-provider", modelId: "local-fake-model", maxRequests: roleId === "backend-engineer" ? 3 : 1,
      maxInputTokens: 100000, maxOutputTokens: 16384, timeoutMs: 30000 })) });
  const manager = createWorktreeIsolation({ repoRoot: repo, worktreeRoot: join(root, "worktrees") });
  const removeOriginal = manager.remove.bind(manager);
  let cleanupFixtureWorktree: string | null = null;
  const create = vi.spyOn(manager, "create"), remove = vi.spyOn(manager, "remove");
  if (scenario === "cleanup-failed") remove.mockResolvedValueOnce({ success: false, reason: "fixture_cleanup_failed" } as any);
  const evidenceDir = join(root, "execution", "evidence"), capture = createTaskEvidenceCapture({ evidenceDir });
  if (scenario === "evidence-failed") {
    const start = capture.startCapture.bind(capture);
    vi.spyOn(capture, "startCapture").mockImplementation((params: any) => {
      const session = start(params) as any, finish = session.finish.bind(session);
      session.finish = async () => {
        if ((session.evidence.output as any).codeDelivery) {
          await mkdir(join(evidenceDir, params.planId, "task-" + hash(JSON.stringify([params.agentId, params.taskId])) + ".json"), { recursive: true });
        }
        return finish();
      };
      return session;
    });
  }
  const executor = createControlledExecutor({ env, repoRoot: repo, executionDir: env.WORKFORCE_EXECUTION_DIR,
    roleProviderFactory: createWorkforceRoleProviderFactory({ gatewayService: app.gatewayService, providerRegistry: app.providerRegistry, profile: roleProfile }),
    codeDeliveryProfiles: [codeProfile], codeDeliveryFactory: createWorkforceCodeDeliveryFactory({ repoRoot: repo, enginePath, scratchRoot: scratch }),
    worktreeIsolation: manager, evidenceCapture: capture } as any);
  await app.workforceExecutor.close(); app.workforceExecutor = executor;
  if (scenario === "preflight-race") {
    const run = codeRuntime.runWorkforceCodeDelivery;
    vi.spyOn(codeRuntime, "runWorkforceCodeDelivery").mockImplementation(async (...args) => {
      const results = await Promise.allSettled([run(...args), run(...args)]);
      expect(results.filter(result => result.status === "fulfilled")).toHaveLength(1);
      const denied = results.find(result => result.status === "rejected") as PromiseRejectedResult;
      expect(denied.reason).toMatchObject({ code: "WORKFORCE_CODE_DELIVERY_PREFLIGHT_REQUIRED" });
      return (results.find(result => result.status === "fulfilled") as PromiseFulfilledResult<any>).value;
    });
  }
  const service = app.agentGovernance.service;
  const tools = ["workforce_execute", "file_read", "file_write", "file_edit", "workforce_verify_snapshot"];
  const generatedInput = { name: "code-runtime", task: "执行代码修改任务", requestedTools: tools,
    ttlSeconds: 3600, proposedTraits: ["write_capable", "code_execution"], proposedRiskLevel: "high" };
  const oldAgent = await service.generateAgent({ ...generatedInput, name: "default-denied" }, identity);
  const oldPolicy = await service.getEffectivePolicy(oldAgent.agentId, identity.tenantId);
  expect(oldPolicy.permissions.canExecuteCode).toBe(false);
  await service.createPolicyVersion({ policyKey: "execution-family", version: 3, policyType: "family", scopeKey: "execution",
    content: { capabilityCeiling: tools, toolRules: { ...Object.fromEntries(tools.map(tool => [tool, "allow"])), workforce_execute: "require_approval",
      shell_exec: "deny", code_run: "deny" }, limits: { maxSteps: 20, maxToolCalls: 30, maxRuntimeSeconds: 180, maxWorkforceRoles: 4 },
    permissions: { canCreateChildren: true, canWrite: true, canSendExternalMessage: false, canExecuteCode: true } } }, identity);
  await service.activatePolicyVersion("execution-family", 3, identity);
  const agent = await service.generateAgent(generatedInput, identity);
  const actualPolicy = await service.getEffectivePolicy(agent.agentId, identity.tenantId);
  expect(actualPolicy.permissions.canExecuteCode).toBe(true);
  expect(actualPolicy.toolDecisions.workforce_verify_snapshot).toBe("allow");
  const provider = app.providerRegistry.get("local-fake-provider"), generateOriginal = provider.generate.bind(provider);
  let providerCalls = 0;
  const generated = vi.spyOn(provider, "generate").mockImplementation(async (request: any) => {
    providerCalls += 1; const result = await generateOriginal(request);
    expect(JSON.stringify(request)).not.toContain("Not approved for model or container.");
    let text = result.text;
    if (providerCalls === 5) text = JSON.stringify({ summary: "Update approved value", tasks: [{ id: "implement-value", name: "Update value",
      type: "implement", prompt: "Write src/value.mjs with export const value = 2;", allowedFiles: ["src/value.mjs"] }] });
    if (providerCalls === 6) {
      const created = await create.mock.results[0].value;
      expect(await readdir(created.worktree.path)).not.toContain(".forge");
      text = JSON.stringify([{ type: "write", path: "src/value.mjs", content: "export const value = " + (scenario === "verification-failed" ? 3 : 2) + ";\n" }]);
    }
    return { ...result, text, message: { role: "assistant", content: text } };
  });
  const server = createGatewayHttpServer(app) as any;
  server.listen(0, "127.0.0.1"); await once(server, "listening");
  const address = server.address();
  const send = async (path: string, body: any) => {
    const response = await fetch("http://127.0.0.1:" + address.port + path, { method: "POST",
      headers: { authorization: "Bearer " + token, "content-type": "application/json" }, body: JSON.stringify(body) });
    return { status: response.status, payload: await response.json() as any };
  };
  try {
    const input = { goal: "Implement the approved value change in src/value.mjs", planId: "code-approved-plan",
      autonomyMode: "controlled-execution", agentId: agent.agentId, selectedRoles: roles, codeDelivery: { profileId: "http-code" } };
    const descriptor = await executor.describeExecution({ ...input, userId: identity.userId, tenantId: identity.tenantId });
    expect(descriptor.codeDeliveryReadiness).toMatchObject({ implementation: "available", executionAllowed: false });
    if (scenario === "verified") {
      const denied = await send("/workforce/execute/approve", { ...input, agentId: oldAgent.agentId, approvedScopes: descriptor.requiredScopes });
      expect(denied.status, JSON.stringify(denied.payload)).toBe(403);
      expect(denied.payload.error.code).toBe("WORKFORCE_CODE_DELIVERY_POLICY_UNSUPPORTED");
      await writeFile(join(repo, "src/value.mjs"), "export const value = 9;\n");
      const dirty = await send("/workforce/execute/approve", { ...input, approvedScopes: descriptor.requiredScopes });
      expect(dirty.status, JSON.stringify(dirty.payload)).toBe(409);
      expect(dirty.payload.error.code).toBe("WORKFORCE_CODE_DELIVERY_WORKSPACE_DIRTY");
      await writeFile(join(repo, "src/value.mjs"), "export const value = 1;\n");
      expect(generated).not.toHaveBeenCalled(); expect(create).not.toHaveBeenCalled();
    }
    const approval = await send("/workforce/execute/approve", { ...input, approvedScopes: descriptor.requiredScopes });
    expect(approval.status, JSON.stringify(approval.payload)).toBe(200);
    expect(generated).not.toHaveBeenCalled(); expect(create).not.toHaveBeenCalled();
    const pending = await send("/workforce/execute", input);
    expect(pending.status, JSON.stringify(pending.payload)).toBe(202); expect(generated).not.toHaveBeenCalled(); expect(create).not.toHaveBeenCalled();
    const approved = await send("/v1/approvals/decide", { approvalId: pending.payload.data.approvalId, decision: "approve" });
    expect(approved.status, JSON.stringify(approved.payload)).toBe(200);
    const executed = await send("/workforce/execute", input);
    if (executed.payload.data?.recoveryRequired || executed.payload.data?.worktree?.cleanedUp === false) retained.add(root);
    const delivered = executed.payload.data;
    if (scenario === "cleanup-failed") {
      const created = await create.mock.results[0].value;
      if (delivered?.codeDelivery?.localQuiescenceConfirmed === true && delivered?.codeDelivery?.verification?.cleanupConfirmed === true) {
        cleanupFixtureWorktree = created.worktree.worktreeId;
      }
      expect(executed.status, JSON.stringify(executed.payload)).toBe(422);
      expect(delivered).toMatchObject({ success: false, executionStatus: "failed", recoveryRequired: true,
        codeDelivery: { status: "verified", localQuiescenceConfirmed: true, verification: { status: "passed", exitCode: 0, cleanupConfirmed: true } },
        worktree: { created: true, cleanedUp: false, retainedWorktreeId: created.worktree.worktreeId },
        safety: { projectFileWrites: true, projectWritesIsolated: true } });
      expect(remove).toHaveBeenCalledOnce(); expect(generated).toHaveBeenCalledTimes(6);
      expect(await readFile(join(created.worktree.path, "src/value.mjs"), "utf8")).toBe("export const value = 2;\n");
      expect(await readdir(scratch)).toEqual([]);
      const status = await send("/workforce/execute/status", { executionId: delivered.executionId });
      expect(status.status, JSON.stringify(status.payload)).toBe(200);
      expect(status.payload.data).toMatchObject({ status: "failed", evidenceUnavailable: false, recoveryRequired: true,
        codeDelivery: { status: "verified", artifact: { diffSha256: delivered.codeDelivery.artifact.diffSha256 } } });
      const reopened = createControlledExecutor({ env, repoRoot: repo, executionDir: env.WORKFORCE_EXECUTION_DIR } as any);
      try {
        expect(await reopened.getStatus(delivered.executionId, identity)).toMatchObject({ status: "failed", recoveryRequired: true,
          evidenceUnavailable: false, codeDelivery: { verification: { exitCode: 0 }, artifact: { diffSha256: delivered.codeDelivery.artifact.diffSha256 } } });
        await expect(reopened.getStatus(delivered.executionId, { ...identity, userId: "other-owner" })).rejects.toMatchObject({ code: "WORKFORCE_EXECUTION_FORBIDDEN" });
      } finally { await reopened.close(); }
      expect((await git.run(["status", "--porcelain=v1"])).stdout).toBe("");
      expect(await readFile(join(repo, "src/value.mjs"), "utf8")).toBe("export const value = 1;\n");
      return;
    }
    if (!["verified", "preflight-race"].includes(scenario)) {
      expect(executed.status, JSON.stringify(executed.payload)).toBe(422);
      expect(delivered).toMatchObject({ success: false, recoveryRequired: true, worktree: { created: true, cleanedUp: false },
        safety: { projectFileWrites: true } });
      expect(remove).not.toHaveBeenCalled(); expect(generated).toHaveBeenCalledTimes(6);
      const created = await create.mock.results[0].value;
      expect(await readFile(join(created.worktree.path, "src/value.mjs"), "utf8")).toContain(scenario === "verification-failed" ? "3" : "2");
      expect(await readdir(scratch)).toEqual([]);
      const status = await send("/workforce/execute/status", { executionId: delivered.executionId });
      expect(status.payload.data).toMatchObject({ evidenceUnavailable: true, recoveryRequired: true, codeDelivery: null });
      expect((await git.run(["status", "--porcelain=v1"])).stdout).toBe("");
      expect((await manager.remove(created.worktree.worktreeId)).success).toBe(true); retained.delete(root);
      return;
    }
    expect(executed.status, JSON.stringify(executed.payload)).toBe(200);
    expect(delivered).toMatchObject({ success: true, codeDelivery: { status: "verified", verification: { status: "passed", exitCode: 0, cleanupConfirmed: true } },
      roleExecution: { requestsDispatched: 6 }, worktree: { created: true, cleanedUp: true }, safety: { projectFileWrites: true, projectWritesIsolated: true } });
    expect(delivered.codeDelivery.artifact.filesChanged[0].patch).toContain("+export const value = 2;");
    expect(delivered.codeDelivery.verification.stdout).toContain("# pass 1");
    expect(generated).toHaveBeenCalledTimes(6); expect(create).toHaveBeenCalledOnce(); expect(remove).toHaveBeenCalledOnce();
    expect(await readdir(scratch)).toEqual([]); expect(await readdir(join(root, "worktrees"))).toEqual([]);
    expect((await git.run(["status", "--porcelain=v1"])).stdout).toBe("");
    expect(await readFile(join(repo, "src/value.mjs"), "utf8")).toBe("export const value = 1;\n");
    expect((await git.run(["rev-parse", "HEAD"])).stdout.trim()).toBe(baselineRevision);
    const status = await send("/workforce/execute/status", { executionId: delivered.executionId });
    expect(status.status, JSON.stringify(status.payload)).toBe(200);
    expect(status.payload.data).toMatchObject({ evidenceUnavailable: false, recoveryRequired: false,
      codeDelivery: { status: "verified", artifact: { diffSha256: delivered.codeDelivery.artifact.diffSha256 } } });
    await executor.close();
    const restarted = createControlledExecutor({ env, repoRoot: repo, executionDir: env.WORKFORCE_EXECUTION_DIR } as any);
    try {
      expect(await restarted.getStatus(delivered.executionId, identity)).toMatchObject({ evidenceUnavailable: false,
        codeDelivery: { verification: { exitCode: 0 } } });
      await expect(restarted.getStatus(delivered.executionId, { ...identity, userId: "other-owner" })).rejects.toMatchObject({ code: "WORKFORCE_EXECUTION_FORBIDDEN" });
      const files = await readdir(join(evidenceDir, delivered.executionId));
      expect(files).toHaveLength(4);
      for (const file of files) {
        const path = join(evidenceDir, delivered.executionId, file), data = JSON.parse(await readFile(path, "utf8"));
        if (data.output.codeDelivery) {
          data.output.codeDelivery.artifact.filesChanged[0].patch += "corrupted";
          await writeFile(path, JSON.stringify(data));
        }
      }
      expect(await restarted.getStatus(delivered.executionId, identity)).toMatchObject({ codeDelivery: null, evidenceUnavailable: true });
      expect(generated).toHaveBeenCalledTimes(6);
    } finally { await restarted.close(); }
  } finally {
    await new Promise<void>(resolve => { server.close(() => resolve()); server.closeAllConnections(); });
    await server.shutdownResources?.(); await executor.close(); generated.mockRestore(); create.mockRestore(); remove.mockRestore();
    if (cleanupFixtureWorktree) {
      expect((await removeOriginal(cleanupFixtureWorktree)).success).toBe(true);
      retained.delete(root);
    }
  }
}, 180000);
