import { describe, expect, it, vi } from "vitest";
import {
  discardRawJsonRequestBody,
  takeRawJsonRequestBody,
  readJson,
  writeHtml,
  writeJson,
  writeSseEvent,
  writeSseHeaders,
} from "./responseUtils.js";

function createResponse(overrides = {}) {
  return {
    destroyed: false,
    headersSent: false,
    writableEnded: false,
    end: vi.fn(),
    flushHeaders: vi.fn(),
    write: vi.fn(),
    writeHead: vi.fn(),
    ...overrides,
  };
}

describe("response writers", () => {
  it("retains only a defensive copy of exact JSON bytes for request-bound proof checks", async () => {
    const exact = Buffer.from('{"clientId":"fixture.client", "healthStatus":"healthy"}', "utf8");
    const request = {
      headers: { "x-ai-gateway-local-client-proof": "fixture" },
      async *[Symbol.asyncIterator]() {
        yield exact.subarray(0, 17);
        yield exact.subarray(17);
      },
    };

    await expect(readJson(request)).resolves.toEqual({
      clientId: "fixture.client",
      healthStatus: "healthy",
    });
    const first = takeRawJsonRequestBody(request);
    expect(first).toEqual(exact);
    first.fill(0);
    expect(takeRawJsonRequestBody(request)).toBeNull();
    expect(takeRawJsonRequestBody({ body: { clientId: "parsed-only" } })).toBeNull();

    const discardedRequest = {
      headers: { "x-ai-gateway-local-client-proof": "malformed" },
      async *[Symbol.asyncIterator]() { yield exact; },
    };
    await readJson(discardedRequest);
    discardRawJsonRequestBody(discardedRequest);
    expect(takeRawJsonRequestBody(discardedRequest)).toBeNull();
  });

  it("does not write after a response has ended", () => {
    const response = createResponse({ writableEnded: true });

    expect(writeJson(response, 200, {})).toBe(false);
    expect(writeHtml(response, 200, "ok")).toBe(false);
    expect(writeSseHeaders(response)).toBe(false);
    expect(writeSseEvent(response, "done", {})).toBe(false);
    expect(response.writeHead).not.toHaveBeenCalled();
    expect(response.write).not.toHaveBeenCalled();
    expect(response.end).not.toHaveBeenCalled();
  });

  it("writes a complete SSE event on an open response", () => {
    const response = createResponse();

    expect(writeSseHeaders(response)).toBe(true);
    expect(writeSseEvent(response, "message", { text: "ok" })).toBe(true);
    expect(response.writeHead).toHaveBeenCalledOnce();
    expect(response.flushHeaders).toHaveBeenCalledOnce();
    expect(response.write).toHaveBeenCalledWith(
      'event: message\ndata: {"text":"ok"}\n\n',
    );
  });
});
