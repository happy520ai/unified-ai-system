import { createScanner, parseTree, ScanError, SyntaxKind } from "jsonc-parser";
import type { Node, ParseError } from "jsonc-parser";
import type { LocalClientConfigJsonValue, LocalClientConfigOperation } from "./localClientConfigTransaction.js";

export const LOCAL_CLIENT_JSONC_CODEC_VERSION = "local-client-jsonc-lossless-v1" as const;
const MAX_DEPTH = 64;
const MAX_NODES = 100_000;
const MAX_TOKENS = 600_000;
const MAX_BYTES = 16 * 1_048_576;
const FORBIDDEN_KEYS = new Set(["__proto__", "prototype", "constructor"]);
type JsonObject = Record<string, LocalClientConfigJsonValue>;
type Token = Readonly<{ kind: SyntaxKind; offset: number; length: number }>;
type Parsed = Readonly<{ text: string; bom: boolean; tree: Node; value: JsonObject; tokens: readonly Token[] }>;
type Edit = Readonly<{ offset: number; length: number; content: string }>;

/** No source text is included in parse/edit errors or public transaction DTOs. */
export class LocalClientConfigJsoncError extends Error {
  constructor() {
    super("The JSONC configuration cannot be safely parsed or edited.");
    this.name = "LocalClientConfigJsoncError";
  }
}

export function parseLocalClientJsoncObject(bytes: Buffer, maxBytes: number): JsonObject {
  return parseBytes(bytes, maxBytes).value;
}

/** The transaction's existing evaluator supplies the independent semantic postcondition. */
export function editLocalClientJsoncObject(
  original: Buffer,
  operations: readonly LocalClientConfigOperation[],
  expected: JsonObject,
  maxBytes: number,
): Buffer {
  let parsed = parseBytes(original, maxBytes);
  const comments = commentLexemes(parsed);
  if (operations.length < 1 || operations.length > 128) throw invalid();
  for (const operation of operations) {
    if (!Array.isArray(operation.path) || operation.path.length < 1 || operation.path.length > 32
      || operation.path.some((key) => !validKey(key))) throw invalid();
    let parent = parsed.tree;
    let missingIndex = -1;
    for (let index = 0; index < operation.path.length - 1; index += 1) {
      const property = findProperty(parent, operation.path[index]!);
      if (!property) {
        missingIndex = index;
        break;
      }
      const value = property.children?.[1];
      if (!value || value.type !== "object") throw invalid();
      parent = value;
    }
    let edits: Edit[];
    if (missingIndex >= 0) {
      if (operation.op !== "set") throw invalid();
      let value = operation.value;
      for (let index = operation.path.length - 1; index > missingIndex; index -= 1) {
        value = { [operation.path[index]!]: value };
      }
      edits = insertProperty(parsed, parent, operation.path[missingIndex]!, value);
    } else {
      const key = operation.path.at(-1)!;
      const property = findProperty(parent, key);
      if (operation.op === "set") {
        if (!property) edits = insertProperty(parsed, parent, key, operation.value);
        else {
          const value = property.children?.[1];
          if (!value) throw invalid();
          if (canonical(nodeValue(value, 0, { nodes: 0 })) === canonical(operation.value)) continue;
          edits = removeSyntax(parsed, value.offset, value.offset + value.length);
          if (edits.length < 1 || edits[0]!.offset !== value.offset) throw invalid();
          edits[0] = { ...edits[0]!, content: serializeValue(operation.value) };
        }
      } else if (operation.op === "delete") {
        if (!property) throw invalid();
        edits = deleteProperty(parsed, parent, property);
      } else throw invalid();
    }
    const text = applyEdits(parsed.text, edits);
    parsed = parseBytes(encode(text, parsed.bom), maxBytes);
    const remainingComments = commentLexemes(parsed);
    if (remainingComments.length !== comments.length
      || remainingComments.some((comment, index) => comment !== comments[index])) throw invalid();
  }
  if (canonical(parsed.value) !== canonical(expected)) throw invalid();
  return encode(parsed.text, parsed.bom);
}

