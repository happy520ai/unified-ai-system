import assert from "node:assert/strict";
import test from "node:test";
import { createHash } from "node:crypto";
import { once } from "node:events";
import { createServer } from "node:http";
import { mkdtemp, realpath, rm, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { tmpdir } from "node:os";
import { parseCliArgs, runCli, CliUsageError } from "./cli-core.js";
import { projectGovernedAgentTaskApproval, projectGovernedAgentTaskSnapshot } from "./agentTaskCommands.ts";

type Data = Record<string, any>;
const taskId = "7de31f92-d0fd-45f4-b2f5-e7d9c41ccaca", agentId = "agt_task_fixture";
const digest = (text: string) => createHash("sha256").update(text).digest("hex");
function canonical(value: any): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (value && typeof value === "object") return `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${canonical(value[key])}`).join(",")}}`;
  return JSON.stringify(value);
}
const hash = (value: any) => "sha256:" + digest(canonical(value));
function snapshot(providerId = "local-fake-provider", paths = ["source.mjs", "test.mjs"]) {
  const sourceFiles = [{ path: paths[0], content: "export const value = 1;\n", sha256: digest("export const value = 1;\n") },
    { path: paths[1], content: "fixed immutable test\n", sha256: digest("fixed immutable test\n") }];
  const artifact = { readPaths: paths, writePaths: [paths[0]], verification: {
    verificationId: "fixed-tests", command: "node --test '" + paths[1].replaceAll("'", "'\\''") + "'", immutableTests: [{ path: paths[1], sha256: sourceFiles[1].sha256 }],
    image: "node@sha256:" + "c".repeat(64), workspaceMode: "ro", networkAccess: false, timeoutMs: 15000, maxMemoryMB: 128, maxOutputBytes: 65536, pidsLimit: 32, cpus: 1 },
    artifactLimits: { maxChangedFiles: 1, maxFileBytes: 65536, maxDiffBytes: 262144 } };
  const profileBody = { version: 1, mode: "governed-agent-long-task", profileId: "fixed-profile", projectId: "fixture", baselineRevision: "a".repeat(40),
    model: { providerId, modelId: "fixed-model", maxInputTokens: 65536, maxOutputTokens: 4096 },
    limits: { maxPlanSteps: 3, maxIterations: 5, maxModelCalls: 6, maxTotalTokens: 417792, maxRepairAttempts: 1, chunkTimeoutMs: 120000, maxInputBytes: 65536 },
    verificationResult: { version: 1, adapter: "node-test", minimumPassed: 1, requiredChecks: [{ file: paths[1], name: "fixed required check" }] }, artifact };
  const profile = { ...profileBody, profileHash: hash(profileBody) };
  const artifactProfile = { version: 1, mode: "forge-owned-worktree-artifact", profileId: profile.profileId, projectId: profile.projectId,
    baselineRevision: profile.baselineRevision, roleId: "backend-engineer", ...artifact };
  const sourceFilesHash = digest(canonical({ profileHash: hash(artifactProfile), files: sourceFiles.map(file => [file.path, file.sha256]) }));
  const reviewBody = { version: 1, profile, configuredRepositoryHash: "sha256:" + "d".repeat(64), sourceFilesHash,
    goal: "  Preserve this exact goal\n", prompt: "  Complete original prompt\r\n" + "a".repeat(20000) + "\nFINAL ORIGINAL LINE\n" };
  const review = { ...reviewBody, reviewHash: hash(reviewBody) };
  return { version: 1, taskId, agentId, agentRunId: "agr_original", revision: 0, phase: "prepared",
    counters: { iterations: 0, modelCalls: 0, reservedTokens: 0, repairAttempts: 0 }, pendingOperation: null, review, sourceFiles, plan: null,
    approvalId: null, confirmedApprovalId: null, stepIndex: 0, stepReceipts: [], modelReceipts: [], verificationAttempts: [],
    workspaceReceipt: null, sourceFilesHash, finalAnswer: "", errorCode: null, controlRequested: null, resumable: false,
    recovery: { automaticReplay: false, workspaceReconciliationRequired: false, wholeDirectoryRollbackProtection: false } } as Data;
}
function plan(state: Data) {
  const body = { version: 1, reviewHash: state.review.reviewHash, steps: [
    { id: "inspect", kind: "inspect", title: "Read source", paths: ["source.mjs"] },
    { id: "implement", kind: "implement", title: "Change source", paths: ["source.mjs"] },
    { id: "verify", kind: "verify", title: "Run immutable tests", paths: ["test.mjs"] },
  ] }; return { ...body, planHash: hash(body) };
}
function approval(state: Data) {
  return { id: "appr_original", agentId, toolName: "agent_long_task", status: "PENDING", review: { schemaVersion: 1, reviewable: true,
    effectType: "agent:long-task", policyHash: "sha256:" + "f".repeat(64), agentTask: { taskId, agentRunId: state.agentRunId, review: state.review, plan: state.plan ?? plan(state) } } };
}
async function fixture() {
  let state = snapshot(), variant = "normal";
  const calls: Array<{ path: string; method: string; body: Data | null; dispatch?: string }> = [];
  const root = await mkdtemp(join(await realpath(tmpdir()), "agent-task-cli-"));
  const server = createServer(async (request, response) => {
    let raw = ""; for await (const chunk of request) raw += chunk;
    const body = raw ? JSON.parse(raw) : null, path = request.url!;
    calls.push({ path, method: request.method!, body, dispatch: request.headers["provider-dispatch-key"] as string });
    let data: any = state;
    if (["unknown", "incomplete", "known", "persist"].includes(variant) && request.method === "POST") {
      response.writeHead(variant === "unknown" ? 503 : 409, { "content-type": "application/json" }); response.end(JSON.stringify({ status: "error", error: {
        code: variant === "incomplete" ? "AGENT_LONG_TASK_EXECUTION_INCOMPLETE" : "AGENT_LONG_TASK_FAILED", message: "Bearer fixture-private-secret",
        ...(["known", "persist"].includes(variant) ? { details: { taskId, outcomeUnknown: false, persistenceOutcomeUnknown: variant === "persist" } } : {}) } })); return;
    }
    if (path.startsWith("/v1/approvals")) data = request.method === "GET" ? { approvals: [approval(state)] } : { approval: { ...approval(state), status: "APPROVED" } };
    else if (request.method === "POST") {
      if (path.endsWith("/plan")) { state = { ...state, plan: plan(state), phase: "awaiting_confirmation", approvalId: "appr_original", revision: 3 }; }
      else if (path.endsWith("/confirm")) state = { ...state, phase: "paused", confirmedApprovalId: body.approvalId, revision: 5, resumable: true };
      else if (path.endsWith("/run")) state = { ...state, phase: "paused", revision: 10, resumable: true, counters: { ...state.counters, iterations: 1, modelCalls: 2, reservedTokens: 139264 },
        modelReceipts: [{ totalTokens: null, inputTokens: null, outputTokens: null, status: "succeeded", executionMode: "fake" }] };
      else if (path.endsWith("/schedule")) state = { ...state, revision: state.revision + 1, resident: {
        enabled: true, chunks: 0, maxChunks: 6, expiresAt: Date.now() + 60000, chunkIterations: 1, stopReason: null } };
      else if (path.endsWith("/pause")) state = { ...state, phase: "paused", revision: state.revision + 1,
        ...(state.resident ? { resident: { ...state.resident, enabled: false, stopReason: "pause" } } : {}) };
      else if (path.endsWith("/cancel")) state = { ...state, phase: "cancelled", revision: state.revision + 1, resumable: false };
      data = state;
    }
    if (variant === "replaced-source" && !path.startsWith("/v1/approvals")) data = { ...data, sourceFiles: data.sourceFiles.slice(1) };
    if (variant === "secret") data = { ...data, token: "fixture-private-secret" };
    response.writeHead(200, { "content-type": "application/json" }); response.end(JSON.stringify({ status: "ok", data }));
  });
  server.listen(0, "127.0.0.1"); await once(server, "listening"); const url = `http://127.0.0.1:${(server.address() as any).port}`;
  async function run(operation: string, body?: Data | string, extra: string[] = [], json = true) {
    const path = join(root, "request.json"); if (body !== undefined) await writeFile(path, typeof body === "string" ? body : JSON.stringify(body));
    const args = ["agents", "task", operation, ...(operation === "prepare" ? [] : [taskId]), "--agent-id", agentId,
      ...(body === undefined ? [] : ["--input", path, "--yes"]), ...extra];
    return invoke(args, json);
  }
  async function invoke(args: string[], json = true) {
    let out = "", err = "";
    const code = await runCli([...args, "--url", url, ...(json ? ["--json"] : [])], { env: { AGENT_CONSOLE_ADMIN_KEY: "cli-fixture-key" },
      stdout: { isTTY: false, write: (text: string) => { out += text; } }, stderr: { write: (text: string) => { err += text; } } });
    return { code, out, err, parsed: json ? JSON.parse(out || err) : null };
  }
  return { run, invoke, calls, state: () => state, variant: (value: string) => { variant = value; }, real: () => { state = snapshot("fixed-real-provider"); },
    needsRestoration() {
      const retainedPlan = plan(state);
      state = { ...state, phase: "paused", plan: retainedPlan, confirmedApprovalId: "appr_original", resumable: false,
        workspaceReceipt: { version: 2, taskId, worktreeId: "wf-original", branch: "codex/agent-task-original", reviewHash: state.review.reviewHash,
          planHash: retainedPlan.planHash, baselineRevision: state.review.profile.baselineRevision, createdAt: "2026-09-11T00:00:00.000Z",
          identities: Object.fromEntries(["repositoryRoot", "worktreeRoot", "worktreeDirectory", "gitFile"].map((key, index) => [key, { dev: "1", ino: String(index + 1) }])) },
        recovery: { ...state.recovery, workspaceReconciliationRequired: true } };
    },
    async close() { await new Promise<void>(resolve => { server.close(() => resolve()); server.closeAllConnections(); });
      assert.equal(await realpath(root), root); assert.equal(dirname(root), await realpath(tmpdir())); await rm(root, { recursive: true, force: true }); } };
}

