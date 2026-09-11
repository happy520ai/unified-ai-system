import { EventEmitter } from "node:events";
import { createHash } from "node:crypto";
import type { IncomingMessage, ServerResponse } from "node:http";
import { describe, expect, it, vi } from "vitest";
import { EXECUTION_ABORT_CODES } from "@unified-ai-system/shared-utils";
import { bindGatewayExecution, createHttpRequestExecutionScope } from "./httpRequestExecution.ts";
import { GatewayService, bindFakeProviderExecution, bindExactProviderExecution } from "../core/gatewayService.js";
import { ProviderRegistry } from "../providers/providerRegistry.js";
import { createFakeProvider } from "../providers/fakeProvider.js";

function createTransport() {
  const requestEmitter = new EventEmitter();
  const responseEmitter = Object.assign(new EventEmitter(), { writableFinished: false });
  return {
    request: requestEmitter as EventEmitter & IncomingMessage,
    response: responseEmitter as unknown as EventEmitter & ServerResponse,
    requestEmitter,
    responseEmitter,
  };
}

it("keeps exact provider restrictions through HTTP wrappers without leaking them to another invocation", async () => {
  const registry = new ProviderRegistry();
  for (const providerId of ["one-fake", "two-fake"]) registry.register(createFakeProvider({ providerId, modelId: "model", providerType: "fake", capabilities: ["chat"], enabled: true }));
  const weighted = { apply: vi.fn(() => null), shouldShadow: vi.fn(() => null) };
  const gateway = new GatewayService({ providerRegistry: registry, weightedTrafficPolicy: weighted,
    runtimeConfig: { providerMode: "fake", realProviderEnabled: false } });
  const transport = createTransport(), scope = createHttpRequestExecutionScope({ ...transport, timeoutMs: 10000 });
  const bound = bindGatewayExecution(gateway, scope.context);
  const request = { taskType: "chat" as const, messages: [{ role: "user" as const, content: "fixture" }], providerId: "one-fake", model: "model" };
  try {
    const exact = {}; bindExactProviderExecution(exact, { providerId: "one-fake", modelId: "model" });
    expect((await bound.execute(request, exact)).success).toBe(true);
    expect(weighted.apply).not.toHaveBeenCalled(); expect(weighted.shouldShadow).not.toHaveBeenCalled();
    const fake = {}; bindFakeProviderExecution(fake, { providerId: "two-fake", modelId: "model" });
    const mismatch = await bound.execute(request, fake);
    expect(mismatch.success).toBe(false); expect(mismatch.error?.code).toBe("FAKE_PROVIDER_EXECUTION_REQUIRED");
    expect((await bound.execute(request)).success).toBe(true);
    expect(weighted.apply).toHaveBeenCalledTimes(1); expect(weighted.shouldShadow).toHaveBeenCalledTimes(1);
    expect((await bound.execute(request, JSON.parse(JSON.stringify(exact)))).success).toBe(true);
    expect(weighted.apply).toHaveBeenCalledTimes(2);
    bindFakeProviderExecution(scope.context, { providerId: "one-fake", modelId: "model" });
    const conflict = {}; bindExactProviderExecution(conflict, { providerId: "two-fake", modelId: "model" });
    expect(() => bound.execute(request, conflict)).toThrow("restrictions conflict");
    expect(weighted.apply).toHaveBeenCalledTimes(2);
  } finally { scope.cleanup(); }
});

