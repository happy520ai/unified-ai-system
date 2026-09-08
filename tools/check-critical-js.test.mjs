import assert from "node:assert/strict";
import test from "node:test";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { checkCriticalJs } from "./check-critical-js.mjs";

test("detects the original vm failure, unbound shorthand and broken exports without executing code", async () => {
  const root = await mkdtemp(join(tmpdir(), "critical-js-binding-"));
  try {
    const sources = {
      "bad.js": "export async function run() { return vm.createContext({}); }",
      "shorthand.js": "export const value = {missingValue};",
      "exports.js": "import { missingExport } from './good.js'; export const value = missingExport;",
      "good.js": "export function bind(vm) { return vm.value; } globalThis.__criticalJsExecuted = true;",
    };
    await Promise.all(Object.entries(sources).map(([name, text]) => writeFile(join(root, name), text)));
    const report = checkCriticalJs(Object.keys(sources), root);
    assert.equal(report.status, "failed");
    assert.ok(report.diagnostics.some(item => item.file === "bad.js" && item.code === 2304));
    assert.ok(report.diagnostics.some(item => item.file === "shorthand.js" && item.code === 18004));
    assert.ok(report.diagnostics.some(item => item.file === "exports.js" && item.code === 2305));
    assert.ok(!report.diagnostics.some(item => item.file === "good.js"));
    assert.equal(globalThis.__criticalJsExecuted, undefined);
  } finally { await rm(root, { recursive: true, force: true }); }
});

test("missing or empty scope cannot produce a passing check", () => {
  assert.throws(() => checkCriticalJs([]), /empty/);
  assert.throws(() => checkCriticalJs(["missing-critical-source.js"]), /missing/);
});