test("task CLI prints complete review and plan and invokes each explicit original-ID operation without automatic approval or loops", async () => {
  const f = await fixture();
  try {
    const original = f.state().review;
    const prepared = await f.run("prepare", { goal: original.goal, prompt: original.prompt });
    assert.equal(prepared.code, 0, prepared.err); assert.equal(prepared.parsed.data.review.prompt, original.prompt);
    assert.deepEqual(prepared.parsed.data.sourceFiles, f.state().sourceFiles); assert.equal(f.calls.length, 1);
    const planned = await f.run("plan", { revision: 0 });
    assert.equal(planned.code, 0, planned.err); assert.equal(planned.parsed.data.plan.steps.length, 3);
    assert.equal(f.calls.length, 3); assert.equal(f.calls[1].method, "GET"); assert.equal(typeof f.calls[2].dispatch, "string");
    assert.ok(f.calls.every(call => !call.path.startsWith("/v1/approvals")));
    const plain = await f.invoke(["agents", "approvals", "--agent-id", agentId], false);
    assert.equal(plain.code, 0, plain.err); assert.ok(plain.out.includes("FINAL ORIGINAL LINE")); assert.ok(plain.out.includes("a".repeat(20000)));
    const reviewed = await f.invoke(["agents", "approvals", "--agent-id", agentId]);
    assert.equal(reviewed.parsed.data[0].review.agentTask.review.prompt, original.prompt);
    assert.equal((await f.invoke(["agents", "approve", "--approval-id", "appr_original", "--yes"])).code, 0);
    const confirmed = await f.run("confirm", { revision: 3, reviewHash: original.reviewHash, planHash: planned.parsed.data.plan.planHash, approvalId: "appr_original" });
    assert.equal(confirmed.code, 0, confirmed.err);
    const beforeRun = f.calls.length, chunk = await f.run("run", { revision: 5, maxIterations: 1 });
    assert.equal(chunk.code, 0, chunk.err); assert.equal(chunk.parsed.data.phase, "paused"); assert.equal(chunk.parsed.data.modelReceipts[0].totalTokens, null);
    assert.equal(chunk.parsed.automaticContinuation, false); assert.equal(f.calls.length, beforeRun + 2);
    assert.deepEqual(f.calls.at(-1)?.body, { revision: 5, maxIterations: 1 });
    assert.equal((await f.run("status")).code, 0); assert.equal((await f.run("pause", { revision: 10 })).code, 0);
    assert.equal((await f.run("cancel", { revision: 11 })).parsed.data.phase, "cancelled");
    assert.ok(f.calls.filter(call => call.path.includes("/tasks/")).every(call => call.path.includes(taskId)));
  } finally { await f.close(); }
});

