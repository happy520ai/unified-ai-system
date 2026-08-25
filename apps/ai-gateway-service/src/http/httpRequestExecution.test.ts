import { EventEmitter } from "node:events";
import { createHash } from "node:crypto";
import type { IncomingMessage, ServerResponse } from "node:http";
import { describe, expect, it, vi } from "vitest";
import { EXECUTION_ABORT_CODES } from "@unified-ai-system/shared-utils";
import { bindGatewayExecution, createHttpRequestExecutionScope } from "./httpRequestExecution.ts";

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
    scope.cleanup();
  });
});
