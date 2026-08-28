import { describe, expect, it, vi } from "vitest";

import {
  createLocalClientProviderRuntimeRouter,
  type ProviderObservationSnapshot,
} from "./localClientProviderRuntimeRouter.ts";

function descriptor(overrides: Record<string, unknown> = {}) {
  return {
    id: "provider-alpha",
    metadata: { routingRegion: "cn-east", runtimeAvailable: true },
    models: [{
      id: "model-fast",
      enabled: true,
      capabilities: ["chat", "reasoning"],
      costTier: "low",
      metadata: {
        routingRegion: "cn-east",
        routingCostUsd: 0.05,
        routingQuotaRemaining: 0.8,
      },
    }],
    ...overrides,
  };
}

function request(overrides: Record<string, unknown> = {}) {
  return {
    tenantId: "tenant-a",
    subjectId: "operator-a",
    clientId: "desktop-agent",
    requiredCapabilities: ["reasoning"],
    requestedFanout: 1,
    fusionRequested: false,
    ...overrides,
  };
}

function verifiedClient(clientId = "desktop-agent") {
  return {
    descriptorVersion: "verified-local-client-adapter-target-v1",
    clientId,
    revision: 2,
    state: "verified",
    trustDecision: "verified",
    adapter: { id: "loopback.adapter", type: "loopback-http", version: "1.0.0" },
    capabilityIds: ["local_application"],
  };
}

function harness({
  descriptors = [descriptor(), descriptor({
    id: "provider-beta",
    metadata: { routingRegion: "cn-east", runtimeAvailable: true },
    models: [{
      id: "model-accurate",
      enabled: true,
      capabilities: ["chat", "reasoning"],
      costTier: "medium",
      metadata: {
        routingRegion: "cn-east",
        routingCostUsd: 0.2,
        routingQuotaRemaining: 0.9,
      },
    }],
  })],
  observations = {
    "provider-alpha": { sampleCount: 20, successRate: 0.95, p50LatencyMs: 300 },
    "provider-beta": { sampleCount: 20, successRate: 0.9, p50LatencyMs: 800 },
  } as Record<string, ProviderObservationSnapshot>,
} = {}) {
  const resolvePolicy = vi.fn(async () => ({
    policyRevision: "tenant-policy-r7",
    policy: {
      dataClass: "internal" as const,
      allowedProviders: ["provider-alpha", "provider-beta"],
      allowedRegions: ["cn-east"],
      maxFanout: 1,
      maxCostUsd: 0.1,
      minHealthScore: 0.6,
      minQuotaRemaining: 0.1,
      preferFree: false,
    },
  }));
  const authorizeClient = vi.fn(async ({ clientId }) => verifiedClient(clientId));
  const router = createLocalClientProviderRuntimeRouter({
    providerRegistry: { listDescriptors: () => descriptors },
    healthFacts: {
      getScore: (providerId) => providerId === "provider-alpha" ? 92 : 88,
      getSnapshot: (providerId) => observations[providerId] ?? {
        sampleCount: 0,
        successRate: null,
        p50LatencyMs: null,
      },
    },
    resolvePolicy,
    authorizeClient,
  });
  return { router, resolvePolicy, authorizeClient };
}

