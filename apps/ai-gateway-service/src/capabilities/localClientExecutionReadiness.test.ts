import { describe, expect, it } from "vitest";

import {
  assertLocalClientExecutionReadiness,
  evaluateLocalClientExecutionReadiness,
} from "./localClientExecutionReadiness.ts";

const durableLocal = Object.freeze({ available: true, durable: true, distributed: false });
const durableDistributed = Object.freeze({ available: true, durable: true, distributed: true });
const enabledLocal = Object.freeze({ ...durableLocal, enabled: true });
const enabledDistributed = Object.freeze({ ...durableDistributed, enabled: true });
const receiptUnprotectedLocal = Object.freeze({
  ...durableLocal,
  recoveryContextEncrypted: true,
  snapshotRollbackProtected: false,
  clientAtomicEffectReceiptVerified: false,
});
const receiptLocal = Object.freeze({
  ...durableLocal,
  recoveryContextEncrypted: true,
  snapshotRollbackProtected: true,
  clientAtomicEffectReceiptVerified: true,
});
const receiptDistributed = Object.freeze({
  ...durableDistributed,
  recoveryContextEncrypted: true,
  snapshotRollbackProtected: true,
  clientAtomicEffectReceiptVerified: true,
});
const authenticatedLocal = Object.freeze({
  ...durableLocal,
  authenticated: true,
  monotonicCheckpoint: true,
  rollbackResistant: false,
  rollbackDetectionScope: "registry-only unless checkpoint DB also rolled back",
});
const authenticatedDistributed = Object.freeze({
  ...durableDistributed,
  authenticated: true,
  monotonicCheckpoint: true,
  rollbackResistant: true,
});
const rollbackProtectedLocal = Object.freeze({ ...authenticatedLocal, rollbackResistant: true });
const governedAdapter = Object.freeze({ id: "builtin.loopback.local-client", type: "loopback-http", version: "1.0.0" });
const fakeAdapter = Object.freeze({ id: "builtin.fake.local-client", type: "fake", version: "1.0.0" });

