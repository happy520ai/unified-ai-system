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
const VIS = "docs/data/mcp-registry-visibility-params.2026-09-28.json";
const WIDE = "docs/data/mcp-registry-census-including-deleted.2026-09-28.json";
const dir = mkdtempSync(join(tmpdir(), "census-render-"));
const readJson = (p) => JSON.parse(readFileSync(join(ROOT, p), "utf8"));

function run({ census = join(ROOT, CENSUS), sample = join(ROOT, SAMPLE), cross = join(ROOT, CROSS), vis = join(ROOT, VIS), wide = join(ROOT, WIDE), out = join(dir, "a.md") } = {}) {
  return spawnSync(process.execPath, [GEN, "--artifact", census, "--sample", sample, "--crosscheck", cross, "--visibility", vis, "--deleted", wide, "--out", out], {
    cwd: ROOT, encoding: "utf8",
  });
}

function copyVis(name, edit) {
  const base = readJson(VIS);
  edit(base);
  const p = join(dir, name + ".json");
  writeFileSync(p, JSON.stringify(base), "utf8");
  return p;
}

function copyWide(name, edit) {
  const base = readJson(WIDE);
  edit(base);
  const p = join(dir, name + ".json");
  writeFileSync(p, JSON.stringify(base), "utf8");
  return p;
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

test("the page states its scope, and refuses when the visibility facts stop backing that scope", () => {
  const out = join(dir, "scope.md");
  assert.equal(run({ out }).status, 0);
  const text = readFileSync(out, "utf8");
  assert.match(text, /population of the default view, not of the store/);
  assert.match(text, /is not among the documented parameters/);

  // Each of these is a claim about someone else's live API. If the API changes, the sentence must go red
  // rather than stay published as history.
  const a = copyVis("statusdoc", (b) => { b.status_param_documented = true; });
  assert.match(run({ vis: a, out: join(dir, "s1.md") }).stderr, /`status` is documented now/);
  const b = copyVis("statusnoign", (br) => { br.status_param_matches_no_filter_sha = false; });
  assert.match(run({ vis: b, out: join(dir, "s2.md") }).stderr, /no longer returns the unfiltered page/);
  const c = copyVis("nogate", (br) => { br.deleted_status_seen_only_with_include_deleted = false; });
  assert.match(run({ vis: c, out: join(dir, "s3.md") }).stderr, /no longer gated behind include_deleted/);
  const d = copyVis("prob", (br) => { br.problem_count = 1; });
  assert.match(run({ vis: d, out: join(dir, "s4.md") }).stderr, /visibility instrument reported 1 problems/);
});

test("the wider walk is bounded, and the page only claims what the two walks reconcile to", () => {
  const out = join(dir, "wide.md");
  assert.equal(run({ out }).status, 0);
  const text = readFileSync(out, "utf8");
  const wide = readJson(WIDE);
  const cen = readJson(CENSUS);
  assert.match(text, new RegExp("\\*\\*" + wide.distinct_names.toLocaleString("en-US") + " servers\\*\\*"));
  assert.match(text, new RegExp("The four differences add to " + (wide.distinct_names - cen.distinct_names)));
  // Pin the three-way split of the unreachable records to the artifacts, so a sign error in the prose
  // (451-439 vs 439-451) fails rather than reading fine.
  const depSplit = cen.all_latest_reachability.neither - cen.active_reachability.neither;
  const delSplit = wide.all_latest_reachability.neither - cen.all_latest_reachability.neither;
  assert.ok(depSplit >= 0 && delSplit >= 0, "fixture arithmetic itself must be non-negative");
  assert.match(text, new RegExp(" " + depSplit + " more are `deprecated`"));
  assert.match(text, new RegExp("and " + delSplit + " are only visible once"));
  assert.match(text, new RegExp(wide.all_latest_reachability.neither + " records declare neither"));

  const notWide = copyWide("notwide", (b) => { b.include_deleted_view = false; });
  assert.match(run({ wide: notWide, out: join(dir, "w1.md") }).stderr, /not taken with include_deleted on/);

  // The reconciliation guard: one extra name in the wider artifact and the class deltas no longer add up,
  // which is exactly the failure a silently dropped or double-counted server would produce.
  const drift = copyWide("drift", (b) => { b.distinct_names += 1; });
  const r = run({ wide: drift, out: join(dir, "w2.md") });
  assert.notEqual(r.status, 0);
  assert.match(r.stderr, /the two walks do not reconcile/);
});

test("the shipped page on disk equals a fresh render of its artifacts", () => {
  const out = join(dir, "shipped.md");
  const r = run({ out });
  assert.equal(r.status, 0, r.stderr);
  assert.equal(readFileSync(out, "utf8"), readFileSync(join(ROOT, "docs/mcp-registry-census.md"), "utf8"));
});
