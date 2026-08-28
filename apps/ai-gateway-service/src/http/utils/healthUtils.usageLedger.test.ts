import { describe, expect, it } from "vitest";
import { createHealth } from "./healthUtils.js";

function createApplication({ realProviderEnabled, usageHealth, enterpriseHealth = { status: "ready" } }: {
  realProviderEnabled: boolean;
  usageHealth: Record<string, unknown>;
  enterpriseHealth?: Record<string, unknown>;
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
    enterpriseGovernanceService: { getHealth: () => enterpriseHealth },
    gatewayService: { getProviderDescriptors: () => [] },
    localClientExecutionReadiness: { requested: false },
    localClientManagedProtocolDispatchStatus: { enabled: false, ready: false, blockers: [] },
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

  it("degrades readiness when the central enterprise audit store is unavailable", () => {
    const health = createHealth(createApplication({
      realProviderEnabled: false,
      usageHealth: {
        status: "ready",
        persistence: "bounded-local-file",
        durableWritesRequired: false,
      },
      enterpriseHealth: {
        status: "degraded",
        audit: {
          mode: "postgres-hmac-chain-plus-local-mirror",
          central: { status: "degraded", available: false },
        },
      },
    }));

    expect(health.status).toBe("degraded");
    expect(health.enterprise).toMatchObject({
      status: "degraded",
      audit: { central: { available: false } },
    });
  });

  it("degrades requested local-client execution when its durable feedback path is unavailable", () => {
    const application = createApplication({
      realProviderEnabled: false,
      usageHealth: { status: "ready", durableWritesRequired: false },
    });
    application.localClientExecutionReadiness = { requested: true };
    application.localClientExecutionFeedbackOutboxStatus = { available: false, durable: true };
    application.localClientExecutionFeedbackDispatcherStatus = {
      available: false,
      lifecycle: "closed",
    };

    const health = createHealth(application);

    expect(health.status).toBe("degraded");
    expect(health.localClientExecutionFeedback).toMatchObject({
      required: true,
      ready: false,
    });
  });

  it("keeps requested local-client execution ready only with live outbox and dispatcher state", () => {
    const application = createApplication({
      realProviderEnabled: false,
      usageHealth: { status: "ready", durableWritesRequired: false },
    });
    application.localClientExecutionReadiness = { requested: true };
    application.localClientExecutionFeedbackOutboxStatus = { available: true, durable: true };
    application.localClientExecutionFeedbackDispatcherStatus = {
      available: true,
      lifecycle: "started",
    };
    application.localClientExecutionReceiptJournalStatus = {
      available: true,
      durable: true,
      recoveryContextEncrypted: true,
    };
    application.localClientExecutionReceiptRecoveryStatus = {
      available: true,
      lifecycle: "started",
      executionRedispatchAllowed: false,
      consecutiveFailureCount: 0,
      lastRunSucceeded: true,
      lastSuccessAt: "2026-08-28T00:00:00.000Z",
    };

    expect(createHealth(application).status).toBe("ready");
  });

  it("degrades requested execution only while receipt recovery has an active failure", () => {
    const application = createApplication({
      realProviderEnabled: false,
      usageHealth: { status: "ready", durableWritesRequired: false },
    });
    application.localClientExecutionReadiness = { requested: true };
    application.localClientExecutionFeedbackOutboxStatus = { available: true, durable: true };
    application.localClientExecutionFeedbackDispatcherStatus = {
      available: true,
      lifecycle: "started",
    };
    application.localClientExecutionReceiptJournalStatus = {
      available: true,
      durable: true,
      recoveryContextEncrypted: true,
    };
    application.localClientExecutionReceiptRecoveryStatus = {
      available: true,
      lifecycle: "started",
      executionRedispatchAllowed: false,
      failureCount: 4,
      consecutiveFailureCount: 2,
      lastRunSucceeded: false,
      lastSuccessAt: "2026-08-27T23:59:00.000Z",
    };

    const failedHealth = createHealth(application);
    expect(failedHealth.status).toBe("degraded");
    expect(failedHealth.localClientExecutionFeedback).toMatchObject({
      ready: false,
      activeRecoveryFailure: true,
    });

    application.localClientExecutionReceiptRecoveryStatus = {
      ...application.localClientExecutionReceiptRecoveryStatus,
      consecutiveFailureCount: 0,
      lastRunSucceeded: true,
      lastSuccessAt: "2026-08-28T00:01:00.000Z",
    };
    const recoveredHealth = createHealth(application);
    expect(recoveredHealth.status).toBe("ready");
    expect(recoveredHealth.localClientExecutionFeedback).toMatchObject({
      ready: true,
      activeRecoveryFailure: false,
    });
  });
});
