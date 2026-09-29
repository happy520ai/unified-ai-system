// Guards the action-pin check against the shapes it will meet in the wild: a
// sub-action reference, a version tag standing where a SHA should be, a local
// docker action, and the same action pinned differently in two files.
import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { extractActionPins, classifyProbe, probeCommit, runGuard } from "./check-action-pins.mjs";

const WORKFLOW = `
name: Example
on: [push]
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1 # v7
      - uses: github/codeql-action/init@1190a975f95ce23525efb6a3fc21ea29567c1b52 # v3
      - uses: docker/build-push-action@v6
      - uses: ./.github/actions/local-thing
      - run: echo "no uses here"
`;

test("extracts a pinned action and a tag reference, and skips a local action", () => {
  const pins = extractActionPins({ "ci.yml": WORKFLOW });
  const byAction = new Map(pins.map((pin) => [pin.action, pin]));

  assert.equal(byAction.get("actions/checkout").shaPinned, true);
  assert.equal(byAction.get("github/codeql-action/init").shaPinned, true);
  assert.equal(byAction.get("docker/build-push-action").shaPinned, false, "a tag is not a SHA pin");
  // A local action resolves inside this repository: there is no upstream commit
  // to verify, and it carries no @ref, so it is not an action pin at all.
  assert.equal(byAction.has(".github/actions/local-thing"), false);
  assert.equal(pins.length, 3);
});

test("records every file that uses the same pin, so a fix can be checked once", () => {
  const pins = extractActionPins({
    "a.yml": "      - uses: actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1\n",
    "b.yml": "      - uses: actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1\n",
  });
  assert.equal(pins.length, 1);
  assert.deepEqual(pins[0].files.sort(), ["a.yml", "b.yml"]);
});

test("the same action pinned two different ways stays two entries", () => {
  const pins = extractActionPins({
    "a.yml": "      - uses: pnpm/action-setup@0977fd99725f1db4007ccb2928dbb4e90d06cc86\n",
    "b.yml": "      - uses: pnpm/action-setup@0ebf47130e4866e96fce0953f49152a61190b271\n",
  });
  assert.equal(pins.length, 2);
  assert.ok(pins.every((pin) => pin.shaPinned));
});

test("a comment after the pin does not become part of the reference", () => {
  const pins = extractActionPins({
    "a.yml": "      - uses: actions/setup-node@820762786026740c76f36085b0efc47a31fe5020 # v4\n",
  });
  assert.equal(pins[0].ref, "820762786026740c76f36085b0efc47a31fe5020");
});

test("a short or truncated sha is not accepted as a pin", () => {
  const pins = extractActionPins({ "a.yml": "      - uses: actions/cache@55cc8345863c7cc4c66a329aec7e433d2d1c52a\n" });
  assert.equal(pins[0].shaPinned, false);
});

// The resolver leg below is the one that was shipped without coverage, and it is
// the leg that lied: it read any failed request as "no such commit upstream", so
// every run red-flagged pins that a browser confirms exist (issue #205).

test("a sub-directory action keeps its display name but is looked up at the repository", () => {
  const pins = extractActionPins({ "codeql.yml": "      - uses: github/codeql-action/init@1190a975f95ce23525efb6a3fc21ea29567c1b52 # v3\n" });
  assert.equal(pins[0].action, "github/codeql-action/init", "the display name must still name the sub-action");
  assert.equal(pins[0].apiTarget, "github/codeql-action", "commits are not addressable below a sub-directory; querying init/commits/<sha> answers 404 for a real pin");
});

test("only a 422 states that a pin is absent", () => {
  const REAL = "3d3c42e5aac5ba805825da76410c181273ba90b1";
  assert.equal(classifyProbe({ status: 200, sha: REAL }).state, "resolved");
  assert.equal(classifyProbe({ status: 422, detail: "No commit found for SHA" }).state, "absent");
  assert.equal(classifyProbe({ status: 404, detail: "Not Found" }).state, "unreadable", "a 404 is a path or visibility failure and must never red the build");
  assert.equal(classifyProbe({ status: 403, detail: "rate limited" }).state, "unreadable");
  assert.equal(classifyProbe({ status: 200, sha: "" }).state, "unreadable", "a 200 with no usable sha is not a verdict about the pin");
  assert.equal(classifyProbe({ status: null, detail: "request failed" }).state, "unreadable");
});

