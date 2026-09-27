import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  countClaim,
  isUnreadable,
  num,
  readCopyClaims,
  versionClaim,
} from "./launch-preflight.mjs";

// Offline calibration. The live checker was also run against two corrupted copies and
// these fixtures encode the same two plants, so the bite survives without a network.
const kit = (...lines) => lines.join("\n");

test("real launch copy: one present version, one count, both images", () => {
  const c = readCopyClaims(readFileSync("docs/growth-launch-kit-2026-09.md", "utf8"));
  assert.equal(c.namedVersion, "0.8.0");
  assert.deepEqual(c.distinctCounts, [15]);
  assert.deepEqual(c.imageRefs, [["mcp-server", "0.8.0"], ["ai-gateway-service", "0.8.0"]]);
  assert.equal(versionClaim(c), "0.8.0");
  assert.equal(countClaim(c), "15");
});

test("a stale tool count in the copy is carried to the comparison, not swallowed", () => {
  const c = readCopyClaims(kit("> The published 0.8.0 container exposes 12 MCP tools."));
  assert.equal(countClaim(c), "12");
});

test("words and digits are the same claim", () => {
  assert.equal(num("fifteen"), 15);
  assert.equal(num("15"), 15);
  assert.equal(num("twenty"), 20);
  const digits = readCopyClaims(kit("> The image exposes 15 tools."));
  const words = readCopyClaims(kit("> The image exposes fifteen tools."));
  assert.deepEqual(digits.distinctCounts, words.distinctCounts);
});

test("a line that reproduces someone else's wording is not our claim to defend", () => {
  const c = readCopyClaims(
    kit("> Their README says eight dedicated tools.", "> The v0.7.0 image exposed 12 tools."),
  );
  assert.deepEqual(c.claimedCounts, []);
  assert.deepEqual(c.quotedCounts, [8, 12]);
  // "no audited claim" must read as inconclusive, never as clean.
  assert.equal(isUnreadable({ expect: countClaim(c), live: "15" }), true);
});

test("history does not pin the present", () => {
  const c = readCopyClaims(
    kit("> v0.8.0 (today) is a big release - 133 commits between the v0.7.0 and v0.8.0 tags"),
  );
  assert.deepEqual(c.presentVersions, ["0.8.0"]);
});

test("two versions both called current is red, and says so", () => {
  const c = readCopyClaims(kit("> v0.8.0 today adds governance.", "> v0.9.0 today adds nothing."));
  assert.equal(c.namedVersion, null);
  assert.equal(versionClaim(c), "copy-names-2-versions[0.8.0,0.9.0]");
  assert.equal(isUnreadable({ expect: versionClaim(c), live: "v0.8.0" }), false);
});

test("image probes follow the copy and dedupe by tag", () => {
  const c = readCopyClaims(
    kit(
      "> docker run --rm -i ghcr.io/happy520ai/unified-ai-system/mcp-server:0.9.0",
      "> docker run --rm ghcr.io/happy520ai/unified-ai-system/mcp-server:0.9.0",
      "> docker run --rm ghcr.io/happy520ai/unified-ai-system/ai-gateway-service:0.9.1",
    ),
  );
  assert.deepEqual(c.imageRefs, [["mcp-server", "0.9.0"], ["ai-gateway-service", "0.9.1"]]);
});

test("a copy with no image reference is inconclusive, not clean", () => {
  const c = readCopyClaims(kit("> Nothing here points at a registry."));
  assert.deepEqual(c.imageRefs, []);
  assert.equal(isUnreadable({ expect: "READ-FAILED:no-image-ref-in-copy", live: "not-read" }), true);
});

test("prose that is not paste-ready is notes to the author, not claims", () => {
  const c = readCopyClaims(
    kit("The maintainer notes 4 tools here.", "> and 15 tools in the line that gets published"),
  );
  assert.deepEqual(c.claimedCounts, [15]);
});

test("page coverage is read out of the copy, not out of a list in the checker", () => {
  const linked = readCopyClaims(kit(
    "> see https://happy520ai.github.io/unified-ai-system/verify-mcp-docker-image.html.",
    "> or the landing page https://happy520ai.github.io/unified-ai-system/#enhance",
    "> again https://happy520ai.github.io/unified-ai-system/verify-mcp-docker-image.html",
  ));
  // A trailing sentence period must not become part of the filename, and a fragment-only
  // link is the site root; duplicates collapse so one page is one check.
  assert.deepEqual(linked.siteLinks, ["verify-mcp-docker-image.html", ""]);

  // Boundary arm: author notes are never published, so they must not drive what gets checked.
  const unlinked = readCopyClaims(kit(
    "The notes mention https://happy520ai.github.io/unified-ai-system/secret-draft.html to the author.",
    "> nothing linkable in the line that ships",
  ));
  assert.deepEqual(unlinked.siteLinks, [], "a non-paste line must not add page coverage");
});

test("the shipped copy links the startup-timing measurement", () => {
  const c = readCopyClaims(readFileSync("docs/growth-launch-kit-2026-09.md", "utf8"));
  assert.ok(c.siteLinks.includes("mcp-startup-timeouts.html"), "the objection reply should link the measured page");
  assert.ok(c.siteLinks.includes("mcp-startup-timeouts.zh-CN.html"), "the Chinese reply should link the Chinese page, so neither language ships an unchecked link");
  assert.ok(c.siteLinks.includes("verify-mcp-docker-image.html"), "the roster page link is still there");
  assert.equal(c.claimedCounts.length, 1, "the added timings must not be read as tool-count claims");
  assert.deepEqual(c.distinctCounts, [15]);
});
