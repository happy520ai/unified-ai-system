import { PassThrough, Writable } from "node:stream";
import { describe, expect, it, vi } from "vitest";
import { CodexAppServerProtocolError, createCodexAppServerProtocol } from "./codexAppServerProtocol.ts";
import type { CodexRpcObject, CodexRpcNotification, CodexRpcDispatch } from "./codexAppServerProtocol.ts";

const initialized = { userAgent: "codex/0.153.4", platformFamily: "windows", platformOs: "windows", codexHome: "E:/synthetic-codex" };
const turn = { id: "turn-one", status: "inProgress", items: [] };
function fixture(settings: { timeoutMs?: number; maxPending?: number; maxMessageBytes?: number;
  onRequestSent?: (dispatch: CodexRpcDispatch) => void; onClose?: (error: CodexAppServerProtocolError) => void;
  onFileChangeApproval?: (params: Readonly<CodexRpcObject>, requestId: string | number) => "accept" | "decline" | "cancel" | Promise<"accept" | "decline" | "cancel"> } = {}) {
  const readable = new PassThrough(), writable = new PassThrough(), sent: CodexRpcObject[] = [];
  let handler: ((message: CodexRpcObject) => void) | undefined, buffer = "";
  const send = (message: CodexRpcObject) => readable.write(JSON.stringify(message) + "\n");
  writable.on("data", chunk => {
    buffer += chunk.toString("utf8");
    for (;;) {
      const newline = buffer.indexOf("\n"); if (newline < 0) return;
      const message = JSON.parse(buffer.slice(0, newline)) as CodexRpcObject;
      buffer = buffer.slice(newline + 1); sent.push(message);
      if (message.method === "initialize") send({ id: message.id!, result: initialized });
      else if (message.method !== "initialized") handler?.(message);
    }
  });
  const client = createCodexAppServerProtocol({ readable, writable, ...settings });
  return { client, readable, writable, sent, send, handle: (value: typeof handler) => { handler = value; },
    close() { client.close(); readable.destroy(); writable.destroy(); } };
}