function parseBytes(bytes: Buffer, maxBytes: number): Parsed {
  if (!Buffer.isBuffer(bytes) || !Number.isSafeInteger(maxBytes) || maxBytes < 2 || maxBytes > MAX_BYTES
    || bytes.byteLength < 2 || bytes.byteLength > maxBytes) throw invalid();
  const bom = bytes.length >= 3 && bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf;
  let text: string;
  try {
    text = new TextDecoder("utf-8", { fatal: true, ignoreBOM: true }).decode(bom ? bytes.subarray(3) : bytes);
  } catch { throw invalid(); }
  const tokens = scan(text);
  const errors: ParseError[] = [];
  const tree = parseTree(text, errors, { allowTrailingComma: true, disallowComments: false, allowEmptyContent: false });
  if (!tree || tree.type !== "object" || errors.length !== 0) throw invalid();
  const value = nodeValue(tree, 0, { nodes: 0 });
  if (!value || typeof value !== "object" || Array.isArray(value)) throw invalid();
  return { text, bom, tokens, tree, value: value as JsonObject };
}

function scan(text: string): Token[] {
  const scanner = createScanner(text, false);
  const tokens: Token[] = [];
  let depth = 0;
  for (;;) {
    const kind = scanner.scan();
    if (scanner.getTokenError() !== ScanError.None || kind === SyntaxKind.Unknown) throw invalid();
    if (kind === SyntaxKind.EOF) break;
    if (kind === SyntaxKind.OpenBraceToken || kind === SyntaxKind.OpenBracketToken) depth += 1;
    if (kind === SyntaxKind.CloseBraceToken || kind === SyntaxKind.CloseBracketToken) depth -= 1;
    if (depth < 0 || depth > MAX_DEPTH + 1 || tokens.length >= MAX_TOKENS) throw invalid();
    tokens.push({ kind, offset: scanner.getTokenOffset(), length: scanner.getTokenLength() });
  }
  if (depth !== 0) throw invalid();
  return tokens;
}

function nodeValue(node: Node, depth: number, budget: { nodes: number }): LocalClientConfigJsonValue {
  budget.nodes += 1;
  if (depth > MAX_DEPTH || budget.nodes > MAX_NODES) throw invalid();
  if (node.type === "object") {
    const output: JsonObject = Object.create(null);
    for (const property of node.children ?? []) {
      const key = property.children?.[0]?.value;
      const value = property.children?.[1];
      if (property.type !== "property" || !validKey(key) || !value || Object.hasOwn(output, key)) throw invalid();
      output[key] = nodeValue(value, depth + 1, budget);
    }
    return output;
  }
  if (node.type === "array") return (node.children ?? []).map((child) => nodeValue(child, depth + 1, budget));
  if (node.type === "null") return null;
  if (node.type === "boolean" && typeof node.value === "boolean") return node.value;
  if (node.type === "string" && typeof node.value === "string") return node.value;
  if (node.type === "number" && typeof node.value === "number" && Number.isFinite(node.value)) return node.value;
  throw invalid();
}

function validKey(key: unknown): key is string {
  return typeof key === "string" && key.length > 0 && key.length <= 128
    && !/[\u0000-\u001f\u007f]/u.test(key) && !FORBIDDEN_KEYS.has(key);
}

function findProperty(parent: Node, key: string): Node | undefined {
  if (parent.type !== "object") throw invalid();
  return parent.children?.find((property) => property.children?.[0]?.value === key);
}

