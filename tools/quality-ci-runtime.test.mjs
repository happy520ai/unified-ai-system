import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, copyFile, writeFile, readFile, rm, realpath } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { runNodeScript, commandArtifact, writeCommandArtifact } from "./run-quality-ci-gate.mjs";

async function fixture(t) {
  const parent = await realpath(tmpdir()), root = await mkdtemp(join(parent, "quality-ci-command-"));
  t.after(async () => {
    assert.equal(dirname(resolve(root)), parent);
    assert.equal(await realpath(root), root);
    await rm(root, { recursive: true, force: false });
  });
  return async (name, content) => { const path = join(root, name); await writeFile(path, content); return path; };
}

test("a successful JSON child and a complete failed report keep their actual verdicts", async t => {
  const file = await fixture(t), report = { score: 164, maxScore: 165, pass: false, checks: [{ name: "fixture", ok: false }] };
  const success = await file("success.mjs", "process.stdout.write(JSON.stringify({score:165,pass:true}));");
  const successful = runNodeScript(success, [], 5000);
  assert.equal(successful.ok, true); assert.equal(successful.status, 0);
  assert.deepEqual(commandArtifact(successful, "quality-scorecard"), { score: 165, pass: true });
  const failed = await file("failed.mjs", `process.stdout.write(${JSON.stringify(JSON.stringify(report))}); process.exitCode=1;`);
  const rejected = runNodeScript(failed, [], 5000);
  assert.equal(rejected.ok, false); assert.equal(rejected.status, 1);
  assert.deepEqual(commandArtifact(rejected, "quality-scorecard"), report);
});

test("a timed-out child replaces a prior successful artifact with a structured unavailable result", async t => {
  const file = await fixture(t);
  const slow = await file("slow.mjs", "setTimeout(() => process.stdout.write(JSON.stringify({score:165,pass:true})), 30000);");
  const output = await file("quality-scorecard.json", JSON.stringify({ score: 165, pass: true }));
  const timedOut = runNodeScript(slow, [], 100);
  assert.equal(timedOut.ok, false); assert.equal(timedOut.status, null);
  assert.equal(timedOut.timedOut, true); assert.equal(timedOut.errorCode, "ETIMEDOUT");
  writeCommandArtifact(output, timedOut, "quality-scorecard");
  const saved = JSON.parse(await readFile(output, "utf8"));
  assert.equal(saved.pass, false); assert.equal(saved.ok, false); assert.equal(saved.score, null);
  assert.equal(saved.issueCodes[0].code, "quality_command_timeout");
  assert.equal(saved.execution.timeoutMs, 100); assert.equal(saved.observedReport, null);
});

test("empty, partial, primitive and stderr-only JSON cannot masquerade as a successful command result", async t => {
  const file = await fixture(t);
  const cases = ["", "process.stdout.write('{');", "process.stdout.write('165');",
    "process.stderr.write(JSON.stringify({score:165,pass:true}));"];
  for (let i = 0; i < cases.length; i++) {
    const path = await file(`invalid-${i}.mjs`, cases[i]);
    const result = runNodeScript(path, [], 5000);
    assert.equal(result.status, 0); assert.equal(result.ok, false); assert.equal(result.parsedOutput, null);
    const artifact = commandArtifact(result, "quality-scorecard");
    assert.equal(artifact.pass, false); assert.equal(artifact.score, null);
    assert.equal(artifact.issueCodes[0].code, "quality_command_output_invalid");
  }
});

test("a printed result followed by execution failure stays observed data rather than certified completion", () => {
  const printed = { score: 165, pass: true };
  for (const interruption of [{ status: null, signal: "SIGTERM", errorCode: "ETIMEDOUT", timedOut: true },
    { status: null, signal: "SIGTERM", errorCode: "ENOBUFS", timedOut: false },
    { status: null, signal: "SIGTERM", errorCode: null, timedOut: false },
    { status: null, signal: null, errorCode: null, timedOut: false }]) {
    const artifact = commandArtifact({ ...interruption, timeoutMs: 100, rawStdout: JSON.stringify(printed) }, "quality-scorecard");
    assert.equal(artifact.pass, false); assert.equal(artifact.score, null);
    assert.deepEqual(artifact.observedReport, printed); assert.equal(artifact.execution.errorCode, interruption.errorCode);
  }
});

test("a real nonzero child cannot publish success-looking JSON as a successful artifact", async t => {
  const file = await fixture(t), printed = { score: 165, pass: true };
  const path = await file("contradiction.mjs", `process.stdout.write(${JSON.stringify(JSON.stringify(printed))}); process.exitCode=2;`);
  const result = runNodeScript(path, [], 5000);
  assert.equal(result.status, 2); assert.equal(result.ok, false);
  const artifact = commandArtifact(result, "quality-scorecard");
  assert.equal(artifact.pass, false); assert.equal(artifact.score, null);
  assert.equal(artifact.issueCodes[0].code, "quality_command_failed");
  assert.deepEqual(artifact.observedReport, printed);
});

test("the actual CI wrapper fails malformed scoring and publishes parseable failure evidence", async t => {
  const file = await fixture(t), anchor = await file("anchor", "fixture");
  const root = dirname(anchor), tools = join(root, "tools"); await mkdir(tools);
  const source = dirname(fileURLToPath(import.meta.url));
  for (const name of ["run-quality-ci-gate.mjs", "quality-command-budgets.mjs"]) {
    await copyFile(join(source, name), join(tools, name));
  }
  await writeFile(join(tools, "quality-scorecard.mjs"), "process.stdout.write('{');");
  await writeFile(join(tools, "circuit-recovery-drill.mjs"), "process.stdout.write(JSON.stringify({status:'recovered'}));");
  await writeFile(join(tools, "verify-ci-quality-artifacts.mjs"), "process.stdout.write(JSON.stringify({ok:true,checks:{}}));");
  const env = Object.fromEntries(["PATH", "SystemRoot", "WINDIR", "ComSpec", "PATHEXT", "TEMP", "TMP"]
    .filter(key => process.env[key] !== undefined).map(key => [key, process.env[key]]));
  const result = spawnSync(process.execPath, [join(tools, "run-quality-ci-gate.mjs"), "--json"], {
    cwd: root, env, encoding: "utf8", windowsHide: true, timeout: 10000,
  });
  assert.equal(result.error, undefined); assert.equal(result.status, 1);
  const summary = JSON.parse(result.stdout);
  assert.equal(summary.ok, false); assert.equal(summary.quality.ok, false); assert.equal(summary.quality.parsed, false);
  assert.equal(summary.drill.ok, true); assert.equal(summary.verification.ok, true);
  const artifact = JSON.parse(await readFile(join(root, ".tmp/quality-scorecard.json"), "utf8"));
  assert.equal(artifact.score, null); assert.equal(artifact.pass, false);
  assert.equal(artifact.issueCodes[0].code, "quality_command_output_invalid");
});
