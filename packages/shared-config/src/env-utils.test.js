import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readBoolean, readList, readNumber, readProviderMode, readRouteMode } from "./env-utils.js";

describe("env-utils — readNumber", () => {
  it("parses numeric strings", () => {
    assert.equal(readNumber("42", 0), 42);
    assert.equal(readNumber("3.14", 0), 3.14);
  });

  it("falls back on empty, undefined or invalid input", () => {
    assert.equal(readNumber("", 7), 7);
    assert.equal(readNumber(undefined, 7), 7);
    assert.equal(readNumber("abc", 7), 7);
  });
});

describe("env-utils — readList", () => {
  it("splits, trims and filters comma-separated values", () => {
    assert.deepEqual(readList("a,b,c", []), ["a", "b", "c"]);
    assert.deepEqual(readList(" a , b ,, ", []), ["a", "b"]);
  });

  it("falls back on empty input", () => {
    assert.deepEqual(readList("", ["x"]), ["x"]);
    assert.deepEqual(readList(undefined, ["x"]), ["x"]);
  });
});

describe("env-utils — readRouteMode / readProviderMode", () => {
  it("accepts valid values and falls back otherwise", () => {
    assert.equal(readRouteMode("fixed", "registry-default"), "fixed");
    assert.equal(readRouteMode("bogus", "registry-default"), "registry-default");
    assert.equal(readProviderMode("auto", "fake"), "auto");
    assert.equal(readProviderMode("bogus", "fake"), "fake");
  });
});

describe("env-utils — readBoolean", () => {
  it("parses truthy forms", () => {
    assert.equal(readBoolean("1", false), true);
    assert.equal(readBoolean("true", false), true);
    assert.equal(readBoolean("TRUE", false), true);
  });

  it("parses falsy forms and falls back", () => {
    assert.equal(readBoolean("0", true), false);
    assert.equal(readBoolean("false", true), false);
    assert.equal(readBoolean("", true), true);
    assert.equal(readBoolean(undefined, true), true);
  });
});
