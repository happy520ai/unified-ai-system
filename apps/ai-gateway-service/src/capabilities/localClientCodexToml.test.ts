import { beforeEach, describe, expect, it, vi } from "vitest";
import type { LocalClientConfigJsonValue, LocalClientConfigOperation } from "./localClientConfigTransaction.ts";
const converter = vi.hoisted(() => ({ calls: 0, forbidden: false }));
vi.mock("toml-eslint-parser", async (load) => {
  const actual = await load<typeof import("toml-eslint-parser")>();
  return { ...actual, getStaticTOMLValue: (node: Parameters<typeof actual.getStaticTOMLValue>[0]) => {
    converter.calls += 1;
    if (converter.forbidden) throw new Error("Unsafe input reached the converter.");
    return actual.getStaticTOMLValue(node);
  } };
});
import { LocalClientCodexTomlError, editLocalClientCodexTomlObject, parseLocalClientCodexTomlObject } from "./localClientCodexToml.ts";

const MEMBER = "unified-ai-system";
const definition = { command: "C:\\Gateway Files\\node.exe", args: ["entry.mjs", "quote\"slash\\", "line\nnext", "😀中\u007f"], cwd: "E:/workspace" };
const set = (value: LocalClientConfigJsonValue = definition): LocalClientConfigOperation => ({ op: "set", path: ["mcp_servers", MEMBER], value });
const remove: LocalClientConfigOperation = { op: "delete", path: ["mcp_servers", MEMBER] };
type ObjectValue = Record<string, LocalClientConfigJsonValue>;
const parse = (text: string) => parseLocalClientCodexTomlObject(Buffer.from(text));
const edit = (text: string, operation: LocalClientConfigOperation, expected: ObjectValue) =>
  editLocalClientCodexTomlObject(Buffer.from(text), [operation], expected);

