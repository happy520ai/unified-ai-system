import { describe, expect, it } from "vitest";
import { parseDocument } from "yaml";
import {
  editLocalClientContinueYamlObject as edit, parseLocalClientContinueYamlObject as read,
  LocalClientContinueYamlError, LOCAL_CLIENT_CONTINUE_YAML_MAX_BYTES as LIMIT,
} from "./localClientContinueYaml.ts";

const header = 'name: "Fixture"\nversion: 1.0.0\nschema: v1\n';
const base = { name: "Fixture", version: "1.0.0", schema: "v1" };
const managed = { name: "unified-ai-system", command: "node", args: ["C:\\fixture dir\\entry.mjs", "--literal=${{ secrets.SAMPLE }}"] };
const other = { name: "other", command: "untouched", args: ["a", "b"] };
const old = { name: "unified-ai-system", command: "old" };
const operation = (servers: unknown[]) => [{ op: "set", path: ["mcpServers"], value: servers }] as any;
function change(text: string, servers: unknown[], extra = {}) {
  const original = Buffer.from(text);
  const expected = { ...base, ...extra, mcpServers: servers } as any;
  const after = edit(original, operation(servers), expected);
  expect(parseDocument(after.toString()).toJS()).toEqual(expected);
  expect(original).toEqual(Buffer.from(text));
  expect(after.length).toBeLessThanOrEqual(LIMIT);
  return after.toString();
}
function expectInvalid(action: () => unknown) {
  expect(action).toThrow(LocalClientContinueYamlError);
  try { action(); } catch (error) {
    expect((error as Error).message).toBe("The Continue YAML configuration cannot be safely parsed or edited.");
  }
}

