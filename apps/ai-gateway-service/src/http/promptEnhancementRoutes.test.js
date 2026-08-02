import { Readable } from "node:stream";
import { describe, expect, it, vi } from "vitest";
import { ROUTE_NOT_HANDLED } from "./httpRouteDispatch.js";
import { dispatchPromptEnhancementRoutes } from "./promptEnhancementRoutes.js";

describe("prompt enhancement route", () => {
  it("returns a credential-free enhancement preview", async () => {
    const response = createResponseRecorder();
    const writeServiceLog = vi.fn();
    await dispatchPromptEnhancementRoutes({
      request: createJsonRequest({ input: "Plan a product launch" }),
      response,
      startedAt: Date.now(),
      url: new URL("http://127.0.0.1/prompts/enhance"),
      writeServiceLog,
    });

    expect(response.statusCode).toBe(200);
    expect(response.body.status).toBe("ok");
    expect(response.body.data.original).toBe("Plan a product launch");
    expect(response.body.data.profile).toBe("planning");
    expect(response.body.data.metadata.providerCalled).toBe(false);
    expect(writeServiceLog).toHaveBeenCalledWith(
      "prompt_enhancement_completed",
      expect.objectContaining({ providerCalled: false }),
    );
  });

  it("returns a validation envelope for invalid input", async () => {
    const response = createResponseRecorder();
    await dispatchPromptEnhancementRoutes({
      request: createJsonRequest({ input: "" }),
      response,
      startedAt: Date.now(),
      url: new URL("http://127.0.0.1/prompts/enhance"),
      writeServiceLog: vi.fn(),
    });

    expect(response.statusCode).toBe(400);
    expect(response.body.error.code).toBe("PROMPT_ENHANCEMENT_INPUT_REQUIRED");
    expect(response.body.error.category).toBe("validation");
  });

  it("leaves unrelated routes for the next dispatcher", async () => {
    const result = await dispatchPromptEnhancementRoutes({
      request: { method: "GET" },
      url: new URL("http://127.0.0.1/health/check"),
    });
    expect(result).toBe(ROUTE_NOT_HANDLED);
  });
});

function createJsonRequest(body) {
  const request = Readable.from([Buffer.from(JSON.stringify(body))]);
  request.method = "POST";
  return request;
}

function createResponseRecorder() {
  return {
    statusCode: null,
    body: null,
    writeHead(statusCode) {
      this.statusCode = statusCode;
    },
    end(body) {
      this.body = JSON.parse(body);
    },
  };
}
