import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const RENDERER = path.join(HERE, "render-tdqs-self-audit-doc.mjs");
const AUDIT = path.join(HERE, "audit-tool-definition-quality.mjs");
const SHIPPED_MD = path.join(HERE, "..", "docs", "mcp-tool-definition-quality.md");
const ARTIFACT = path.join(HERE, "..", "docs", "data", "mcp-tool-definition-quality.2026-09-28.json");

function render(artifact, out) {
  writeFileSync(artifact, JSON.stringify(JSON.parse(readFileSync(ARTIFACT, "utf8")), null, 2));
  const r = spawnSync(process.execPath, [RENDERER, "--artifact", artifact, "--out", out], { encoding: "utf8" });
  return r;
}

test("renders the shipped article byte-for-byte from the shipped artifact", () => {
  const tmp = path.join(HERE, "..", ".tmp", "tdqs-test-render.md");
  const r = render(path.join(HERE, "..", ".tmp", "tdqs-test-copy.json"), tmp);
  assert.equal(r.status, 0, r.stderr);
  assert.equal(readFileSync(tmp, "utf8"), readFileSync(SHIPPED_MD, "utf8"), "the published page is not what the renderer produces from its artifact");
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
  const bad = JSON.parse(readFileSync(ARTIFACT, "utf8"));
  bad.totals.all_four_annotations -= 1;
  const art = path.join(HERE, "..", ".tmp", "tdqs-bad-totals.json");
  writeFileSync(art, JSON.stringify(bad));
  const r = spawnSync(process.execPath, [RENDERER, "--artifact", art, "--out", path.join(HERE, "..", ".tmp", "tdqs-bad.md")], { encoding: "utf8" });
  assert.equal(r.status, 3);
  assert.match(r.stderr, /totals\.all_four_annotations says .* but its rows sum to/);
});

test("refuses a truncated tools/list walk instead of calling a prefix the surface", () => {
  const bad = JSON.parse(readFileSync(ARTIFACT, "utf8"));
  bad.cursor_exhausted = false;
  const art = path.join(HERE, "..", ".tmp", "tdqs-truncated.json");
  writeFileSync(art, JSON.stringify(bad));
  const r = spawnSync(process.execPath, [RENDERER, "--artifact", art, "--out", path.join(HERE, "..", ".tmp", "tdqs-trunc.md")], { encoding: "utf8" });
  assert.equal(r.status, 3);
  assert.match(r.stderr, /did not report an exhausted cursor/);
});

test("refuses when the served count is not the count this repository publishes", () => {
  const bad = JSON.parse(readFileSync(ARTIFACT, "utf8"));
  bad.expected_count = bad.tool_count + 1;
  const art = path.join(HERE, "..", ".tmp", "tdqs-drift.json");
  writeFileSync(art, JSON.stringify(bad));
  const r = spawnSync(process.execPath, [RENDERER, "--artifact", art, "--out", path.join(HERE, "..", ".tmp", "tdqs-drift.md")], { encoding: "utf8" });
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

test("the audit's blind-probe arm really fires on a server it cannot reach", { timeout: 120000 }, () => {
  const out = path.join(HERE, "..", ".tmp", "tdqs-blind-artifact.json");
  const r = spawnSync(process.execPath, [AUDIT, out, "--tamper-blind"], { encoding: "utf8", cwd: path.join(HERE, "..") });
  assert.equal(r.status, 3, `expected the refusal exit code, got ${r.status}: ${r.stdout}${r.stderr}`);
  assert.match(r.stderr, /REFUSED: initialize returned status \d+ and no protocolVersion/);
  assert.equal(readFileSync(ARTIFACT, "utf8").length > 0, true, "the shipped artifact vanished, so this test could not compare against it");
});
