#!/usr/bin/env node
// tdqs-precheck - the deterministic part of the Tool Definition Quality Score,
// run locally against any MCP server over stdio.
//
// This is NOT a TDQS score. Stage 3 of the pipeline is an LLM rubric call, so the
// graded dimensions (Purpose Clarity, Usage Guidelines, Conciseness, Behavioral
// Transparency) are not computed here. What this reports is the set of rows the
// spec's own "Improving your score" checklist makes mechanically checkable: the
// fields a maintainer can verify without a judge, from exactly the bytes a client
// gets out of tools/list.
//
// Usage:
//   node tdqs-precheck.mjs [--json artifact.json] -- <server command> [args...]
//
// Zero dependencies, Node >= 18. No network access; the only process it talks to
// is the server you asked it to start.

import { spawn } from "node:child_process";
import { writeFileSync } from "node:fs";

const ANNOTATIONS = ["readOnlyHint", "destructiveHint", "idempotentHint", "openWorldHint"];
// "always call this first" is what the spec calls a priority rather than a boundary:
// "a boundary is describable; a priority is not".
const ORDERING_SMELL = /\b(always call|call this first|before (?:using|calling)|first use|do not compute)\b/i;
const WHEN_SHAPE = /\b(when|if you|use this|for )\b/i;
const HANDSHAKE_TIMEOUT = Number(process.env.TDQS_TIMEOUT_MS || 30000);

const argv = process.argv.slice(2);
const sep = argv.indexOf("--");
if (sep < 0 || sep === argv.length - 1) {
  console.error("usage: node tdqs-precheck.mjs [--json out.json] -- <command> [args...]");
  console.error("example: node tdqs-precheck.mjs -- npx -y @modelcontextprotocol/server-filesystem .");
  process.exit(2);
}
const opts = argv.slice(0, sep);
const cmd = argv[sep + 1];
const cmdArgs = argv.slice(sep + 2);
const jsonAt = opts.indexOf("--json");
const jsonOut = jsonAt >= 0 ? opts[jsonAt + 1] : null;

function ask(child) {
  const pending = new Map();
  let buf = "";
  let id = 0;
  child.stdout.on("data", (chunk) => {
    buf += chunk.toString("utf8");
    let nl;
    while ((nl = buf.indexOf("\n")) >= 0) {
      const line = buf.slice(0, nl).trim();
      buf = buf.slice(nl + 1);
      if (!line) continue;
      let msg;
      try {
        msg = JSON.parse(line);
      } catch {
        continue;
      }
      if (msg.id !== undefined && pending.has(msg.id)) {
        pending.get(msg.id)(msg);
        pending.delete(msg.id);
      }
    }
  });
  const send = (method, params, notify) => {
    const msg = notify ? { jsonrpc: "2.0", method, params } : { jsonrpc: "2.0", id: ++id, method, params };
    child.stdin.write(JSON.stringify(msg) + "\n");
    if (notify) return Promise.resolve(null);
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        pending.delete(msg.id);
        reject(new Error(`${method} did not answer within ${HANDSHAKE_TIMEOUT} ms`));
      }, HANDSHAKE_TIMEOUT);
      pending.set(msg.id, (res) => {
        clearTimeout(timer);
        resolve(res);
      });
    });
  };
  return { send };
}

function walkSchema(schema, out) {
  if (!schema || typeof schema !== "object") return;
  const props = schema.properties;
  if (props && typeof props === "object") {
    for (const [name, child] of Object.entries(props)) {
      out.total += 1;
      if (child && typeof child === "object" && typeof child.description === "string" && child.description.trim()) out.documented += 1;
      if (child && Array.isArray(child.enum) && child.enum.length) out.withEnum += 1;
      if (child && typeof child === "object") walkSchema(child, out);
    }
  }
  if (schema.items && typeof schema.items === "object") walkSchema(schema.items, out);
}

function inspect(tool, siblings) {
  const text = typeof tool.description === "string" ? tool.description : "";
  const input = { total: 0, documented: 0, withEnum: 0 };
  walkSchema(tool.inputSchema, input);
  const output = { total: 0, documented: 0, withEnum: 0 };
  walkSchema(tool.outputSchema, output);
  const ann = tool.annotations && typeof tool.annotations === "object" ? tool.annotations : {};
  const declared = ANNOTATIONS.filter((k) => typeof ann[k] === "boolean");
  return {
    name: tool.name,
    has_title: typeof tool.title === "string" && tool.title.trim().length > 0,
    description_chars: text.length,
    annotations_declared: declared,
    annotations_missing: ANNOTATIONS.filter((k) => !declared.includes(k)),
    input_properties_total: input.total,
    input_properties_documented: input.documented,
    input_with_enum: input.withEnum,
    output_schema_present: Boolean(tool.outputSchema),
    output_schema_bare: Boolean(tool.outputSchema) && tool.outputSchema.type === "object" && output.total === 0,
    output_properties_documented: output.documented,
    names_sibling: siblings.filter((n) => n !== tool.name && text.includes(n)),
    mentions_when_shape: WHEN_SHAPE.test(text),
    ordering_smell: ORDERING_SMELL.test(text),
  };
}