function insertProperty(parsed: Parsed, parent: Node, key: string, value: LocalClientConfigJsonValue): Edit[] {
  const last = parent.children?.at(-1);
  const closeOffset = parent.offset + parent.length - 1;
  if (parsed.text[closeOffset] !== "}") throw invalid();
  const edits: Edit[] = [];
  if (last) {
    const trailing = syntaxBetween(parsed, last.offset + last.length, closeOffset);
    if (trailing.length > 1 || (trailing.length === 1 && trailing[0]!.kind !== SyntaxKind.CommaToken)) throw invalid();
    if (trailing.length === 0) edits.push({ offset: last.offset + last.length, length: 0, content: "," });
  }
  edits.push({ offset: closeOffset, length: 0, content: `${JSON.stringify(key)}:${serializeValue(value)}` });
  return edits;
}

function deleteProperty(parsed: Parsed, parent: Node, property: Node): Edit[] {
  const properties = parent.children ?? [];
  const index = properties.indexOf(property);
  if (index < 0) throw invalid();
  const edits = removeSyntax(parsed, property.offset, property.offset + property.length);
  const next = properties[index + 1];
  const after = syntaxBetween(parsed, property.offset + property.length, next?.offset ?? parent.offset + parent.length - 1);
  if (after.length > 1 || (after.length === 1 && after[0]!.kind !== SyntaxKind.CommaToken)) throw invalid();
  if (after[0]) edits.push({ offset: after[0].offset, length: after[0].length, content: "" });
  else if (index > 0) {
    const previous = properties[index - 1]!;
    const before = syntaxBetween(parsed, previous.offset + previous.length, property.offset);
    if (before.length !== 1 || before[0]!.kind !== SyntaxKind.CommaToken) throw invalid();
    edits.push({ offset: before[0]!.offset, length: before[0]!.length, content: "" });
  }
  return edits;
}

function syntaxBetween(parsed: Parsed, start: number, end: number): readonly Token[] {
  return parsed.tokens.filter((token) => token.offset >= start && token.offset < end && !isTrivia(token.kind));
}

/** Only scanner-proven syntax inside the owned AST range may be removed. */
function removeSyntax(parsed: Parsed, start: number, end: number): Edit[] {
  return syntaxBetween(parsed, start, end).map((token) => {
    if (token.offset + token.length > end) throw invalid();
    return { offset: token.offset, length: token.length, content: "" };
  });
}

/** Slices copy every unedited UTF-16 code unit, including all trivia and unrelated values. */
function applyEdits(text: string, edits: readonly Edit[]): string {
  let offset = 0;
  let output = "";
  for (const edit of [...edits].sort((left, right) => left.offset - right.offset)) {
    if (edit.offset < offset || edit.offset < 0 || edit.length < 0 || edit.offset + edit.length > text.length) throw invalid();
    output += text.slice(offset, edit.offset) + edit.content;
    offset = edit.offset + edit.length;
  }
  return output + text.slice(offset);
}

function isTrivia(kind: SyntaxKind): boolean {
  return kind === SyntaxKind.Trivia || kind === SyntaxKind.LineBreakTrivia
    || kind === SyntaxKind.LineCommentTrivia || kind === SyntaxKind.BlockCommentTrivia;
}

function commentLexemes(parsed: Parsed): readonly string[] {
  return parsed.tokens.filter((token) => token.kind === SyntaxKind.LineCommentTrivia || token.kind === SyntaxKind.BlockCommentTrivia)
    .map((token) => parsed.text.slice(token.offset, token.offset + token.length));
}

function encode(text: string, bom: boolean): Buffer {
  return Buffer.from(`${bom ? "\ufeff" : ""}${text}`, "utf8");
}

function serializeValue(value: LocalClientConfigJsonValue): string {
  const serialized = JSON.stringify(value);
  if (typeof serialized !== "string") throw invalid();
  return serialized;
}

function canonical(value: LocalClientConfigJsonValue): string {
  if (value === null || typeof value !== "object") return serializeValue(value);
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonical(value[key]!)}`).join(",")}}`;
}

function invalid(): LocalClientConfigJsoncError { return new LocalClientConfigJsoncError(); }