test("task CLI explicitly schedules the original task and reports resident continuation without sending authority or dispatch keys", async () => {
  const f = await fixture();
  try {
    const original = f.state().review;
    assert.equal((await f.run("prepare", { goal: original.goal, prompt: original.prompt, projectId: "configured-project" })).code, 0);
    assert.equal(f.calls[0].body?.projectId, "configured-project");
    f.needsRestoration();
    const queued = await f.run("schedule", { revision: 0 });
    assert.equal(queued.code, 0, queued.err); assert.equal(queued.parsed.automaticContinuation, true);
    assert.ok(queued.parsed.nextAction.includes("shared pool")); assert.deepEqual(f.calls.at(-1)?.body, { revision: 0 });
    assert.equal(f.calls.at(-1)?.path, `/v1/agents/${agentId}/tasks/${taskId}/schedule`);
    assert.equal(f.calls.at(-1)?.dispatch, undefined);
    assert.equal((await f.run("pause", { revision: 1 })).parsed.automaticContinuation, false);
    const count = f.calls.length;
    assert.equal((await f.run("schedule", { revision: 2, authority: { userId: "other" } })).code, 1);
    assert.equal(f.calls.length, count);
    f.real(); f.needsRestoration();
    assert.equal((await f.run("schedule", { revision: 0 })).parsed.code, "AGENT_TASK_REAL_PROVIDER_CONFIRMATION_REQUIRED");
    assert.equal(f.calls.at(-1)?.method, "GET");
    assert.equal((await f.run("schedule", { revision: 0 }, ["--allow-real-provider"])).code, 0);
  } finally { await f.close(); }
});

