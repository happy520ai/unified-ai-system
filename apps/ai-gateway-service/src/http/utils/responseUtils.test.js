import { describe, expect, it, vi } from "vitest";
import {
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
