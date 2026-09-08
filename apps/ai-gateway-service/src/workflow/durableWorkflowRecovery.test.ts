import { createHash, randomUUID } from "node:crypto";
import { spawn, type ChildProcess } from "node:child_process";
import { existsSync, linkSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
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

const scope = { tenantId: "workflow-durable-tenant", userId: "workflow-owner" };
const request = { workflowId: "workflow-restart", goal: "Create an attributable local report", artifactName: "report.md" };
const emptyKnowledge = () => ({ mode: "keyword", chunks: [], metadata: {} });
const roots: string[] = [];
const children = new Set<ChildProcess>();
const serviceUrl = pathToFileURL(join(dirname(fileURLToPath(import.meta.url)), "localWorkflowService.js")).href;

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

describe("durable local workflow recovery", () => {
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
    const root = tempRoot(); const service = createService(root);
    const controller = new AbortController();
    const lease = { signal: controller.signal, release: () => {} };
    await expect(executeGovernedWorkflowRun({
      governance: {
        service: { authorizeAgentExecution: async () => ({ executionLease: lease }) },
        toolProxy: { enforce: async () => ({ outcome: "allow", policy: {}, executionLease: lease }), enforceResult: async () => { throw new Error("Synthetic governance failure"); } },
      } as never,
      workflowService: service, identity: { ...scope, permissions: ["workflow:run"] },
      body: { ...request, agentId: "agt_workflow" }, requestContext: { tenantId: "spoof", userId: "spoof" },
    })).rejects.toMatchObject({ code: "WORKFLOW_ARTIFACT_OUTCOME_UNCERTAIN" });
    expect(await service.recoverRun(request.workflowId, scope)).toMatchObject({ status: "unknown", error: { code: "WORKFLOW_POST_WRITE_GOVERNANCE_UNCERTAIN" }, reconciliation: { status: "verified" } });
    await expect(service.run(request, scope)).rejects.toMatchObject({ code: "WORKFLOW_OUTCOME_UNKNOWN" });
    const completed = await executeGovernedWorkflowRun({
      governance: {
        service: { authorizeAgentExecution: async () => ({ executionLease: lease }) },
        toolProxy: { enforce: async () => ({ outcome: "allow", policy: {}, executionLease: lease }), enforceResult: async ({ result }: { result: object }) => ({ verdict: "allow", result }) },
      } as never,
      workflowService: service, identity: { ...scope, permissions: ["workflow:run"] },
      body: { ...request, agentId: "agt_workflow" }, requestContext: scope,
    });
    expect(completed).toMatchObject({ workflowId: request.workflowId });
    expect(service.getRun(request.workflowId, scope)).toMatchObject({ status: "completed", attempt: 1, canResume: false });
    expect(artifacts(root)).toHaveLength(1);
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