const child = spawn(cmd, cmdArgs, { stdio: ["pipe", "pipe", "pipe"] });
let stderrTail = "";
child.stderr.on("data", (c) => {
  stderrTail = (stderrTail + c.toString("utf8")).slice(-4000);
});
const rpc = ask(child);

let tools = [];
let pages = 0;
let serverInfo = null;
try {
  const init = await rpc.send("initialize", {
    protocolVersion: "2025-06-18",
    capabilities: {},
    clientInfo: { name: "tdqs-precheck", version: "0.1.0" },
  });
  if (init.error) throw new Error(`initialize returned an error: ${JSON.stringify(init.error)}`);
  serverInfo = init.result?.serverInfo || null;
  await rpc.send("notifications/initialized", {}, true);
  let cursor = null;
  do {
    pages += 1;
    const res = await rpc.send("tools/list", cursor ? { cursor } : {});
    if (res.error) throw new Error(`tools/list returned an error: ${JSON.stringify(res.error)}`);
    if (!Array.isArray(res.result?.tools)) {
      throw new Error(`tools/list result has no array under "tools" (keys: ${Object.keys(res.result || {}).join(", ") || "none"})`);
    }
    tools.push(...res.result.tools);
    cursor = res.result.nextCursor || null;
    if (pages > 200) throw new Error("refusing to walk more than 200 tools/list pages");
  } while (cursor);
} catch (err) {
  console.error(`REFUSED: ${err.message}`);
  if (stderrTail.trim()) console.error(`server stderr (last 4000 chars):\n${stderrTail}`);
  child.kill("SIGTERM");
  process.exit(3);
}
child.kill("SIGTERM");

if (tools.length === 0) {
  console.error("REFUSED: the server answered tools/list with zero tools. A server that exposes no");
  console.error("tools has no tool definitions to score, which is a different fact from scoring well.");
  process.exit(4);
}
const names = tools.map((t) => t?.name);
if (names.some((n) => typeof n !== "string" || !n.trim())) {
  console.error(`REFUSED: ${names.filter((n) => !n).length} of ${names.length} served tools have no usable name.`);
  process.exit(5);
}

const rows = tools.map((t) => inspect(t, [...new Set(names)]));
const n = rows.length;
const count = (pred) => rows.filter(pred).length;
const sum = (k) => rows.reduce((a, r) => a + r[k], 0);
const totals = {
  tools: n,
  pages,
  with_description: count((r) => r.description_chars > 0),
  with_title: count((r) => r.has_title),
  all_four_annotations: count((r) => r.annotations_declared.length === 4),
  no_annotations: count((r) => r.annotations_declared.length === 0),
  input_properties_total: sum("input_properties_total"),
  input_properties_documented: sum("input_properties_documented"),
  output_schema_present: count((r) => r.output_schema_present),
  output_schema_bare: count((r) => r.output_schema_bare),
  names_a_sibling: count((r) => r.names_sibling.length > 0),
  mentions_when_shape: count((r) => r.mentions_when_shape),
  ordering_smell: count((r) => r.ordering_smell),
};

const artifact = {
  producer: "tdqs-precheck",
  rubric: "Tool Definition Quality Score, deterministic stages only (stage 3 is an LLM call and was not run)",
  server: serverInfo,
  command: [cmd, ...cmdArgs].join(" "),
  checked_at: new Date().toISOString(),
  totals,
  tools: rows,
};
if (jsonOut) writeFileSync(jsonOut, JSON.stringify(artifact, null, 2) + "\n");

const pct = (frac) => `${Math.round(100 * frac)}%`;
const line = (label, value, of, note) =>
  console.log(`  ${String(label).padEnd(34)} ${String(`${value}/${of}`).padStart(9)}  ${pct(value / of).padStart(4)}   ${note}`);

console.log(`\ntdqs-precheck - ${artifact.command}`);
console.log(`server: ${serverInfo ? `${serverInfo.name} ${serverInfo.version || ""}`.trim() : "(none reported)"}`);
console.log(`${n} tools over ${pages} tools/list page(s). Deterministic rows only - not a TDQS score.\n`);
line("description exists", totals.with_description, n, 'the "primary scoring target"');
line("MCP display title", totals.with_title, n, "optional");
line("all four annotations declared", totals.all_four_annotations, n, "checklist item 3");
line("tools with no annotations", totals.no_annotations, n, "the disclosure burden stays on prose");
line("input properties documented", totals.input_properties_documented, totals.input_properties_total || 0, "checklist item 4, raises the floor to 3");
line("outputSchema present", totals.output_schema_present, n, "checklist item 5");
line("outputSchema bare", totals.output_schema_bare, n, 'a bare {"type":"object"} earns nothing');
line("description names a sibling", totals.names_a_sibling, n, "checklist item 1, marks a boundary");
line("when/if/for phrasing (proxy)", totals.mentions_when_shape, n, "approximates item 2, does not grade it");
line('ordering smell ("always call first")', totals.ordering_smell, n, "a tool-set defect, not a description one");
console.log("\nNot measured here: the four graded dimensions, which need the evaluator. See the spec.");
if (jsonOut) console.log(`artifact: ${jsonOut}`);