describe("pure Codex TOML 1.0 source codec", () => {
  beforeEach(() => { converter.calls = 0; converter.forbidden = false; });

  it("keeps the original header, all comments, CRLF and unrelated source slices during replacement", () => {
    const prefix = "model = 'unchanged-native-model'\r\n[native]\r\nbase_url = 'unchanged-native-url'\r\nvalues = { n = 1e2, ok = true }\r\n";
    const header = "[mcp_servers.'unified-ai-system'] # header\r\n";
    const body = " command = 'old' # command\r\n args = [\r\n  'old', # inside args\r\n ]\r\n cwd = 'old-dir'\r\n";
    const suffix = "[mcp_servers.other]\r\ncommand = 'untouched'\r\nargs = [ 'literal # value', ]\r\n# footer\r\n\r\n";
    const expected = { model: "unchanged-native-model", native: { base_url: "unchanged-native-url", values: { n: 100, ok: true } },
      mcp_servers: { [MEMBER]: definition, other: { command: "untouched", args: ["literal # value"] } } };
    const original = Buffer.from(prefix + header + body + suffix);
    const output = editLocalClientCodexTomlObject(original, [set()], expected);
    expect(output.toString().startsWith(prefix + header)).toBe(true);
    expect(output.toString().endsWith(suffix)).toBe(true);
    expect(output.toString()).toContain("# command\r\n");
    expect(output.toString()).toContain("# inside args\r\n");
    expect(output.toString().replace(/\r\n/gu, "")).not.toContain("\n");
    expect(parseLocalClientCodexTomlObject(output)).toEqual(expected);
    expect(original).toEqual(Buffer.from(prefix + header + body + suffix));
  });

  it("recognizes decoded quoted table names and leaves literal dotted root keys alone", () => {
    const original = '"mcp_servers.unified-ai-system" = "literal-key"\n["mcp_servers"."unified\\u002dai-system"]\ncommand="old"';
    const output = edit(original, set({ command: "node" }), { "mcp_servers.unified-ai-system": "literal-key", mcp_servers: { [MEMBER]: { command: "node" } } });
    expect(output.toString()).toContain('["mcp_servers"."unified\\u002dai-system"]');
    expect(output.toString().endsWith("\n")).toBe(false);
    expect(output.toString()).toContain('"mcp_servers.unified-ai-system" = "literal-key"');
  });

  for (const source of ["", "# keep\n\n", "[settings]\nx=1", "[mcp_servers]\n"]) {
    it(`adds an absolute member table without changing prior table context: ${JSON.stringify(source)}`, () => {
      const expected = { ...(source.includes("settings") ? { settings: { x: 1 } } : {}), mcp_servers: { [MEMBER]: { command: "node", args: [] } } };
      const output = edit(source, set({ command: "node", args: [] }), expected).toString();
      if (source.includes("settings")) expect(output.startsWith(source)).toBe(true);
      if (source.startsWith("#")) expect(output.startsWith("# keep")).toBe(true);
      expect(/\n$/u.test(output)).toBe(/\n$/u.test(source));
      if (source.endsWith("\n\n")) expect(output.endsWith("\n\n")).toBe(true);
      expect(parse(output)).toEqual(expected);
    });
  }

  for (const suffix of ["", " # end", "\r\n# before other\r\n[other]\r\nx=1\r\n"]) {
    it(`fills an empty table without swallowing a header comment or following table: ${JSON.stringify(suffix)}`, () => {
      const source = '[mcp_servers."unified-ai-system"]' + suffix;
      const expected = { mcp_servers: { [MEMBER]: { command: "node" } }, ...(suffix.includes("other") ? { other: { x: 1 } } : {}) };
      const output = edit(source, set({ command: "node" }), expected);
      if (suffix.includes("#")) expect(output.toString()).toContain(suffix.includes("other") ? "# before other\r\n" : "# end\n");
      expect(parseLocalClientCodexTomlObject(output)).toEqual(expected);
      expect(output.toString().endsWith("\n")).toBe(source.endsWith("\n"));
    });
  }

  it("keeps a semantic no-op byte-identical including field order and string style", () => {
    const original = '[mcp_servers."unified-ai-system"]\nargs=["a",] # keep\ncommand=\'node\'\n';
    expect(edit(original, set({ command: "node", args: ["a"] }), { mcp_servers: { [MEMBER]: { args: ["a"], command: "node" } } }))
      .toEqual(Buffer.from(original));
  });

  it("deletes only the member and preserves an implicit empty parent required by object-path semantics", () => {
    const source = '[mcp_servers."unified-ai-system"] # header\ncommand="node" # body\n';
    const output = edit(source, remove, { mcp_servers: {} }).toString();
    expect(output).toContain("[mcp_servers]");
    expect(output).toContain("# header\n"); expect(output).toContain("# body\n");
    expect(parse(output)).toEqual({ mcp_servers: {} });
    expect(() => edit(source, remove, {})).toThrow(LocalClientCodexTomlError);
  });

  it("keeps an explicit parent and foreign members on delete", () => {
    const prefix = '[mcp_servers]\nother={ command="foreign", args=["x"] }\n';
    const source = prefix + '[mcp_servers."unified-ai-system"]\ncommand="node" # owned\n[tail]\nraw=1e2\n';
    const output = edit(source, remove, { mcp_servers: { other: { command: "foreign", args: ["x"] } }, tail: { raw: 100 } }).toString();
    expect(output.startsWith(prefix)).toBe(true); expect(output.endsWith("[tail]\nraw=1e2\n")).toBe(true);
    expect(output).toContain("# owned\n"); expect(output.match(/\[mcp_servers\]/gu)).toHaveLength(1);
  });

  for (const source of [
    'x=1\nx=2', '"x"=1\n"\\u0078"=2', '[a]\nx=1\n[a]\ny=2',
    'mcp_servers={}', 'mcp_servers.other.command="node"', '[mcp_servers]\n"unified-ai-system"={command="node"}',
    '[mcp_servers]\nunified-ai-system.command="node"', '[[mcp_servers.unified-ai-system]]\ncommand="node"',
    '[mcp_servers.unified-ai-system.env]\nX="opaque"', '[mcp_servers.unified-ai-system]\ncommand="node"\nenabled_tools=["x"]',
    '[mcp_servers.unified_ai_system]\ncommand="legacy"', '[mcp_servers.unified-ai-system]\nargs=[1]',
    '[mcp_servers.unified-ai-system]\ncommand={nested="wrong-type"}',
    'x=nan', 'x=+inf', 'x=-inf', 'x=9007199254740993', 'x=0x20000000000001',
    'x=1979-05-27T07:32:00Z', 'x=1979-05-27T07:32:00', 'x=1979-05-27', 'x=07:32:00',
    '__proto__.tomlPollutionSentinel="bad"', '[constructor.prototype]\ntomlPollutionSentinel="bad"',
    'x={prototype=1}', '""=1', '"\\u0000"=1', 'x={\na=1,\n}', 'x="bad\\q"', '\ufeffx=1',
  ]) {
    it(`rejects unsupported or ambiguous source before JS conversion: ${JSON.stringify(source)}`, () => {
      converter.forbidden = true;
      expect(() => parse(source)).toThrow(LocalClientCodexTomlError);
      expect(converter.calls).toBe(0);
      expect(Object.hasOwn(Object.prototype, "tomlPollutionSentinel")).toBe(false);
    });
  }

  it("retains unrelated multiline strings, literal escapes, arrays of tables and negative zero", () => {
    const source = 'text="""line\n# scalar text\nnext"""\npath=\'C:\\data\'\nzero=-0.0\n[[items]]\nx=1\n[[items]]\nx=2\n';
    const expected = { text: "line\n# scalar text\nnext", path: "C:\\data", zero: -0, items: [{ x: 1 }, { x: 2 }], mcp_servers: { [MEMBER]: { command: "node" } } };
    const output = edit(source, set({ command: "node" }), expected);
    expect(output.toString().startsWith(source.slice(0, -1))).toBe(true);
    expect(Object.is(parseLocalClientCodexTomlObject(output).zero, -0)).toBe(true);
  });

  it("rejects invalid UTF-8, oversized input/output and adversarial nesting with source-free errors", () => {
    converter.forbidden = true;
    for (const bytes of [Buffer.from([0xc3, 0x28]), Buffer.alloc(65_537, 32), Buffer.from('x=' + '['.repeat(12_000) + '0' + ']'.repeat(12_000))]) {
      expect(() => parseLocalClientCodexTomlObject(bytes)).toThrow(LocalClientCodexTomlError);
    }
    expect(converter.calls).toBe(0); converter.forbidden = false;
    expect(() => editLocalClientCodexTomlObject(Buffer.from(""), [set()], { mcp_servers: { [MEMBER]: definition } }, 24)).toThrow(LocalClientCodexTomlError);
    try { parse('private_fixture_field="private-fixture-data"\nx=nan'); } catch (error) {
      expect(String(error)).not.toContain("private-fixture");
    }
  });

  it("refuses arbitrary paths, unknown operation fields, accessors and mismatched semantic postconditions", () => {
    expect(() => edit("", { op: "set", path: ["model"], value: "redirect" }, { model: "redirect" })).toThrow(LocalClientCodexTomlError);
    expect(() => edit("", { ...set(), extra: true } as never, {})).toThrow(LocalClientCodexTomlError);
    let getters = 0;
    const operation = Object.defineProperty({ path: ["mcp_servers", MEMBER], value: definition }, "op", { enumerable: true, get() { getters++; return "set"; } });
    expect(() => edit("", operation as never, {})).toThrow(LocalClientCodexTomlError); expect(getters).toBe(0);
    expect(() => edit("", set(), { model: "unapproved" })).toThrow(LocalClientCodexTomlError);
    expect(() => edit("", remove, {})).toThrow(LocalClientCodexTomlError);
  });

  it("rejects operation-array accessors before reading an operation", () => {
    let reads = 0;
    const operations = Object.defineProperty([set()], "0", { enumerable: true, get() { reads++; return set(); } });
    expect(() => editLocalClientCodexTomlObject(Buffer.from(""), operations, { mcp_servers: { [MEMBER]: definition } })).toThrow(LocalClientCodexTomlError);
    expect(reads).toBe(0);
  });

  it("snapshots caller bytes before decoding begins", () => {
    const original = Buffer.from("x=1"); const Decoder = globalThis.TextDecoder;
    vi.stubGlobal("TextDecoder", class extends Decoder { constructor(...args: ConstructorParameters<typeof Decoder>) { super(...args); original[2] = 50; } });
    try { expect(parseLocalClientCodexTomlObject(original)).toEqual({ x: 1 }); }
    finally { vi.unstubAllGlobals(); }
  });
});
