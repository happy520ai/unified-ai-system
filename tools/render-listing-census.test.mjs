import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { classifyDiff, diffRows, machineBlock, parseCarriers, parseDirectories, parseSweep, publishBlocker, readMachine, render } from "./render-listing-census.mjs";

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

test("a listing that cannot be re-read tonight is not reported as a listing that left", () => {
  // The difference between drift and blindness decides whether this guard gets acted on or muted. A third-party
  // sitemap that answers 403 for one night must not be able to say "we are no longer listed anywhere".
  const listed = { kind: "directory", site: "https://a.test", verdict: "LISTED", evidence: "https://a.test/servers/x" };
  const refuted = { kind: "directory", site: "https://a.test", verdict: "NOT_FOUND", evidence: null };
  const unreadable = { kind: "directory", site: "https://a.test", verdict: "UNDECIDABLE", evidence: null };
  const dropped = { kind: "directory", site: "https://b.test", verdict: "UNREADABLE", evidence: null };

  const gone = classifyDiff([listed], [refuted]);
  assert.deepEqual(gone.gone.map((g) => g.fresh.verdict), ["NOT_FOUND"], "a positive reading of absence is drift");
  assert.deepEqual(gone.unproven, []);

  const blind = classifyDiff([listed], [unreadable]);
  assert.deepEqual(blind.gone, [], "an inconclusive probe may not be written up as a deletion");
  assert.deepEqual(blind.unproven.map((u) => u.fresh.verdict), ["UNDECIDABLE"]);

  const vanishedRow = classifyDiff([listed], [dropped]);
  assert.deepEqual(vanishedRow.unproven.map((u) => (u.fresh ? "row" : "absent")), ["absent"],
    "a site missing from the report is blindness, not drift");

  // An appearance is only publishable news when the fresh verdict is itself a reading.
  const freshListing = { kind: "catalogue", repo: "new/awesome", verdict: "LISTED", path: "README.md" };
  const unconfirmed = { kind: "catalogue", repo: "other/awesome", verdict: "BLOCKED", path: "" };
  const added = classifyDiff([], [freshListing, unconfirmed]);
  assert.deepEqual(added.appeared.map((r) => r.repo), ["new/awesome"]);
  assert.deepEqual(added.appearedUnproven.map((r) => r.repo), ["other/awesome"]);
});

test("the nightly job re-probes the page, so a removed listing is a red step", () => {
  const yml = readFileSync(join(ROOT, ".github/workflows/star-growth-snapshot.yml"), "utf8");
  assert.match(yml, /node tools\/render-listing-census\.mjs --check --allow-unreadable/u,
    "the census must be re-checked on a schedule, with blindness distinguished from drift");
  assert.match(yml, /fetch-depth: 0/u, "the same job must carry full history, which the sitemap check needs");
  assert.equal((yml.match(/render-listing-census\.mjs/gu) || []).length, 1, "exactly one census invocation - a duplicated step would double the probes");
});

// The write path, not the classification: check-carrier-presence.mjs exits 0 for "I ran", so a probe that
// read nothing would otherwise publish a page that silently un-claims every listing it used to carry.
test("a blind carrier probe cannot overwrite the published page", () => {
  const blind = { carriers: { summary: { listed: 0, watchlisted: 0, absent: 0, unreadable: 12 } } };
  assert.equal(typeof publishBlocker(blind), "string", "unreadable=12 must block the write");
  assert.match(publishBlocker(blind), /12 listing/u);
});

test("a listing that really left still publishes, because absence is a finding and not a blind spot", () => {
  const honest = { carriers: { summary: { listed: 10, watchlisted: 1, absent: 1, unreadable: 0 } } };
  assert.equal(publishBlocker(honest), null, "absent=1 must not be folded into blindness");
});

test("a missing summary line is the third failure shape and is refused too", () => {
  assert.equal(typeof publishBlocker({ carriers: { summary: null } }), "string");
  assert.equal(typeof publishBlocker({}), "string");
});

test("the guard sits on the write path, not only in the prose", () => {
  const src = readFileSync(join(ROOT, "tools/render-listing-census.mjs"), "utf8");
  const guard = src.indexOf("publishBlocker(census)");
  const write = src.indexOf('writeFileSync(OUT, text, "utf8")');
  assert.ok(guard > 0, "the guard must exist in the generator");
  assert.ok(write > guard, "and must be evaluated before the file is written");
  assert.equal(src.split("writeFileSync(OUT").length - 1, 1, "exactly one writer, so no second path bypasses it");
});

