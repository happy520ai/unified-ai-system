// Join two saved legs of the same survey (same instrument, same day, differing only in the protocol
// revision offered) and report the negotiation shape rather than only the tallies.
//
// Why this exists as its own file: the number it produces - servers that answer an older revision and
// reject a newer one with HTTP 400 instead of replying with their latest supported version - is the
// reason a cache-hint denominator collapses, and it should not live in a scratch join or be re-derived
// by hand whenever a page quotes it.
//
// Reads local artifacts only; goes onto no network. Refuses when the two legs do not cover exactly the
// same endpoints, because then they differ by more than the revision and the flip count means nothing.
//
// Usage: node tools/compare-mcp-revision-legs.mjs <modern-leg.json> <legacy-leg.json>
import { readFileSync } from "node:fs";

const REVISIONS = (() => {
  const [modernPath, legacyPath] = process.argv.slice(2);
  if (!modernPath || !legacyPath) throw new Error("usage: compare-mcp-revision-legs.mjs <modern.json> <legacy.json>");
  return { modernPath, legacyPath };
})();

const load = (path) => {
  const doc = JSON.parse(readFileSync(path, "utf8"));
  if (!Array.isArray(doc.rows)) throw new Error(`${path} has no rows array`);
  return doc;
};

const modern = load(REVISIONS.modernPath);
const legacy = load(REVISIONS.legacyPath);

const rowsOf = (doc) => doc.rows;
const urlsOf = (doc) => new Set(doc.rows.map((r) => r.url));
const answering = (doc) => doc.rows.filter((r) => r.shape);
const answered = (r) => r && !/^init_failed/.test(r.verdict) && !/^error/.test(r.verdict);
const failed400 = (r) => /^init_failed_400/.test(r.verdict ?? "");
const declared = (doc) => answering(doc).filter((r) => r.verdict === "RESULT_LEVEL_HINT" || r.verdict === "TOOL_LEVEL_HINT").length;

const modernUrls = urlsOf(modern);
const legacyUrls = urlsOf(legacy);
if (modernUrls.size === 0 || legacyUrls.size === 0) throw new Error("a leg has no rows: nothing to join");
if (modernUrls.size !== legacyUrls.size || [...modernUrls].some((u) => !legacyUrls.has(u))) {
  const onlyModern = [...modernUrls].filter((u) => !legacyUrls.has(u));
  const onlyLegacy = [...legacyUrls].filter((u) => !modernUrls.has(u));
  throw new Error(`the two legs are not the same endpoint set (modern ${modernUrls.size}, legacy ${legacyUrls.size}, `
    + `only-modern ${onlyModern.length}, only-legacy ${onlyLegacy.length})`);
}

const legacyByUrl = new Map(rowsOf(legacy).map((r) => [r.url, r]));
const flips = rowsOf(modern).filter(failed400).filter((r) => answered(legacyByUrl.get(r.url)))
  .map((r) => ({ name: r.name, url: r.url, legacy_verdict: legacyByUrl.get(r.url).verdict }));
const bothLegFailures = rowsOf(modern).filter(failed400).filter((r) => !answered(legacyByUrl.get(r.url))).length;
const reverseFlips = rowsOf(legacy).filter(failed400).filter((r) => answered(new Map(rowsOf(modern).map((x) => [x.url, x])).get(r.url))).length;

const report = {
  modern: { file: REVISIONS.modernPath, endpoints: modernUrls.size, answering: answering(modern).length, declared: declared(modern) },
  legacy: { file: REVISIONS.legacyPath, endpoints: legacyUrls.size, answering: answering(legacy).length, declared: declared(legacy) },
  // The load-bearing numbers: servers that can be reached on the old revision but not on the new one.
  refused_newer_after_answering_older: flips.length,
  failed_400_in_both_legs: bothLegFailures,
  answered_newer_but_not_older: reverseFlips,
  askable_on_newer_revision: answering(modern).length,
  flips,
};

console.log(JSON.stringify(report, null, 2));
// A report where the two legs cover different endpoints never reaches here: it throws above.
process.exit(0);
