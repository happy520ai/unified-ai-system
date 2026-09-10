import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { createServer } from "node:http";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, join, resolve, sep } from "node:path";
import test from "node:test";
import { runCli, parseCliArgs, CliUsageError } from "./cli-core.js";
import { projectWorkforceExternalRunnerReview, projectWorkforceExternalRunnerApproval, projectWorkforceExternalRunnerState } from "./workforceExternalRunnerReview.ts";

function stable(value: any): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stable).join(",")}]`;
  return `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${stable(value[key])}`).join(",")}}`;
}
const sha = (value: string) => "sha256:" + createHash("sha256").update(value, "utf8").digest("hex");
const hash = (value: unknown) => sha(stable(value));
function nativeReview(prompt = "  Keep this exact task.\r\n\tRead source.mjs: export const value = 1;\nRead test.mjs: assert.equal(value, 2);\n") {
  const profileBody = { version: 1, mode: "codex-app-server-owned-worktree", profileId: "native-fixture", projectId: "fixture",
    roleId: "backend-engineer", baselineRevision: "a".repeat(40), binary: { path: "E:\\Pinned Codex\\codex.exe", sha256: "b".repeat(64), version: "0.153.4", platform: "win32" },
    nativeModel: { modelId: "gpt-6-astra", providerId: "openai" }, disabledMcpServers: [],
    limits: { timeoutMs: 30000, maxInputBytes: 524288, maxMessageBytes: 1048576, maxEvents: 64 },
    artifact: { readPaths: ["source.mjs", "test.mjs"], writePaths: ["source.mjs"],
      verification: { verificationId: "fixed-tests", command: "node test.mjs", immutableTests: [{ path: "test.mjs", sha256: "c".repeat(64) }],
        image: "node@sha256:" + "d".repeat(64), workspaceMode: "ro", networkAccess: false,
        timeoutMs: 10000, maxMemoryMB: 128, maxOutputBytes: 4096, pidsLimit: 32, cpus: 1 },
      artifactLimits: { maxChangedFiles: 1, maxFileBytes: 4096, maxDiffBytes: 8192 } } };
  const body = { version: 1, profile: { ...profileBody, profileHash: hash(profileBody) }, configuredRepositoryHash: "sha256:" + "e".repeat(64),
    goal: "Implement the approved source change", prompt, sourceFilesHash: "f".repeat(64) };
  return { ...body, reviewHash: hash(body) };
}
function approval(prompt?: string): any {
  const review = nativeReview(prompt), options = { selectedRoleCount: 8, templateSelected: true, externalRunner: review };
  return { schemaVersion: 1, reviewable: true, effectType: "workforce:execute", policyHash: "sha256:" + "0".repeat(64),
    workforce: { goal: review.goal, goalDigest: sha(review.goal), goalBytes: Buffer.byteLength(review.goal), planId: "native-plan", planDigest: "sha256:" + "1".repeat(64),
      autonomyMode: "controlled-execution", requiredScopes: ["workforce:execute"], options, optionsHash: hash(options) } };
}
function completed() {
  const review = nativeReview(), executionId = "wf-scope-fixture", taskId = "native-task", agentId = "agt_native";
  const operationId = "wfr_" + hash([executionId, taskId, review.reviewHash]).slice(7);
  const patch = "diff --git a/source.mjs b/source.mjs\n-export const value = 1;\n+export const value = 2;\n";
  const artifact = { version: 1, profileHash: "sha256:" + "2".repeat(64), sourceFilesHash: "3".repeat(64), diffSha256: sha(patch).slice(7),
    diffBytes: Buffer.byteLength(patch), filesChanged: [{ path: "source.mjs", change: "modified", beforeSha256: "4".repeat(64), afterSha256: "5".repeat(64), patch }] };
  const body = { version: 1, operationId, executionId, taskId, agentId, planId: "native-plan", reviewHash: review.reviewHash,
    tenantFingerprint: sha("tenant"), subjectFingerprint: sha("owner"), clientUserMessageId: "12345678-1234-5678-abcd-123456789012",
    worktree: { worktreeId: "owned-worktree", path: "E:/owned/worktree", directoryHash: sha("directory"), baselineRevision: review.profile.baselineRevision, sourceFilesHash: review.sourceFilesHash },
    sequence: 8, previousHash: sha("previous"), status: "verified", threadId: "native-thread", turnId: "native-turn", nativeStatus: "completed",
    processIdentity: { kind: "windows-job", hostPid: 10, childPid: 11, hostCreated: "100", childCreated: "101" },
    ownerProcess: { pid: 9, created: "99" }, recoveryProcesses: [], processClosed: true,
    eventsObserved: 5, eventsHash: hash([]), lastEvent: null, nativeUsage: null, startedAt: "2026-09-11T00:00:00.000Z", updatedAt: "2026-09-11T00:01:00.000Z",
    artifact, verification: { status: "passed", command: review.profile.artifact.verification.command, image: review.profile.artifact.verification.image,
      snapshotHash: artifact.sourceFilesHash, exitCode: 0, cleanupConfirmed: true, stdout: "fixed tests passed", stderr: "", passed: true }, error: null,
    fileApprovals: [{ itemId: "file-change", changesHash: hash(["source.mjs"]), beforeFilesHash: review.sourceFilesHash, completedFilesHash: artifact.sourceFilesHash }] };
  return { state: { ...body, stateHash: hash(body) }, recoveredOriginal: true, newNativeTurns: 0, parentAutomaticallyResumed: false,
    parentExecutionStatus: "failed", parentExecutionResumed: false, employeeRolesRerun: false,
    metadata: { version: 1, agentId, planId: body.planId, planDigest: "1".repeat(64), review } };
}
async function fixture() {
  const root = await mkdtemp(join(tmpdir(), "uai-native-cli-")), path = join(root, "recovery.json"), original = completed();
  const ids = { executionId: original.state.executionId, operationId: original.state.operationId, agentId: original.state.agentId };
  await writeFile(path, JSON.stringify(ids));
  const calls: Array<{ path: string; method: string; body: any }> = [];
  let review = approval(), change = (_value: any) => {}, drop = false;
  const server = createServer(async (request, response) => {
    let raw = ""; for await (const chunk of request) raw += chunk;
    calls.push({ path: request.url!, method: request.method!, body: raw ? JSON.parse(raw) : null });
    if (drop) { response.destroy(); return; }
    const full = completed(), { metadata, ...recovery } = full;
    const data: any = request.url === "/v1/approvals" ? { approvals: [{ id: "appr_native", agentId: ids.agentId, toolName: "workforce_execute", status: "PENDING", review }] }
      : request.url?.endsWith("/status") ? { planId: ids.executionId, status: "failed", externalRunner: { metadata, state: full.state } } : recovery;
    change(data); response.writeHead(200, { "content-type": "application/json" }); response.end(JSON.stringify({ status: "ok", data }));
  });
  await new Promise<void>(resolve => server.listen(0, "127.0.0.1", resolve));
  const address = server.address(); if (!address || typeof address === "string") throw new Error("No fixture address");
  return { ids, path, calls, review: (value: any) => { review = value; }, mutate: (value: (item: any) => void) => { change = value; }, drop: () => { drop = true; },
    async run(args: string[], json = true, key = true) {
      let out = "", err = "";
      const code = await runCli([...args, "--url", `http://127.0.0.1:${address.port}`, ...(json ? ["--json"] : [])], {
        env: key ? { AGENT_CONSOLE_ADMIN_KEY: "native-cli-fixture-key" } : {},
        stdout: { isTTY: false, write: (value: string) => { out += value; } }, stderr: { write: (value: string) => { err += value; } },
      });
      return { code, out, err, data: json ? JSON.parse(out || err) : null };
    }, async close() { server.closeAllConnections(); await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
      if (!resolve(root).startsWith(resolve(tmpdir()) + sep) || !basename(root).startsWith("uai-native-cli-")) throw new Error("Unsafe cleanup root");
      await rm(root, { recursive: true, force: true }); } };
}

