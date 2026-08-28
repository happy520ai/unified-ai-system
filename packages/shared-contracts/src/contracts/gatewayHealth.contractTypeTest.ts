import type { GatewayHealth } from "./gateway.js";

const healthFixture = {
  app: "ai-gateway-service",
  status: "degraded",
  phase: "contract-test",
  routes: ["GET /health/check"],
  localClientExecutionFeedback: {
    required: true,
    ready: false,
    activeRecoveryFailure: false,
    outbox: {
      available: true,
      durable: true,
    },
    dispatcher: {
      enabled: true,
      available: true,
      lifecycle: "started",
      lastErrorCode: null,
    },
    receiptJournal: {
      enabled: true,
      available: true,
      durable: true,
      distributed: false,
      singleHost: true,
      bindingCount: 1,
      recoveryContextEncrypted: true,
      snapshotRollbackProtected: false,
      clientAtomicEffectReceiptVerified: false,
    },
    receiptRecovery: {
      enabled: true,
      available: true,
      lifecycle: "started",
      executionRedispatchAllowed: false,
      runInFlight: false,
      runCount: 1,
      resolvedCount: 0,
      unresolvedCount: 1,
      failureCount: 0,
      consecutiveFailureCount: 0,
      lastErrorCode: null,
      lastRunSucceeded: true,
      lastSuccessAt: "2026-08-28T00:00:00.000Z",
      lastRunAt: "2026-08-28T00:00:00.000Z",
    },
  },
  managedLocalClientProtocol: {
    enabled: true,
    ready: false,
    fakeProviderOnly: false,
    realProviderConfigured: true,
    multiInstance: false,
    replayProtection: "sqlite-authenticated-replay-set",
    durableReplayProtection: true,
    authenticatedReplaySet: true,
    snapshotRollbackProtected: false,
    defensiveEnabled: true,
    capacityIsolatedByScope: true,
    principalBindingCount: 1,
    blockers: ["rollback_resistant_pop_replay_guard_required_for_real_provider"],
  },
  localClientPopSnapshotRollbackProtection: {
    protocolCoreAvailable: true,
    configured: false,
    ready: false,
    snapshotRollbackProtected: false,
    nativeDeploymentVerified: false,
    blockers: ["native_anchor_deployment_unverified"],
    boundaries: {
      mutatesOperatingSystem: false,
      provisionsNativeAuthority: false,
      nativeWindowsAdapterImplemented: false,
      sqliteCheckpointCoordinatorImplemented: false,
      statusBooleanAloneIsEvidence: false,
      challengeBoundProtectedEvidenceRequired: true,
      checkpointReadBeforeAndAfterAttestation: true,
      everyReplayMutationMustAdvanceAnchor: true,
      crashRecoveryMustFailClosed: true,
      externalToReplaySnapshotRequired: true,
    },
  },
  providerMode: "real",
  realProviderEnabled: true,
  providers: [],
} satisfies GatewayHealth;

function inspectManagedLocalClientReadiness(health: GatewayHealth) {
  return {
    ready: health.managedLocalClientProtocol?.ready ?? false,
    blockers: health.managedLocalClientProtocol?.blockers ?? [],
    receiptSnapshotRollbackProtected:
      health.localClientExecutionFeedback?.receiptJournal.snapshotRollbackProtected ?? false,
    clientAtomicEffectReceiptVerified:
      health.localClientExecutionFeedback?.receiptJournal.clientAtomicEffectReceiptVerified ?? false,
    popSnapshotRollbackProtected:
      health.localClientPopSnapshotRollbackProtection?.snapshotRollbackProtected ?? false,
  };
}

const inspected = inspectManagedLocalClientReadiness(healthFixture);
const compileReady: boolean = inspected.ready;
const compileBlockers: string[] = inspected.blockers;
void compileReady;
void compileBlockers;
