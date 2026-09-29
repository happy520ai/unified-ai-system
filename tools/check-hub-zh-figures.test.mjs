import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFileSync, writeFileSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const ROOT = resolve(import.meta.dirname, "..");
const GEN = "tools/check-hub-zh-figures.mjs";
const PAGE = "docs/mcp-ecosystem-measurements.zh-CN.html";
const CENSUS = "docs/data/mcp-registry-census.2026-09-28.json";
const RESOLVE = "docs/data/mcp-package-resolve.2026-09-28.json";
const dir = mkdtempSync(join(tmpdir(), "hubzh-"));

function run(args) {
  return spawnSync(process.execPath, [GEN, ...args], { cwd: ROOT, encoding: "utf8" });
}

function parse(stdout) {
  return JSON.parse(stdout);
}

test("every figure the Chinese hub quotes is checked, and the one gap is declared", () => {
  const r = run([]);
  assert.equal(r.status, 0, r.stderr);
  const out = parse(r.stdout);
  assert.equal(out.missing.length, 0, "published page must match its artifacts: " + JSON.stringify(out.missing));
  assert.equal(out.checked, out.expected_total);
  // Pinned as a number as well as a ratio: if a phrase rule is dropped, checked and expected_total shrink
  // together and the equality above still holds.
  assert.equal(out.expected_total, 12);
  // The not_checked list is itself pinned, so both silent growth (a rule added without noticing the gap
  // list changed) and silent shrinkage (a figure quietly dropped from coverage) read here first.
  assert.equal(out.not_checked.length, 1);
  assert.match(out.not_checked[0].label, /Wilson/);
  assert.match(out.not_checked[0].reason, /unusable, definite/);
});

test("--require-present passes on the shipped page and artifacts", () => {
  const r = run(["--require-present"]);
  assert.equal(r.status, 0, r.stdout + r.stderr);
});

test("--selftest reports both arms firing and leaves nothing behind", () => {
  const r = run(["--selftest"]);
  assert.equal(r.status, 0, r.stdout + r.stderr);
  const out = parse(r.stdout);
  assert.equal(out.selftest, true);
  assert.equal(out.arms, 2);
  assert.deepEqual(out.problems, []);
});

test("a page that moved a number on its own goes red and names the phrase", () => {
  const shipped = readFileSync(join(ROOT, PAGE), "utf8");
  const census = JSON.parse(readFileSync(join(ROOT, CENSUS), "utf8"));
  const live = "默认视图 " + census.distinct_names.toLocaleString("en-US") + " 个服务器";
  assert.ok(shipped.includes(live), "fixture precondition: the shipped page must carry the current census figure");
  const tampered = shipped.replace(live, live.replace(String(census.distinct_names.toLocaleString("en-US")), "41,111"));
  assert.notEqual(tampered, shipped, "the fixture must actually change bytes");
  const p = join(dir, "tampered.html");
  writeFileSync(p, tampered, "utf8");
  const r = run(["--page", p, "--require-present"]);
  assert.equal(r.status, 2, r.stdout + r.stderr);
  assert.match(r.stderr, /census distinct names/);
  // The refused message quotes the phrase the artifact implies, so a reader can tell which side is wrong.
  assert.match(r.stderr, new RegExp("默认视图 " + census.distinct_names.toLocaleString("en-US") + " 个服务器"));
});

test("an artifact-only change goes red too, which is the drift this guard exists for", () => {
  const census = JSON.parse(readFileSync(join(ROOT, CENSUS), "utf8"));
  census.distinct_names = census.distinct_names + 1;
  const p = join(dir, "census-plus-one.json");
  writeFileSync(p, JSON.stringify(census), "utf8");
  const r = run(["--census", p, "--require-present"]);
  assert.equal(r.status, 2, r.stdout + r.stderr);
  assert.match(r.stderr, /census distinct names/);
});

test("a renamed artifact field refuses instead of reading as a stale page", () => {
  const census = JSON.parse(readFileSync(join(ROOT, CENSUS), "utf8"));
  delete census.distinct_names;
  const p = join(dir, "census-renamed.json");
  writeFileSync(p, JSON.stringify(census), "utf8");
  const r = run(["--census", p, "--require-present"]);
  assert.equal(r.status, 3, r.stdout + r.stderr);
  assert.match(r.stderr, /REFUSED: census has no number at distinct_names/);
});

test("an unreadable page refuses rather than reporting the figures as absent", () => {
  const r = run(["--page", join(dir, "no-such-page.html"), "--require-present"]);
  assert.equal(r.status, 3, r.stdout + r.stderr);
  assert.match(r.stderr, /cannot read the published page/);
});

test("a family losing one decided reading breaks the count phrase but not the rounded rate", () => {
  const resolve = JSON.parse(readFileSync(join(ROOT, RESOLVE), "utf8"));
  resolve.by_type.pypi.definite = resolve.by_type.pypi.definite - 1;
  const p = join(dir, "resolve-pypi-minus-one.json");
  writeFileSync(p, JSON.stringify(resolve), "utf8");
  const r = run(["--resolve", p, "--require-present"]);
  assert.equal(r.status, 2, r.stdout + r.stderr);
  assert.match(r.stderr, /resolve decided\/failed counts/);
  assert.doesNotMatch(r.stderr, /resolve pooled rate/);
  // Why this arm is worth its lines: 19/985 and 19/984 both render as 1.93%, so the published rate cannot
  // see a one-row change while the published count can. Pinning only percentages would not be a guard.
});

test("a family field renamed to something else refuses with the family named", () => {
  const resolve = JSON.parse(readFileSync(join(ROOT, RESOLVE), "utf8"));
  resolve.by_type.cargo.unusable = undefined;
  delete resolve.by_type.cargo.unusable;
  const p = join(dir, "resolve-cargo-renamed.json");
  writeFileSync(p, JSON.stringify(resolve), "utf8");
  const r = run(["--resolve", p, "--require-present"]);
  assert.equal(r.status, 3, r.stdout + r.stderr);
  assert.match(r.stderr, /family cargo has no number at unusable/);
});