test("native CLI review retains complete profile, immutable files and exact 512 KiB prompt in plain and JSON output", async () => {
  const f = await fixture();
  try {
    for (const prompt of [nativeReview().prompt, "N".repeat(524287) + "Z"]) {
      const review = approval(prompt); f.review(review);
      assert.deepEqual(projectWorkforceExternalRunnerReview(review.workforce.options.externalRunner), review.workforce.options.externalRunner);
      assert.deepEqual(projectWorkforceExternalRunnerApproval(review.workforce).options, review.workforce.options);
      const plain = await f.run(["agents", "approvals"], false); assert.equal(plain.code, 0, plain.err);
      assert.ok(plain.out.includes(prompt)); assert.ok(plain.out.includes(JSON.stringify(review.workforce.options.externalRunner.profile, null, 2)));
      assert.match(plain.out, /End of complete native prompt/); assert.ok(plain.out.includes(review.workforce.optionsHash));
      const json = await f.run(["agents", "approvals"]); assert.equal(json.code, 0, json.err);
      assert.deepEqual(json.data.data[0].review.workforce, review.workforce);
    }
    assert.ok(f.calls.every(call => call.path === "/v1/approvals" && call.method === "GET"));
  } finally { await f.close(); }
});

test("native CLI refuses incomplete reviews, full-prompt tampering and launch/model override fields without printing intent", async () => {
  const f = await fixture();
  try {
    const mutations = [(value: any) => { value.workforce.options.externalRunner.prompt += "private-sentinel"; },
      (value: any) => { value.workforce.optionsHash = sha("forged"); }, (value: any) => { value.workforce.goalBytes++; },
      (value: any) => { value.workforce.options.externalRunner.profile.nativeModel.modelId = "override"; },
      (value: any) => { value.workforce.options.externalRunner.profile.args = ["unapproved"]; },
      (value: any) => { value.workforce.options.externalRunner.profile.artifact.verification.immutableTests = []; },
      (value: any) => { value.workforce.options.externalRunner.profile.artifact.verification.networkAccess = true; },
      (value: any) => { value.workforce.options.roleExecution = {}; value.workforce.optionsHash = hash(value.workforce.options); },
      (value: any) => { value.workforce.options.externalRunner = nativeReview("PASSWORD=private-sentinel"); value.workforce.optionsHash = hash(value.workforce.options); }];
    for (const mutate of mutations) { const value = approval(); mutate(value); f.review(value);
      const result = await f.run(["agents", "approvals"]); assert.equal(result.code, 1); assert.doesNotMatch(result.out + result.err, /private-sentinel|exact task/); }
    let accessed = false; const withGetter = nativeReview();
    Object.defineProperty(withGetter, "prompt", { enumerable: true, get() { accessed = true; return "unsafe"; } });
    assert.throws(() => projectWorkforceExternalRunnerReview(withGetter)); assert.equal(accessed, false);
    assert.throws(() => projectWorkforceExternalRunnerReview(nativeReview("x".repeat(524289))));
  } finally { await f.close(); }
});

