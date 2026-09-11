import { describe, expect, it } from "vitest";
import { LocalClientConfigJsoncError, editLocalClientJsoncObject, parseLocalClientJsoncObject } from "./localClientConfigJsonc.js";
import type { LocalClientConfigJsonValue, LocalClientConfigOperation } from "./localClientConfigTransaction.js";

const LIMIT = 1_048_576;
const owned = "unified-ai-system";
const definition = { type: "stdio", command: "C:/gateway/node.exe", args: ["C:/gateway/mcp.js"] };
function apply(source: string | Buffer, operations: readonly LocalClientConfigOperation[]): Buffer {
  const bytes = Buffer.isBuffer(source) ? source : Buffer.from(source);
  const expected = structuredClone(parseLocalClientJsoncObject(bytes, LIMIT));
  for (const operation of operations) {
    let parent = expected;
    for (const key of operation.path.slice(0, -1)) {
      if (!Object.hasOwn(parent, key)) parent[key] = {};
      parent = parent[key] as typeof expected;
    }
    const key = operation.path.at(-1)!;
    if (operation.op === "set") parent[key] = operation.value;
    else delete parent[key];
  }
  return editLocalClientJsoncObject(bytes, operations, expected, LIMIT);
}
const set = (value: LocalClientConfigJsonValue = definition): LocalClientConfigOperation => ({ op: "set", path: ["servers", owned], value });
const remove: LocalClientConfigOperation = { op: "delete", path: ["servers", owned] };

