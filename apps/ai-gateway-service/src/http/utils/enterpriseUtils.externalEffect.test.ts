import { describe, expect, it, vi } from "vitest";

import { writeCapabilityError } from "./enterpriseUtils.js";

describe("capability error transport", () => {
  it("preserves explicit external-effect status and retryability", () => {
    const writeHead = vi.fn();
    const end = vi.fn();
    const response = {
      writableEnded: false,
      destroyed: false,
      headersSent: false,
      writeHead,
      end,
    };
    const error = Object.assign(new Error("The reservation store is unavailable."), {
      code: "EXTERNAL_EFFECT_STORE_UNAVAILABLE",
      statusCode: 503,
      category: "persistence",
      retryable: true,
    });

    writeCapabilityError({
      response,
      error,
      startedAt: Date.now(),
      fallbackCode: "connector_send_failed",
    });

    expect(writeHead).toHaveBeenCalledWith(503, expect.any(Object));
    const payload = JSON.parse(end.mock.calls[0]?.[0]);
    expect(payload).toMatchObject({
      status: "error",
      error: {
        code: "EXTERNAL_EFFECT_STORE_UNAVAILABLE",
        category: "persistence",
        retryable: true,
      },
    });
  });

  it("maps capability auth denials to 403", () => {
    const writeHead = vi.fn();
    const end = vi.fn();
    writeCapabilityError({
      response: {
        writableEnded: false,
        destroyed: false,
        headersSent: false,
        writeHead,
        end,
      },
      error: Object.assign(new Error("Denied."), { code: "MCP_UPSTREAM_NOT_ALLOWED", category: "auth" }),
      startedAt: Date.now(),
      fallbackCode: "mcp_call_failed",
    });
    expect(writeHead).toHaveBeenCalledWith(403, expect.any(Object));
  });
});
