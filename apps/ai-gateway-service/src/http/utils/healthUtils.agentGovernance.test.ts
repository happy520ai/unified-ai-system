import { describe, expect, it } from "vitest";
import { createHealth, createSetupReadiness } from "./healthUtils.js";

function application(overrides: Record<string, unknown> = {}) {
  return {
    config: {
      aiGatewayService: {
        providerMode: "fake",
        realProviderEnabled: false,
      },
    },
    requestLogger: {
      getHealth: () => ({ status: "ready", durableWritesRequired: false }),
    },
    knowledgeService: { getHealth: () => ({ status: "ready" }) },
    knowledgeInfra: { getReadiness: () => ({ status: "ready" }) },
    workflowService: { getHealth: () => ({ status: "ready" }) },
    workforceService: { getHealth: () => ({ status: "ready", ready: true }) },
    enterpriseGovernanceService: { getHealth: () => ({ status: "ready" }) },
    gatewayService: {
      getProviderDescriptors: () => [{ id: "local-fake-provider" }],
    },
    localClientExecutionReadiness: { requested: false },
    localClientManagedProtocolDispatchStatus: { enabled: false, ready: false, blockers: [] },
    ...overrides,
  } as any;
}

describe("health Agent Governance readiness", () => {
  it("keeps disabled governance ready and reports no owner requirement", () => {
    const health = createHealth(application());
    expect(health.status).toBe("ready");
    expect(health.agentGovernance).toEqual({
      enabled: false,
      ready: true,
      status: "disabled",
      ownerLease: "not_required",
      startupRecovery: "not_required",
      stateIntegrity: "not_required",
      auditIntegrity: "not_required",
      failureCode: null,
      checkedAt: null,
    });
  });

  it("degrades while enabled governance has no bound health monitor", () => {
    const health = createHealth(application({ agentGovernance: { service: {} } }));
    expect(health.status).toBe("degraded");
    expect(health.agentGovernance).toMatchObject({
      enabled: true,
      ready: false,
      status: "initializing",
      failureCode: "governance_health_unavailable",
    });
  });

  it("includes only the sanitized verified monitor summary", () => {
    const snapshot = {
      enabled: true,
      ready: true,
      status: "ready",
      ownerLease: "held",
      startupRecovery: "ready",
      stateIntegrity: "verified",
      auditIntegrity: "verified",
      failureCode: null,
      checkedAt: "2026-08-30T12:00:00.000Z",
      ownerId: "must-not-escape",
      path: "must-not-escape",
    };
    const health = createHealth(application({
      agentGovernance: { service: {} },
      agentGovernanceHealth: { snapshot: () => snapshot },
    }));

    expect(health.status).toBe("ready");
    expect(health.agentGovernance).not.toHaveProperty("ownerId");
    expect(health.agentGovernance).not.toHaveProperty("path");
    expect(JSON.stringify(health.agentGovernance)).not.toContain("must-not-escape");
  });

  it("propagates governance degradation into setup readiness", () => {
    const readiness = createSetupReadiness(application({
      agentGovernance: { service: {} },
      agentGovernanceHealth: {
        snapshot: () => ({
          enabled: true,
          ready: false,
          status: "degraded",
          ownerLease: "held",
          startupRecovery: "failed",
          stateIntegrity: "failed",
          auditIntegrity: "failed",
          failureCode: "startup_recovery_failed",
          checkedAt: "2026-08-30T12:00:00.000Z",
        }),
      },
    }));

    expect(readiness.status).toBe("degraded");
    expect(readiness.readiness.agentGovernance).toMatchObject({
      enabled: true,
      ready: false,
      failureCode: "startup_recovery_failed",
    });
    expect(readiness.steps.find((step: any) => step.stepId === "agent-governance")).toMatchObject({
      ready: false,
      status: "needs_attention",
    });
  });

  it("preserves the established setup-ready contract for unrelated degradation", () => {
    const readiness = createSetupReadiness(application({
      enterpriseGovernanceService: { getHealth: () => ({ status: "degraded" }) },
    }));

    expect(readiness.status).toBe("ready");
    expect(readiness.readiness.agentGovernance).toMatchObject({
      enabled: false,
      ready: true,
    });
    expect(readiness.steps.find((step: any) => step.stepId === "service-health")).toMatchObject({
      ready: false,
      status: "needs_attention",
    });
  });
});
