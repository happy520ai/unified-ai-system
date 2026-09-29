// Each arm gets a fixture that makes it fire, and one that must not. The failure this guards
// against is a third-party index returning nothing and being read as "our skill has no installs"
// or "nobody mirrors us" - so the unreadable legs are asserted as loudly as the counting.
import test from "node:test";
import assert from "node:assert/strict";
import { classify, legFromPayload, run, exitCodeFor } from "./check-skill-index-installs.mjs";

const REAL = {
  skills: [
    { id: "happy520ai/unified-ai-system/unified-ai-gateway", source: "happy520ai/unified-ai-system", installs: 3 },
    { id: "sickn33/agentic-awesome-skills/unified-ai-gateway", source: "sickn33/agentic-awesome-skills", installs: 8 },
    { id: "someoneelse/other/top-skill", source: "someoneelse/other", installs: 736754 },
  ],
  count: 70,
  searchType: "semantic",
};

test("classifies our row apart from mirrors and sums installs per bucket", () => {
  const v = classify(REAL.skills);
  assert.deepEqual(
    { matched: v.matched, direct: v.direct, directInstalls: v.directInstalls, mirrorInstalls: v.mirrorInstalls, unreadable: v.unreadableInstalls },
    { matched: 2, direct: 1, directInstalls: 3, mirrorInstalls: 8, unreadable: 0 },
  );
  assert.deepEqual(v.mirrorSources, ["sickn33/agentic-awesome-skills=8"], "the mirror is named, not just counted");
  assert.equal(v.maxInstalls, 736754, "max is the busiest row on the leg, including skills that are not ours");
});

test("a non-numeric installs field is counted as unreadable instead of rounded to zero", () => {
  const v = classify([{ id: "a/b/unified-ai-gateway", source: "a/b", installs: "many" }, { id: "c/d/unified-ai-gateway", source: "c/d", installs: 4 }]);
  assert.equal(v.unreadableInstalls, 1);
  assert.equal(v.direct, 0, "a/b is not our repository, so this fixture is about the counter, not the source");
  assert.equal(v.maxInstalls, 4);
});

test("the leg keeps the named row's count separate from the leg's maximum", () => {
  const leg = legFromPayload({ skills: [{ id: "anthropics/skills/pdf", source: "anthropics/skills", installs: 202784 }, { id: "x/y/z", source: "x/y", installs: 736754 }], count: 100 }, { query: "pdf", rowsReturned: 2, limit: 100 });
  assert.equal(leg.error, null);
  assert.equal(leg.namedInstalls, 202784, "quoting 736,754 as the pdf skill's installs would be a different statement");
  assert.equal(leg.verdict.maxInstalls, 736754);
});

test("a payload without a skills array is unreadable, never a zero", () => {
  assert.equal(legFromPayload({ message: "nope" }, { query: "q", rowsReturned: 0, limit: 10 }).error, "unreadable");
  assert.equal(legFromPayload(null, { query: "q", rowsReturned: 0, limit: 10 }).error, "unreadable");
  assert.equal(legFromPayload(REAL, { query: "u", rowsReturned: 2, limit: 10 }).error, "inconsistent", "the caller's row count must agree with the array it hands over");
});

test("a window-full leg says it is a window, not a population", () => {
  const full = legFromPayload({ skills: Array.from({ length: 100 }, (_, i) => ({ id: `a${i}/b/unified-ai-gateway`, source: `a${i}/b`, installs: i })) }, { query: "unified-ai-gateway", rowsReturned: 100, limit: 100 });
  assert.equal(full.truncated, true);
  const small = legFromPayload({ skills: [{ id: "a/b/unified-ai-gateway", source: "a/b", installs: 1 }] }, { query: "unified-ai-gateway", rowsReturned: 1, limit: 100 });
  assert.equal(small.truncated, false);
});

test("our row missing from an answered index is a problem about us, not the environment", async () => {
  const offline = { "unified-ai-gateway": { skills: [{ id: "other/thing/unified-ai-gateway", source: "other/thing", installs: 5 }], count: 1 }, pdf: { skills: [], count: 0 }, "azure-aigateway": { skills: [], count: 0 } };
  const result = await run({ offline });
  assert.equal(result.ourLegReadable, true, "the call answered, so absence is a finding");
  assert.deepEqual(result.environment, []);
  assert.equal(result.problems.length, 1, JSON.stringify(result.problems));
  assert.match(result.problems[0], /crawl no longer shows our row/);
});

test("an unreadable index is environment, and installs are never written as zero", async () => {
  const boom = async () => { throw new TypeError("fetch failed"); };
  const result = await run({ fetchImpl: boom });
  assert.equal(result.readable, 0, "every leg is transport-failed");
  assert.equal(result.ourLegReadable, false);
  assert.deepEqual(result.problems, [], "nothing was concluded about our row");
  assert.match(result.environment[0], /installs are NOT reported as zero/);
  assert.equal(result.legs.every((l) => l.error === "unreadable"), true);
});

test("a control leg that fails is a gap in scale, not a verdict", async () => {
  const offline = {
    "unified-ai-gateway": REAL,
    pdf: null,
    "azure-aigateway": { skills: [{ id: "microsoft/azure-skills/azure-aigateway", source: "microsoft/azure-skills", installs: 607530 }], count: 1 },
  };
  // A null entry stands in for an unanswered control leg: the classifier marks it unreadable.
  const result = await run({ offline: { ...offline, pdf: { message: "gateway" } } });
  assert.equal(result.controlGaps.length, 1, JSON.stringify(result.controlGaps));
  assert.match(result.controlGaps[0], /control q=pdf/);
  assert.deepEqual(result.problems, [], "our row was read; a missing control does not become our problem");
  assert.equal(result.ourLegReadable, true);
});

test("the clean live-shaped payload produces no problem", async () => {
  const offline = {
    "unified-ai-gateway": REAL,
    pdf: { skills: [{ id: "anthropics/skills/pdf", source: "anthropics/skills", installs: 202784 }], count: 1 },
    "azure-aigateway": { skills: [{ id: "microsoft/azure-skills/azure-aigateway", source: "microsoft/azure-skills", installs: 607530 }], count: 1 },
  };
  const result = await run({ offline });
  assert.deepEqual(result.problems, [], "the complete fixture must not fire, or the guard only knows how to complain");
  assert.deepEqual(result.environment, []);
  const ours = result.legs.find((l) => l.query === "unified-ai-gateway");
  assert.equal(ours.verdict.directInstalls, 3);
  assert.equal(ours.verdict.mirrorInstalls, 8);
});

test("the exit mapping is decided in one place and each code can be reached", () => {
  assert.equal(exitCodeFor({ problems: [], ourLegReadable: true }), 0);
  assert.equal(exitCodeFor({ problems: ["our row gone"], ourLegReadable: true }), 4, "read, and about us");
  assert.equal(exitCodeFor({ problems: [], ourLegReadable: false }), 2, "not read at all");
  assert.equal(exitCodeFor({ problems: ["x"], ourLegReadable: false }), 2, "an unreadable index outranks any conclusion drawn from it");
});

test("--offline with no entry for our query is unreadable rather than an empty index", async () => {
  const result = await run({ offline: { pdf: { skills: [], count: 0 } } });
  assert.equal(result.readable, 1, "only the pdf leg has a payload");
  assert.equal(result.ourLegReadable, false);
  assert.match(result.environment[0], /--offline payload has no entry/);
});
