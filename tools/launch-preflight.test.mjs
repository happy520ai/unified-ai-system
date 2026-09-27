import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  countClaim,
  isUnreadable,
  num,
  presentClaimFindings,
  discussionFindings,
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

test("the shipped copy never calls the cache semantic without saying what that takes", () => {
  const c = readCopyClaims(readFileSync("docs/growth-launch-kit-2026-09.md", "utf8"));
  assert.deepEqual(c.cacheClaims, [], `unqualified semantic-cache claims at ${c.cacheClaims.map((x) => `L${x.line}`).join(",")}`);
});

test("an unqualified semantic-cache sentence in the published copy is a finding", () => {
  const c = readCopyClaims(kit("> You get virtual keys with budgets, exact + semantic response cache, and an audit chain."));
  assert.equal(c.cacheClaims.length, 1);
  assert.match(c.cacheClaims[0].text, /semantic response cache/);
});

test("the finding survives hard wrapping, because kit copy wraps mid-sentence", () => {
  const c = readCopyClaims(kit(
    "> plus virtual keys with budgets and rate limits, exact + semantic",
    "> response cache, circuit breaking, and Prometheus metrics.",
  ));
  assert.equal(c.cacheClaims.length, 1, "two quoted lines are one paragraph and one claim");
  assert.equal(c.cacheClaims[0].line, 1);
});

test("naming what semantic-grade matching takes clears the claim", () => {
  const qualified = readCopyClaims(kit(
    "> The default similarity layer is lexical approximation; attach a real embedding endpoint through the HTTP embedding hook for semantic-grade matching.",
  ));
  assert.deepEqual(qualified.cacheClaims, []);
  const honest = readCopyClaims(kit("> Honestly: the default similarity layer is lexical, not semantic."));
  assert.deepEqual(honest.cacheClaims, []);
});

test("a paragraph boundary is a blank quote line, so two replies are two claims", () => {
  const c = readCopyClaims(kit(
    "> exact + semantic response cache here.",
    ">",
    "> and the same phrase again, semantic caching over models, here.",
  ));
  assert.equal(c.cacheClaims.length, 2);
  assert.deepEqual(c.cacheClaims.map((x) => x.line), [1, 3]);
});

test("author notes and somebody else's recorded wording are not our claim to defend", () => {
  const notes = readCopyClaims(kit("The notes say exact + semantic response cache to the author."));
  assert.deepEqual(notes.cacheClaims, [], "not paste-ready, never published");
  const quoted = readCopyClaims(kit("> Their README says exact + semantic response cache, which we do not claim."));
  assert.deepEqual(quoted.cacheClaims, [], "a record of somebody else's sentence");
});

test("'semantic' far from any cache word is not a cache claim", () => {
  const c = readCopyClaims(kit("> Semantic search over your own documents, no cloud tier."));
  assert.deepEqual(c.cacheClaims, []);
});

test("the shipped copy promises only what the converter accepts", () => {
  const c = readCopyClaims(readFileSync("docs/growth-launch-kit-2026-09.md", "utf8"));
  assert.deepEqual(c.openApiClaims, [], `unqualified conversion claims at ${c.openApiClaims.map((x) => `L${x.line}`).join(",")}`);
});

test("a promise that any OpenAPI document converts is a finding", () => {
  const c = readCopyClaims(kit("> Point it at any OpenAPI 3 spec and every endpoint becomes a governed MCP tool."));
  assert.equal(c.openApiClaims.length, 1);
  assert.match(c.openApiClaims[0].text, /any OpenAPI 3 spec/);
});

test("the finding survives hard wrapping, same as the cache arm", () => {
  const c = readCopyClaims(kit(
    "> wraps *other* MCP servers and any",
    "> OpenAPI 3 spec behind allow-lists and audit.",
  ));
  assert.equal(c.openApiClaims.length, 1, "one paragraph, one claim");
  assert.equal(c.openApiClaims[0].line, 1);
});

test("naming what gets refused clears the conversion claim", () => {
  const c = readCopyClaims(kit(
    "> Point it at any OpenAPI 3 document: each unambiguous operation becomes a tool, and a construct whose semantics cannot be resolved is refused rather than guessed.",
  ));
  assert.deepEqual(c.openApiClaims, []);
});

test("somebody else's sentence about any spec is a record, not our promise", () => {
  const c = readCopyClaims(kit("> Their README says it converts any OpenAPI 3 spec, which is not what ours does."));
  assert.deepEqual(c.openApiClaims, []);
});

// --- public carriers, not just the paste-ready kit -------------------------------------
// The same overclaim reached the reader through README alt text and the rendered
// architecture PNG, which no kit-scoped guard can see. These fixtures are the real
// pre-fix bytes, so the bite is anchored to the defect that actually shipped.
import { CACHE_CLAIM_CARRIERS, findUnqualifiedCacheClaims } from "./launch-preflight.mjs";

