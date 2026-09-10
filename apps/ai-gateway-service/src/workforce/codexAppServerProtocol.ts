import { Readable, Writable } from "node:stream";
import { createScanner, parseTree, ScanError, SyntaxKind } from "jsonc-parser";
import type { Node as JsonNode, ParseError } from "jsonc-parser";

export type CodexRpcJson = null | boolean | number | string | CodexRpcJson[] | { [key: string]: CodexRpcJson };
export type CodexRpcObject = { [key: string]: CodexRpcJson };
export type CodexRpcMethod = "initialize" | "thread/start" | "turn/start" | "thread/read" | "turn/interrupt";
export type CodexRpcCallOptions = { signal?: AbortSignal; timeoutMs?: number };
export type CodexRpcDispatch = Readonly<{ requestId: string; method: CodexRpcMethod; threadId?: string; turnId?: string }>;
export type CodexRpcNotification = Readonly<{ method: string; params?: CodexRpcJson; emittedAtMs?: number }>;
export type CodexFileChangeDecision = "accept" | "decline" | "cancel";
export type CodexNativeThreadResult = CodexRpcObject & { thread: CodexRpcObject & { id: string; turns: CodexRpcJson[] } };
export type CodexNativeTurnResult = CodexRpcObject & { turn: CodexRpcObject & { id: string; items: CodexRpcJson[]; status: string } };

export class CodexAppServerProtocolError extends Error {
  readonly code: string;
  readonly retryable = false;
  readonly sent: boolean;
  readonly outcomeUnknown: boolean;
  readonly requestId?: string;
  readonly method?: CodexRpcMethod;
  readonly threadId?: string;
  readonly turnId?: string;
  readonly nativeCode?: number;
  constructor(code: string, dispatch?: CodexRpcDispatch, sent = false, ambiguous = false) {
    super("The Codex app-server protocol operation did not complete safely.");
    this.name = "CodexAppServerProtocolError"; this.code = `CODEX_APP_SERVER_${code}`;
    this.sent = sent; this.outcomeUnknown = sent && ambiguous && dispatch?.method === "turn/start";
    if (dispatch) Object.assign(this, dispatch);
  }
}
function fail(code: string): never { throw new CodexAppServerProtocolError(code); }
function object(value: unknown): value is CodexRpcObject {
  return value !== null && typeof value === "object" && !Array.isArray(value) && [Object.prototype, null].includes(Object.getPrototypeOf(value));
}
function id(value: unknown): value is string {
  return typeof value === "string" && value.length > 0 && value.length <= 256 && !/[\u0000-\u001f\u007f]/u.test(value);
}
function wireId(value: unknown): value is string | number { return id(value) || typeof value === "number" && Number.isSafeInteger(value); }
function limit(value: unknown, fallback: number, maximum: number): number {
  if (value === undefined) return fallback;
  if (!Number.isSafeInteger(value) || Number(value) < 1 || Number(value) > maximum) fail("INVALID_OPTIONS");
  return Number(value);
}
function jsonSnapshot(value: unknown, maxBytes: number): CodexRpcJson {
  let nodes = 0;
  const copy = (item: unknown, depth: number): CodexRpcJson => {
    if (++nodes > 50_000 || depth > 32) fail("INVALID_JSON");
    if (item === null || typeof item === "boolean" || typeof item === "string") return item;
    if (typeof item === "number" && Number.isFinite(item) && (!Number.isInteger(item) || Number.isSafeInteger(item))) return item;
    const array = Array.isArray(item);
    if (!array && !object(item) || array && Object.getPrototypeOf(item) !== Array.prototype) fail("INVALID_JSON");
    const keys = Reflect.ownKeys(item as object), entries: [string, CodexRpcJson][] = [];
    if (array && keys.length !== item.length + 1) fail("INVALID_JSON");
    for (const key of keys) {
      if (array && key === "length") continue;
      const field = Object.getOwnPropertyDescriptor(item, key);
      if (typeof key !== "string" || !field?.enumerable || !("value" in field)) fail("INVALID_JSON");
      if (array && key !== String(entries.length)) fail("INVALID_JSON");
      entries.push([key, copy(field.value, depth + 1)]);
    }
    return array ? entries.map(([, value]) => value) : Object.fromEntries(entries);
  };
  const result = copy(value, 0);
  if (Buffer.byteLength(JSON.stringify(result), "utf8") > maxBytes) fail("MESSAGE_TOO_LARGE");
  return result;
}
function parseLine(bytes: Buffer, maxBytes: number): CodexRpcObject {
  let text: string;
  try { text = new TextDecoder("utf-8", { fatal: true, ignoreBOM: true }).decode(bytes); } catch { return fail("INVALID_UTF8"); }
  const scanner = createScanner(text, false);
  let depth = 0;
  for (;;) {
    const kind = scanner.scan();
    if (scanner.getTokenError() !== ScanError.None || [SyntaxKind.Unknown, SyntaxKind.LineCommentTrivia, SyntaxKind.BlockCommentTrivia].includes(kind)) fail("INVALID_JSON");
    if (kind === SyntaxKind.EOF) break;
    if (kind === SyntaxKind.OpenBraceToken || kind === SyntaxKind.OpenBracketToken) depth += 1;
    if (kind === SyntaxKind.CloseBraceToken || kind === SyntaxKind.CloseBracketToken) depth -= 1;
    if (depth < 0 || depth > 33) fail("INVALID_JSON");
  }
  const errors: ParseError[] = [], root = parseTree(text, errors, { disallowComments: true, allowTrailingComma: false });
  if (!root || errors.length) fail("INVALID_JSON");
  const pending: JsonNode[] = [root]; let nodes = 0;
  while (pending.length) {
    const node = pending.pop()!;
    if (++nodes > 100_000) fail("INVALID_JSON");
    if (node.type === "object") {
      const keys = new Set<string>();
      for (const field of node.children ?? []) {
        const key = field.children?.[0]?.value;
        if (typeof key !== "string" || keys.has(key)) fail("INVALID_JSON");
        keys.add(key);
      }
    }
    pending.push(...(node.children ?? []));
  }
  let parsed: unknown;
  try { parsed = JSON.parse(text); } catch { return fail("INVALID_JSON"); }
  const result = jsonSnapshot(parsed, maxBytes);
  if (!object(result)) fail("INVALID_ENVELOPE");
  return result;
}
function freeze(value: CodexRpcJson): CodexRpcJson {
  if (value !== null && typeof value === "object") { for (const item of Object.values(value)) freeze(item); Object.freeze(value); }
  return value;
}

