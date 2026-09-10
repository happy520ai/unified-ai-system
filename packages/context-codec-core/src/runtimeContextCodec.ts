import { createHash } from "node:crypto";
import { isDeepStrictEqual } from "node:util";
import { createScanner, parseTree, ScanError, SyntaxKind } from "jsonc-parser";
import type { Node as JsonNode, ParseError } from "jsonc-parser";
import { CST, Lexer, Parser, isMap, isScalar, isSeq, parseDocument, stringify } from "yaml";

export type ContextCodecProfile = "yaml_state" | "jsonl_facts" | "compact_trace";
export type ContextJsonData = null | boolean | number | string | ContextJsonData[] | { [key: string]: ContextJsonData };
type JsonObject = { [key: string]: ContextJsonData };
type Limits = { bytes: number; depth: number; nodes: number };
const INPUT_LIMITS: Limits = { bytes: 256 * 1024, depth: 32, nodes: 20_000 };
const ENCODED_LIMITS: Limits = { bytes: 2 * 1024 * 1024, depth: 35, nodes: 60_010 };
const PREFIX = "# context-codec/v1 ";
const JSONL_OBJECT = JSON.stringify({ codec: "context-codec/v1", profile: "jsonl_facts", root: "object", lines: "[key,value]" });
const JSONL_ARRAY = JSON.stringify({ codec: "context-codec/v1", profile: "jsonl_facts", root: "array", lines: "ordered values" });
const TABLE_HEADER = { codec: "context-codec/v1", profile: "compact_trace", root: "object-array" };

export class ContextCodecError extends Error {
  readonly code: string;
  constructor(reason: string) {
    super("Context data cannot be encoded or decoded without loss.");
    this.name = "ContextCodecError";
    this.code = `CONTEXT_CODEC_${reason}`;
  }
}
function fail(reason: string): never { throw new ContextCodecError(reason); }
const isObject = (value: unknown): value is JsonObject => value !== null && typeof value === "object" && !Array.isArray(value);
const rootType = (value: ContextJsonData): string => value === null ? "null" : Array.isArray(value) ? "array" : typeof value;

function boundedText(text: string, maxBytes: number): void {
  if (typeof text !== "string") fail("INVALID_INPUT");
  if (Buffer.byteLength(text, "utf8") > maxBytes) fail("SIZE_LIMIT");
}

function canonicalNumber(literal: string): void {
  const number = Number(literal);
  if (!Number.isFinite(number) || (Number.isInteger(number) && !Number.isSafeInteger(number))) fail("UNSAFE_NUMBER");
  // Reject rounding, underflow, -0, and alternate spelling rather than infer intent.
  if (JSON.stringify(number) !== literal) fail("NON_CANONICAL_NUMBER");
}

function parseJson(text: string, limits: Limits): ContextJsonData {
  boundedText(text, limits.bytes);
  const scanner = createScanner(text, false);
  let nesting = 0;
  for (;;) {
    const kind = scanner.scan();
    if (scanner.getTokenError() !== ScanError.None || kind === SyntaxKind.Unknown
      || kind === SyntaxKind.LineCommentTrivia || kind === SyntaxKind.BlockCommentTrivia) fail("INVALID_JSON");
    if (kind === SyntaxKind.EOF) break;
    if (kind === SyntaxKind.OpenBraceToken || kind === SyntaxKind.OpenBracketToken) nesting += 1;
    if (kind === SyntaxKind.CloseBraceToken || kind === SyntaxKind.CloseBracketToken) nesting -= 1;
    if (nesting > limits.depth + 1) fail("DEPTH_LIMIT");
    if (nesting < 0) fail("INVALID_JSON");
    if (kind === SyntaxKind.NumericLiteral) canonicalNumber(text.slice(scanner.getTokenOffset(), scanner.getTokenOffset() + scanner.getTokenLength()));
  }
  if (nesting !== 0) fail("INVALID_JSON");
  const errors: ParseError[] = [];
  const tree = parseTree(text, errors, { allowTrailingComma: false, disallowComments: true, allowEmptyContent: false });
  if (!tree || errors.length) fail("INVALID_JSON");
  const pending: { node: JsonNode; depth: number }[] = [{ node: tree, depth: 0 }];
  let nodes = 0;
  while (pending.length) {
    const { node, depth } = pending.pop()!;
    if (++nodes > limits.nodes) fail("NODE_LIMIT");
    if (depth > limits.depth) fail("DEPTH_LIMIT");
    if (node.type === "object") {
      const keys = new Set<string>();
      for (const property of node.children ?? []) {
        const [key, value] = property.children ?? [];
        if (!key || !value || key.type !== "string") fail("INVALID_JSON");
        if (keys.has(key.value)) fail("DUPLICATE_KEY");
        keys.add(key.value);
        if (++nodes > limits.nodes) fail("NODE_LIMIT");
        pending.push({ node: value, depth: depth + 1 });
      }
    } else if (node.type === "array") {
      for (const child of node.children ?? []) pending.push({ node: child, depth: depth + 1 });
    }
  }
  try { return JSON.parse(text) as ContextJsonData; } catch { return fail("INVALID_JSON"); }
}

