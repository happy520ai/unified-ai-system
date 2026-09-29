import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFileSync, writeFileSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";

const ROOT = resolve(import.meta.dirname, "..");
const GEN = join(ROOT, "tools/probe-mcp-registry-visibility-params.mjs");
const SHIPPED = "docs/data/mcp-registry-visibility-params.2026-09-29.json";
const OFFICIAL = "io.modelcontextprotocol.registry/official";
const dir = mkdtempSync(join(tmpdir(), "visprobe-"));

// Imported, not spawned: a top-level network run in this file's first revision was the bug the isMain
// guard exists to prevent, and every test below would have paid for it.
const { latestTally, statusTally, evaluate } = await import(pathToFileURL(GEN).href);

const DOC = ["cursor", "limit", "updated_since", "search", "version", "include_deleted"];
const SHA_A = "aaaa";
const SHA_B = "bbbb";

// The instrument stores the instants it compared against, so the fixture has to carry them too.
const PARAMS = {
  updated_since_week: "2026-09-22T00:00:00.000Z",
  updated_since_future: "2026-10-29T00:00:00.000Z",
  updated_since_bogus: "not-a-date",
};

function row(isLatest, status) {
  return { _meta: { [OFFICIAL]: { isLatest, status } } };
}

// A healthy page set, shaped like the real artifact but small enough to read. `default` is deliberately a
// mix of latest and superseded, and its sha equals `status_active` - both are the claims the census page
// makes, so a fixture that satisfies every guard is the boundary that says the guards are not always on.
function healthyPages() {
  return {
    default: { http: 200, rows: 5, statuses: { active: 4, deprecated: 1 }, latest: { latest: 3, not_latest: 2 }, cursor: true, sha256: SHA_A },
    include_deleted_false: { http: 200, rows: 5, statuses: { active: 4, deprecated: 1 }, latest: { latest: 3, not_latest: 2 }, cursor: true, sha256: SHA_A },
    include_deleted_true: { http: 200, rows: 5, statuses: { active: 3, deprecated: 1, deleted: 1 }, latest: { latest: 3, not_latest: 2 }, cursor: true, sha256: SHA_B },
    status_active: { http: 200, rows: 5, statuses: { active: 5 }, latest: { latest: 3, not_latest: 2 }, cursor: true, sha256: SHA_A },
    include_deleted_bogus: { http: 422, rows: 0, statuses: {}, latest: { latest: 0, not_latest: 0 }, cursor: false, sha256: SHA_B },
    version_latest: { http: 200, rows: 5, statuses: { active: 4, deprecated: 1 }, latest: { latest: 5, not_latest: 0 }, cursor: true, sha256: SHA_B },
    version_bogus: { http: 200, rows: 0, statuses: {}, latest: { latest: 0, not_latest: 0 }, cursor: false, sha256: SHA_B },
    updated_since_week: { http: 200, rows: 5, statuses: { active: 5 }, latest: { latest: 5, not_latest: 0 }, cursor: true, sha256: SHA_B, filter_param: PARAMS.updated_since_week, min_updated_at: "2026-09-22T02:00:00.000Z", min_published_at: "2026-09-01T02:00:00.000Z" },
    updated_since_future: { http: 200, rows: 0, statuses: {}, latest: { latest: 0, not_latest: 0 }, cursor: false, sha256: "cccc", filter_param: PARAMS.updated_since_future },
    updated_since_bogus: { http: 400, rows: 0, statuses: {}, latest: { latest: 0, not_latest: 0 }, cursor: false, sha256: "dddd", filter_param: PARAMS.updated_since_bogus },
  };
}

function run(args) {
  return spawnSync(process.execPath, [GEN, ...args], { cwd: ROOT, encoding: "utf8" });
}

function writeFixture(name, obj) {
  const p = join(dir, name + ".json");
  writeFileSync(p, JSON.stringify(obj, null, 2), "utf8");
  return p;
}

test("the latest tally counts members and reads isLatest, not a field that happens to be adjacent", () => {
  const body = { servers: [row(true, "active"), row(true, "active"), row(true, "deprecated"), row(false, "active"), { note: "no _meta at all" }] };
  assert.deepEqual(latestTally(body), { latest: 3, not_latest: 2 });
  assert.deepEqual(statusTally(body), { active: 3, deprecated: 1, absent: 1 });

  // Tamper target: the same five rows, but the boolean parked under a different key. If the tally were
  // reading anything other than isLatest it would keep answering 3/2 here and the census numbers would be
  // fiction on a green CI.
  const renamed = { servers: body.servers.map((r) => ({ _meta: { [OFFICIAL]: { status: (((r._meta || {})[OFFICIAL] || {}).isLatest) } } })) };
  const after = latestTally(renamed);
  assert.deepEqual(after, { latest: 0, not_latest: 5 });
  assert.notEqual(JSON.stringify(after), JSON.stringify(latestTally(body)));
});