test("native recovery previews original IDs, requires explicit confirmation, and sends exactly one original recovery request", async () => {
  const f = await fixture(), args = ["workforce", "native-recover", "--input", f.path];
  try {
    assert.equal(parseCliArgs([...args, "--yes"], {}).confirmed, true);
    for (const extra of [["--agent-id", "agt_other"], ["--model-id", "override"], ["--allow-real-provider"]])
      assert.throws(() => parseCliArgs([...args, ...extra], {}), CliUsageError);
    const preview = await f.run(args, true, false); assert.equal(preview.code, 0); assert.equal(preview.data.status, "preview"); assert.equal(f.calls.length, 0);
    assert.equal((await f.run([...args, "--yes"], true, false)).code, 2); assert.equal(f.calls.length, 0);
    const recovered = await f.run([...args, "--yes"]); assert.equal(recovered.code, 0, recovered.err);
    assert.equal(recovered.data.data.newNativeTurns, 0); assert.equal(recovered.data.data.parentAutomaticallyResumed, false);
    assert.equal(recovered.data.data.parentExecutionStatus, "failed"); assert.equal(recovered.data.data.state.status, "verified");
    assert.deepEqual(f.calls, [{ path: "/workforce/execute/external-runner/recover", method: "POST", body: f.ids }]);
    await writeFile(f.path, JSON.stringify({ ...f.ids, threadId: "replacement" }));
    assert.equal((await f.run([...args, "--yes"])).code, 2); assert.equal(f.calls.length, 1);
  } finally { await f.close(); }
});

