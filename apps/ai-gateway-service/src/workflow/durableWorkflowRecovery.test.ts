// @test-isolation process
import { createHash, randomUUID } from "node:crypto";
import { spawn, type ChildProcess } from "node:child_process";
import { existsSync, linkSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, renameSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, dirname, join, resolve, sep } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { DatabaseSync } from "node:sqlite";
import { createServer } from "node:http";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createLocalWorkflowService } from "./localWorkflowService.js";
import { executeGovernedWorkflowRun } from "./governedWorkflowExecution.ts";
import { dispatchHttpRoutes05 } from "../http/httpServerRoutes05.js";
import { resolveRuntimeRoutePermissionOverride } from "../http/runtimeRouteAccessManifest.ts";
import { createEnterpriseGovernanceService } from "../enterprise/enterpriseGovernanceService.js";
import { createAgentGovernanceService } from "../agent-governance/agentGovernanceService.ts";
import { createAgentGovernanceToolProxy } from "../agent-governance/toolProxy.ts";
import { createAgentApprovalStore } from "../agent-governance/agentApprovalStore.ts";

const scope = { tenantId: "workflow-durable-tenant", userId: "workflow-owner" };
const request = { workflowId: "workflow-restart", goal: "Create an attributable local report", artifactName: "report.md" };
const emptyKnowledge = () => ({ mode: "keyword", chunks: [], metadata: {} });
const roots: string[] = [];
const children = new Set<ChildProcess>();
const serviceUrl = pathToFileURL(join(dirname(fileURLToPath(import.meta.url)), "localWorkflowService.js")).href;
const GOVERNANCE_SECRET = "workflow-approval-integration-fixture-0123456789";
const GOVERNANCE_NOW = "2026-09-08T10:00:00.000Z";
const operator = { ...scope, role: "admin", permissions: ["*"] };

function workflowGovernance(dataDir: string) {
  const service = createAgentGovernanceService({ dataDir, now: () => GOVERNANCE_NOW,
    env: { AI_GATEWAY_AGENT_GOVERNANCE_HMAC_KEY: GOVERNANCE_SECRET, PME_ENTERPRISE_PLATFORM_TENANT_ID: scope.tenantId } });
  return { service, toolProxy: createAgentGovernanceToolProxy({ service, now: () => GOVERNANCE_NOW }) };
}
type GovernedTestOverrides = {
  governance?: ReturnType<typeof workflowGovernance>; workflowService?: ReturnType<typeof createService>; agentId?: string;
  body?: Record<string, unknown>; identity?: typeof operator; signal?: AbortSignal;
};
async function governedFixture(options: { approval?: boolean; maxToolCalls?: number; child?: boolean } = {}) {
  const root = tempRoot(); const output = join(root, "artifacts"); const dataDir = join(root, "governance");
  const governance = workflowGovernance(dataDir);
  await governance.service.createPolicyVersion({ policyKey: "task:workflow-review", version: 1, policyType: "task", scopeKey: "workflow-review",
    content: { toolRules: { file_write: options.approval === false ? "allow" : "require_approval" },
      ...(options.maxToolCalls ? { limits: { maxToolCalls: options.maxToolCalls } } : {}) } }, operator);
  await governance.service.activatePolicyVersion("task:workflow-review", 1, operator);
  const parent = options.child ? await governance.service.generateAgent({ name: "workflow-coordinator", task: "coordinate child work",
    requestedTools: ["file_read", "file_write"], ttlSeconds: 7200, parentAgentId: null,
    proposedTraits: ["write_capable", "subagent_creator"], proposedRiskLevel: "medium", taskPolicyKeys: ["workflow-review"] }, operator) : null;
  const agent = await governance.service.generateAgent({ name: "durable-workflow-writer", task: "write a controlled local report",
    requestedTools: ["file_write"], ttlSeconds: 3600, parentAgentId: parent?.agentId ?? null, taskPolicyKeys: ["workflow-review"] }, operator);
  const service = createService(output);
  return { root, output, dataDir, governance, agent, parent, service,
    run: (overrides: GovernedTestOverrides = {}) => executeGovernedWorkflowRun({ governance: overrides.governance ?? governance,
      workflowService: overrides.workflowService ?? service, identity: overrides.identity ?? operator,
      body: { ...request, agentId: overrides.agentId ?? agent.agentId, ...overrides.body }, requestContext: {}, signal: overrides.signal }),
    approval: (id: string) => createAgentApprovalStore({ storePath: join(dataDir, "approvals.json"), secret: GOVERNANCE_SECRET, now: () => GOVERNANCE_NOW }).get(id),
  };
}
async function pendingWorkflow(setup: Awaited<ReturnType<typeof governedFixture>>, overrides: GovernedTestOverrides = {}) {
  await expect(setup.run(overrides)).rejects.toMatchObject({ code: "TOOL_APPROVAL_REQUIRED" });
  const pending = await (overrides.governance ?? setup.governance).service.listApprovals(overrides.agentId ?? setup.agent.agentId, (overrides.identity ?? operator).tenantId);
  expect(pending).toHaveLength(1); return pending[0];
}

function tempRoot() { const root = mkdtempSync(join(tmpdir(), "workflow-durable-")); roots.push(root); return root; }
function createService(root: string, options: Record<string, unknown> = {}) {
  return createLocalWorkflowService({ outputDir: root, knowledgeService: { retrieve: async () => emptyKnowledge() }, ...options });
}
function artifacts(root: string): string[] {
  if (!existsSync(root)) return [];
  return readdirSync(root, { withFileTypes: true }).flatMap(entry => entry.isDirectory() && entry.name.startsWith("tenant-")
    ? readdirSync(join(root, entry.name)).filter(name => name.endsWith(".md")).map(name => join(root, entry.name, name)) : []);
}
function stagingFiles(root: string): string[] {
  return readdirSync(root, { withFileTypes: true }).flatMap(entry => entry.isDirectory() && entry.name.startsWith("tenant-")
    ? readdirSync(join(root, entry.name)).filter(name => name.endsWith(".workflow.tmp")) : []);
}
async function stop(child: ChildProcess) {
  if (child.exitCode !== null || child.signalCode !== null) return;
  const exited = new Promise<void>(resolveExit => child.once("exit", () => resolveExit()));
  child.kill("SIGKILL"); await exited; children.delete(child);
}
afterEach(async () => {
  for (const child of children) await stop(child);
  for (const root of roots.splice(0)) {
    if (!resolve(root).startsWith(`${resolve(tmpdir())}${sep}`) || !basename(root).startsWith("workflow-durable-")) throw new Error("Unsafe test cleanup target");
    rmSync(root, { recursive: true, force: true, maxRetries: 3, retryDelay: 50 });
  }
});