/** Strict JSON only. Depth is counted from the root at zero; keys count toward nodes. */
export function parseContextJson(source: string): ContextJsonData {
  return parseJson(source, INPUT_LIMITS);
}

function inspectData(data: ContextJsonData): number {
  const pending = [{ value: data, depth: 0 }];
  let nodes = 0;
  let facts = 0;
  while (pending.length) {
    const { value, depth } = pending.pop()!;
    if (++nodes > INPUT_LIMITS.nodes) fail("NODE_LIMIT");
    if (depth > INPUT_LIMITS.depth) fail("DEPTH_LIMIT");
    if (value === null || typeof value === "string" || typeof value === "boolean") facts += 1;
    else if (typeof value === "number") {
      if (!Number.isFinite(value) || (Number.isInteger(value) && !Number.isSafeInteger(value)) || Object.is(value, -0)) fail("UNSAFE_NUMBER");
      facts += 1;
    } else if (Array.isArray(value)) {
      if (!value.length) facts += 1;
      for (const child of value) pending.push({ value: child, depth: depth + 1 });
    } else if (isObject(value) && Object.getPrototypeOf(value) === Object.prototype) {
      const keys = Object.keys(value);
      nodes += keys.length;
      if (nodes > INPUT_LIMITS.nodes) fail("NODE_LIMIT");
      if (!keys.length) facts += 1;
      for (const key of keys) pending.push({ value: value[key]!, depth: depth + 1 });
    } else fail("INVALID_DATA_TYPE");
  }
  boundedText(JSON.stringify(data), INPUT_LIMITS.bytes);
  return facts;
}

function requireProfile(profile: ContextCodecProfile): void {
  if (!["yaml_state", "jsonl_facts", "compact_trace"].includes(profile)) fail("UNSUPPORTED_PROFILE");
}

function encodeText(data: ContextJsonData, profile: ContextCodecProfile): string {
  if (profile === "yaml_state") {
    const body = stringify(data, { version: "1.2", schema: "core", aliasDuplicateObjects: false,
      lineWidth: 0, blockQuote: false, doubleQuotedAsJSON: true });
    return `${PREFIX}yaml_state ${rootType(data)}: YAML 1.2 data\n${body}`;
  }
  if (profile === "jsonl_facts") {
    if (Array.isArray(data)) return [JSONL_ARRAY, ...data.map(value => JSON.stringify(value))].join("\n");
    if (isObject(data)) return [JSONL_OBJECT, ...Object.entries(data).map(entry => JSON.stringify(entry))].join("\n");
    return fail("UNSUPPORTED_SHAPE");
  }
  if (!Array.isArray(data) || !data.length || !data.every(isObject)) return fail("UNSUPPORTED_SHAPE");
  const columns = Object.keys(data[0]!);
  if (!data.every(row => Object.keys(row).length === columns.length && columns.every(key => Object.hasOwn(row, key)))) fail("UNSUPPORTED_SHAPE");
  const rows = data.map(row => columns.map(key => row[key]!));
  return JSON.stringify({ ...TABLE_HEADER, columns, rows });
}

function decodeYaml(body: string): ContextJsonData {
  // Bound the library's parser stack before recursive document composition.
  const parser = new Parser();
  let documents = 0;
  const countDocument = (token: CST.Token): void => {
    if (token.type === "document" && ++documents > 1) fail("INVALID_FORMAT");
  };
  for (const lexeme of new Lexer().lex(body)) {
    if (["tag", "anchor", "alias", "directive-line"].includes(CST.tokenType(lexeme) ?? "")) fail("INVALID_FORMAT");
    for (const token of parser.next(lexeme)) countDocument(token);
    if (parser.stack.length > INPUT_LIMITS.depth + 3) fail("DEPTH_LIMIT");
  }
  for (const token of parser.end()) countDocument(token);
  if (documents !== 1) fail("INVALID_FORMAT");
  const doc = parseDocument(body, { version: "1.2", schema: "core", strict: true, uniqueKeys: true,
    merge: false, resolveKnownTags: false, customTags: [], prettyErrors: false, logLevel: "silent" });
  if (doc.errors.length || doc.warnings.length || doc.directives?.yaml.version !== "1.2") fail("INVALID_FORMAT");
  const pending: { node: unknown; depth: number }[] = [{ node: doc.contents, depth: 0 }];
  let nodes = 0;
  while (pending.length) {
    const { node, depth } = pending.pop()!;
    if (++nodes > INPUT_LIMITS.nodes) fail("NODE_LIMIT");
    if (depth > INPUT_LIMITS.depth) fail("DEPTH_LIMIT");
    if (!isMap(node) && !isSeq(node) && !isScalar(node)) fail("INVALID_FORMAT");
    if (node.anchor || node.tag) fail("INVALID_FORMAT");
    if (isMap(node)) {
      const keys = new Set<string>();
      for (const pair of node.items) {
        if (!isScalar(pair.key) || typeof pair.key.value !== "string" || pair.key.anchor || pair.key.tag) fail("INVALID_FORMAT");
        if (keys.has(pair.key.value)) fail("DUPLICATE_KEY");
        keys.add(pair.key.value);
        if (++nodes > INPUT_LIMITS.nodes) fail("NODE_LIMIT");
        pending.push({ node: pair.value, depth: depth + 1 });
      }
    } else if (isSeq(node)) {
      for (const child of node.items) pending.push({ node: child, depth: depth + 1 });
    } else if (typeof node.value === "number") {
      if (typeof node.source !== "string") fail("INVALID_FORMAT");
      canonicalNumber(node.source);
    } else if (node.value !== null && typeof node.value !== "string" && typeof node.value !== "boolean") fail("INVALID_DATA_TYPE");
  }
  return doc.toJS({ mapAsMap: false, maxAliasCount: 0 }) as ContextJsonData;
}