test("evaluate accepts a healthy fixture, so the guards are not always on", () => {
  const { problems, facts } = evaluate({ documented: DOC, pages: healthyPages(), specStatus: 200, params: PARAMS });
  assert.deepEqual(problems, []);
  assert.equal(facts.status_param_documented, false);
  assert.equal(facts.status_param_matches_no_filter_sha, true);
  assert.equal(facts.version_param_documented, true);
  assert.equal(facts.version_latest_returns_only_current, true);
  assert.equal(facts.version_bogus_returns_zero_rows, true);
  assert.equal(facts.deleted_status_seen_only_with_include_deleted, true);
  assert.deepEqual(facts.version_latest_page, { latest: 5, not_latest: 0 });
  assert.deepEqual(facts.default_page_latest_mix, { latest: 3, not_latest: 2 });
});

test("each changed reading fires exactly its own problem", () => {
  const cases = [
    ["version=latest returns a superseded row", (p) => { p.version_latest.latest = { latest: 4, not_latest: 1 }; }, /isLatest not true/],
    ["version=latest returns nothing", (p) => { p.version_latest.rows = 0; p.version_latest.latest = { latest: 0, not_latest: 0 }; }, /empty first page/],
    ["version=not-a-real-value returns rows", (p) => { p.version_bogus.rows = 3; }, /NOT a real filter/],
    ["status=active stops being ignored", (p) => { p.status_active.sha256 = SHA_B; }, /NOT ignored on page 1/],
    ["include_deleted=nope stops returning 422", (p) => { p.include_deleted_bogus.http = 200; }, /did not return 422/],
    ["a first-page read fails", (p) => { p.default.http = 500; }, /a first-page read failed/],
  ];
  for (const [label, mutate, expect] of cases) {
    const pages = healthyPages();
    mutate(pages);
    const { problems } = evaluate({ documented: DOC, pages, specStatus: 200, params: PARAMS });
    assert.equal(problems.length, 1, label + ": expected one problem, got " + JSON.stringify(problems));
    assert.match(problems[0], expect, label);
  }

  // The two parameter-list arms are about the spec, not the pages.
  const noVersion = evaluate({ documented: DOC.filter((n) => n !== "version"), pages: healthyPages(), specStatus: 200, params: PARAMS });
  assert.equal(noVersion.problems.length, 1);
  assert.match(noVersion.problems[0], /version is not in the documented parameters/);
  assert.equal(noVersion.facts.version_param_documented, false);

  const noInclude = evaluate({ documented: DOC.filter((n) => n !== "include_deleted"), pages: healthyPages(), specStatus: 200, params: PARAMS });
  assert.equal(noInclude.problems.length, 1);
  assert.match(noInclude.problems[0], /include_deleted is not in the documented parameters/);

  const noSpec = evaluate({ documented: [], pages: healthyPages(), specStatus: 500, params: PARAMS });
  assert.ok(noSpec.problems.some((x) => /openapi.json unreadable/.test(x)));
});

test("replay accepts the shipped artifact and reports no drift", () => {
  const r = run(["--replay", SHIPPED]);
  assert.equal(r.status, 0, r.stdout + r.stderr);
  const read = JSON.parse(r.stdout);
  assert.equal(read.drift_count, 0);
  assert.equal(read.problem_count, 0);
  // Cross-read the shipped artifact so the CLI is not being tested against its own echo: the stored fact
  // has to equal the stored pages, checked here rather than only inside the instrument.
  const saved = JSON.parse(readFileSync(join(ROOT, SHIPPED), "utf8"));
  assert.equal(saved.problem_count, 0);
  assert.deepEqual(read.drift, []);
  assert.deepEqual(saved.version_latest_page, saved.pages.version_latest.latest);
  assert.deepEqual(saved.default_page_latest_mix, saved.pages.default.latest);
  assert.equal(saved.version_bogus_returns_zero_rows, saved.pages.version_bogus.rows === 0);
});

test("replay refuses an edited verdict that no longer follows from its own pages", () => {
  const saved = JSON.parse(readFileSync(join(ROOT, SHIPPED), "utf8"));
  const flipped = { ...saved, version_param_documented: false };
  assert.notEqual(JSON.stringify(flipped), JSON.stringify(saved));
  const p = writeFixture("flipped", flipped);
  const r = run(["--replay", p]);
  assert.equal(r.status, 4, r.stdout + r.stderr);
  assert.match(r.stdout, /version_param_documented: stored false, recomputed true/);
});

