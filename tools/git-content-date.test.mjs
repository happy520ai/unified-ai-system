// The rule this module exists to hold: a page's published date follows its content, not whoever last
// committed a date. Two of these arms read real repository bytes and are named below; the rest run against
// an injected git so the walk is exercised without depending on what history looks like next week.
import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { isDateOnlyChange, lastContentChange, isoUtc } from "./git-content-date.mjs";

const git = (args) => spawnSync("git", args, { encoding: "utf8" }).stdout;

// A git stand-in that replays a prepared history, so the walk itself is testable at any commit.
function fakeGit(records) {
  return (bin, args) => {
    assert.equal(bin, "git");
    assert.ok(args.includes("-p"), "the walk needs patches, not just commit headers");
    const wanted = args[args.indexOf("--") + 1];
    const mine = records.filter((r) => r.path === wanted);
    if (mine.length === 0) return "";
    return mine.map((r) => "\0" + r.sha + " " + r.date + "\n" + r.patch).join("");
  };
}

const CONTENT_PATCH = [
  "diff --git a/docs/x.html b/docs/x.html",
  "index 1111111..2222222 100644",
  "--- a/docs/x.html",
  "+++ b/docs/x.html",
  "@@ -10 +10 @@",
  "-<p>The demo takes twelve seconds.</p>",
  "+<p>The demo takes 14.0 s on the one run we have on file.</p>",
].join("\n");

const RESTAMP_PATCH = [
  "diff --git a/docs/x.html b/docs/x.html",
  "index 2222222..3333333 100644",
  "--- a/docs/x.html",
  "+++ b/docs/x.html",
  "@@ -12 +12 @@",
  '-  "dateModified": "2026-09-29T08:03:44Z",',
  '+  "dateModified": "2026-09-30T00:10:10Z",',
  "@@ -30 +30 @@",
  '-<meta property="article:modified_time" content="2026-09-29T08:03:44Z">',
  '+<meta property="article:modified_time" content="2026-09-30T00:10:10Z">',
].join("\n");

test("a commit that moved only date values is not a content change", () => {
  assert.equal(isDateOnlyChange(RESTAMP_PATCH), true);
  // ...and one that moved a sentence is. The pair is the point: a classifier that answered false twice would
  // make every restamp look like content, which is the behaviour that made the nightly unsatisfiable.
  assert.equal(isDateOnlyChange(CONTENT_PATCH), false);
});

test("the must-not-fire shapes all read as content", () => {
  // An empty patch is a rename or a mode change. Counting it as a restamp would freeze a page's date while
  // its URL moved, so the safe direction is "this is a change".
  assert.equal(isDateOnlyChange(""), false);
  assert.equal(isDateOnlyChange("diff --git a/x b/x\nindex 1..2\n--- a/x\n+++ b/x\n"), false);
  // Prose about the metadata keys carries no ISO value on the line, so it must not look like a restamp.
  assert.equal(isDateOnlyChange('-<p>"dateModified": is the key a crawler reads.</p>\n+<p>"dateModified": is what we publish.</p>'), false);
  // A content edit inside the same hunk as a date edit is still content.
  assert.equal(isDateOnlyChange(RESTAMP_PATCH + "\n+<p>New paragraph.</p>"), false);
});

test("the walk steps over restamps and names how many", () => {
  const run = fakeGit([
    { path: "docs/x.html", sha: "ccc", date: "2026-09-30T00:10:10+00:00", patch: RESTAMP_PATCH },
    { path: "docs/x.html", sha: "bbb", date: "2026-09-30T00:06:19+00:00", patch: RESTAMP_PATCH },
    { path: "docs/x.html", sha: "aaa", date: "2026-09-29T08:03:44+00:00", patch: CONTENT_PATCH },
  ]);
  const read = lastContentChange("docs/x.html", { run });
  assert.equal(read.sha, "aaa", "two restamps must not re-date the page behind their own commit");
  assert.equal(read.date, "2026-09-29T08:03:44Z");
  assert.equal(read.skipped, 2);
  assert.equal(read.error, null);
});