function decodeJsonl(header: string, body: string): ContextJsonData {
  if (header !== JSONL_OBJECT && header !== JSONL_ARRAY) fail("INVALID_FORMAT");
  const lines = body === "" ? [] : body.split("\n");
  if (lines.length > INPUT_LIMITS.nodes) fail("NODE_LIMIT");
  const values = lines.map(line => parseJson(line, ENCODED_LIMITS));
  if (header === JSONL_ARRAY) return values;
  const output: JsonObject = {};
  for (const entry of values) {
    if (!Array.isArray(entry) || entry.length !== 2 || typeof entry[0] !== "string") fail("INVALID_FORMAT");
    if (Object.hasOwn(output, entry[0])) fail("DUPLICATE_KEY");
    Object.defineProperty(output, entry[0], { value: entry[1], writable: true, enumerable: true, configurable: true });
  }
  return output;
}

function decodeTable(body: string): ContextJsonData {
  const table = parseJson(body, ENCODED_LIMITS);
  if (!isObject(table) || Object.keys(table).length !== 5 || table.codec !== TABLE_HEADER.codec
    || table.profile !== TABLE_HEADER.profile || table.root !== TABLE_HEADER.root
    || !Object.hasOwn(table, "columns") || !Object.hasOwn(table, "rows")
    || !Array.isArray(table.columns) || !Array.isArray(table.rows) || !table.rows.length) fail("INVALID_FORMAT");
  const { columns, rows } = table;
  if (!columns.every(key => typeof key === "string") || new Set(columns).size !== columns.length) fail("INVALID_FORMAT");
  return rows.map(row => {
    if (!Array.isArray(row) || row.length !== columns.length) fail("INVALID_FORMAT");
    const object: JsonObject = {};
    columns.forEach((key, index) => Object.defineProperty(object, key as string, {
      value: row[index], writable: true, enumerable: true, configurable: true,
    }));
    return object;
  });
}

/** Decode actual format semantics, including shape and field membership checks. */
export function decodeContextData(text: string, profile: ContextCodecProfile): ContextJsonData {
  requireProfile(profile);
  boundedText(text, ENCODED_LIMITS.bytes);
  const newline = text.indexOf("\n");
  const header = newline < 0 ? text : text.slice(0, newline);
  const body = newline < 0 ? "" : text.slice(newline + 1);
  try {
    let data: ContextJsonData;
    if (profile === "yaml_state") {
      if (!/^# context-codec\/v1 yaml_state (object|array|string|number|boolean|null): YAML 1\.2 data$/u.test(header) || !body) fail("INVALID_FORMAT");
      data = decodeYaml(body);
      if (header !== `${PREFIX}yaml_state ${rootType(data)}: YAML 1.2 data`) fail("INVALID_FORMAT");
    } else if (profile === "jsonl_facts") data = decodeJsonl(header, body);
    else data = decodeTable(text);
    inspectData(data);
    return data;
  } catch (error) {
    if (error instanceof ContextCodecError) throw error;
    return fail("INVALID_FORMAT");
  }
}

export function encodeContextData(source: string, profile: ContextCodecProfile): {
  text: string; profile: ContextCodecProfile; sourceDataHash: string; factCount: number;
  byteLengthBefore: number; byteLengthAfter: number;
} {
  requireProfile(profile);
  const data = parseContextJson(source);
  const factCount = inspectData(data);
  let text: string;
  try { text = encodeText(data, profile); } catch (error) {
    if (error instanceof ContextCodecError) throw error;
    return fail("ENCODING_FAILED");
  }
  const decoded = decodeContextData(text, profile);
  if (!isDeepStrictEqual(data, decoded)) fail("ROUND_TRIP_MISMATCH");
  return { text, profile, sourceDataHash: createHash("sha256").update(JSON.stringify(data)).digest("hex"), factCount,
    byteLengthBefore: Buffer.byteLength(source, "utf8"), byteLengthAfter: Buffer.byteLength(text, "utf8") };
}
