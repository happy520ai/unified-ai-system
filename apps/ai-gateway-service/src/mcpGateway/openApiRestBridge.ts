// REST → MCP bridge: generates governed MCP tools from an OpenAPI 3 spec and
// executes its supported input subset as REST calls through the outbound policy.

import { fetchWithAgent } from "../http/connectionPool.js";
import { resolveSafeOutboundUrl } from "../security/outboundUrlPolicy.ts";
import type { McpCallResult, McpToolDescriptor } from "./mcpUpstreamClient.ts";
import { throwIfExecutionAborted } from "@unified-ai-system/shared-utils";

const MAX_SPEC_CHARS = 2_000_000;
const MAX_RESPONSE_CHARS = 1_000_000;
const HTTP_METHODS = new Set(["get", "put", "post", "patch", "delete"]);
const MAX_EXPANSION_NODES = 100_000;
const MAX_EXPANSION_DEPTH = 32;
const TOKEN = /^[!#$%&'*+.^_\x60|~0-9A-Za-z-]+$/u;
const RESERVED_HEADERS = new Set(["accept", "content-type", "authorization"]);
const TRANSPORT_HEADERS = new Set(["host", "content-length", "transfer-encoding", "connection", "proxy-authorization", "proxy-connection", "trailer", "te", "upgrade", "cookie"]);
const SCHEMA_MAPS = new Set(["properties", "patternProperties", "$defs", "definitions", "dependentSchemas"]);
const SCHEMA_ARRAYS = new Set(["allOf", "anyOf", "oneOf", "prefixItems"]);
const SCHEMA_SINGLE = new Set(["items", "additionalProperties", "additionalItems", "not", "contains", "propertyNames", "if", "then", "else", "unevaluatedProperties", "unevaluatedItems"]);

type Location = "path" | "query" | "header" | "cookie";
type Schema = Record<string, unknown> | boolean;
type Parameter = { name: string; in: Location; required: boolean; schema: Schema; style: "simple" | "form"; explode: boolean };
export interface OpenApiOperation {
  method: string;
  path: string;
  operationId: string;
  summary?: string;
  parameters: Parameter[];
  bodySchema?: Schema;
  bodyRequired?: boolean;
}
type RestTool = McpToolDescriptor & { __rest: OpenApiOperation };

function unsupported(): Error & { code: string } {
  return Object.assign(new Error("OpenAPI operation has unsupported, ambiguous, or unresolvable input semantics."), { code: "OPENAPI_INPUT_UNSUPPORTED" });
}
function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value) || ![Object.prototype, null].includes(Object.getPrototypeOf(value))) throw unsupported();
  const descriptors = Object.getOwnPropertyDescriptors(value);
  if (Reflect.ownKeys(value).length !== Object.keys(descriptors).length || Object.values(descriptors).some(item => !item.enumerable || !("value" in item))) throw unsupported();
  return Object.fromEntries(Object.entries(descriptors).map(([key, item]) => [key, item.value]));
}
function list(value: unknown): unknown[] {
  if (!Array.isArray(value) || Object.getPrototypeOf(value) !== Array.prototype || Reflect.ownKeys(value).length !== value.length + 1 || value.length > MAX_EXPANSION_NODES) throw unsupported();
  return Array.from({ length: value.length }, (_, index) => {
    const property = Object.getOwnPropertyDescriptor(value, String(index));
    if (!property || !("value" in property)) throw unsupported();
    return property.value;
  });
}
function inputName(value: unknown): string {
  if (typeof value !== "string" || !value || value.length > 256 || /[\u0000-\u001f\u007f{}]/u.test(value)) throw unsupported();
  return value;
}
function argumentName(parameter: Parameter): string { return parameter.in === "path" ? parameter.name : parameter.in + "_" + parameter.name; }

function requireFlatSchema(schema: Schema, cookie: boolean, nested = false): void {
  if (typeof schema === "boolean") return;
  const types = Array.isArray(schema.type) ? schema.type : [schema.type];
  if (types.includes("array") || types.includes("object") || schema.properties !== undefined || schema.items !== undefined) {
    if (cookie || nested) throw unsupported();
    if (schema.items !== undefined) requireFlatSchema(schema.items as Schema, false, true);
    if (schema.properties !== undefined) for (const child of Object.values(record(schema.properties))) requireFlatSchema(child as Schema, false, true);
    if (typeof schema.additionalProperties === "object") requireFlatSchema(schema.additionalProperties as Schema, false, true);
  }
  for (const key of ["allOf", "anyOf", "oneOf"]) if (schema[key] !== undefined) {
    for (const child of list(schema[key])) requireFlatSchema(child as Schema, cookie, nested);
  }
}

