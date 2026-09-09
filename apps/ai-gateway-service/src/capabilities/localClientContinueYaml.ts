import { CST, Parser, isMap, isScalar, isSeq, parseDocument } from "yaml";
import type { Node, YAMLMap, YAMLSeq } from "yaml";
import type { LocalClientConfigJsonValue, LocalClientConfigOperation } from "./localClientConfigTransaction.ts";

export const LOCAL_CLIENT_CONTINUE_YAML_CODEC_VERSION = "local-client-continue-yaml-1.2-v1" as const;
export const LOCAL_CLIENT_CONTINUE_YAML_MAX_BYTES = 65_536;
type JsonObject = Record<string, LocalClientConfigJsonValue>;
type Token = { type: string; offset: number; source: string };
type Edit = { offset: number; length: number; content: string };
type Parsed = { text: string; bom: boolean; root: YAMLMap; list?: YAMLSeq; value: JsonObject; tokens: Token[] };
const CONTAINER = "mcpServers";
const MEMBER = "unified-ai-system";
const MAX_DEPTH = 64;
const MAX_NODES = 100_000;
const MAX_SERVERS = 128;
const FORBIDDEN_KEYS = new Set(["__proto__", "prototype", "constructor", "<<"]);
const TRIVIA = new Set(["space", "newline", "comment"]);

export class LocalClientContinueYamlError extends Error {
  constructor() {
    super("The Continue YAML configuration cannot be safely parsed or edited.");
    this.name = "LocalClientContinueYamlError";
  }
}

/** Fixed YAML 1.2 named-list profile: no aliases, anchors, merges or explicit tags. */
export function parseLocalClientContinueYamlObject(bytes: Buffer, maxBytes = LOCAL_CLIENT_CONTINUE_YAML_MAX_BYTES): JsonObject {
  try { return parseBytes(bytes, maxBytes).value; } catch { throw invalid(); }
}

/** One root-list set; all non-owned entries and their order must be unchanged. */
export function editLocalClientContinueYamlObject(
  original: Buffer, operations: readonly LocalClientConfigOperation[], expected: JsonObject,
  maxBytes = LOCAL_CLIENT_CONTINUE_YAML_MAX_BYTES,
): Buffer {
  try { return editBytes(original, operations, expected, maxBytes); } catch { throw invalid(); }
}

function editBytes(
  original: Buffer, operations: readonly LocalClientConfigOperation[], expected: JsonObject, maxBytes: number,
): Buffer {
  if (!Buffer.isBuffer(original)) throw invalid();
  const snapshot = Buffer.from(original);
  const copiedOperations = cloneJson(operations);
  const copiedExpected = cloneJson(expected);
  if (!Array.isArray(copiedOperations) || copiedOperations.length !== 1 || !record(copiedExpected)) throw invalid();
  const operation = copiedOperations[0];
  if (!record(operation) || !exactKeys(operation, ["op", "path", "value"]) || operation.op !== "set"
    || !Array.isArray(operation.path) || operation.path.length !== 1 || operation.path[0] !== CONTAINER) throw invalid();
  const next = serverList(operation.value);
  const before = parseBytes(snapshot, maxBytes);
  const previous = before.value[CONTAINER] === undefined ? [] : serverList(before.value[CONTAINER]);
  const oldIndex = previous.findIndex(item => item.name === MEMBER);
  const newIndex = next.findIndex(item => item.name === MEMBER);
  if ((oldIndex < 0 && newIndex < 0) || (oldIndex >= 0 && newIndex >= 0 && oldIndex !== newIndex)
    || (oldIndex < 0 && newIndex !== previous.length)
    || canonical(previous.filter(item => item.name !== MEMBER)) !== canonical(next.filter(item => item.name !== MEMBER))) throw invalid();
  if (canonical({ ...before.value, [CONTAINER]: next }) !== canonical(copiedExpected)) throw invalid();
  if (canonical(previous) === canonical(next)) return snapshot;

  let edits: Edit[];
  if (oldIndex >= 0) {
    const node = before.list?.items[oldIndex];
    if (!isMap(node) || !node.range) throw invalid();
    if (newIndex >= 0) {
      edits = removeSyntax(before, node.range[0], node.range[1]);
      if (!edits.length || edits[0]!.offset !== node.range[0]) throw invalid();
      edits[0] = { ...edits[0]!, content: JSON.stringify(next[newIndex]) };
    } else edits = deleteMember(before, oldIndex, node);
  } else if (before.list) {
    edits = appendMember(before, JSON.stringify(next[newIndex]));
  } else edits = insertList(before, JSON.stringify(next[newIndex]));
  const afterBytes = Buffer.from(`${before.bom ? "\ufeff" : ""}${applyEdits(before.text, edits)}`, "utf8");
  const after = parseBytes(afterBytes, maxBytes);
  if (canonical(after.value) !== canonical(copiedExpected)
    || JSON.stringify(comments(after)) !== JSON.stringify(comments(before))) throw invalid();
  return afterBytes;
}

