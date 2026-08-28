import { describe, expect, it } from "vitest";

import {
  assertProviderExecutionAllowed,
  getProviderExecutionDecision,
  readProviderExecutionRuntimeConfig,
} from "./providerExecutionGate.js";

describe("provider execution three-gate policy", () => {
  it("always permits fake providers", () => {
    expect(getProviderExecutionDecision({ providerId: "fake", providerType: "fake" }).allowed).toBe(true);
  });

  it("requires mode, global switch, and explicit allowlist for real providers", () => {
    const base = { providerId: "openai", providerType: "openai" };
    expect(getProviderExecutionDecision({
      ...base,
      runtimeConfig: { providerMode: "fake", realProviderEnabled: true, enabledProviders: ["openai"] },
    }).blockers).toContain("provider-mode-not-real-capable");
    expect(getProviderExecutionDecision({
      ...base,
      runtimeConfig: { providerMode: "real", realProviderEnabled: false, enabledProviders: ["openai"] },
    }).blockers).toContain("real-provider-switch-disabled");
    expect(getProviderExecutionDecision({
      ...base,
      runtimeConfig: { providerMode: "real", realProviderEnabled: true, enabledProviders: [] },
    }).blockers).toContain("provider-not-explicitly-allowed");
    expect(getProviderExecutionDecision({
      ...base,
      runtimeConfig: { providerMode: "real", realProviderEnabled: true, enabledProviders: ["openai"] },
    }).allowed).toBe(true);
  });

  it("returns a structured fail-closed error", () => {
    expect(() => assertProviderExecutionAllowed({
      providerId: "openai",
      providerType: "openai",
      runtimeConfig: { providerMode: "fake", realProviderEnabled: false, enabledProviders: ["openai"] },
    })).toThrow(expect.objectContaining({ code: "REAL_PROVIDER_EXECUTION_BLOCKED" }));
  });

  it("requires an additional opt-in for real-provider shadow requests", () => {
    const decision = getProviderExecutionDecision({
      providerId: "openai",
      providerType: "openai",
      shadowRequest: true,
      runtimeConfig: {
        providerMode: "real",
        realProviderEnabled: true,
        enabledProviders: ["openai"],
        shadowRealProviderEnabled: false,
      },
    });
    expect(decision.allowed).toBe(false);
    expect(decision.blockers).toContain("real-provider-shadow-disabled");
  });

  it("reads the separate real-provider shadow switch from the environment", () => {
    expect(readProviderExecutionRuntimeConfig({
      AI_GATEWAY_SHADOW_REAL_PROVIDER_ENABLED: "true",
    }).shadowRealProviderEnabled).toBe(true);
  });
});
