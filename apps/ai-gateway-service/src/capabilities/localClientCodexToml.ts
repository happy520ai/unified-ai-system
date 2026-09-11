import { getStaticTOMLValue, parseTOML } from "toml-eslint-parser";
import type { AST } from "toml-eslint-parser";
import type { LocalClientConfigJsonValue, LocalClientConfigOperation } from "./localClientConfigTransaction.ts";

export const LOCAL_CLIENT_CODEX_TOML_CODEC_VERSION = "local-client-codex-toml-1.0-v1" as const;
const MAX_BYTES = 65_536;
const MAX_DEPTH = 64;
const MAX_NODES = 100_000;
const CONTAINER = "mcp_servers";
const MEMBER = "unified-ai-system";
const LEGACY_MEMBER = "unified_ai_system";
const FIELDS = ["command", "args", "cwd"] as const;
const FORBIDDEN = new Set(["__proto__", "prototype", "constructor"]);
type JsonObject = Record<string, LocalClientConfigJsonValue>;
type Definition = { command?: string; args?: string[]; cwd?: string };
type Edit = { offset: number; length: number; content: string };
type Parsed = { text: string; ast: AST.TOMLProgram; value: JsonObject; member?: AST.TOMLTable; explicitParent: boolean };

export class LocalClientCodexTomlError extends Error {
  constructor() {
    super("The Codex TOML configuration cannot be safely parsed or edited.");
    this.name = "LocalClientCodexTomlError";
  }
}

/** Pure source codec only; this does not register a client or perform a file write. */
export function parseLocalClientCodexTomlObject(bytes: Buffer, maxBytes = MAX_BYTES): JsonObject {
  return parse(bytes, maxBytes).value;
}

/** Only one fixed MCP member operation is accepted; the caller owns semantic evaluation. */
export function editLocalClientCodexTomlObject(
  original: Buffer,
  operations: readonly LocalClientConfigOperation[],
  expected: JsonObject,
  maxBytes = MAX_BYTES,
): Buffer {
  assertJson(expected);
  const expectedCanonical = canonical(expected);
  assertJson(operations);
  if (!plainRecord(expected) || !Array.isArray(operations) || operations.length !== 1) throw invalid();
  const operation = operations[0]!;
  if (!plainRecord(operation) || !exactKeys(operation, Object.hasOwn(operation, "value") ? ["op", "path", "value"] : ["op", "path"])) throw invalid();
  assertJson(operation.path);
  if (!Array.isArray(operation.path) || operation.path.length !== 2
    || operation.path[0] !== CONTAINER || operation.path[1] !== MEMBER
    || (operation.op !== "set" && operation.op !== "delete")
    || (operation.op === "set") !== Object.hasOwn(operation, "value")) throw invalid();
  const definition = operation.op === "set" ? normalizeDefinition(operation.value, true) : null;
  const before = parse(original, maxBytes);
  const namespace = before.value[CONTAINER] as JsonObject | undefined;
  const current = namespace?.[MEMBER];
  const newline = before.text.includes("\r\n") ? "\r\n" : "\n";
  let edits: Edit[] = [];
  if (definition !== null && current !== undefined && canonical(current) === canonical(definition as JsonObject)) {
    // Semantic no-op keeps header spelling, token spelling and all trivia unchanged.
  } else if (definition !== null && before.member) {
    const body = before.member.body;
    if (body.length) {
      edits = body.flatMap((node) => removeSyntax(before, node.range[0], node.range[1]));
      if (!edits.length || edits[0]!.offset !== body[0]!.range[0]) throw invalid();
      edits[0] = { ...edits[0]!, content: renderDefinition(definition, newline) };
    } else {
      const lineEnd = before.text.indexOf("\n", before.member.range[1]);
      edits = lineEnd < 0
        ? [{ offset: before.text.length, length: 0, content: newline + renderDefinition(definition, newline) }]
        : [{ offset: lineEnd + 1, length: 0, content: renderDefinition(definition, newline) + newline }];
    }
  } else if (definition !== null) {
    const trailing = /(?:\r?\n)+$/u.exec(before.text)?.[0] ?? "";
    const offset = before.text.length - trailing.length;
    const prefix = offset === 0 ? "" : newline;
    edits = [{ offset, length: 0, content: prefix + `[${CONTAINER}."${MEMBER}"]` + newline + renderDefinition(definition, newline) }];
  } else {
    if (!before.member || current === undefined) throw invalid();
    edits = removeSyntax(before, before.member.range[0], before.member.range[1]);
    // Existing object-path deletion retains an empty parent. Preserve that
    // semantic when TOML originally created the parent only implicitly.
    if (!before.explicitParent && Object.keys(namespace!).length === 1) {
      if (!edits.length) throw invalid();
      edits[0] = { ...edits[0]!, content: `[${CONTAINER}]` };
    }
  }
  const afterBytes = Buffer.from(applyEdits(before.text, edits), "utf8");
  const after = parse(afterBytes, maxBytes);
  const comments = commentText(before);
  if (canonical(after.value) !== expectedCanonical || JSON.stringify(commentText(after)) !== JSON.stringify(comments)) throw invalid();
  return afterBytes;
}