describe("local client execution readiness", () => {
  it("keeps execution preview-only by default without pretending dependencies are ready", () => {
    expect(evaluateLocalClientExecutionReadiness()).toMatchObject({
      requested: false,
      ready: false,
      mode: "preview-only",
      blockers: [],
      governedAdapterCount: 0,
    });
  });

  it("reports every missing single-host execution dependency", () => {
    const result = evaluateLocalClientExecutionReadiness({
      env: { AI_GATEWAY_LOCAL_CLIENT_EXECUTION_ENABLED: "true" },
      adapterDescriptors: [fakeAdapter],
    });

    expect(result.mode).toBe("blocked");
    expect(result.blockers).toEqual([
      "claim_missing",
      "execution_control_missing",
      "external_effect_missing",
      "governed_adapter_missing",
      "idempotency_missing",
      "receipt_journal_missing",
      "route_plan_missing",
      "verification_authority_missing",
    ]);
  });

  it("accepts a complete durable single-host runtime", () => {
    const result = assertLocalClientExecutionReadiness({
      env: { AI_GATEWAY_LOCAL_CLIENT_EXECUTION_ENABLED: "true" },
      routePlanStatus: durableLocal,
      executionControlStatus: durableLocal,
      externalEffectStatus: enabledLocal,
      idempotencyStatus: durableLocal,
      claimStatus: durableLocal,
      verificationAuthorityStatus: rollbackProtectedLocal,
      receiptJournalStatus: receiptLocal,
      adapterDescriptors: [fakeAdapter, governedAdapter],
    });

    expect(result).toMatchObject({ requested: true, ready: true, mode: "ready", governedAdapterCount: 1 });
  });

  it("rejects a non-durable route-plan store even when every other dependency is durable", () => {
    expect(() => assertLocalClientExecutionReadiness({
      env: { AI_GATEWAY_LOCAL_CLIENT_EXECUTION_ENABLED: "true" },
      routePlanStatus: { available: true, durable: false, distributed: false, previewOnly: true },
      executionControlStatus: durableLocal,
      externalEffectStatus: enabledLocal,
      idempotencyStatus: durableLocal,
      claimStatus: durableLocal,
      verificationAuthorityStatus: rollbackProtectedLocal,
      receiptJournalStatus: receiptLocal,
      adapterDescriptors: [governedAdapter],
    })).toThrowError(expect.objectContaining({
      code: "LOCAL_CLIENT_EXECUTION_RUNTIME_NOT_READY",
      blockers: ["route_plan_not_durable"],
    }));
  });

  it("requires a monotonic checkpoint without overstating rollback resistance", () => {
    expect(() => assertLocalClientExecutionReadiness({
      env: { AI_GATEWAY_LOCAL_CLIENT_EXECUTION_ENABLED: "true" },
      routePlanStatus: durableLocal,
      executionControlStatus: durableLocal,
      externalEffectStatus: enabledLocal,
      idempotencyStatus: durableLocal,
      claimStatus: durableLocal,
      verificationAuthorityStatus: { ...durableLocal, authenticated: true, rollbackResistant: true },
      receiptJournalStatus: receiptLocal,
      adapterDescriptors: [governedAdapter],
    })).toThrowError(expect.objectContaining({
      blockers: ["verification_authority_not_monotonic"],
    }));

    expect(authenticatedLocal).toMatchObject({
      monotonicCheckpoint: true,
      rollbackResistant: false,
      rollbackDetectionScope: "registry-only unless checkpoint DB also rolled back",
    });
  });

  it("requires rollback resistance by default and permits only an explicit registry-only downgrade", () => {
    const input = {
      routePlanStatus: durableLocal,
      executionControlStatus: durableLocal,
      externalEffectStatus: enabledLocal,
      idempotencyStatus: durableLocal,
      claimStatus: durableLocal,
      verificationAuthorityStatus: authenticatedLocal,
      receiptJournalStatus: receiptLocal,
      adapterDescriptors: [governedAdapter],
    };
    expect(() => assertLocalClientExecutionReadiness({
      ...input,
      env: { AI_GATEWAY_LOCAL_CLIENT_EXECUTION_ENABLED: "true" },
    })).toThrowError(expect.objectContaining({
      blockers: ["verification_authority_not_rollback_resistant"],
    }));
    expect(assertLocalClientExecutionReadiness({
      ...input,
      env: {
        AI_GATEWAY_LOCAL_CLIENT_EXECUTION_ENABLED: "true",
        AI_GATEWAY_LOCAL_CLIENT_ALLOW_REGISTRY_ONLY_ROLLBACK_DETECTION: "true",
      },
    }).ready).toBe(true);
  });

  it("always blocks unprotected or non-atomic receipt reconciliation at runtime", () => {
    const input = {
      routePlanStatus: durableLocal,
      executionControlStatus: durableLocal,
      externalEffectStatus: enabledLocal,
      idempotencyStatus: durableLocal,
      claimStatus: durableLocal,
      verificationAuthorityStatus: rollbackProtectedLocal,
      receiptJournalStatus: receiptUnprotectedLocal,
      adapterDescriptors: [governedAdapter],
    };
    expect(() => assertLocalClientExecutionReadiness({
      ...input,
      env: { AI_GATEWAY_LOCAL_CLIENT_EXECUTION_ENABLED: "true" },
    })).toThrowError(expect.objectContaining({
      blockers: [
        "receipt_journal_client_atomic_effect_receipt_unverified",
        "receipt_journal_snapshot_rollback_not_protected",
      ],
    }));
    expect(evaluateLocalClientExecutionReadiness({
      ...input,
      env: {
        AI_GATEWAY_LOCAL_CLIENT_EXECUTION_ENABLED: "true",
        // A deployment-supplied flag cannot suppress either blocker.
        AI_GATEWAY_LOCAL_CLIENT_TEST_ONLY_ALLOW_UNPROTECTED_RECEIPT_RECONCILIATION: "true",
      },
    })).toMatchObject({
      ready: false,
      mode: "blocked",
      boundaries: { unprotectedReceiptReconciliationRuntimeOverrideAllowed: false },
    });
  });

  it("requires every stateful boundary to be distributed in multi-instance mode", () => {
    expect(() => assertLocalClientExecutionReadiness({
      env: {
        AI_GATEWAY_LOCAL_CLIENT_EXECUTION_ENABLED: "true",
        AI_GATEWAY_MULTI_INSTANCE: "true",
      },
      routePlanStatus: durableLocal,
      executionControlStatus: durableLocal,
      externalEffectStatus: enabledLocal,
      idempotencyStatus: durableLocal,
      claimStatus: durableLocal,
      verificationAuthorityStatus: rollbackProtectedLocal,
      receiptJournalStatus: receiptLocal,
      adapterDescriptors: [governedAdapter],
    })).toThrowError(expect.objectContaining({
      blockers: [
        "claim_not_distributed",
        "execution_control_not_distributed",
        "external_effect_not_distributed",
        "idempotency_not_distributed",
        "receipt_journal_not_distributed",
        "route_plan_not_distributed",
        "verification_authority_not_distributed",
      ],
    }));
  });

  it("accepts a complete distributed runtime", () => {
    expect(assertLocalClientExecutionReadiness({
      env: {
        AI_GATEWAY_LOCAL_CLIENT_EXECUTION_ENABLED: "1",
        AI_GATEWAY_MULTI_INSTANCE: "1",
      },
      routePlanStatus: durableDistributed,
      executionControlStatus: durableDistributed,
      externalEffectStatus: enabledDistributed,
      idempotencyStatus: durableDistributed,
      claimStatus: durableDistributed,
      verificationAuthorityStatus: authenticatedDistributed,
      receiptJournalStatus: receiptDistributed,
      adapterDescriptors: [governedAdapter],
    }).ready).toBe(true);
  });

  it("fails closed for invalid booleans and unknown configuration fields", () => {
    expect(() => evaluateLocalClientExecutionReadiness({
      env: { AI_GATEWAY_LOCAL_CLIENT_EXECUTION_ENABLED: "sometimes" },
    })).toThrowError(expect.objectContaining({ code: "LOCAL_CLIENT_EXECUTION_CONFIG_INVALID" }));
    expect(() => evaluateLocalClientExecutionReadiness({ unknown: true } as never)).toThrowError(
      expect.objectContaining({ code: "LOCAL_CLIENT_EXECUTION_CONFIG_INVALID" }),
    );
  });
});