test("native status keeps parent failure distinct and recovery rejects new turns, mismatched owners and unverified file histories", async () => {
  const f = await fixture(), args = ["workforce", "native-recover", "--input", f.path, "--yes"];
  try {
    const observed = await f.run(["workforce", "status", f.ids.executionId]); assert.equal(observed.code, 0, observed.err);
    assert.equal(observed.data.data.parentExecutionStatus, "failed"); assert.equal(observed.data.data.externalRunner.state.status, "verified");
    const changes = [(value: any) => { value.newNativeTurns = 1; }, (value: any) => { value.parentAutomaticallyResumed = true; },
      (value: any) => { value.state.agentId = "agt_other"; }, (value: any) => { value.state.fileApprovals = []; },
      (value: any) => { value.state.fileApprovals[0].completedFilesHash = null; }, (value: any) => { value.state.verification.cleanupConfirmed = false; },
      (value: any) => { value.state.artifact.filesChanged[0].patch += "extra"; }];
    for (const change of changes) { f.mutate(value => { change(value); const { stateHash: _hash, ...state } = value.state; value.state.stateHash = hash(state); });
      const response = await f.run(args); assert.equal(response.code, 1); assert.equal(response.data.retryAllowed, false); }
    const before = f.calls.length; f.drop(); const failed = await f.run(args);
    assert.equal(failed.code, 1); assert.equal(failed.data.status, "unknown"); assert.equal(failed.data.operationId, f.ids.operationId);
    assert.equal(f.calls.length, before + 1);
  } finally { await f.close(); }
});

test("native status preserves last reported counters with explicit non-final provenance and keeps absent usage null", async () => {
  const f = await fixture();
  try {
    const absent = await f.run(["workforce", "status", f.ids.executionId]);
    assert.equal(absent.data.data.externalRunner.state.nativeUsage, null);
    assert.equal(absent.data.data.externalRunner.state.nativeUsageObservation, "not-reported");
    const counts = { inputTokens: 40, cachedInputTokens: 10, cacheWriteInputTokens: 5, outputTokens: 12, reasoningOutputTokens: 3, totalTokens: 52 };
    const usage = { source: "native-thread-notification", final: false, turnId: "native-turn", total: counts, last: counts, modelContextWindow: 10000 };
    f.mutate(value => { const state = value.externalRunner.state; state.nativeUsage = usage;
      const { stateHash: _hash, ...body } = state; state.stateHash = hash(body); });
    const reported = await f.run(["workforce", "status", f.ids.executionId]); assert.equal(reported.code, 0, reported.err);
    assert.deepEqual(reported.data.data.externalRunner.state.nativeUsage, usage);
    assert.equal(reported.data.data.externalRunner.state.nativeUsageObservation, "last-reported-native-counts-not-final-billing");
    for (const invalid of [{ ...usage, final: true }, { ...usage, turnId: "different-turn" },
      { ...usage, total: { ...counts, inputTokens: -1 } }, { ...usage, total: { ...counts, totalTokens: Number.MAX_SAFE_INTEGER + 1 } }]) {
      f.mutate(value => { const state = value.externalRunner.state; state.nativeUsage = invalid;
        const { stateHash: _hash, ...body } = state; state.stateHash = hash(body); });
      assert.equal((await f.run(["workforce", "status", f.ids.executionId])).code, 1);
    }
  } finally { await f.close(); }
});

