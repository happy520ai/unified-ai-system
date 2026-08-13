import { describe, expect, it } from "vitest";
import { resolveChatResultHttpStatus } from "./chatRoutes.js";

describe("resolveChatResultHttpStatus", () => {
  it("returns 200 for successful gateway results", () => {
    expect(resolveChatResultHttpStatus({ success: true })).toBe(200);
  });

  it("preserves 400 for non-retryable request failures", () => {
    expect(resolveChatResultHttpStatus({
      success: false,
      code: "MODEL_ACCESS_DENIED",
      error: { retryable: false, type: "validation" },
    })).toBe(400);
  });

  it("maps retryable provider failures to 502", () => {
    expect(resolveChatResultHttpStatus({
      success: false,
      code: "FAKE_PROVIDER_RETRYABLE_FAILURE",
      error: { retryable: true, type: "fake" },
    })).toBe(502);
  });

  it("maps unavailable circuits and providers to 503", () => {
    expect(resolveChatResultHttpStatus({ success: false, code: "CIRCUIT_OPEN" })).toBe(503);
    expect(resolveChatResultHttpStatus({ success: false, code: "PROVIDER_UNAVAILABLE" })).toBe(503);
  });

  it("maps upstream timeouts to 504", () => {
    expect(resolveChatResultHttpStatus({ success: false, code: "PROVIDER_TIMEOUT" })).toBe(504);
  });
});
