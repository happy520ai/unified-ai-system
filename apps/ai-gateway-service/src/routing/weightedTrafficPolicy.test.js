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
  it("overrides the provider via a weighted rule and shadows without double-billing", async () => {
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
    // 用量台账只记主请求一次(影子不重复计费)。
    expect(entries.filter((entry) => entry.statusCode === 200)).toHaveLength(1);
    expect(entries[0].provider).toBe("canary-fake");
  });
});