test("task CLI rejects scope/model overrides and duplicate JSON before calls and requires explicit real-provider authorization", async () => {
  const f = await fixture();
  try {
    const env = { AGENT_CONSOLE_ADMIN_KEY: "fixture-key" };
    for (const args of [["agents", "task", "run", taskId, "--agent-id", agentId], ["agents", "task", "status", "new-task", "--agent-id", agentId],
      ["agents", "task", "status", taskId, "--agent-id", agentId, "--yes"], ["agents", "task", "run", taskId, "--agent-id", agentId, "--input", "unused.json", "--yes", "--model-id", "override"]]) {
      assert.throws(() => parseCliArgs(args, env), CliUsageError);
    }
    for (const body of [{ revision: 0, modelId: "override" }, { revision: 0, maxIterations: 11 }, { revision: 0, worktreeRoot: "replacement" }, '{"revision":0,"revision":1}']) {
      assert.equal((await f.run("run", body)).code, 1);
    }
    assert.equal(f.calls.length, 0); f.real();
    const denied = await f.run("plan", { revision: 0 });
    assert.equal(denied.code, 1); assert.equal(denied.parsed.code, "AGENT_TASK_REAL_PROVIDER_CONFIRMATION_REQUIRED");
    assert.equal(f.calls.length, 1); assert.equal(f.calls[0].method, "GET");
    assert.equal((await f.run("plan", { revision: 0 }, ["--allow-real-provider"])).code, 0);
    assert.deepEqual(f.calls.at(-1)?.body, { revision: 0 });
  } finally { await f.close(); }
});