describe("HTTP request execution scope", () => {
  it("aborts with a typed deadline and reports it once", () => {
    vi.useFakeTimers();
    try {
      const transport = createTransport();
      const onDeadline = vi.fn();
      const scope = createHttpRequestExecutionScope({ ...transport, timeoutMs: 250, now: () => 1_000, onDeadline });

      expect(scope.context.deadlineAt).toBe(1_250);
      vi.advanceTimersByTime(250);

      expect(scope.context.signal.aborted).toBe(true);
      expect(scope.context.signal.reason).toMatchObject({
        code: EXECUTION_ABORT_CODES.GATEWAY_DEADLINE_EXCEEDED,
        statusCode: 504,
        retryable: false,
      });
      expect(onDeadline).toHaveBeenCalledTimes(1);
      scope.cleanup();
    } finally {
      vi.useRealTimers();
    }
  });

  it("distinguishes a client disconnect from a deadline", () => {
    const transport = createTransport();
    const onClientDisconnect = vi.fn();
    const scope = createHttpRequestExecutionScope({ ...transport, timeoutMs: 10_000, onClientDisconnect });

    transport.requestEmitter.emit("aborted");

    expect(scope.context.signal.reason).toMatchObject({
      code: EXECUTION_ABORT_CODES.CLIENT_DISCONNECTED,
      category: "cancellation",
      retryable: false,
    });
    expect(onClientDisconnect).toHaveBeenCalledTimes(1);
    scope.cleanup();
  });

  it("reconciles a disconnect that happened before lifecycle listeners were registered", () => {
    const transport = createTransport();
    transport.request.aborted = true;
    const onClientDisconnect = vi.fn();

    const scope = createHttpRequestExecutionScope({
      ...transport,
      timeoutMs: 10_000,
      onClientDisconnect,
    });

    expect(scope.context.signal.reason).toMatchObject({
      code: EXECUTION_ABORT_CODES.CLIENT_DISCONNECTED,
      details: { phase: "request-aborted" },
    });
    expect(onClientDisconnect).toHaveBeenCalledOnce();
    scope.cleanup();
  });

  it("reconciles an already-destroyed response before starting execution", () => {
    const transport = createTransport();
    transport.response.destroyed = true;
    const onClientDisconnect = vi.fn();

    const scope = createHttpRequestExecutionScope({
      ...transport,
      timeoutMs: 10_000,
      onClientDisconnect,
    });

    expect(scope.context.signal.reason).toMatchObject({
      code: EXECUTION_ABORT_CODES.CLIENT_DISCONNECTED,
      details: { phase: "response-closed" },
    });
    expect(onClientDisconnect).toHaveBeenCalledOnce();
    scope.cleanup();
  });

  it("cleans up a normally finished response without aborting it", () => {
    vi.useFakeTimers();
    try {
      const transport = createTransport();
      const scope = createHttpRequestExecutionScope({ ...transport, timeoutMs: 250 });
      transport.responseEmitter.writableFinished = true;
      transport.responseEmitter.emit("finish");
      vi.advanceTimersByTime(500);
      expect(scope.context.signal.aborted).toBe(false);
    } finally {
      vi.useRealTimers();
    }
  });

  it("binds the same execution context to unary and streaming calls", async () => {
    const transport = createTransport();
    const scope = createHttpRequestExecutionScope({ ...transport, timeoutMs: 10_000 });
    const execute = vi.fn(async (_input: unknown, execution?: unknown) => execution);
    const executeStream = vi.fn(async function* (_input: unknown, execution?: unknown) { yield execution; });
    const bound = bindGatewayExecution({ execute, executeStream }, scope.context);

    expect(await bound.execute({})).toBe(scope.context);
    const events: unknown[] = [];
    for await (const event of bound.executeStream({})) events.push(event);
    expect(events).toEqual([scope.context]);
    scope.cleanup();
  });

  it("hashes the request idempotency key and assigns stable per-request invocation lanes", async () => {
    const transport = createTransport();
    transport.request.headers = {
      "idempotency-key": "operator-attempt-1",
      "x-request-id": "transport-request-1",
      "x-trace-id": "transport-trace-1",
    };
    transport.request.url = "/v1/chat/completions?ignored=true";
    const scope = createHttpRequestExecutionScope({ ...transport, timeoutMs: 10_000 });
    expect(scope.context).toMatchObject({
      providerDispatchKeyHash: createHash("sha256")
        .update("operator-attempt-1")
        .digest("hex"),
      providerDispatchRoute: "/v1/chat/completions",
      transportRequestId: "transport-request-1",
      transportTraceId: "transport-trace-1",
    });
    expect(JSON.stringify(scope.context)).not.toContain("operator-attempt-1");

    const execute = vi.fn(async (_input: unknown, execution?: unknown) => execution);
    const executeProviderOperation = vi.fn(async (_input: unknown, execution?: unknown) => execution);
    const bound = bindGatewayExecution({ execute, executeProviderOperation }, scope.context);
    await expect(bound.execute({})).resolves.toMatchObject({ providerDispatchInvocation: 1 });
    await expect(bound.execute({})).resolves.toMatchObject({ providerDispatchInvocation: 2 });
    await expect(bound.executeProviderOperation({})).resolves.toMatchObject({
      providerDispatchInvocation: 3,
    });
    scope.cleanup();
  });

  it("combines a route-owned execution signal with the outer HTTP lifecycle signal", async () => {
    const transport = createTransport();
    const scope = createHttpRequestExecutionScope({ ...transport, timeoutMs: 10_000 });
    const routeController = new AbortController();
    let receivedSignal: AbortSignal | undefined;
    const execute = vi.fn(async (_input: unknown, execution?: { signal?: AbortSignal }) => {
      receivedSignal = execution?.signal;
      await new Promise((resolve, reject) => {
        if (receivedSignal?.aborted) return reject(receivedSignal.reason);
        receivedSignal?.addEventListener("abort", () => reject(receivedSignal?.reason), { once: true });
      });
    });
    const bound = bindGatewayExecution({ execute }, scope.context);
    const running = bound.execute({}, { signal: routeController.signal });
    await vi.waitFor(() => expect(receivedSignal).toBeDefined());

    routeController.abort(Object.assign(new Error("route deadline"), { code: "ROUTE_DEADLINE" }));
    await expect(running).rejects.toMatchObject({ code: "ROUTE_DEADLINE" });
    expect(receivedSignal).not.toBe(scope.context.signal);
    expect(receivedSignal?.aborted).toBe(true);
    scope.cleanup();
  });

  it("keeps the inner abort signal linked until a bound async generator finishes", async () => {
    const transport = createTransport();
    const scope = createHttpRequestExecutionScope({ ...transport, timeoutMs: 10_000 });
    const inner = new AbortController();
    const remove = vi.spyOn(inner.signal, "removeEventListener");
    const service = { async *executeStream(_input: unknown, execution?: { signal?: AbortSignal }) {
      yield "started";
      execution?.signal?.throwIfAborted();
      yield "unwanted";
    } };
    try {
      const iterator = bindGatewayExecution(service, scope.context).executeStream({}, { signal: inner.signal });
      expect(await iterator.next()).toEqual({ done: false, value: "started" });
      expect(remove).not.toHaveBeenCalled();
      const reason = new Error("synthetic route cancellation");
      inner.abort(reason);
      await expect(iterator.next()).rejects.toBe(reason);
      expect(remove).toHaveBeenCalledOnce();
    } finally { scope.cleanup(); }
  });

  it("disposes linked signals when a consumer returns before the first generator step", async () => {
    const transport = createTransport();
    const scope = createHttpRequestExecutionScope({ ...transport, timeoutMs: 10_000 });
    const inner = new AbortController();
    const remove = vi.spyOn(inner.signal, "removeEventListener");
    const entered = vi.fn();
    const service = { async *executeStream(_input: unknown, _execution?: { signal?: AbortSignal }) { entered(); yield "unused"; } };
    try {
      const iterator = bindGatewayExecution(service, scope.context).executeStream({}, { signal: inner.signal });
      expect(remove).not.toHaveBeenCalled();
      await iterator.return(undefined);
      expect(entered).not.toHaveBeenCalled();
      expect(remove).toHaveBeenCalledOnce();
    } finally { scope.cleanup(); }
  });

  it.each(["return", "throw"] as const)("retains cancellation when %s yields an unfinished cleanup step", async operation => {
    const transport = createTransport();
    const scope = createHttpRequestExecutionScope({ ...transport, timeoutMs: 10_000 });
    const inner = new AbortController();
    const remove = vi.spyOn(inner.signal, "removeEventListener");
    const service = { async *executeStream(_input: unknown, execution?: { signal?: AbortSignal }) {
      try { yield "started"; }
      finally { yield "cleanup"; execution?.signal?.throwIfAborted(); }
    } };
    try {
      const iterator = bindGatewayExecution(service, scope.context).executeStream({}, { signal: inner.signal });
      await iterator.next();
      const step = operation === "return" ? await iterator.return(undefined) : await iterator.throw(new Error("synthetic consumer throw"));
      expect(step).toEqual({ done: false, value: "cleanup" });
      expect(remove).not.toHaveBeenCalled();
      const reason = new Error("synthetic cleanup cancellation"); inner.abort(reason);
      await expect(iterator.next()).rejects.toBe(reason);
      expect(remove).toHaveBeenCalledOnce();
    } finally { scope.cleanup(); }
  });

  it("marks malformed idempotency headers without retaining their values", () => {
    const transport = createTransport();
    transport.request.headers = { "idempotency-key": "contains space" };
    transport.request.url = "/chat";
    const scope = createHttpRequestExecutionScope({ ...transport, timeoutMs: 10_000 });
    expect(scope.context).toMatchObject({
      providerDispatchKeyInvalid: true,
      providerDispatchRoute: "/chat",
    });
    expect(scope.context).not.toHaveProperty("providerDispatchKeyHash");
    scope.cleanup();
  });

  it("accepts a provider-only dispatch key without retaining its raw value", () => {
    const transport = createTransport();
    transport.request.headers = { "provider-dispatch-key": "provider-operation-1" };
    transport.request.url = "/v1/images/generations";
    const scope = createHttpRequestExecutionScope({ ...transport, timeoutMs: 10_000 });

    expect(scope.context).toMatchObject({
      providerDispatchKeyHash: createHash("sha256")
        .update("provider-operation-1")
        .digest("hex"),
      providerDispatchRoute: "/v1/images/generations",
    });
    expect(JSON.stringify(scope.context)).not.toContain("provider-operation-1");
    scope.cleanup();
  });

  it("rejects ambiguous standard and provider-only dispatch headers", () => {
    const transport = createTransport();
    transport.request.headers = {
      "idempotency-key": "response-replay-key",
      "provider-dispatch-key": "provider-only-key",
    };
    const scope = createHttpRequestExecutionScope({ ...transport, timeoutMs: 10_000 });

    expect(scope.context).toMatchObject({ providerDispatchKeyInvalid: true });
    expect(scope.context).not.toHaveProperty("providerDispatchKeyHash");
    scope.cleanup();
  });

  it("stamps the server identity onto gateway inputs and strips client spoofing", async () => {
    const transport = createTransport();
    const scope = createHttpRequestExecutionScope({ ...transport, timeoutMs: 10_000 });
    const identity = { tenantId: "tenant-a", role: "operator" };
    const seen: unknown[] = [];
    const execute = vi.fn(async (input: unknown) => {
      seen.push(input);
      return input;
    });
    const bound = bindGatewayExecution({ execute }, scope.context, () => identity);

    const spoofed = { messages: [], enterpriseIdentity: { tenantId: "attacker" } };
    await bound.execute(spoofed);
    expect(seen[0]).toMatchObject({ enterpriseIdentity: { tenantId: "tenant-a" } });
    expect((seen[0] as Record<string, unknown>).enterpriseIdentity).toBe(identity);

    const anonymous = bindGatewayExecution({ execute }, scope.context);
    await anonymous.execute({ messages: [], enterpriseIdentity: { tenantId: "attacker" } });
    expect(seen[1]).not.toHaveProperty("enterpriseIdentity");

    const frozenSpoof = Object.freeze({
      messages: Object.freeze([]),
      enterpriseIdentity: Object.freeze({ tenantId: "frozen-attacker" }),
    });
    await bound.execute(frozenSpoof);
    expect(seen[2]).toMatchObject({ enterpriseIdentity: { tenantId: "tenant-a" } });
    expect(seen[2]).not.toBe(frozenSpoof);
    expect(frozenSpoof.enterpriseIdentity.tenantId).toBe("frozen-attacker");
    await anonymous.execute(frozenSpoof);
    expect(seen[3]).not.toHaveProperty("enterpriseIdentity");
    scope.cleanup();
  });
});
