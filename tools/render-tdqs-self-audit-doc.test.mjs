import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, writeFileSync, mkdtempSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import path from "node:path";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const RENDERER = path.join(HERE, "render-tdqs-self-audit-doc.mjs");
const AUDIT = path.join(HERE, "audit-tool-definition-quality.mjs");
const SHIPPED_MD = path.join(HERE, "..", "docs", "mcp-tool-definition-quality.md");
const ARTIFACT = path.join(HERE, "..", "docs", "data", "mcp-tool-definition-quality.2026-09-28.json");

// Scratch goes under os.tmpdir(), not the repo's .tmp/: that directory is gitignored,
// so it does not exist in a fresh clone and a write into it is ENOENT rather than a
// test result.
const SCRATCH = mkdtempSync(path.join(tmpdir(), "tdqs-test-"));
const scratch = (name) => path.join(SCRATCH, name);

function renderFrom(mutate) {
  const a = JSON.parse(readFileSync(ARTIFACT, "utf8"));
  if (mutate) mutate(a);
  const art = scratch("artifact.json");
  writeFileSync(art, JSON.stringify(a));
  return spawnSync(process.execPath, [RENDERER, "--artifact", art, "--out", scratch("out.md")], { encoding: "utf8" });
}

// Deliberately absent, and recorded rather than forgotten: an earlier revision of this
// file also booted the real server to exercise the audit's --tamper-blind arm. It passed
// locally and failed on the Windows CI runner, because startMcpHttpServer spawns a managed
// gateway that never binds there - runtime.js:190 raised "Gateway did not become ready for
// MCP within 30 seconds (attempts=118, connect-refused=118)", i.e. 118 refusals and zero
// accepts, which is "never listened" rather than "slow to listen". A CI test whose verdict
// is that condition would teach everyone to ignore a red windows-boundaries job. The arm is
// still real and still runnable by hand: node tools/audit-tool-definition-quality.mjs
// /tmp/x.json --tamper-blind exits 3, observed 2026-09-28.
test("the audit refuses before it boots anything when given no artifact path", () => {
  const r = spawnSync(process.execPath, [AUDIT], { encoding: "utf8", cwd: path.join(HERE, ".."), timeout: 60000 });
  assert.equal(r.status, 2);
  assert.match(r.stderr, /usage: node tools\/audit-tool-definition-quality\.mjs/);
});

test("renders the shipped article byte-for-byte from the shipped artifact", () => {
  const art = scratch("copy.json");
  writeFileSync(art, readFileSync(ARTIFACT, "utf8"));
  const r = spawnSync(process.execPath, [RENDERER, "--artifact", art, "--out", scratch("render.md")], { encoding: "utf8" });
  assert.equal(r.status, 0, r.stderr);
  assert.equal(
    readFileSync(scratch("render.md"), "utf8"),
    readFileSync(SHIPPED_MD, "utf8"),
    "the published page is not what the renderer produces from its artifact",
  );
});

test("every ratio in the table is derived from the rows, not typed", () => {
  const md = readFileSync(SHIPPED_MD, "utf8");
  const a = JSON.parse(readFileSync(ARTIFACT, "utf8"));
  const n = a.tool_count;
  assert.equal(n, a.tools.length);
  assert.match(md, new RegExp(`\\| a description that exists \\| ${a.totals.with_description}/${n}`));
  assert.match(md, new RegExp(`\\| every parameter documented \\| ${a.totals.input_properties_documented}/${a.totals.input_properties_total}`));
  assert.match(md, new RegExp(`\\| a documented output schema \\| ${a.totals.output_schema_present}/${n}`));
  assert.match(md, new RegExp(`\\| an ordering smell \\("always call this first"\\) \\| ${a.totals.ordering_smell}/${n}`));
});

test("refuses when an aggregate disagrees with the rows it claims to sum", () => {
  const r = renderFrom((a) => { a.totals.all_four_annotations -= 1; });
  assert.equal(r.status, 3);
  assert.match(r.stderr, /totals\.all_four_annotations says .* but its rows sum to/);
});

test("refuses a truncated tools/list walk instead of calling a prefix the surface", () => {
  const r = renderFrom((a) => { a.cursor_exhausted = false; });
  assert.equal(r.status, 3);
  assert.match(r.stderr, /did not report an exhausted cursor/);
});

test("refuses when the served count is not the count this repository publishes", () => {
  const r = renderFrom((a) => { a.expected_count = a.tool_count + 1; });
  assert.equal(r.status, 3);
  assert.match(r.stderr, /the published claim is/);
});

test("the page names its own limit: no TDQS score is claimed anywhere", () => {
  const md = readFileSync(SHIPPED_MD, "utf8");
  assert.match(md, /It is not a TDQS score and does not predict one/);
  assert.match(md, /nothing here triggers Glama's evaluation/);
  assert.doesNotMatch(md, /our TDQS score|we score [A-D]|TDQS grade of/);
  assert.match(md, /It is not the graded "Usage/);
});
