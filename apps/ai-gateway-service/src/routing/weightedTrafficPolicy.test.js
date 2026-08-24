import { describe, expect, it, vi } from "vitest";
import { createWeightedTrafficPolicy } from "./weightedTrafficPolicy.js";
import { GatewayService } from "../core/gatewayService.js";
import { ProviderRegistry } from "../providers/providerRegistry.js";
import { createFakeProvider } from "../providers/fakeProvider.js";

function buildRegistry() {
  const registry = new ProviderRegistry();
  for (const providerId of ["primary-fake", "canary-fake", "shadow-fake"]) {
    registry.register(createFakeProvider({
      providerId,
      modelId: "local-fake-model",
      providerType: "fake",
      capabilities: ["chat"],
      enabled: true,
      fixedLatencyMs: 1,
    }));
  }
  return registry;
}

describe("weightedTrafficPolicy config", () => {
  it("is disabled without config and fail-closed on bad config", () => {
    expect(createWeightedTrafficPolicy({ env: {} }).enabled).toBe(false);
    const broken = createWeightedTrafficPolicy({ env: { AI_GATEWAY_WEIGHTED_ROUTES_JSON: "{oops" } });
    expect(broken.enabled).toBe(false);
    expect(broken.configError).toContain("not valid JSON");
    expect(createWeightedTrafficPolicy({
      env: { AI_GATEWAY_WEIGHTED_ROUTES_JSON: JSON.stringify([{ weights: { a: -1 } }]) },
    }).configError).toBeTruthy();
  });

  it("splits traffic by weight with a deterministic random source", () => {
    const policy = createWeightedTrafficPolicy({
      env: { AI_GATEWAY_WEIGHTED_ROUTES_JSON: JSON.stringify([{ weights: { a: 90, b: 10 } }] ) },
      random: () => 0.05,
    });
    expect(policy.apply({ model: "m" }).overrideProviderId).toBe("a");
    const policyB = createWeightedTrafficPolicy({
      env: { AI_GATEWAY_WEIGHTED_ROUTES_JSON: JSON.stringify([{ weights: { a: 90, b: 10 } }] ) },
      random: () => 0.95,
    });
    expect(policyB.apply({ model: "m" }).overrideProviderId).toBe("b");
  });

  it("respects match filters and shadow sampling", () => {
    const policy = createWeightedTrafficPolicy({
      env: {
        AI_GATEWAY_WEIGHTED_ROUTES_JSON: JSON.stringify([{
          name: "canary",
          match: { model: "gpt-x" },
          weights: { a: 100 },
          shadow: { providerId: "shadow-fake", percent: 100 },
        }]),
      },
      random: () => 0.5,
    });
    expect(policy.apply({ model: "other" })).toBeNull();
    expect(policy.apply({ model: "gpt-x" }).routeName).toBe("canary");
    expect(policy.shouldShadow({ model: "gpt-x" }).providerId).toBe("shadow-fake");
    expect(policy.shouldShadow({ model: "other" })).toBeNull();

    const never = createWeightedTrafficPolicy({
      env: {
        AI_GATEWAY_WEIGHTED_ROUTES_JSON: JSON.stringify([{
          weights: { a: 100 },
          shadow: { providerId: "shadow-fake", percent: 0 },
        }]),
      },
      random: () => 0.0001,
    });
    expect(never.shouldShadow({ model: "m" })).toBeNull();
  });
});