function parseBytes(bytes: Buffer, maxBytes: number): Parsed {
  if (!Buffer.isBuffer(bytes) || !Number.isSafeInteger(maxBytes) || maxBytes < 1
    || maxBytes > LOCAL_CLIENT_CONTINUE_YAML_MAX_BYTES || bytes.length < 1 || bytes.length > maxBytes) throw invalid();
  const snapshot = Buffer.from(bytes);
  const bom = snapshot.length >= 3 && snapshot[0] === 0xef && snapshot[1] === 0xbb && snapshot[2] === 0xbf;
  try {
    const text = new TextDecoder("utf-8", { fatal: true, ignoreBOM: true }).decode(bom ? snapshot.subarray(3) : snapshot);
    const stream = [...new Parser().parse(text)];
    if (stream.filter(token => token.type === "document").length !== 1
      || stream.some(token => token.type === "directive" && !/^%YAML 1\.2$/u.test(token.source.trim()))
      || stream.map(token => CST.stringify(token)).join("") !== text) throw invalid();
    const tokens: Token[] = [];
    const blockScalars: number[] = [];
    const pending: unknown[] = [...stream];
    let tokenNodes = 0;
    while (pending.length) {
      const item = pending.pop();
      if (!item || typeof item !== "object") continue;
      if (++tokenNodes > MAX_NODES) throw invalid();
      if (Array.isArray(item)) { pending.push(...item); continue; }
      const token = item as Record<string, unknown>;
      if (token.type === "block-scalar" && typeof token.offset === "number") blockScalars.push(token.offset);
      else if (typeof token.type === "string" && typeof token.offset === "number" && typeof token.source === "string") {
        if (text.slice(token.offset, token.offset + token.source.length) !== token.source) throw invalid();
        tokens.push({ type: token.type, offset: token.offset, source: token.source });
      }
      pending.push(...Object.values(token).filter(value => value !== null && typeof value === "object"));
    }
    tokens.sort((a, b) => a.offset - b.offset);
    const doc = parseDocument(text, { version: "1.2", schema: "core", strict: true, uniqueKeys: true,
      intAsBigInt: true, keepSourceTokens: true, prettyErrors: false, resolveKnownTags: false });
    if (doc.errors.length || doc.warnings.length || !isMap(doc.contents)) throw invalid();
    const value = nodeValue(doc.contents, 0, { nodes: 0 });
    if (!record(value) || typeof value.name !== "string" || !value.name.trim()
      || typeof value.version !== "string" || !value.version.trim() || value.schema !== "v1") throw invalid();
    const property = doc.contents.items.find(pair => isScalar(pair.key) && pair.key.value === CONTAINER);
    const list = property?.value;
    if (property && !isSeq(list)) throw invalid();
    if (value[CONTAINER] !== undefined) {
      const servers = serverList(value[CONTAINER]);
      const index = servers.findIndex(item => item.name === MEMBER);
      const node = index < 0 ? undefined : (list as YAMLSeq).items[index];
      if (node && (!isMap(node) || !node.range
        || blockScalars.some(offset => offset >= node.range![0] && offset < node.range![1]))) throw invalid();
    }
    return { text, bom, root: doc.contents, ...(isSeq(list) ? { list } : {}), value, tokens };
  } catch { throw invalid(); }
}

function nodeValue(node: unknown, depth: number, budget: { nodes: number }): LocalClientConfigJsonValue {
  if (++budget.nodes > MAX_NODES || depth > MAX_DEPTH) throw invalid();
  if (node === null) return null;
  if (!isMap(node) && !isSeq(node) && !isScalar(node)) throw invalid();
  if (node.anchor || node.tag) throw invalid();
  if (isMap(node)) {
    const output: JsonObject = Object.create(null);
    for (const pair of node.items) {
      if (!isScalar(pair.key) || pair.key.anchor || pair.key.tag || !validKey(pair.key.value) || Object.hasOwn(output, pair.key.value)) throw invalid();
      output[pair.key.value] = nodeValue(pair.value, depth + 1, budget);
    }
    return output;
  }
  if (isSeq(node)) return node.items.map(item => nodeValue(item, depth + 1, budget));
  const value = node.value;
  if (typeof value === "bigint") {
    if (value < BigInt(Number.MIN_SAFE_INTEGER) || value > BigInt(Number.MAX_SAFE_INTEGER)) throw invalid();
    return Number(value);
  }
  if (value === null || typeof value === "string" || typeof value === "boolean") return value;
  if (typeof value === "number" && Number.isFinite(value) && (!Number.isInteger(value) || Number.isSafeInteger(value))) return value;
  throw invalid();
}