describe("lossless explicit JSONC configuration codec", () => {
  it("preserves BOM, CRLF, escaped keys, unrelated token spelling, whitespace and EOF exactly", () => {
    const beforeSibling = '"ex\\u0074ras" : [1e2, -0, "😀中", {"spaced" : true,}], /* sibling-end */';
    const afterSibling = '"unmanaged"\t: { "args" : ["  literal // ",], },';
    const original = `\ufeff{\r\n // header\r\n ${beforeSibling}\r\n "servers": { /* head */ "${owned}" : {\r\n // owned command note\r\n "command" : "old", /* nested */ "args" : ["old"],\r\n }, /* separator */ ${afterSibling}\r\n },\r\n // footer\r\n}`;
    const output = apply(original, [set()]).toString("utf8");
    expect(output.startsWith("\ufeff")).toBe(true);
    expect(output.endsWith("// footer\r\n}")).toBe(true);
    expect(output).toContain(beforeSibling);
    expect(output).toContain(afterSibling);
    expect(output).toContain('// owned command note\r\n    /* nested */   \r\n ');
    expect(output.replace(/\r\n/gu, "")).not.toContain("\n");
    expect(parseLocalClientJsoncObject(Buffer.from(output), LIMIT).servers).toMatchObject({ [owned]: definition });
  });

  for (const [position, source] of [
    ["only", `{"servers": {/* before */ "${owned}": {/* inner */"x":1,}, /* after */},}`],
    ["first", `{"servers": {"${owned}": { // inner\n "x":1}, /* separator */ "other" : 2}}`],
    ["middle", `{"servers": {"before" : 1, /* first */ "${owned}": 2, /* second */ "after" : 3,}}`],
    ["last without trailing comma", `{"servers": {"other" : 1, /* first */ "${owned}":2 /* second */}}`],
    ["last with trailing comma", `{"servers": {"other" : 1, /* first */ "${owned}":2, /* second */}}`],
  ]) {
    it(`deletes ${position} owned property while preserving every comment`, () => {
      const output = apply(source!, [remove]);
      const originalComments = source!.match(/\/\*[^]*?\*\/|\/\/[^\r\n]*/gu) ?? [];
      expect(output.toString().match(/\/\*[^]*?\*\/|\/\/[^\r\n]*/gu) ?? []).toEqual(originalComments);
      expect(parseLocalClientJsoncObject(output, LIMIT).servers).not.toHaveProperty(owned);
      if (source!.includes('"other" : 1')) expect(output.toString()).toContain('"other" : 1');
      if (source!.includes('"after" : 3')) expect(output.toString()).toContain('"after" : 3');
    });
  }

  for (const source of ["{}", "{/* comment */}", '{"servers":{}}', '{"servers":{/* tail */}}',
    '{"servers":{"other":1 // tail\n}}', '{"servers":{"other":1, /* tail */}}']) {
    it(`inserts at the correct object boundary for ${source}`, () => {
      const output = apply(source, [set()]);
      expect(parseLocalClientJsoncObject(output, LIMIT).servers).toMatchObject({ [owned]: definition });
      expect(output.toString().match(/\/\*[^]*?\*\/|\/\/[^\r\n]*/gu) ?? [])
        .toEqual(source.match(/\/\*[^]*?\*\/|\/\/[^\r\n]*/gu) ?? []);
    });
  }

  it("does not rewrite a semantically unchanged value or normalize its formatting", () => {
    const original = Buffer.from(`{"servers":{"${owned}": { /* retain */ "a":1e2, "b":[true,],},},}\n`);
    expect(apply(original, [set({ b: [true], a: 100 })])).toEqual(original);
  });

  it("edits multiple independent owned paths without touching their sibling ranges", () => {
    const original = '{"a":{"old":1, /*keep-a*/ "sibling" : [1e2,]}, "b":{"old":2,/*keep-b*/ "sibling" : -0}}';
    const output = apply(original, [{ op: "set", path: ["a", "old"], value: 3 }, { op: "delete", path: ["b", "old"] }]).toString();
    expect(output).toContain('"sibling" : [1e2,]');
    expect(output).toContain('"sibling" : -0');
    expect(output).toContain("/*keep-a*/");
    expect(output).toContain("/*keep-b*/");
  });

  for (const source of ['{"x":1,"x":2}', '{"servers":{"x":1,"\\u0078":2}}', '{"x":[{"a":1,"a":2}]}',
    '{"__proto__":{}}', '{"x":{"constructor":1}}', '{"prototype":1}', '{"":1}', '{"a\\u0000":1}',
    '{"x":NaN}', '{"x":1e999}', '{"x":undefined}', "[]", "null", "", "/* only */", '{"x":1} true',
    '{"x":1 /* unclosed}', '{"x":1,,}', '{x:1}', "{'x':1}", '{"x":01}', '{"x":"\\q"}',
    '\ufeff\ufeff{}', '{"x":1}\ufeff']) {
    it(`rejects ambiguous or unsupported syntax ${JSON.stringify(source)}`, () => {
      expect(() => parseLocalClientJsoncObject(Buffer.from(source), LIMIT)).toThrow(LocalClientConfigJsoncError);
    });
  }

  it("rejects invalid UTF-8, excessive bytes, recursion depth and semantic node count", () => {
    expect(() => parseLocalClientJsoncObject(Buffer.from([0x7b, 0x22, 0xc3, 0x28, 0x22, 0x3a, 0x31, 0x7d]), LIMIT)).toThrow(LocalClientConfigJsoncError);
    expect(() => parseLocalClientJsoncObject(Buffer.from('{"a":1}'), 4)).toThrow(LocalClientConfigJsoncError);
    const deep = '{"a":'.repeat(66) + "0" + "}".repeat(66);
    expect(() => parseLocalClientJsoncObject(Buffer.from(deep), LIMIT)).toThrow(LocalClientConfigJsoncError);
    const broad = '{"a":[' + "0,".repeat(100_000) + "]}";
    expect(() => parseLocalClientJsoncObject(Buffer.from(broad), LIMIT)).toThrow(LocalClientConfigJsoncError);
  });

  it("rejects a semantic postcondition mismatch and oversized output instead of returning partial edits", () => {
    expect(() => editLocalClientJsoncObject(Buffer.from("{}"), [set()], {}, LIMIT)).toThrow(LocalClientConfigJsoncError);
    expect(() => editLocalClientJsoncObject(Buffer.from("{}"), [set("x".repeat(100))], { servers: { [owned]: "x".repeat(100) } }, 32)).toThrow(LocalClientConfigJsoncError);
    expect(() => apply('{"servers":[]}', [set()])).toThrow(LocalClientConfigJsoncError);
  });

  it("checks all comma/comment permutations against semantics and unchanged sibling bytes", () => {
    const markers = ["", " ", "/*note*/", "//note\r\n", "\r\n\t/*note*/ "];
    for (const before of markers) for (const after of markers) for (const trailing of [false, true]) {
      const source = `{"servers":{"one" : [1e2,],${before}"${owned}":{"x":1},${after}"two" : -0${trailing ? "," : ""}}}`;
      for (const operation of [set(), remove]) {
        const output = apply(source, [operation]).toString();
        expect(output).toContain('"one" : [1e2,]');
        expect(output).toContain('"two" : -0');
        expect(output.match(/\/\*note\*\/|\/\/note/gu) ?? []).toEqual(source.match(/\/\*note\*\/|\/\/note/gu) ?? []);
      }
    }
  });
});