test("an all-restamp history refuses instead of inventing a date", () => {
  const run = fakeGit([
    { path: "docs/y.html", sha: "ccc", date: "2026-09-30T00:10:10+00:00", patch: RESTAMP_PATCH },
    { path: "docs/y.html", sha: "bbb", date: "2026-09-29T21:43:10+00:00", patch: RESTAMP_PATCH },
  ]);
  const read = lastContentChange("docs/y.html", { run });
  assert.equal(read.date, null, "no content commit in range must not fall back to the newest touch");
  assert.equal(read.sha, "");
  assert.match(read.error, /no content change in the last 2 commit\(s\)/u);
});

test("a date-only change in another file cannot excuse this one", () => {
  // The patch text is per path. A commit that restamped page A while rewriting page B has to count as
  // content for B, so the classification must never see A's lines.
  const run = (bin, args) => {
    const wanted = args[args.indexOf("--") + 1];
    if (wanted !== "docs/b.html") throw new Error("the walk must ask about one path at a time, got " + wanted);
    return "\0ddd 2026-09-30T00:10:10+00:00\n" + CONTENT_PATCH;
  };
  assert.equal(lastContentChange("docs/b.html", { run }).sha, "ddd");
});

test("on this repository's history the reading is sourced, and restamps are visible in it", () => {
  const path = "docs/prompt-enhancement.html";
  const read = lastContentChange(path);
  assert.equal(read.error, null, read.error);
  // The date must come from the commit it names, not from the clock: read that commit's own metadata back
  // through a different git call.
  const own = isoUtc(git(["show", "-s", "--format=%cI", read.sha]).trim());
  assert.equal(read.date, own, "the reported date must be the reported commit's date");
  // Real bytes both ways: this page has been restamped and rewritten, and the module has to separate the two
  // kinds of commit in its own history rather than in a fixture.
  const bodies = new Map();
  let current = null;
  for (const line of git(["log", "--format=%H %cI", "--unified=0", "-p", "-n", "20", "--", path]).split("\n")) {
    const m = /^([0-9a-f]{40}) (2\d{3}-\S+)$/u.exec(line);
    if (m) { current = m[1]; bodies.set(current, ""); continue; }
    if (current) bodies.set(current, bodies.get(current) + line + "\n");
  }
  assert.ok(bodies.size >= 2, "expected a datable history for " + path + ", got " + bodies.size + " commit(s)");
  const restamps = [...bodies].filter(([, body]) => isDateOnlyChange(body));
  const content = [...bodies].filter(([, body]) => !isDateOnlyChange(body));
  assert.ok(restamps.length >= 1, "no restamp found in 20 commits: the fixture-free arm has nothing to separate");
  assert.ok(content.length >= 1, "every commit was read as a restamp, so the classifier is over-firing");
  // Independent oracle, deliberately written differently from DATE_VALUE_LINE_RE: a commit counted as a
  // restamp must change only lines whose added or removed text contains an ISO date.
  for (const [sha, body] of restamps) {
    for (const line of body.split("\n")) {
      if (line[0] !== "+" && line[0] !== "-") continue;
      const text = line.slice(1);
      if (text.startsWith("++") || text.startsWith("--")) continue;
      assert.ok(text.includes("2026-") || text.includes("2027-"), sha + ": classified as a restamp but this line has no date: " + text.slice(0, 80));
    }
  }
  // The reading must be no newer than the newest commit touching the path - and if it is older, it is older
  // precisely because a restamp was stepped over.
  const newest = git(["log", "-1", "--format=%cI", "--", path]).trim();
  assert.ok(Date.parse(read.date) <= Date.parse(newest), read.date + " is newer than the newest commit " + newest);
  if (read.date !== isoUtc(newest)) assert.ok(read.skipped >= 1, "older than the newest touch but skipped nothing: the walk and the classifier disagree");
});

test("an unreadable path is named as unreadable, not dated", () => {
  const read = lastContentChange("docs/no-such-page-ever-written.html");
  assert.equal(read.date, null);
  assert.equal(read.sha, "");
  assert.match(read.error, /no commit reports this path|git log -p failed/u);
});
