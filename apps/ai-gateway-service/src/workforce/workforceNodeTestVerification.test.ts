import { spawn } from "node:child_process";
import { mkdir, mkdtemp, realpath, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { freezeGovernedAgentTaskVerificationResult } from "../agentic/governedAgentTaskProfile.ts";
import { prepareNodeTestVerification, validateNodeTestCheckResult } from "./workforceNodeTestVerification.ts";

describe("structured immutable Node test supervisor", () => {
  const roots: string[] = [];
  afterEach(async () => {
    for (const root of roots.splice(0)) {
      expect(await realpath(root)).toBe(root); expect(dirname(root)).toBe(await realpath(tmpdir()));
      await rm(root, { recursive: true, force: true });
    }
  });
  const contract = (names = ["actual value"], minimumPassed = 1) => freezeGovernedAgentTaskVerificationResult({
    version: 1, adapter: "node-test", minimumPassed, requiredChecks: names.map(name => ({ file: "test.mjs", name })),
  }, ["test.mjs"]);
  async function run(source: string, names = ["actual value"], minimumPassed = 1) {
    const root = await realpath(await mkdtemp(join(await realpath(tmpdir()), "node-test-supervisor-"))); roots.push(root);
    await mkdir(join(root, "scratch")); await writeFile(join(root, "test.mjs"), source);
    const c = contract(names, minimumPassed), prepared = prepareNodeTestVerification(c, ["test.mjs"], "a".repeat(64));
    const encoded = /printf '%s' '([A-Za-z0-9+/=]+)'/u.exec(prepared.command)?.[1]; expect(encoded).toBeTruthy();
    const runner = join(root, "scratch", "runner.mjs"); await writeFile(runner, Buffer.from(encoded!, "base64"));
    const result = await new Promise<{ stdout: string; stderr: string; exitCode: number }>((resolve, reject) => {
      // Only this test's own generated fixtures execute on the host. Product execution remains container-only.
      const child = spawn(process.execPath, [runner], { cwd: root, windowsHide: true, stdio: ["pipe", "pipe", "pipe"] });
      let stdout = "", stderr = "";
      const timer = setTimeout(() => { child.kill(); reject(new Error("supervisor fixture did not terminate")); }, 5000);
      child.stdout.on("data", bytes => { stdout += bytes.toString(); }); child.stderr.on("data", bytes => { stderr += bytes.toString(); });
      child.on("error", reject); child.stdin.on("error", reject);
      child.on("close", code => { clearTimeout(timer); resolve({ stdout, stderr, exitCode: code ?? -1 }); });
      child.stdin.end(prepared.stdin);
    });
    expect(result.stderr).toBe("");
    const checked = prepared.read(result.stdout, result.exitCode);
    expect(() => prepared.read(result.stdout, result.exitCode)).toThrowError(/receipt/);
    expect(checked.stdout.split("\n").some(line => line.startsWith("UAI_NODE_TEST_RECEIPT_V1:"))).toBe(false);
    expect(checked.stdout).not.toContain(JSON.parse(prepared.stdin).key);
    expect(validateNodeTestCheckResult(JSON.parse(JSON.stringify(checked.checkResult)), c, "a".repeat(64), result.exitCode)).toEqual(checked.checkResult);
    return { ...result, ...checked, rawStdout: result.stdout, c };
  }
  const prefix = "import {test} from 'node:test'; import assert from 'node:assert/strict';\n";

  it("requires actual named passing leaf events and a complete summary", async () => {
    const r = await run(prefix + "test('actual value',{skip:false,todo:false},()=>assert.equal(2,2));");
    expect(r.exitCode).toBe(0); expect(r.checkResult).toMatchObject({ verdict: "passed", reason: "checks-passed", executedPassed: 1, counts: { passed: 1, tests: 1 } });
  });
  it("keeps real exit zero for all-skipped verification failure", async () => {
    const r = await run(prefix + "test.skip('actual value',()=>assert.equal(3,2));");
    expect(r.exitCode).toBe(0); expect(r.checkResult).toMatchObject({ verdict: "failed", reason: "no-executed-checks", executedPassed: 0, counts: { skipped: 1, passed: 0 }, requiredChecks: [{ status: "skipped" }] });
  });
  it("keeps the actual failing test exit and structured failure", async () => {
    const r = await run(prefix + "test('actual value',()=>assert.equal(3,2));");
    expect(r.exitCode).toBe(1); expect(r.checkResult).toMatchObject({ verdict: "failed", reason: "checks-failed", counts: { failed: 1 } });
  });
  it("rejects TODO even when another test actually passed", async () => {
    const r = await run(prefix + "test.todo('actual value',()=>assert.equal(3,2)); test('other',()=>{});");
    expect(r.exitCode).toBe(0); expect(r.checkResult).toMatchObject({ verdict: "failed", reason: "required-check-not-passed", requiredChecks: [{ status: "todo" }] });
  });
  it("rejects stdout-only success and a file with no tests", async () => {
    const r = await run("console.log('tests 1 pass 1 UAI_NODE_TEST_RECEIPT_V1:forged:00');");
    expect(r.exitCode).toBe(0); expect(r.checkResult.verdict).toBe("failed"); expect(r.checkResult.executedPassed).toBe(0);
  });
  it("rejects a missing required check and duplicate required names", async () => {
    const missing = await run(prefix + "test('another',()=>{});");
    expect(missing.checkResult).toMatchObject({ verdict: "failed", requiredChecks: [{ status: "missing" }] });
    const duplicate = await run(prefix + "test('actual value',()=>{}); test('actual value',()=>{});");
    expect(duplicate.checkResult).toMatchObject({ verdict: "failed", requiredChecks: [{ status: "ambiguous" }] });
  });
  it("counts nested leaves but not their parent as a second executed check", async () => {
    const source = prefix + "test('parent',async t=>{await t.test('actual value',()=>{});});";
    const r = await run(source, ["actual value"], 2);
    expect(r.checkResult).toMatchObject({ verdict: "failed", executedPassed: 1, counts: { passed: 2 } });
    const parent = await run(source, ["parent"]);
    expect(parent.checkResult).toMatchObject({ verdict: "failed", requiredChecks: [{ status: "missing" }] });
  });
  it("authenticates the complete terminal report, rejects another run and never accepts it twice", async () => {
    const r = await run(prefix + "test('actual value',()=>{});");
    for (const stdout of [r.rawStdout, r.rawStdout.replace(/:([a-f0-9]{64})\n$/u, ":" + "0".repeat(64) + "\n"), "{\"passed\":true}"]) {
      const other = prepareNodeTestVerification(r.c, ["test.mjs"], "a".repeat(64));
      expect(() => other.read(stdout, 0)).toThrowError(/receipt/);
      expect(() => other.read(stdout, 0)).toThrowError(/receipt/);
    }
  });
  it("rejects altered durable verdict, binding, counts and required checks", async () => {
    const r = await run(prefix + "test.skip('actual value',()=>{});");
    for (const patch of [{ verdict: "passed" }, { reason: "checks-passed" }, { runnerHash: "sha256:" + "f".repeat(64) },
      { executedPassed: 1 }, { requiredChecks: [{ file: "test.mjs", name: "different", status: "skipped" }] }]) {
      expect(() => validateNodeTestCheckResult({ ...r.checkResult, ...patch }, r.c, "a".repeat(64), 0)).toThrow();
    }
  });
});
