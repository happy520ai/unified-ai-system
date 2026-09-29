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
const SEARCH = "docs/data/mcp-registry-search.2026-09-29.json";
const dir = mkdtempSync(join(tmpdir(), "census-render-"));
const readJson = (p) => JSON.parse(readFileSync(join(ROOT, p), "utf8"));

function run({ census = join(ROOT, CENSUS), sample = join(ROOT, SAMPLE), cross = join(ROOT, CROSS), vis = join(ROOT, VIS), wide = join(ROOT, WIDE), search = join(ROOT, SEARCH), out = join(dir, "a.md") } = {}) {
  return spawnSync(process.execPath, [GEN, "--artifact", census, "--sample", sample, "--crosscheck", cross, "--visibility", vis, "--deleted", wide, "--search", search, "--out", out], {
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

function copySearch(name, edit) {
  const base = JSON.parse(readFileSync(join(ROOT, SEARCH), "utf8"));
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

  // The version=latest bullet. Its numbers are read out of the artifact rather than restated from memory,
  // so a re-run that measures a different mix updates the page instead of contradicting it.
  const measured = readJson(VIS);
  assert.match(text, new RegExp("carried " + measured.default_page_latest_mix.latest + " rows marked latest against " +
    measured.default_page_latest_mix.not_latest + " that"));
  assert.match(text, new RegExp("returned " + measured.version_latest_page.latest + " latest and " +
    measured.version_latest_page.not_latest + " superseded"));
  assert.match(text, /version currency, not status/);

  const v1 = copyVis("vdoc", (br) => { br.version_param_documented = false; });
  assert.match(run({ vis: v1, out: join(dir, "s5.md") }).stderr, /`version` is not a documented parameter/);
  const v2 = copyVis("vnoonly", (br) => { br.version_latest_returns_only_current = false; });
  assert.match(run({ vis: v2, out: join(dir, "s6.md") }).stderr, /no longer returns only current rows/);
  const v3 = copyVis("vbogus", (br) => { br.version_bogus_returns_zero_rows = false; });
  assert.match(run({ vis: v3, out: join(dir, "s7.md") }).stderr, /returns rows again/);
  const v4 = copyVis("vtally", (br) => { br.version_latest_page.not_latest = "0"; });
  assert.match(run({ vis: v4, out: join(dir, "s8.md") }).stderr, /carries no latest\/not_latest pair/);
  const v5 = copyVis("vdep0", (br) => { br.pages.version_latest.statuses.deprecated = 0; });
  assert.match(run({ vis: v5, out: join(dir, "s9.md") }).stderr, /now excludes deprecated rows/);
  const v6 = copyVis("vdepgone", (br) => { delete br.pages.version_latest.statuses.deprecated; });
  assert.match(run({ vis: v6, out: join(dir, "s10.md") }).stderr, /reports no deprecated count/);
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

test("the search section quotes the artifact, and refuses when the artifact stops backing it", () => {
  const out = join(dir, "search.md");
  assert.equal(run({ out }).status, 0);
  const text = readFileSync(out, "utf8");
  const art = JSON.parse(readFileSync(join(ROOT, SEARCH), "utf8"));

  // Headline numbers are read out of the artifact, never typed here.
  assert.match(text, new RegExp(art.totals.description_only_mentions + " of the " + art.sample_size.toLocaleString("en-US") + " sampled servers"));
  assert.match(text, new RegExp(art.totals.of_those_returned_by_search + " of them turn up in the"));
  assert.match(text, new RegExp(art.totals.search_rows_scanned.toLocaleString("en-US") + " result rows"));
  assert.match(text, /registry#1453/);
  // Every word's row in the table comes from the artifact too; a dropped or reworded leg would read fine.
  for (const w of art.per_word) {
    assert.ok(text.includes("| `" + w.word + "` | " + w.sample_description_only + " | " + w.description_only_records_returned + " | " + w.search_rows_returned + " |"),
      "table row for " + w.word);
  }
  // Capped legs must be declared on the page whenever the artifact says they were capped.
  if (art.capped_word_legs.length > 0) {
    assert.match(text, /note about the denominator/);
    for (const w of art.capped_word_legs) assert.match(text, new RegExp("`" + w + "`"));
  }

  const t1 = copySearch("stotal", (b) => { b.totals.description_only_mentions += 7; });
  assert.match(run({ search: t1, out: join(dir, "r1.md") }).stderr, /stores description_only_mentions .* but its rows add to/);

  // The falsification arm: a row whose name lacks the word. The stored count is moved too, so the
  // totals-recomputation guard passes and this specific refusal is what fires.
  const t2 = copySearch("nameonly", (b) => {
    b.per_word[0].search_rows_without_word_in_name = 1;
    b.totals.words_where_search_returned_a_name_lacking_the_word = 1;
  });
  assert.match(run({ search: t2, out: join(dir, "r2.md") }).stderr, /not name-only and the section below is wrong/);

  const t3 = copySearch("tiny", (b) => { b.sample_size = 40; });
  assert.match(run({ search: t3, out: join(dir, "r3.md") }).stderr, /too small to describe discovery loss/);

  const t4 = copySearch("problems", (b) => { b.problem_count = 2; });
  assert.match(run({ search: t4, out: join(dir, "r4.md") }).stderr, /search instrument reported 2 problems/);

  const t5 = copySearch("nolegs", (b) => { delete b.capped_word_legs; });
  assert.match(run({ search: t5, out: join(dir, "r5.md") }).stderr, /search artifact is missing capped_word_legs/);

  // A table row that claims more returns than the scan covered is the truncated-denominator shape this
  // page specifically refuses to publish.
  const t6 = copySearch("overscan", (b) => { b.per_word[0].search_rows_returned = 0; b.per_word[0].description_only_records_returned = 3; });
  const r6 = run({ search: t6, out: join(dir, "r6.md") });
  assert.notEqual(r6.status, 0);
  assert.match(r6.stderr, /its rows add to/);
});
