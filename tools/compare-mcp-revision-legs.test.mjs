// The revision-leg comparison must be able to say zero, to separate a server that was already failing,
// and to refuse a pair that is not the same endpoint set.
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { test } from "node:test";

const TOOL = "tools/compare-mcp-revision-legs.mjs";

const row = (name, verdict, extra = {}) => ({ name, url: `https://${name}/mcp`, verdict, ...extra });
const shape = { toolCount: 1, result_ttlMs_type: "absent", result_ttlMs_value: null, result_cacheScope: "absent", result_has_meta: false, result_keys: ["tools"], tools_with_ttlMs: 0, tools_with_cacheScope: 0, tools_with_meta: 0, min_tool_ttlMs: null, max_tool_ttlMs: null };

const leg = (rows) => ({ attempted: rows.length, tally: {}, rows });

function run(modernDoc, legacyDoc) {
  const dir = mkdtempSync(join(tmpdir(), "uai-legs-"));
  const m = join(dir, "modern.json");
  const l = join(dir, "legacy.json");
  writeFileSync(m, JSON.stringify(modernDoc));
  writeFileSync(l, JSON.stringify(legacyDoc));
  const r = spawnSync(process.execPath, [TOOL, m, l], { encoding: "utf8" });
  return { r, out: r.stdout };
}

const baseRows = () => ([
  row("refuses-newer", "init_failed_400"),
  row("fails-anyway", "init_failed_400"),
  row("quiet-both", "no_cache_hint_declared", { shape }),
  row("declares-old-only", "RESULT_LEVEL_HINT", { shape: { ...shape, result_ttlMs_type: "number", result_ttlMs_value: 300000, result_cacheScope: "private", result_keys: ["tools", "ttlMs", "cacheScope"] } }),
]);

test("a server that 400s the new revision after answering the old one is counted, and one that failed both ways is not", () => {
  const modern = leg(baseRows());
  const legacyRows = baseRows().map((r) => ({ ...r }));
  legacyRows[0].verdict = "no_cache_hint_declared"; legacyRows[0].shape = shape; // answered fine at the old revision
  legacyRows[1].verdict = "init_failed_400"; // failed in both legs
  const { r, out } = run(modern, leg(legacyRows));
  assert.equal(r.status, 0, r.stderr.slice(0, 300));
  const doc = JSON.parse(out);
  assert.equal(doc.refused_newer_after_answering_older, 1);
  assert.equal(doc.failed_400_in_both_legs, 1);
  assert.equal(doc.answered_newer_but_not_older, 0);
  assert.deepEqual(doc.flips.map((f) => f.name), ["refuses-newer"]);
  assert.equal(doc.legacy.declared, 1);
  assert.equal(doc.modern.declared, 0);
});

test("an identical pair with no refusals reports zero rather than omitting the number", () => {
  const both = leg(baseRows().map((r) => ({ ...r, verdict: r.shape ? r.verdict : "no_cache_hint_declared", shape })));
  const { r, out } = run(both, both);
  assert.equal(r.status, 0, r.stderr.slice(0, 300));
  const doc = JSON.parse(out);
  assert.equal(doc.refused_newer_after_answering_older, 0);
  assert.equal(doc.failed_400_in_both_legs, 0);
});

test("legs covering different endpoints are refused, so the flip count is never a day-difference in disguise", () => {
  const modern = leg(baseRows());
  const legacy = leg(baseRows().slice(0, 3));
  const { r } = run(modern, legacy);
  assert.notEqual(r.status, 0);
  assert.match(r.stderr + r.stdout, /not the same endpoint set/);
});