async function pausedChild(root: string, stage: "beforeIntent" | "afterIntent" | "afterPublish") {
  const source = `
    import { createLocalWorkflowService } from ${JSON.stringify(serviceUrl)};
    const hold = setInterval(() => {}, 1000);
    const service = createLocalWorkflowService({ outputDir: process.env.WORKFLOW_TEST_ROOT,
      workflowStateOptions: { leaseMs: 1000 },
      knowledgeService: { retrieve: async () => ({ mode: 'keyword', chunks: [], metadata: {} }) },
      workflowHooks: { [process.env.WORKFLOW_TEST_STAGE]: async () => {
        process.send({ stage: process.env.WORKFLOW_TEST_STAGE });
        await new Promise(resolve => process.once('message', resolve));
      } },
    });
    try { const result = await service.run(${JSON.stringify(request)}, ${JSON.stringify(scope)}); process.send({ result }); }
    catch (error) { process.send({ error: error.code }); }
    finally { clearInterval(hold); process.disconnect(); }
  `;
  const child = spawn(process.execPath, ["--input-type=module", "--eval", source], {
    cwd: dirname(fileURLToPath(import.meta.url)),
    env: { SystemRoot: process.env.SystemRoot ?? "", TEMP: tmpdir(), TMP: tmpdir(), WORKFLOW_TEST_ROOT: root, WORKFLOW_TEST_STAGE: stage },
    stdio: ["ignore", "ignore", "pipe", "ipc"], windowsHide: true,
  });
  children.add(child);
  let errorOutput = "";
  child.stderr?.on("data", chunk => { errorOutput += String(chunk); });
  await new Promise<void>((resolveStage, reject) => {
    const timeout = setTimeout(() => reject(new Error(`Workflow child failed to reach ${stage}: ${errorOutput}`)), 15_000);
    child.once("error", error => { clearTimeout(timeout); reject(error); });
    child.on("message", message => {
      if ((message as { stage?: string }).stage === stage) { clearTimeout(timeout); resolveStage(); }
      if ((message as { error?: string }).error) { clearTimeout(timeout); reject(new Error(JSON.stringify(message))); }
    });
    child.once("exit", () => { clearTimeout(timeout); reject(new Error(`Workflow child exited before ${stage}: ${errorOutput}`)); });
  });
  return child;
}

async function pausedGovernedChild(setup: Awaited<ReturnType<typeof governedFixture>>, stage: string) {
  const governanceModule = pathToFileURL(join(dirname(fileURLToPath(import.meta.url)), "../agent-governance/agentGovernanceService.ts")).href;
  const proxyModule = pathToFileURL(join(dirname(fileURLToPath(import.meta.url)), "../agent-governance/toolProxy.ts")).href;
  const wrapperModule = pathToFileURL(join(dirname(fileURLToPath(import.meta.url)), "governedWorkflowExecution.ts")).href;
  const source = `
    import { createLocalWorkflowService } from ${JSON.stringify(serviceUrl)};
    import { createAgentGovernanceService } from ${JSON.stringify(governanceModule)};
    import { createAgentGovernanceToolProxy } from ${JSON.stringify(proxyModule)};
    import { executeGovernedWorkflowRun } from ${JSON.stringify(wrapperModule)};
    const hold = setInterval(() => {}, 1000);
    const governanceService = createAgentGovernanceService({ dataDir: ${JSON.stringify(setup.dataDir)}, now: () => ${JSON.stringify(GOVERNANCE_NOW)},
      env: { AI_GATEWAY_AGENT_GOVERNANCE_HMAC_KEY: ${JSON.stringify(GOVERNANCE_SECRET)}, PME_ENTERPRISE_PLATFORM_TENANT_ID: ${JSON.stringify(scope.tenantId)} } });
    const workflowService = createLocalWorkflowService({ outputDir: ${JSON.stringify(setup.output)}, workflowStateOptions: { leaseMs: 5000 },
      knowledgeService: { retrieve: async () => ({ mode: 'keyword', chunks: [], metadata: {} }) },
      workflowHooks: { [${JSON.stringify(stage)}]: async () => { process.send({ stage: ${JSON.stringify(stage)} }); await new Promise(resolve => process.once('message', resolve)); } } });
    try { const result = await executeGovernedWorkflowRun({ governance: { service: governanceService,
      toolProxy: createAgentGovernanceToolProxy({ service: governanceService, now: () => ${JSON.stringify(GOVERNANCE_NOW)} }) }, workflowService,
      identity: ${JSON.stringify(operator)}, body: ${JSON.stringify({ ...request, agentId: setup.agent.agentId })}, requestContext: {} }); process.send({ result }); }
    catch(error) { process.send({ error: error.code }); }
    finally { clearInterval(hold); process.disconnect(); }
  `;
  const child = spawn(process.execPath, ["--input-type=module", "--eval", source], { cwd: dirname(fileURLToPath(import.meta.url)),
    env: { SystemRoot: process.env.SystemRoot ?? "", TEMP: tmpdir(), TMP: tmpdir() }, stdio: ["ignore", "ignore", "pipe", "ipc"], windowsHide: true });
  children.add(child); let stderr = ""; child.stderr?.on("data", chunk => { stderr += String(chunk); });
  await new Promise<void>((resolveStage, reject) => {
    const timer = setTimeout(() => reject(new Error(`Governed workflow child did not reach ${stage}: ${stderr}`)), 15_000);
    child.once("error", error => { clearTimeout(timer); reject(error); });
    child.on("message", message => {
      const value = message as { stage?: string; error?: string };
      if (value.stage === stage) { clearTimeout(timer); resolveStage(); }
      if (value.error) { clearTimeout(timer); reject(new Error(`Governed child failed: ${value.error}`)); }
    });
    child.once("exit", () => { clearTimeout(timer); reject(new Error(`Governed child exited before ${stage}: ${stderr}`)); });
  });
  return child;
}