describe("local-client provider runtime router", () => {
  it("routes only trusted provider inventory through a server-resolved client policy", async () => {
    const setup = harness();
    const result = await setup.router.route(request());

    expect(setup.resolvePolicy).toHaveBeenCalledWith({
      identity: { tenantId: "tenant-a", subjectId: "operator-a" },
      clientId: "desktop-agent",
    });
    expect(result).toMatchObject({
      runtimeRouterVersion: "local-client-provider-runtime-router-v1",
      clientRevision: 2,
      policyRevision: "tenant-policy-r7",
      dispatchPerformed: false,
      inventory: {
        providerCount: 2,
        modelCount: 2,
        observedModelCount: 2,
        unknownRegionCount: 0,
        unknownCostCount: 0,
        unknownQuotaCount: 0,
      },
      decision: {
        selected: [{ provider: "provider-alpha", model: "model-fast" }],
      },
      boundaries: {
        verifiedClientRequired: true,
        candidatesFromTrustedRegistry: true,
        policyFromTrustedResolver: true,
        requestSuppliedFactsDenied: true,
        clientRevisionBound: true,
        dispatchPerformed: false,
      },
    });
    const beta = result.decision.evaluations.find((item) => item.candidate.provider === "provider-beta");
    expect(beta?.rejectionReasons.map((reason) => reason.code)).toContain("cost_exceeds_limit");
  });

  it("rejects request-supplied candidate facts or policy authority before resolution", async () => {
    const setup = harness();
    await expect(setup.router.route(request({
      policy: { dataClass: "public" },
      candidates: [{ provider: "attacker", health: 1, costUsd: 0 }],
    }) as never)).rejects.toMatchObject({
      code: "LOCAL_CLIENT_PROVIDER_RUNTIME_REQUEST_INVALID",
      statusCode: 400,
    });
    expect(setup.resolvePolicy).not.toHaveBeenCalled();
  });

  it("requires a current verified local client before revealing policy or provider inventory", async () => {
    const listDescriptors = vi.fn(() => [descriptor()]);
    const resolvePolicy = vi.fn(async () => ({
      policyRevision: "must-not-resolve",
      policy: { dataClass: "public" as const },
    }));
    const router = createLocalClientProviderRuntimeRouter({
      providerRegistry: { listDescriptors },
      healthFacts: { getScore: () => 50 },
      resolvePolicy,
      authorizeClient: async ({ clientId }) => ({
        ...verifiedClient(clientId),
        state: "declared",
        trustDecision: "declared",
      }),
    });
    await expect(router.route(request())).rejects.toMatchObject({
      code: "LOCAL_CLIENT_PROVIDER_RUNTIME_CLIENT_UNVERIFIED",
      statusCode: 409,
    });
    expect(resolvePolicy).not.toHaveBeenCalled();
    expect(listDescriptors).not.toHaveBeenCalled();
  });

  it("rejects a client revision change between PoP authentication and policy routing", async () => {
    const listDescriptors = vi.fn(() => [descriptor()]);
    const resolvePolicy = vi.fn(async () => ({
      policyRevision: "must-not-resolve",
      policy: { dataClass: "internal" as const },
    }));
    const router = createLocalClientProviderRuntimeRouter({
      providerRegistry: { listDescriptors },
      healthFacts: { getScore: () => 50 },
      resolvePolicy,
      authorizeClient: async ({ clientId }) => ({
        ...verifiedClient(clientId),
        revision: 3,
      }),
    });

    await expect(router.route(request({ expectedClientRevision: 2 })))
      .rejects.toMatchObject({
        code: "LOCAL_CLIENT_PROVIDER_RUNTIME_CLIENT_UNVERIFIED",
        statusCode: 409,
      });
    expect(resolvePolicy).not.toHaveBeenCalled();
    expect(listDescriptors).not.toHaveBeenCalled();
  });

  it("represents missing observations and provider facts explicitly without inventing cost, region or quota", async () => {
    const setup = harness({
      descriptors: [descriptor({
        id: "provider-unknown",
        metadata: {},
        models: [{
          id: "model-unknown",
          enabled: true,
          capabilities: ["reasoning"],
          metadata: {},
        }],
      })],
      observations: {},
    });
    const result = await setup.router.route(request());
    expect(result.inventory).toEqual({
      providerCount: 1,
      modelCount: 1,
      observedModelCount: 0,
      unknownRegionCount: 1,
      unknownCostCount: 1,
      unknownQuotaCount: 1,
    });
    const evaluation = result.decision.evaluations[0];
    expect(evaluation.candidate).toMatchObject({
      provider: "provider-unknown",
      region: null,
      latencyMs: null,
      costUsd: null,
      quotaRemaining: null,
      reliability: 0.5,
    });
    expect(evaluation.rejectionReasons.map((reason) => reason.code)).toEqual(expect.arrayContaining([
      "provider_not_allowed",
      "region_required",
      "cost_required",
      "quota_required",
    ]));
  });

  it("honors server policy fanout and sensitive-data region constraints", async () => {
    const resolvePolicy = vi.fn(async () => ({
      policyRevision: "restricted-v1",
      policy: {
        dataClass: "restricted" as const,
        allowedProviders: ["provider-alpha", "provider-beta"],
        allowedRegions: ["cn-east", "eu-west"],
        maxFanout: 2,
        fusionAllowed: true,
      },
    }));
    const router = createLocalClientProviderRuntimeRouter({
      providerRegistry: {
        listDescriptors: () => [
          descriptor(),
          descriptor({
            id: "provider-beta",
            metadata: { routingRegion: "eu-west" },
            models: [{
              id: "model-beta",
              enabled: true,
              capabilities: ["reasoning"],
              metadata: { routingRegion: "eu-west" },
            }],
          }),
        ],
      },
      healthFacts: {
        getScore: () => 90,
        getSnapshot: () => ({ sampleCount: 10, successRate: 0.9, p50LatencyMs: 500 }),
      },
      resolvePolicy,
      authorizeClient: async ({ clientId }) => verifiedClient(clientId),
    });
    const result = await router.route(request({ requestedFanout: 2, fusionRequested: true }));
    expect(result.decision.selected).toHaveLength(1);
    expect(result.decision.evaluations.flatMap((item) => item.notSelectedReasons.map((reason) => reason.code)))
      .toContain("cross_region_fanout_denied");
  });

  it("preserves registry provider/model identifiers including common slash model ids", async () => {
    const resolvePolicy = vi.fn(async () => ({
      policyRevision: "runtime-id-v1",
      policy: { dataClass: "public" as const, allowedProviders: ["nvidia"] },
    }));
    const router = createLocalClientProviderRuntimeRouter({
      providerRegistry: {
        listDescriptors: () => [{
          id: "nvidia",
          metadata: { routingRegion: "us-east" },
          models: [{
            id: "@cf/meta/llama-3.1-70b-instruct",
            enabled: true,
            capabilities: ["chat", "reasoning"],
            metadata: {},
          }],
        }],
      },
      healthFacts: {
        getScore: (providerId) => providerId === "nvidia" ? 75 : 0,
        getSnapshot: () => ({ sampleCount: 4, successRate: 0.75, p50LatencyMs: 900 }),
      },
      resolvePolicy,
      authorizeClient: async ({ clientId }) => verifiedClient(clientId),
    });
    const result = await router.route(request());
    expect(result.decision.selected).toEqual([
      expect.objectContaining({
        provider: "nvidia",
        model: "@cf/meta/llama-3.1-70b-instruct",
      }),
    ]);
  });

  it("fails closed for malformed trusted policy, inventory and health observations", async () => {
    expect(() => createLocalClientProviderRuntimeRouter({} as never)).toThrowError(expect.objectContaining({
      code: "LOCAL_CLIENT_PROVIDER_RUNTIME_CONFIG_INVALID",
    }));

    const badPolicy = createLocalClientProviderRuntimeRouter({
      providerRegistry: { listDescriptors: () => [] },
      healthFacts: { getScore: () => 50 },
      resolvePolicy: async () => ({ policyRevision: "bad revision", policy: { dataClass: "public" } }),
      authorizeClient: async ({ clientId }) => verifiedClient(clientId),
    });
    await expect(badPolicy.route(request())).rejects.toMatchObject({
      code: "LOCAL_CLIENT_PROVIDER_RUNTIME_POLICY_INVALID",
    });

    const duplicateInventory = harness({ descriptors: [descriptor(), descriptor()] });
    await expect(duplicateInventory.router.route(request())).rejects.toMatchObject({
      code: "LOCAL_CLIENT_PROVIDER_RUNTIME_INVENTORY_INVALID",
    });

    const invalidObservation = harness({
      observations: {
        "provider-alpha": { sampleCount: 0, successRate: 0.9, p50LatencyMs: null },
      },
    });
    await expect(invalidObservation.router.route(request())).rejects.toMatchObject({
      code: "LOCAL_CLIENT_PROVIDER_RUNTIME_INVENTORY_INVALID",
    });
  });
});
