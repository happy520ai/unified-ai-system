import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { buildPositionId, normalizePosition, normalizePositionTitle } from "./positionNormalizer.js";

describe("position-library — title normalization", () => {
  it("trims, lowercases and collapses whitespace", () => {
    assert.equal(normalizePositionTitle("  Senior  Software   Engineer "), "senior software engineer");
    assert.equal(normalizePositionTitle(""), "");
  });
});

describe("position-library — position id", () => {
  it("builds a stable slug-based id", () => {
    const id = buildPositionId("ESCO", "2512", "Software Developer");
    assert.equal(id, "esco-2512-software-developer");
  });

  it("strips non-alphanumeric characters", () => {
    const id = buildPositionId("ESCO", "25.12!", "C++ Developer");
    assert.ok(id.startsWith("esco-25-12"));
    assert.ok(id.includes("c-developer"));
    assert.ok(!id.includes("+"));
    assert.ok(!id.includes("."));
  });
});

describe("position-library — normalizePosition", () => {
  it("fills default arrays, confidence and version", () => {
    const normalized = normalizePosition({ sourceTitle: "Software Developer" });
    assert.equal(normalized.canonicalTitle, "Software Developer");
    assert.deepEqual(normalized.aliases, []);
    assert.deepEqual(normalized.skillTags, []);
    assert.equal(normalized.confidence, 0.7);
    assert.equal(normalized.version, "phase576b-preview");
    assert.deepEqual(normalized.seniorityApplicability, ["junior", "mid", "senior", "principal"]);
  });

  it("preserves explicit fields", () => {
    const normalized = normalizePosition({
      canonicalTitle: "Dev",
      aliases: ["coder"],
      skillTags: ["js"],
      confidence: 0.9,
    });
    assert.equal(normalized.canonicalTitle, "Dev");
    assert.deepEqual(normalized.aliases, ["coder"]);
    assert.deepEqual(normalized.skillTags, ["js"]);
    assert.equal(normalized.confidence, 0.9);
  });
});
