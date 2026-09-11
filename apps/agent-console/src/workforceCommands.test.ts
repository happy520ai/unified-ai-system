import assert from "node:assert/strict";
import { createServer } from "node:http";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, join, resolve, sep } from "node:path";
import test from "node:test";
import { CliUsageError, parseCliArgs, runCli } from "./cli-core.js";

const IDS = { executionId: "wf-scope-" + "a".repeat(64), taskId: "task-report", workflowId: "workflow-report" };
function completed(): any {
  return { workflowId: IDS.workflowId, taskId: IDS.taskId, parentExecutionId: IDS.executionId, roleId: "qa", originalPlanId: "plan-report",
    status: "completed", originVerified: true, artifactVerified: true, canResume: false, outcomeUnknown: false,
    parentExecutionStatus: "failed", parentExecutionResumed: false, employeeRolesRerun: false,
    result: { status: "completed", workflowId: IDS.workflowId, artifact: { fileName: "report.md", absolutePath: "E:/managed/report.md",
      relativePath: ".data/workflows/report.md", sha256: "b".repeat(64), bytes: 45 } } };
}
async function fixture() {
  const root = await mkdtemp(join(tmpdir(), "uai-workforce-cli-")), path = join(root, "recovery.json");
  await writeFile(path, JSON.stringify(IDS));
  const calls: Array<{ path: string; body: any; authorization?: string }> = [];
  let change = (_value: any) => {}, mode = "normal";
  const server = createServer(async (request, response) => {
    let text = ""; for await (const chunk of request) text += chunk;
    calls.push({ path: request.url!, body: JSON.parse(text), authorization: request.headers.authorization });
    if (mode === "drop") { response.destroy(); return; }
    if (mode === "forbidden") { response.writeHead(403, { "content-type": "application/json" }); response.end(JSON.stringify({ status: "error", error: { code: "FORBIDDEN", message: "private remote text" } })); return; }
    let data = request.url?.endsWith("/status") ? { planId: IDS.executionId, status: "failed", workflowHandoff: completed() } : completed();
    change(data); response.writeHead(200, { "content-type": "application/json" }); response.end(JSON.stringify({ status: "ok", data }));
  });
  await new Promise<void>(resolve => server.listen(0, "127.0.0.1", resolve));
  const address = server.address(); if (!address || typeof address === "string") throw new Error("No fixture address");
  return { path, calls, setMode: (next: string) => { mode = next; }, mutate: (next: (value: any) => void) => { change = next; },
    async run(args: string[], key = true, json = true) {
      let out = "", err = "";
      const code = await runCli([...args, "--url", `http://127.0.0.1:${address.port}`, ...(json ? ["--json"] : [])], {
        env: key ? { AGENT_CONSOLE_ADMIN_KEY: "workforce-cli-fixture-key" } : {},
        stdout: { isTTY: false, write: (value: string) => { out += value; } }, stderr: { write: (value: string) => { err += value; } },
      });
      return { code, out, err, data: json ? JSON.parse(out || err) : null };
    },
    async close() {
      server.closeAllConnections(); await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
      if (!resolve(root).startsWith(resolve(tmpdir()) + sep) || !basename(root).startsWith("uai-workforce-cli-")) throw new Error("Unsafe cleanup root");
      await rm(root, { recursive: true, force: true });
    } };
}

test("Workforce CLI admits only parent status and exact-ID handoff recovery", () => {
  assert.equal(parseCliArgs(["workforce", "status", IDS.executionId], {}).command, "workforce");
  assert.equal(parseCliArgs(["workforce", "handoff-recover", "--input", "recovery.json", "--yes"], {}).confirmed, true);
  for (const args of [["run"], ["approve"], ["status", IDS.executionId, "--yes"], ["status", "../escape"],
    ["status", IDS.executionId, "--allow-real-provider"], ["handoff-recover"], ["handoff-recover", "--input", "r.json", "--agent-id", "agt_other"]]) {
    assert.throws(() => parseCliArgs(["workforce", ...args], {}), CliUsageError);
  }
});

test("Workforce status validates the execution and keeps parent failure separate from a verified workflow", async () => {
  const f = await fixture();
  try {
    const observed = await f.run(["workforce", "status", IDS.executionId]);
    assert.equal(observed.code, 0); assert.equal(observed.data.status, "observed");
    assert.equal(observed.data.data.parentExecutionStatus, "failed");
    assert.equal(observed.data.data.workflowHandoff.status, "completed");
    assert.equal(observed.data.data.workflowHandoff.artifact.sha256, "b".repeat(64));
    assert.deepEqual(f.calls[0], { path: "/workforce/execute/status", body: { executionId: IDS.executionId }, authorization: "Bearer workforce-cli-fixture-key" });
    f.mutate(data => { data.workflowHandoff.artifactVerified = false; data.workflowHandoff.result = null; });
    const unverified = await f.run(["workforce", "status", IDS.executionId]);
    assert.equal(unverified.data.data.workflowHandoff.status, "unknown"); assert.equal(unverified.data.data.workflowHandoff.artifact, null);
    f.mutate(data => { data.planId = "different-execution"; });
    const replaced = await f.run(["workforce", "status", IDS.executionId]); assert.equal(replaced.code, 1); assert.equal(replaced.data.status, "failed");
    assert.doesNotMatch(replaced.err, /different-execution/);
  } finally { await f.close(); }
});

