import { describe, expect, it } from "vitest";
import { createHealth } from "./healthUtils.js";

function createApplication({ realProviderEnabled, usageHealth }: {
  realProviderEnabled: boolean;
  usageHealth: Record<string, unknown>;
}) {
  return {
    config: {
      aiGatewayService: {
        providerMode: realProviderEnabled ? "real" : "fake",
        realProviderEnabled,
      },
    },
    requestLogger: { getHealth: () => usageHealth },
    knowledgeService: { getHealth: () => ({ status: "ready" }) },
    knowledgeInfra: { getReadiness: () => ({ status: "ready" }) },
    workflowService: { getHealth: () => ({ status: "ready" }) },
    workforceService: { getHealth: () => ({ status: "ready", ready: true }) },
    enterpriseGovernanceService: { getHealth: () => ({ status: "ready" }) },
    gatewayService: { getProviderDescriptors: () => [] },
  } as any;
}

describe("health usage-ledger readiness", () => {
  it("degrades real-provider readiness when durable usage storage is not ready", () => {
    const health = createHealth(createApplication({
      realProviderEnabled: true,
      usageHealth: {
        status: "degraded",
        persistence: "bounded-local-file",
        durableWritesRequired: true,
        consecutiveWriteFailures: 1,
      },
    }));

    expect(health.status).toBe("degraded");
    expect(health.usageLedger).toEqual(expect.objectContaining({
      status: "degraded",
      requiredForRealProviders: true,
    }));
  });

  it("keeps fake-only preview ready when its optional buffered logger degrades", () => {
    const health = createHealth(createApplication({
      realProviderEnabled: false,
      usageHealth: {
        status: "degraded",
        persistence: "memory-only",
        durableWritesRequired: false,
      },
    }));

    expect(health.status).toBe("ready");
    expect(health.usageLedger.requiredForRealProviders).toBe(false);
  });

  it("reports real-provider readiness only with an active durable ledger", () => {
    const health = createHealth(createApplication({
      realProviderEnabled: true,
      usageHealth: {
        status: "ready",
        persistence: "bounded-local-file",
        durableWritesRequired: true,
      },
    }));

    expect(health.status).toBe("ready");
  });
});