test("replay refuses when new pages contradict a stored escape-hatch verdict", () => {
  const saved = JSON.parse(readFileSync(join(ROOT, SHIPPED), "utf8"));
  const stale = { ...saved, pages: { ...saved.pages, version_latest: { ...saved.pages.version_latest, latest: { latest: 93, not_latest: 7 } } } };
  assert.notEqual(JSON.stringify(stale.pages.version_latest.latest), JSON.stringify(saved.pages.version_latest.latest));
  const p = writeFixture("stale", stale);
  const r = run(["--replay", p]);
  assert.equal(r.status, 4, r.stdout + r.stderr);
  assert.match(r.stdout, /version_latest_returns_only_current: stored true, recomputed false/);
  // The same run also re-derives the problem list from those pages, so a reader sees both readings.
  assert.match(r.stdout, /isLatest not true/);
});

test("--help prints the two modes and does not reach the network", () => {
  const r = run(["--help"]);
  assert.equal(r.status, 0, r.stderr);
  assert.match(r.stdout, /--out <artifact\.json>/);
  assert.match(r.stdout, /--replay <artifact\.json>/);
});

test("the updated_since facts are pinned and each guard fires on its own reading", () => {
  const healthy = evaluate({ documented: DOC, pages: healthyPages(), specStatus: 200, params: PARAMS });
  assert.deepEqual(healthy.problems, [], JSON.stringify(healthy.problems));
  assert.equal(healthy.facts.updated_since_param_documented, true);
  assert.equal(healthy.facts.updated_since_filters_by_updated_at, true);
  // The published-timestamp verdict is expected to be FALSE in the fixture, and reported rather than
  // asserted-true on the page: the finding is that the filter reads updatedAt, not publishedAt.
  assert.equal(healthy.facts.updated_since_matches_published_at, false);
  assert.equal(healthy.facts.updated_since_future_returns_zero_rows, true);
  assert.equal(healthy.facts.updated_since_bogus_status, 400);

  const cases = [
    ["a row whose updatedAt precedes the parameter leaks", (p) => { p.updated_since_week.min_updated_at = "2026-09-01T00:00:00.000Z"; }, /updated_since leaked/],
    ["the week leg returns nothing", (p) => { p.updated_since_week.rows = 0; p.updated_since_week.min_updated_at = null; }, /empty first page, so nothing can be concluded about the filter/],
    ["a future date returns rows", (p) => { p.updated_since_future.rows = 4; }, /30 days in the future> returned rows/],
    ["a bad date stops being a 400", (p) => { p.updated_since_bogus.http = 200; }, /answered 200, not the 400/],
  ];
  for (const [label, mutate, expect] of cases) {
    const pages = healthyPages();
    mutate(pages);
    const { problems } = evaluate({ documented: DOC, pages, specStatus: 200, params: PARAMS });
    assert.equal(problems.length, 1, label + ": expected one problem, got " + JSON.stringify(problems));
    assert.match(problems[0], expect, label);
  }

  // An artifact from before these legs is not a pass and not an absence - it is an instrument that cannot
  // see, so it must throw rather than fold "missing" into a zero.
  const missing = healthyPages();
  delete missing.updated_since_week;
  assert.throws(() => evaluate({ documented: DOC, pages: missing, specStatus: 200, params: PARAMS }), /predates the updated_since legs/);

  const undocumented = evaluate({ documented: DOC.filter((n) => n !== "updated_since"), pages: healthyPages(), specStatus: 200, params: PARAMS });
  assert.ok(undocumented.problems.some((x) => /updated_since is not in the documented parameters/.test(x)), JSON.stringify(undocumented.problems));
  assert.equal(undocumented.facts.updated_since_param_documented, false);
});

test("replay names a flipped updated_since verdict on the shipped artifact", () => {
  const saved = JSON.parse(readFileSync(join(ROOT, SHIPPED), "utf8"));
  const edited = { ...saved, updated_since_bogus_status: 422 };
  assert.notEqual(JSON.stringify(edited), JSON.stringify(saved), "the fixture must actually change bytes");
  const p = writeFixture("flip-bogus", edited);
  const r = run(["--replay", p]);
  assert.equal(r.status, 4, r.stdout + r.stderr);
  assert.match(r.stdout, /updated_since_bogus_status: stored 422, recomputed 400/);
});
