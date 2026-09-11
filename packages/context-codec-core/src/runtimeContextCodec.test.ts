import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { test } from "node:test";
import { isDeepStrictEqual } from "node:util";
import { parseDocument } from "yaml";
import { ContextCodecError, decodeContextData, encodeContextData, parseContextJson } from "./runtimeContextCodec.ts";
import type { ContextCodecProfile } from "./runtimeContextCodec.ts";

const profiles: ContextCodecProfile[] = ["yaml_state", "jsonl_facts", "compact_trace"];
const errorCode = (code: string) => (error: unknown): boolean => error instanceof ContextCodecError && error.code === `CONTEXT_CODEC_${code}`;
const bodyOf = (text: string): string => text.slice(text.indexOf("\n") + 1);
const replaceBody = (text: string, body: string): string => `${text.slice(0, text.indexOf("\n"))}\n${body}`;

test("all profiles independently round-trip typed records and report actual byte counts", () => {
  const data = [
    { key: "value", count: 7, enabled: false, nested: { empty: {}, list: [], nullable: null }, refs: ["ref:a", "ref:b"] },
    { refs: ["ref:b", "ref:a"], nested: { nullable: "null", list: [1, "1", true], empty: {} }, enabled: true, count: 0.25, key: "key" },
  ];
  const source = JSON.stringify(data, null, 2);
  for (const profile of profiles) {
    const encoded = encodeContextData(source, profile);
    assert.deepStrictEqual(decodeContextData(encoded.text, profile), data);
    assert.equal(encoded.sourceDataHash, createHash("sha256").update(JSON.stringify(data)).digest("hex"));
    assert.equal(encoded.byteLengthBefore, Buffer.byteLength(source));
    assert.equal(encoded.byteLengthAfter, Buffer.byteLength(encoded.text));
    assert.equal(encoded.profile, profile);
    assert.equal(encoded.factCount, 18);
    assert.doesNotMatch(encoded.text, /Phase641R|providerCallsMade|noProviderCall/u);
    if (profile === "compact_trace") {
      const table = JSON.parse(encoded.text);
      assert.equal(table.root, "object-array");
      assert.deepStrictEqual(table.columns, Object.keys(data[0]!));
      assert.equal(table.rows.length, data.length);
    }
  }
});

test("YAML is real YAML 1.2 and retains root scalars, ambiguous strings and empty containers", () => {
  for (const value of [null, true, false, 0, -3, 5e-324, 0.0000001, "", "null", "true", "001", {}, [], { "1": "false", yes: "yes", date: "2026-09-10" }]) {
    const encoded = encodeContextData(JSON.stringify(value), "yaml_state");
    const document = parseDocument(bodyOf(encoded.text), { version: "1.2", strict: true, uniqueKeys: true });
    assert.deepStrictEqual(document.toJS(), value);
    assert.deepStrictEqual(decodeContextData(encoded.text, "yaml_state"), value);
  }
});

test("JSONL identifies object entries versus ordered arrays, including empty roots", () => {
  for (const value of [{}, [], { left: "right", right: "left", empty: {}, list: [] }, ["left", ["left", "right"], null]]) {
    const encoded = encodeContextData(JSON.stringify(value), "jsonl_facts");
    assert.deepStrictEqual(decodeContextData(encoded.text, "jsonl_facts"), value);
    const [header, ...lines] = encoded.text.split("\n").map(line => JSON.parse(line));
    assert.equal(header.root, Array.isArray(value) ? "array" : "object");
    assert.equal(header.lines, Array.isArray(value) ? "ordered values" : "[key,value]");
    assert.deepStrictEqual(lines, Array.isArray(value) ? value : Object.entries(value));
  }
});

test("escaped delimiters, multiline text, references and prototype-like keys remain data", () => {
  const row = JSON.parse('{"__proto__":{"polluted":true},"constructor":"constructor","prototype":[],"quote\\\"key":"a\\nb\\r\\n---\\n[\\\"x\\\",1]\\n# context-codec/v1","<<":"ref:source","unicode":"中文😀"}');
  for (const profile of profiles) {
    const source = JSON.stringify([row, row]);
    const decoded = decodeContextData(encodeContextData(source, profile).text, profile);
    assert.deepStrictEqual(decoded, JSON.parse(source));
    const first = (decoded as Record<string, unknown>[])[0]!;
    assert.equal(Object.getPrototypeOf(first), Object.prototype);
    assert.equal(Object.hasOwn(first, "__proto__"), true);
    assert.equal(Object.hasOwn(Object.prototype, "polluted"), false);
  }
});

test("strict source parsing rejects duplicates, comments, trailing syntax and precision loss", () => {
  for (const source of ['{"a":1,"a":2}', '{"a":1,"\\u0061":2}', '{"nested":{"x":0,"x":1}}']) {
    assert.throws(() => parseContextJson(source), errorCode("DUPLICATE_KEY"));
  }
  for (const source of ["", "undefined", "{a:1}", '{"a":1,}', '{"a":1}//comment', "[1] [2]"]) {
    assert.throws(() => parseContextJson(source), errorCode("INVALID_JSON"));
  }
  for (const source of ["9007199254740993", "-9007199254740993", "1e400"]) {
    assert.throws(() => parseContextJson(source), errorCode("UNSAFE_NUMBER"));
  }
  for (const source of ["0.10000000000000001", "1.0000000000000001", "1e-400", "1.0", "1e0", "-0"]) {
    assert.throws(() => parseContextJson(source), errorCode("NON_CANONICAL_NUMBER"));
  }
  assert.deepStrictEqual(parseContextJson('[9007199254740991,-9007199254740991,0.125,1e-7]'), [9007199254740991, -9007199254740991, 0.125, 1e-7]);
});

