import { describe, expect, it } from "vitest";

import {
  evaluateLocalClientProviderPolicy,
  type LocalClientProviderCandidate,
  type LocalClientProviderPolicy,
} from "./localClientProviderPolicy.ts";

function candidate(
  provider: string,
  overrides: Partial<LocalClientProviderCandidate> = {},
): LocalClientProviderCandidate {
  return {
    provider,
    model: "model-a",
    region: "us-east",
    capabilities: ["chat"],
    health: 0.9,
    reliability: 0.9,
    latencyMs: 500,
    costUsd: 0.2,
    quotaRemaining: 0.8,
    free: false,
    available: true,
    ...overrides,
  };
}

function policy(overrides: Partial<LocalClientProviderPolicy> = {}): LocalClientProviderPolicy {
  return {
    dataClass: "internal",
    ...overrides,
  };
}

function evaluationByProvider(
  decision: ReturnType<typeof evaluateLocalClientProviderPolicy>,
  provider: string,
) {
  const evaluation = decision.evaluations.find((item) => item.candidate.provider === provider);
  if (!evaluation) throw new Error(`Missing evaluation for ${provider}`);
  return evaluation;
}

describe("local client provider policy", () => {
  it("defaults confidential routing to one known-region candidate with fusion disabled", () => {
    const decision = evaluateLocalClientProviderPolicy({
      policy: policy({ dataClass: "confidential" }),
      requiredCapabilities: ["chat"],
      requestedFanout: 3,
      fusionRequested: true,
      candidates: [
        candidate("alpha", { health: 0.99 }),
        candidate("beta", { region: "eu-west", health: 0.98 }),
        candidate("unknown-region", { region: null, health: 1 }),
      ],
    });

    expect(decision.sensitiveDefaultsApplied).toBe(true);
    expect(decision.policyMaxFanout).toBe(1);
    expect(decision.effectiveFanout).toBe(1);
    expect(decision.fusionAllowed).toBe(false);
    expect(decision.fusionEnabled).toBe(false);
    expect(decision.selected.map((item) => item.provider)).toEqual(["alpha"]);
    expect(decision.decisionReasons.map((item) => item.code)).toContain("fusion_not_allowed");
    expect(evaluationByProvider(decision, "unknown-region").rejectionReasons.map((item) => item.code))
      .toContain("region_required");
  });

  it("fails closed for unknown or excessive cost, quota, latency, and region under constraints", () => {
    const decision = evaluateLocalClientProviderPolicy({
      policy: policy({
        allowedRegions: ["us-east"],
        maxCostUsd: 0.5,
        maxLatencyMs: 1_000,
        minQuotaRemaining: 0.25,
      }),
      candidates: [
        candidate("unknowns", {
          region: null,
          costUsd: null,
          latencyMs: null,
          quotaRemaining: null,
        }),
        candidate("over-limit", {
          region: "eu-west",
          costUsd: 0.6,
          latencyMs: 1_001,
          quotaRemaining: 0.2,
        }),
        candidate("exhausted", { quotaRemaining: 0 }),
        candidate("valid"),
      ],
    });

    expect(decision.selected.map((item) => item.provider)).toEqual(["valid"]);
    expect(evaluationByProvider(decision, "unknowns").rejectionReasons.map((item) => item.code))
      .toEqual(expect.arrayContaining(["region_required", "cost_required", "latency_required", "quota_required"]));
    expect(evaluationByProvider(decision, "over-limit").rejectionReasons.map((item) => item.code))
      .toEqual(expect.arrayContaining([
        "region_not_allowed",
        "cost_exceeds_limit",
        "latency_exceeds_limit",
        "quota_below_minimum",
      ]));
    expect(evaluationByProvider(decision, "exhausted").rejectionReasons.map((item) => item.code))
      .toContain("quota_exhausted");
    expect(evaluationByProvider(decision, "unknowns").scoreBreakdown).toBeNull();
    expect(evaluationByProvider(decision, "over-limit").score).toBeNull();
  });

  it("applies provider allow-list before deny-list and never relaxes either", () => {
    const decision = evaluateLocalClientProviderPolicy({
      policy: policy({
        allowedProviders: ["openai", "anthropic"],
        deniedProviders: ["anthropic"],
      }),
      candidates: [candidate("openai"), candidate("anthropic"), candidate("gemini")],
    });

    expect(decision.selected.map((item) => item.provider)).toEqual(["openai"]);
    expect(evaluationByProvider(decision, "anthropic").rejectionReasons.map((item) => item.code))
      .toContain("provider_denied");
    expect(evaluationByProvider(decision, "gemini").rejectionReasons.map((item) => item.code))
      .toContain("provider_not_allowed");

    const denyAll = evaluateLocalClientProviderPolicy({
      policy: policy({ allowedProviders: [] }),
      candidates: [candidate("openai")],
    });
    expect(denyAll.selected).toEqual([]);
    expect(evaluationByProvider(denyAll, "openai").scoreBreakdown).toBeNull();
  });

  it("caps public fanout, enables explicitly allowed fusion, and explains eligible overflow", () => {
    const decision = evaluateLocalClientProviderPolicy({
      policy: policy({ dataClass: "public", maxFanout: 2, fusionAllowed: true }),
      requestedFanout: 3,
      fusionRequested: true,
      candidates: [
        candidate("alpha", { health: 0.99 }),
        candidate("beta", { health: 0.98 }),
        candidate("gamma", { health: 0.97 }),
      ],
    });

    expect(decision.fanoutCapped).toBe(true);
    expect(decision.effectiveFanout).toBe(2);
    expect(decision.fusionEnabled).toBe(true);
    expect(decision.selected.map((item) => item.provider)).toEqual(["alpha", "beta"]);
    expect(evaluationByProvider(decision, "gamma")).toMatchObject({
      disposition: "eligible_not_selected",
      policyEligible: true,
      selected: false,
    });
    expect(evaluationByProvider(decision, "gamma").notSelectedReasons.map((item) => item.code))
      .toContain("fanout_limit");
  });

  it("keeps sensitive explicit fanout inside one region", () => {
    const decision = evaluateLocalClientProviderPolicy({
      policy: policy({
        dataClass: "restricted",
        maxFanout: 3,
        fusionAllowed: true,
        allowedRegions: ["us-east", "eu-west"],
      }),
      requestedFanout: 3,
      fusionRequested: true,
      candidates: [
        candidate("alpha-us", { region: "us-east", health: 1 }),
        candidate("beta-eu", { region: "eu-west", health: 0.99 }),
        candidate("gamma-us", { region: "us-east", health: 0.98 }),
      ],
    });

    expect(decision.selected.map((item) => item.provider)).toEqual(["alpha-us", "gamma-us"]);
    expect(decision.fusionEnabled).toBe(true);
    expect(evaluationByProvider(decision, "beta-eu").notSelectedReasons.map((item) => item.code))
      .toContain("cross_region_fanout_denied");
  });

  it("prioritizes an exact capability match over an otherwise identical superset", () => {
    const decision = evaluateLocalClientProviderPolicy({
      policy: policy(),
      requiredCapabilities: ["chat"],
      candidates: [
        candidate("superset", { capabilities: ["chat", "vision"] }),
        candidate("exact", { capabilities: ["chat"] }),
      ],
    });

    expect(decision.selected.map((item) => item.provider)).toEqual(["exact"]);
    expect(evaluationByProvider(decision, "exact").scoreBreakdown).toMatchObject({
      exactCapabilityMatch: true,
      capability: 30,
    });
    expect(evaluationByProvider(decision, "superset").scoreBreakdown).toMatchObject({
      exactCapabilityMatch: false,
      capability: 24,
    });
  });

  it("uses health and reliability feedback components in the explainable score", () => {
    const decision = evaluateLocalClientProviderPolicy({
      policy: policy(),
      candidates: [
        candidate("stale-feedback", { health: 0.7, reliability: 0.6 }),
        candidate("healthy-feedback", { health: 0.95, reliability: 0.98 }),
      ],
    });

    expect(decision.selected.map((item) => item.provider)).toEqual(["healthy-feedback"]);
    expect(evaluationByProvider(decision, "healthy-feedback").scoreBreakdown?.health).toBe(19);
    expect(evaluationByProvider(decision, "healthy-feedback").scoreBreakdown?.reliability).toBe(19.6);
    expect(evaluationByProvider(decision, "stale-feedback").scoreBreakdown?.reliability).toBe(12);
  });

  it("uses a stable provider/model/region tie-break independent of input order", () => {
    const alpha = candidate("alpha", { model: "model-a" });
    const beta = candidate("beta", { model: "model-a" });
    const first = evaluateLocalClientProviderPolicy({
      policy: policy({ maxFanout: 2 }),
      requestedFanout: 2,
      candidates: [beta, alpha],
    });
    const second = evaluateLocalClientProviderPolicy({
      policy: policy({ maxFanout: 2 }),
      requestedFanout: 2,
      candidates: [alpha, beta],
    });

    expect(first.selected.map((item) => item.provider)).toEqual(["alpha", "beta"]);
    expect(second.selected.map((item) => item.provider)).toEqual(["alpha", "beta"]);
    expect(evaluationByProvider(first, "alpha").scoreBreakdown)
      .toEqual(evaluationByProvider(second, "alpha").scoreBreakdown);
  });

  it("does not select a partial capability match or relax the policy when no candidate survives", () => {
    const decision = evaluateLocalClientProviderPolicy({
      policy: policy({ allowedProviders: ["alpha"] }),
      requiredCapabilities: ["chat", "vision"],
      candidates: [
        candidate("alpha", { capabilities: ["chat"] }),
        candidate("beta", { capabilities: ["chat", "vision"] }),
      ],
    });

    expect(decision.selected).toEqual([]);
    expect(evaluationByProvider(decision, "alpha").rejectionReasons.map((item) => item.code))
      .toContain("capability_missing");
    expect(evaluationByProvider(decision, "beta").rejectionReasons.map((item) => item.code))
      .toContain("provider_not_allowed");
    expect(decision.evaluations.every((item) => item.scoreBreakdown === null)).toBe(true);
  });

  it("adds an explicit free preference without hiding the other score components", () => {
    const decision = evaluateLocalClientProviderPolicy({
      policy: policy({ preferFree: true }),
      candidates: [
        candidate("paid"),
        candidate("free", { free: true }),
      ],
    });

    expect(decision.selected.map((item) => item.provider)).toEqual(["free"]);
    expect(evaluationByProvider(decision, "free").scoreBreakdown?.freePreference).toBe(5);
    expect(evaluationByProvider(decision, "paid").scoreBreakdown?.freePreference).toBe(0);
  });

  it("rejects unknown request, policy, and candidate fields instead of silently ignoring them", () => {
    expect(() => evaluateLocalClientProviderPolicy({
      policy: policy(),
      candidates: [candidate("alpha")],
      hiddenOverride: true,
    } as never)).toThrowError(expect.objectContaining({ code: "LOCAL_CLIENT_PROVIDER_POLICY_INVALID" }));
    expect(() => evaluateLocalClientProviderPolicy({
      policy: { ...policy(), hiddenOverride: true } as never,
      candidates: [candidate("alpha")],
    })).toThrowError(expect.objectContaining({ code: "LOCAL_CLIENT_PROVIDER_POLICY_INVALID" }));
    expect(() => evaluateLocalClientProviderPolicy({
      policy: policy(),
      candidates: [{ ...candidate("alpha"), hiddenOverride: true } as never],
    })).toThrowError(expect.objectContaining({ code: "LOCAL_CLIENT_PROVIDER_POLICY_INVALID" }));
  });

  it("returns frozen normalized candidate projections instead of caller-owned mutable objects", () => {
    const source = candidate("Alpha", { region: "US-EAST", capabilities: ["chat"] });
    const decision = evaluateLocalClientProviderPolicy({ policy: policy(), candidates: [source] });
    const selected = decision.selected[0];

    expect(selected).not.toBe(source);
    expect(selected).toMatchObject({ provider: "alpha", region: "us-east" });
    expect(Object.isFrozen(selected)).toBe(true);
    expect(Object.isFrozen(selected.capabilities)).toBe(true);
  });
});
