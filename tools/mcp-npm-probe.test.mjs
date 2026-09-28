import test from "node:test";
import assert from "node:assert/strict";
import { encPkg, classify, isUnusable, isDefinite, waldCi } from "./mcp-npm-probe.mjs";

test("scoped names become npm's own path form and plain names are untouched", () => {
  assert.equal(encPkg("@modelcontextprotocol/sdk"), "@modelcontextprotocol%2fsdk");
  assert.equal(encPkg("lodash"), "lodash");
  assert.throws(() => encPkg(""), /non-empty string/);
  // A raw slash would address a different path and 404 a package that exists, so this is the bug the
  // function exists to prevent rather than a formatting preference.
  assert.equal(encPkg("@scope/name").includes("/"), false);
});

test("the status pair becomes the right verdict for each of the five shapes", () => {
  assert.equal(classify(200, 200), "listed_version_published");
  assert.equal(classify(200, 404), "package_exists_version_missing");
  assert.equal(classify(404, 404), "package_missing");
  assert.equal(classify(402, 404), "package_blocked_402");
  assert.equal(classify(503, 503), "server_error_503_503");
  assert.equal(classify("ERR:TimeoutError", 200), "transport_error");
});

test("a missing package is never reported as a missing version, and vice versa", () => {
  assert.notEqual(classify(404, 200), classify(200, 404), "collapsing these two would let a stale listing absorb a deleted package");
  assert.equal(classify(404, 200), "package_missing", "package absence must win over any version reading");
});

test("unusable means npm will not hand over the listed artifact, and never counts a probe failure", () => {
  assert.equal(isUnusable("package_missing"), true);
  assert.equal(isUnusable("package_exists_version_missing"), true);
  assert.equal(isUnusable("package_blocked_402"), true);
  assert.equal(isUnusable("listed_version_published"), false);
  // The one that would silently invent a finding: a transport failure must not raise the bad rate.
  assert.equal(isUnusable("transport_error"), false);
  assert.equal(isUnusable("server_error_500_200"), false);
});

test("an ambiguous npm answer leaves the denominator instead of diluting it", () => {
  // `other_http_200_406` was observed against a real version path on 2026-09-28, and reading it as
  // "fine, just unmeasured" would let the headline proportion shrink every time npm's CDN misbehaved.
  assert.equal(isDefinite("other_http_200_406"), false);
  assert.equal(isDefinite("server_error_503_503"), false);
  assert.equal(isDefinite("transport_error"), false);
  assert.equal(isDefinite("listed_version_published"), true);
  assert.equal(isDefinite("package_missing"), true);
  assert.equal(isUnusable("other_http_200_406"), false);
  // Four definite readings with one bad: the interval must stay wide rather than looking precise.
  const ci = waldCi(1, 4);
  assert.ok(ci[0] === 0 && ci[1] > 0.25, "n=4 must not look precise: " + JSON.stringify(ci));
});

test("the interval is pinned at both ends and refuses an empty denominator", () => {
  const zero = waldCi(0, 200);
  assert.deepEqual([zero[0], zero[1]], [0, 0]);
  const all = waldCi(200, 200);
  assert.equal(all[1], 1);
  const mid = waldCi(10, 200);
  assert.ok(mid[0] < 0.05 && mid[1] > 0.05, "10/200 must straddle 5%: " + JSON.stringify(mid));
  assert.throws(() => waldCi(0, 0), /no definite readings/);
});