function parse(bytes: Buffer, maxBytes: number): Parsed {
  if (!Buffer.isBuffer(bytes) || !Number.isSafeInteger(maxBytes) || maxBytes < 1 || maxBytes > MAX_BYTES
    || bytes.length > maxBytes) throw invalid();
  const snapshot = Buffer.from(bytes);
  let text: string;
  let ast: AST.TOMLProgram;
  try {
    // ignoreBOM preserves a leading U+FEFF so the fixed TOML 1.0 parser rejects
    // it instead of silently discarding an unsupported encoding marker.
    text = new TextDecoder("utf-8", { fatal: true, ignoreBOM: true }).decode(snapshot);
    ast = parseTOML(text, { tomlVersion: "1.0" });
  } catch { throw invalid(); }
  if (ast.tokens.length + ast.comments.length > MAX_NODES) throw invalid();
  let member: AST.TOMLTable | undefined;
  let explicitParent = false;
  const pending: { node: AST.TOMLNode; depth: number }[] = [{ node: ast, depth: 0 }];
  let count = 0;
  while (pending.length) {
    const { node, depth } = pending.pop()!;
    if (++count > MAX_NODES || depth > MAX_DEPTH) throw invalid();
    if (node.type === "Program" || node.type === "TOMLTopLevelTable") {
      pending.push(...node.body.map((child) => ({ node: child, depth })));
    } else if (node.type === "TOMLTable") {
      const path = decodedKeys(node.key);
      if (node.resolvedKey.length > MAX_DEPTH) throw invalid();
      if (path[0] === CONTAINER) {
        if (path.length === 1) {
          if (node.kind !== "standard") throw invalid();
          explicitParent = true;
        } else if (path[1] === LEGACY_MEMBER) throw invalid();
        else if (path[1] === MEMBER) {
          if (path.length !== 2 || node.kind !== "standard" || member) throw invalid();
          member = node;
        }
      }
      pending.push(...node.body.map((child) => ({ node: child, depth: node.resolvedKey.length })));
    } else if (node.type === "TOMLKeyValue") {
      const keys = decodedKeys(node.key);
      const parent = node.parent.type === "TOMLTable" ? decodedKeys(node.parent.key) : [];
      if (node.parent.type === "TOMLTopLevelTable" && keys[0] === CONTAINER) throw invalid();
      if (parent.length === 1 && parent[0] === CONTAINER && [MEMBER, LEGACY_MEMBER].includes(keys[0]!)) throw invalid();
      if (parent.length === 2 && parent[0] === CONTAINER && parent[1] === MEMBER
        && (keys.length !== 1 || !FIELDS.includes(keys[0] as typeof FIELDS[number]))) throw invalid();
      if (parent.length === 2 && parent[0] === CONTAINER && parent[1] === MEMBER) {
        const field = node.value;
        if (keys[0] === "args") {
          if (field.type !== "TOMLArray" || field.elements.length > 128
            || field.elements.some(item => item.type !== "TOMLValue" || item.kind !== "string")) throw invalid();
        } else if (field.type !== "TOMLValue" || field.kind !== "string" || !field.value.trim()) throw invalid();
      }
      pending.push({ node: node.value, depth: depth + keys.length });
    } else if (node.type === "TOMLInlineTable") {
      pending.push(...node.body.map((child) => ({ node: child, depth })));
    } else if (node.type === "TOMLArray") {
      pending.push(...node.elements.map((child) => ({ node: child, depth: depth + 1 })));
    } else if (node.type === "TOMLValue") {
      if (node.kind === "integer") {
        if (!Number.isSafeInteger(node.value) || BigInt(node.value) !== node.bigint) throw invalid();
      } else if (node.kind === "float") {
        if (!Number.isFinite(node.value) || (Number.isInteger(node.value) && !Number.isSafeInteger(node.value))) throw invalid();
      } else if (node.kind !== "string" && node.kind !== "boolean") throw invalid();
    } else throw invalid();
  }
  // All decoded keys, scalar kinds and depths have been checked BEFORE the
  // upstream converter creates ordinary JS objects or returns Date values.
  let value: unknown;
  try { value = getStaticTOMLValue(ast); } catch { throw invalid(); }
  assertJson(value);
  if (!plainRecord(value)) throw invalid();
  const namespace = value[CONTAINER];
  if (namespace !== undefined) {
    if (!plainRecord(namespace) || Object.hasOwn(namespace, LEGACY_MEMBER)) throw invalid();
    if (Object.hasOwn(namespace, MEMBER)) {
      if (!member) throw invalid();
      normalizeDefinition(namespace[MEMBER], false);
    }
  }
  return { text, ast, value: value as JsonObject, member, explicitParent };
}

function decodedKeys(key: AST.TOMLKey): string[] {
  if (!key.keys.length || key.keys.length > MAX_DEPTH) throw invalid();
  return key.keys.map((part) => {
    const value = part.type === "TOMLBare" ? part.name : part.value;
    if (!validKey(value)) throw invalid();
    return value;
  });
}