describe("finite Codex app-server stream protocol", () => {
  it("performs one exact handshake and uses only fixed start/read/interrupt methods", async () => {
    const peer = fixture();
    try {
      await expect(peer.client.startThread({})).rejects.toMatchObject({ code: "CODEX_APP_SERVER_NOT_INITIALIZED", sent: false });
      expect(await peer.client.initialize()).toEqual(initialized);
      expect(peer.sent).toEqual([
        { id: "codex-rpc-1", method: "initialize", params: { clientInfo: { name: "unified-ai-system", version: "0.1.0" }, capabilities: { experimentalApi: true, requestAttestation: false } } },
        { method: "initialized" },
      ]);
      await expect(peer.client.initialize()).rejects.toMatchObject({ code: "CODEX_APP_SERVER_INITIALIZATION_REUSED" });
      peer.handle(message => peer.send({ id: message.id!, result: message.method === "turn/start" ? { turn }
        : message.method === "turn/interrupt" ? {} : { thread: { id: "thread-one", turns: [] } } }));
      const params = { cwd: "E:/owned-worktree", approvalPolicy: "untrusted", approvalsReviewer: "user", sandbox: "workspace-write",
        ephemeral: false, serviceName: "unified-ai-system", config: { features: { shell_tool: false } } };
      expect((await peer.client.startThread(params)).thread.id).toBe("thread-one");
      expect((await peer.client.startTurn({ threadId: "thread-one", input: [{ type: "text", text: "Summarize" }] })).turn.id).toBe("turn-one");
      await peer.client.readThread("thread-one"); await peer.client.interrupt("thread-one", "turn-one");
      expect(peer.sent.map(message => message.method)).toEqual(["initialize", "initialized", "thread/start", "turn/start", "thread/read", "turn/interrupt"]);
      expect(peer.sent[2]!.params).toEqual(params);
      expect(peer.sent[4]!.params).toEqual({ threadId: "thread-one", includeTurns: true });
      expect(peer.sent[5]!.params).toEqual({ threadId: "thread-one", turnId: "turn-one" });
    } finally { peer.close(); }
  });

  it("delivers notifications before the turn response and frames split UTF-8 without dropping data", async () => {
    const peer = fixture(), events: CodexRpcNotification[] = [];
    try {
      await peer.client.initialize();
      const unsubscribe = peer.client.onNotification(event => { events.push(event); });
      peer.handle(message => {
        const event = Buffer.from(JSON.stringify({ method: "item/agentMessage/delta", params: { threadId: "thread-one", turnId: "turn-one", delta: "中文😀" } }) + "\r\n");
        const split = event.indexOf(Buffer.from("中")) + 1;
        peer.readable.write(event.subarray(0, split)); peer.readable.write(event.subarray(split));
        expect(events).toHaveLength(1);
        peer.send({ id: message.id!, result: { turn } });
      });
      await peer.client.startTurn({ threadId: "thread-one", input: [{ type: "text", text: "x" }] });
      expect(events[0]!.params).toMatchObject({ delta: "中文😀", threadId: "thread-one", turnId: "turn-one" });
      expect(Object.isFrozen(events[0])).toBe(true); expect(Object.isFrozen(events[0]!.params)).toBe(true);
      unsubscribe(); peer.send({ method: "turn/completed", params: { threadId: "thread-one", turn } }); expect(events).toHaveLength(1);
    } finally { peer.close(); }
  });

  it("accepts the actual ServerNotification timestamp and reports unsupported Windows isolation without exposing native text", async () => {
    const peer = fixture(), events: CodexRpcNotification[] = [];
    try {
      await peer.client.initialize(); peer.client.onNotification(event => { events.push(event); });
      peer.handle(message => {
        peer.send({ method: "configWarning", params: { summary: "fixture warning" }, emittedAtMs: 1789150000000 });
        peer.send({ method: "remoteControl/status/changed", params: { status: "disabled" }, emittedAtMs: 1789150000001 });
        peer.send({ id: message.id!, error: { code: -32603, message: "private-path-marker: windows unelevated restricted-token sandbox cannot enforce split filesystem read restrictions directly; refusing to run unsandboxed" } });
      });
      const error = await peer.client.startThread({ permissions: "strict-fixture" }).catch(error => error);
      expect(error).toMatchObject({ code: "CODEX_APP_SERVER_FILESYSTEM_POLICY_UNSUPPORTED", nativeCode: -32603, method: "thread/start", outcomeUnknown: false });
      expect(JSON.stringify(error)).not.toContain("private-path-marker"); expect(error.message).not.toContain("private-path-marker");
      expect(events.map(event => [event.method, event.emittedAtMs])).toEqual([["configWarning", 1789150000000], ["remoteControl/status/changed", 1789150000001]]);
      expect(Object.isFrozen(events[0])).toBe(true);
    } finally { peer.close(); }
  });

  it.each([{ value: null, code: "INVALID_ENVELOPE" }, { value: "1", code: "INVALID_ENVELOPE" }, { value: 1.5, code: "INVALID_ENVELOPE" },
    { value: Number.MAX_SAFE_INTEGER + 1, code: "INVALID_JSON" }])("rejects an invalid notification timestamp $value", async ({ value: emittedAtMs, code }) => {
    const peer = fixture();
    try {
      await peer.client.initialize(); const pending = peer.client.readThread("thread-one");
      peer.send({ method: "configWarning", params: {}, emittedAtMs });
      await expect(pending).rejects.toMatchObject({ code: "CODEX_APP_SERVER_" + code });
    } finally { peer.close(); }
  });

  it("does not admit other envelope fields or a notification timestamp on a response", async () => {
    for (const notification of [true, false]) {
      const peer = fixture();
      try {
        await peer.client.initialize(); const pending = peer.client.readThread("thread-one");
        peer.send(notification ? { method: "configWarning", params: {}, unreviewed: true }
          : { id: peer.sent.at(-1)!.id!, result: { thread: { id: "thread-one", turns: [] } }, emittedAtMs: 1000 });
        await expect(pending).rejects.toMatchObject({ code: "CODEX_APP_SERVER_INVALID_ENVELOPE" });
      } finally { peer.close(); }
    }
  });

  it("correlates out-of-order IDs and rejects a wrong thread binding", async () => {
    const peer = fixture();
    try {
      await peer.client.initialize();
      const first = peer.client.readThread("thread-one"), second = peer.client.readThread("thread-two");
      peer.send({ id: peer.sent[3]!.id!, result: { thread: { id: "thread-two", turns: [] } } });
      peer.send({ id: peer.sent[2]!.id!, result: { thread: { id: "thread-one", turns: [] } } });
      expect((await first).thread.id).toBe("thread-one"); expect((await second).thread.id).toBe("thread-two");
      const wrong = peer.client.readThread("thread-one");
      peer.send({ id: peer.sent.at(-1)!.id!, result: { thread: { id: "thread-other", turns: [] } } });
      await expect(wrong).rejects.toMatchObject({ code: "CODEX_APP_SERVER_INVALID_RESPONSE", threadId: "thread-one", outcomeUnknown: false });
    } finally { peer.close(); }
  });

  it("declines both native approvals and refuses auth, attestation and all other server requests", async () => {
    const peer = fixture();
    try {
      await peer.client.initialize();
      for (const [index, method] of ["item/commandExecution/requestApproval", "item/fileChange/requestApproval", "account/chatgptAuthTokens/refresh", "attestation/generate", "item/permissions/requestApproval", "unknown/method"].entries()) {
        peer.send({ id: index, method, params: {} });
        expect(peer.sent.at(-1)).toEqual(index < 2 ? { id: index, result: { decision: "decline" } }
          : { id: index, error: { code: -32601, message: "Unsupported server request." } });
      }
      expect(JSON.stringify(peer.sent)).not.toMatch(/acceptForSession|execpolicy|token|grant/);
    } finally { peer.close(); }
  });

  it("accepts one file-change decision only through the owner callback with frozen bounded data", async () => {
    const approval = vi.fn((_params: Readonly<CodexRpcObject>, _requestId: string | number) => "accept" as const), peer = fixture({ onFileChangeApproval: approval });
    const params = { threadId: "thread-one", turnId: "turn-one", itemId: "patch-one", startedAtMs: 1000, grantRoot: null, reason: "Apply the approved patch" };
    try {
      await peer.client.initialize(); peer.send({ id: "file-one", method: "item/fileChange/requestApproval", params });
      await new Promise<void>(resolve => setImmediate(resolve));
      expect(approval).toHaveBeenCalledOnce(); expect(approval).toHaveBeenCalledWith(params, "file-one");
      expect(Object.isFrozen(approval.mock.calls[0]![0])).toBe(true);
      expect(peer.sent.at(-1)).toEqual({ id: "file-one", result: { decision: "accept" } });
      for (const [index, method] of ["item/commandExecution/requestApproval", "account/chatgptAuthTokens/refresh", "attestation/generate", "item/permissions/requestApproval"].entries()) {
        peer.send({ id: index, method, params });
        expect(peer.sent.at(-1)).not.toHaveProperty("result.decision", "accept");
      }
      expect(approval).toHaveBeenCalledOnce();
    } finally { peer.close(); }
  });

  it("declines malformed or session-wide file grants and invalid, throwing or rejecting callback decisions", async () => {
    const approval = vi.fn(() => "accept" as const), peer = fixture({ onFileChangeApproval: approval });
    const params = { threadId: "thread-one", turnId: "turn-one", itemId: "patch-one", startedAtMs: 1000 };
    try {
      await peer.client.initialize();
      for (const [index, value] of [null, {}, { ...params, grantRoot: "E:/owned" }, { ...params, extra: "grant" }].entries()) {
        peer.send({ id: index, method: "item/fileChange/requestApproval", params: value });
        expect(peer.sent.at(-1)).toEqual({ id: index, result: { decision: "decline" } });
      }
      expect(approval).not.toHaveBeenCalled();
    } finally { peer.close(); }
    for (const callback of [() => "acceptForSession", () => ({ decision: "accept" }), () => { throw new Error("private-approval-cause"); },
      () => Promise.reject(new Error("private-approval-cause"))]) {
      const invalid = fixture({ onFileChangeApproval: callback as never });
      try {
        await invalid.client.initialize(); invalid.send({ id: 1, method: "item/fileChange/requestApproval", params });
        await new Promise<void>(resolve => setImmediate(resolve));
        expect(invalid.sent.at(-1)).toEqual({ id: 1, result: { decision: "decline" } });
        expect(JSON.stringify(invalid.sent)).not.toContain("private-approval-cause");
      } finally { invalid.close(); }
    }
  });

  it("invokes a server request ID once and ignores acceptance after duplicate-ID shutdown or close", async () => {
    for (const duplicate of [true, false]) {
      let finish!: (value: "accept") => void;
      const approval = vi.fn(() => new Promise<"accept">(resolve => { finish = resolve; })), onClose = vi.fn();
      const peer = fixture({ onFileChangeApproval: approval, onClose });
      const message = { id: "same-id", method: "item/fileChange/requestApproval", params: { threadId: "thread-one", turnId: "turn-one", itemId: "patch-one", startedAtMs: 1000 } };
      try {
        await peer.client.initialize(); peer.send(message); expect(approval).toHaveBeenCalledOnce();
        if (duplicate) peer.send(message); else peer.client.close();
        expect(onClose).toHaveBeenCalledOnce(); expect(approval).toHaveBeenCalledOnce();
        const count = peer.sent.length; finish("accept"); await new Promise<void>(resolve => setImmediate(resolve));
        expect(peer.sent).toHaveLength(count); expect(peer.sent.some(value => (value.result as CodexRpcObject)?.decision === "accept")).toBe(false);
      } finally { finish?.("accept"); peer.close(); }
    }
  });

  it("times out to decline while retaining the callback slot until late completion", async () => {
    vi.useFakeTimers(); let finish!: (value: "accept") => void;
    const approval = vi.fn().mockImplementationOnce(() => new Promise<"accept">(resolve => { finish = resolve; })).mockReturnValue("cancel");
    const peer = fixture({ timeoutMs: 100, maxPending: 1, onFileChangeApproval: approval });
    const request = (id: number) => peer.send({ id, method: "item/fileChange/requestApproval", params: { threadId: "thread-one", turnId: "turn-one", itemId: "patch-" + id, startedAtMs: 1000 } });
    try {
      await peer.client.initialize(); request(1); request(2);
      expect(approval).toHaveBeenCalledOnce(); expect(peer.sent.at(-1)).toEqual({ id: 2, result: { decision: "decline" } });
      await vi.advanceTimersByTimeAsync(100); expect(peer.sent.at(-1)).toEqual({ id: 1, result: { decision: "decline" } });
      request(3); expect(approval).toHaveBeenCalledOnce(); expect(peer.sent.at(-1)).toEqual({ id: 3, result: { decision: "decline" } });
      finish("accept"); await vi.advanceTimersByTimeAsync(0); request(4); await vi.advanceTimersByTimeAsync(0);
      expect(approval).toHaveBeenCalledTimes(2); expect(peer.sent.at(-1)).toEqual({ id: 4, result: { decision: "cancel" } });
      expect(peer.sent.filter(value => value.id === 1)).toEqual([{ id: 1, result: { decision: "decline" } }]);
      expect(vi.getTimerCount()).toBe(0);
    } finally { finish?.("accept"); peer.close(); vi.useRealTimers(); }
  });

  it("keeps remote errors fixed and marks sent turn failures as unknown without retrying", async () => {
    const onClose = vi.fn(), dispatch = vi.fn(), peer = fixture({ onClose, onRequestSent: dispatch });
    try {
      await peer.client.initialize();
      const known = peer.client.startTurn({ threadId: "thread-one", input: [{ type: "text", text: "x" }] });
      peer.send({ id: peer.sent.at(-1)!.id!, error: { code: -32000, message: "private-native-error", data: { detail: "private-native-data" } } });
      const knownError = await known.catch(error => error);
      expect(knownError).toMatchObject({ code: "CODEX_APP_SERVER_REMOTE_ERROR", outcomeUnknown: false, sent: true, threadId: "thread-one" });
      expect(String(knownError) + JSON.stringify(knownError)).not.toContain("private-native");
      const unknown = peer.client.startTurn({ threadId: "thread-one", input: [{ type: "text", text: "x" }] });
      const requestId = peer.sent.at(-1)!.id;
      peer.readable.end();
      await expect(unknown).rejects.toMatchObject({ requestId, method: "turn/start", threadId: "thread-one", sent: true, outcomeUnknown: true, retryable: false });
      expect(onClose).toHaveBeenCalledOnce(); expect(dispatch).toHaveBeenLastCalledWith({ requestId, method: "turn/start", threadId: "thread-one" });
      expect(peer.sent.filter(message => message.method === "turn/start")).toHaveLength(2);
    } finally { peer.close(); }
  });

  it.each(["abort", "timeout"])("bounds %s after dispatch and observes a late response without repeating the turn", async mode => {
    vi.useFakeTimers(); const peer = fixture({ timeoutMs: 100 }), controller = new AbortController();
    try {
      await peer.client.initialize();
      const pending = peer.client.startTurn({ threadId: "thread-one", input: [{ type: "text", text: "x" }] }, { signal: controller.signal });
      const observed = pending.catch(error => error), requestId = peer.sent.at(-1)!.id;
      if (mode === "abort") controller.abort(new Error("private-cancel")); else await vi.advanceTimersByTimeAsync(100);
      expect(await observed).toMatchObject({ code: mode === "abort" ? "CODEX_APP_SERVER_ABORTED" : "CODEX_APP_SERVER_TIMEOUT", requestId, outcomeUnknown: true, sent: true });
      peer.send({ id: requestId!, result: { turn } });
      peer.handle(message => peer.send({ id: message.id!, result: { thread: { id: "thread-one", turns: [turn] } } }));
      expect((await peer.client.readThread("thread-one")).thread.turns).toEqual([turn]);
      expect(peer.sent.filter(message => message.method === "turn/start")).toHaveLength(1); expect(vi.getTimerCount()).toBe(0);
    } finally { peer.close(); vi.useRealTimers(); }
  });

  it("does not dispatch pre-aborted or observer-cancelled requests and caps pending requests", async () => {
    const controller = new AbortController(), peer = fixture({ maxPending: 1, onRequestSent: event => { if (event.method === "turn/start") controller.abort(); } });
    try {
      await peer.client.initialize();
      const cancelled = peer.client.startTurn({ threadId: "thread-one", input: [{ type: "text", text: "x" }] }, { signal: controller.signal });
      await expect(cancelled).rejects.toMatchObject({ sent: false, outcomeUnknown: false });
      await expect(peer.client.readThread("thread-one", { signal: controller.signal })).rejects.toMatchObject({ sent: false, code: "CODEX_APP_SERVER_ABORTED" });
      const pending = peer.client.readThread("thread-one");
      await expect(peer.client.readThread("thread-two")).rejects.toMatchObject({ code: "CODEX_APP_SERVER_CAPACITY" });
      expect(peer.sent.map(message => message.method)).toEqual(["initialize", "initialized", "thread/read"]);
      peer.client.close(); await expect(pending).rejects.toMatchObject({ code: "CODEX_APP_SERVER_CLOSED" });
      expect(peer.readable.destroyed).toBe(false); expect(peer.writable.destroyed).toBe(false);
    } finally { peer.close(); }
  });

  it("rejects non-JSON and oversized parameters without invoking accessors or dispatching", async () => {
    const peer = fixture({ maxMessageBytes: 512 }), getter = vi.fn(() => "unsafe"), cycle: Record<string, unknown> = {};
    cycle.self = cycle;
    try {
      await peer.client.initialize();
      const accessor = Object.defineProperty({}, "cwd", { enumerable: true, get: getter });
      for (const value of [accessor, cycle, { cwd: undefined }, { number: Infinity }, { number: 9007199254740992 }, { values: Array(2) }, { date: new Date() }]) {
        await expect(peer.client.startThread(value as CodexRpcObject)).rejects.toMatchObject({ code: "CODEX_APP_SERVER_INVALID_JSON", sent: false });
      }
      await expect(peer.client.startThread({ text: "x".repeat(513) })).rejects.toMatchObject({ code: "CODEX_APP_SERVER_MESSAGE_TOO_LARGE", sent: false });
      expect(getter).not.toHaveBeenCalled(); expect(peer.sent).toHaveLength(2);
    } finally { peer.close(); }
  });

  it.each(["duplicate-key", "unknown-id", "both-result-error", "invalid-utf8", "incomplete-frame", "too-large"])("fails closed on %s framing or envelope corruption", async scenario => {
    const peer = fixture({ maxMessageBytes: 512 });
    try {
      await peer.client.initialize();
      const pending = peer.client.startTurn({ threadId: "thread-one", input: [{ type: "text", text: "x" }] }), requestId = peer.sent.at(-1)!.id;
      const observed = pending.catch(error => error);
      if (scenario === "duplicate-key") peer.readable.write(`{"id":"${requestId}","id":"other","result":{}}\n`);
      if (scenario === "unknown-id") peer.send({ id: "unknown", result: {} });
      if (scenario === "both-result-error") peer.send({ id: requestId!, result: {}, error: { code: 1, message: "bad" } });
      if (scenario === "invalid-utf8") peer.readable.write(Buffer.from([0xc3, 0x28, 0x0a]));
      if (scenario === "incomplete-frame") peer.readable.end('{"id":');
      if (scenario === "too-large") peer.readable.write("x".repeat(513));
      expect(await observed).toMatchObject({ sent: true, outcomeUnknown: true, requestId, threadId: "thread-one" });
    } finally { peer.close(); }
  });

  it("observes a writable transport error and signals EOF even after a turn RPC already resolved", async () => {
    const readable = new PassThrough(), onClose = vi.fn(); let failWrite = false;
    const writable = new Writable({ write(bytes, _encoding, done) {
      const message = JSON.parse(bytes.toString());
      if (failWrite) { done(new Error("private-pipe-failure")); return; }
      if (message.method === "initialize") readable.write(JSON.stringify({ id: message.id, result: initialized }) + "\n");
      done();
    } });
    const client = createCodexAppServerProtocol({ readable, writable, onClose });
    try {
      await client.initialize(); failWrite = true;
      await expect(client.startTurn({ threadId: "thread-one", input: [{ type: "text", text: "x" }] })).rejects.toMatchObject({ code: "CODEX_APP_SERVER_TRANSPORT_ERROR", outcomeUnknown: true });
      expect(JSON.stringify(onClose.mock.calls)).not.toContain("private-pipe-failure");
    } finally { client.close(); readable.destroy(); writable.destroy(); }
    const peer = fixture({ onClose });
    try {
      await peer.client.initialize(); peer.handle(message => peer.send({ id: message.id!, result: { turn } }));
      await peer.client.startTurn({ threadId: "thread-one", input: [{ type: "text", text: "x" }] });
      peer.readable.end(); await new Promise<void>(resolve => setImmediate(resolve));
      expect(onClose).toHaveBeenLastCalledWith(expect.objectContaining({ code: "CODEX_APP_SERVER_TRANSPORT_CLOSED" }));
    } finally { peer.close(); }
  });
});
