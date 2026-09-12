import assert from "node:assert/strict";
import test from "node:test";
import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve, sep } from "node:path";
import { runCommand } from "./quality-scorecard.mjs";
import {
  QUALITY_STAGE_TIMEOUT_MS,
  QUALITY_ARTIFACT_VERIFY_TIMEOUT_MS,
  QUALITY_SCORECARD_TIMEOUT_MS,
  QUALITY_CI_TIMEOUT_MS,
} from "./quality-command-budgets.mjs";

function fixture(t) {
  const temporaryRoot = resolve(tmpdir());
  const directory = mkdtempSync(join(temporaryRoot, "uai-quality-runtime-"));
  const script = join(directory, "child.mjs");
  writeFileSync(script, `
    const mode = process.argv[2];
    if (mode === "json") console.log(JSON.stringify({ ok: true, fixture: true }));
    else if (mode === "nonzero") {
      console.error(JSON.stringify({ ok: false, fixture: true }));
      process.exitCode = 7;
    } else if (mode === "timeout") setInterval(() => {}, 1000);
  `);
  t.after(() => {
    assert.ok(resolve(directory).startsWith(temporaryRoot + sep));
    rmSync(directory, { recursive: true, force: true });
  });
  return { directory, script };
}

test("importing the scorecard exposes its helper without running product checks", () => {
  const moduleUrl = new URL("./quality-scorecard.mjs", import.meta.url).href;
  const child = spawnSync(process.execPath, ["--input-type=module", "-e",
    `const scorecard = await import(${JSON.stringify(moduleUrl)}); console.log(typeof scorecard.runCommand);`],
  { encoding: "utf8", timeout: 10_000, windowsHide: true });
  assert.equal(child.status, 0);
  assert.equal(child.stdout.trim(), "function");
  assert.equal(child.stderr, "");
});

test("a successful Node child keeps its JSON and exit status", (t) => {
  const { script } = fixture(t);
  const result = runCommand("fixture-json", "node", [script, "json"]);
  assert.equal(result.ok, true);
  assert.equal(result.status, 0);
  assert.equal(result.timedOut, false);
  assert.deepEqual(result.parseableOutput, { ok: true, fixture: true });
});

test("a nonzero Node child remains a failure with parseable diagnostics", (t) => {
  const { script } = fixture(t);
  const result = runCommand("fixture-nonzero", "node", [script, "nonzero"]);
  assert.equal(result.ok, false);
  assert.equal(result.status, 7);
  assert.equal(result.timedOut, false);
  assert.deepEqual(result.parseableOutput, { ok: false, fixture: true });
});

test("a timed out real child preserves the spawn timeout and interruption", (t) => {
  const { script } = fixture(t);
  const result = runCommand("fixture-timeout", "node", [script, "timeout"], { timeoutMs: 100 });
  assert.equal(result.ok, false);
  assert.equal(result.timedOut, true);
  assert.equal(result.errorCode, "ETIMEDOUT");
  assert.equal(result.timeoutMs, 100);
  assert.notEqual(result.status, 0);
  assert.ok(result.signal !== null || result.status !== null);
});

test("a spawn failure stays distinct from a timed out child", (t) => {
  const { directory } = fixture(t);
  const result = runCommand("fixture-missing", join(directory, "missing-executable"), []);
  assert.equal(result.ok, false);
  assert.equal(result.status, null);
  assert.equal(result.timedOut, false);
  assert.equal(result.errorCode, "ENOENT");
  assert.equal(result.signal, null);
});

test("parent budgets include every unchanged child limit and reporting time", () => {
  assert.deepEqual(QUALITY_STAGE_TIMEOUT_MS, {
    publicRepo: 180_000, publicClone: 300_000, supplyChain: 120_000,
    vision: 120_000, recoveryDrill: 60_000,
  });
  assert.ok(Object.isFrozen(QUALITY_STAGE_TIMEOUT_MS));
  assert.equal(QUALITY_SCORECARD_TIMEOUT_MS, 810_000);
  assert.equal(QUALITY_SCORECARD_TIMEOUT_MS,
    Object.values(QUALITY_STAGE_TIMEOUT_MS).reduce((total, limit) => total + limit, 30_000));
  assert.equal(QUALITY_ARTIFACT_VERIFY_TIMEOUT_MS, 30_000);
  assert.equal(QUALITY_CI_TIMEOUT_MS, 930_000);
  assert.equal(QUALITY_CI_TIMEOUT_MS, QUALITY_SCORECARD_TIMEOUT_MS
    + QUALITY_STAGE_TIMEOUT_MS.recoveryDrill + QUALITY_ARTIFACT_VERIFY_TIMEOUT_MS + 30_000);
  assert.ok(QUALITY_CI_TIMEOUT_MS < 30 * 60_000);
});