function validKey(key: unknown): key is string {
  return typeof key === "string" && key.length > 0 && key.length <= 128
    && !/[\u0000-\u001f\u007f]/u.test(key) && !FORBIDDEN.has(key);
}

function plainRecord(value: unknown): value is Record<string, unknown> {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return false;
  const proto = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
}

function exactKeys(value: Record<string, unknown>, allowed: readonly string[]): boolean {
  return Reflect.ownKeys(value).every((key) => {
    if (typeof key !== "string" || !allowed.includes(key)) return false;
    const descriptor = Object.getOwnPropertyDescriptor(value, key)!;
    return descriptor.enumerable === true && !descriptor.get && !descriptor.set;
  }) && allowed.every((key) => Object.hasOwn(value, key));
}

function normalizeDefinition(value: unknown, requireCommand: boolean): Definition {
  assertJson(value);
  if (!plainRecord(value) || Object.keys(value).some((key) => !FIELDS.includes(key as typeof FIELDS[number]))) throw invalid();
  if ((requireCommand || Object.hasOwn(value, "command")) && (typeof value.command !== "string" || !value.command.trim())) throw invalid();
  if (Object.hasOwn(value, "cwd") && (typeof value.cwd !== "string" || !value.cwd.trim())) throw invalid();
  if (Object.hasOwn(value, "args") && (!Array.isArray(value.args) || value.args.length > 128 || value.args.some((item) => typeof item !== "string"))) throw invalid();
  return value as Definition;
}

function assertJson(value: unknown): asserts value is LocalClientConfigJsonValue {
  const stack = [{ value, depth: 0 }]; const seen = new Set<object>(); let nodes = 0; let bytes = 0;
  while (stack.length) {
    const current = stack.pop()!; const item = current.value;
    if (++nodes > MAX_NODES || current.depth > MAX_DEPTH) throw invalid();
    if (item === null || typeof item === "boolean") continue;
    if (typeof item === "string") { bytes += Buffer.byteLength(item); if (bytes > MAX_BYTES) throw invalid(); continue; }
    if (typeof item === "number") {
      if (!Number.isFinite(item) || (Number.isInteger(item) && !Number.isSafeInteger(item))) throw invalid();
      continue;
    }
    if (typeof item !== "object" || (!Array.isArray(item) && !plainRecord(item)) || seen.has(item)) throw invalid();
    seen.add(item);
    if (Array.isArray(item) && item.length > MAX_NODES) throw invalid();
    const keys = Reflect.ownKeys(item);
    if (keys.length > MAX_NODES) throw invalid();
    if (Array.isArray(item) && (Object.getPrototypeOf(item) !== Array.prototype || keys.length !== item.length + 1)) throw invalid();
    for (const key of keys) {
      if (Array.isArray(item) && key === "length") continue;
      if (!validKey(key) || (Array.isArray(item) && (!/^(0|[1-9][0-9]*)$/u.test(key) || Number(key) >= item.length))) throw invalid();
      const descriptor = Object.getOwnPropertyDescriptor(item, key)!;
      if (!descriptor.enumerable || descriptor.get || descriptor.set) throw invalid();
      bytes += Buffer.byteLength(key); if (bytes > MAX_BYTES) throw invalid();
      stack.push({ value: descriptor.value, depth: current.depth + 1 });
    }
  }
}

function renderDefinition(value: Definition, newline: string): string {
  const quoted = (text: string) => JSON.stringify(text).replace(/[\u007f-\u009f]/gu,
    (character) => `\\u${character.charCodeAt(0).toString(16).padStart(4, "0")}`);
  return FIELDS.filter((key) => Object.hasOwn(value, key)).map((key) => {
    const field = value[key]!;
    return `${key} = ${Array.isArray(field) ? `[${field.map(quoted).join(", ")}]` : quoted(field)}`;
  }).join(newline);
}

function removeSyntax(parsed: Parsed, start: number, end: number): Edit[] {
  return parsed.ast.tokens.filter((token) => token.range[0] >= start && token.range[0] < end).map((token) => {
    if (token.range[1] > end) throw invalid();
    return { offset: token.range[0], length: token.range[1] - token.range[0], content: "" };
  });
}

function applyEdits(text: string, edits: readonly Edit[]): string {
  let offset = 0; let output = "";
  for (const edit of [...edits].sort((left, right) => left.offset - right.offset)) {
    if (edit.offset < offset || edit.length < 0 || edit.offset + edit.length > text.length) throw invalid();
    output += text.slice(offset, edit.offset) + edit.content; offset = edit.offset + edit.length;
  }
  return output + text.slice(offset);
}

function commentText(parsed: Parsed): string[] {
  return parsed.ast.comments.map((comment) => parsed.text.slice(comment.range[0], comment.range[1]));
}

function canonical(value: LocalClientConfigJsonValue): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonical(value[key]!)}`).join(",")}}`;
}

function invalid(): LocalClientCodexTomlError { return new LocalClientCodexTomlError(); }
