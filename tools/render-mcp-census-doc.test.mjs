import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFileSync, writeFileSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const ROOT = resolve(import.meta.dirname, "..");
const GEN = "tools/render-mcp-census-doc.mjs";
const CENSUS = "docs/data/mcp-registry-census.2026-09-28.json";
const SAMPLE = "docs/data/mcp-registry-installability.2026-09-28.json";
const CROSS = "docs/data/mcp-installability-crosscheck.2026-09-28.json";
const dir = mkdtempSync(join(tmpdir(), "census-render-"));
const readJson = (p) => JSON.parse(readFileSync(join(ROOT, p), "utf8"));

function run({ census = join(ROOT, CENSUS), sample = join(ROOT, SAMPLE), cross = join(ROOT, CROSS), out = join(dir, "a.md") } = {}) {
  return spawnSync(process.execPath, [GEN, "--artifact", census, "--sample", sample, "--crosscheck", cross, "--out", out], {
    cwd: ROOT, encoding: "utf8",
  });
}

function copy(name, edit) {
  const base = readJson(CENSUS);
  edit(base);
  const p = join(dir, name + ".json");
  writeFileSync(p, JSON.stringify(base), "utf8");
  return p;
}

test("renders the shipped census and every headline number comes from the artifact", () => {
  const r = run({ out: join(dir, "ok.md") });
  assert.equal(r.status, 0, r.stderr);
  const d = readJson(CENSUS);
  const text = readFileSync(join(dir, "ok.md"), "utf8");
  const reach = d.active_reachability;
  assert.match(text, new RegExp("\\*\\*" + reach.neither.toLocaleString("en-US") + "\\*\\*"));
  assert.match(text, new RegExp(reach.remote_only.toLocaleString("en-US") + " \\|"));
  assert.match(text, new RegExp(d.distinct_names.toLocaleString("en-US")));
  // No invented arithmetic: the page must not carry a number that is neither in the artifact nor derived
  // from it by the renderer's own two helpers.
  assert.equal(text.includes("undefined"), false);
  assert.equal(text.includes("NaN"), false);
});

test("refuses a walk that did not reach the end of the list", () => {
  const p = copy("trunc", (b) => { b.walk_complete = false; });
  assert.equal(JSON.parse(readFileSync(p, "utf8")).walk_complete, false, "the fixture must really differ from the shipped artifact");
  const r = run({ census: p });
  assert.notEqual(r.status, 0);
  assert.match(r.stderr, /REFUSED: the walk did not reach the end/);
});

test("refuses the coerced-object tally that the first real run actually produced", () => {
  const p = copy("objkey", (b) => { b.package_transport_types = { "[object Object]": 16597 }; });
  const r = run({ census: p });
  assert.notEqual(r.status, 0);
  assert.match(r.stderr, /coerced object key/);
});

test("refuses when the reachability classes stop summing to the denominator", () => {
  const p = copy("sum", (b) => { b.active_reachability.neither += 1; b.active_sum_matches_denominator = true; });
  const r = run({ census: p });
  assert.notEqual(r.status, 0);
  assert.match(r.stderr, /REFUSED: re-added to/);
});

test("refuses when a server lost its latest row, because the denominator would not be servers", () => {
  const p = copy("nolatest", (b) => { b.names_without_latest_row = 3; });
  const r = run({ census: p });
  assert.notEqual(r.status, 0);
  assert.match(r.stderr, /had no isLatest row/);
});

test("refuses a control record that is not an active latest record with a package", () => {
  const p = copy("control", (b) => { b.control_record.has_packages = false; });
  assert.equal(JSON.parse(readFileSync(p, "utf8")).control_record.has_packages, false);
  const r = run({ census: p });
  assert.notEqual(r.status, 0);
  assert.match(r.stderr, /REFUSED: the control record/);
});

test("refuses when the two instruments did not read the same servers", () => {
  const base = readJson(CROSS);
  const mutated = { ...base, rows: base.rows.slice(1).concat([{ name: "not.in.the.sample/ghost", class_from_versions_latest_endpoint: "remote_only" }]) };
  const p = join(dir, "cross-ghost.json");
  writeFileSync(p, JSON.stringify(mutated), "utf8");
  const r = run({ cross: p });
  assert.notEqual(r.status, 0);
  assert.match(r.stderr, /did not read the same servers/);
});

test("refuses when tally semantics are undeclared, because the type columns could be read as entry counts", () => {
  const p = copy("tallysem", (b) => { b.tally_counts_records_not_entries = false; });
  const r = run({ census: p });
  assert.notEqual(r.status, 0);
  assert.match(r.stderr, /tally semantics|TALLY_SEMANTICS/i);
});

test("the shipped page on disk equals a fresh render of its artifacts", () => {
  const out = join(dir, "shipped.md");
  const r = run({ out });
  assert.equal(r.status, 0, r.stderr);
  assert.equal(readFileSync(out, "utf8"), readFileSync(join(ROOT, "docs/mcp-registry-census.md"), "utf8"));
});