test("Workforce status retains the exact pending report approval and bounded recovery action", async () => {
  const f = await fixture(), approvalId = "appr_original_report";
  const pending = (data: any) => Object.assign(data.workflowHandoff, { status: "failed", artifactVerified: false, result: null, canResume: true,
    resumeAction: "run-safe-remaining-stages", error: { code: "TOOL_APPROVAL_REQUIRED", approvalId, attempt: 1, message: "private-error-context" } });
  try {
    f.mutate(pending);
    const response = await f.run(["workforce", "status", IDS.executionId]);
    assert.equal(response.code, 0);
    const workflow = response.data.data.workflowHandoff;
    assert.equal(workflow.status, "failed"); assert.equal(workflow.resumeAction, "run-safe-remaining-stages");
    assert.deepEqual(workflow.error, { code: "TOOL_APPROVAL_REQUIRED", approvalId });
    assert.equal(workflow.taskId, IDS.taskId); assert.equal(workflow.workflowId, IDS.workflowId); assert.equal(workflow.parentExecutionId, IDS.executionId);
    assert.match(response.data.nextAction, /agents approvals/); assert.ok(response.data.nextAction.includes(`agents approve --approval-id ${approvalId} --yes`));
    const plain = await f.run(["workforce", "status", IDS.executionId], true, false);
    assert.equal(plain.code, 0); assert.ok(plain.out.includes(approvalId)); assert.match(plain.out, /run-safe-remaining-stages/);
    assert.doesNotMatch(response.out + plain.out, /private-error-context/);
    for (const mutate of [(value: any) => { value.error.approvalId = "appr_unsafe;command"; },
      (value: any) => { value.error.code = "unsafe code"; }, (value: any) => { value.resumeAction = "rerun-everything"; }]) {
      f.mutate(data => { pending(data); mutate(data.workflowHandoff); });
      const invalid = await f.run(["workforce", "status", IDS.executionId]); assert.equal(invalid.code, 1); assert.equal(invalid.data.status, "failed");
      assert.doesNotMatch(invalid.err, /unsafe;command|unsafe code|rerun-everything/);
    }
    assert.ok(f.calls.every(call => call.path === "/workforce/execute/status"));
  } finally { await f.close(); }
});

test("Workforce recovery previews without dispatch and requires confirmation plus an admin key", async () => {
  const f = await fixture(); const args = ["workforce", "handoff-recover", "--input", f.path];
  try {
    const preview = await f.run(args, false); assert.equal(preview.code, 0); assert.equal(preview.data.status, "preview"); assert.equal(f.calls.length, 0);
    for (const [key, value] of Object.entries(IDS)) assert.equal(preview.data[key], value);
    assert.equal((await f.run([...args, "--yes"], false)).code, 2); assert.equal(f.calls.length, 0);
    const recovered = await f.run([...args, "--yes"]); assert.equal(recovered.code, 0); assert.equal(recovered.data.status, "completed");
    assert.equal(recovered.data.data.parentExecutionResumed, false); assert.equal(recovered.data.data.employeeRolesRerun, false);
    assert.deepEqual(f.calls[0].body, IDS); assert.equal(f.calls[0].path, "/workforce/execute/handoff/recover");
    await writeFile(f.path, JSON.stringify({ ...IDS, goal: "unapproved replacement" }));
    assert.equal((await f.run([...args, "--yes"])).code, 2); assert.equal(f.calls.length, 1);
  } finally { await f.close(); }
});

test("Workforce recovery preserves all IDs on rejection or dropped replies and never retries", async () => {
  const f = await fixture(), args = ["workforce", "handoff-recover", "--input", f.path, "--yes"];
  try {
    for (const mode of ["drop", "forbidden"]) {
      f.setMode(mode); const before = f.calls.length, response = await f.run(args);
      assert.equal(response.code, 1); assert.equal(response.data.status, mode === "drop" ? "unknown" : "failed");
      assert.equal(response.data.retryAllowed, false); assert.equal(f.calls.length, before + 1);
      for (const [key, value] of Object.entries(IDS)) assert.equal(response.data[key], value);
      assert.doesNotMatch(response.err, /private remote text/);
    }
    f.setMode("normal");
    for (const mutate of [(data: any) => { data.taskId = "different-task"; }, (data: any) => { data.workflowId = "different-workflow"; },
      (data: any) => { data.parentExecutionId = "different-execution"; }, (data: any) => { data.parentExecutionResumed = true; },
      (data: any) => { data.employeeRolesRerun = true; }, (data: any) => { data.artifactVerified = false; },
      (data: any) => { data.result.artifact.sha256 = "not-a-hash"; }]) {
      f.mutate(mutate); const before = f.calls.length, response = await f.run(args);
      assert.equal(response.code, 1); assert.equal(response.data.status, "unknown"); assert.equal(f.calls.length, before + 1);
      for (const [key, value] of Object.entries(IDS)) assert.equal(response.data[key], value);
    }
  } finally { await f.close(); }
});