test("paused task restoration is explained without automatic execution and remains available through one explicit original-ID run", async () => {
  const f = await fixture();
  try {
    f.needsRestoration();
    const status = await f.run("status");
    assert.equal(status.code, 0, status.err); assert.equal(status.parsed.data.resumable, false);
    assert.equal(status.parsed.data.recovery.workspaceReconciliationRequired, true);
    assert.ok(status.parsed.nextAction.includes("verified restoration of the original worktree"));
    assert.ok(status.parsed.nextAction.includes("resets no counters"));
    assert.equal(f.calls.length, 1); assert.equal(f.calls[0].method, "GET");
    const run = await f.run("run", { revision: 0, maxIterations: 1 });
    assert.equal(run.code, 0, run.err); assert.equal(f.calls.length, 3);
    assert.equal(f.calls[2].path, `/v1/agents/${agentId}/tasks/${taskId}/run`);
    assert.deepEqual(f.calls[2].body, { revision: 0, maxIterations: 1 });
    assert.ok(f.calls.every(call => !call.path.endsWith("/plan") && !call.path.endsWith("/confirm")));
  } finally { await f.close(); }
});

test("task CLI refuses incomplete review/state, preserves unknown outcomes and never prints remote secret messages or retries", async () => {
  const f = await fixture();
  try {
    const state = f.state();
    const unicodePaths = snapshot("local-fake-provider", ["src/中文 file.mjs", "test/测试.mjs"]);
    assert.equal(projectGovernedAgentTaskSnapshot(unicodePaths, agentId, taskId).sourceFiles[0].path, "src/中文 file.mjs");
    assert.throws(() => projectGovernedAgentTaskApproval({ ...approval(state).review, agentTask: { ...approval(state).review.agentTask, review: { ...state.review, prompt: "truncated" } } }));
    assert.throws(() => projectGovernedAgentTaskSnapshot({ ...state, phase: "completed", plan: plan(state), stepIndex: 3 }, agentId, taskId));
    assert.throws(() => projectGovernedAgentTaskSnapshot({ ...state, taskId: "wrong" }, agentId, taskId));
    f.variant("replaced-source"); assert.equal((await f.run("status")).code, 1);
    f.variant("secret"); const secret = await f.run("status"); assert.equal(secret.code, 1); assert.ok(!(secret.out + secret.err).includes("fixture-private-secret"));
    f.variant("unknown"); const before = f.calls.length, unknown = await f.run("prepare", { goal: state.review.goal, prompt: state.review.prompt });
    assert.equal(unknown.code, 1); assert.equal(unknown.parsed.outcomeUnknown, true); assert.equal(unknown.parsed.retryAllowed, false);
    assert.equal(f.calls.length, before + 1); assert.ok(!(unknown.out + unknown.err).includes("fixture-private-secret"));
    f.variant("incomplete");
    const incomplete = await f.run("prepare", { goal: state.review.goal, prompt: state.review.prompt });
    assert.equal(incomplete.parsed.outcomeUnknown, true); assert.equal(f.calls.length, before + 2);
    f.variant("known"); assert.equal((await f.run("run", { revision: 0 })).parsed.outcomeUnknown, false);
    f.variant("persist"); assert.equal((await f.run("run", { revision: 0 })).parsed.outcomeUnknown, true);
  } finally { await f.close(); }
});