describe("bounded lossless Continue YAML named-server codec", () => {
  it("parses JSON-compatible YAML without modifying an unrelated multiline scalar", () => {
    expect(read(Buffer.from(header + 'rules:\n  - |\n    retain # literal\n    two lines\nmodels: []\n')))
      .toEqual({ ...base, rules: ["retain # literal\ntwo lines\n"], models: [] });
  });

  it.each(["\n", "\r\n"])("appends an absent list while preserving all existing bytes (%j)", newline => {
    const source = (header + '# footer\n').replaceAll("\n", newline);
    const after = change(source, [managed]);
    expect(after.replace(`mcpServers:${newline}  - ${JSON.stringify(managed)}${newline}`, "")).toBe(source);
    expect(after.includes("\r\n")).toBe(newline === "\r\n");
  });

  it("preserves UTF-8 BOM, a YAML 1.2 directive, document markers and no final newline", () => {
    const source = '\ufeff%YAML 1.2\n---\n' + header + 'models: []\n...';
    const after = change(source, [managed], { models: [] });
    expect(after.startsWith('\ufeff%YAML 1.2\n---\n')).toBe(true);
    expect(after.endsWith('...')).toBe(true);
    expect(after.replace(`mcpServers:\n  - ${JSON.stringify(managed)}\n`, "")).toBe(source);
  });

  it("preserves a Unicode source and all unrelated slices when appending to a block list", () => {
    const source = header + 'models:\n  - name: 原样模型\n    provider: untouched\nmcpServers: # list\n  - name: other # other name\n    command: untouched\n    args: [a, b]\n  # tail comment\nrules: ["raw: # data"]\n';
    const after = change(source, [other, managed], { models: [{ name: "原样模型", provider: "untouched" }], rules: ["raw: # data"] });
    expect(after.replace(`  - ${JSON.stringify(managed)}\n`, "")).toBe(source);
  });

  it("uses the original root indentation when adding an absent list", () => {
    const source = header.split("\n").filter(Boolean).map(line => `  ${line}\n`).join("");
    const after = change(source, [managed]);
    expect(after.replace(`  mcpServers:\n    - ${JSON.stringify(managed)}\n`, "")).toBe(source);
  });

  it("retains an empty indentless list beneath an indented root", () => {
    const source = header.split("\n").filter(Boolean).map(line => `  ${line}\n`).join("")
      + '  mcpServers:\n  - {name: unified-ai-system, command: old}\n';
    change(source, []);
  });

  it("indents a flow-list insertion beyond the indented parent map", () => {
    const source = header.split("\n").filter(Boolean).map(line => `  ${line}\n`).join("") + '  mcpServers: [\n  ]\n';
    change(source, [managed]);
  });

  it.each(["[]", "[ ]", "[ # retained\n  ]"])("inserts into an empty flow list %s", list => {
    const source = header + `mcpServers: ${list}\n`;
    const after = change(source, [managed]);
    expect(after.replace(JSON.stringify(managed), "")).toBe(source);
  });

  it("adds a missing member in an existing flow list with trailing comma", () => {
    const source = header + 'mcpServers: [{name: other, command: untouched, args: [a,b]}, ] # footer\n';
    const after = change(source, [other, managed]);
    expect(after.replace(JSON.stringify(managed), "")).toBe(source);
  });

  it("adds a missing list in a flow root without reserializing existing keys", () => {
    const source = '{name: "Fixture", version: 1.0.0, schema: v1}';
    const after = change(source, [managed]);
    expect(after).toBe(source.slice(0, -1) + `,"mcpServers":[${JSON.stringify(managed)}]}`);
  });

  it("reuses a flow root's trailing comma without adding a second one", () => {
    const source = '{name: "Fixture", version: 1.0.0, schema: v1, }';
    expect(change(source, [managed])).toBe(source.slice(0, -1) + `"mcpServers":[${JSON.stringify(managed)}]}`);
  });

  it.each(['x:,', '? x', 'x: null,'])("preserves a final null-valued flow pair (%s)", last => {
    change(`{name: "Fixture", version: 1.0.0, schema: v1, ${last}}`, [managed], { x: null });
  });

  it("replaces only the named block entry while retaining every comment", () => {
    const source = header + 'mcpServers:\n  - name: unified-ai-system # name stays\n    command: old # command stays\n  - name: other\n    command: untouched\n    args: [a,b]\n';
    const after = change(source, [managed, other]);
    expect(after).toContain('  - name: other\n    command: untouched\n    args: [a,b]\n');
    expect([...after.matchAll(/#[^\r\n]*/gu)].map(item => item[0])).toEqual(["# name stays", "# command stays"]);
  });

  it.each([0, 1, 2])("deletes only the named block entry at position %s", index => {
    const servers = [other, { name: "last", command: "last" }];
    const before = [...servers]; before.splice(index, 0, old);
    const source = header + 'mcpServers:\n' + before.map(server => `  - ${JSON.stringify(server)} # ${server.name}\n`).join("");
    const after = change(source, servers);
    for (const server of servers) expect(after).toContain(`  - ${JSON.stringify(server)} # ${server.name}\n`);
    expect(after).toContain('# unified-ai-system');
  });

  it.each(["  ", ""])("keeps an empty list after deleting its only block entry (indent=%j)", indent => {
    const after = change(header + `mcpServers:\n${indent}- {name: unified-ai-system, command: old} # retained`, []);
    expect(after).toContain("# retained");
    expect(after.endsWith("\n")).toBe(false);
  });

  it.each([0, 1, 2])("deletes a named flow entry at position %s with a trailing comma", index => {
    const servers = [other, { name: "last", command: "last" }];
    const before = [...servers]; before.splice(index, 0, old);
    change(header + `mcpServers: [${before.map(server => JSON.stringify(server)).join(", ")}, ]\n`, servers);
  });

  it("keeps exact original bytes for a semantic no-op", () => {
    const source = Buffer.from(header + 'mcpServers:\n  - name: "unified-ai-system" # retained\n    command: node\n    args: []\n');
    const servers = [{ name: "unified-ai-system", command: "node", args: [] }];
    expect(edit(source, operation(servers), { ...base, mcpServers: servers })).toEqual(source);
  });

  it.each(["replace", "delete"])("preserves Unicode prefixes and comments around an edited flow entry (%s)", action => {
    const prefix = header + 'rules: ["😀保留原文"]\n';
    const source = prefix + 'mcpServers: [ # list comment\n  {name: other, command: untouched, args: [a,b]}, # other comment\n  {name: unified-ai-system, # name comment\n   command: old}, # managed comment\n]\n';
    const servers = action === "replace" ? [other, managed] : [other];
    const after = change(source, servers, { rules: ["😀保留原文"] });
    expect(after.startsWith(prefix)).toBe(true);
    expect(after).toContain('{name: other, command: untouched, args: [a,b]}');
    expect([...after.matchAll(/#[^\r\n]*/gu)].map(item => item[0]))
      .toEqual([...source.matchAll(/#[^\r\n]*/gu)].map(item => item[0]));
  });

  it("enforces the whole-root semantic postcondition and forbids changes to other servers", () => {
    const source = Buffer.from(header + `mcpServers: [${JSON.stringify(other)}]\nmodels: []\n`);
    expectInvalid(() => edit(source, operation([managed]), { ...base, models: [], mcpServers: [managed] }));
    expectInvalid(() => edit(source, operation([other, managed]), { ...base, models: ["changed"], mcpServers: [other, managed] }));
    expectInvalid(() => edit(source, operation([managed, other]), { ...base, models: [], mcpServers: [managed, other] }));
  });

  it.each([
    'name: Duplicate\n', 'mcpServers: {}\n', 'mcpServers: null\n',
    'mcpServers: [{name: unified-ai-system, command: a}, {name: unified-ai-system, command: b}]\n',
    'mcpServers: [{uses: owner/package}]\n', 'mcpServers: [{name: unified-ai-system, command: node, env: {X: literal}}]\n',
    'mcpServers: [{name: unified-ai-system, type: sse, url: https://invalid.example}]\n',
    'x: &anchor {keep: true}\ny: *anchor\n', 'x: {<<: {keep: true}}\n',
    'x: !custom value\n', 'x: !!str value\n', 'x: .inf\n', 'x: .nan\n', 'x: 9007199254740993\n',
    'x: {constructor: forbidden}\n', 'x: {"__proto__": forbidden}\n', '? [a,b]\n: invalid\n',
    'mcpServers:\n  - name: unified-ai-system\n    command: |\n      node\n',
  ])("fails closed with fixed errors for unsupported YAML: %s", suffix => {
    expectInvalid(() => read(Buffer.from(header + suffix)));
  });

  it.each(['', '[]', 'name: missing\n', '%YAML 1.1\n---\n' + header, header + '---\n' + header])("rejects an invalid document profile", source => {
    expectInvalid(() => read(Buffer.from(source)));
  });

  it("bounds bytes, depth and named-server count before producing an output", () => {
    expectInvalid(() => read(Buffer.from(header + '#'.repeat(LIMIT))));
    expectInvalid(() => read(Buffer.from(header), LIMIT + 1));
    expectInvalid(() => read(Buffer.from(header + 'x: ' + '['.repeat(65) + '0' + ']'.repeat(65))));
    expectInvalid(() => read(Buffer.concat([Buffer.from(header), Buffer.from([0xc3, 0x28])])));
    const servers = Array.from({ length: 129 }, (_, index) => ({ name: `n${index}`, command: "node" }));
    expectInvalid(() => read(Buffer.from(header + `mcpServers: ${JSON.stringify(servers)}`)));
  });

  it("rejects edits whose resulting bytes exceed the configured limit", () => {
    const source = Buffer.from(header + '# ' + 'x'.repeat(LIMIT - header.length - 40));
    expect(source.length).toBeLessThan(LIMIT);
    expectInvalid(() => edit(source, operation([managed]), { ...base, mcpServers: [managed] }));
  });

  it("rejects wrong operations, prototype-bearing values and accessor input without invoking getters", () => {
    const source = Buffer.from(header);
    for (const ops of [[], [{ op: "delete", path: ["mcpServers"] }], [{ op: "set", path: ["mcpServers", "unified-ai-system"], value: managed }]]) {
      expectInvalid(() => edit(source, ops as any, { ...base, mcpServers: [managed] }));
    }
    let accesses = 0;
    const value = { name: "unified-ai-system", get command() { accesses += 1; return "node"; } };
    expectInvalid(() => edit(source, operation([value]), { ...base, mcpServers: [managed] }));
    const accessorOperation = [{ op: "set", path: ["mcpServers"], get value() { accesses += 1; return [managed]; } }];
    expectInvalid(() => edit(source, accessorOperation as any, { ...base, mcpServers: [managed] }));
    const accessorExpected = { ...base, get mcpServers() { accesses += 1; return [managed]; } };
    expectInvalid(() => edit(source, operation([managed]), accessorExpected));
    expect(accesses).toBe(0);
    expectInvalid(() => edit(source, operation([Object.assign(Object.create({ hidden: true }), managed)]), { ...base, mcpServers: [managed] }));
  });

  it("does not leak details from a throwing in-process Proxy", () => {
    const hostile = new Proxy({}, { getPrototypeOf() { throw new Error("SENTINEL_INPUT_DETAIL"); } });
    expectInvalid(() => edit(Buffer.from(header), operation([managed]), hostile as any));
  });
});