describe("durable local workflow recovery", { timeout: 120_000 }, () => {
  it("keeps history reads lazy and owner-scoped before any run", () => {
    const root = join(tempRoot(), "not-created");
    const service = createService(root);
    expect(service.listRuns(scope)).toEqual({ runs: [] });
    expect(() => service.getRun(request.workflowId, scope)).toThrowError(expect.objectContaining({ code: "WORKFLOW_NOT_FOUND" }));
    expect(existsSync(root)).toBe(false);
    expect(service.getHealth().persistence.state).toBe("unverified");
  });

  it("reopens persisted completion and replays one ID without retrieval or a second artifact", async () => {
    const root = tempRoot();
    const first = await createService(root).run(request, scope);
    const retrieve = vi.fn(async () => emptyKnowledge());
    const restarted = createService(root, { knowledgeService: { retrieve } });
    expect(await restarted.run(request, scope)).toEqual(first);
    expect(retrieve).not.toHaveBeenCalled();
    expect(artifacts(root)).toEqual([first.artifact.absolutePath]);
    expect(restarted.getRun(request.workflowId, scope)).toMatchObject({ status: "completed", attempt: 1, canResume: false, result: first });
    await expect(restarted.run({ ...request, goal: "Different input" }, scope)).rejects.toMatchObject({ code: "WORKFLOW_INPUT_CONFLICT" });
    expect(readFileSync(first.artifact.absolutePath, "utf8")).toContain(request.goal);
  });

  it("resumes only an owned empty database after a real initialization-process interruption", async () => {
    const root = tempRoot();
    const source = `import { writeFileSync } from 'node:fs'; import { join } from 'node:path';
      import { createLocalWorkflowService } from ${JSON.stringify(serviceUrl)};
      const service = createLocalWorkflowService({ outputDir: process.env.WORKFLOW_TEST_ROOT,
        knowledgeService: { retrieve: async () => ({ mode: 'keyword', chunks: [] }) },
        workflowStateOptions: { onInitialization: () => {
          writeFileSync(join(process.env.WORKFLOW_TEST_ROOT, 'initialization-interrupted.flag'), 'after-wx');
          process.kill(process.pid, 'SIGKILL');
        } },
      }); await service.run(${JSON.stringify(request)}, ${JSON.stringify(scope)});`;
    const child = spawn(process.execPath, ["--input-type=module", "--eval", source], {
      env: { SystemRoot: process.env.SystemRoot ?? "", TEMP: tmpdir(), TMP: tmpdir(), WORKFLOW_TEST_ROOT: root }, windowsHide: true, stdio: "ignore",
    });
    children.add(child);
    await new Promise<void>((resolveExit, reject) => { child.once("exit", () => resolveExit()); child.once("error", reject); });
    children.delete(child);
    expect(readFileSync(join(root, "initialization-interrupted.flag"), "utf8")).toBe("after-wx");
    expect(readFileSync(join(root, "workflow-runs.sqlite"))).toHaveLength(0);
    const restarted = createService(root);
    expect(() => restarted.getRun(request.workflowId, scope)).toThrowError(expect.objectContaining({ code: "WORKFLOW_STATE_INITIALIZING" }));
    expect(restarted.getHealth()).toMatchObject({ status: "degraded", persistence: { lastErrorCode: "WORKFLOW_STATE_INITIALIZING" } });
    expect((await restarted.run(request, scope)).status).toBe("completed");
    expect(restarted.getHealth()).toMatchObject({ status: "ready", persistence: { state: "ready", lastErrorCode: null } });

    const foreignRoot = join(tempRoot(), "foreign"); mkdirSync(foreignRoot);
    const foreignPath = join(foreignRoot, "workflow-runs.sqlite"); writeFileSync(foreignPath, "");
    await expect(createService(foreignRoot).run(request, scope)).rejects.toMatchObject({ code: "WORKFLOW_STATE_INVALID" });
    expect(readFileSync(foreignPath)).toHaveLength(0);
  }, 20_000);

  it("cleans only its original unregistered staging inode after ordinary preparation failures", async () => {
    const root = tempRoot();
    const service = createService(root, { workflowHooks: { afterStaging: async () => { throw new Error("Synthetic preparation failure"); } } });
    await expect(service.run(request, scope)).rejects.toThrow("Synthetic preparation failure");
    expect(stagingFiles(root)).toEqual([]);
    const tooLarge = createService(root, { knowledgeService: { retrieve: async () => ({ ...emptyKnowledge(), metadata: { large: "x".repeat(2 * 1024 * 1024) } }) } });
    await expect(tooLarge.run({ ...request, workflowId: "oversized-prepare" }, scope)).rejects.toMatchObject({ code: "WORKFLOW_RECORD_TOO_LARGE" });
    expect(stagingFiles(root)).toEqual([]);
    expect(artifacts(root)).toEqual([]);
  });

  it("reports safe storage errors, observed degraded health, and refuses to replace missing established state", async () => {
    const root = tempRoot();
    const privateDetail = `EACCES: synthetic private path ${join(root, "workflow-runs.sqlite")}`;
    const injected = createService(root, { workflowStateOptions: { onInitialization: () => { throw Object.assign(new Error(privateDetail), { code: "EACCES" }); } } });
    let failure: any;
    try { await injected.run(request, scope); } catch (error) { failure = error; }
    expect(failure).toMatchObject({ code: "WORKFLOW_STATE_PERMISSION_DENIED", cause: { message: privateDetail } });
    expect(failure.message).not.toContain(root);
    expect(injected.getHealth()).toMatchObject({ status: "degraded", persistence: { lastErrorCode: "WORKFLOW_STATE_PERMISSION_DENIED" } });
    const restarted = createService(root); await restarted.run(request, scope);
    rmSync(join(root, "workflow-runs.sqlite"));
    await expect(createService(root).run({ ...request, workflowId: "must-not-reset-state" }, scope)).rejects.toMatchObject({ code: "WORKFLOW_STATE_MISSING" });
    expect(existsSync(join(root, "workflow-runs.sqlite"))).toBe(false);
  });

  it("preserves unknown staging replacements and stops at the bounded orphan limit", async () => {
    const root = tempRoot();
    let replaced = "";
    const service = createService(root, { workflowHooks: { afterStaging: async () => {
      const tenant = readdirSync(root).find(name => name.startsWith("tenant-"))!;
      replaced = join(root, tenant, stagingFiles(root)[0]!);
      rmSync(replaced); writeFileSync(replaced, "unrelated user content");
      throw new Error("Synthetic failure after replacement");
    } } });
    await expect(service.run(request, scope)).rejects.toMatchObject({ details: { stagingCleanupRequired: true } });
    expect(readFileSync(replaced, "utf8")).toBe("unrelated user content");
    expect(service.getRun(request.workflowId, scope)).toMatchObject({ error: { code: "WORKFLOW_STAGING_CLEANUP_REQUIRED" } });
    const tenantDir = dirname(replaced);
    for (let index = 1; index < 32; index += 1) writeFileSync(join(tenantDir, `.${randomUUID()}.workflow.tmp`), "unknown retained evidence");
    await expect(createService(root).run({ ...request, workflowId: "bounded-orphans" }, scope)).rejects.toMatchObject({ code: "WORKFLOW_STAGING_CAPACITY" });
    expect(stagingFiles(root)).toHaveLength(32);
    expect(readFileSync(replaced, "utf8")).toBe("unrelated user content");
  });

  it("separates owners and tenants and ignores body identity claims", async () => {
    const root = tempRoot(); const service = createService(root);
    await service.run({ ...request, tenantId: "spoof", userId: "spoof", context: { tenantId: "spoof" } }, scope);
    const otherOwner = { ...scope, userId: "another-owner" };
    const otherTenant = { ...scope, tenantId: "another-tenant" };
    expect(service.listRuns(otherOwner).runs).toEqual([]);
    expect(() => service.getRun(request.workflowId, otherTenant)).toThrowError(expect.objectContaining({ statusCode: 404 }));
    await expect(service.recoverRun(request.workflowId, otherOwner)).rejects.toMatchObject({ statusCode: 404 });
    const secondOwner = await service.run(request, otherOwner);
    expect(secondOwner.artifact.fileName).toBe("report-2.md");
    expect(service.listRuns(scope).runs).toHaveLength(1);
  });

  it("records first pre-publication failure and explicitly resumes without replacing user files", async () => {
    const root = tempRoot();
    const failed = createService(root, { knowledgeService: { retrieve: async () => { throw new Error("Synthetic retrieval failed"); } } });
    await expect(failed.run(request, scope)).rejects.toThrow("Synthetic retrieval failed");
    expect(failed.getRun(request.workflowId, scope)).toMatchObject({ status: "failed", canResume: true, history: [{ code: "WORKFLOW_EXECUTION_FAILED", attempt: 1 }] });
    const resumed = await createService(root).run(request, scope);
    expect(resumed.status).toBe("completed");
    expect(createService(root).getRun(request.workflowId, scope)).toMatchObject({ attempt: 2, history: [{ code: "WORKFLOW_EXECUTION_FAILED", attempt: 1 }] });
    writeFileSync(resumed.artifact.absolutePath, "user edited the completed report");
    expect(await createService(root).run(request, scope)).toEqual(resumed);
    expect(readFileSync(resumed.artifact.absolutePath, "utf8")).toBe("user edited the completed report");
    expect(artifacts(root)).toHaveLength(1);
  });

  it("records cancellation before effect and allows only an explicit rerun", async () => {
    const root = tempRoot(); const controller = new AbortController();
    const service = createService(root, { knowledgeService: { retrieve: async () => { controller.abort(new Error("Synthetic cancellation")); return emptyKnowledge(); } } });
    await expect(service.run(request, { ...scope, signal: controller.signal })).rejects.toThrow("Synthetic cancellation");
    expect(service.getRun(request.workflowId, scope)).toMatchObject({ status: "cancelled", canResume: true, outcomeUnknown: false });
    expect(artifacts(root)).toEqual([]);
    await createService(root).run(request, scope);
    expect(artifacts(root)).toHaveLength(1);
  });

  it("rejects concurrent duplicate claims and fences a stale pre-effect worker", async () => {
    const root = tempRoot(); let clock = Date.now(); let release!: () => void;
    const waiting = new Promise<void>(resolveWait => { release = resolveWait; });
    const service = createService(root, { workflowStateOptions: { clock: () => clock, leaseMs: 1000 }, knowledgeService: { retrieve: async () => { await waiting; return emptyKnowledge(); } } });
    const pending = service.run(request, scope);
    await expect(createService(root, { workflowStateOptions: { clock: () => clock } }).run(request, scope)).rejects.toMatchObject({ code: "WORKFLOW_BUSY" });
    clock += 1001;
    const replacement = await createService(root, { workflowStateOptions: { clock: () => clock } }).run(request, scope);
    release();
    await expect(pending).rejects.toMatchObject({ code: "WORKFLOW_CLAIM_EXPIRED" });
    expect(artifacts(root)).toEqual([replacement.artifact.absolutePath]);
  });

  it("reconciles a real child killed after durable intent without authorizing a missing artifact rewrite", async () => {
    const root = tempRoot(); const child = await pausedChild(root, "afterIntent");
    await stop(child);
    const restarted = createService(root);
    expect(await restarted.recoverRun(request.workflowId, scope)).toMatchObject({ status: "unknown", outcomeUnknown: true, canResume: false, reconciliation: { status: "unresolved" } });
    await expect(restarted.run(request, scope)).rejects.toMatchObject({ code: "WORKFLOW_OUTCOME_UNKNOWN" });
    expect(artifacts(root)).toEqual([]);
  }, 20_000);

  it("resumes a persisted prepared report after a real process interruption without repeating retrieval", async () => {
    const root = tempRoot(); const child = await pausedChild(root, "beforeIntent"); await stop(child);
    const retrieve = vi.fn(async () => { throw new Error("Prepared reports must not be retrieved again"); });
    const restarted = createService(root, { knowledgeService: { retrieve }, workflowStateOptions: { clock: () => Date.now() + 1001 } });
    expect(await restarted.recoverRun(request.workflowId, scope)).toMatchObject({ status: "interrupted", canResume: true, outcomeUnknown: false });
    expect((await restarted.run(request, scope)).status).toBe("completed");
    expect(retrieve).not.toHaveBeenCalled();
    expect(artifacts(root)).toHaveLength(1);
  }, 20_000);

  it("holds the SQLite fence over actual publication and recovers a child killed after link without another write", async () => {
    const root = tempRoot(); const child = await pausedChild(root, "afterPublish");
    expect(artifacts(root)).toHaveLength(1);
    await expect(createService(root).recoverRun(request.workflowId, scope)).rejects.toMatchObject({ code: "WORKFLOW_BUSY" });
    await stop(child);
    const restarted = createService(root);
    const recovered = await restarted.recoverRun(request.workflowId, scope);
    expect(recovered).toMatchObject({ status: "completed", outcomeUnknown: false, reconciliation: { status: "verified" } });
    expect(await restarted.run(request, scope)).toEqual(recovered.result);
    expect(artifacts(root)).toHaveLength(1);
    expect(stagingFiles(root)).toEqual([]);
  }, 20_000);

  it("revokes a live pre-publication owner during reconciliation so it cannot publish afterward", async () => {
    const root = tempRoot(); const child = await pausedChild(root, "afterIntent");
    expect(await createService(root).recoverRun(request.workflowId, scope)).toMatchObject({ status: "unknown" });
    const result = new Promise<{ error: string }>(resolveResult => child.on("message", message => { if ((message as { error?: string }).error) resolveResult(message as { error: string }); }));
    child.send("continue");
    expect(await result).toMatchObject({ error: "WORKFLOW_CLAIM_EXPIRED" });
    expect(artifacts(root)).toEqual([]);
    await stop(child);
  }, 20_000);

  it("does not turn an equal-content replacement into proof of the original publication", async () => {
    const root = tempRoot(); const child = await pausedChild(root, "afterPublish"); await stop(child);
    const artifact = artifacts(root)[0]!; const original = readFileSync(artifact);
    rmSync(artifact); writeFileSync(artifact, original);
    const service = createService(root);
    expect(await service.recoverRun(request.workflowId, scope)).toMatchObject({ status: "unknown", canResume: false });
    await expect(service.run(request, scope)).rejects.toMatchObject({ code: "WORKFLOW_OUTCOME_UNKNOWN" });
    expect(readFileSync(artifact)).toEqual(original);
    expect(artifacts(root)).toHaveLength(1);
  }, 20_000);

  it("rejects linked SQLite state and preserves malformed journal evidence", async () => {
    const parent = tempRoot(); const root = join(parent, "linked"); mkdirSync(root);
    const outside = join(parent, "outside.txt"); writeFileSync(outside, "user data");
    linkSync(outside, join(root, "workflow-runs.sqlite"));
    await expect(createService(root).run(request, scope)).rejects.toMatchObject({ code: "WORKFLOW_OUTPUT_PATH_UNSAFE" });
    expect(readFileSync(outside, "utf8")).toBe("user data");
    const danglingRoot = join(parent, "dangling"); mkdirSync(danglingRoot);
    const absentOutside = join(parent, "must-not-create.sqlite");
    symlinkSync(absentOutside, join(danglingRoot, "workflow-runs.sqlite"), process.platform === "win32" ? "junction" : "file");
    await expect(createService(danglingRoot).run(request, scope)).rejects.toMatchObject({ code: "WORKFLOW_OUTPUT_PATH_UNSAFE" });
    expect(existsSync(absentOutside)).toBe(false);
    const valid = join(parent, "valid"); await createService(valid).run(request, scope);
    const db = new DatabaseSync(join(valid, "workflow-runs.sqlite"));
    db.prepare("UPDATE workflow_runs SET data = ?, digest = ?").run("{bad", createHash("sha256").update("{bad").digest("hex")); db.close();
    const damaged = createService(valid);
    expect(() => damaged.getRun(request.workflowId, scope)).toThrowError(expect.objectContaining({ code: "WORKFLOW_STATE_INVALID" }));
    expect(damaged.getHealth()).toMatchObject({ status: "degraded", persistence: { state: "degraded", lastErrorCode: "WORKFLOW_STATE_INVALID" } });
  });

  it("keeps failed post-write governance unresolved even when the artifact is independently verified", async () => {
    const setup = await governedFixture({ approval: false }); const service = setup.service;
    const meter = vi.spyOn(setup.governance.toolProxy, "enforceResult").mockRejectedValueOnce(new Error("Synthetic governance failure"));
    await expect(setup.run()).rejects.toMatchObject({ code: "WORKFLOW_ARTIFACT_OUTCOME_UNCERTAIN" });
    expect(await service.recoverRun(request.workflowId, scope)).toMatchObject({ status: "unknown", error: { code: "WORKFLOW_POST_WRITE_GOVERNANCE_UNCERTAIN" }, reconciliation: { status: "verified" } });
    await expect(service.run(request, scope)).rejects.toMatchObject({ code: "WORKFLOW_OUTCOME_UNKNOWN" });
    meter.mockRestore();
    const before = await setup.governance.service.getUsage(setup.agent.agentId);
    const completed = await setup.run();
    expect(completed).toMatchObject({ workflowId: request.workflowId });
    expect(service.getRun(request.workflowId, scope)).toMatchObject({ status: "completed", attempt: 1, canResume: false });
    expect(artifacts(setup.output)).toHaveLength(1);
    expect((await setup.governance.service.getUsage(setup.agent.agentId)).toolCalls).toBe(before.toolCalls);
  });

  it("enforces workflow permissions and server-owned scope over real HTTP", async () => {
    const root = tempRoot(); const service = createService(join(root, "artifacts")); await service.run(request, scope);
    const governance = createEnterpriseGovernanceService({ env: {
      PME_ENTERPRISE_AUTH_ENABLED: "true", PME_ENTERPRISE_USER_STORE_PATH: join(root, "users.json"),
      PME_API_KEY_STORE_PATH: join(root, "keys.json"), PME_AUDIT_LOG_PATH: join(root, "audit.jsonl"), PME_AUDIT_CHAIN_PATH: join(root, "audit.chain"),
      PME_ENTERPRISE_USERS_JSON: JSON.stringify([
        { token: "workflow-test-owner-token", ...scope, role: "operator", permissions: ["workflow:run"] },
        { token: "workflow-test-other-token", ...scope, userId: "other", role: "operator", permissions: ["workflow:run"] },
        { token: "workflow-test-viewer-token", ...scope, userId: "viewer", role: "viewer", permissions: ["dashboard:read"] },
      ]),
    } });
    const server = createServer((httpRequest, httpResponse) => {
      void (async () => {
        const url = new URL(httpRequest.url ?? "/", "http://127.0.0.1");
        const decision = governance.authorize(httpRequest, resolveRuntimeRoutePermissionOverride(httpRequest.method, url.pathname) ?? "route:unknown");
        if (!decision.allowed) { httpResponse.statusCode = decision.statusCode ?? 403; httpResponse.end(JSON.stringify({ error: decision.code })); return; }
        await dispatchHttpRoutes05({ request: Object.assign(httpRequest, { enterpriseIdentity: decision.identity }), response: httpResponse, url,
          workflowService: service, getRequestContext: () => ({}),
          createOkEnvelope: (data: unknown) => ({ data }), createErrorEnvelope: (code: unknown, message: unknown) => ({ error: { code, message } }),
          writeJson: (_response: unknown, status: number, body: unknown) => { httpResponse.statusCode = status; httpResponse.end(JSON.stringify(body)); } });
      })().catch(error => { httpResponse.statusCode = 500; httpResponse.end(JSON.stringify({ error: error.code ?? "unexpected" })); });
    });
    try {
      await new Promise<void>(resolveListen => server.listen(0, "127.0.0.1", resolveListen));
      const address = server.address(); if (!address || typeof address === "string") throw new Error("No HTTP address");
      const call = (path: string, token = "workflow-test-owner-token", method = "GET", tenant?: string) => fetch(`http://127.0.0.1:${address.port}${path}`, {
        method, headers: { authorization: `Bearer ${token}`, ...(tenant ? { "x-pme-tenant-id": tenant } : {}) },
        ...(method === "POST" ? { body: JSON.stringify({ tenantId: scope.tenantId, userId: scope.userId }) } : {}),
      });
      expect((await call("/workflow/runs")).status).toBe(200);
      expect((await call(`/workflow/runs/${request.workflowId}`)).status).toBe(200);
      expect((await call(`/workflow/runs/${request.workflowId}/recover`, undefined, "POST")).status).toBe(200);
      expect((await call("/workflow/runs", "invalid-token")).status).toBe(401);
      expect((await call("/workflow/runs", "workflow-test-viewer-token")).status).toBe(403);
      expect((await call(`/workflow/runs/${request.workflowId}/recover`, "workflow-test-other-token", "POST")).status).toBe(404);
      expect((await call(`/workflow/runs/${request.workflowId}`, undefined, "GET", "forged-tenant")).status).toBe(403);
      expect((await call("/workflow/runs", undefined, "POST")).status).toBe(403);
      expect(artifacts(join(root, "artifacts"))).toHaveLength(1);
    } finally {
      await new Promise<void>(resolveClose => { server.close(() => resolveClose()); server.closeAllConnections(); });
      await governance.close();
    }
  });

  it("exposes scoped history and reconciliation routes with explicit permissions", async () => {
    const root = tempRoot(); const service = createService(root); await service.run(request, scope);
    const dispatch = async (method: string, path: string, identity: unknown) => {
      const outputs: Array<{ status: number; body: unknown }> = [];
      const setHeader = vi.fn();
      await dispatchHttpRoutes05({ request: { method, enterpriseIdentity: identity }, response: { setHeader }, url: new URL(path, "http://127.0.0.1"),
        workflowService: service, getRequestContext: () => ({ tenantId: "body-spoof", userId: "body-spoof" }),
        createOkEnvelope: (data: unknown) => ({ data }), createErrorEnvelope: (code: unknown, message: unknown) => ({ error: { code, message } }),
        writeJson: (_response: unknown, status: number, body: unknown) => outputs.push({ status, body }) });
      expect(setHeader).toHaveBeenCalledWith("Cache-Control", "no-store");
      return outputs[0];
    };
    expect(await dispatch("GET", "/workflow/runs", scope)).toMatchObject({ status: 200, body: { data: { runs: [{ workflowId: request.workflowId }] } } });
    expect(await dispatch("GET", `/workflow/runs/${request.workflowId}`, { ...scope, userId: "other" })).toMatchObject({ status: 404 });
    expect(await dispatch("POST", `/workflow/runs/${request.workflowId}/recover`, scope)).toMatchObject({ status: 200, body: { data: { status: "completed" } } });
    expect(await dispatch("GET", "/workflow/runs", { tenantId: scope.tenantId })).toMatchObject({ status: 403 });
    expect(await dispatch("GET", "/workflow/runs/%", scope)).toMatchObject({ status: 400 });
    for (const [method, path] of [["GET", "/workflow/runs"], ["GET", "/workflow/runs/one"], ["POST", "/workflow/runs/one/recover"]]) {
      expect(resolveRuntimeRoutePermissionOverride(method, path)).toBe("workflow:run");
    }
    writeFileSync(join(root, "workflow-runs.sqlite"), "synthetic invalid SQLite header");
    const invalid = await dispatch("GET", `/workflow/runs/${request.workflowId}`, scope);
    expect(invalid).toMatchObject({ status: 503, body: { error: { code: "WORKFLOW_STATE_UNAVAILABLE" } } });
    expect(JSON.stringify(invalid)).not.toContain(root);
    expect(service.getHealth().status).toBe("degraded");
  });
});