test("task CLI requires the reviewed executed-check verdict and preserves a skipped failure with actual exit zero", () => {
  const state = snapshot(), contract = state.review.profile.verificationResult;
  const evidence = { version: 1, adapter: "node-test", contractHash: hash(contract), runnerHash: "sha256:" + "b".repeat(64), snapshotHash: state.sourceFilesHash,
    verdict: "passed", reason: "checks-passed", counts: { tests: 1, passed: 1, failed: 0, cancelled: 0, skipped: 0, todo: 0, suites: 0, topLevel: 1 },
    executedPassed: 1, requiredChecks: [{ ...contract.requiredChecks[0], status: "passed" }] };
  const verification = { status: "passed", command: state.review.profile.artifact.verification.command, image: state.review.profile.artifact.verification.image,
    snapshotHash: state.sourceFilesHash, exitCode: 0, cleanupConfirmed: true, stdout: "original test output", stderr: "", checkResult: evidence };
  const completed = { ...state, phase: "completed", plan: plan(state), stepIndex: 3, verificationAttempts: [{ status: "passed", verification }] };
  assert.equal(projectGovernedAgentTaskSnapshot(completed, agentId, taskId).phase, "completed");
  for (const change of [{ checkResult: undefined }, { checkResult: { ...evidence, executedPassed: 0 } },
    { checkResult: { ...evidence, contractHash: "sha256:" + "0".repeat(64) } },
    { checkResult: { ...evidence, requiredChecks: [{ ...evidence.requiredChecks[0], status: "todo" }] } },
    { checkResult: { ...evidence, requiredChecks: [{ ...evidence.requiredChecks[0], status: "missing" }] } },
    { checkResult: { ...evidence, requiredChecks: [evidence.requiredChecks[0], evidence.requiredChecks[0]] } }]) {
    assert.throws(() => projectGovernedAgentTaskSnapshot({ ...completed, verificationAttempts: [{ status: "passed", verification: { ...verification, ...change } }] }, agentId, taskId));
  }
  const failedVerification = { ...verification, status: "failed", stdout: "first all-skipped output", checkResult: { ...evidence,
    verdict: "failed", reason: "no-executed-checks", executedPassed: 0, counts: { ...evidence.counts, passed: 0, skipped: 1 },
    requiredChecks: [{ ...evidence.requiredChecks[0], status: "skipped" }] } };
  const failed = { ...state, phase: "failed", verificationAttempts: [{ status: "failed", verification: failedVerification }] };
  const observed = projectGovernedAgentTaskSnapshot(failed, agentId, taskId);
  assert.equal(observed.verificationAttempts[0].verification.exitCode, 0);
  assert.equal(observed.verificationAttempts[0].verification.stdout, "first all-skipped output");
  assert.throws(() => projectGovernedAgentTaskSnapshot({ ...completed, verificationAttempts: failed.verificationAttempts }, agentId, taskId));
  const { verificationResult: _contract, ...legacyProfile } = state.review.profile;
  assert.throws(() => projectGovernedAgentTaskSnapshot({ ...state, review: { ...state.review, profile: legacyProfile } }, agentId, taskId));
  const reconciliation = { operationId: "workspace_fixture", kind: "iteration", inputHash: "sha256:" + "a".repeat(64), revision: 4 };
  const reconciled = projectGovernedAgentTaskSnapshot({ ...failed, errorCode: "RECONCILED_UNKNOWN_OUTCOME", reconciliation }, agentId, taskId);
  assert.deepEqual(reconciled.reconciliation, reconciliation);
  assert.equal(reconciled.phase, "failed");
  assert.throws(() => projectGovernedAgentTaskSnapshot({ ...failed, reconciliation: { ...reconciliation, revision: 0 } }, agentId, taskId));
  assert.throws(() => projectGovernedAgentTaskSnapshot({ ...failed, reconciliation: { ...reconciliation, kind: "Iteration" } }, agentId, taskId));
});
