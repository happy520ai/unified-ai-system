import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFileSync, writeFileSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const ROOT = resolve(import.meta.dirname, "..");
const GEN = "tools/render-mcp-package-resolve-doc.mjs";
const RESOLVE = "docs/data/mcp-package-resolve.2026-09-28.json";
const NPM = "docs/data/mcp-npm-installability-sample.2026-09-28.json";
const dir = mkdtempSync(join(tmpdir(), "pkgrender-"));
const readJson = (p) => JSON.parse(readFileSync(join(ROOT, p), "utf8"));

function run({ resolve: res = join(ROOT, RESOLVE), npm = join(ROOT, NPM), out = join(dir, "a.md") } = {}) {
  return spawnSync(process.execPath, [GEN, "--resolve", res, "--npm", npm, "--out", out], { cwd: ROOT, encoding: "utf8" });
}
function mutate(name, edit) {
  const base = readJson(RESOLVE);
  edit(base);
  const p = join(dir, name + ".json");
  writeFileSync(p, JSON.stringify(base), "utf8");
  return p;
}

test("renders the shipped run and every family appears", () => {
  const out = join(dir, "ok.md");
  const r = run({ out });
  assert.equal(r.status, 0, r.stderr);
  const text = readFileSync(out, "utf8");
  const d = readJson(RESOLVE);
  for (const f of ["pypi", "oci", "mcpb", "cargo", "nuget"]) {
    assert.ok(text.includes("| " + f + " | "), "row missing for " + f);
    assert.ok(text.includes(d.by_type[f].population.toLocaleString("en-US")), "population missing for " + f);
  }
  assert.match(text, /not decided/);
  assert.match(text, /Wilson/);
});

test("a sampled family with zero failures does not get a degenerate interval", () => {
  const out = join(dir, "wilson.md");
  assert.equal(run({ out }).status, 0);
  const text = readFileSync(out, "utf8");
  const d = readJson(RESOLVE);
  const pypi = d.by_type.pypi;
  assert.equal(pypi.unusable, 0, "fixture depends on pypi having no failures in this run");
  assert.equal(pypi.exhaustive, false);
  // Wald would print [0.00%, 0.00%] here, which reads as "provably perfect". Wilson must keep an upper bound.
  assert.equal(text.includes("0.00%  [0.00%, 0.00%]"), false, "a zero-width interval on a sample is a false precision");
  const row = text.split("\n").find((l) => l.startsWith("| pypi |"));
  const upper = Number((row.match(/\[(?:[\d.]+)%, ([\d.]+)%\]/) || [])[1]);
  assert.ok(upper > 0 && upper < 5, "pypi upper bound should be small but non-zero, got " + upper);
});

test("refuses a family that is missing entirely rather than printing a short table", () => {
  const p = mutate("missing-family", (b) => { delete b.by_type.nuget; });
  const r = run({ resolve: p });
  assert.notEqual(r.status, 0);
  assert.match(r.stderr, /family nuget is absent/);
});

test("refuses a family whose probe decided nothing", () => {
  const p = mutate("blind", (b) => {
    b.by_type.cargo.definite = 0;
    b.by_type.cargo.verdict_tally = { transport_error: b.by_type.cargo.measured };
    b.by_type.cargo.unusable = 0;
    delete b.by_type.cargo.ci95;
  });
  const r = run({ resolve: p });
  assert.notEqual(r.status, 0);
  assert.match(r.stderr, /measured \d+ and decided none/);
});

test("refuses when any control would have disagreed", () => {
  for (const [name, edit, expect] of [
    ["good-bad", (b) => { b.controls.find((c) => c.role === "known_good").verdict = "package_missing"; }, /control known_good/],
    ["absent-good", (b) => { b.controls.find((c) => c.role === "known_absent" && c.type === "pypi").verdict = "listed_version_published"; }, /control known_absent/],
  ]) {
    const p = mutate(name, edit);
    const r = run({ resolve: p });
    assert.notEqual(r.status, 0, name + " must refuse");
    assert.match(r.stderr, expect);
  }
});

test("refuses a row count that disagrees with the measured figure", () => {
  const p = mutate("rows", (b) => { b.by_type.pypi.rows.pop(); });
  const r = run({ resolve: p });
  assert.notEqual(r.status, 0);
  assert.match(r.stderr, /claims \d+ readings but carries/);
});

test("refuses an unusable count outside its denominator", () => {
  const p = mutate("overshoot", (b) => { b.by_type.oci.unusable = b.by_type.oci.definite + 5; });
  const r = run({ resolve: p });
  assert.notEqual(r.status, 0);
  assert.match(r.stderr, /outside the denominator/);
});

test("the shipped page equals a fresh render of the shipped artifacts", () => {
  const out = join(dir, "shipped.md");
  const r = run({ out });
  assert.equal(r.status, 0, r.stderr);
  assert.equal(readFileSync(out, "utf8"), readFileSync(join(ROOT, "docs/mcp-package-resolve.md"), "utf8"));
});