function serverList(value: unknown): JsonObject[] {
  if (!Array.isArray(value) || value.length > MAX_SERVERS) throw invalid();
  const names = new Set<string>();
  for (const item of value) {
    if (!record(item) || typeof item.name !== "string" || !item.name.trim() || names.has(item.name)) throw invalid();
    names.add(item.name);
    if (item.name === MEMBER) {
      if (Object.keys(item).some(key => !["name", "type", "command", "args", "cwd"].includes(key))
        || (Object.hasOwn(item, "type") && item.type !== "stdio")
        || typeof item.command !== "string" || !item.command.trim()
        || (Object.hasOwn(item, "cwd") && (typeof item.cwd !== "string" || !item.cwd.trim()))
        || (Object.hasOwn(item, "args") && (!Array.isArray(item.args) || item.args.length > 128 || item.args.some(arg => typeof arg !== "string")))) throw invalid();
    }
  }
  return value as JsonObject[];
}

function appendMember(parsed: Parsed, member: string): Edit[] {
  const list = parsed.list!;
  if (!list.range || !list.srcToken) throw invalid();
  if (list.flow) return appendFlow(parsed, list, member);
  if (list.srcToken.type !== "block-seq") throw invalid();
  return insertLine(parsed.text, list.range[1], `${" ".repeat(list.srcToken.indent)}- ${member}`);
}

function insertList(parsed: Parsed, member: string): Edit[] {
  if (!parsed.root.range) throw invalid();
  if (parsed.root.flow) return appendFlow(parsed, parsed.root, `${JSON.stringify(CONTAINER)}:[${member}]`);
  if (parsed.root.srcToken?.type !== "block-map") throw invalid();
  const indent = " ".repeat(parsed.root.srcToken.indent);
  const newline = parsed.text.includes("\r\n") ? "\r\n" : "\n";
  return insertLine(parsed.text, parsed.root.range[1], `${indent}${CONTAINER}:${newline}${indent}  - ${member}`);
}

function insertLine(text: string, offset: number, line: string): Edit[] {
  const newline = text.includes("\r\n") ? "\r\n" : "\n";
  const prefix = offset > 0 && text[offset - 1] !== "\n" ? newline : "";
  const suffix = offset < text.length || text.endsWith("\n") ? newline : "";
  return [{ offset, length: 0, content: prefix + line + suffix }];
}

function appendFlow(parsed: Parsed, collection: YAMLMap | YAMLSeq, content: string): Edit[] {
  const close = flowClose(collection);
  const last = collection.items.at(-1);
  const pair = isMap(collection) ? last as { key?: Node; value?: Node } | undefined : undefined;
  const lastNode = pair ? pair.value ?? pair.key : last;
  const edits: Edit[] = [];
  if (lastNode) {
    if (!(lastNode as Node).range) throw invalid();
    const end = (lastNode as Node).range![1];
    const trailing = syntaxBetween(parsed, end, close.offset);
    if (trailing.length > 1 || (trailing.length === 1 && trailing[0]!.type !== "comma")) throw invalid();
    if (!trailing.length) edits.push({ offset: end, length: 0, content: "," });
  }
  const linePrefix = parsed.text.slice(parsed.text.lastIndexOf("\n", close.offset - 1) + 1, close.offset);
  const indent = collection.srcToken?.type === "flow-collection" ? collection.srcToken.indent : 0;
  const padding = /^ *$/u.test(linePrefix) && linePrefix.length <= indent ? " ".repeat(indent + 2 - linePrefix.length) : "";
  edits.push({ offset: close.offset, length: 0, content: padding + content });
  return edits;
}

function deleteMember(parsed: Parsed, index: number, node: YAMLMap): Edit[] {
  const list = parsed.list!;
  if (!node.range || !list.srcToken) throw invalid();
  if (!list.flow) {
    if (list.srcToken.type !== "block-seq") throw invalid();
    const marker = list.srcToken.items[index]?.start.find(token => token.type === "seq-item-ind");
    if (!marker) throw invalid();
    const edits = removeSyntax(parsed, marker.offset, node.range[1]);
    if (!edits.length || edits[0]!.offset !== marker.offset) throw invalid();
    const parentIndent = parsed.root.srcToken?.type === "block-map" ? parsed.root.srcToken.indent : 0;
    if (list.items.length === 1) edits[0] = { ...edits[0]!, content: list.srcToken.indent <= parentIndent ? "  []" : "[]" };
    return edits;
  }
  const edits = removeSyntax(parsed, node.range[0], node.range[1]);
  const next = list.items[index + 1] as Node | undefined;
  const after = syntaxBetween(parsed, node.range[1], next?.range?.[0] ?? flowClose(list).offset);
  if (after.length > 1 || (after.length === 1 && after[0]!.type !== "comma")) throw invalid();
  if (after[0]) edits.push({ offset: after[0].offset, length: after[0].source.length, content: "" });
  else if (index > 0) {
    const previous = list.items[index - 1] as Node;
    if (!previous.range) throw invalid();
    const before = syntaxBetween(parsed, previous.range[1], node.range[0]);
    if (before.length !== 1 || before[0]!.type !== "comma") throw invalid();
    edits.push({ offset: before[0]!.offset, length: before[0]!.source.length, content: "" });
  }
  return edits;
}