describe("GatewayService weighted + shadow integration", () => {
  it("overrides the provider and records fake shadow usage separately", async () => {
    const registry = buildRegistry();
    const entries = [];
    const policy = createWeightedTrafficPolicy({
      env: {
        AI_GATEWAY_WEIGHTED_ROUTES_JSON: JSON.stringify([{
          name: "route-to-canary",
          weights: { "canary-fake": 100 },
          shadow: { providerId: "shadow-fake", percent: 100 },
        }]),
      },
      random: () => 0.5,
    });
    const service = new GatewayService({
      providerRegistry: registry,
      runtimeConfig: { providerMode: "fake", realProviderEnabled: false, fallbackEnabled: false },
      requestLogger: { log: (entry) => entries.push(entry) },
      weightedTrafficPolicy: policy,
    });

    const result = await service.execute({ messages: [{ role: "user", content: "route me" }] });
    expect(result.success).toBe(true);
    // 主请求走了加权覆写后的 provider。
    expect(result.data?.selectedProvider).toBe("canary-fake");
    // 影子旁路 fire-and-forget:等待微任务队列清空。
    await new Promise((resolve) => setTimeout(resolve, 30));
    const successful = entries.filter((entry) => entry.statusCode === 200);
    expect(successful).toHaveLength(2);
    expect(successful.find((entry) => !entry.shadow)?.provider).toBe("canary-fake");
    expect(successful.find((entry) => entry.shadow)).toEqual(expect.objectContaining({
      provider: "shadow-fake",
      path: "/v1/chat/completions:shadow",
      providerCallAttempted: true,
      billable: false,
      estimatedCostUsd: 0,
      costSource: "non-billable-fake",
      costEstimateAvailable: true,
    }));
  });

  it("requires a separate opt-in before invoking a real shadow provider", async () => {
    const registry = buildRegistry();
    const realShadow = createFakeProvider({
      providerId: "real-shadow",
      modelId: "shadow-model",
      providerType: "openai",
      capabilities: ["chat"],
      enabled: true,
    });
    const generate = vi.spyOn(realShadow, "generate");
    registry.register(realShadow);
    const policy = createWeightedTrafficPolicy({
      env: {
        AI_GATEWAY_WEIGHTED_ROUTES_JSON: JSON.stringify([{
          weights: { "canary-fake": 100 },
          shadow: { providerId: "real-shadow", percent: 100 },
        }]),
      },
      random: () => 0.5,
    });
    const blockedEntries = [];
    const service = new GatewayService({
      providerRegistry: registry,
      runtimeConfig: {
        providerMode: "real",
        realProviderEnabled: true,
        enabledProviders: ["canary-fake", "real-shadow"],
        shadowRealProviderEnabled: false,
        fallbackEnabled: false,
      },
      requestLogger: { assertDurable: () => true, log: (entry) => blockedEntries.push(entry) },
      weightedTrafficPolicy: policy,
    });

    expect((await service.execute({ messages: [{ role: "user", content: "route me" }] })).success).toBe(true);
    await new Promise((resolve) => setTimeout(resolve, 30));
    expect(generate).not.toHaveBeenCalled();
    expect(blockedEntries.find((entry) => entry.shadow)).toEqual(expect.objectContaining({
      provider: "real-shadow",
      usageEventType: "attempt-failed",
      providerCallAttempted: false,
      billable: false,
      estimatedCostUsd: 0,
      costSource: "not-attempted",
      costEstimateAvailable: true,
    }));

    const entries = [];
    const explicitlyEnabled = new GatewayService({
      providerRegistry: registry,
      runtimeConfig: {
        providerMode: "real",
        realProviderEnabled: true,
        enabledProviders: ["canary-fake", "real-shadow"],
        shadowRealProviderEnabled: true,
        fallbackEnabled: false,
      },
      requestLogger: { assertDurable: () => true, log: (entry) => entries.push(entry) },
      weightedTrafficPolicy: policy,
    });
    expect((await explicitlyEnabled.execute({ messages: [{ role: "user", content: "route me again" }] })).success).toBe(true);
    await new Promise((resolve) => setTimeout(resolve, 30));
    expect(generate).toHaveBeenCalledOnce();
    expect(entries.find((entry) => entry.shadow && entry.usageEventType === "attempt-completed"))
      .toEqual(expect.objectContaining({
      provider: "real-shadow",
      providerCallAttempted: true,
      billable: true,
      costSource: "static-fallback-estimate",
      costEstimateAvailable: true,
      }));
  });
});
