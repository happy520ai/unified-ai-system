import assert from "node:assert/strict";
import test from "node:test";
import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { runStages, testCounts, validationEnvironment } from "./verify-windows.mjs";
import { REPO_ROOT } from "./check-critical-js.mjs";

test("validation child environment excludes account/provider settings and isolates user paths", () => {
  const env = validationEnvironment({ Path: "test-path", SystemRoot: "C:\\Windows",
    OPENAI_API_KEY: "synthetic-secret", NODE_OPTIONS: "--require unsafe", HOME: "actual-home" }, "test-home", "test-temp");
  assert.equal(env.PATH, "test-path"); assert.equal(env.HOME, "test-home");
  assert.equal(env.TEMP, "test-temp"); assert.equal(env.AI_GATEWAY_REAL_PROVIDER_ENABLED, "false");
  assert.equal(env.OPENAI_API_KEY, undefined); assert.equal(env.NODE_OPTIONS, undefined);
  const source = { PATH: "safe-path" };
  Object.defineProperty(source, "PRIVATE_TOKEN", { enumerable: true, get() { throw new Error("secret must not be read"); } });
  assert.equal(validationEnvironment(source, "home", "temp").PATH, "safe-path");
});

test("partial test skips are preserved and cannot be counted as passes", () => {
  assert.deepEqual(testCounts("vitest", JSON.stringify({ numTotalTests: 4, numPassedTests: 2,
    numFailedTests: 0, numPendingTests: 1, numTodoTests: 1 })), { total: 4, passed: 2, failed: 0, skipped: 2 });
  assert.deepEqual(testCounts("tap", "# tests 3\n# pass 2\n# fail 0\n# skipped 1\n# todo 0\n"),
    { total: 3, passed: 2, failed: 0, skipped: 1 });
  assert.throws(() => testCounts("vitest", "{}"), /missing/);
  assert.throws(() => testCounts("tap", ""), /missing/);
});

test("failure keeps later commands not-run and checkpoints incomplete work as failed", () => {
  const snapshots = []; let calls = 0;
  const results = runStages([{ id: "one", kind: "check" }, { id: "two", kind: "check" }], () => {
    calls++; return { exitCode: 1, output: "synthetic failure" };
  }, records => snapshots.push(structuredClone(records)));
  assert.equal(calls, 1);
  assert.equal(snapshots[0][0].reason, "completion_not_confirmed");
  assert.equal(results[0].status, "failed");
  assert.equal(results[1].status, "not_run");
  assert.equal(results[1].reason, "prior_stage_not_passed");
});

test("all-skipped or missing test results never become successful validation", () => {
  for (const output of [JSON.stringify({ numTotalTests: 2, numPassedTests: 0, numFailedTests: 0, numPendingTests: 2 }), "invalid"]) {
    const results = runStages([{ id: "tests", kind: "vitest" }, { id: "next", kind: "check" }], () => ({ exitCode: 0, output }));
    assert.notEqual(results[0].status, "passed");
    assert.equal(results[1].status, "not_run");
  }
});

test("test failures and interrupted processes remain failures", () => {
  const failureJson = JSON.stringify({ numTotalTests: 1, numPassedTests: 0, numFailedTests: 1 });
  const [failed] = runStages([{ id: "tests", kind: "vitest" }], () => ({ exitCode: 0,
    output: failureJson }));
  assert.equal(failed.status, "failed");
  const [nonzero] = runStages([{ id: "tests", kind: "vitest" }], () => ({ exitCode: 1, output: failureJson }));
  assert.equal(nonzero.status, "failed"); assert.equal(nonzero.counts.failed, 1);
  const [frameworkFailure] = runStages([{ id: "tests", kind: "vitest" }], () => ({ exitCode: 0,
    output: JSON.stringify({ success: false, numTotalTests: 1, numPassedTests: 1, numFailedTests: 0 }) }));
  assert.equal(frameworkFailure.status, "failed");
  const [interrupted] = runStages([{ id: "check", kind: "check" }], () => ({ exitCode: -1, interrupted: true }));
  assert.equal(interrupted.status, "failed");
  assert.equal(interrupted.cleanupUnconfirmed, true);
  const [uncertainSuccess] = runStages([{ id: "check", kind: "check" }], () => ({ exitCode: 0, interrupted: true }));
  assert.equal(uncertainSuccess.status, "failed");
});

test("an explicit suite worker limit is applied and invalid limits fail configuration", () => {
  const env = validationEnvironment(process.env, REPO_ROOT, REPO_ROOT);
  const args = ["--input-type=module", "-e", "import c from './vitest.config.js'; console.log(c.test.maxWorkers)"];
  const valid = spawnSync(process.execPath, args, { cwd: REPO_ROOT, env: { ...env, AI_GATEWAY_TEST_MAX_WORKERS: "2" },
    encoding: "utf8", timeout: 10000, windowsHide: true });
  assert.equal(valid.status, 0); assert.equal(valid.stdout.trim(), "2");
  const invalid = spawnSync(process.execPath, args, { cwd: REPO_ROOT, env: { ...env, AI_GATEWAY_TEST_MAX_WORKERS: "0" },
    encoding: "utf8", timeout: 10000, windowsHide: true });
  assert.notEqual(invalid.status, 0);
  assert.match(invalid.stderr, /must be an integer from 1 to 8/);
});

test("Vitest selects the requested workspace test without its evidence copy", () => {
  const evidenceRoot = realpathSync(join(REPO_ROOT, "apps/ai-gateway-service/evidence"));
  const fixtureRoot = mkdtempSync(join(evidenceRoot, "test-discovery-"));
  const selected = "apps/ai-gateway-service/src/capabilities/localClientWindowsAuthorityNative.test.ts";
  const copy = join(fixtureRoot, selected);
  const output = join(fixtureRoot, "selected.json");
  try {
    mkdirSync(dirname(copy), { recursive: true });
    writeFileSync(copy, "throw new Error('An evidence copy must never be imported as a workspace test');\n");
    const env = validationEnvironment(process.env, fixtureRoot, fixtureRoot);
    const listed = spawnSync(process.execPath, ["node_modules/vitest/vitest.mjs", "list", "--filesOnly", `--json=${output}`, selected],
      { cwd: REPO_ROOT, env, encoding: "utf8", timeout: 10000, windowsHide: true });
    assert.equal(listed.status, 0, listed.stderr || listed.stdout);
    const files = JSON.parse(readFileSync(output, "utf8")).map(item => item.file.replaceAll("\\", "/"));
    assert.deepEqual(files, [join(REPO_ROOT, selected).replaceAll("\\", "/")]);
  } finally {
    assert.equal(realpathSync(fixtureRoot), fixtureRoot);
    assert.equal(dirname(fixtureRoot), evidenceRoot);
    rmSync(fixtureRoot, { recursive: true, force: true });
  }
});