function flowClose(collection: YAMLMap | YAMLSeq): Token {
  const cst = collection.srcToken;
  if (cst?.type !== "flow-collection") throw invalid();
  const close = cst.end.find(token => token.type === (isSeq(collection) ? "flow-seq-end" : "flow-map-end"));
  if (!close) throw invalid();
  return close;
}

function syntaxBetween(parsed: Parsed, start: number, end: number): Token[] {
  return parsed.tokens.filter(token => token.source.length > 0 && token.offset >= start && token.offset < end && !TRIVIA.has(token.type));
}
function removeSyntax(parsed: Parsed, start: number, end: number): Edit[] {
  return syntaxBetween(parsed, start, end).map(token => {
    if (token.offset + token.source.length > end) throw invalid();
    return { offset: token.offset, length: token.source.length, content: "" };
  });
}
function applyEdits(text: string, edits: Edit[]): string {
  let offset = 0; let output = "";
  for (const edit of [...edits].sort((a, b) => a.offset - b.offset)) {
    if (edit.offset < offset || edit.length < 0 || edit.offset + edit.length > text.length) throw invalid();
    output += text.slice(offset, edit.offset) + edit.content;
    offset = edit.offset + edit.length;
  }
  return output + text.slice(offset);
}
function comments(parsed: Parsed): string[] { return parsed.tokens.filter(token => token.type === "comment").map(token => token.source); }
function validKey(key: unknown): key is string {
  return typeof key === "string" && key.length > 0 && key.length <= 128
    && !/[\u0000-\u001f\u007f]/u.test(key) && !FORBIDDEN_KEYS.has(key);
}
function record(value: unknown): value is JsonObject {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    && [Object.prototype, null].includes(Object.getPrototypeOf(value));
}
function exactKeys(value: JsonObject, keys: string[]): boolean {
  return Object.keys(value).length === keys.length && keys.every(key => Object.hasOwn(value, key));
}

/** Snapshot JSON arguments through descriptors; never evaluate accessor values. */
function cloneJson(value: unknown, depth = 0, budget = { nodes: 0, bytes: 0 }): LocalClientConfigJsonValue {
  if (++budget.nodes > MAX_NODES || depth > MAX_DEPTH) throw invalid();
  if (value === null || typeof value === "boolean") return value;
  if (typeof value === "string") {
    budget.bytes += Buffer.byteLength(value); if (budget.bytes > LOCAL_CLIENT_CONTINUE_YAML_MAX_BYTES) throw invalid();
    return value;
  }
  if (typeof value === "number" && Number.isFinite(value) && (!Number.isInteger(value) || Number.isSafeInteger(value))) return value;
  if (!Array.isArray(value) && !record(value)) throw invalid();
  const array = Array.isArray(value);
  if (array && (Object.getPrototypeOf(value) !== Array.prototype || Reflect.ownKeys(value).length !== value.length + 1)) throw invalid();
  const result: JsonObject | LocalClientConfigJsonValue[] = array ? [] : Object.create(null);
  for (const key of Reflect.ownKeys(value)) {
    if (array && key === "length") continue;
    if (!validKey(key) || (array && (!/^(0|[1-9][0-9]*)$/u.test(key) || Number(key) >= value.length))) throw invalid();
    const descriptor = Object.getOwnPropertyDescriptor(value, key)!;
    if (!descriptor.enumerable || descriptor.get || descriptor.set) throw invalid();
    budget.bytes += Buffer.byteLength(key); if (budget.bytes > LOCAL_CLIENT_CONTINUE_YAML_MAX_BYTES) throw invalid();
    (result as JsonObject)[key] = cloneJson(descriptor.value, depth + 1, budget);
  }
  return result;
}
function canonical(value: LocalClientConfigJsonValue): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  return `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${canonical(value[key]!)}`).join(",")}}`;
}
function invalid(): LocalClientContinueYamlError { return new LocalClientContinueYamlError(); }