test("native state retains original owner and bounded recovery processes, and verified evidence requires confirmed closure", () => {
  const original = completed().state;
  const observer = { identity: { kind: "windows-job", hostPid: 20, childPid: 21, hostCreated: "200", childCreated: "201" }, closed: true };
  const sealed = (change: (value: any) => void) => { const value: any = structuredClone(original); change(value);
    const { stateHash: _hash, ...body } = value; return { ...body, stateHash: hash(body) }; };
  const valid = sealed(value => { value.recoveryProcesses = [observer]; });
  const projected = projectWorkforceExternalRunnerState(valid, original.executionId);
  assert.deepEqual(projected.ownerProcess, { pid: 9, created: "99" }); assert.deepEqual(projected.recoveryProcesses, [observer]);
  assert.ok(Object.isFrozen(projected.ownerProcess)); assert.ok(Object.isFrozen(projected.recoveryProcesses[0].identity));
  assert.equal(Object.hasOwn(projected, "tenantFingerprint"), false); assert.equal(Object.hasOwn(projected, "subjectFingerprint"), false);
  for (const change of [(value: any) => { value.ownerProcess = null; }, (value: any) => { value.ownerProcess.pid = 0; },
    (value: any) => { value.ownerProcess.created = "0"; }, (value: any) => { value.ownerProcess.created = "invalid-time"; },
    (value: any) => { value.ownerProcess.extra = "not-owner-data"; },
    (value: any) => { value.recoveryProcesses = Array(17).fill(observer); },
    (value: any) => { value.recoveryProcesses = [{ identity: null, closed: true }]; },
    (value: any) => { value.recoveryProcesses = [{ ...observer, closed: false }]; },
    (value: any) => { value.recoveryProcesses = [{ ...observer, identity: { ...observer.identity, childPid: -1 } }]; },
    (value: any) => { value.recoveryProcesses = [{ ...observer, identity: { ...observer.identity, kind: "posix-process-group" } }]; },
    (value: any) => { value.status = "unknown"; value.recoveryProcesses = [{ identity: null, closed: false }, observer]; }]) {
    assert.throws(() => projectWorkforceExternalRunnerState(sealed(change), original.executionId), /Invalid or incomplete/);
  }
  const pending = projectWorkforceExternalRunnerState(sealed(value => { value.status = "unknown"; value.ownerProcess = null;
    value.recoveryProcesses = [{ identity: null, closed: false }]; }), original.executionId);
  assert.deepEqual(pending.recoveryProcesses, [{ identity: null, closed: false }]);
  assert.equal(pending.ownerProcess, null); assert.equal(pending.outcomeUnknown, true); assert.equal(pending.verification, null);
});

test("native recovery retains a stale running parent record after original verification but rejects automatic parent resume", async () => {
  const f = await fixture(), args = ["workforce", "native-recover", "--input", f.path, "--yes"];
  try {
    f.mutate(value => { value.parentExecutionStatus = "running"; });
    const recovered = await f.run(args); assert.equal(recovered.code, 0, recovered.err);
    assert.equal(recovered.data.data.state.status, "verified"); assert.equal(recovered.data.data.parentExecutionStatus, "running");
    assert.equal(recovered.data.data.newNativeTurns, 0); assert.equal(recovered.data.data.parentAutomaticallyResumed, false);
    assert.equal(recovered.data.data.parentExecutionResumed, false); assert.match(recovered.data.nextAction, /original parent state is retained/i);
    f.mutate(value => { value.parentExecutionStatus = "running"; value.parentExecutionResumed = true; });
    const rejected = await f.run(args); assert.equal(rejected.code, 1); assert.equal(rejected.data.retryAllowed, false);
  } finally { await f.close(); }
});
