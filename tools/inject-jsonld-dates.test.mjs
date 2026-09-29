// The JSON-LD date injector must refuse pages it does not own, must refuse clones with no history, and
// must never move more than the two date lines. These arms run in both kinds of checkout: an earlier arm
// of mine passed locally and failed in CI because a local fixture and a runner's checkout disagreed, so
// the branch here is chosen by a measurement both environments can make the same way.
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const TOOL = "tools/inject-jsonld-dates.mjs";
const run = (args) => spawnSync(process.execPath, [TOOL, ...args], { encoding: "utf8" });
const depth = Number(spawnSync("git", ["rev-list", "--count", "HEAD"], { encoding: "utf8" }).stdout.trim());
const hasHistory = Number.isSafeInteger(depth) && depth > 1;

test("the decision follows the clone's history depth, in either direction", () => {
  const r = run(["docs/prompt-enhancement.html", "--dry"]);
  if (hasHistory) {
    assert.equal(r.status, 0, r.stdout + r.stderr);
    assert.match(r.stdout, /DRY RUN/, r.stdout);
    assert.match(r.stdout, /datePublished .* -> \d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z/, "the plan must print full UTC values: " + r.stdout);
    assert.match(r.stdout, /lines_changed (57,58|none)/, "the plan must say which lines it will touch: " + r.stdout);
  } else {
    assert.equal(r.status, 2, "a one-commit clone must be refused rather than guessed: " + r.stdout);
    assert.match(r.stdout, /one-commit clone/, r.stdout);
  }
});

test("a generator-owned page is refused, not rewritten", () => {
  const r = run(["docs/multi-arch-node-modules.html", "--dry"]);
  assert.equal(r.status, 2, "expected a refusal, got: " + r.stdout + r.stderr);
  assert.match(r.stdout, /generator-owned/, r.stdout);
});

test("running it with no target fails loudly instead of doing nothing quietly", () => {
  const r = run([]);
  assert.equal(r.status, 2, r.stdout + r.stderr);
  assert.match(r.stdout + r.stderr, /usage/, r.stdout + r.stderr);
});

test("the committed hand-authored page carries git-shaped UTC dates", () => {
  const html = readFileSync("docs/prompt-enhancement.html", "utf8");
  const block = /<script type="application\/ld\+json">([\s\S]*?)<\/script>/u.exec(html);
  assert.ok(block, "no JSON-LD block on the page this tool exists for");
  const object = JSON.parse(block[1]);
  const UTC = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/u;
  assert.match(object.datePublished, UTC, "datePublished must be full UTC, was " + object.datePublished);
  assert.match(object.dateModified, UTC, "dateModified must be full UTC, was " + object.dateModified);
  assert.ok(object.datePublished <= object.dateModified, "published after modified: " + object.datePublished + " / " + object.dateModified);
});
