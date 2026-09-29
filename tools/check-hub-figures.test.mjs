import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFileSync, writeFileSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const ROOT = resolve(import.meta.dirname, "..");
const GEN = "tools/check-hub-figures.mjs";
const EN = "docs/mcp-ecosystem-measurements.html";
const ZH = "docs/mcp-ecosystem-measurements.zh-CN.html";
const CENSUS = "docs/data/mcp-registry-census.2026-09-28.json";
const RESOLVE = "docs/data/mcp-package-resolve.2026-09-28.json";
const NPM = "docs/data/mcp-npm-installability-sample.2026-09-28.json";
const TDQS = "docs/data/mcp-tool-definition-quality.2026-09-28.json";
const dir = mkdtempSync(join(tmpdir(), "hubfig-"));

const run = (args) => spawnSync(process.execPath, [GEN, ...args], { cwd: ROOT, encoding: "utf8" });
const out = (stdout) => JSON.parse(stdout);
const read = (p) => JSON.parse(readFileSync(join(ROOT, p), "utf8"));
const copy = (name, obj) => { const p = join(dir, name + ".json"); writeFileSync(p, JSON.stringify(obj), "utf8"); return p; };

test("both languages are fully covered and the one gap is declared", () => {
  const r = run([]);
  assert.equal(r.status, 0, r.stderr);
  const j = out(r.stdout);
  assert.deepEqual(j.runs.map((x) => x.lang), ["en", "zh"]);
  assert.equal(j.checked, 24);
  assert.equal(j.expected_total, 24);
  // Pinned as a number and not only as checked == expected_total: dropping a phrase rule shrinks both sides
  // of that equality, and a guard that quietly covers less is worse than one that fails.
  for (const x of j.runs) {
    assert.equal(x.missing.length, 0, x.lang + ": " + JSON.stringify(x.missing));
    assert.equal(x.expected_total, 12);
  }
  assert.equal(j.not_checked.length, 1);
  assert.match(j.not_checked[0].label, /Wilson/);
});

test("--require-present passes on the shipped pages and artifacts", () => {
  const r = run(["--require-present"]);
  assert.equal(r.status, 0, r.stdout + r.stderr);
  assert.equal(out(r.stdout).verdict, "consistent");
});

test("--selftest fires both arms in both languages and leaves nothing behind", () => {
  const r = run(["--selftest"]);
  assert.equal(r.status, 0, r.stdout + r.stderr);
  const j = out(r.stdout);
  assert.equal(j.selftest, true);
  assert.deepEqual(j.languages, ["en", "zh"]);
  assert.equal(j.census_phrase_flips, 2, "the stale-page arm must bite once per language, not once overall");
  assert.deepEqual(j.problems, []);
});

test("a page that moved a census number alone goes red in that language only", () => {
  const census = read(CENSUS);
  const live = census.distinct_names.toLocaleString("en-US");
  const en = readFileSync(join(ROOT, EN), "utf8");
  const zh = readFileSync(join(ROOT, ZH), "utf8");
  assert.ok(en.includes(live + " servers visible") && zh.includes(live + " 个服务器"), "fixture precondition");
  const enBad = join(dir, "en-stale.html");
  const zhGood = join(dir, "zh-copy.html");
  writeFileSync(enBad, en.replace(live + " servers visible", "41,111 servers visible"), "utf8");
  writeFileSync(zhGood, zh, "utf8");
  assert.notEqual(readFileSync(enBad, "utf8"), en, "the fixture must actually change bytes");

  const rEn = run(["--lang", "en", "--page-en", enBad, "--require-present"]);
  assert.equal(rEn.status, 2, rEn.stdout + rEn.stderr);
  assert.match(rEn.stderr, /EN census default view/);

  const rZh = run(["--lang", "zh", "--page", zhGood, "--require-present"]);
  assert.equal(rZh.status, 0, rZh.stdout + rZh.stderr);
});

test("an artifact-only move breaks the census phrase in BOTH pages", () => {
  const census = read(CENSUS);
  census.distinct_names = census.distinct_names + 1;
  const p = copy("census-plus-one", census);
  const r = run(["--census", p, "--require-present"]);
  assert.equal(r.status, 2, r.stdout + r.stderr);
  const j = out(r.stdout);
  assert.equal(j.missing.length, 2, "both languages quote the same figure, so both must go red: " + JSON.stringify(j.missing));
  assert.match(j.missing.join(" "), /EN census default view/);
  assert.match(j.missing.join(" "), /census distinct names/);
});

test("a renamed census field refuses with the field named instead of reading as staleness", () => {
  const census = read(CENSUS);
  delete census.distinct_names;
  const r = run(["--census", copy("census-renamed", census), "--require-present"]);
  assert.equal(r.status, 3, r.stdout + r.stderr);
  assert.match(r.stderr, /REFUSED: census has no number at distinct_names/);
});

test("a resolve family missing a field refuses with the family named", () => {
  const resolveArt = read(RESOLVE);
  delete resolveArt.by_type.cargo.unusable;
  const r = run(["--resolve", copy("resolve-cargo", resolveArt), "--require-present"]);
  assert.equal(r.status, 3, r.stdout + r.stderr);
  assert.match(r.stderr, /family cargo has no number at unusable/);
});

test("a family losing one decided reading breaks both counts and not the rounded rate", () => {
  const resolveArt = read(RESOLVE);
  resolveArt.by_type.pypi.definite = resolveArt.by_type.pypi.definite - 1;
  const r = run(["--resolve", copy("resolve-pypi", resolveArt), "--require-present"]);
  assert.equal(r.status, 2, r.stdout + r.stderr);
  const j = out(r.stdout);
  const missing = j.missing.join(" ");
  assert.match(missing, /resolve decided\/failed counts/);
  assert.match(missing, /EN resolve decided\/failed counts/);
  assert.doesNotMatch(missing, /pooled rate/);
  // Why this arm is worth its lines: 19/985 and 19/984 both render as 1.93%. A guard that pinned only the
  // published percentage would watch a family lose a decided reading and say nothing, in either language.
});

test("a one-sided npm interval refuses instead of printing half an interval", () => {
  const npm = read(NPM);
  npm.ci95 = [0.0006];
  const r = run(["--npm", copy("npm-ci", npm), "--require-present"]);
  assert.equal(r.status, 3, r.stdout + r.stderr);
  assert.match(r.stderr, /no two-sided ci95/);
});

test("the English outputSchema sentence is guarded against the day the count stops being zero", () => {
  const tdqs = read(TDQS);
  tdqs.totals.output_schema_present = 1;
  const r = run(["--tdqs", copy("tdqs-one", tdqs), "--require-present"]);
  assert.equal(r.status, 2, r.stdout + r.stderr);
  // Not a missing-phrase guess: the refusal has to say the sentence itself needs rewriting, because the
  // English page phrases it as "15 of 15 of our tools declare no outputSchema".
  assert.match(r.stderr, /the page's sentence assumes zero outputSchema declarations/);
});

test("an unreadable page refuses rather than reporting the figures as absent", () => {
  const r = run(["--lang", "zh", "--page", join(dir, "nope.html"), "--require-present"]);
  assert.equal(r.status, 3, r.stdout + r.stderr);
  assert.match(r.stderr, /cannot read the published page/);
});