// The organic leg: other people's copies of our skill file. Shape of the fixture is the real --json output of
// tools/growth-mention-sweep.mjs, trailing summary line included, because that trailing line is what would
// otherwise make the whole stream unparseable.
const SWEEP_FIXTURE = JSON.stringify({
  total_count: 303, rows_returned: 291, pages: 4, exhausted: true, truncated: false,
  tally: { SELF: 1, MONITORED: 12, CANDIDATE_CATALOGUE: 6, REDISTRIBUTION: 2, MIRROR: 2, AGGREGATOR: 6, PERSONAL: 4 },
  repos: [
    { repo: "zed/collection", group: "REDISTRIBUTION", files: 1, paths: ["skills/unified-ai-gateway/SKILL.md"] },
    { repo: "alpha/skills", group: "REDISTRIBUTION", files: 3, paths: ["mirrored/unified-ai-gateway/SKILL.md", "README.md"] },
    // A row that matched inside someone else's generated index: same file name in the search, not our file.
    { repo: "beta/mirror", group: "REDISTRIBUTION", files: 2, paths: ["mirrors/repos/zed-cursor/SKILL.md"] },
    { repo: "someone/list", group: "CANDIDATE_CATALOGUE", files: 1, paths: ["README.md"] },
    { repo: "happy520ai/unified-ai-system", group: "SELF", files: 5, paths: ["skills/unified-ai-gateway/SKILL.md"] },
  ],
}, null, 1) + "\nMENTION_SUMMARY repos=5 monitored=0 candidates=1 redistribution=3 mirror=0 aggregator=0 personal=0 self=1";

const CURATED_ROW = { kind: "catalogue", repo: "a/b", verdict: "LISTED", path: "README.md" };
const SURFACE_ROW = { kind: "surface", repo: "x/y", group: "redistribution", files: 1, path: "skills/unified-ai-gateway/SKILL.md" };

test("the sweep's redistribution rows become surface rows, and nothing else does", () => {
  const parsed = parseSweep(SWEEP_FIXTURE);
  assert.equal(parsed.error, null, SWEEP_FIXTURE.slice(-80));
  assert.equal(parsed.rows.length, 3, "redistribution only: candidate catalogues and our own repo are not listed here");
  assert.deepEqual(parsed.rows.map((r) => r.repo), ["alpha/skills", "beta/mirror", "zed/collection"], "sorted, so the block is byte-stable");
  assert.deepEqual(parsed.rows[0], { kind: "surface", repo: "alpha/skills", group: "redistribution", files: 3, path: "mirrored/unified-ai-gateway/SKILL.md" });
  assert.equal(parsed.truncated, false);
  assert.equal(parseSweep("this was never json").error !== null, true, "an unreadable leg is named as one");
  const cut = parseSweep(SWEEP_FIXTURE.replace('"truncated": false', '"truncated": true'));
  assert.equal(cut.truncated, true, "a subset reading has to reach the page, not just the console");
});

test("a surface row moving is reported and never adjudicated; a curated row moving is still drift", () => {
  const dropped = classifyDiff([CURATED_ROW, SURFACE_ROW], [CURATED_ROW]);
  assert.equal(dropped.gone.length, 0, "an organic copy that vanished must not be called a lost listing");
  assert.equal(dropped.unproven.length, 0, "nor an unconfirmed curated row");
  assert.equal(dropped.appeared.length, 0);
  assert.equal(dropped.surfaceChanged, 1, "but the change is counted, so it is not silently absorbed");

  const refuted = classifyDiff([CURATED_ROW, SURFACE_ROW], [SURFACE_ROW]);
  assert.equal(refuted.unproven.length, 1, "a curated row the fresh probe no longer reports is still a claim at risk");
  assert.equal(refuted.surfaceChanged, 0);

  const contradicted = classifyDiff([CURATED_ROW], [{ ...CURATED_ROW, verdict: "ABSENT" }]);
  assert.equal(contradicted.gone.length, 1, "and a curated row positively read as absent is drift");
});

test("the page states the organic count it was given, and says nothing when the leg did not read", () => {
  const census = {
    carriers: { rows: [CURATED_ROW], summary: { listed: 1, watchlisted: 0, absent: 0, unreadable: 0 } },
    directories: { rows: [], summary: { listed: 0, not_found: 0, undecidable: 0 } },
    surfaces: parseSweep(SWEEP_FIXTURE),
  };
  const page = render(census, "2026-09-29");
  const matched = Number(/(\d+) repositories matched a code search/u.exec(page)[1]);
  const copies = Number(/Of them, (\d+) carry a copy of the file/u.exec(page)[1]);
  const mentions = Number(/and (\d+) name it from an index/u.exec(page)[1]);
  const block = readMachine(page);
  assert.equal(matched, 3, "the sentence in the prose counts every matched row");
  assert.equal(copies, 2, "and separates the rows that hold our file from the ones that only name it");
  assert.equal(mentions, 1, "the index row is named as such rather than counted as a copy");
  assert.equal(copies + mentions, matched, "the split must add up to the matched count");
  assert.equal(block.rows.filter((r) => r.kind === "surface").length, matched, "both counts come from the machine block");
  assert.equal(page.includes("| yes |"), true, "the table says which kind each row is");
  assert.equal(page.includes("| no - index |"), true, "and does not hide the index rows");
  assert.equal(block.surface_leg, "read");
  assert.equal(page.includes("## Curated catalogues that carry an entry"), true, "the curated table is unaffected");

  const blind = render({ ...census, surfaces: parseSweep("garbage") }, "2026-09-29");
  assert.equal(readMachine(blind).surface_leg, "unreadable");
  assert.equal(readMachine(blind).rows.filter((r) => r.kind === "surface").length, 0);
  assert.match(blind, /Nothing is claimed here on this run/u, "and the page says so in words, not by leaving a blank table");
  assert.equal(blind.includes("repositories matched a code search"), false, "no count is printed for a leg that did not read");
});
