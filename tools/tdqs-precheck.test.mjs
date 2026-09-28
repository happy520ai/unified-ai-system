import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, writeFileSync, mkdtempSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import path from "node:path";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SCRIPT = path.join(HERE, "tdqs-precheck.mjs");
const ROOT = path.join(HERE, "..");
const SCRATCH = mkdtempSync(path.join(tmpdir(), "tdqs-precheck-"));

function run(args, env = {}) {
  return spawnSync(process.execPath, [SCRIPT, ...args], {
    encoding: "utf8",
    cwd: ROOT,
    env: { ...process.env, ...env },
    timeout: 60000,
  });
}

// A fixture server, not our product: the pre-check is only worth shipping if its own
// counting can be proven against a surface whose rows are known. Booting the real MCP
// server here would put a managed-gateway startup condition into the verdict - that is
// what made the first revision of this test red on the Windows runner for a reason that
// had nothing to do with the pre-check.
function fakeServer(name, tools) {
  const file = path.join(SCRATCH, name);
  writeFileSync(file, [
    "const tools = " + JSON.stringify(tools) + ";",
    "process.stdin.setEncoding('utf8');",
    "let buf = '';",
    "process.stdin.on('data', (c) => {",
    "  buf += c;",
    "  let nl;",
    "  while ((nl = buf.indexOf('\\n')) >= 0) {",
    "    const line = buf.slice(0, nl).trim();",
    "    buf = buf.slice(nl + 1);",
    "    if (!line) continue;",
    "    let msg;",
    "    try { msg = JSON.parse(line); } catch { continue; }",
    "    if (msg.method === 'initialize') {",
    "      console.log(JSON.stringify({ jsonrpc: '2.0', id: msg.id, result: { protocolVersion: '2025-06-18', capabilities: { tools: {} }, serverInfo: { name: 'fixture', version: '9' } } }));",
    "    } else if (msg.method === 'tools/list') {",
    "      console.log(JSON.stringify({ jsonrpc: '2.0', id: msg.id, result: { tools } }));",
    "    }",
    "  }",
    "});",
    "",
  ].join("\n"));
  return file;
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

test("counts a known surface correctly, including the row that reads as an absence", () => {
  const fixture = fakeServer("known.mjs", [
    {
      name: "documented_tool",
      title: "Documented tool",
      description: "Reads one record by id. Use `search_tools` instead when you do not know the id.",
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
      inputSchema: {
        type: "object",
        properties: { id: { type: "string", description: "the record id" }, mode: { type: "string", enum: ["a", "b"] } },
        required: ["id"],
      },
      outputSchema: { type: "object", properties: { found: { type: "boolean", description: "whether a record matched" } } },
    },
    { name: "search_tools", inputSchema: { type: "object", properties: { thing: { type: "string" } } } },
  ]);
  const out = path.join(SCRATCH, "known.json");
  const r = run(["--json", out, "--", "node", fixture]);
  assert.equal(r.status, 0, r.stderr);
  assert.match(r.stdout, /^2 tools over 1 tools\/list page/m);
  assert.match(r.stdout, /MCP display title\s+1\/2\s+50%/);
  assert.match(r.stdout, /all four annotations declared\s+1\/2\s+50%/);
  assert.match(r.stdout, /input properties documented\s+1\/3\s+33%/);
  assert.match(r.stdout, /outputSchema present\s+1\/2\s+50%/);
  assert.match(r.stdout, /description names a sibling\s+1\/2\s+50%/);
  assert.match(r.stdout, /ordering smell \("always call first"\)\s+0\/2\s+0%/);
  const a = JSON.parse(readFileSync(out, "utf8"));
  assert.equal(a.totals.tools, 2);
  assert.equal(a.tools.find((t) => t.name === "search_tools").description_chars, 0);
  assert.deepEqual(a.tools.find((t) => t.name === "documented_tool").names_sibling, ["search_tools"]);
  assert.equal(a.tools.find((t) => t.name === "documented_tool").annotations_missing.length, 0);
});

test("refuses to report on a server that exposes no tools", () => {
  const fixture = fakeServer("empty.mjs", []);
  const r = run(["--", "node", fixture]);
  assert.equal(r.status, 4);
  assert.match(r.stderr, /zero tools/);
  assert.match(r.stderr, /different fact from scoring well/);
});
