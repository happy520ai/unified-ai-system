import { describe, expect, it } from "vitest";

import { resolveOpenAiErrorStatus } from "./openAiCompatibilityRoutes.js";
import { resolveProviderDispatchHttpStatus } from "./providerDispatchHttpStatus.ts";
import { resolveChatResultHttpStatus } from "./routes/chatRoutes.js";

describe("provider dispatch HTTP status mapping", () => {
  it.each([
    ["PROVIDER_DISPATCH_KEY_REQUIRED", 400],
    ["PROVIDER_DISPATCH_KEY_INVALID", 400],
    ["PROVIDER_DISPATCH_INPUT_INVALID", 400],
    ["PROVIDER_DISPATCH_ALREADY_RESERVED", 409],
    ["PROVIDER_DISPATCH_KEY_REUSED", 409],
    ["PROVIDER_DISPATCH_RESERVATION_UNCONFIRMED", 409],
    ["PROVIDER_DISPATCH_STORE_UNAVAILABLE", 503],
    ["PROVIDER_DISPATCH_CAPACITY_REACHED", 503],
    ["PROVIDER_DISPATCH_GATE_UNAVAILABLE", 503],
  ])("maps %s to %i across native and compatibility protocols", (code, status) => {
    expect(resolveProviderDispatchHttpStatus(code)).toBe(status);
    expect(resolveChatResultHttpStatus({ success: false, code, error: { code } })).toBe(status);
    expect(resolveOpenAiErrorStatus({ code })).toBe(status);
  });

  it("does not claim unrelated gateway errors", () => {
    expect(resolveProviderDispatchHttpStatus("PROVIDER_TIMEOUT")).toBeNull();
  });
});
