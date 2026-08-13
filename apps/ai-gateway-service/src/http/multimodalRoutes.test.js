import { EventEmitter } from "node:events";
import { Readable } from "node:stream";
import { describe, expect, it, vi } from "vitest";
import { ROUTE_NOT_HANDLED } from "./httpRouteDispatch.js";
import { dispatchMultimodalRoutes, isMultimodalRoute } from "./multimodalRoutes.js";

describe("multimodal route dispatcher", () => {
  it("normalizes trailing slashes for multimodal route matching", () => {
    expect(isMultimodalRoute("/v1/images/generations")).toBe(true);
    expect(isMultimodalRoute("/v1/images/generations/")).toBe(true);
    expect(isMultimodalRoute("/v1/audio/transcriptions/")).toBe(true);
    expect(isMultimodalRoute("/chat/completions")).toBe(false);
  });

  it("dispatches image generation requests to the adapter", async () => {
    const response = createResponseRecorder();
    const multimodalAdapter = {
      generateImage: vi.fn(async () => ({
        data: {
          provider: "openai",
          model: "dall-e-3",
          usage: { images: 2 },
        },
      })),
    };

    const result = await dispatchMultimodalRoutes(createContext({
      path: "/v1/images/generations",
      body: { prompt: "A red sunset over a lake" },
      response,
      multimodalAdapter,
    }));

    expect(result).toBe(true);
    expect(multimodalAdapter.generateImage).toHaveBeenCalledTimes(1);
    expect(response.statusCode).toBe(200);
    expect(response.body).toEqual(expect.objectContaining({
      status: "ok",
      data: expect.objectContaining({ provider: "openai", model: "dall-e-3" }),
    }));
  });

  it("dispatches embedding requests and validates input before calling adapter", async () => {
    const response = createResponseRecorder();
    const multimodalAdapter = {
      generateEmbedding: vi.fn(async () => ({
        data: { data: [{ object: "embedding", embedding: [0.1, 0.2] }] },
      })),
    };

    const result = await dispatchMultimodalRoutes(createContext({
      path: "/embeddings",
      body: { input: ["hello"] },
      response,
      multimodalAdapter,
    }));

    expect(result).toBe(true);
    expect(multimodalAdapter.generateEmbedding).toHaveBeenCalledTimes(1);
    expect(response.statusCode).toBe(200);
    expect(response.body).toEqual(expect.objectContaining({
      status: "ok",
      data: expect.objectContaining({
        data: [expect.objectContaining({ object: "embedding" })],
      }),
    }));
  });

  it("returns 405 for unsupported methods on multimodal routes", async () => {
    const response = createResponseRecorder();
    await dispatchMultimodalRoutes(createContext({
      method: "GET",
      path: "/v1/audio/speech",
      response,
    }));

    expect(response.statusCode).toBe(405);
    expect(response.body?.error?.code).toBe("multimodal_method_not_allowed");
  });

  it("forwards unknown routes to later dispatchers", async () => {
    const result = await dispatchMultimodalRoutes(createContext({
      path: "/v1/unknown-route",
      response: createResponseRecorder(),
    }));

    expect(result).toBe(ROUTE_NOT_HANDLED);
  });
});

function createContext({
  body,
  multimodalAdapter,
  method = "POST",
  path,
  response = createResponseRecorder(),
}) {
  return {
    request: createJsonRequest(body, method),
    response,
    startedAt: Date.now(),
    url: new URL(`http://127.0.0.1${path}`),
    multimodalAdapter,
    writeServiceLog: vi.fn(),
  };
}

function createJsonRequest(body, method) {
  const chunks = body === undefined ? [] : [Buffer.from(JSON.stringify(body))];
  const request = Readable.from(chunks);
  request.method = method;
  return request;
}

function createResponseRecorder() {
  const response = new EventEmitter();
  response.statusCode = null;
  response.headers = {};
  response.body = null;
  response.text = "";
  response.writableEnded = false;
  response.destroyed = false;
  response.headersSent = false;
  response.writeHead = (statusCode, headers = {}) => {
    response.statusCode = statusCode;
    response.headers = headers;
    response.headersSent = true;
  };
  response.flushHeaders = () => {};
  response.write = (chunk) => {
    response.text += String(chunk);
    return true;
  };
  response.end = (body) => {
    if (body !== undefined) {
      response.text += String(body);
      try {
        response.body = JSON.parse(String(body));
      } catch {
        response.body = String(body);
      }
    }
    response.writableEnded = true;
  };
  return response;
}