test("the wording that drew a maintainer's objection is what the carrier guard catches", () => {
  const readmeAlt = '    alt="Architecture: OpenAI/Anthropic SDKs, MCP clients, A2A, CLI, and HTTP enter one gateway that adds prompt enhancement, virtual keys, exact + semantic cache, reverse MCP governance, observability, and audit"';
  const chip = '        <div class="chip"><b>Response Cache</b><span>exact + semantic · byte-identical SSE replay</span></div>';
  const readmeFindings = findUnqualifiedCacheClaims(readmeAlt, "README.md");
  assert.equal(readmeFindings.length, 1);
  assert.match(readmeFindings[0], /^README.md:1 /);
  assert.match(readmeFindings[0], /exact \+ semantic cache/);
  const chipFindings = findUnqualifiedCacheClaims(chip, "docs/assets/readme-architecture.html");
  assert.equal(chipFindings.length, 1, "the rendered image source must not be able to say it silently");
  assert.match(chipFindings[0], /^docs\/assets\/readme-architecture\.html:1 /);
});

test("naming which grade is the default clears the claim", () => {
  assert.deepEqual(
    findUnqualifiedCacheClaims("virtual keys, exact cache with an optional semantic layer, reverse MCP governance", "README.md"),
    [],
  );
  assert.deepEqual(
    findUnqualifiedCacheClaims("<span>opt-in semantic layer that catches paraphrases</span>", "docs/index.html"),
    [],
  );
  assert.deepEqual(
    findUnqualifiedCacheClaims("alt=\"精确缓存 + 可选语义层，反向 MCP 治理\"", "README.zh-CN.md"),
    [],
    "the Chinese carrier needs the same escape hatch, or the guard only speaks English",
  );
});

test("every shipped public carrier reads clean, and the list itself cannot quietly empty", () => {
  assert.ok(CACHE_CLAIM_CARRIERS.length >= 8, `carrier list collapsed to ${CACHE_CLAIM_CARRIERS.length}`);
  const all = [];
  for (const carrier of CACHE_CLAIM_CARRIERS) {
    all.push(...findUnqualifiedCacheClaims(readFileSync(carrier, "utf8"), carrier));
  }
  assert.deepEqual(all, []);
});

test("the public gate is wired to this instrument rather than a copy of it", () => {
  const gate = readFileSync("tools/public-repo-check.mjs", "utf8");
  assert.match(gate, /from "\.\/launch-preflight\.mjs"/);
  assert.match(gate, /findUnqualifiedCacheClaims/);
  assert.match(gate, /public_cache_claim_unqualified/);
  assert.match(gate, /CACHE_CLAIM_CARRIERS\.length === 0/, "an empty carrier list must be reported blind, not clean");
});

// --- our own Discussions, the carrier no file guard can see --------------------------------
test("a discussion that calls an older release current is named, and only for the version", () => {
  // One finding, not two, and that is the precise reading: the sentence is wrong about which
  // release is current, while "twelve tools" is a true statement about 0.7.0. Reporting the count
  // too would send a reader to fix a number that does not need fixing.
  const body = "The current release is v0.7.0 with twelve governed MCP tools.";
  const findings = presentClaimFindings(body, { liveTag: "0.8.0", rosterCount: 15, label: "d" });
  assert.deepEqual(findings, ["d: line 1 calls v0.7.0 the current release; the live release is v0.8.0"]);
});

test("a correct version with a stale count is named for the count alone", () => {
  const findings = presentClaimFindings(
    "The current release is v0.8.0 with twelve governed MCP tools.",
    { liveTag: "0.8.0", rosterCount: 15, label: "d" },
  );
  assert.equal(findings.length, 1);
  assert.match(findings[0], /states 12 tools in a present-tense sentence; the published image has 15/);
});

test("the same wording matching the live readings is clean, not merely unread", () => {
  assert.deepEqual(
    presentClaimFindings("The current release is v0.8.0 with fifteen governed MCP tools.", { liveTag: "0.8.0", rosterCount: 15, label: "d" }),
    [],
  );
});

test("a historical release note is a record, not a stale claim", () => {
  // Two arms had to be satisfied to get this wrong: no present-tense word means no claim, and
  // a count that equals the roster of the version the line names is a correct reading of it.
  const title = "v0.5.0 - The Gateway Release: 12 governed tools, budgets, cache";
  assert.deepEqual(presentClaimFindings(title, { liveTag: "0.8.0", rosterCount: 15, label: "d" }), []);
  // The hard case: a present-tense word next to a pinned version, where the number is true of
  // that version. The version arm must stay quiet because no "release" is being claimed, and the
  // count arm must stay quiet because 9 is what 0.4.9 ships.
  const presentButPinned = "The current 0.4.9 procedure exposes nine tools.";
  assert.deepEqual(presentClaimFindings(presentButPinned, { liveTag: "0.8.0", rosterCount: 15, label: "d" }), []);
  // And the excuse must not be a blanket: same sentence shape, a count that is true of nothing.
  assert.equal(
    presentClaimFindings("The current 0.4.9 procedure exposes eleven tools.", { liveTag: "0.8.0", rosterCount: 15, label: "d" }).length,
    1,
  );
});

test("a failed GraphQL read is reported as unreadable rather than as clean", () => {
  const unreadable = discussionFindings(null, { liveTag: "0.8.0", rosterCount: 15 });
  assert.equal(unreadable.read, null);
  assert.deepEqual(unreadable.findings, []);
  const listed = discussionFindings([{ databaseId: 7, title: "current: v0.4.9", body: "The current release is v0.4.9 with eleven governed MCP tools." }], { liveTag: "0.8.0", rosterCount: 15 });
  assert.equal(listed.read, 1);
  assert.equal(listed.findings.length, 2);
});
