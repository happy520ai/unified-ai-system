import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFileSync, writeFileSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const ROOT = resolve(import.meta.dirname, "..");
const GEN = "tools/measure-mcp-registry-search.mjs";
const ARTIFACT = "docs/data/mcp-registry-search.2026-09-29.json";
const dir = mkdtempSync(join(tmpdir(), "regsearch-"));

const run = (args) => spawnSync(process.execPath, [GEN, ...args], { cwd: ROOT, encoding: "utf8" });
const readArtifact = () => JSON.parse(readFileSync(join(ROOT, ARTIFACT), "utf8"));

import { pathToFileURL } from "node:url";

const { analyse, WORDS } = await import(pathToFileURL(join(ROOT, GEN)).href);

function fakeSample(pairs) {
  return pairs.map(([name, description]) => ({ name, description, status: "active", isLatest: true }));
}

test("the word list is the measured one, not an accident of ordering", () => {
  assert.ok(WORDS.length >= 8, "the measurement needs a real spread of capability words");
  assert.equal(new Set(WORDS).size, WORDS.length, "duplicate words would double-count the same discovery gap");
});

test("a name-only search produces zero rows lacking the word and zero description-only returns", () => {
  const sample = fakeSample([
    ["io.github.acme/weather-forecast", "Shows the weather in any city"],
    ["io.github.acme/plain-notes", "A notes server about the weather and nothing else"],
    ["io.github.other/calendar", "Handles a calendar"],
  ]);
  const searches = {};
  for (const w of WORDS) searches[w] = { ok: true, rows: [{ name: `io.github.acme/${w}-server`, description: "unrelated prose" }], pages: 1, exhausted: true };
  const { perWord, problems } = analyse(sample, searches);
  assert.deepEqual(problems, []);
  const weather = perWord.find((p) => p.word === "weather");
  // Both records mention weather in the description; only one names it. The search returning the named one
  // is the expected shape, and the counts have to say so.
  assert.equal(weather.sample_description_only, 1);
  assert.equal(weather.sample_name_and_description, 1);
  assert.equal(weather.search_rows_without_word_in_name, 0);
  assert.equal(weather.description_only_records_returned, 0);
});

test("a returned row without the word in its name is refused, because that would mean the claim changed", () => {
  const sample = fakeSample([["io.github.a/plain", "handles pdf exports"]]);
  const searches = {};
  for (const w of WORDS) {
    searches[w] = w === "pdf"
      // One row comes back whose name never says "pdf": the only shape that would prove the search reads
      // something other than the name.
      ? { ok: true, rows: [{ name: "io.github.a/plain", description: "handles pdf exports" }], pages: 1, exhausted: true }
      : { ok: true, rows: [{ name: `io.github.a/${w}-tool`, description: "x" }], pages: 1, exhausted: true };
  }
  const { problems } = analyse(sample, searches);
  assert.equal(problems.length, 1, "only the pdf leg is falsified, so only one problem may fire: " + JSON.stringify(problems));
  assert.match(problems[0], /^"pdf"/);
  assert.match(problems[0], /not name-only any more/);
});

test("an unreadable search leg is a problem, not a silent zero", () => {
  const sample = fakeSample([["io.github.a/b", "email things"]]);
  const searches = {};
  for (const w of WORDS) searches[w] = { ok: true, rows: [], pages: 1, exhausted: true };
  searches.email = { ok: false, status: 500 };
  const { problems, perWord } = analyse(sample, searches);
  assert.ok(problems.some((p) => /email/.test(p) && /unreadable/.test(p)), JSON.stringify(problems));
  assert.equal(perWord.length, WORDS.length - 1, "the failed leg must be dropped from the table, not counted as zero");
});

test("rows marked not-latest under version=latest are refused", () => {
  const sample = fakeSample([["io.github.a/b", "memory"]]);
  sample.push({ name: "io.github.c/d", description: "memory", status: "active", isLatest: false });
  const searches = {};
  for (const w of WORDS) searches[w] = { ok: true, rows: [], pages: 1, exhausted: true };
  const { problems } = analyse(sample, searches);
  assert.ok(problems.some((p) => /not marked latest/.test(p)), JSON.stringify(problems));
});

test("offline re-derivation accepts the shipped artifact", () => {
  const r = run(["--offline", ARTIFACT]);
  assert.equal(r.status, 0, r.stdout + r.stderr);
  const j = JSON.parse(r.stdout);
  assert.equal(j.verdict, "consistent");
  assert.equal(j.stored_problem_count, 0);
  // Cross-read the artifact so the CLI is not graded against its own echo.
  const saved = readArtifact();
  assert.equal(j.words, saved.per_word.length);
  assert.ok(saved.sample_size >= 200, "the published sample must stay large enough to describe discovery loss");
});

test("offline refuses when the stored totals no longer follow from the stored rows", () => {
  const saved = readArtifact();
  const edited = { ...saved, totals: { ...saved.totals, description_only_mentions: saved.totals.description_only_mentions + 7 } };
  const p = join(dir, "edited.json");
  writeFileSync(p, JSON.stringify(edited), "utf8");
  const r = run(["--offline", p]);
  assert.equal(r.status, 4, r.stdout + r.stderr);
  assert.match(r.stdout, /do not match recomputation/);
});

test("offline refuses when a leg's inclusion claim exceeds what it scanned", () => {
  const saved = readArtifact();
  const broken = { ...saved, per_word: saved.per_word.map((w, i) => (i === 0 ? { ...w, description_only_records_returned: w.sample_description_only + 1 } : w)) };
  const p = join(dir, "broken.json");
  writeFileSync(p, JSON.stringify(broken), "utf8");
  const r = run(["--offline", p]);
  assert.equal(r.status, 4, r.stdout + r.stderr);
  assert.match(r.stdout, /more description-only records than the sample holds/);
});

test("offline refuses a word list that no longer matches the instrument", () => {
  const saved = readArtifact();
  const edited = { ...saved, words: saved.words.filter((w) => w !== "jira") };
  const p = join(dir, "words.json");
  writeFileSync(p, JSON.stringify(edited), "utf8");
  const r = run(["--offline", p]);
  assert.equal(r.status, 4, r.stdout + r.stderr);
  assert.match(r.stdout, /word list differs/);
});

test("--help prints both modes without touching the network", () => {
  const r = run(["--help"]);
  assert.equal(r.status, 0, r.stderr);
  assert.match(r.stdout, /--offline <artifact\.json>/);
  assert.match(r.stdout, /--pages N/);
});
