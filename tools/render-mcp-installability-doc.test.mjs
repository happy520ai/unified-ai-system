import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFileSync, writeFileSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const ROOT = resolve(import.meta.dirname, "..");
const GEN = "tools/render-mcp-installability-doc.mjs";
const ARTIFACT = "docs/data/mcp-registry-installability.2026-09-28.json";
const dir = mkdtempSync(join(tmpdir(), "inst-render-"));

function run(artifactPath, out) {
  return spawnSync(process.execPath, [GEN, "--artifact", artifactPath, "--out", out], {
    cwd: ROOT, encoding: "utf8",
  });
}

// Writes a mutated copy of the real artifact so a fixture differs from the shipped file by exactly one
// field, and the refusal under test cannot be satisfied by an artifact that was already broken.
function mutate(name, edit) {
  const base = JSON.parse(readFileSync(join(ROOT, ARTIFACT), "utf8"));
  assert.notDeepEqual(base.rows, undefined, "artifact must have rows");
  edit(base);
  const p = join(dir, name + ".json");
  writeFileSync(p, JSON.stringify(base), "utf8");
  return p;
}

test("renders the shipped artifact and every number comes from it", () => {
  const out = join(dir, "article.md");
  const r = run(join(ROOT, ARTIFACT), out);
  assert.equal(r.status, 0, r.stderr);
  const text = readFileSync(out, "utf8");
  const d = JSON.parse(readFileSync(join(ROOT, ARTIFACT), "utf8"));
  assert.match(text, new RegExp("held for " + d.tally.package_present + " of " + d.rows.length + " records"));
  assert.match(text, /`oci`/, "the control's registry type is carried through");
  assert.equal(text.includes("`npm`"), true);
});

test("the retracted sentence is gone and cannot come back through the generator", () => {
  const out = join(dir, "retract.md");
  assert.equal(run(join(ROOT, ARTIFACT), out).status, 0);
  const text = readFileSync(out, "utf8");
  // Phrase level, not just token level: the old claim was a whole sentence about what a record tells a
  // client, and a token search for "remote" would pass with the sentence still in place.
  for (const banned of ["tell you a server exists", "client how to run it", "installable from the official registry` are two claims"]) {
    assert.equal(text.includes(banned), false, "retracted phrase still present: " + banned);
  }
  assert.match(text, /unclassified as to reachability/);
  assert.match(text, /cannot answer in either direction/);
});

test("refuses when a field the prose depends on is absent", () => {
  const p = mutate("missing", (b) => { delete b.counting_on_the_oldest_row_instead; });
  const r = run(p, join(dir, "missing.md"));
  assert.notEqual(r.status, 0);
  assert.match(r.stderr + r.stdout, /REFUSED: counting_on_the_oldest_row_instead missing/);
});

test("refuses when the tally does not sum to the row count", () => {
  const p = mutate("sum", (b) => { b.tally.package_present += 1; });
  assert.notDeepEqual(JSON.parse(readFileSync(p, "utf8")).tally.package_present,
    JSON.parse(readFileSync(join(ROOT, ARTIFACT), "utf8")).tally.package_present);
  const r = run(p, join(dir, "sum.md"));
  assert.notEqual(r.status, 0);
  assert.match(r.stderr + r.stdout, /REFUSED: tally sums to/);
});

test("refuses when the control record shows no package", () => {
  const p = mutate("control", (b) => { b.control.verdict = "no_package_in_record"; });
  const r = run(p, join(dir, "control.md"));
  assert.notEqual(r.status, 0);
  assert.match(r.stderr + r.stdout, /REFUSED: the control record shows no package/);
});

test("refuses the trap paragraph when both readings agree", () => {
  const p = mutate("equal", (b) => { b.counting_on_the_oldest_row_instead = b.tally.package_present; });
  const r = run(p, join(dir, "equal.md"));
  assert.notEqual(r.status, 0);
  assert.match(r.stderr + r.stdout, /REFUSED: the oldest-row count equals/);
});

test("the shipped page on disk equals a fresh render of its artifact", () => {
  const out = join(dir, "shipped.md");
  assert.equal(run(join(ROOT, ARTIFACT), out).status, 0);
  assert.equal(readFileSync(out, "utf8"), readFileSync(join(ROOT, "docs/mcp-registry-installability.md"), "utf8"));
});
