// Build one machine-readable dataset from the MCP ecosystem surveys in MEASUREMENT_QUESTIONS.
// The list is the source of truth for how many questions there are; nothing here pins a count, so a
// published survey that is missing from the list shows up as coverage, not as a stale comment.
//
// Rationale: the numbers in docs/mcp-ecosystem-measurements.html are prose over tables, and prose has
// already drifted from its own table once (#180). This artifact is generated, not written, and every
// question's verdict tally is asserted against its own rows by tools/mcp-measurement-guard.mjs before
// anything is emitted.
//
// Usage: node tools/build-mcp-measurement-dataset.mjs [limit] [outFile]
// Partial results land in <outFile>.parts/ so a killed run still leaves evidence.
import { spawnSync } from "node:child_process";
import { mkdirSync, writeFileSync, renameSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { join } from "node:path";

import { evaluateQuestion, MEASUREMENT_QUESTIONS } from "./mcp-measurement-guard.mjs";

const LIMIT = Number(process.argv[2] || 40);
const OUT = resolve(process.argv[3] || "docs/data/mcp-ecosystem-measurements.json");
const PARTS = `${OUT}.parts`;
mkdirSync(dirname(OUT), { recursive: true });
mkdirSync(PARTS, { recursive: true });

const started = new Date().toISOString();
const parts = [];
const failures = [];

for (const q of MEASUREMENT_QUESTIONS) {
  process.stderr.write(`running ${q.script} ${LIMIT}\n`);
  const r = spawnSync("node", [q.script, String(LIMIT), ...(q.args ?? [])], { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
  const out = `${r.stdout ?? ""}`.trim();
  if (r.status !== 0 || !out) {
    failures.push({ id: q.id, status: "script_failed", stderr: `exit=${r.status} ${String(r.stderr ?? "").slice(0, 160)}` });
    continue;
  }
  let data;
  try {
    data = JSON.parse(out.slice(out.indexOf("{")));
  } catch (e) {
    failures.push({ id: q.id, status: "unparseable", stderr: String(e.message).slice(0, 160) });
    continue;
  }
  const { block, failure } = evaluateQuestion(q, data);
  if (failure) {
    failures.push(failure);
    process.stderr.write(`  refused ${failure.id}: ${failure.status} :: ${failure.stderr}\n`);
    continue;
  }
  writeFileSync(join(PARTS, `${q.id}.json`), JSON.stringify(block, null, 1), "utf8");
  parts.push(block);
  process.stderr.write(`  ok attempted=${block.attempted} label=${block.row_label_field} verdicts=${JSON.stringify(block.verdicts).slice(0, 110)}\n`);
}

const dataset = {
  dataset_version: "uai.mcp-measurements/v1",
  generated_at_start_utc: started,
  generated_at_end_utc: new Date().toISOString(),
  producer: "https://github.com/happy520ai/unified-ai-system",
  license: "Apache-2.0",
  sample: {
    source: "https://registry.modelcontextprotocol.io/v0/servers",
    selection: "first records in the registry's default order, keeping unique https streamable-http remote URLs",
    limit: LIMIT,
    bias: "Not random. The registry's default order is alphabetical by server identifier, so the sample over-represents names beginning with 'a'. A re-run is a new measurement, not a regression test: these servers deploy.",
    transport_coverage: "streamable-http remote endpoints only; the stdio population is larger and unreachable by this method",
    max_requests_per_server: 3,
    credentials_used: false,
    writes_performed: false,
    no_response_text_recorded: true,
  },
  questions: parts,
  incomplete: failures,
};

if (parts.length !== MEASUREMENT_QUESTIONS.length) {
  writeFileSync(`${OUT}.partial.json`, JSON.stringify(dataset, null, 1), "utf8");
  console.error(`REFUSED to write the live dataset: ${parts.length}/${MEASUREMENT_QUESTIONS.length} questions succeeded. See ${OUT}.partial.json :: ${JSON.stringify(failures).slice(0, 500)}`);
  process.exit(1);
}

writeFileSync(`${OUT}.tmp`, JSON.stringify(dataset, null, 1), "utf8");
renameSync(`${OUT}.tmp`, OUT);
console.log(`WROTE ${OUT} questions=${parts.length} rows=${parts.reduce((a, p) => a + p.rows.length, 0)}`);
console.log(`SUMMARY ${parts.map((p) => `${p.id}:${p.attempted}`).join(" ")}`);