/** Resolve consumed input containers and schemas, never examples or response schemas. */
function createInputResolver(root: Record<string, unknown>) {
  let nodes = 0, characters = 0;
  const charge = (depth: number, size = 0) => { characters += size; if (++nodes > MAX_EXPANSION_NODES || depth > MAX_EXPANSION_DEPTH || characters > MAX_SPEC_CHARS) throw unsupported(); };
  const string = (value: string, depth = 0) => { charge(depth, value.length); return value; };
  const dereference = (value: unknown, references: readonly string[] = []): { value: Record<string, unknown>; references: readonly string[] } => {
    charge(references.length);
    const source = record(value);
    if (!Object.hasOwn(source, "$ref")) return { value: source, references };
    if (typeof source.$ref !== "string" || !source.$ref.startsWith("#/")) throw unsupported();
    let pointer: string;
    try { pointer = decodeURIComponent(source.$ref.slice(1)); } catch { throw unsupported(); }
    if (references.includes(pointer) || Object.keys(source).some(key => !["$ref", "summary", "description"].includes(key) && !key.startsWith("x-"))) throw unsupported();
    let target: unknown = root;
    for (const encoded of pointer.slice(1).split("/")) {
      if (/~(?![01])/u.test(encoded)) throw unsupported();
      const key = encoded.replace(/~1/g, "/").replace(/~0/g, "~");
      const owner = Array.isArray(target) ? Object.fromEntries(list(target).map((item, index) => [String(index), item])) : record(target);
      if (!Object.hasOwn(owner, key)) throw unsupported();
      target = owner[key];
    }
    return dereference(target, [...references, pointer]);
  };
  const copy = (value: unknown, depth: number): unknown => {
    charge(depth, typeof value === "string" ? value.length : 0);
    if (value === null || typeof value === "string" || typeof value === "boolean" || typeof value === "number" && Number.isFinite(value)) return value;
    if (Array.isArray(value)) return Object.freeze(list(value).map(item => copy(item, depth + 1)));
    return Object.freeze(Object.fromEntries(Object.entries(record(value)).map(([key, item]) => [string(key, depth + 1), copy(item, depth + 1)])));
  };
  const schema = (value: unknown, depth = 0, references: readonly string[] = []): Schema => {
    charge(depth);
    if (typeof value === "boolean") return value;
    const resolved = dereference(value, references), source = resolved.value;
    if (["$id", "$anchor", "$dynamicRef", "$dynamicAnchor", "$schema"].some(key => Object.hasOwn(source, key))) throw unsupported();
    const entries = Object.entries(source).map(([key, item]) => {
      string(key, depth + 1);
      if (SCHEMA_MAPS.has(key)) return [key, Object.freeze(Object.fromEntries(Object.entries(record(item)).map(([name, child]) => [string(name, depth + 1), schema(child, depth + 1, resolved.references)])))];
      if (SCHEMA_ARRAYS.has(key)) return [key, Object.freeze(list(item).map(child => schema(child, depth + 1, resolved.references)))];
      return [key, SCHEMA_SINGLE.has(key) ? schema(item, depth + 1, resolved.references) : copy(item, depth + 1)];
    });
    return Object.freeze(Object.fromEntries(entries));
  };
  return { dereference: (value: unknown) => dereference(value).value, schema, string };
}