test("source byte, depth and node limits accept the boundary and reject excess", () => {
  assert.equal((parseContextJson(`"${"x".repeat(256 * 1024 - 2)}"`) as string).length, 256 * 1024 - 2);
  assert.throws(() => parseContextJson(`"${"中".repeat(90_000)}"`), errorCode("SIZE_LIMIT"));
  const nested = (depth: number): string => `${"[".repeat(depth)}0${"]".repeat(depth)}`;
  assert.doesNotThrow(() => parseContextJson(nested(32)));
  for (const profile of ["yaml_state", "jsonl_facts"] as const) {
    assert.deepStrictEqual(decodeContextData(encodeContextData(nested(32), profile).text, profile), JSON.parse(nested(32)));
  }
  assert.throws(() => parseContextJson(nested(33)), errorCode("DEPTH_LIMIT"));
  assert.throws(() => parseContextJson(nested(10_000)), errorCode("DEPTH_LIMIT"));
  assert.equal((parseContextJson(JSON.stringify(Array(19_999).fill(0))) as unknown[]).length, 19_999);
  assert.throws(() => parseContextJson(JSON.stringify(Array(20_000).fill(0))), errorCode("NODE_LIMIT"));
});

test("independent decoding detects exchanged fields, types, references and missing records", () => {
  const source = '[{"left":"right","right":"left","active":false,"refs":["a","b"]},{"left":"x","right":"y","active":true,"refs":["b","a"]}]';
  const original = parseContextJson(source);
  const mutations = [
    [{ left: "left", right: "right", active: false, refs: ["a", "b"] }, (original as unknown[])[1]],
    [{ left: "right", right: "left", active: "false", refs: ["a", "b"] }, (original as unknown[])[1]],
    [{ left: "right", right: "left", active: false, refs: ["b", "a"] }, (original as unknown[])[1]],
    [(original as unknown[])[0]],
  ];
  for (const profile of profiles) {
    for (const mutation of mutations) {
      const modifiedArtifact = encodeContextData(JSON.stringify(mutation), profile).text;
      assert.equal(isDeepStrictEqual(original, decodeContextData(modifiedArtifact, profile)), false);
    }
    const valid = encodeContextData(source, profile).text;
    const tampered = profile === "yaml_state" ? valid.replace("left: right", "left: left")
      : profile === "jsonl_facts" ? valid.replace('"left":"right"', '"left":"left"')
      : valid.replace('"left","right"', '"right","left"');
    assert.notEqual(tampered, valid);
    assert.equal(isDeepStrictEqual(original, decodeContextData(tampered, profile)), false);
    assert.throws(() => decodeContextData(valid.replace("context-codec/v1", "context-codec/v2"), profile), errorCode("INVALID_FORMAT"));
  }
});

test("decoders reject type-confused headers, duplicate fields, malformed tables and YAML extensions", () => {
  const jsonl = encodeContextData('{"a":1}', "jsonl_facts").text;
  assert.throws(() => decodeContextData(replaceBody(jsonl, '["a",1]\n["a",2]'), "jsonl_facts"), errorCode("DUPLICATE_KEY"));
  for (const body of ['[1,"a"]', '["a",1,2]', '{"a":1}', '["a",1]\n']) {
    assert.throws(() => decodeContextData(replaceBody(jsonl, body), "jsonl_facts"), ContextCodecError);
  }
  const table = encodeContextData('[{"a":1,"b":2}]', "compact_trace").text;
  for (const body of ['{"columns":["a","a"],"rows":[[1,2]]}', '{"columns":["a","b"],"rows":[[1]]}', '{"columns":["a"],"rows":[[1,2]]}', '{"columns":[1],"rows":[[1]]}', '{"columns":[],"rows":[],"extra":0}']) {
    assert.throws(() => decodeContextData(JSON.stringify({ ...JSON.parse(table), ...JSON.parse(body) }), "compact_trace"), errorCode("INVALID_FORMAT"));
  }
  const yaml = encodeContextData('{"a":1}', "yaml_state").text;
  for (const body of ['a: 1\na: 2\n', 'a: &anchor [1]\nb: *anchor\n', 'a: !!str 1\n', '%YAML 1.1\n---\na: 1\n', 'a: 1\n---\nb: 2\n', '? [a,b]\n: 1\n']) {
    assert.throws(() => decodeContextData(replaceBody(yaml, body), "yaml_state"), ContextCodecError);
  }
  assert.throws(() => decodeContextData(yaml.replace("object: YAML", "array: YAML"), "yaml_state"), errorCode("INVALID_FORMAT"));
  assert.throws(() => decodeContextData(replaceBody(yaml, "a: 0.10000000000000001\n"), "yaml_state"), errorCode("NON_CANONICAL_NUMBER"));
});

test("unsupported shapes and profiles fail explicitly instead of dropping data", () => {
  for (const source of ["null", "true", "1", '"string"']) assert.throws(() => encodeContextData(source, "jsonl_facts"), errorCode("UNSUPPORTED_SHAPE"));
  for (const source of ["[]", "{}", "[1,2]", '[{"a":1},{"b":2}]', '[{"a":1},{"a":2,"b":3}]']) {
    assert.throws(() => encodeContextData(source, "compact_trace"), errorCode("UNSUPPORTED_SHAPE"));
  }
  assert.deepStrictEqual(decodeContextData(encodeContextData("[{},{}]", "compact_trace").text, "compact_trace"), [{}, {}]);
  assert.throws(() => encodeContextData("{}", "other" as ContextCodecProfile), errorCode("UNSUPPORTED_PROFILE"));
  assert.throws(() => decodeContextData("{}", "other" as ContextCodecProfile), errorCode("UNSUPPORTED_PROFILE"));
});