test("a failed request cannot be invented into an absence, and a real absence still fires", async () => {
  const REAL = "3d3c42e5aac5ba805825da76410c181273ba90b1";
  const response = (status, body) => async () => ({ status, json: async () => body });
  assert.equal((await probeCommit("actions/checkout", REAL, async () => { throw new TypeError("fetch failed"); })).state, "unreadable");
  assert.equal((await probeCommit("actions/checkout", REAL, response(404, { message: "Not Found" }))).state, "unreadable");
  assert.equal((await probeCommit("actions/checkout", REAL, response(200, { sha: REAL }))).state, "resolved");
  assert.equal(
    (await probeCommit("actions/checkout", REAL, response(422, { message: `No commit found for SHA: ${REAL}` }))).state,
    "absent",
    "the arm that keeps the guard protective: a genuinely missing commit must still be named",
  );
});

test("a truncated sha in the response body is not accepted as proof of existence", async () => {
  const short = async () => ({ status: 200, json: async () => ({ sha: "3d3c42e5aac5ba805825da76410c181273ba90b" }) });
  assert.equal((await probeCommit("actions/checkout", "3d3c42e5aac5ba805825da76410c181273ba90b1", short)).state, "unreadable");
});

test("the lookup URL is the repository commit endpoint and carries no sub-directory", async () => {
  const seen = [];
  const fetchImpl = async (url) => {
    seen.push(url);
    return { status: 200, json: async () => ({ sha: "1190a975f95ce23525efb6a3fc21ea29567c1b52" }) };
  };
  await probeCommit("github/codeql-action", "1190a975f95ce23525efb6a3fc21ea29567c1b52", fetchImpl);
  assert.deepEqual(seen, ["https://api.github.com/repos/github/codeql-action/commits/1190a975f95ce23525efb6a3fc21ea29567c1b52"]);
});

function workflowFixture(name, line) {
  const dir = mkdtempSync(join(tmpdir(), "action-pins-"));
  writeFileSync(join(dir, name), line + "\n");
  return dir;
}

test("runGuard still reddens a pin that the endpoint says is absent", async () => {
  const BOGUS = "0000000000000000000000000000000000000000";
  const dir = workflowFixture("ci.yml", `      - uses: actions/checkout@${BOGUS}`);
  const guard = await runGuard({ workflowDir: dir, fetchImpl: async () => ({ status: 422, json: async () => ({ message: `No commit found for SHA: ${BOGUS}` }) }) });
  assert.equal(guard.summary.failures, 1, "the supply-chain floor has to bite, or the guard protects nothing");
  assert.match(guard.failures[0].problem, /no such commit upstream/);
  assert.equal(guard.summary.unreadable, 0);
});

test("a 404 on every pin cannot redden the build, and reports that it judged nothing", async () => {
  const dir = workflowFixture("codeql.yml", "      - uses: github/codeql-action/init@1190a975f95ce23525efb6a3fc21ea29567c1b52");
  const guard = await runGuard({ workflowDir: dir, fetchImpl: async () => ({ status: 404, json: async () => ({ message: "Not Found" }) }) });
  assert.deepEqual(guard.failures, [], "issue #205: a visibility failure was being printed as a fake pin");
  assert.equal(guard.summary.unreadable, 1);
  assert.equal(guard.summary.evaluated, 0, "the summary must not read like a clean bill of health");
  assert.match(guard.unreadable[0].why, /Not Found/);
});

test("an unpinned ref is decided from the workflow text without a request", async () => {
  const dir = workflowFixture("docker.yml", "      - uses: docker/build-push-action@v6");
  let calls = 0;
  const guard = await runGuard({ workflowDir: dir, fetchImpl: async () => { calls += 1; return { status: 200, json: async () => ({ sha: "3d3c42e5aac5ba805825da76410c181273ba90b1" }) }; } });
  assert.equal(guard.summary.unpinned, 1);
  assert.equal(guard.summary.failures, 1);
  assert.equal(calls, 0);
});

test("--offline reports verified=false instead of an empty pass", async () => {
  const dir = workflowFixture("ci.yml", "      - uses: actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1");
  const guard = await runGuard({ workflowDir: dir, offline: true });
  assert.equal(guard.summary.verified, false);
  assert.equal(guard.summary.evaluated, 0);
  assert.equal(guard.summary.pins, 1, "the pins are still listed when existence is not checked");
});
