import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SCRIPT = path.join(HERE, "tdqs-precheck.mjs");
const ROOT = path.join(HERE, "..");
const ARTIFACT = path.join(ROOT, "docs", "data", "mcp-tool-definition-quality.2026-09-28.json");

function run(args, env = {}) {
  return spawnSync(process.execPath, [SCRIPT, ...args], {
    encoding: "utf8",
    cwd: ROOT,
    env: { ...process.env, ...env },
    timeout: 170000,
  });
}

test("refuses rather than inventing a command to score", () => {
  const r = run([]);
  assert.equal(r.status, 2);
  assert.match(r.stderr, /usage: node tdqs-precheck\.mjs/);
});

test("refuses when the server never answers the handshake", () => {
  const r = run(["--", "node", "-e", "setTimeout(()=>{},9000)"], { TDQS_TIMEOUT_MS: "1500" });
  assert.equal(r.status, 3);
  assert.match(r.stderr, /REFUSED: initialize did not answer within/);
});

test("refuses when the server answers with a JSON-RPC error", () => {
  const r = run(["--", "node", "-e", "process.stdin.on('data',()=>console.log(JSON.stringify({jsonrpc:'2.0',id:1,error:{code:-32601,message:'Method not found'}})))"], { TDQS_TIMEOUT_MS: "3000" });
  assert.equal(r.status, 3);
  assert.match(r.stderr, /initialize returned an error/);
});

// The budget here is deliberately far above the measured cost. Cold initialize for this
// server is 6.4-8.9 s on a quiet machine (docs/mcp-startup-timeouts.html, 23 runs), but the
// first CI run of this test exceeded the tool's own 30 s default on a Windows runner that
// was executing the rest of the suite alongside it - the same load sensitivity that makes
// gate 4's 30 s stdio budget red under concurrency. A tight budget here would measure the
// runner, not the server.
test("reads our own served surface over stdio and agrees with the in-process audit", { timeout: 180000 }, () => {
  const r = run(["--", "node", "./packages/mcp-server/src/index.js"], { TDQS_TIMEOUT_MS: "150000" });
  assert.equal(r.status, 0, r.stderr);
  const m = r.stdout.match(/^(\d+) tools over (\d+) tools\/list page/m);
  assert.ok(m, `no tool count line in:\n${r.stdout}`);
  const shipped = JSON.parse(readFileSync(ARTIFACT, "utf8"));
  assert.equal(Number(m[1]), shipped.tool_count, "the stdio pre-check and the HTTP audit disagree about how many tools we serve");
  const params = r.stdout.match(/input properties documented\s+(\d+)\/(\d+)/);
  assert.ok(params, `no parameter row in:\n${r.stdout}`);
  assert.equal(Number(params[1]), shipped.totals.input_properties_documented, "documented parameter count disagrees between the two transports");
  assert.equal(Number(params[2]), shipped.totals.input_properties_total, "parameter denominator disagrees between the two transports");
  assert.match(r.stdout, /not a TDQS score/);
});