export function parseOpenApiOperations(spec: unknown): OpenApiOperation[] {
  const root = record(spec);
  if (typeof root.openapi !== "string" || !/^3\.(?:0|1)\.\d+$/u.test(root.openapi)) throw unsupported();
  const resolver = createInputResolver(root), paths = record(root.paths), operations: OpenApiOperation[] = [], names = new Set<string>();
  const parameters = (value: unknown): Parameter[] => {
    const seen = new Set<string>();
    return list(value ?? []).flatMap(raw => {
      const p = resolver.dereference(raw), name = resolver.string(inputName(p.name)), location = p.in;
      if (!["path", "query", "header", "cookie"].includes(String(location)) || p.required !== undefined && typeof p.required !== "boolean") throw unsupported();
      const where = location as Location;
      if (where === "header" && RESERVED_HEADERS.has(name.toLowerCase())) return [];
      if ((where === "header" || where === "cookie") && !TOKEN.test(name) || where === "header" && TRANSPORT_HEADERS.has(name.toLowerCase())) throw unsupported();
      const key = where + ":" + (where === "header" ? name.toLowerCase() : name);
      if (seen.has(key)) throw unsupported(); seen.add(key);
      const style = where === "path" || where === "header" ? "simple" : "form";
      if (p.content !== undefined || p.style !== undefined && p.style !== style || p.allowReserved === true
        || p.allowEmptyValue === true || p.explode !== undefined && typeof p.explode !== "boolean" || where === "path" && p.required !== true) throw unsupported();
      const resolvedSchema = resolver.schema(p.schema ?? { type: "string" });
      requireFlatSchema(resolvedSchema, where === "cookie");
      return [{ name, in: where, required: p.required === true, schema: resolvedSchema, style, explode: p.explode === undefined ? style === "form" : p.explode }];
    });
  };
  for (const [path, rawItem] of Object.entries(paths)) {
    if (!path.startsWith("/") || /[?#]/u.test(path)) throw unsupported();
    const item = resolver.dereference(rawItem), inherited = parameters(item.parameters);
    for (const [method, rawOperation] of Object.entries(item)) {
      if (!HTTP_METHODS.has(method.toLowerCase())) continue;
      resolver.string(path);
      const operation = record(rawOperation), merged = new Map(inherited.map(p => [p.in + ":" + (p.in === "header" ? p.name.toLowerCase() : p.name), p]));
      for (const p of parameters(operation.parameters)) merged.set(p.in + ":" + (p.in === "header" ? p.name.toLowerCase() : p.name), p);
      const bindings = [...merged.values()];
      const variables = [...path.matchAll(/\{([^}]+)\}/gu)].map(match => match[1]);
      if (path.replace(/\{[^}]+\}/gu, "").match(/[{}]/u) || variables.some(name => !bindings.some(p => p.in === "path" && p.name === name))
        || bindings.some(p => p.in === "path" && !variables.includes(p.name))) throw unsupported();
      const operationId = typeof operation.operationId === "string" && operation.operationId.trim() ? operation.operationId.trim() : method.toLowerCase() + "_" + path.replace(/[^a-zA-Z0-9]+/g, "_");
      if (!/^[A-Za-z0-9][A-Za-z0-9_.-]{0,159}$/u.test(operationId) || names.has(operationId)) throw unsupported(); names.add(operationId);
      resolver.string(operationId);
      let body: { bodySchema?: Schema; bodyRequired?: boolean } = {};
      if (operation.requestBody !== undefined) {
        if (!new Set(["post", "put", "patch", "delete"]).has(method.toLowerCase())) throw unsupported();
        const requestBody = resolver.dereference(operation.requestBody), content = record(requestBody.content);
        if (!Object.hasOwn(content, "application/json") || requestBody.required !== undefined && typeof requestBody.required !== "boolean") throw unsupported();
        body = { bodySchema: resolver.schema(record(content["application/json"]).schema ?? {}), bodyRequired: requestBody.required === true };
      }
      const compiled = { method: method.toUpperCase(), path, operationId, ...(typeof operation.summary === "string" ? { summary: resolver.string(operation.summary) } : {}), parameters: bindings, ...body };
      operationToMcpTool(compiled);
      operations.push(Object.freeze({ ...compiled, parameters: Object.freeze(bindings.map(p => Object.freeze(p))) as unknown as Parameter[] }));
    }
  }
  return operations;
}

export function operationToMcpTool(operation: OpenApiOperation): RestTool {
  const entries: Array<[string, unknown]> = [], required: string[] = [], names = new Set<string>();
  for (const p of operation.parameters) {
    const name = argumentName(p); if (names.has(name) || name === "body" && operation.bodySchema !== undefined) throw unsupported(); names.add(name);
    entries.push([name, p.schema]); if (p.required) required.push(name);
  }
  if (operation.bodySchema !== undefined) { entries.push(["body", operation.bodySchema]); if (operation.bodyRequired) required.push("body"); }
  return Object.freeze({ name: operation.operationId, ...(operation.summary ? { description: operation.summary } : {}),
    inputSchema: Object.freeze({ type: "object", properties: Object.freeze(Object.fromEntries(entries)), ...(required.length ? { required: Object.freeze(required) } : {}) }),
    __rest: operation });
}