describe("durable workflow artifact approvals", { timeout: 120_000 }, () => {
  it("preserves a completed historical receipt when its current result delivery fails", async () => {
    const setup = await governedFixture(); const approval = await pendingWorkflow(setup);
    await setup.governance.service.decideApproval(approval.id, "approve", operator); await setup.run();
    const usage = await setup.governance.service.getUsage(setup.agent.agentId);
    const meter = vi.spyOn(setup.governance.toolProxy, "enforceResult").mockRejectedValueOnce(new Error("Current receipt delivery failed"));
    try { await expect(setup.run()).rejects.toThrow("Current receipt delivery failed"); } finally { meter.mockRestore(); }
    expect(setup.service.getRun(request.workflowId, scope)).toMatchObject({ status: "completed", outcomeUnknown: false });
    expect((await setup.governance.service.getUsage(setup.agent.agentId)).toolCalls).toBe(usage.toolCalls);
    expect((await setup.approval(approval.id))?.status).toBe("CONSUMED"); expect(artifacts(setup.output)).toHaveLength(1);
  });

  it("keeps mandatory outcome-audit failure unknown until governance-only reconciliation succeeds", async () => {
    const setup = await governedFixture(); const approval = await pendingWorkflow(setup);
    await setup.governance.service.decideApproval(approval.id, "approve", operator);
    const emit = setup.governance.service.emitAudit.bind(setup.governance.service);
    const audit = vi.spyOn(setup.governance.service, "emitAudit").mockImplementation(async event => {
      if (event.eventType === "TOOL_COMPLETED") throw new Error("Synthetic mandatory outcome audit failure");
      await emit(event);
    });
    try { await expect(setup.run()).rejects.toMatchObject({ code: "WORKFLOW_ARTIFACT_OUTCOME_UNCERTAIN" }); } finally { audit.mockRestore(); }
    expect((await setup.approval(approval.id))?.status).toBe("CONSUMED"); expect(artifacts(setup.output)).toHaveLength(1);
    expect(await setup.service.recoverRun(request.workflowId, scope)).toMatchObject({ status: "unknown", resumeAction: "recheck-governance-only" });
    await expect(setup.run()).resolves.toMatchObject({ status: "completed" });
    expect((await setup.governance.service.getUsage(setup.agent.agentId)).toolCalls).toBe(1);
  });

  it("recovers an actual post-link SQLite commit failure using the original consumed approval", async () => {
    const setup = await governedFixture(); const approval = await pendingWorkflow(setup);
    await setup.governance.service.decideApproval(approval.id, "approve", operator);
    let failCommit = false;
    const workflowService = createService(setup.output, { workflowHooks: { afterPublish: () => { failCommit = true; } } });
    const originalExec = DatabaseSync.prototype.exec;
    const commit = vi.spyOn(DatabaseSync.prototype, "exec").mockImplementation(function(this: DatabaseSync, sql: string) {
      if (failCommit && sql === "COMMIT") { failCommit = false; throw Object.assign(new Error("Synthetic post-link commit failure"), { code: "SQLITE_IOERR" }); }
      return originalExec.call(this, sql);
    });
    try { await expect(setup.run({ workflowService })).rejects.toMatchObject({ code: "WORKFLOW_OUTCOME_UNKNOWN" }); } finally { commit.mockRestore(); }
    expect(artifacts(setup.output)).toHaveLength(1); expect((await setup.approval(approval.id))?.status).toBe("CONSUMED");
    const restarted = createService(setup.output);
    expect(await restarted.recoverRun(request.workflowId, scope)).toMatchObject({ status: "unknown", resumeAction: "recheck-governance-only" });
    await expect(setup.run({ workflowService: restarted })).resolves.toMatchObject({ status: "completed" });
    expect(readFileSync(artifacts(setup.output)[0], "utf8")).toBe(approval.review.workflow!.content);
    expect((await setup.governance.service.getUsage(setup.agent.agentId)).toolCalls).toBe(1);
  });

  it.each(["directory-after-hook", "staging-during-lease"])("revalidates the frozen filesystem target after the last authorization await (%s)", async (mutation) => {
    const setup = await governedFixture(); const approval = await pendingWorkflow(setup);
    await setup.governance.service.decideApproval(approval.id, "approve", operator);
    const tenant = join(setup.output, approval.review.workflow!.target.tenantPartition);
    const stagingName = stagingFiles(setup.output)[0]; const staging = join(tenant, stagingName);
    const originalBytes = readFileSync(staging); let armed = false;
    const mutate = () => {
      if (mutation === "directory-after-hook") {
        renameSync(tenant, tenant + "-original"); mkdirSync(tenant);
        renameSync(join(tenant + "-original", stagingName), staging);
        writeFileSync(join(tenant, "foreign.txt"), "foreign directory content retained");
      } else {
        renameSync(staging, staging + ".original"); writeFileSync(staging, "foreign staging content retained");
      }
    };
    const authorize = setup.governance.service.authorizeAgentExecution.bind(setup.governance.service);
    const guard = vi.spyOn(setup.governance.service, "authorizeAgentExecution").mockImplementation(async (agentId, context) => {
      const authorization = await authorize(agentId, context); const assertActive = authorization.executionLease.assertActive;
      return { ...authorization, executionLease: { ...authorization.executionLease, assertActive: async (phase) => {
        const active = await assertActive(phase);
        if (armed) { armed = false; mutate(); }
        return active;
      } } };
    });
    const workflowService = createService(setup.output, { workflowHooks: { beforeLink: () => {
      if (mutation === "directory-after-hook") mutate(); else armed = true;
    } } });
    const outcome = await setup.run({ workflowService }).then(result => ({ result, error: null }), error => ({ result: null, error }));
    guard.mockRestore();
    expect(artifacts(setup.output)).toEqual([]);
    expect(outcome.error).toMatchObject({ code: "WORKFLOW_OUTCOME_UNKNOWN" });
    expect((await setup.approval(approval.id))?.status).toBe("CONSUMED");
    if (mutation === "directory-after-hook") {
      expect(readFileSync(join(tenant, "foreign.txt"), "utf8")).toBe("foreign directory content retained");
      expect(readFileSync(staging)).toEqual(originalBytes);
    } else {
      expect(readFileSync(staging, "utf8")).toBe("foreign staging content retained");
      expect(readFileSync(staging + ".original")).toEqual(originalBytes);
    }
  });

  it.each(["password=synthetic-review-secret", "control\u001b[2Jvalue", "oversized ".repeat(2_000)])("keeps unsafe or unbounded complete content unreviewable (%#)", async (goal) => {
    const setup = await governedFixture();
    await expect(setup.run({ body: { goal } })).rejects.toMatchObject({ code: "APPROVAL_REVIEW_UNAVAILABLE" });
    expect(await setup.governance.service.listApprovals(setup.agent.agentId, scope.tenantId)).toEqual([]);
    expect(artifacts(setup.output)).toHaveLength(0); expect(stagingFiles(setup.output)).toHaveLength(1);
  });

  it("does not execute a rejected request and creates a distinct approval only on explicit retry", async () => {
    const setup = await governedFixture(); const first = await pendingWorkflow(setup);
    await setup.governance.service.decideApproval(first.id, "reject", operator);
    const next = await pendingWorkflow(setup);
    expect(next.id).not.toBe(first.id); expect(next.review.workflow).toEqual(first.review.workflow);
    expect((await setup.approval(first.id))?.status).toBe("REJECTED"); expect(artifacts(setup.output)).toHaveLength(0);
  });

  it("publishes one artifact under concurrent approved requests and consumes the grant once", async () => {
    const setup = await governedFixture(); const approval = await pendingWorkflow(setup);
    await setup.governance.service.decideApproval(approval.id, "approve", operator);
    const results = await Promise.allSettled([setup.run(), setup.run()]);
    expect(results.some(result => result.status === "fulfilled")).toBe(true);
    for (const result of results) if (result.status === "rejected") expect(result.reason.code).toBe("WORKFLOW_BUSY");
    expect(artifacts(setup.output)).toHaveLength(1); expect((await setup.approval(approval.id))?.status).toBe("CONSUMED");
    expect((await setup.governance.service.getUsage(setup.agent.agentId)).toolCalls).toBe(1);
  });

  it.each(["afterAdmission", "beforeLink"])("honors Agent revocation at %s without publishing after the fence", async (stage) => {
    const setup = await governedFixture(); const approval = await pendingWorkflow(setup);
    await setup.governance.service.decideApproval(approval.id, "approve", operator);
    let revocation: Promise<unknown> | undefined;
    const workflowService = createService(setup.output, { workflowHooks: { [stage]: async () => {
      revocation = setup.governance.service.revokeAgent(setup.agent.agentId, { cascade: false }, operator);
      await vi.waitFor(async () => expect((await setup.governance.service.getAgent(setup.agent.agentId, scope.tenantId))?.status).toBe("REVOKED"), { timeout: 5_000 });
    } } });
    await expect(setup.run({ workflowService })).rejects.toMatchObject({ code: stage === "beforeLink" ? "WORKFLOW_OUTCOME_UNKNOWN" : "AGENT_EXECUTION_FENCED" });
    await revocation;
    expect(artifacts(setup.output)).toHaveLength(0); expect((await setup.approval(approval.id))?.status).toBe("CONSUMED");
    expect(workflowService.getRun(request.workflowId, scope).outcomeUnknown).toBe(stage === "beforeLink");
  });

  it.each(["afterPrepared", "afterAdmission", "afterIntent", "afterPublish"])("keeps approval and publication facts durable across a process kill at %s", async (stage) => {
    const setup = await governedFixture();
    let original;
    if (stage !== "afterPrepared") { original = await pendingWorkflow(setup); await setup.governance.service.decideApproval(original.id, "approve", operator); }
    const child = await pausedGovernedChild(setup, stage); await stop(child);
    const retrieve = vi.fn(async () => { throw new Error("Restart must reuse the durable prepared bytes"); });
    const workflowService = createService(setup.output, { workflowStateOptions: { clock: () => Date.now() + 10_000 }, knowledgeService: { retrieve } });
    const governance = workflowGovernance(setup.dataDir);
    if (original) expect((await setup.approval(original.id))?.status).toBe("CONSUMED");
    if (stage === "afterIntent") {
      expect(await workflowService.recoverRun(request.workflowId, scope)).toMatchObject({ status: "unknown", canResume: false, reconciliation: { status: "unresolved" } });
      await expect(setup.run({ workflowService, governance })).rejects.toMatchObject({ code: "WORKFLOW_OUTCOME_UNKNOWN" });
      expect(artifacts(setup.output)).toHaveLength(0);
    } else if (stage === "afterPublish") {
      expect(await workflowService.recoverRun(request.workflowId, scope)).toMatchObject({ status: "unknown", canResume: true, resumeAction: "recheck-governance-only" });
      const before = (await governance.service.getUsage(setup.agent.agentId)).toolCalls;
      await expect(setup.run({ workflowService, governance })).resolves.toMatchObject({ status: "completed" });
      expect((await governance.service.getUsage(setup.agent.agentId)).toolCalls).toBe(before);
      expect(artifacts(setup.output)).toHaveLength(1);
      expect(readFileSync(artifacts(setup.output)[0], "utf8")).toBe(original!.review.workflow!.content);
    } else {
      const next = await pendingWorkflow(setup, { workflowService, governance });
      if (original) { expect(next.id).not.toBe(original.id); expect(next.review.workflow).toEqual(original.review.workflow); }
      await governance.service.decideApproval(next.id, "approve", operator);
      await expect(setup.run({ workflowService, governance })).resolves.toMatchObject({ status: "completed" });
      expect(artifacts(setup.output)).toHaveLength(1);
    }
    expect(retrieve).not.toHaveBeenCalled();
  });
  it("reopens an approved draft without retrieving mutable knowledge and replays at the exact tool-call limit", async () => {
    const setup = await governedFixture({ maxToolCalls: 1 });
    const retrieve = vi.fn(async () => ({ mode: "keyword", chunks: [{ snippet: "ORIGINAL KNOWLEDGE", score: 1,
      document: { sourceId: "fixture", documentId: "one", title: "Immutable source" } }], metadata: {} }));
    const initial = createService(setup.output, { knowledgeService: { retrieve } });
    const approval = await pendingWorkflow(setup, { workflowService: initial });
    expect(artifacts(setup.output)).toHaveLength(0); expect(retrieve).toHaveBeenCalledOnce();
    await setup.governance.service.decideApproval(approval.id, "approve", operator);
    const changedRetrieve = vi.fn(async () => { throw new Error("Mutable knowledge must not be retrieved again"); });
    const restarted = createService(setup.output, { knowledgeService: { retrieve: changedRetrieve } });
    const governance = workflowGovernance(setup.dataDir);
    const result = await setup.run({ workflowService: restarted, governance });
    expect(readFileSync((result as any).artifact.absolutePath, "utf8")).toBe(approval.review.workflow!.content);
    expect(approval.review.workflow!.content).toContain("ORIGINAL KNOWLEDGE"); expect(changedRetrieve).not.toHaveBeenCalled();
    expect((await setup.approval(approval.id))?.status).toBe("CONSUMED");
    expect((await governance.service.getUsage(setup.agent.agentId)).toolCalls).toBe(1);
    await expect(setup.run({ workflowService: restarted, governance })).resolves.toMatchObject({ status: "completed" });
    expect((await governance.service.getUsage(setup.agent.agentId)).toolCalls).toBe(1); expect(artifacts(setup.output)).toHaveLength(1);
  });

  it("deduplicates pending requests and rejects changed normalized input before consuming the approved grant", async () => {
    const setup = await governedFixture(); const first = await pendingWorkflow(setup);
    const repeated = await pendingWorkflow(setup); expect(repeated.id).toBe(first.id);
    await setup.governance.service.decideApproval(first.id, "approve", operator);
    for (const body of [{ goal: "different" }, { artifactName: "different.md" }, { query: "different" }, { sourceIds: ["different"] }, { topK: 1 }]) {
      await expect(setup.run({ body })).rejects.toMatchObject({ code: "WORKFLOW_INPUT_CONFLICT" });
    }
    expect((await setup.approval(first.id))?.status).toBe("APPROVED"); expect(artifacts(setup.output)).toHaveLength(0);
  });

  it.each(["before-consumption", "after-consumption"])("preserves an occupied reviewed target %s without writing a new version", async (when) => {
    const setup = await governedFixture(); const approval = await pendingWorkflow(setup);
    await setup.governance.service.decideApproval(approval.id, "approve", operator);
    const target = join(setup.output, approval.review.workflow!.target.tenantPartition, approval.review.workflow!.target.fileName);
    const occupy = () => writeFileSync(target, "foreign target retained");
    if (when === "before-consumption") occupy();
    const workflowService = createService(setup.output, { workflowHooks: when === "after-consumption" ? { afterAdmission: occupy } : {} });
    await expect(setup.run({ workflowService })).rejects.toMatchObject({ code: "WORKFLOW_TARGET_OCCUPIED" });
    expect(artifacts(setup.output)).toEqual([target]); expect(readFileSync(target, "utf8")).toBe("foreign target retained");
    expect((await setup.approval(approval.id))?.status).toBe(when === "before-consumption" ? "APPROVED" : "CONSUMED");
    expect(workflowService.getRun(request.workflowId, scope)).toMatchObject({ outcomeUnknown: false, canResume: true, error: { code: "WORKFLOW_TARGET_OCCUPIED" } });
  });

  it("retains a consumed grant on pre-intent cancellation and requires a new approval of the same bytes", async () => {
    const setup = await governedFixture(); const approval = await pendingWorkflow(setup);
    await setup.governance.service.decideApproval(approval.id, "approve", operator);
    const controller = new AbortController();
    const workflowService = createService(setup.output, { workflowHooks: { afterAdmission: () => controller.abort(new Error("Cancel after approval consumption")) } });
    await expect(setup.run({ workflowService, signal: controller.signal })).rejects.toThrow("Cancel after approval consumption");
    expect((await setup.approval(approval.id))?.status).toBe("CONSUMED"); expect(artifacts(setup.output)).toHaveLength(0);
    expect(workflowService.getRun(request.workflowId, scope)).toMatchObject({ status: "cancelled", outcomeUnknown: false, canResume: true });
    const next = await pendingWorkflow(setup); expect(next.id).not.toBe(approval.id); expect(next.review.workflow).toEqual(approval.review.workflow);
    await setup.governance.service.decideApproval(next.id, "approve", operator);
    await expect(setup.run()).resolves.toMatchObject({ status: "completed" }); expect(artifacts(setup.output)).toHaveLength(1);
  });

  it.each(["content", "inode", "directory"])("rejects changed prepared %s without consuming the grant or discarding evidence", async (mutation) => {
    const setup = await governedFixture(); const approval = await pendingWorkflow(setup);
    await setup.governance.service.decideApproval(approval.id, "approve", operator);
    const tenant = join(setup.output, approval.review.workflow!.target.tenantPartition);
    const staging = join(tenant, stagingFiles(setup.output)[0]); const bytes = readFileSync(staging);
    if (mutation === "content") { const changed = Buffer.from(bytes); changed[0] ^= 1; writeFileSync(staging, changed); }
    if (mutation === "inode") { renameSync(staging, staging + ".original"); writeFileSync(staging, bytes); }
    if (mutation === "directory") renameSync(tenant, tenant + "-original");
    await expect(setup.run({ workflowService: createService(setup.output) })).rejects.toMatchObject({
      code: mutation === "content" ? "WORKFLOW_STAGED_CONTENT_CHANGED" : mutation === "inode" ? "WORKFLOW_OUTPUT_PATH_UNSAFE" : "WORKFLOW_TARGET_CHANGED",
    });
    expect((await setup.approval(approval.id))?.status).toBe("APPROVED"); expect(artifacts(setup.output)).toHaveLength(0);
    expect(existsSync(mutation === "directory" ? tenant + "-original" : staging)).toBe(true);
  });

  it("cannot reuse one user's approved request through another user or Agent", async () => {
    const setup = await governedFixture(); const approval = await pendingWorkflow(setup);
    await setup.governance.service.decideApproval(approval.id, "approve", operator);
    const other = { ...operator, userId: "delegated-other-owner" };
    const otherApproval = await pendingWorkflow(setup, { identity: other });
    expect(otherApproval.review.workflow!.subjectFingerprint).not.toBe(approval.review.workflow!.subjectFingerprint);
    expect((await setup.approval(approval.id))?.status).toBe("APPROVED");
    await setup.governance.service.decideApproval(otherApproval.id, "reject", operator);
    const otherAgent = await setup.governance.service.generateAgent({ name: "another-writer", task: "write a controlled local report", requestedTools: ["file_write"],
      ttlSeconds: 3600, parentAgentId: null, taskPolicyKeys: ["workflow-review"] }, operator);
    const transferred = await pendingWorkflow(setup, { agentId: otherAgent.agentId });
    expect(transferred.agentId).toBe(otherAgent.agentId); expect((await setup.approval(approval.id))?.status).toBe("APPROVED");
    await expect(setup.run({ identity: { ...operator, tenantId: "other-tenant" } })).rejects.toThrow();
    expect(artifacts(setup.output)).toHaveLength(0);
  });

  it("requires a new approval after the effective policy changes", async () => {
    const setup = await governedFixture(); const approval = await pendingWorkflow(setup);
    await setup.governance.service.decideApproval(approval.id, "approve", operator);
    await setup.governance.service.createPolicyVersion({ policyKey: "task:workflow-review", version: 2, policyType: "task", scopeKey: "workflow-review",
      content: { toolRules: { file_write: "require_approval" }, limits: { maxToolCalls: 7 } } }, operator);
    await setup.governance.service.activatePolicyVersion("task:workflow-review", 2, operator);
    const governance = workflowGovernance(setup.dataDir); const next = await pendingWorkflow(setup, { governance });
    expect(next.id).not.toBe(approval.id); expect(next.review.policyHash).not.toBe(approval.review.policyHash);
    expect(next.review.workflow).toEqual(approval.review.workflow); expect((await setup.approval(approval.id))?.status).toBe("APPROVED");
    expect(artifacts(setup.output)).toHaveLength(0);
  });

  it.each(["deny", "scope", "limit"])("applies the current %s restriction to an already-completed receipt without another write", async (restriction) => {
    const setup = await governedFixture({ approval: false, maxToolCalls: 1 });
    await setup.run(); const file = artifacts(setup.output)[0];
    const logicalPath = `.data/workflows/${basename(dirname(file))}/${basename(file)}`;
    await setup.governance.service.createPolicyVersion({ policyKey: "task:workflow-review", version: 2, policyType: "task", scopeKey: "workflow-review",
      content: { toolRules: { file_write: restriction === "deny" ? "deny" : "allow" },
        ...(restriction === "scope" ? { dataRules: { deniedResources: [logicalPath] } } : {}),
        ...(restriction === "limit" ? { limits: { maxToolCalls: 0 } } : {}) } }, operator);
    await setup.governance.service.activatePolicyVersion("task:workflow-review", 2, operator);
    const governance = workflowGovernance(setup.dataDir);
    await expect(setup.run({ governance })).rejects.toMatchObject({ code: restriction === "deny" ? "TOOL_DENIED_BY_POLICY" : restriction === "scope" ? "TOOL_SCOPE_DENIED" : "TOOL_CALL_LIMIT_REACHED" });
    expect((await governance.service.getUsage(setup.agent.agentId)).toolCalls).toBe(1);
    expect(setup.service.getRun(request.workflowId, scope).status).toBe("completed"); expect(artifacts(setup.output)).toEqual([file]);
  });

  it("rejects a completed child's receipt when a non-cascade ancestor was revoked", async () => {
    const setup = await governedFixture({ approval: false, child: true }); await setup.run();
    await setup.governance.service.revokeAgent(setup.parent!.agentId, { cascade: false }, operator);
    const governance = workflowGovernance(setup.dataDir);
    expect((await governance.service.getAgent(setup.agent.agentId, scope.tenantId))?.status).toBe("ACTIVE");
    await expect(setup.run({ governance })).rejects.toMatchObject({ code: "AGENT_ANCESTOR_NOT_ACTIVE" });
    expect(artifacts(setup.output)).toHaveLength(1); expect(setup.service.getRun(request.workflowId, scope).status).toBe("completed");
  });

  it("does not reconcile legacy unknown publication without original authorization proof", async () => {
    const setup = await governedFixture(); const approval = await pendingWorkflow(setup);
    await setup.governance.service.decideApproval(approval.id, "approve", operator);
    const meter = vi.spyOn(setup.governance.toolProxy, "enforceResult").mockRejectedValueOnce(new Error("Synthetic meter failure"));
    await expect(setup.run()).rejects.toMatchObject({ code: "WORKFLOW_ARTIFACT_OUTCOME_UNCERTAIN" }); meter.mockRestore();
    const db = new DatabaseSync(join(setup.output, "workflow-runs.sqlite"));
    const row = db.prepare("SELECT run_key, data FROM workflow_runs").get() as { run_key: string; data: string };
    const record = JSON.parse(row.data); record.version = 1; delete record.draft.target; delete record.publication.authorization;
    const data = JSON.stringify(record); db.prepare("UPDATE workflow_runs SET data = ?, digest = ? WHERE run_key = ?").run(data, createHash("sha256").update(data).digest("hex"), row.run_key); db.close();
    const restarted = createService(setup.output);
    expect(await restarted.recoverRun(request.workflowId, scope)).toMatchObject({ status: "unknown", canResume: false,
      reconciliation: { status: "verified" }, error: { code: "WORKFLOW_ORIGINAL_AUTHORIZATION_UNVERIFIED" } });
    await expect(setup.run({ workflowService: restarted, body: { recoveryVerified: true, status: "completed" } })).rejects.toMatchObject({ code: "WORKFLOW_OUTCOME_UNKNOWN" });
    expect((await setup.approval(approval.id))?.status).toBe("CONSUMED"); expect(artifacts(setup.output)).toHaveLength(1);
  });
});
