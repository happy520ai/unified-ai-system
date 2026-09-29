import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { diffRows, machineBlock, parseCarriers, parseDirectories, readMachine } from "./render-listing-census.mjs";

const ROOT = resolve(import.meta.dirname, "..");

const CARRIER_SAMPLE = [
  "some-repo/awesome-things       LISTED       README.md",
  "  versions                                   [\"0.8.0\"] tool counts [15]",
  "other-repo/skills              WATCHLISTED  WATCHLIST.md",
  "not-a-verdict-line about something else",
  "broken/one                     UNREADABLE",
  "CARRIER_SUMMARY listed=1 watchlisted=1 absent=0 unreadable=1",
].join(String.fromCharCode(10));

const DIRECTORY_SAMPLE = JSON.stringify({
  checked_at_utc: "2026-09-29T12:00:00.000Z",
  report: [
    { site: "https://a.test", verdict: "LISTED", why: "entry found in a sitemap child", evidence: "https://a.test/servers/x", pagesRead: 8, urlsSeen: 400, blockedLegs: ["root 403"] },
    { site: "https://b.test", verdict: "NOT_FOUND", why: "slug absent from every readable page", pagesRead: 3, urlsSeen: 90, blockedLegs: [] },
  ],
}, null, 1) + String.fromCharCode(10) + "SUMMARY listed=1 not_found=1 undecidable=0";

test("the carrier table is parsed by its columns, and an unreadable leg is a row not an absence", () => {
  const { rows, summary } = parseCarriers(CARRIER_SAMPLE);
  assert.deepEqual(rows.map((r) => [r.repo, r.verdict]), [["some-repo/awesome-things", "LISTED"], ["other-repo/skills", "WATCHLISTED"], ["broken/one", "UNREADABLE"]],
    "the indented facts line must not become a row: " + JSON.stringify(rows.map((r) => r.repo)));
  assert.deepEqual(rows[0], { repo: "some-repo/awesome-things", verdict: "LISTED", path: "README.md", kind: "catalogue" });
  assert.deepEqual(summary, { listed: 1, watchlisted: 1, absent: 0, unreadable: 1 });
});

test("a directory report that cannot be parsed is an error, never an empty set", () => {
  const good = parseDirectories(DIRECTORY_SAMPLE);
  assert.equal(good.rows.length, 2);
  assert.deepEqual(good.rows[0], { site: "https://a.test", verdict: "LISTED", evidence: "https://a.test/servers/x", why: "entry found in a sitemap child",
    pagesRead: 8, urlsSeen: 400, blockedLegs: 1, kind: "directory" });
  assert.deepEqual(good.summary, { listed: 1, not_found: 1, undecidable: 0 });
  // A truncated or absent report must not read as "no directories list us".
  const broken = parseDirectories("not json at all\nSUMMARY listed=0 not_found=0 undecidable=0");
  assert.equal(broken.rows.length, 0);
  assert.ok(broken.error, "an unparseable probe has to say so");
  assert.equal(parseDirectories("").summary, null);
});

test("the machine block round-trips, and a new measurement date is not drift", () => {
  const census = { carriers: parseCarriers(CARRIER_SAMPLE), directories: parseDirectories(DIRECTORY_SAMPLE) };
  const first = readMachine(machineBlock(census, "2026-09-29"));
  const second = readMachine(machineBlock(census, "2026-10-04"));
  assert.ok(first && second, "the block must parse back out of the markdown");
  assert.equal(first.rows.length, 5, "3 catalogue rows and 2 directory rows");
  assert.deepEqual(diffRows(first.rows, second.rows), { disappeared: [], appeared: [] },
    "the dates differ by design; if they counted as drift the nightly would red every day after the first");
  assert.equal(first.measured, "2026-09-29");
});

test("drift is detected in both directions and names the listing", () => {
  const row = { kind: "catalogue", repo: "some-repo/awesome-things", verdict: "LISTED", path: "README.md" };
  const gone = { kind: "catalogue", repo: "some-repo/awesome-things", verdict: "ABSENT", path: "" };
  const d1 = diffRows([row], [gone]);
  assert.deepEqual(d1.disappeared.map((r) => r.repo), ["some-repo/awesome-things"]);
  assert.deepEqual(d1.appeared.map((r) => r.verdict), ["ABSENT"]);
  // A listing that appears is reported too: the page under-advertising is the quieter half of the same bug.
  const d2 = diffRows([gone], [row]);
  assert.deepEqual(d2.disappeared.map((r) => r.verdict), ["ABSENT"]);
  assert.deepEqual(d2.appeared.map((r) => r.repo), ["some-repo/awesome-things"]);
});

test("the shipped census page cites a checkable target for every row it advertises", () => {
  const md = readFileSync(join(ROOT, "docs", "listing-census.md"), "utf8");
  const machine = readMachine(md);
  assert.ok(machine, "the committed page must carry its machine block");
  assert.ok(machine.rows.length >= 10, "expected the full census, saw " + machine.rows.length);
  const catalogues = machine.rows.filter((r) => r.kind === "catalogue");
  const directories = machine.rows.filter((r) => r.kind === "directory");
  assert.ok(catalogues.length >= 7 && directories.length >= 5, "both legs must be represented: " + catalogues.length + "/" + directories.length);
  for (const r of catalogues) {
    assert.match(r.repo, /^[\w.-]+\/[\w.-]+$/u, "a catalogue row names a repository");
    if (r.verdict === "LISTED" || r.verdict === "WATCHLISTED") assert.ok(r.path.length > 0, r.repo + " must name the file we appear in");
  }
  for (const r of directories) {
    if (r.verdict === "LISTED") assert.match(String(r.evidence), /^https:\/\//u, r.site + " must cite the URL that proves it");
    assert.ok(["LISTED", "NOT_FOUND", "UNDECIDABLE", "BLOCKED"].includes(r.verdict), r.site + " verdict " + r.verdict);
  }
  // By construction the generator refuses to publish a census with an unreadable leg, so a published
  // UNREADABLE row means someone bypassed it - and that is what this assertion is for.
  assert.deepEqual(machine.rows.filter((r) => r.verdict === "UNREADABLE"), [], "an unreadable leg may not be published as a listing");
  assert.doesNotMatch(md, /unverifiable|could not read/u, "the page text must not advertise a leg it could not read");
  // Every claim on the page must be re-checkable by a reader: the probes are named, and the page says so.
  assert.match(md, /tools\/check-carrier-presence\.mjs/u);
  assert.match(md, /tools\/check-directory-presence\.mjs/u);
});

test("the nightly job re-probes the page, so a removed listing is a red step", () => {
  const yml = readFileSync(join(ROOT, ".github/workflows/star-growth-snapshot.yml"), "utf8");
  assert.match(yml, /node tools\/render-listing-census\.mjs --check/u, "the census must be re-checked on a schedule");
  assert.match(yml, /fetch-depth: 0/u, "the same job must carry full history, which the sitemap check needs");
  assert.equal((yml.match(/render-listing-census\.mjs/gu) || []).length, 1, "exactly one census invocation - a duplicated step would double the probes");
});
