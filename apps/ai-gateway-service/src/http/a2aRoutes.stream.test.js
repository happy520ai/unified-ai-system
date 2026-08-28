import { EventEmitter } from "node:events";
import { Readable } from "node:stream";
import { describe, expect, it, vi } from "vitest";
import { A2A_JSONRPC_PATH, createA2AGateway } from "./a2aGateway.js";
import { dispatchA2ARoutes } from "./a2aRoutes.js";

function createGatewayWithStream() {
  const gateway = createA2AGateway({
    gatewayService: { execute: vi.fn() },
    env: {},
  });
  gateway.transportHandler.handle = vi.fn(async () => (async function* streamUpdates() {
    yield { jsonrpc: "2.0", id: 1, result: { status: { state: "working" } } };
    yield { jsonrpc: "2.0", id: 1, result: { status: { state: "completed" }, artifacts: [] } };
  })());
  return gateway;
}

function createStreamContext({ gateway, method = "message/stream" }) {
  const request = Readable.from([
    Buffer.from(JSON.stringify({ jsonrpc: "2.0", id: 1, method, params: {} })),
  ]);
  request.method = "POST";
  request.headers = {};
  const response = new EventEmitter();
  response.statusCode = null;
  response.headers = {};
  response.text = "";
  response.writableEnded = false;
  response.destroyed = false;
  response.headersSent = false;
  response.writeHead = (statusCode, headers = {}) => {
    response.statusCode = statusCode;
    response.headers = headers;
    response.headersSent = true;
  };
  response.write = (chunk) => {
    response.text += String(chunk);
    return true;
  };
  response.end = () => {
    response.writableEnded = true;
  };
  return {
    a2aGateway: gateway,
    request,
    response,
    startedAt: Date.now(),
    url: new URL(`http://127.0.0.1${A2A_JSONRPC_PATH}`),
    writeServiceLog: vi.fn(),
  };
}

describe("A2A streaming route", () => {
  it("streams JSON-RPC updates as SSE data events instead of 501", async () => {
    const gateway = createGatewayWithStream();
    const context = createStreamContext({ gateway });
    await dispatchA2ARoutes(context);

    expect(context.response.statusCode).toBe(200);
    expect(context.response.headers["content-type"]).toContain("text/event-stream");
    const frames = context.response.text
      .split("\n\n")
      .filter((frame) => frame.trim().length > 0)
      .map((frame) => JSON.parse(frame.replace(/^data: /, "")));
    expect(frames).toHaveLength(2);
    expect(frames[0].result.status.state).toBe("working");
    expect(frames[1].result.status.state).toBe("completed");
    expect(context.response.writableEnded).toBe(true);
  });

  it("still answers non-stream JSON-RPC calls with a single JSON body", async () => {
    const gateway = createA2AGateway({
      gatewayService: { execute: vi.fn() },
      env: {},
    });
    const context = createStreamContext({ gateway, method: "message/ping" });
    await dispatchA2ARoutes(context);
    expect(context.response.statusCode).not.toBe(501);
  });
});