/** Codex CLI 0.153.4 stdio wire: one JSON message per line, without a jsonrpc field.
 * The owner attests/spawns/stops the process and validates policy and notification identity.
 * Only a narrow owner callback may accept one file-change request; session grants and credential callbacks are unavailable. */
export function createCodexAppServerProtocol(options: {
  readable: Readable; writable: Writable; timeoutMs?: number; maxMessageBytes?: number; maxPending?: number;
  /** Synchronous dispatch-attempt marker; it does not attest server acceptance or execution. */
  onRequestSent?: (dispatch: CodexRpcDispatch) => void;
  onClose?: (error: CodexAppServerProtocolError) => void;
  onFileChangeApproval?: (params: Readonly<CodexRpcObject>, requestId: string | number) => CodexFileChangeDecision | Promise<CodexFileChangeDecision>;
}) {
  if (!(options?.readable instanceof Readable) || !(options?.writable instanceof Writable) || options.readable.readableEncoding
    || options.onRequestSent !== undefined && typeof options.onRequestSent !== "function"
    || options.onClose !== undefined && typeof options.onClose !== "function"
    || options.onFileChangeApproval !== undefined && typeof options.onFileChangeApproval !== "function") fail("INVALID_OPTIONS");
  const timeoutMs = limit(options.timeoutMs, 15_000, 120_000), maxBytes = limit(options.maxMessageBytes, 1_048_576, 4_194_304);
  const maxPending = limit(options.maxPending, 16, 64), { readable, writable } = options;
  type Pending = { dispatch: CodexRpcDispatch; sent: boolean; resolve(value: CodexRpcObject): void;
    reject(error: CodexAppServerProtocolError): void; cleanup(): void };
  const pending = new Map<string, Pending>(), abandoned = new Set<string>();
  const serverRequestIds = new Set<string | number>();
  const serverCallbacks = new Map<string | number, { responded: boolean; timer: ReturnType<typeof setTimeout> }>();
  const listeners = new Set<(notification: CodexRpcNotification) => void>();
  let phase: "new" | "initializing" | "ready" | "closed" = "new", sequence = 0, partial = Buffer.alloc(0);
  const isClosed = () => phase === "closed";
  const errorFor = (code: string, request: Pending, ambiguous: boolean) => new CodexAppServerProtocolError(code, request.dispatch, request.sent, ambiguous);
  function shutdown(code: string) {
    if (phase === "closed") return;
    phase = "closed"; partial = Buffer.alloc(0);
    readable.off("data", onData); readable.off("end", onEnd); readable.off("close", onEnd); readable.off("error", onTransportError);
    writable.off("error", onTransportError); writable.off("close", onEnd); writable.off("finish", onEnd);
    for (const request of pending.values()) { request.cleanup(); request.reject(errorFor(code, request, true)); }
    for (const callback of serverCallbacks.values()) { callback.responded = true; clearTimeout(callback.timer); }
    serverCallbacks.clear(); serverRequestIds.clear();
    pending.clear(); abandoned.clear(); listeners.clear();
    try { void Promise.resolve(options.onClose?.(new CodexAppServerProtocolError(code))).catch(() => {}); }
    catch { /* Owner callback errors cannot expose native transport errors. */ }
  }
  function write(message: CodexRpcObject, request?: Pending) {
    const line = JSON.stringify(message) + "\n";
    if (Buffer.byteLength(line) - 1 > maxBytes || writable.writableLength + Buffer.byteLength(line) > maxBytes * maxPending) {
      shutdown("MESSAGE_TOO_LARGE"); return;
    }
    if (phase === "closed" || writable.destroyed || writable.writableEnded) { shutdown("TRANSPORT_CLOSED"); return; }
    try {
      if (request) {
        options.onRequestSent?.(request.dispatch);
        if (!pending.has(request.dispatch.requestId) || isClosed()) return;
        request.sent = true;
      }
      writable.write(line, "utf8");
    } catch { shutdown("TRANSPORT_ERROR"); }
  }
  function validateResult(method: CodexRpcMethod, value: CodexRpcJson, dispatch: CodexRpcDispatch): CodexRpcObject {
    if (!object(value)) fail("INVALID_RESPONSE");
    if (method === "initialize" && ![value.userAgent, value.platformFamily, value.platformOs, value.codexHome].every(item => typeof item === "string")) fail("INVALID_RESPONSE");
    if (method === "thread/start" || method === "thread/read") {
      if (!object(value.thread) || !id(value.thread.id) || !Array.isArray(value.thread.turns)
        || method === "thread/read" && value.thread.id !== dispatch.threadId) fail("INVALID_RESPONSE");
    }
    if (method === "turn/start" && (!object(value.turn) || !id(value.turn.id) || !Array.isArray(value.turn.items)
      || !["completed", "interrupted", "failed", "inProgress"].includes(String(value.turn.status)))) fail("INVALID_RESPONSE");
    if (method === "turn/interrupt" && Object.keys(value).length) fail("INVALID_RESPONSE");
    return value;
  }
  function fileChangeApproval(params: CodexRpcJson | undefined, requestId: string | number) {
    const callback = options.onFileChangeApproval;
    if (!callback || phase !== "ready" || serverCallbacks.size >= maxPending || !object(params)
      || Object.keys(params).some(key => !["threadId", "turnId", "itemId", "startedAtMs", "reason", "grantRoot"].includes(key))
      || !id(params.threadId) || !id(params.turnId) || !id(params.itemId)
      || typeof params.startedAtMs !== "number" || !Number.isSafeInteger(params.startedAtMs) || params.startedAtMs < 0
      || params.reason !== undefined && params.reason !== null && typeof params.reason !== "string"
      || params.grantRoot !== undefined && params.grantRoot !== null) {
      write({ id: requestId, result: { decision: "decline" } }); return;
    }
    const respond = (decision: CodexFileChangeDecision) => {
      if (state.responded) return;
      state.responded = true; clearTimeout(state.timer);
      if (!isClosed()) write({ id: requestId, result: { decision } });
    };
    const state = { responded: false, timer: setTimeout(() => respond("decline"), timeoutMs) };
    serverCallbacks.set(requestId, state);
    const settled = (decision: unknown) => {
      serverCallbacks.delete(requestId);
      respond(decision === "accept" || decision === "decline" || decision === "cancel" ? decision : "decline");
    };
    try {
      const result: unknown = callback(freeze(params) as Readonly<CodexRpcObject>, requestId);
      // Timed-out callbacks retain their slot until they settle; late acceptance is never sent.
      if (result instanceof Promise) void result.then(settled, () => settled("decline"));
      else settled(result);
    } catch { settled("decline"); }
  }
  function receive(message: CodexRpcObject) {
    const keys = Object.keys(message), hasId = Object.hasOwn(message, "id"), hasMethod = Object.hasOwn(message, "method");
    if (hasMethod) {
      if (!id(message.method) || keys.some(key => !["id", "method", "params", ...(hasId ? ["trace"] : ["emittedAtMs"])].includes(key))
        || hasId && !wireId(message.id) || Object.hasOwn(message, "emittedAtMs") && !Number.isSafeInteger(message.emittedAtMs)) fail("INVALID_ENVELOPE");
      if (hasId) {
        const requestId = message.id as string | number;
        if (serverRequestIds.has(requestId)) fail("DUPLICATE_SERVER_REQUEST");
        if (serverRequestIds.size >= 4096) fail("SERVER_REQUEST_CAPACITY");
        serverRequestIds.add(requestId);
        if (message.method === "item/fileChange/requestApproval") { fileChangeApproval(message.params, requestId); return; }
        write(message.method === "item/commandExecution/requestApproval" ? { id: message.id!, result: { decision: "decline" } }
          : { id: message.id!, error: { code: -32601, message: "Unsupported server request." } });
        return;
      }
      // ServerNotification adds this timestamp outside its oneOf method variants in the 0.153.4 schema.
      // It is observational metadata and never an execution deadline or authorization signal.
      const notification = Object.freeze({ method: message.method, ...(Object.hasOwn(message, "params") ? { params: freeze(message.params!) } : {}),
        ...(Object.hasOwn(message, "emittedAtMs") ? { emittedAtMs: message.emittedAtMs as number } : {}) });
      for (const listener of listeners) {
        try { void Promise.resolve(listener(notification)).catch(() => shutdown("NOTIFICATION_CALLBACK_FAILED")); }
        catch { shutdown("NOTIFICATION_CALLBACK_FAILED"); return; }
      }
      return;
    }
    const hasResult = Object.hasOwn(message, "result"), hasError = Object.hasOwn(message, "error");
    if (!hasId || !id(message.id) || hasResult === hasError || keys.some(key => !["id", "result", "error"].includes(key))) fail("INVALID_ENVELOPE");
    if (hasError && (!object(message.error) || !Number.isSafeInteger(message.error.code) || typeof message.error.message !== "string")) fail("INVALID_ENVELOPE");
    const request = pending.get(message.id);
    if (!request) { if (abandoned.delete(message.id)) return; return fail("UNEXPECTED_RESPONSE"); }
    const result = hasResult ? validateResult(request.dispatch.method, message.result!, request.dispatch) : undefined;
    pending.delete(message.id); request.cleanup();
    if (hasError) {
      const remote = message.error as CodexRpcObject;
      const unsupportedFilesystem = request.dispatch.method === "thread/start" && remote.code === -32603
        && (remote.message as string).includes("windows unelevated restricted-token sandbox cannot enforce split filesystem read restrictions directly")
        && (remote.message as string).includes("refusing to run unsandboxed");
      request.reject(Object.assign(errorFor(unsupportedFilesystem ? "FILESYSTEM_POLICY_UNSUPPORTED" : "REMOTE_ERROR", request, false), { nativeCode: remote.code }));
    } else request.resolve(result!);
  }
  function onData(chunk: unknown) {
    try {
      if (!Buffer.isBuffer(chunk) && !(chunk instanceof Uint8Array)) fail("INVALID_TRANSPORT_DATA");
      const bytes = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
      let offset = 0;
      while (offset < bytes.length && phase !== "closed") {
        const newline = bytes.indexOf(10, offset), end = newline < 0 ? bytes.length : newline;
        if (partial.length + end - offset > maxBytes) fail("MESSAGE_TOO_LARGE");
        partial = Buffer.concat([partial, bytes.subarray(offset, end)]);
        if (newline < 0) return;
        const frame = partial; partial = Buffer.alloc(0); offset = newline + 1;
        receive(parseLine(frame.at(-1) === 13 ? frame.subarray(0, -1) : frame, maxBytes));
      }
    } catch (error) { shutdown(error instanceof CodexAppServerProtocolError ? error.code.slice("CODEX_APP_SERVER_".length) : "INVALID_ENVELOPE"); }
  }
  function onEnd() { shutdown(partial.length ? "INCOMPLETE_FRAME" : "TRANSPORT_CLOSED"); }
  function onTransportError() { shutdown("TRANSPORT_ERROR"); }
  readable.on("data", onData); readable.on("end", onEnd); readable.on("close", onEnd); readable.on("error", onTransportError);
  writable.on("error", onTransportError); writable.on("close", onEnd); writable.on("finish", onEnd);

  function request(method: CodexRpcMethod, params: unknown, call: CodexRpcCallOptions = {}): Promise<CodexRpcObject> {
    try {
      if (phase === "closed") fail("CLOSED");
      if (method !== "initialize" && phase !== "ready") fail("NOT_INITIALIZED");
      const duration = limit(call.timeoutMs, timeoutMs, 120_000);
      if (call.signal !== undefined && !(call.signal instanceof AbortSignal)) fail("INVALID_OPTIONS");
      if (call.signal?.aborted) fail("ABORTED");
      if (pending.size >= maxPending || sequence >= 1_000_000) fail("CAPACITY");
      const data = jsonSnapshot(params, maxBytes);
      if (!object(data)) fail("INVALID_PARAMS");
      if (method === "turn/start" && (!id(data.threadId) || !Array.isArray(data.input) || data.input.length === 0)
        || method === "thread/read" && !id(data.threadId)
        || method === "turn/interrupt" && (!id(data.threadId) || !id(data.turnId))) fail("INVALID_PARAMS");
      const requestId = `codex-rpc-${++sequence}`;
      const dispatch: CodexRpcDispatch = Object.freeze({ requestId, method,
        ...(id(data.threadId) ? { threadId: data.threadId } : {}), ...(id(data.turnId) ? { turnId: data.turnId } : {}) });
      return new Promise<CodexRpcObject>((resolve, reject) => {
        const retire = (code: string) => {
          const current = pending.get(requestId); if (!current) return;
          pending.delete(requestId); current.cleanup();
          if (current.sent) abandoned.add(requestId);
          reject(errorFor(code, current, true));
          if (abandoned.size > 64) shutdown("CAPACITY");
        };
        const onAbort = () => retire("ABORTED"), timer = setTimeout(() => retire("TIMEOUT"), duration);
        const current: Pending = { dispatch, sent: false, resolve, reject,
          cleanup() { clearTimeout(timer); call.signal?.removeEventListener("abort", onAbort); } };
        pending.set(requestId, current); call.signal?.addEventListener("abort", onAbort, { once: true });
        if (call.signal?.aborted) { onAbort(); return; }
        write({ id: requestId, method, params: data }, current);
      });
    } catch (error) { return Promise.reject(error instanceof CodexAppServerProtocolError ? error : new CodexAppServerProtocolError("INVALID_PARAMS")); }
  }
  return Object.freeze({
    async initialize(call?: CodexRpcCallOptions) {
      if (phase !== "new") fail(phase === "closed" ? "CLOSED" : "INITIALIZATION_REUSED");
      phase = "initializing";
      try {
        const result = await request("initialize", { clientInfo: { name: "unified-ai-system", version: "0.1.0" },
          capabilities: { experimentalApi: true, requestAttestation: false } }, call);
        write({ method: "initialized" });
        if (isClosed()) fail("CLOSED");
        phase = "ready"; return result;
      } catch (error) { shutdown("INITIALIZATION_FAILED"); throw error; }
    },
    startThread: (params: CodexRpcObject, call?: CodexRpcCallOptions) => request("thread/start", params, call) as Promise<CodexNativeThreadResult>,
    startTurn: (params: CodexRpcObject, call?: CodexRpcCallOptions) => request("turn/start", params, call) as Promise<CodexNativeTurnResult>,
    readThread: (threadId: string, call?: CodexRpcCallOptions) => request("thread/read", { threadId, includeTurns: true }, call) as Promise<CodexNativeThreadResult>,
    interrupt: (threadId: string, turnId: string, call?: CodexRpcCallOptions) => request("turn/interrupt", { threadId, turnId }, call),
    /** Subscribe before starting a turn: notifications are immediate, untrusted, and not replayed. */
    onNotification(listener: (notification: CodexRpcNotification) => void) {
      if (phase === "closed") fail("CLOSED");
      if (typeof listener !== "function" || listeners.size >= 8) fail("INVALID_OPTIONS");
      listeners.add(listener); return () => { listeners.delete(listener); };
    },
    close() { shutdown("CLOSED"); },
  });
}
