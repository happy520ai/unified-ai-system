import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const PRODUCER = path.join(HERE, "crosscheck-mcp-installability.mjs");
const ROOT = path.join(HERE, "..");

function run(sampleArg) {
  return spawnSync(process.execPath, [PRODUCER, sampleArg, path.join(HERE, "..", ".tmp", "unused-crosscheck-out.json")], {
    encoding: "utf8",
    cwd: ROOT,
    timeout: 30000,
  });
}

// Both arms refuse before any network call, which is what makes them cheap enough to
// keep in CI: the guard runs at argument-parse time.

test("a provenance pointer that only resolves on one machine is refused", () => {
  for (const arg of [".tmp/scratch-sample.json", "C:/somewhere/wt-080/other.json", ".tmp/wt-080/other.json"]) {
    const r = run(arg);
    assert.equal(r.status, 2, `${arg} should be refused, got ${r.status}: ${r.stdout}${r.stderr}`);
    assert.match(r.stderr, /REFUSED: provenance pointer would not resolve for a reader/);
  }
});

test("the guard accepts a repo-relative path and lets the run proceed to its own read", () => {
  const r = run("docs/data/does-not-exist-anywhere.json");
  assert.doesNotMatch(r.stderr, /REFUSED: provenance pointer/, "the guard rejected a path it should normalise-and-accept");
  assert.match(r.stderr + r.stdout, /does-not-exist-anywhere\.json/, "expected the read of the accepted path to be what fails");
});

test("a worktree-prefixed path is rewritten to the repo-relative tail, not refused", () => {
  // A name that does not exist on purpose: the point is that the guard *accepts* the
  // normalised form, and the next thing that happens must be the file read failing -
  // never a real sample, or this test would re-run 54 registry requests in CI.
  const r = run(".tmp/wt-080/docs/data/no-such-sample-in-ci.json");
  assert.doesNotMatch(r.stderr, /REFUSED: provenance pointer/, "the tail after docs/data/ is a valid pointer and must not be refused");
  assert.match(r.stderr + r.stdout, /no-such-sample-in-ci\.json/, "expected the accepted, normalised path to be what the read reports");
});