function scalar(value: unknown): string {
  if (typeof value !== "string" && typeof value !== "boolean" && !(typeof value === "number" && Number.isFinite(value))) throw unsupported();
  return String(value);
}
function flat(value: unknown): string | string[] | Array<[string, string]> {
  if (Array.isArray(value)) return list(value).map(scalar);
  if (value && typeof value === "object") return Object.entries(record(value)).map(([key, item]): [string, string] => [key, scalar(item)]);
  return scalar(value);
}
function encode(value: string): string { return encodeURIComponent(value).replace(/[!'()*]/g, char => "%" + char.charCodeAt(0).toString(16).toUpperCase()); }
function simple(value: unknown, explode: boolean): string {
  const data = flat(value);
  if (typeof data === "string") return encode(data);
  return data.map(item => Array.isArray(item) ? item.map(encode).join(explode ? "=" : ",") : encode(item)).join(",");
}
function form(name: string, value: unknown, explode: boolean): Array<[string, string]> {
  const data = flat(value);
  if (typeof data === "string") return [[name, data]];
  if (!data.length) return [];
  if (!explode) return [[name, data.flat().join(",")]];
  return data.map(item => Array.isArray(item) ? item : [name, item]);
}
function requestBindings(operation: OpenApiOperation, args: Record<string, unknown>, configured: Record<string, string>) {
  const values = record(args), allowed = new Set(operation.parameters.map(argumentName));
  if (operation.bodySchema !== undefined) allowed.add("body");
  if (Object.keys(values).some(key => !allowed.has(key))) throw unsupported();
  let path = operation.path;
  const query = new URLSearchParams(), headers = Object.assign(Object.create(null) as Record<string, string>, configured), cookies: string[] = [], queryOwners = new Map<string, string>();
  for (const p of operation.parameters) {
    const argument = argumentName(p), value = Object.hasOwn(values, argument) ? values[argument] : undefined;
    if (value === undefined || value === null) { if (p.required) throw unsupported(); continue; }
    if (p.in === "path") {
      const serialized = simple(value, p.explode); if (serialized === "." || serialized === "..") throw unsupported();
      path = path.split("{" + p.name + "}").join(serialized);
    } else if (p.in === "query") {
      for (const [key, item] of form(p.name, value, p.explode)) {
        if (queryOwners.has(key) && queryOwners.get(key) !== argument) throw unsupported();
        queryOwners.set(key, argument); query.append(key, item);
      }
    } else {
      const strings = flat(value);
      if ((typeof strings === "string" ? [strings] : strings.flat()).some(item => /[\u0000-\u001f\u007f]/u.test(item))) throw unsupported();
      if (p.in === "header") headers[p.name.toLowerCase()] = simple(value, p.explode);
      else { if (typeof strings !== "string") throw unsupported(); cookies.push(p.name + "=" + encode(strings)); }
    }
  }
  if (cookies.length) headers.cookie = cookies.join("; ");
  const body = Object.hasOwn(values, "body") ? JSON.stringify(values.body) : undefined;
  if (operation.bodyRequired && body === undefined) throw unsupported();
  if (body !== undefined) headers["content-type"] ??= "application/json";
  return { path, query, headers, body };
}

export function createOpenApiRestBridge(config: {
  id: string;
  baseUrl: string;
  specUrl?: string;
  spec?: unknown;
  headers?: Record<string, string>;
  timeoutMs?: number;
}, options: {
  fetchImpl?: (url: string, init: Record<string, unknown>) => Promise<{ ok: boolean; status: number; headers: Record<string, string>; text: () => Promise<string> }>;
} = {}) {
  const timeoutMs = config.timeoutMs ?? 20_000;
  const fetchImpl = options.fetchImpl ?? null;
  let cachedTools: RestTool[] | null = null;
  const configuredHeaders = Object.fromEntries(Object.entries(config.headers ?? {}).map(([name, value]) => [name.toLowerCase(), value]));

  async function loadSpecText(signal?: AbortSignal): Promise<string> {
    throwIfExecutionAborted(signal);
    const destination = await resolveSafeOutboundUrl(config.specUrl!);
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(new Error(`OpenAPI spec fetch timed out after ${timeoutMs}ms`)), timeoutMs);
    timer.unref?.();
    try {
      const effectiveSignal = signal
        ? AbortSignal.any([controller.signal, signal])
        : controller.signal;
      const response = fetchImpl
        ? await fetchImpl(destination.url, { method: "GET", signal: effectiveSignal })
        : await fetchWithAgent(destination.url, {
            method: "GET",
            signal: effectiveSignal,
            maxResponseBytes: MAX_SPEC_CHARS + 1,
          });
      const text = await response.text();
      if (!response.ok) {
        throw new Error(`OpenAPI spec fetch returned ${response.status}.`);
      }
      if (text.length > MAX_SPEC_CHARS) {
        throw new Error("OpenAPI spec exceeds the size limit.");
      }
      return text;
    } finally {
      clearTimeout(timer);
    }
  }

  async function ensureTools(signal?: AbortSignal) {
    if (cachedTools) return cachedTools;
    const spec = config.spec === undefined ? JSON.parse(await loadSpecText(signal)) : config.spec;
    const compiled = parseOpenApiOperations(spec).map(operationToMcpTool);
    if (Object.keys(configuredHeaders).length !== Object.keys(config.headers ?? {}).length
      || Object.entries(configuredHeaders).some(([name, value]) => !TOKEN.test(name) || typeof value !== "string" || /[\r\n\0]/u.test(value))) throw unsupported();
    for (const tool of compiled) {
      if (tool.__rest.parameters.some(p => (p.in === "header" && Object.hasOwn(configuredHeaders, p.name.toLowerCase()))
        || (p.in === "cookie" && Object.hasOwn(configuredHeaders, "cookie")))
        || tool.__rest.bodySchema !== undefined && configuredHeaders["content-type"] !== undefined
        && configuredHeaders["content-type"].split(";")[0].trim().toLowerCase() !== "application/json") throw unsupported();
    }
    cachedTools = compiled;
    return cachedTools;
  }


  return {
    id: config.id,
    transport: "openapi-rest" as const,
    async listTools(): Promise<McpToolDescriptor[]> {
      await ensureTools();
      return [...cachedTools!];
    },
    async callTool(
      name: string,
      args: Record<string, unknown>,
      execution: { signal?: AbortSignal } = {},
    ): Promise<McpCallResult> {
      await ensureTools(execution.signal);
      throwIfExecutionAborted(execution.signal);
      const tool = cachedTools!.find((candidate) => candidate.name === name);
      if (!tool) {
        throw new Error(`Unknown generated tool '${name}'.`);
      }
      const { path, query, headers, body } = requestBindings(tool.__rest, args, configuredHeaders);

      const destination = await resolveSafeOutboundUrl(
        `${config.baseUrl.replace(/\/+$/, "")}${path}${query.size ? `?${query}` : ""}`,
      );
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(new Error(`REST bridge call timed out after ${timeoutMs}ms`)), timeoutMs);
      timer.unref?.();
      try {
        const effectiveSignal = execution.signal
          ? AbortSignal.any([controller.signal, execution.signal])
          : controller.signal;
        const init = {
          method: tool.__rest.method,
          headers,
          ...(body !== undefined ? { body } : {}),
          signal: effectiveSignal,
        };
        const response = fetchImpl
          ? await fetchImpl(destination.url, init)
          : await fetchWithAgent(destination.url, {
              ...init,
              maxResponseBytes: MAX_RESPONSE_CHARS + 1,
            });
        const text = await response.text();
        if (text.length > MAX_RESPONSE_CHARS) {
          const error = new Error("OpenAPI bridge response exceeds the size limit.");
          (error as Error & { code?: string }).code = "OPENAPI_RESPONSE_TOO_LARGE";
          throw error;
        }
        return {
          content: [{ type: "text", text }],
          isError: !response.ok,
          httpStatus: response.status,
        };
      } finally {
        clearTimeout(timer);
      }
    },
    async close() {
      cachedTools = null;
    },
  };
}
