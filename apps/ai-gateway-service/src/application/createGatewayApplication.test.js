import { DatabaseSync } from "node:sqlite";
import { describe, it, expect, beforeAll, vi } from "vitest";
import {
  createGatewayApplication,
  createGatewayApplicationForLocalClientFixtureTests,
  restoreRuntimeCredentialProviders,
} from "./createGatewayApplication.js";
import { setRuntimeProviderCredential } from "../http/utils/phaseModelUtils.js";
import { createFakeProvider } from "../providers/fakeProvider.js";
import { createNvidiaUnifiedClient } from "../providers/nvidia/nvidiaUnifiedClient.js";
import { ProviderRegistry } from "../providers/providerRegistry.js";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, parse } from "node:path";
import { LocalClientSqliteFeedbackDedupStore } from "../capabilities/localClientSqliteFeedbackDedupStore.ts";
import { LocalClientSqliteOnboardingReceiptAuthorityStore } from "../capabilities/localClientSqliteOnboardingReceiptAuthorityStore.ts";


// The governed local-client composition cases below construct the durable
// SQLite stores that fail closed unless the runtime provides node:sqlite
// defensive mode; they run only where that capability exists.
const durableLocalClientSqliteSupported = (() => {
  try {
    const probe = new DatabaseSync(":memory:");
    try {
      return typeof probe.enableDefensive === "function";
    } finally {
      probe.close();
    }
  } catch {
    return false;
  }
})();
const itDurableLocalClientSqlite = durableLocalClientSqliteSupported ? it : it.skip;

describe("gateway-application", () => {
  let app;

  beforeAll(() => {
    app = createGatewayApplication();
  });

  it("creates application with all services", () => {
    expect(app.gatewayService).toBeDefined();
    expect(app.knowledgeService).toBeDefined();
    expect(app.workflowService).toBeDefined();
    expect(app.workforceService).toBeDefined();
    expect(app.workforceExecutor).toEqual(expect.objectContaining({
      execute: expect.any(Function),
      getInfo: expect.any(Function),
    }));
    expect(app.enterpriseGovernanceService).toBeDefined();
    expect(app.modelImportService).toBeDefined();
    expect(app.modelLibraryStore).toBeDefined();
    expect(app.providerConfigRoutes).toBeDefined();
    expect(app.runtimeCredentialStore).toBeDefined();
    expect(app.userExperienceService).toBeDefined();
    expect(app.localClientManagementService).toBeDefined();
    expect(app.localClientAdapterRegistry.list()).toEqual(expect.arrayContaining([
      expect.objectContaining({ type: "fake" }),
    ]));
    expect(app.localClientRoutePlanStore.status).toMatchObject({
      storageMode: "single-process-memory",
      previewOnly: true,
      grantsApproval: false,
      providesExternalEffectFence: false,
    });
    expect(app.localClientExecutionClaimStore).toBeNull();
    expect(app.localClientOnboardingReceiptAuthorityStore).toBeNull();
    expect(app.localClientOnboardingReceiptAuthorityStatus).toMatchObject({
      mode: "disabled",
      available: false,
      durable: false,
      oneTimeRollbackAuthorization: false,
    });
    expect(app.localClientFeedbackDedupStore).toBeNull();
    expect(app.localClientFeedbackDedupStatus).toMatchObject({
      mode: "disabled",
      available: false,
      durable: false,
    });
    expect(app.localClientExecutionFeedbackOutbox).toBeNull();
    expect(app.localClientExecutionFeedbackOutboxStatus).toMatchObject({
      mode: "disabled",
      available: false,
      durable: false,
    });
    expect(app.localClientExecutionFeedbackDispatcher).toBeNull();
    expect(app.localClientExecutionFeedbackDispatcherStatus).toMatchObject({
      enabled: false,
      available: false,
      lifecycle: "disabled",
    });
    expect(app.localClientExecutionReceiptJournalRegistry).toBeNull();
    expect(app.localClientExecutionReceiptJournalStatus).toMatchObject({
      enabled: false,
      available: false,
      durable: false,
      bindingCount: 0,
      recoveryContextEncrypted: false,
      snapshotRollbackProtected: false,
      clientAtomicEffectReceiptVerified: false,
    });
    expect(app.localClientExecutionReceiptRecoveryService).toBeNull();
    expect(app.localClientExecutionReceiptRecoveryStatus).toMatchObject({
      enabled: false,
      available: false,
      lifecycle: "disabled",
      executionRedispatchAllowed: false,
      consecutiveFailureCount: 0,
      lastRunSucceeded: null,
    });
    expect(app.localClientPopSnapshotRollbackProtectionStatus).toMatchObject({
      protocolCoreAvailable: true,
      configured: false,
      ready: false,
      snapshotRollbackProtected: false,
      nativeDeploymentVerified: false,
      blockers: expect.arrayContaining([
        "windows_authority_native_adapter_not_implemented",
        "sqlite_pop_replay_anchor_commit_coordinator_not_implemented",
      ]),
    });
    expect(app.localClientSmartManagementScheduler).toBeNull();
    expect(app.localClientSmartManagementSchedulerStatus).toMatchObject({
      enabled: false,
      executionMode: "dry-run",
      applyEnabled: false,
      applyConfigurable: false,
      configuredTenantCount: 0,
    });
    expect(app.localClientExecutionReadiness).toMatchObject({
      requested: false,
      ready: false,
      mode: "preview-only",
      blockers: [],
    });
    expect(app.localClientExecutionControl.getHealth()).toMatchObject({
      mode: "local-atomic-json",
      durable: true,
      distributed: false,
      available: true,
    });
    expect(app.localClientGovernedOnboardingStatus).toMatchObject({
      enabled: false,
      initializationState: "disabled",
      configuredProfileCount: 0,
      format: "json-only",
      certificationStatus: "fixture-tested-not-real-client-certified",
      automaticDiscoveryOrMutation: false,
    });
    expect(app.localClientProviderPolicyResolver.status).toMatchObject({
      source: "secure-default",
      overrideCount: 0,
      requestBodyPolicyAccepted: false,
    });
    expect(app.localClientProviderRuntimeRouter.boundaries).toMatchObject({
      candidatesFromTrustedRegistry: true,
      policyFromTrustedResolver: true,
      requestSuppliedFactsDenied: true,
      dispatchPerformed: false,
    });
    expect(app.capabilityRouterService).toBeDefined();
    expect(app.providerDispatchGate.status).toMatchObject({ enabled: false, mode: "disabled" });
    expect(app.externalEffectGate.status).toMatchObject({ enabled: false, mode: "disabled" });
  });

  it("has correct config", () => {
    expect(app.config.aiGatewayService.endpoint.host).toBe("127.0.0.1");
    expect(app.config.aiGatewayService.endpoint.port).toBe(3100);
    expect(app.gatewayService.runtimeConfig.costGuardEnforce).toBe(true);
    expect(app.gatewayService.runtimeConfig.shadowRealProviderEnabled).toBe(false);
    expect(app.gatewayService.runtimeConfig.shadowTimeoutMs).toBe(30_000);
  });

  it("uses the safe shadow timeout default for an empty environment value", () => {
    const application = createGatewayApplication({ AI_GATEWAY_SHADOW_TIMEOUT_MS: "" });
    expect(application.gatewayService.runtimeConfig.shadowTimeoutMs).toBe(30_000);
  });

  it("refuses provider inventory routing for an unverified local client", async () => {
    await expect(app.localClientProviderRuntimeRouter.route({
      tenantId: "tenant-application-test",
      subjectId: "operator-application-test",
      clientId: "desktop-agent",
      requiredCapabilities: ["chat"],
      requestedFanout: 1,
      fusionRequested: false,
    })).rejects.toMatchObject({
      code: "local_client_verified_target_not_found",
      statusCode: 404,
    });
  });

  it("fails startup before service construction for an invalid local-client provider policy", () => {
    expect(() => createGatewayApplication({
      AI_GATEWAY_LOCAL_CLIENT_PROVIDER_POLICIES_JSON: JSON.stringify({
        version: 1,
        defaultPolicy: { dataClass: "restricted", maxFanout: 2 },
        overrides: [],
        requestCandidates: true,
      }),
    })).toThrow(expect.objectContaining({
      code: "LOCAL_CLIENT_PROVIDER_POLICY_CONFIG_INVALID",
      statusCode: 503,
    }));
  });

  it("requires explicit durable route-plan and claim stores for single-host local-client execution", () => {
    const root = mkdtempSync(join(tmpdir(), "gateway-local-client-preflight-"));
    try {
      expect(() => createGatewayApplication({
        AI_GATEWAY_LOCAL_CLIENT_EXECUTION_ENABLED: "true",
      })).toThrow(expect.objectContaining({
        code: "LOCAL_CLIENT_ROUTE_PLAN_DURABLE_REQUIRED",
      }));
      expect(() => createGatewayApplication({
        AI_GATEWAY_LOCAL_CLIENT_EXECUTION_ENABLED: "true",
        AI_GATEWAY_LOCAL_CLIENT_ROUTE_PLAN_STORE_MODE: "sqlite",
        AI_GATEWAY_LOCAL_CLIENT_ROUTE_PLAN_SQLITE_PATH: join(root, "route-plans.sqlite"),
        AI_GATEWAY_LOCAL_CLIENT_HOST_ID: "application-test-host",
      })).toThrow(expect.objectContaining({
        code: "LOCAL_CLIENT_EXECUTION_CLAIM_STORE_REQUIRED",
        statusCode: 503,
      }));
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("requires a monotonic authority store after accepting the explicit SQLite claim backend", () => {
    const root = mkdtempSync(join(tmpdir(), "gateway-local-client-claim-readiness-"));
    let startupError;
    try {
      createGatewayApplication({
        AI_GATEWAY_LOCAL_CLIENT_EXECUTION_ENABLED: "true",
        AI_GATEWAY_LOCAL_CLIENT_EXECUTION_CLAIM_STORE_MODE: "sqlite",
        AI_GATEWAY_LOCAL_CLIENT_EXECUTION_CLAIM_SQLITE_PATH: join(root, "claims.sqlite"),
        AI_GATEWAY_LOCAL_CLIENT_HOST_ID: "application-test-host",
        AI_GATEWAY_LOCAL_CLIENT_ROUTE_PLAN_STORE_MODE: "sqlite",
        AI_GATEWAY_LOCAL_CLIENT_ROUTE_PLAN_SQLITE_PATH: join(root, "route-plans.sqlite"),
        AI_GATEWAY_LOCAL_CLIENT_EXECUTION_CONTROL_DIR: join(root, "control"),
        AI_GATEWAY_IDEMPOTENCY_STORE_MODE: "sqlite",
        AI_GATEWAY_IDEMPOTENCY_SQLITE_PATH: join(root, "idempotency.sqlite"),
        AI_GATEWAY_IDEMPOTENCY_HMAC_SECRET: "local-client-idempotency-test-secret".padEnd(64, "x"),
        AI_GATEWAY_EXTERNAL_EFFECT_STORE_MODE: "sqlite",
        AI_GATEWAY_EXTERNAL_EFFECT_SQLITE_PATH: join(root, "effects.sqlite"),
        AI_GATEWAY_EXTERNAL_EFFECT_HMAC_SECRET: "local-client-effect-test-secret".padEnd(64, "x"),
      });
    } catch (error) {
      startupError = error;
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
    expect(startupError).toMatchObject({
      code: "LOCAL_CLIENT_AUTHORITY_EPOCH_STORE_REQUIRED",
      statusCode: 503,
    });
  });

  it("requires a distinct durable HTTP idempotency store before local-client execution startup", () => {
    const root = mkdtempSync(join(tmpdir(), "gateway-local-client-idempotency-preflight-"));
    try {
      const base = {
        AI_GATEWAY_LOCAL_CLIENT_EXECUTION_ENABLED: "true",
        AI_GATEWAY_LOCAL_CLIENT_ROUTE_PLAN_STORE_MODE: "sqlite",
        AI_GATEWAY_LOCAL_CLIENT_ROUTE_PLAN_SQLITE_PATH: join(root, "route-plans.sqlite"),
        AI_GATEWAY_LOCAL_CLIENT_EXECUTION_CLAIM_STORE_MODE: "sqlite",
        AI_GATEWAY_LOCAL_CLIENT_EXECUTION_CLAIM_SQLITE_PATH: join(root, "claims.sqlite"),
        AI_GATEWAY_LOCAL_CLIENT_HOST_ID: "application-test-host",
      };
      expect(() => createGatewayApplication(base)).toThrow(expect.objectContaining({
        code: "LOCAL_CLIENT_IDEMPOTENCY_DURABLE_STORE_REQUIRED",
      }));
      expect(() => createGatewayApplication({
        ...base,
        AI_GATEWAY_LOCAL_CLIENT_CONTROL_STORE_MODE: "postgres",
        AI_GATEWAY_LOCAL_CLIENT_CONTROL_POSTGRES_URL: "postgresql://local:test@127.0.0.1/local_client",
      })).toThrow(expect.objectContaining({
        code: "LOCAL_CLIENT_CONTROL_POSTGRES_STARTUP_PROBE_UNSUPPORTED",
      }));
      expect(() => createGatewayApplication({
        ...base,
        AI_GATEWAY_EXTERNAL_EFFECT_STORE_MODE: "postgres",
        AI_GATEWAY_EXTERNAL_EFFECT_POSTGRES_URL: "postgresql://local:test@127.0.0.1/local_client",
      })).toThrow(expect.objectContaining({
        code: "LOCAL_CLIENT_EXTERNAL_EFFECT_POSTGRES_STARTUP_PROBE_UNSUPPORTED",
      }));
      expect(() => createGatewayApplication({
        ...base,
        AI_GATEWAY_IDEMPOTENCY_STORE_MODE: "postgres",
        AI_GATEWAY_IDEMPOTENCY_HMAC_SECRET: "local-client-idempotency-test-secret".padEnd(64, "x"),
        AI_GATEWAY_IDEMPOTENCY_POSTGRES_URL: "postgresql://local:test@127.0.0.1/local_client",
      })).toThrow(expect.objectContaining({
        code: "LOCAL_CLIENT_IDEMPOTENCY_POSTGRES_STARTUP_PROBE_UNSUPPORTED",
      }));
      expect(() => createGatewayApplication({
        ...base,
        AI_GATEWAY_IDEMPOTENCY_STORE_MODE: "sqlite",
        AI_GATEWAY_IDEMPOTENCY_SQLITE_PATH: join(root, "claims.sqlite"),
        AI_GATEWAY_IDEMPOTENCY_HMAC_SECRET: "local-client-idempotency-test-secret".padEnd(64, "x"),
      })).toThrow(expect.objectContaining({
        code: "LOCAL_CLIENT_IDEMPOTENCY_SQLITE_PATH_CONFLICT",
      }));
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("keeps multi-instance local-client execution blocked until claims are distributed", () => {
    expect(() => createGatewayApplication({
      AI_GATEWAY_LOCAL_CLIENT_EXECUTION_ENABLED: "true",
      AI_GATEWAY_MULTI_INSTANCE: "true",
      AI_GATEWAY_LOCAL_CLIENT_EXECUTION_CLAIM_STORE_MODE: "sqlite",
      AI_GATEWAY_LOCAL_CLIENT_EXECUTION_CLAIM_SQLITE_PATH: join(tmpdir(), "claims.sqlite"),
      AI_GATEWAY_LOCAL_CLIENT_HOST_ID: "application-test-host",
      AI_GATEWAY_LOCAL_CLIENT_ROUTE_PLAN_STORE_MODE: "sqlite",
      AI_GATEWAY_LOCAL_CLIENT_ROUTE_PLAN_SQLITE_PATH: join(tmpdir(), "route-plans-multi.sqlite"),
    })).toThrow(expect.objectContaining({
      code: "LOCAL_CLIENT_EXECUTION_CLAIM_DISTRIBUTED_REQUIRED",
      blockers: ["claim_not_distributed"],
    }));
  });

  it("supports an explicit restart-safe single-host SQLite route-plan backend", async () => {
    const root = mkdtempSync(join(tmpdir(), "gateway-local-client-route-plan-app-"));
    let application;
    try {
      application = createGatewayApplication({
        AI_GATEWAY_LOCAL_CLIENT_ROUTE_PLAN_STORE_MODE: "sqlite",
        AI_GATEWAY_LOCAL_CLIENT_ROUTE_PLAN_SQLITE_PATH: join(root, "route-plans.sqlite"),
        AI_GATEWAY_LOCAL_CLIENT_HOST_ID: "application-test-host",
      });
      expect(application.localClientRoutePlanStore.status).toMatchObject({
        storageMode: "single-host-sqlite",
        durable: true,
        distributed: false,
        singleHost: true,
      });
    } finally {
      await closeTestApplication(application);
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("fails closed for invalid SQLite route-plan configuration", () => {
    expect(() => createGatewayApplication({
      AI_GATEWAY_LOCAL_CLIENT_ROUTE_PLAN_STORE_MODE: "sqlite",
    })).toThrow(expect.objectContaining({ code: "LOCAL_CLIENT_ROUTE_PLAN_HOST_ID_REQUIRED" }));
    expect(() => createGatewayApplication({
      AI_GATEWAY_LOCAL_CLIENT_ROUTE_PLAN_STORE_MODE: "sqlite",
      AI_GATEWAY_LOCAL_CLIENT_HOST_ID: "application-test-host",
      AI_GATEWAY_LOCAL_CLIENT_ROUTE_PLAN_TTL_MS: "not-a-number",
    })).toThrow(expect.objectContaining({ code: "LOCAL_CLIENT_ROUTE_PLAN_CONFIG_INVALID" }));
  });

  it("supports an explicit durable single-host SQLite execution-claim backend", async () => {
    const root = mkdtempSync(join(tmpdir(), "gateway-local-client-claim-app-"));
    let application;
    try {
      application = createGatewayApplication({
        AI_GATEWAY_LOCAL_CLIENT_EXECUTION_CLAIM_STORE_MODE: "sqlite",
        AI_GATEWAY_LOCAL_CLIENT_EXECUTION_CLAIM_SQLITE_PATH: join(root, "claims.sqlite"),
        AI_GATEWAY_LOCAL_CLIENT_EXECUTION_CLAIM_NAMESPACE: "application-local-client",
        AI_GATEWAY_LOCAL_CLIENT_EXECUTION_CLAIM_TTL_MS: "500",
        AI_GATEWAY_LOCAL_CLIENT_EXECUTION_CLAIM_MAX_CLAIMS: "8",
        AI_GATEWAY_LOCAL_CLIENT_EXECUTION_CLAIM_BUSY_TIMEOUT_MS: "100",
        AI_GATEWAY_LOCAL_CLIENT_HOST_ID: "application-test-host",
      });
      expect(application.localClientExecutionClaimStore.status).toMatchObject({
        mode: "sqlite-fenced",
        storageMode: "single-host-sqlite",
        available: true,
        durable: true,
        distributed: false,
        singleHost: true,
        ttlMs: 500,
        maxClaims: 8,
        busyTimeoutMs: 100,
      });
      expect(application.localClientExecutionReadiness).toMatchObject({
        requested: false,
        mode: "preview-only",
      });
      await expect(application.localClientExecutionClaimStore.checkHealth()).resolves.toMatchObject({
        activeClaims: 0,
        available: true,
      });
    } finally {
      await closeTestApplication(application);
      expect(application?.localClientExecutionClaimStore?.status.available).toBe(false);
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("fails closed for missing or invalid SQLite execution-claim configuration", () => {
    const safePath = join(tmpdir(), "gateway-local-client-invalid-claims.sqlite");
    expect(() => createGatewayApplication({
      AI_GATEWAY_LOCAL_CLIENT_EXECUTION_CLAIM_STORE_MODE: "unknown",
    })).toThrow(expect.objectContaining({ code: "LOCAL_CLIENT_EXECUTION_CLAIM_STORE_MODE_INVALID" }));
    expect(() => createGatewayApplication({
      AI_GATEWAY_LOCAL_CLIENT_EXECUTION_CLAIM_STORE_MODE: "sqlite",
      AI_GATEWAY_LOCAL_CLIENT_EXECUTION_CLAIM_SQLITE_PATH: safePath,
    })).toThrow(expect.objectContaining({ code: "LOCAL_CLIENT_EXECUTION_CLAIM_HOST_ID_REQUIRED" }));
    expect(() => createGatewayApplication({
      AI_GATEWAY_LOCAL_CLIENT_EXECUTION_CLAIM_STORE_MODE: "sqlite",
      AI_GATEWAY_LOCAL_CLIENT_HOST_ID: "application-test-host",
    })).toThrow(expect.objectContaining({ code: "LOCAL_CLIENT_EXECUTION_CLAIM_SQLITE_PATH_REQUIRED" }));
    expect(() => createGatewayApplication({
      AI_GATEWAY_LOCAL_CLIENT_EXECUTION_CLAIM_STORE_MODE: "sqlite",
      AI_GATEWAY_LOCAL_CLIENT_EXECUTION_CLAIM_SQLITE_PATH: ":memory:",
      AI_GATEWAY_LOCAL_CLIENT_HOST_ID: "application-test-host",
    })).toThrow(expect.objectContaining({ code: "LOCAL_CLIENT_EXECUTION_CLAIM_SQLITE_PATH_INVALID" }));
    for (const invalid of [
      { AI_GATEWAY_LOCAL_CLIENT_EXECUTION_CLAIM_TTL_MS: "9" },
      { AI_GATEWAY_LOCAL_CLIENT_EXECUTION_CLAIM_MAX_CLAIMS: "0" },
      { AI_GATEWAY_LOCAL_CLIENT_EXECUTION_CLAIM_BUSY_TIMEOUT_MS: "99" },
      { AI_GATEWAY_LOCAL_CLIENT_EXECUTION_CLAIM_NAMESPACE: "Not Portable" },
    ]) {
      expect(() => createGatewayApplication({
        AI_GATEWAY_LOCAL_CLIENT_EXECUTION_CLAIM_STORE_MODE: "sqlite",
        AI_GATEWAY_LOCAL_CLIENT_EXECUTION_CLAIM_SQLITE_PATH: safePath,
        AI_GATEWAY_LOCAL_CLIENT_HOST_ID: "application-test-host",
        ...invalid,
      })).toThrow(expect.objectContaining({ code: "LOCAL_CLIENT_EXECUTION_CLAIM_CONFIG_INVALID" }));
    }
  });

  it("rejects sharing one SQLite file between route plans and execution claims", () => {
    const sharedPath = join(tmpdir(), "gateway-local-client-shared.sqlite");
    expect(() => createGatewayApplication({
      AI_GATEWAY_LOCAL_CLIENT_ROUTE_PLAN_STORE_MODE: "sqlite",
      AI_GATEWAY_LOCAL_CLIENT_ROUTE_PLAN_SQLITE_PATH: sharedPath,
      AI_GATEWAY_LOCAL_CLIENT_EXECUTION_CLAIM_STORE_MODE: "sqlite",
      AI_GATEWAY_LOCAL_CLIENT_EXECUTION_CLAIM_SQLITE_PATH: sharedPath,
      AI_GATEWAY_LOCAL_CLIENT_HOST_ID: "application-test-host",
    })).toThrow(expect.objectContaining({
      code: "LOCAL_CLIENT_EXECUTION_CLAIM_SQLITE_PATH_CONFLICT",
    }));
  });

  it("validates explicit authority-epoch configuration and dedicated paths", () => {
    const root = mkdtempSync(join(tmpdir(), "gateway-local-client-authority-config-"));
    const sharedPath = join(root, "shared.sqlite");
    try {
      expect(() => createGatewayApplication({
        AI_GATEWAY_LOCAL_CLIENT_AUTHORITY_EPOCH_STORE_MODE: "unknown",
      })).toThrow(expect.objectContaining({
        code: "LOCAL_CLIENT_AUTHORITY_EPOCH_STORE_MODE_INVALID",
      }));
      expect(() => createGatewayApplication({
        AI_GATEWAY_LOCAL_CLIENT_AUTHORITY_EPOCH_STORE_MODE: "sqlite",
        AI_GATEWAY_LOCAL_CLIENT_AUTHORITY_EPOCH_SQLITE_PATH: join(root, "authority.sqlite"),
      })).toThrow(expect.objectContaining({
        code: "LOCAL_CLIENT_AUTHORITY_EPOCH_HOST_ID_REQUIRED",
      }));
      expect(() => createGatewayApplication({
        AI_GATEWAY_LOCAL_CLIENT_AUTHORITY_EPOCH_STORE_MODE: "sqlite",
        AI_GATEWAY_LOCAL_CLIENT_AUTHORITY_EPOCH_SQLITE_PATH: join(root, "authority.sqlite"),
        AI_GATEWAY_LOCAL_CLIENT_HOST_ID: "authority-config-test-host",
      })).toThrow(expect.objectContaining({
        code: "LOCAL_CLIENT_AUTHORITY_EPOCH_INTEGRITY_KEY_REQUIRED",
      }));
      expect(() => createGatewayApplication({
        AI_GATEWAY_LOCAL_CLIENT_ROUTE_PLAN_STORE_MODE: "sqlite",
        AI_GATEWAY_LOCAL_CLIENT_ROUTE_PLAN_SQLITE_PATH: sharedPath,
        AI_GATEWAY_LOCAL_CLIENT_AUTHORITY_EPOCH_STORE_MODE: "sqlite",
        AI_GATEWAY_LOCAL_CLIENT_AUTHORITY_EPOCH_SQLITE_PATH: sharedPath,
        AI_GATEWAY_LOCAL_CLIENT_HOST_ID: "authority-config-test-host",
      })).toThrow(expect.objectContaining({
        code: "LOCAL_CLIENT_AUTHORITY_EPOCH_SQLITE_PATH_CONFLICT",
      }));
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  itDurableLocalClientSqlite("constructs an explicit single-host feedback dedup store with bounded status", async () => {
    const root = mkdtempSync(join(tmpdir(), "gateway-local-client-feedback-dedup-"));
    const env = localClientFeedbackDedupTestEnv(root);
    let application;
    try {
      application = createGatewayApplication(env);
      expect(application.localClientFeedbackDedupStore).toBeDefined();
      expect(application.localClientFeedbackDedupStatus).toMatchObject({
        mode: "sqlite-feedback-dedup",
        storageMode: "single-host-sqlite",
        available: true,
        durable: true,
        distributed: false,
        singleHost: true,
        ttlMs: 90_000,
        leaseTtlMs: 5_000,
        maxEvents: 64,
        busyTimeoutMs: 100,
        aggregateMutationPerformed: false,
      });
      await expect(application.localClientFeedbackDedupStore.checkHealth()).resolves.toMatchObject({
        activeEvents: 0,
        pendingEvents: 0,
        appliedEvents: 0,
      });
      expect(JSON.stringify(application.localClientFeedbackDedupStatus)).not.toContain("abababab");
      const firstStore = application.localClientFeedbackDedupStore;
      await closeTestApplication(application);
      expect(firstStore.status.available).toBe(false);
      application = createGatewayApplication(env);
      await expect(application.localClientFeedbackDedupStore.checkHealth()).resolves.toMatchObject({
        available: true,
        activeEvents: 0,
      });
    } finally {
      await closeTestApplication(application);
      expect(application?.localClientFeedbackDedupStore?.status.available).toBe(false);
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("fails closed for feedback dedup mode, host, path, limits, multi-instance, and path conflicts", () => {
    const root = mkdtempSync(join(tmpdir(), "gateway-local-client-feedback-config-"));
    const dedupPath = join(root, "feedback.sqlite");
    try {
      expect(() => createGatewayApplication({
        AI_GATEWAY_LOCAL_CLIENT_EXECUTION_ENABLED: "true",
        AI_GATEWAY_LOCAL_CLIENT_ALLOW_REGISTRY_ONLY_ROLLBACK_DETECTION: "true",
        AI_GATEWAY_LOCAL_CLIENT_HOST_ID: "feedback-execution-test-host",
        AI_GATEWAY_LOCAL_CLIENT_ROUTE_PLAN_STORE_MODE: "sqlite",
        AI_GATEWAY_LOCAL_CLIENT_ROUTE_PLAN_SQLITE_PATH: join(root, "route-plans.sqlite"),
        AI_GATEWAY_LOCAL_CLIENT_EXECUTION_CLAIM_STORE_MODE: "sqlite",
        AI_GATEWAY_LOCAL_CLIENT_EXECUTION_CLAIM_SQLITE_PATH: join(root, "claims.sqlite"),
        AI_GATEWAY_LOCAL_CLIENT_AUTHORITY_EPOCH_STORE_MODE: "sqlite",
        AI_GATEWAY_LOCAL_CLIENT_AUTHORITY_EPOCH_SQLITE_PATH: join(root, "authority.sqlite"),
        AI_GATEWAY_IDEMPOTENCY_STORE_MODE: "sqlite",
        AI_GATEWAY_IDEMPOTENCY_SQLITE_PATH: join(root, "idempotency.sqlite"),
        AI_GATEWAY_IDEMPOTENCY_HMAC_SECRET: "feedback-execution-idempotency".padEnd(64, "x"),
        AI_GATEWAY_EXTERNAL_EFFECT_STORE_MODE: "sqlite",
        AI_GATEWAY_EXTERNAL_EFFECT_SQLITE_PATH: join(root, "effects.sqlite"),
        AI_GATEWAY_EXTERNAL_EFFECT_HMAC_SECRET: "feedback-execution-effects".padEnd(64, "x"),
      })).toThrow(expect.objectContaining({
        code: "LOCAL_CLIENT_FEEDBACK_DEDUP_STORE_REQUIRED",
      }));
      expect(() => createGatewayApplication({
        AI_GATEWAY_LOCAL_CLIENT_EXECUTION_ENABLED: "true",
        AI_GATEWAY_LOCAL_CLIENT_ALLOW_REGISTRY_ONLY_ROLLBACK_DETECTION: "true",
        AI_GATEWAY_LOCAL_CLIENT_HOST_ID: "feedback-execution-test-host",
        AI_GATEWAY_LOCAL_CLIENT_ROUTE_PLAN_STORE_MODE: "sqlite",
        AI_GATEWAY_LOCAL_CLIENT_ROUTE_PLAN_SQLITE_PATH: join(root, "required-route-plans.sqlite"),
        AI_GATEWAY_LOCAL_CLIENT_EXECUTION_CLAIM_STORE_MODE: "sqlite",
        AI_GATEWAY_LOCAL_CLIENT_EXECUTION_CLAIM_SQLITE_PATH: join(root, "required-claims.sqlite"),
        AI_GATEWAY_LOCAL_CLIENT_AUTHORITY_EPOCH_STORE_MODE: "sqlite",
        AI_GATEWAY_LOCAL_CLIENT_AUTHORITY_EPOCH_SQLITE_PATH: join(root, "required-authority.sqlite"),
        AI_GATEWAY_LOCAL_CLIENT_FEEDBACK_DEDUP_STORE_MODE: "sqlite",
        AI_GATEWAY_LOCAL_CLIENT_FEEDBACK_DEDUP_SQLITE_PATH: join(root, "required-feedback.sqlite"),
        AI_GATEWAY_IDEMPOTENCY_STORE_MODE: "sqlite",
        AI_GATEWAY_IDEMPOTENCY_SQLITE_PATH: join(root, "required-idempotency.sqlite"),
        AI_GATEWAY_IDEMPOTENCY_HMAC_SECRET: "feedback-required-idempotency".padEnd(64, "x"),
        AI_GATEWAY_EXTERNAL_EFFECT_STORE_MODE: "sqlite",
        AI_GATEWAY_EXTERNAL_EFFECT_SQLITE_PATH: join(root, "required-effects.sqlite"),
        AI_GATEWAY_EXTERNAL_EFFECT_HMAC_SECRET: "feedback-required-effects".padEnd(64, "x"),
      })).toThrow(expect.objectContaining({
        code: "LOCAL_CLIENT_EXECUTION_FEEDBACK_OUTBOX_STORE_REQUIRED",
      }));
      expect(() => createGatewayApplication({
        AI_GATEWAY_LOCAL_CLIENT_FEEDBACK_DEDUP_STORE_MODE: "unknown",
      })).toThrow(expect.objectContaining({
        code: "LOCAL_CLIENT_FEEDBACK_DEDUP_STORE_MODE_INVALID",
      }));
      expect(() => createGatewayApplication({
        AI_GATEWAY_LOCAL_CLIENT_FEEDBACK_DEDUP_STORE_MODE: "sqlite",
        AI_GATEWAY_LOCAL_CLIENT_FEEDBACK_DEDUP_SQLITE_PATH: dedupPath,
      })).toThrow(expect.objectContaining({
        code: "LOCAL_CLIENT_FEEDBACK_DEDUP_HOST_ID_REQUIRED",
      }));
      expect(() => createGatewayApplication({
        AI_GATEWAY_LOCAL_CLIENT_FEEDBACK_DEDUP_STORE_MODE: "sqlite",
        AI_GATEWAY_LOCAL_CLIENT_HOST_ID: "feedback-config-test-host",
      })).toThrow(expect.objectContaining({
        code: "LOCAL_CLIENT_FEEDBACK_DEDUP_SQLITE_PATH_REQUIRED",
      }));
      expect(() => createGatewayApplication({
        AI_GATEWAY_LOCAL_CLIENT_FEEDBACK_DEDUP_STORE_MODE: "sqlite",
        AI_GATEWAY_LOCAL_CLIENT_FEEDBACK_DEDUP_SQLITE_PATH: dedupPath,
        AI_GATEWAY_LOCAL_CLIENT_HOST_ID: "feedback-config-test-host",
        AI_GATEWAY_MULTI_INSTANCE: "true",
      })).toThrow(expect.objectContaining({
        code: "LOCAL_CLIENT_FEEDBACK_DEDUP_MULTI_INSTANCE_UNSUPPORTED",
      }));
      expect(() => createGatewayApplication({
        AI_GATEWAY_LOCAL_CLIENT_FEEDBACK_DEDUP_STORE_MODE: "sqlite",
        AI_GATEWAY_LOCAL_CLIENT_FEEDBACK_DEDUP_SQLITE_PATH: dedupPath,
        AI_GATEWAY_LOCAL_CLIENT_REGISTRY_PATH: dedupPath,
        AI_GATEWAY_LOCAL_CLIENT_HOST_ID: "feedback-config-test-host",
      })).toThrow(expect.objectContaining({
        code: "LOCAL_CLIENT_FEEDBACK_DEDUP_SQLITE_PATH_CONFLICT",
      }));
      expect(() => createGatewayApplication({
        AI_GATEWAY_LOCAL_CLIENT_FEEDBACK_DEDUP_STORE_MODE: "sqlite",
        AI_GATEWAY_LOCAL_CLIENT_FEEDBACK_DEDUP_SQLITE_PATH: dedupPath,
        AI_GATEWAY_LOCAL_CLIENT_HOST_ID: "feedback-config-test-host",
      })).toThrow(expect.objectContaining({
        code: "LOCAL_CLIENT_FEEDBACK_DEDUP_INTEGRITY_KEY_REQUIRED",
      }));
      expect(() => createGatewayApplication({
        ...localClientFeedbackDedupTestEnv(root),
        AI_GATEWAY_LOCAL_CLIENT_FEEDBACK_DEDUP_TTL_MS: "9",
      })).toThrow(expect.objectContaining({
        code: "LOCAL_CLIENT_FEEDBACK_DEDUP_CONFIG_INVALID",
      }));
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  itDurableLocalClientSqlite("closes a created feedback store when a later registry preflight fails", () => {
    const root = mkdtempSync(join(tmpdir(), "gateway-local-client-feedback-cleanup-"));
    const env = localClientFeedbackDedupTestEnv(root);
    writeFileSync(env.AI_GATEWAY_LOCAL_CLIENT_REGISTRY_PATH, "{not-json", "utf8");
    const closeSpy = vi.spyOn(LocalClientSqliteFeedbackDedupStore.prototype, "close");
    try {
      expect(() => createGatewayApplication(env)).toThrow(expect.objectContaining({
        code: "local_client_registry_corrupt",
      }));
      expect(closeSpy).toHaveBeenCalledTimes(1);
    } finally {
      closeSpy.mockRestore();
      rmSync(root, { recursive: true, force: true });
    }
  });

  itDurableLocalClientSqlite("composes and validates the durable execution-feedback outbox and dispatcher", async () => {
    const root = mkdtempSync(join(tmpdir(), "gateway-local-client-feedback-outbox-config-"));
    const base = localClientFeedbackDedupTestEnv(root);
    let application;
    try {
      expect(() => createGatewayApplication({
        AI_GATEWAY_LOCAL_CLIENT_EXECUTION_FEEDBACK_OUTBOX_STORE_MODE: "unknown",
      })).toThrow(expect.objectContaining({
        code: "LOCAL_CLIENT_EXECUTION_FEEDBACK_OUTBOX_STORE_MODE_INVALID",
      }));
      expect(() => createGatewayApplication({
        ...base,
        AI_GATEWAY_LOCAL_CLIENT_EXECUTION_FEEDBACK_OUTBOX_STORE_MODE: "sqlite",
      })).toThrow(expect.objectContaining({
        code: "LOCAL_CLIENT_EXECUTION_FEEDBACK_OUTBOX_SQLITE_PATH_REQUIRED",
      }));
      expect(() => createGatewayApplication({
        ...base,
        AI_GATEWAY_LOCAL_CLIENT_EXECUTION_FEEDBACK_OUTBOX_SQLITE_PATH: join(root, "outbox.sqlite"),
      })).toThrow(expect.objectContaining({
        code: "LOCAL_CLIENT_EXECUTION_FEEDBACK_OUTBOX_CONFIG_INVALID",
      }));
      expect(() => createGatewayApplication({
        ...base,
        AI_GATEWAY_LOCAL_CLIENT_EXECUTION_FEEDBACK_OUTBOX_STORE_MODE: "sqlite",
        AI_GATEWAY_LOCAL_CLIENT_EXECUTION_FEEDBACK_OUTBOX_SQLITE_PATH:
          base.AI_GATEWAY_LOCAL_CLIENT_FEEDBACK_DEDUP_SQLITE_PATH,
      })).toThrow(expect.objectContaining({
        code: "LOCAL_CLIENT_FEEDBACK_DEDUP_SQLITE_PATH_CONFLICT",
      }));
      expect(() => createGatewayApplication({
        ...base,
        AI_GATEWAY_LOCAL_CLIENT_EXECUTION_FEEDBACK_OUTBOX_STORE_MODE: "sqlite",
        AI_GATEWAY_LOCAL_CLIENT_EXECUTION_FEEDBACK_OUTBOX_SQLITE_PATH: join(root, "outbox-budget.sqlite"),
        AI_GATEWAY_LOCAL_CLIENT_EXECUTION_FEEDBACK_OUTBOX_LEASE_TTL_MS: "1000",
        AI_GATEWAY_LOCAL_CLIENT_EXECUTION_FEEDBACK_DELIVERY_TIMEOUT_MS: "1000",
        AI_GATEWAY_LOCAL_CLIENT_EXECUTION_FEEDBACK_DISPATCH_BATCH_SIZE: "1",
      })).toThrow(expect.objectContaining({
        code: "LOCAL_CLIENT_EXECUTION_FEEDBACK_OUTBOX_DELIVERY_BUDGET_INVALID",
      }));

      application = createGatewayApplication({
        ...base,
        AI_GATEWAY_LOCAL_CLIENT_EXECUTION_FEEDBACK_OUTBOX_STORE_MODE: "sqlite",
        AI_GATEWAY_LOCAL_CLIENT_EXECUTION_FEEDBACK_OUTBOX_SQLITE_PATH: join(root, "outbox.sqlite"),
        AI_GATEWAY_LOCAL_CLIENT_EXECUTION_FEEDBACK_OUTBOX_NAMESPACE: "application-feedback-outbox",
        AI_GATEWAY_LOCAL_CLIENT_EXECUTION_FEEDBACK_DISPATCH_INTERVAL_MS: "60000",
      });
      expect(application.localClientExecutionFeedbackOutboxStatus).toMatchObject({
        available: true,
        durable: true,
        distributed: false,
        pendingTtlApplied: false,
      });
      expect(application.localClientExecutionFeedbackDispatcherStatus).toMatchObject({
        enabled: true,
        lifecycle: "started",
        batchSize: 4,
      });
      await expect(application.localClientExecutionFeedbackDispatcher.checkHealth())
        .resolves.toMatchObject({ outbox: { totalEvents: 0, pendingEvents: 0 } });
    } finally {
      await closeTestApplication(application);
      rmSync(root, { recursive: true, force: true });
    }
  });

  itDurableLocalClientSqlite("composes and validates per-client durable receipt reconciliation journals", async () => {
    const root = mkdtempSync(join(tmpdir(), "gateway-local-client-receipt-reconcile-config-"));
    const base = localClientFeedbackDedupTestEnv(root);
    let application;
    try {
      expect(() => createGatewayApplication({
        AI_GATEWAY_LOCAL_CLIENT_RECEIPT_RECONCILIATION_STORE_MODE: "unknown",
      })).toThrow(expect.objectContaining({
        code: "LOCAL_CLIENT_RECEIPT_RECONCILIATION_STORE_MODE_INVALID",
      }));
      expect(() => createGatewayApplication({
        ...base,
        AI_GATEWAY_LOCAL_CLIENT_RECEIPT_RECONCILIATION_STORE_MODE: "sqlite",
      })).toThrow(expect.objectContaining({
        code: "LOCAL_CLIENT_RECEIPT_RECONCILIATION_DIRECTORY_REQUIRED",
      }));
      expect(() => createGatewayApplication({
        ...base,
        AI_GATEWAY_LOCAL_CLIENT_RECEIPT_RECONCILIATION_DIR: join(root, "disabled-journals"),
      })).toThrow(expect.objectContaining({
        code: "LOCAL_CLIENT_RECEIPT_RECONCILIATION_CONFIG_INVALID",
      }));
      expect(() => createGatewayApplication({
        ...base,
        AI_GATEWAY_LOCAL_CLIENT_RECEIPT_RECONCILIATION_STORE_MODE: "sqlite",
        AI_GATEWAY_LOCAL_CLIENT_RECEIPT_RECONCILIATION_DIR: join(root, "short-intent"),
        AI_GATEWAY_LOCAL_CLIENT_RECEIPT_RECONCILIATION_INTENT_TTL_MS: "5000",
      })).toThrow(expect.objectContaining({
        code: "LOCAL_CLIENT_RECEIPT_RECONCILIATION_INTENT_TTL_INVALID",
      }));
      expect(() => createGatewayApplication({
        ...base,
        AI_GATEWAY_LOCAL_CLIENT_RECEIPT_RECONCILIATION_STORE_MODE: "sqlite",
        AI_GATEWAY_LOCAL_CLIENT_RECEIPT_RECONCILIATION_DIR: join(root, "short-query"),
        AI_GATEWAY_LOCAL_CLIENT_RECEIPT_RECONCILIATION_QUERY_TTL_MS: "5000",
      })).toThrow(expect.objectContaining({
        code: "LOCAL_CLIENT_RECEIPT_RECONCILIATION_QUERY_TTL_INVALID",
      }));
      expect(() => createGatewayApplication({
        ...base,
        AI_GATEWAY_LOCAL_CLIENT_RECEIPT_RECONCILIATION_STORE_MODE: "sqlite",
        AI_GATEWAY_LOCAL_CLIENT_RECEIPT_RECONCILIATION_DIR: join(root, "short-recovery-grace"),
        AI_GATEWAY_LOCAL_CLIENT_RECEIPT_RECOVERY_GRACE_MS: "5000",
      })).toThrow(expect.objectContaining({
        code: "LOCAL_CLIENT_RECEIPT_RECONCILIATION_RECOVERY_GRACE_INVALID",
      }));
      expect(() => createGatewayApplication({
        ...base,
        AI_GATEWAY_LOCAL_CLIENT_RECEIPT_RECONCILIATION_STORE_MODE: "sqlite",
        AI_GATEWAY_LOCAL_CLIENT_RECEIPT_RECONCILIATION_DIR: parse(root).root,
      })).toThrow(expect.objectContaining({
        code: "LOCAL_CLIENT_RECEIPT_RECONCILIATION_DIRECTORY_INVALID",
      }));
      for (const conflictingStatePathName of [
        "AI_GATEWAY_LOCAL_CLIENT_AUTHORITY_EPOCH_SQLITE_PATH",
        "AI_GATEWAY_LOCAL_CLIENT_ONBOARDING_RECEIPT_AUTHORITY_SQLITE_PATH",
      ]) {
        const receiptDirectory = join(root, `${conflictingStatePathName.toLowerCase()}-receipts`);
        expect(() => createGatewayApplication({
          ...base,
          AI_GATEWAY_LOCAL_CLIENT_RECEIPT_RECONCILIATION_STORE_MODE: "sqlite",
          AI_GATEWAY_LOCAL_CLIENT_RECEIPT_RECONCILIATION_DIR: receiptDirectory,
          [conflictingStatePathName]: join(receiptDirectory, "authority.sqlite"),
        })).toThrow(expect.objectContaining({
          code: "LOCAL_CLIENT_RECEIPT_RECONCILIATION_DIRECTORY_CONFLICT",
        }));
      }
      const parentStatePath = join(root, "receipt-parent-state.sqlite");
      expect(() => createGatewayApplication({
        ...base,
        AI_GATEWAY_LOCAL_CLIENT_RECEIPT_RECONCILIATION_STORE_MODE: "sqlite",
        AI_GATEWAY_LOCAL_CLIENT_RECEIPT_RECONCILIATION_DIR: join(parentStatePath, "receipts"),
        AI_GATEWAY_LOCAL_CLIENT_AUTHORITY_EPOCH_SQLITE_PATH: parentStatePath,
      })).toThrow(expect.objectContaining({
        code: "LOCAL_CLIENT_RECEIPT_RECONCILIATION_DIRECTORY_CONFLICT",
      }));
      const equalStateAndReceiptPath = join(root, "equal-state-and-receipts");
      expect(() => createGatewayApplication({
        ...base,
        AI_GATEWAY_LOCAL_CLIENT_RECEIPT_RECONCILIATION_STORE_MODE: "sqlite",
        AI_GATEWAY_LOCAL_CLIENT_RECEIPT_RECONCILIATION_DIR: equalStateAndReceiptPath,
        AI_GATEWAY_LOCAL_CLIENT_ONBOARDING_RECEIPT_AUTHORITY_SQLITE_PATH:
          equalStateAndReceiptPath,
      })).toThrow(expect.objectContaining({
        code: "LOCAL_CLIENT_RECEIPT_RECONCILIATION_DIRECTORY_CONFLICT",
      }));

      application = createGatewayApplication({
        ...base,
        AI_GATEWAY_LOCAL_CLIENT_RECEIPT_RECONCILIATION_STORE_MODE: "sqlite",
        AI_GATEWAY_LOCAL_CLIENT_RECEIPT_RECONCILIATION_DIR: join(root, "journals"),
        AI_GATEWAY_LOCAL_CLIENT_RECEIPT_RECONCILIATION_NAMESPACE: "application-receipts",
      });
      expect(application.localClientExecutionReceiptJournalStatus).toMatchObject({
        enabled: true,
        available: true,
        durable: true,
        distributed: false,
        bindingCount: 1,
        recoveryContextEncrypted: true,
        snapshotRollbackProtected: false,
        clientAtomicEffectReceiptVerified: false,
      });
      expect(application.localClientExecutionReceiptRecoveryService).toBeNull();
      expect(application.localClientExecutionReceiptRecoveryStatus).toMatchObject({
        enabled: false,
        lifecycle: "disabled",
      });
      expect(application.localClientExecutionReceiptJournalRegistry.resolve({
        tenantId: "tenant-feedback-test",
        clientId: "feedback.client",
      })).toBeDefined();
      expect(application.localClientExecutionReceiptJournalRegistry.resolve({
        tenantId: "wrong-tenant",
        clientId: "feedback.client",
      })).toBeNull();
    } finally {
      await closeTestApplication(application);
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("requires gateway authority secret bytes to differ from every loopback client secret", () => {
    const root = mkdtempSync(join(tmpdir(), "gateway-local-client-secret-separation-"));
    try {
      const env = localClientFeedbackDedupTestEnv(root);
      expect(() => createGatewayApplication({
        ...env,
        LOCAL_CLIENT_FEEDBACK_TEST_REGISTRY_SECRET: env.LOCAL_CLIENT_FEEDBACK_TEST_SECRET,
      })).toThrow(expect.objectContaining({
        code: "LOCAL_CLIENT_LOOPBACK_REGISTRY_SECRET_NOT_SEPARATE",
      }));
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  itDurableLocalClientSqlite("keeps the gateway receipt filename stable and rejects client-only secret rotation", async () => {
    const root = mkdtempSync(join(tmpdir(), "gateway-local-client-receipt-secret-rotation-"));
    const receiptDirectory = join(root, "receipt-journals");
    const env = {
      ...localClientFeedbackDedupTestEnv(root),
      AI_GATEWAY_LOCAL_CLIENT_RECEIPT_RECONCILIATION_STORE_MODE: "sqlite",
      AI_GATEWAY_LOCAL_CLIENT_RECEIPT_RECONCILIATION_DIR: receiptDirectory,
      AI_GATEWAY_LOCAL_CLIENT_RECEIPT_RECONCILIATION_NAMESPACE: "secret-rotation-receipts",
    };
    let application;
    try {
      application = createGatewayApplication(env);
      const journal = application.localClientExecutionReceiptJournalRegistry.resolve({
        tenantId: "tenant-feedback-test",
        clientId: "feedback.client",
      });
      const identity = {
        executionId: `lc-exec-${"9".repeat(64)}`,
        tenantId: "tenant-feedback-test",
        subjectId: "receipt-secret-rotation-subject",
        clientId: "feedback.client",
        capabilityId: "local_application",
        actionId: "invoke",
        planFingerprint: "8".repeat(64),
        inputSha256: "7".repeat(64),
      };
      await journal.prepareDispatch(identity);
      await journal.armDispatch(identity);
      const receiptFilesBefore = readdirSync(receiptDirectory)
        .filter((name) => name.endsWith(".sqlite"));
      expect(receiptFilesBefore).toHaveLength(1);

      await closeTestApplication(application);
      application = undefined;

      expect(() => createGatewayApplication({
        ...env,
        LOCAL_CLIENT_FEEDBACK_TEST_SECRET: `hex:${"bc".repeat(32)}`,
      })).toThrow(expect.objectContaining({
        code: "LOCAL_CLIENT_RECEIPT_RECONCILIATION_KEY_MISMATCH",
      }));
      expect(readdirSync(receiptDirectory).filter((name) => name.endsWith(".sqlite")))
        .toEqual(receiptFilesBefore);
    } finally {
      await closeTestApplication(application);
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("fails invalid adapter startup before onboarding targets or authority state are created", () => {
    const root = mkdtempSync(join(tmpdir(), "gateway-local-client-onboarding-adapter-cleanup-"));
    const env = {
      ...localClientOnboardingTestEnv(root),
      AI_GATEWAY_LOCAL_CLIENT_LOOPBACK_ENABLED: "true",
    };
    try {
      expect(() => createGatewayApplication(env)).toThrow(expect.objectContaining({
        code: expect.stringMatching(/^LOCAL_CLIENT_LOOPBACK_/u),
      }));
      expect(existsSync(env.AI_GATEWAY_LOCAL_CLIENT_ONBOARDING_RECEIPT_AUTHORITY_SQLITE_PATH)).toBe(false);
      for (const targetPath of onboardingTargetPaths(root)) expect(existsSync(targetPath)).toBe(false);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  itDurableLocalClientSqlite("closes receipt authority when later idempotency construction fails", () => {
    const root = mkdtempSync(join(tmpdir(), "gateway-local-client-onboarding-idempotency-cleanup-"));
    const env = localClientOnboardingTestEnv(root);
    mkdirSync(env.AI_GATEWAY_IDEMPOTENCY_SQLITE_PATH, { recursive: true });
    const closeSpy = vi.spyOn(LocalClientSqliteOnboardingReceiptAuthorityStore.prototype, "close");
    try {
      expect(() => createGatewayApplication(env)).toThrow();
      expect(closeSpy).toHaveBeenCalledTimes(1);
    } finally {
      closeSpy.mockRestore();
      rmSync(root, { recursive: true, force: true });
    }
  });

  itDurableLocalClientSqlite("composes governed onboarding lazily without route-plan, claim, or epoch stores", async () => {
    const root = mkdtempSync(join(tmpdir(), "gateway-local-client-onboarding-app-"));
    const env = localClientOnboardingTestEnv(root);
    let application;
    try {
      application = createGatewayApplication(env);
      expect(application.localClientGovernedOnboardingRuntime).toBeDefined();
      expect(application.localClientGovernedOnboardingApi).toBeDefined();
      expect(application.localClientGovernedOnboardingStatus).toMatchObject({
        enabled: true,
        initializationState: "not-started",
        configuredProfileCount: 3,
        format: "json-only",
        certificationStatus: "fixture-tested-not-real-client-certified",
        requiresExplicitApproval: true,
        requiresDurableIdempotency: true,
        requiresDurableExternalEffectFence: true,
        requiresDurableReceiptAuthority: true,
        automaticDiscoveryOrMutation: false,
        sensitiveConfigurationRedacted: true,
        tenantOwned: true,
        backupProtection: "aes-256-gcm",
      });
      expect(application.localClientRoutePlanStore.status).toMatchObject({
        storageMode: "single-process-memory",
      });
      expect(application.localClientExecutionClaimStore).toBeNull();
      expect(application.localClientAuthorityEpochStore).toBeNull();
      expect(application.localClientOnboardingReceiptAuthorityStore).toBeDefined();
      expect(application.localClientOnboardingReceiptAuthorityStatus).toMatchObject({
        mode: "sqlite-onboarding-receipt-authority",
        available: true,
        durable: true,
        distributed: false,
        oneTimeRollbackAuthorization: true,
      });
      expect(application.idempotencyCoordinator.getStats()).toMatchObject({
        storeMode: "sqlite",
      });
      expect(application.externalEffectGate.status).toMatchObject({
        mode: "sqlite",
        enabled: true,
        durable: true,
        distributed: false,
      });
      expect(application.localClientExecutionControl.getHealth()).toMatchObject({
        mode: "local-atomic-json",
        durable: true,
        distributed: false,
        centralRequired: false,
      });
      for (const targetPath of onboardingTargetPaths(root)) {
        expect(existsSync(targetPath)).toBe(false);
      }
      expect(JSON.stringify(application.localClientGovernedOnboardingStatus)).not.toContain(root);
      expect(JSON.stringify(application.localClientGovernedOnboardingStatus)).not.toContain("gateway-entry.mjs");
    } finally {
      await closeTestApplication(application);
      rmSync(root, { recursive: true, force: true });
    }
  });

  itDurableLocalClientSqlite("runs a governed onboarding enable, replay, verify, and exact rollback through the composed app", async () => {
    const root = mkdtempSync(join(tmpdir(), "gateway-local-client-onboarding-flow-"));
    const env = localClientOnboardingTestEnv(root);
    for (const targetPath of onboardingTargetPaths(root)) {
      mkdirSync(join(targetPath, ".."), { recursive: true });
      writeFileSync(targetPath, `${JSON.stringify({ unrelated: { keep: true } }, null, 2)}\n`, "utf8");
    }
    const existingSecret = "existing-client-secret-must-be-encrypted-in-backup";
    const cursorInitial = {
      unrelated: { keep: true },
      mcpServers: {
        existing: {
          command: "existing-command",
          env: { API_KEY: existingSecret },
        },
      },
    };
    writeFileSync(
      onboardingTargetPaths(root)[1],
      `${JSON.stringify(cursorInitial, null, 2)}\n`,
      "utf8",
    );
    let application;
    const identity = { tenantId: "tenant-onboarding-flow", subjectId: "operator-onboarding-flow" };
    const requestPort = (key) => ({
      getHeader: (name) => String(name).toLowerCase() === "idempotency-key" ? key : undefined,
      signal: new AbortController().signal,
    });
    try {
      application = createGatewayApplication(env);
      const profiles = await application.localClientGovernedOnboardingApi.list(identity);
      expect(profiles).toHaveLength(3);
      expect(application.localClientGovernedOnboardingRuntime.getStatus()).toMatchObject({
        initializationState: "ready",
      });

      const plan = await application.localClientGovernedOnboardingApi.plan({
        ...identity,
        profileId: "cursor-mcp-json",
        action: "enable",
      });
      await application.localClientGovernedOnboardingApi.approve(
        { ...identity, planId: plan.planId, note: "explicit temp-fixture approval" },
        requestPort("app-onboarding-approve-enable"),
      );
      const first = await application.localClientGovernedOnboardingApi.apply(
        { ...identity, planId: plan.planId },
        requestPort("app-onboarding-apply-enable"),
      );
      const replay = await application.localClientGovernedOnboardingApi.apply(
        { ...identity, planId: plan.planId },
        requestPort("app-onboarding-apply-enable"),
      );
      expect(first).toMatchObject({
        accepted: true,
        replayed: false,
        result: { operation: "apply", action: "enable", redacted: true },
      });
      expect(replay).toMatchObject({ accepted: true, replayed: true });
      await expect(application.localClientGovernedOnboardingApi.verify({
        ...identity,
        profileId: "cursor-mcp-json",
      })).resolves.toMatchObject({ installed: true, state: "exact", redacted: true });

      const cursorTarget = onboardingTargetPaths(root)[1];
      expect(JSON.parse(readFileSync(cursorTarget, "utf8"))).toMatchObject({
        unrelated: { keep: true },
        mcpServers: {
          existing: {
            command: "existing-command",
            env: { API_KEY: existingSecret },
          },
          "unified-ai-system": {
            command: join(root, "bin", "node.exe"),
            args: [join(root, "gateway-entry.mjs"), "--mcp"],
          },
        },
      });
      const backupFiles = readdirSync(join(root, "cursor-backups"));
      expect(backupFiles).toHaveLength(1);
      const encryptedBackup = readFileSync(join(root, "cursor-backups", backupFiles[0]), "utf8");
      expect(encryptedBackup).toContain("local-client-config-backup-aes-256-gcm-v1");
      expect(encryptedBackup).not.toContain(existingSecret);

      await closeTestApplication(application);
      application = createGatewayApplication(env);
      const restartedReplay = await application.localClientGovernedOnboardingApi.apply(
        { ...identity, planId: plan.planId },
        requestPort("app-onboarding-apply-enable"),
      );
      expect(restartedReplay).toMatchObject({
        accepted: true,
        replayed: true,
        result: { operation: "apply", action: "enable", redacted: true },
      });

      const rollbackPlan = await application.localClientGovernedOnboardingApi.plan({
        ...identity,
        profileId: "cursor-mcp-json",
        action: "rollback",
        receipt: first.result.receipt,
      });
      await application.localClientGovernedOnboardingApi.approve(
        { ...identity, planId: rollbackPlan.planId },
        requestPort("app-onboarding-approve-rollback"),
      );
      const rollback = await application.localClientGovernedOnboardingApi.rollback(
        { ...identity, planId: rollbackPlan.planId },
        requestPort("app-onboarding-rollback"),
      );
      expect(rollback).toMatchObject({
        accepted: true,
        result: { operation: "rollback", action: "rollback", redacted: true },
      });
      expect(JSON.parse(readFileSync(cursorTarget, "utf8"))).toEqual(cursorInitial);
      const publicOutput = JSON.stringify({ profiles, plan, first, replay, restartedReplay, rollback });
      expect(publicOutput).not.toContain(root);
      expect(publicOutput).not.toContain("gateway-entry.mjs");
    } finally {
      await closeTestApplication(application);
      rmSync(root, { recursive: true, force: true });
    }
  });

  itDurableLocalClientSqlite("accepts an explicit local external-effect secret path for governed onboarding", async () => {
    const root = mkdtempSync(join(tmpdir(), "gateway-local-client-onboarding-secret-path-"));
    const secretPath = join(root, "secrets", "external-effect.key");
    const env = {
      ...localClientOnboardingTestEnv(root),
      AI_GATEWAY_EXTERNAL_EFFECT_HMAC_SECRET: undefined,
      AI_GATEWAY_EXTERNAL_EFFECT_HMAC_SECRET_PATH: secretPath,
    };
    let application;
    try {
      application = createGatewayApplication(env);
      expect(application.localClientGovernedOnboardingStatus).toMatchObject({
        enabled: true,
        initializationState: "not-started",
      });
      expect(application.externalEffectGate.status).toMatchObject({
        enabled: true,
        mode: "sqlite",
        durable: true,
      });
      expect(existsSync(secretPath)).toBe(true);
      for (const targetPath of onboardingTargetPaths(root)) {
        expect(existsSync(targetPath)).toBe(false);
      }
    } finally {
      await closeTestApplication(application);
      rmSync(root, { recursive: true, force: true });
    }
  });

  itDurableLocalClientSqlite("fails closed if the onboarding root secret rotates without receipt/backup migration", async () => {
    const root = mkdtempSync(join(tmpdir(), "gateway-local-client-onboarding-key-rotation-"));
    const env = localClientOnboardingTestEnv(root);
    let application;
    try {
      application = createGatewayApplication(env);
      await closeTestApplication(application);
      application = null;
      expect(() => createGatewayApplication({
        ...env,
        LOCAL_CLIENT_ONBOARDING_TEST_ROOT_SECRET: `hex:${"9b".repeat(32)}`,
      })).toThrow(expect.objectContaining({
        code: "LOCAL_CLIENT_ONBOARDING_RECEIPT_AUTHORITY_KEY_MISMATCH",
      }));
    } finally {
      await closeTestApplication(application);
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("rejects onboarding without each explicit single-host durable governance boundary", () => {
    const root = mkdtempSync(join(tmpdir(), "gateway-local-client-onboarding-config-"));
    const complete = localClientOnboardingTestEnv(root);
    try {
      expect(() => createGatewayApplication({
        AI_GATEWAY_LOCAL_CLIENT_ONBOARDING_ENABLED: "true",
      })).toThrow(expect.objectContaining({
        code: "LOCAL_CLIENT_ONBOARDING_CONFIG_REQUIRED",
      }));
      expect(() => createGatewayApplication({
        ...complete,
        AI_GATEWAY_MULTI_INSTANCE: "true",
      })).toThrow(expect.objectContaining({
        code: "LOCAL_CLIENT_ONBOARDING_MULTI_INSTANCE_UNSUPPORTED",
      }));
      expect(() => createGatewayApplication({
        ...complete,
        AI_GATEWAY_LOCAL_CLIENT_HOST_ID: undefined,
      })).toThrow(expect.objectContaining({
        code: "LOCAL_CLIENT_ONBOARDING_HOST_ID_REQUIRED",
      }));
      expect(() => createGatewayApplication({
        ...complete,
        AI_GATEWAY_LOCAL_CLIENT_ONBOARDING_RECEIPT_AUTHORITY_SQLITE_PATH: undefined,
      })).toThrow(expect.objectContaining({
        code: "LOCAL_CLIENT_ONBOARDING_SQLITE_PATH_REQUIRED",
      }));
      expect(() => createGatewayApplication({
        ...complete,
        AI_GATEWAY_LOCAL_CLIENT_ONBOARDING_RECEIPT_AUTHORITY_TTL_MS: "900000",
        AI_GATEWAY_LOCAL_CLIENT_ONBOARDING_RECEIPT_AUTHORITY_LEASE_TTL_MS: "900000",
      })).toThrow(expect.objectContaining({
        code: "LOCAL_CLIENT_ONBOARDING_RECEIPT_RETENTION_INVALID",
      }));
      expect(() => createGatewayApplication({
        ...complete,
        AI_GATEWAY_LOCAL_CLIENT_CONTROL_STORE_MODE: "postgres",
        AI_GATEWAY_LOCAL_CLIENT_CONTROL_POSTGRES_URL: "postgresql://local:test@127.0.0.1/onboarding",
      })).toThrow(expect.objectContaining({
        code: "LOCAL_CLIENT_ONBOARDING_LOCAL_CONTROL_REQUIRED",
      }));
      expect(() => createGatewayApplication({
        ...complete,
        AI_GATEWAY_IDEMPOTENCY_STORE_MODE: "memory",
      })).toThrow(expect.objectContaining({
        code: "LOCAL_CLIENT_ONBOARDING_IDEMPOTENCY_SQLITE_REQUIRED",
      }));
      expect(() => createGatewayApplication({
        ...complete,
        AI_GATEWAY_IDEMPOTENCY_HMAC_SECRET: "too-short",
      })).toThrow(expect.objectContaining({
        code: "LOCAL_CLIENT_ONBOARDING_IDEMPOTENCY_SECRET_REQUIRED",
      }));
      expect(() => createGatewayApplication({
        ...complete,
        AI_GATEWAY_LOCAL_CLIENT_ONBOARDING_ROOT_SECRET_REF: undefined,
      })).toThrow(expect.objectContaining({
        code: "LOCAL_CLIENT_ONBOARDING_ROOT_SECRET_REQUIRED",
      }));
      expect(() => createGatewayApplication({
        ...complete,
        LOCAL_CLIENT_ONBOARDING_TEST_ROOT_SECRET: "hex:abcd",
      })).toThrow(expect.objectContaining({
        code: "LOCAL_CLIENT_ONBOARDING_ROOT_SECRET_INVALID",
      }));
      expect(() => createGatewayApplication({
        ...complete,
        AI_GATEWAY_EXTERNAL_EFFECT_STORE_MODE: "postgres",
      })).toThrow(expect.objectContaining({
        code: "LOCAL_CLIENT_ONBOARDING_EXTERNAL_EFFECT_SQLITE_REQUIRED",
      }));
      expect(() => createGatewayApplication({
        ...complete,
        AI_GATEWAY_EXTERNAL_EFFECT_HMAC_SECRET: "too-short",
      })).toThrow(expect.objectContaining({
        code: "LOCAL_CLIENT_ONBOARDING_EXTERNAL_EFFECT_SECRET_REQUIRED",
      }));
      expect(() => createGatewayApplication({
        ...complete,
        AI_GATEWAY_EXTERNAL_EFFECT_SQLITE_PATH: complete.AI_GATEWAY_IDEMPOTENCY_SQLITE_PATH,
      })).toThrow(expect.objectContaining({
        code: "LOCAL_CLIENT_ONBOARDING_SQLITE_PATH_CONFLICT",
      }));
      expect(() => createGatewayApplication({
        ...complete,
        AI_GATEWAY_LOCAL_CLIENT_ONBOARDING_RECEIPT_AUTHORITY_SQLITE_PATH:
          complete.AI_GATEWAY_IDEMPOTENCY_SQLITE_PATH,
      })).toThrow(expect.objectContaining({
        code: "LOCAL_CLIENT_ONBOARDING_SQLITE_PATH_CONFLICT",
      }));
      expect(() => createGatewayApplication({
        ...complete,
        AI_GATEWAY_LOCAL_CLIENT_HOST_ID: "onboarding-path-test-host",
        AI_GATEWAY_LOCAL_CLIENT_ROUTE_PLAN_STORE_MODE: "sqlite",
        AI_GATEWAY_LOCAL_CLIENT_ROUTE_PLAN_SQLITE_PATH: complete.AI_GATEWAY_IDEMPOTENCY_SQLITE_PATH,
      })).toThrow(expect.objectContaining({
        code: "LOCAL_CLIENT_ONBOARDING_SQLITE_PATH_CONFLICT",
      }));
      const protectedTarget = onboardingTargetPaths(root)[0];
      expect(() => createGatewayApplication({
        ...complete,
        AI_GATEWAY_EXTERNAL_EFFECT_SQLITE_PATH: protectedTarget,
      })).toThrow(expect.objectContaining({
        code: "LOCAL_CLIENT_ONBOARDING_PATH_CONFLICT",
      }));
      expect(() => createGatewayApplication({
        ...complete,
        AI_GATEWAY_EXTERNAL_EFFECT_HMAC_SECRET: undefined,
        AI_GATEWAY_EXTERNAL_EFFECT_HMAC_SECRET_PATH: protectedTarget,
      })).toThrow(expect.objectContaining({
        code: "LOCAL_CLIENT_ONBOARDING_PATH_CONFLICT",
      }));
      expect(() => createGatewayApplication({
        ...complete,
        CREDENTIAL_VAULT_DIR: join(root, "claude"),
        AI_GATEWAY_LOCAL_CLIENT_ONBOARDING_ROOT_SECRET_REF: "file_key_path:config.json",
      })).toThrow(expect.objectContaining({
        code: "LOCAL_CLIENT_ONBOARDING_PATH_CONFLICT",
      }));
      const configured = JSON.parse(complete.AI_GATEWAY_LOCAL_CLIENT_ONBOARDING_CONFIG_JSON);
      expect(() => createGatewayApplication({
        ...complete,
        AI_GATEWAY_LOCAL_CLIENT_ONBOARDING_RECEIPT_AUTHORITY_SQLITE_PATH:
          configured.serverDefinition.command,
      })).toThrow(expect.objectContaining({
        code: "LOCAL_CLIENT_ONBOARDING_PATH_CONFLICT",
      }));
      const realPathRoot = join(root, "real-governance");
      const junctionPathRoot = join(root, "junction-governance");
      mkdirSync(realPathRoot, { recursive: true });
      symlinkSync(realPathRoot, junctionPathRoot, "junction");
      expect(() => createGatewayApplication({
        ...complete,
        AI_GATEWAY_LOCAL_CLIENT_ONBOARDING_RECEIPT_AUTHORITY_SQLITE_PATH:
          join(junctionPathRoot, "receipt.sqlite"),
      })).toThrow(expect.objectContaining({
        code: "LOCAL_CLIENT_ONBOARDING_PATH_UNSAFE",
      }));
      expect(existsSync(protectedTarget)).toBe(false);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  itDurableLocalClientSqlite("registers an explicitly configured loopback adapter without exposing its secret", async () => {
    const root = mkdtempSync(join(tmpdir(), "gateway-loopback-adapter-app-"));
    let application;
    try {
      application = createGatewayApplication({
        AI_GATEWAY_LOCAL_CLIENT_LOOPBACK_ENABLED: "true",
        AI_GATEWAY_LOCAL_CLIENT_LOOPBACK_ENDPOINT: "http://127.0.0.1:43120",
        AI_GATEWAY_LOCAL_CLIENT_LOOPBACK_CLIENT_ID: "managed.local-client",
        AI_GATEWAY_LOCAL_CLIENT_LOOPBACK_TENANT_ID: "tenant-loopback-test",
        AI_GATEWAY_LOCAL_CLIENT_LOOPBACK_MANIFEST_SHA256: "b".repeat(64),
        AI_GATEWAY_LOCAL_CLIENT_LOOPBACK_SECRET_REF: "env_key_name:LOCAL_CLIENT_TEST_SECRET",
        LOCAL_CLIENT_TEST_SECRET: `hex:${"ab".repeat(32)}`,
        AI_GATEWAY_LOCAL_CLIENT_REGISTRY_INTEGRITY_SECRET_REF:
          "env_key_name:LOCAL_CLIENT_TEST_REGISTRY_SECRET",
        LOCAL_CLIENT_TEST_REGISTRY_SECRET: `hex:${"ac".repeat(32)}`,
        AI_GATEWAY_LOCAL_CLIENT_PROTOCOL_PRINCIPALS_JSON: JSON.stringify({
          version: 1,
          bindings: [{
            tenantId: "tenant-loopback-test",
            subjectId: "operator-loopback-test",
            clientId: "managed.local-client",
          }],
        }),
        AI_GATEWAY_LOCAL_CLIENT_REGISTRY_PATH: join(root, "registry.json"),
        AI_GATEWAY_LOCAL_CLIENT_HOST_ID: "loopback-preview-test-host",
        AI_GATEWAY_LOCAL_CLIENT_AUTHORITY_EPOCH_STORE_MODE: "sqlite",
        AI_GATEWAY_LOCAL_CLIENT_AUTHORITY_EPOCH_SQLITE_PATH: join(root, "authority-epoch.sqlite"),
        AI_GATEWAY_LOCAL_CLIENT_AUTHORITY_EPOCH_NAMESPACE: "loopback-preview-test",
        AI_GATEWAY_LOCAL_CLIENT_EXECUTION_LOG_PATH: join(root, "execution-log.jsonl"),
      });

      expect(application.localClientAdapterRegistry.lookup("builtin.loopback.local-client")).toMatchObject({
        id: "builtin.loopback.local-client",
        type: "loopback-http",
        version: "2.0.0",
      });
      expect(application.localClientExecutionReadiness).toMatchObject({
        requested: false,
        governedAdapterCount: 1,
      });
      expect(application.localClientPopIdentityStatus).toMatchObject({
        enabled: true,
        available: true,
        bindingCount: 1,
        replayMode: "single-process-memory",
        perClientDerivedKeys: true,
        exactRawBodyBinding: true,
        bearerProofAloneGrantsAuthority: false,
      });
      expect(application.localClientManagedProtocolDispatchStatus).toMatchObject({
        enabled: true,
        ready: true,
        fakeProviderOnly: true,
        realProviderConfigured: false,
        multiInstance: false,
        replayProtection: "single-process-memory",
        durableReplayProtection: false,
        authenticatedReplaySet: false,
        snapshotRollbackProtected: false,
        principalBindingCount: 1,
        blockers: [],
      });
      expect(application.localClientManagementService.verificationAuthorityStatus).toMatchObject({
        monotonicCheckpoint: true,
        rollbackResistant: false,
        rollbackDetectionScope: "registry-only unless checkpoint DB also rolled back",
      });
      await expect(application.localClientAuthorityEpochStore.inspect()).resolves.toMatchObject({
        initialized: false,
        currentGeneration: 0,
        recoveryRequired: false,
      });
      expect(JSON.stringify(application.localClientAdapterRegistry.list())).not.toContain("abababab");
      await application.localClientPopIdentityAuthority.close();
      expect(application.localClientPopIdentityStatus).toMatchObject({ available: false });
      expect(application.localClientManagedProtocolDispatchStatus).toMatchObject({
        ready: false,
        blockers: ["pop_replay_guard_unavailable"],
      });
    } finally {
      await closeTestApplication(application);
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("rejects a protocol principal that is not backed by an exact configured client", () => {
    expect(() => createGatewayApplication({
      AI_GATEWAY_LOCAL_CLIENT_PROTOCOL_PRINCIPALS_JSON: JSON.stringify({
        version: 1,
        bindings: [{
          tenantId: "tenant-a",
          subjectId: "client-subject-a",
          clientId: "missing.client",
        }],
      }),
    })).toThrow(expect.objectContaining({
      code: "LOCAL_CLIENT_PROTOCOL_PRINCIPAL_BINDING_INVALID",
      statusCode: 503,
    }));
  });

  it("composes durable single-host PoP replay but blocks real providers without an external rollback anchor", async () => {
    const root = mkdtempSync(join(tmpdir(), "gateway-pop-sqlite-app-"));
    let application;
    try {
      application = createGatewayApplication({
        AI_GATEWAY_REAL_PROVIDER_ENABLED: "true",
        AI_GATEWAY_PROVIDER_MODE: "real",
        AI_GATEWAY_ENABLED_PROVIDERS: "openai",
        AI_GATEWAY_USAGE_LOG_DIR: join(root, "usage"),
        AI_GATEWAY_PROVIDER_DISPATCH_SQLITE_PATH: join(root, "provider-dispatch.sqlite"),
        AI_GATEWAY_PROVIDER_DISPATCH_HMAC_SECRET: "durable-pop-provider-dispatch".padEnd(64, "x"),
        PME_ENTERPRISE_AUTH_ENABLED: "true",
        PME_AUTH_TOKEN: "durable-pop-test-auth-token",
        PME_AUDIT_LOG_PATH: join(root, "audit.jsonl"),
        PME_AUDIT_CHAIN_PATH: join(root, "audit-chain.jsonl"),
        PME_AUDIT_CHECKPOINT_PATH: join(root, "audit-checkpoint.json"),
        PME_AUDIT_CHECKPOINT_HMAC_KEY: `hex:${"79".repeat(32)}`,
        AI_GATEWAY_LOCAL_CLIENT_LOOPBACK_ENABLED: "true",
        AI_GATEWAY_LOCAL_CLIENT_LOOPBACK_ENDPOINT: "http://127.0.0.1:43128",
        AI_GATEWAY_LOCAL_CLIENT_LOOPBACK_CLIENT_ID: "managed.durable-client",
        AI_GATEWAY_LOCAL_CLIENT_LOOPBACK_TENANT_ID: "tenant-durable-client",
        AI_GATEWAY_LOCAL_CLIENT_LOOPBACK_MANIFEST_SHA256: "9".repeat(64),
        AI_GATEWAY_LOCAL_CLIENT_LOOPBACK_SECRET_REF: "env_key_name:LOCAL_CLIENT_DURABLE_POP_SECRET",
        LOCAL_CLIENT_DURABLE_POP_SECRET: `hex:${"91".repeat(32)}`,
        AI_GATEWAY_LOCAL_CLIENT_REGISTRY_INTEGRITY_SECRET_REF:
          "env_key_name:LOCAL_CLIENT_DURABLE_POP_REGISTRY_SECRET",
        LOCAL_CLIENT_DURABLE_POP_REGISTRY_SECRET: `hex:${"92".repeat(32)}`,
        AI_GATEWAY_LOCAL_CLIENT_PROTOCOL_PRINCIPALS_JSON: JSON.stringify({
          version: 1,
          bindings: [{
            tenantId: "tenant-durable-client",
            subjectId: "subject-durable-client",
            clientId: "managed.durable-client",
          }],
        }),
        AI_GATEWAY_LOCAL_CLIENT_HOST_ID: "durable-pop-test-host",
        AI_GATEWAY_LOCAL_CLIENT_POP_REPLAY_STORE_MODE: "sqlite",
        AI_GATEWAY_LOCAL_CLIENT_POP_REPLAY_SQLITE_PATH: join(root, "pop-replay.sqlite"),
        AI_GATEWAY_LOCAL_CLIENT_POP_REPLAY_NAMESPACE: "durable-pop-test",
        AI_GATEWAY_LOCAL_CLIENT_POP_REPLAY_MAX_ENTRIES: "64",
        AI_GATEWAY_LOCAL_CLIENT_POP_REPLAY_BUSY_TIMEOUT_MS: "100",
        AI_GATEWAY_LOCAL_CLIENT_REGISTRY_PATH: join(root, "registry.json"),
        AI_GATEWAY_LOCAL_CLIENT_EXECUTION_LOG_PATH: join(root, "execution-log.jsonl"),
      });

      expect(application.localClientPopIdentityStatus).toMatchObject({
        enabled: true,
        available: true,
        replayMode: "single-host-sqlite-pop-replay",
        durableReplayProtection: true,
        distributedReplayProtection: false,
        authenticatedReplaySet: true,
        snapshotRollbackProtected: false,
        capacityIsolatedByScope: true,
        maxEntriesPerScope: 63,
      });
      expect(application.localClientManagedProtocolDispatchStatus).toMatchObject({
        enabled: true,
        ready: false,
        fakeProviderOnly: false,
        realProviderConfigured: true,
        multiInstance: false,
        replayProtection: "single-host-sqlite-pop-replay",
        durableReplayProtection: true,
        authenticatedReplaySet: true,
        snapshotRollbackProtected: false,
        capacityIsolatedByScope: true,
        principalBindingCount: 1,
        blockers: ["rollback_resistant_pop_replay_guard_required_for_real_provider"],
      });
      expect(application.localClientPopSnapshotRollbackProtectionStatus).toMatchObject({
        ready: false,
        snapshotRollbackProtected: false,
        blockers: expect.arrayContaining([
          "windows_authority_broker_transport_not_implemented",
          "gateway_protected_anchor_async_preflight_not_implemented",
        ]),
      });
    } finally {
      await closeTestApplication(application);
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("fails closed for invalid or colliding SQLite PoP replay configuration", () => {
    const root = mkdtempSync(join(tmpdir(), "gateway-pop-sqlite-config-"));
    const registryPath = join(root, "registry.json");
    const base = {
      AI_GATEWAY_LOCAL_CLIENT_LOOPBACK_ENABLED: "true",
      AI_GATEWAY_LOCAL_CLIENT_LOOPBACK_ENDPOINT: "http://127.0.0.1:43128",
      AI_GATEWAY_LOCAL_CLIENT_LOOPBACK_CLIENT_ID: "managed.pop-config",
      AI_GATEWAY_LOCAL_CLIENT_LOOPBACK_TENANT_ID: "tenant-pop-config",
      AI_GATEWAY_LOCAL_CLIENT_LOOPBACK_MANIFEST_SHA256: "8".repeat(64),
      AI_GATEWAY_LOCAL_CLIENT_LOOPBACK_SECRET_REF: "env_key_name:LOCAL_CLIENT_POP_CONFIG_SECRET",
      LOCAL_CLIENT_POP_CONFIG_SECRET: `hex:${"81".repeat(32)}`,
      AI_GATEWAY_LOCAL_CLIENT_REGISTRY_INTEGRITY_SECRET_REF:
        "env_key_name:LOCAL_CLIENT_POP_CONFIG_REGISTRY_SECRET",
      LOCAL_CLIENT_POP_CONFIG_REGISTRY_SECRET: `hex:${"82".repeat(32)}`,
      AI_GATEWAY_LOCAL_CLIENT_HOST_ID: "pop-config-test-host",
      AI_GATEWAY_LOCAL_CLIENT_REGISTRY_PATH: registryPath,
    };
    try {
      expect(() => createGatewayApplication({
        AI_GATEWAY_LOCAL_CLIENT_POP_REPLAY_STORE_MODE: "unknown",
      })).toThrow(expect.objectContaining({ code: "LOCAL_CLIENT_POP_REPLAY_STORE_MODE_INVALID" }));
      expect(() => createGatewayApplication({
        AI_GATEWAY_LOCAL_CLIENT_POP_REPLAY_STORE_MODE: "sqlite",
        AI_GATEWAY_LOCAL_CLIENT_POP_REPLAY_SQLITE_PATH: join(root, "pop.sqlite"),
        AI_GATEWAY_LOCAL_CLIENT_HOST_ID: "pop-config-test-host",
      })).toThrow(expect.objectContaining({ code: "LOCAL_CLIENT_POP_REPLAY_LOOPBACK_REQUIRED" }));
      expect(() => createGatewayApplication({
        ...base,
        AI_GATEWAY_LOCAL_CLIENT_POP_REPLAY_STORE_MODE: "sqlite",
        AI_GATEWAY_LOCAL_CLIENT_POP_REPLAY_SQLITE_PATH: registryPath,
      })).toThrow(expect.objectContaining({ code: "LOCAL_CLIENT_POP_REPLAY_SQLITE_PATH_CONFLICT" }));
      expect(() => createGatewayApplication({
        ...base,
        AI_GATEWAY_LOCAL_CLIENT_POP_REPLAY_STORE_MODE: "sqlite",
        AI_GATEWAY_LOCAL_CLIENT_POP_REPLAY_SQLITE_PATH: join(root, "pop-capacity.sqlite"),
        AI_GATEWAY_LOCAL_CLIENT_POP_REPLAY_MAX_ENTRIES: "64",
        AI_GATEWAY_LOCAL_CLIENT_POP_REPLAY_MAX_ENTRIES_PER_SCOPE: "64",
      })).toThrow(expect.objectContaining({ code: "LOCAL_CLIENT_POP_REPLAY_CONFIG_INVALID" }));
      expect(() => createGatewayApplication({
        ...base,
        AI_GATEWAY_LOCAL_CLIENT_POP_REPLAY_SQLITE_PATH: join(root, "pop.sqlite"),
      })).toThrow(expect.objectContaining({ code: "LOCAL_CLIENT_POP_REPLAY_CONFIG_INVALID" }));
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("starts an explicitly configured dry-run-only smart-management scheduler", async () => {
    let application;
    try {
      application = createGatewayApplication({
        AI_GATEWAY_LOCAL_CLIENT_SMART_MANAGE_SCHEDULER_ENABLED: "true",
        AI_GATEWAY_LOCAL_CLIENT_SMART_MANAGE_SCHEDULER_TENANTS_JSON: JSON.stringify({
          version: 1,
          tenants: [{ tenantId: "tenant-scheduled", subjectId: "scheduler-operator" }],
        }),
        AI_GATEWAY_LOCAL_CLIENT_SMART_MANAGE_SCHEDULER_INITIAL_DELAY_MS: "86400000",
      });

      expect(application.localClientSmartManagementScheduler).toBeDefined();
      expect(application.localClientSmartManagementScheduler.getStatus()).toMatchObject({
        lifecycle: "started",
        executionMode: "dry-run",
        dryRun: true,
        applyEnabled: false,
        timerScheduled: true,
        configuration: { initialDelayMs: 86_400_000 },
      });
      expect(JSON.stringify(application.localClientSmartManagementScheduler.getStatus()))
        .not.toContain("tenant-scheduled");
    } finally {
      await closeTestApplication(application);
    }
  });

  it("blocks managed protocol dispatch in multi-instance mode without a distributed PoP replay guard", async () => {
    const root = mkdtempSync(join(tmpdir(), "gateway-pop-multi-instance-app-"));
    let application;
    try {
      application = createGatewayApplication({
        AI_GATEWAY_MULTI_INSTANCE: "true",
        AI_GATEWAY_LOCAL_CLIENT_LOOPBACK_ENABLED: "true",
        AI_GATEWAY_LOCAL_CLIENT_LOOPBACK_ENDPOINT: "http://127.0.0.1:43129",
        AI_GATEWAY_LOCAL_CLIENT_LOOPBACK_CLIENT_ID: "managed.multi-client",
        AI_GATEWAY_LOCAL_CLIENT_LOOPBACK_TENANT_ID: "tenant-multi-client",
        AI_GATEWAY_LOCAL_CLIENT_LOOPBACK_MANIFEST_SHA256: "d".repeat(64),
        AI_GATEWAY_LOCAL_CLIENT_LOOPBACK_SECRET_REF: "env_key_name:LOCAL_CLIENT_MULTI_POP_SECRET",
        LOCAL_CLIENT_MULTI_POP_SECRET: `hex:${"ef".repeat(32)}`,
        AI_GATEWAY_LOCAL_CLIENT_REGISTRY_INTEGRITY_SECRET_REF:
          "env_key_name:LOCAL_CLIENT_MULTI_POP_REGISTRY_SECRET",
        LOCAL_CLIENT_MULTI_POP_REGISTRY_SECRET: `hex:${"ee".repeat(32)}`,
        AI_GATEWAY_LOCAL_CLIENT_PROTOCOL_PRINCIPALS_JSON: JSON.stringify({
          version: 1,
          bindings: [{
            tenantId: "tenant-multi-client",
            subjectId: "subject-multi-client",
            clientId: "managed.multi-client",
          }],
        }),
        AI_GATEWAY_LOCAL_CLIENT_REGISTRY_PATH: join(root, "registry.json"),
        AI_GATEWAY_LOCAL_CLIENT_EXECUTION_LOG_PATH: join(root, "execution-log.jsonl"),
      });

      expect(application.localClientPopIdentityStatus).toMatchObject({ enabled: true });
      expect(application.localClientManagedProtocolDispatchStatus).toMatchObject({
        enabled: true,
        ready: false,
        fakeProviderOnly: true,
        realProviderConfigured: false,
        multiInstance: true,
        replayProtection: "single-process-memory",
        durableReplayProtection: false,
        authenticatedReplaySet: false,
        snapshotRollbackProtected: false,
        principalBindingCount: 1,
        blockers: ["distributed_pop_replay_guard_required"],
      });
    } finally {
      await closeTestApplication(application);
      rmSync(root, { recursive: true, force: true });
    }
  });

  itDurableLocalClientSqlite("registers multiple tenant-bound loopback clients from one versioned configuration", async () => {
    const root = mkdtempSync(join(tmpdir(), "gateway-loopback-multi-app-"));
    let application;
    try {
      application = createGatewayApplication({
        AI_GATEWAY_LOCAL_CLIENT_LOOPBACK_ENABLED: "true",
        AI_GATEWAY_LOCAL_CLIENT_LOOPBACK_ADAPTERS_JSON: JSON.stringify({
          version: 1,
          adapters: [
            {
              adapterId: "loopback.desktop.one",
              tenantId: "Tenant-A",
              clientId: "desktop.one",
              endpoint: "http://127.0.0.1:43120",
              manifestSha256: "a".repeat(64),
              secretRef: "env_key_name:LOCAL_CLIENT_MULTI_SECRET_ONE",
            },
            {
              adapterId: "loopback.desktop.two",
              tenantId: "Tenant-B",
              clientId: "desktop.two",
              endpoint: "http://127.0.0.1:43121",
              manifestSha256: "b".repeat(64),
              secretRef: "env_key_name:LOCAL_CLIENT_MULTI_SECRET_TWO",
            },
          ],
        }),
        AI_GATEWAY_LOCAL_CLIENT_REGISTRY_INTEGRITY_SECRET_REF:
          "env_key_name:LOCAL_CLIENT_MULTI_REGISTRY_SECRET",
        LOCAL_CLIENT_MULTI_SECRET_ONE: `hex:${"11".repeat(32)}`,
        LOCAL_CLIENT_MULTI_SECRET_TWO: `hex:${"22".repeat(32)}`,
        LOCAL_CLIENT_MULTI_REGISTRY_SECRET: `hex:${"33".repeat(32)}`,
        AI_GATEWAY_LOCAL_CLIENT_REGISTRY_PATH: join(root, "registry.json"),
        AI_GATEWAY_LOCAL_CLIENT_EXECUTION_LOG_PATH: join(root, "execution-log.jsonl"),
        AI_GATEWAY_LOCAL_CLIENT_HOST_ID: "loopback-multi-test-host",
        AI_GATEWAY_LOCAL_CLIENT_AUTHORITY_EPOCH_STORE_MODE: "sqlite",
        AI_GATEWAY_LOCAL_CLIENT_AUTHORITY_EPOCH_SQLITE_PATH: join(root, "authority-epoch.sqlite"),
        AI_GATEWAY_LOCAL_CLIENT_AUTHORITY_EPOCH_NAMESPACE: "loopback-multi-test",
      });

      expect(application.localClientLoopbackAdapterStatus).toEqual({
        enabled: true,
        source: "versioned-json",
        adapterCount: 2,
        tenantCount: 2,
        clientCount: 2,
        secretReferencesExposed: false,
        gatewayAuthoritySecretRequired: true,
        gatewayClientSecretReuseForbidden: true,
      });
      expect(application.localClientVerificationOwnershipStatus).toMatchObject({
        bindingCount: 2,
        tenantCount: 2,
        clientCount: 2,
      });
      expect(application.localClientPopIdentityStatus).toMatchObject({
        enabled: true,
        available: true,
        bindingCount: 2,
        perClientDerivedKeys: true,
      });
      expect(application.localClientExecutionReadiness).toMatchObject({
        requested: false,
        governedAdapterCount: 2,
      });
      expect(application.localClientAdapterRegistry.lookup("loopback.desktop.one")).toMatchObject({
        id: "loopback.desktop.one",
        type: "loopback-http",
      });
      expect(application.localClientAdapterRegistry.lookup("loopback.desktop.two")).toMatchObject({
        id: "loopback.desktop.two",
        type: "loopback-http",
      });
      const serialized = JSON.stringify({
        adapterStatus: application.localClientLoopbackAdapterStatus,
        ownershipStatus: application.localClientVerificationOwnershipStatus,
        descriptors: application.localClientAdapterRegistry.list(),
      });
      expect(serialized).not.toContain("LOCAL_CLIENT_MULTI_SECRET");
      expect(serialized).not.toContain("11111111");
      expect(serialized).not.toContain("22222222");
      expect(serialized).not.toContain("33333333");
      const crossTenant = await application.localClientManagementService.register({
        clientId: "desktop.one",
        displayName: "Cross-tenant spoof",
        capabilityIds: ["local_application"],
        adapterId: "loopback.desktop.one",
        adapterType: "loopback-http",
        adapterVersion: "2.0.0",
        manifestSha256: "a".repeat(64),
      }, { tenantId: "Tenant-B", userId: "operator-b" });
      await expect(application.localClientVerificationService.verifyAndPromote({
        clientId: "desktop.one",
        expectedRevision: crossTenant.client.revision,
        expectedAdapter: {
          id: "loopback.desktop.one",
          type: "loopback-http",
          version: "2.0.0",
        },
        expectedManifestSha256: "a".repeat(64),
        signal: new AbortController().signal,
      }, { tenantId: "Tenant-B", subjectId: "operator-b" })).rejects.toMatchObject({
        code: "LOCAL_CLIENT_VERIFICATION_DECLARATION_NOT_FOUND",
      });
    } finally {
      await closeTestApplication(application);
      rmSync(root, { recursive: true, force: true });
    }
  });

  itDurableLocalClientSqlite("denies restart when only an older valid signed registry is restored", async () => {
    const root = mkdtempSync(join(tmpdir(), "gateway-local-client-registry-rollback-"));
    const env = localClientAuthorityTestEnv(root);
    let application;
    try {
      application = createGatewayApplication(env);
      await application.localClientManagementService.register({
        clientId: "managed.local-client",
        displayName: "Rollback Fixture",
        capabilityIds: ["local_application"],
        adapterId: "builtin.loopback.local-client",
        adapterType: "loopback-http",
        adapterVersion: "2.0.0",
        manifestSha256: "d".repeat(64),
      }, { tenantId: "tenant-authority-test", userId: "operator-authority-test" });
      const oldSignedRegistry = readFileSync(env.AI_GATEWAY_LOCAL_CLIENT_REGISTRY_PATH);

      await application.localClientManagementService.disable({
        clientId: "managed.local-client",
      }, { tenantId: "tenant-authority-test", userId: "operator-authority-test" });
      await application.localClientManagementService.register({
        clientId: "managed.local-client",
        displayName: "Rollback Fixture Re-registered",
        capabilityIds: ["local_application"],
        adapterId: "builtin.loopback.local-client",
        adapterType: "loopback-http",
        adapterVersion: "2.0.0",
        manifestSha256: "d".repeat(64),
      }, { tenantId: "tenant-authority-test", userId: "operator-authority-test" });
      await expect(application.localClientAuthorityEpochStore.inspect()).resolves.toMatchObject({
        currentGeneration: 3,
        recoveryRequired: false,
      });
      await closeTestApplication(application);
      application = null;

      writeFileSync(env.AI_GATEWAY_LOCAL_CLIENT_REGISTRY_PATH, oldSignedRegistry);
      expect(() => createGatewayApplication(env)).toThrow(expect.objectContaining({
        code: "LOCAL_CLIENT_AUTHORITY_EPOCH_ROLLBACK_DETECTED",
        statusCode: 503,
      }));
    } finally {
      await closeTestApplication(application);
      rmSync(root, { recursive: true, force: true });
    }
  });

  itDurableLocalClientSqlite("denies restart while an authority generation is pending after the registry-write crash point", async () => {
    const root = mkdtempSync(join(tmpdir(), "gateway-local-client-registry-pending-"));
    const env = localClientAuthorityTestEnv(root);
    let application;
    try {
      application = createGatewayApplication(env);
      await application.localClientManagementService.register({
        clientId: "managed.local-client",
        displayName: "Pending Fixture",
        capabilityIds: ["local_application"],
        adapterId: "builtin.loopback.local-client",
        adapterType: "loopback-http",
        adapterVersion: "2.0.0",
        manifestSha256: "d".repeat(64),
      }, { tenantId: "tenant-authority-test", userId: "operator-authority-test" });
      await application.localClientAuthorityEpochStore.reserveNextGeneration(1);
      await closeTestApplication(application);
      application = null;

      expect(() => createGatewayApplication(env)).toThrow(expect.objectContaining({
        code: "LOCAL_CLIENT_AUTHORITY_EPOCH_PENDING_RECOVERY_REQUIRED",
        recovery: expect.objectContaining({
          currentGeneration: 1,
          pendingGeneration: 2,
        }),
      }));
    } finally {
      await closeTestApplication(application);
      rmSync(root, { recursive: true, force: true });
    }
  });

  itDurableLocalClientSqlite("composes the complete single-host governed local-client runtime only from explicit durable configuration", async () => {
    const root = mkdtempSync(join(tmpdir(), "gateway-local-client-governed-runtime-"));
    let application;
    try {
      application = createGatewayApplicationForLocalClientFixtureTests({
        AI_GATEWAY_LOCAL_CLIENT_EXECUTION_ENABLED: "true",
        AI_GATEWAY_LOCAL_CLIENT_ALLOW_REGISTRY_ONLY_ROLLBACK_DETECTION: "true",
        AI_GATEWAY_LOCAL_CLIENT_ROUTE_PLAN_STORE_MODE: "sqlite",
        AI_GATEWAY_LOCAL_CLIENT_ROUTE_PLAN_SQLITE_PATH: join(root, "route-plans.sqlite"),
        AI_GATEWAY_LOCAL_CLIENT_EXECUTION_CLAIM_STORE_MODE: "sqlite",
        AI_GATEWAY_LOCAL_CLIENT_EXECUTION_CLAIM_SQLITE_PATH: join(root, "claims.sqlite"),
        AI_GATEWAY_LOCAL_CLIENT_HOST_ID: "governed-runtime-test-host",
        AI_GATEWAY_LOCAL_CLIENT_EXECUTION_CONTROL_DIR: join(root, "control"),
        AI_GATEWAY_LOCAL_CLIENT_REGISTRY_PATH: join(root, "registry.json"),
        AI_GATEWAY_LOCAL_CLIENT_FEEDBACK_DEDUP_STORE_MODE: "sqlite",
        AI_GATEWAY_LOCAL_CLIENT_FEEDBACK_DEDUP_SQLITE_PATH: join(root, "feedback-dedup.sqlite"),
        AI_GATEWAY_LOCAL_CLIENT_FEEDBACK_DEDUP_NAMESPACE: "governed-runtime-feedback",
        AI_GATEWAY_LOCAL_CLIENT_EXECUTION_FEEDBACK_OUTBOX_STORE_MODE: "sqlite",
        AI_GATEWAY_LOCAL_CLIENT_EXECUTION_FEEDBACK_OUTBOX_SQLITE_PATH: join(root, "feedback-outbox.sqlite"),
        AI_GATEWAY_LOCAL_CLIENT_EXECUTION_FEEDBACK_OUTBOX_NAMESPACE: "governed-runtime-outbox",
        AI_GATEWAY_LOCAL_CLIENT_RECEIPT_RECONCILIATION_STORE_MODE: "sqlite",
        AI_GATEWAY_LOCAL_CLIENT_RECEIPT_RECONCILIATION_DIR: join(root, "receipt-journals"),
        AI_GATEWAY_LOCAL_CLIENT_RECEIPT_RECONCILIATION_NAMESPACE: "governed-runtime-receipts",
        AI_GATEWAY_LOCAL_CLIENT_AUTHORITY_EPOCH_STORE_MODE: "sqlite",
        AI_GATEWAY_LOCAL_CLIENT_AUTHORITY_EPOCH_SQLITE_PATH: join(root, "authority-epoch.sqlite"),
        AI_GATEWAY_LOCAL_CLIENT_AUTHORITY_EPOCH_NAMESPACE: "governed-runtime-test",
        AI_GATEWAY_LOCAL_CLIENT_EXECUTION_LOG_PATH: join(root, "execution-log.jsonl"),
        AI_GATEWAY_IDEMPOTENCY_STORE_MODE: "sqlite",
        AI_GATEWAY_IDEMPOTENCY_SQLITE_PATH: join(root, "idempotency.sqlite"),
        AI_GATEWAY_IDEMPOTENCY_HMAC_SECRET: "governed-runtime-idempotency-secret".padEnd(64, "x"),
        AI_GATEWAY_EXTERNAL_EFFECT_STORE_MODE: "sqlite",
        AI_GATEWAY_EXTERNAL_EFFECT_SQLITE_PATH: join(root, "effects.sqlite"),
        AI_GATEWAY_EXTERNAL_EFFECT_HMAC_SECRET: "governed-runtime-effect-secret".padEnd(64, "x"),
        AI_GATEWAY_LOCAL_CLIENT_LOOPBACK_ENABLED: "true",
        AI_GATEWAY_LOCAL_CLIENT_LOOPBACK_ENDPOINT: "http://127.0.0.1:43120",
        AI_GATEWAY_LOCAL_CLIENT_LOOPBACK_CLIENT_ID: "managed.local-client",
        AI_GATEWAY_LOCAL_CLIENT_LOOPBACK_TENANT_ID: "tenant-governed-test",
        AI_GATEWAY_LOCAL_CLIENT_LOOPBACK_MANIFEST_SHA256: "c".repeat(64),
        AI_GATEWAY_LOCAL_CLIENT_LOOPBACK_SECRET_REF: "env_key_name:LOCAL_CLIENT_GOVERNED_TEST_SECRET",
        LOCAL_CLIENT_GOVERNED_TEST_SECRET: `hex:${"cd".repeat(32)}`,
        AI_GATEWAY_LOCAL_CLIENT_REGISTRY_INTEGRITY_SECRET_REF:
          "env_key_name:LOCAL_CLIENT_GOVERNED_TEST_REGISTRY_SECRET",
        LOCAL_CLIENT_GOVERNED_TEST_REGISTRY_SECRET: `hex:${"ce".repeat(32)}`,
      });

      expect(application.localClientExecutionReadiness).toMatchObject({
        requested: true,
        ready: true,
        mode: "ready",
        governedAdapterCount: 1,
        blockers: [],
      });
      expect(application.localClientExecutionClaimStore.status).toMatchObject({
        durable: true,
        available: true,
        singleHost: true,
      });
      expect(application.localClientFeedbackDedupStatus).toMatchObject({
        mode: "sqlite-feedback-dedup",
        durable: true,
        available: true,
        distributed: false,
      });
      expect(application.localClientExecutionFeedbackOutboxStatus).toMatchObject({
        durable: true,
        available: true,
        distributed: false,
        deliverySemantics: "at-least-once-leased-outbox",
      });
      expect(application.localClientExecutionFeedbackDispatcherStatus).toMatchObject({
        enabled: true,
        available: true,
        lifecycle: "started",
        deliveryFailureChangesCompletedExecutionOutcome: false,
      });
      expect(application.localClientExecutionReceiptJournalStatus).toMatchObject({
        enabled: true,
        available: true,
        durable: true,
        bindingCount: 1,
        recoveryContextEncrypted: true,
      });
      expect(application.localClientExecutionReceiptRecoveryStatus).toMatchObject({
        enabled: true,
        available: true,
        lifecycle: "started",
        executionRedispatchAllowed: false,
      });
      expect(application.localClientAuthorityEpochStore.status).toMatchObject({
        monotonicCheckpoint: true,
        rollbackResistant: false,
        rollbackDetectionScope: "registry-only unless checkpoint DB also rolled back",
      });
      expect(application.localClientExecutionIdempotency.getHealth()).toMatchObject({
        enabled: true,
        durable: true,
        available: true,
        storeMode: "sqlite",
      });
      expect(application.localClientVerificationService).toBeDefined();
      expect(application.localClientExecutionPreview).toBeDefined();
      expect(application.localClientExecutionOrchestrator).toBeDefined();
      expect(application.localClientGovernedExecutionApi).toBeDefined();
      await expect(application.localClientManagementService.getStatus({
        tenantId: "tenant-governed-test",
        userId: "operator-governed-test",
      })).resolves.toMatchObject({
        executionEnabled: true,
        boundaries: {
          previewOnly: false,
          executionAdapterConfigured: true,
          executionRequested: true,
          executionReady: true,
          executionMode: "ready",
          executionBlockers: [],
        },
      });
      await application.localClientManagementService.register({
        clientId: "managed.local-client",
        displayName: "Cross-tenant declaration",
        capabilityIds: ["local_application"],
        adapterId: "builtin.loopback.local-client",
        adapterType: "loopback-http",
        adapterVersion: "2.0.0",
        manifestSha256: "c".repeat(64),
      }, {
        tenantId: "tenant-not-owner",
        userId: "operator-not-owner",
      });
      await expect(application.localClientVerificationService.verifyAndPromote({
        clientId: "managed.local-client",
        expectedRevision: 1,
        expectedAdapter: {
          id: "builtin.loopback.local-client",
          type: "loopback-http",
          version: "2.0.0",
        },
        expectedManifestSha256: "c".repeat(64),
        signal: new AbortController().signal,
      }, {
        tenantId: "tenant-not-owner",
        subjectId: "operator-not-owner",
      })).rejects.toMatchObject({
        code: "LOCAL_CLIENT_VERIFICATION_DECLARATION_NOT_FOUND",
      });
    } finally {
      await closeTestApplication(application);
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("fails closed when loopback adapter configuration or its credential is incomplete", () => {
    expect(() => createGatewayApplication({
      AI_GATEWAY_LOCAL_CLIENT_LOOPBACK_ENABLED: "true",
    })).toThrow(expect.objectContaining({ code: "LOCAL_CLIENT_LOOPBACK_ADAPTER_CONFIG_INVALID" }));
    expect(() => createGatewayApplication({
      AI_GATEWAY_LOCAL_CLIENT_LOOPBACK_ENABLED: "true",
      AI_GATEWAY_LOCAL_CLIENT_LOOPBACK_ENDPOINT: "http://127.0.0.1:43120",
      AI_GATEWAY_LOCAL_CLIENT_LOOPBACK_CLIENT_ID: "managed.local-client",
      AI_GATEWAY_LOCAL_CLIENT_LOOPBACK_TENANT_ID: "tenant-loopback-test",
      AI_GATEWAY_LOCAL_CLIENT_LOOPBACK_MANIFEST_SHA256: "b".repeat(64),
      AI_GATEWAY_LOCAL_CLIENT_LOOPBACK_SECRET_REF: "env_key_name:MISSING_LOCAL_CLIENT_SECRET",
      AI_GATEWAY_LOCAL_CLIENT_REGISTRY_INTEGRITY_SECRET_REF:
        "env_key_name:LOCAL_CLIENT_MISSING_TEST_REGISTRY_SECRET",
      LOCAL_CLIENT_MISSING_TEST_REGISTRY_SECRET: `hex:${"bc".repeat(32)}`,
    })).toThrow(expect.objectContaining({ code: "LOCAL_CLIENT_LOOPBACK_SECRET_UNAVAILABLE" }));
  });

  it("fails closed on invalid external-effect enablement and auto-enables for webhooks", async () => {
    expect(() => createGatewayApplication({
      AI_GATEWAY_EXTERNAL_EFFECT_ENABLED: "sometimes",
    })).toThrow("AI_GATEWAY_EXTERNAL_EFFECT_ENABLED must be true or false when configured.");

    const root = mkdtempSync(join(tmpdir(), "gateway-external-effect-"));
    try {
      const application = createGatewayApplication({
        FEISHU_WEBHOOK_URL: "https://open.feishu.example/webhook/test",
        AI_GATEWAY_EXTERNAL_EFFECT_STORE_MODE: "sqlite",
        AI_GATEWAY_EXTERNAL_EFFECT_SQLITE_PATH: join(root, "effects.sqlite"),
        AI_GATEWAY_EXTERNAL_EFFECT_HMAC_SECRET: "application-external-effect-secret".padEnd(64, "x"),
      });
      expect(application.externalEffectGate.getHealth()).toMatchObject({
        mode: "sqlite",
        enabled: true,
        durable: true,
        available: true,
      });
      await application.externalEffectGate.close();

      const mcpApplication = createGatewayApplication({
        MCP_UPSTREAM_SERVERS_JSON: JSON.stringify([{
          id: "weather",
          transport: "http",
          url: "https://mcp.example.com/mcp",
          allowedTools: ["get_forecast"],
          readOnlyTools: ["get_forecast"],
        }]),
        AI_GATEWAY_EXTERNAL_EFFECT_STORE_MODE: "sqlite",
        AI_GATEWAY_EXTERNAL_EFFECT_SQLITE_PATH: join(root, "mcp-effects.sqlite"),
        AI_GATEWAY_EXTERNAL_EFFECT_HMAC_SECRET: "application-mcp-external-effect-secret".padEnd(64, "x"),
      });
      expect(mcpApplication.externalEffectGate.status).toMatchObject({
        mode: "sqlite",
        enabled: true,
      });
      await mcpApplication.externalEffectGate.close();
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("fails closed when multi-instance Workforce execution lacks central control state", () => {
    expect(() => createGatewayApplication({
      AI_GATEWAY_MULTI_INSTANCE: "true",
      WORKFORCE_EXECUTION_ENABLED: "true",
      AI_GATEWAY_WORKFORCE_CLAIM_STORE_MODE: "memory",
    })).toThrow(expect.objectContaining({
      code: "WORKFORCE_CONTROL_CENTRAL_STORE_REQUIRED",
    }));
  });

  it("fails closed when multi-instance real-provider execution lacks a central usage ledger", () => {
    expect(() => createGatewayApplication({
      AI_GATEWAY_PROVIDER_MODE: "real",
      AI_GATEWAY_REAL_PROVIDER_ENABLED: "true",
      AI_GATEWAY_MULTI_INSTANCE: "true",
      AI_GATEWAY_USAGE_LEDGER_STORE_MODE: "file",
    })).toThrow(expect.objectContaining({
      code: "USAGE_LEDGER_CENTRAL_STORE_REQUIRED",
    }));
  });

  it("has provider registry with providers", () => {
    const providers = app.gatewayService.getProviderDescriptors();
    expect(providers.length).toBeGreaterThan(0);
  });

  it("has knowledge service ready", () => {
    const health = app.knowledgeService.getHealth();
    expect(health.status).toBe("ready");
  });

  it("has workflow service ready", () => {
    const health = app.workflowService.getHealth();
    expect(health.status).toBe("ready");
  });

  it("has workforce service ready", () => {
    const health = app.workforceService.getHealth();
    expect(health.status).toBe("ready");
  });

  it("has enterprise governance ready", () => {
    const health = app.enterpriseGovernanceService.getHealth();
    expect(health.status).toBe("ready");
  });

  it("stores runtime credentials without enabling providers behind closed gates", () => {
    const application = createGatewayApplication({
      AI_GATEWAY_PROVIDER_MODE: "fake",
      AI_GATEWAY_REAL_PROVIDER_ENABLED: "false",
      AI_GATEWAY_ENABLED_PROVIDERS: "local-fake-provider,backup-fake-provider",
      PME_RUNTIME_CREDENTIAL_STORE_MODE: "memory",
    });
    const result = setRuntimeProviderCredential(application, {
      providerId: "openai",
      apiKey: "test-placeholder-runtime-key",
      modelId: "gpt-test",
    });

    expect(result.runtimeProviderEnabled).toBe(false);
    expect(result.runtimeProviderBlockers).toContain("provider-mode-not-real-capable");
    expect(application.providerRegistry.enabledProviders.has("openai")).toBe(false);
    expect(application.runtimeCredentialStore.has("openai")).toBe(true);
  });

  it("does not restore persisted providers behind closed gates", () => {
    const registry = new ProviderRegistry({ enabledProviders: ["local-fake-provider"] });
    registry.register(createFakeProvider({
      providerId: "real-test-provider",
      modelId: "real-test-model",
      providerType: "openai",
      capabilities: ["chat"],
      enabled: true,
    }));

    restoreRuntimeCredentialProviders({
      providerRegistry: registry,
      runtimeCredentialStore: {
        listRecords: () => [{ providerId: "real-test-provider", models: [] }],
      },
      runtimeConfig: {
        providerMode: "fake",
        realProviderEnabled: false,
        enabledProviders: ["real-test-provider"],
      },
    });

    expect(registry.enabledProviders.has("real-test-provider")).toBe(false);
  });

  it("blocks the direct NVIDIA client sink before fetch", async () => {
    const application = createGatewayApplication({
      AI_GATEWAY_PROVIDER_MODE: "fake",
      AI_GATEWAY_REAL_PROVIDER_ENABLED: "false",
      AI_GATEWAY_ENABLED_PROVIDERS: "nvidia",
      NVIDIA_API_KEY: "test-placeholder-nvidia-key",
    });
    const fetchImpl = vi.fn();
    const client = createNvidiaUnifiedClient({
      env: application.runtimeEnv,
      runtimeCredentialStore: application.runtimeCredentialStore,
      modelLibraryStore: application.modelLibraryStore,
      runtimeConfig: application.gatewayService.runtimeConfig,
      fetchImpl,
    });
    const result = await client.chatCompletion({
      modelId: application.config.aiGatewayService.providerModels.find((item) => item.providerId === "nvidia")?.modelId,
      messages: [{ role: "user", content: "test" }],
    });

    expect(result.code).toBe("real_provider_execution_blocked");
    expect(result.meta.providerCalled).toBe(false);
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("refuses real-provider startup when durable usage persistence is disabled", () => {
    expect(() => createGatewayApplication({
      AI_GATEWAY_PROVIDER_MODE: "real",
      AI_GATEWAY_REAL_PROVIDER_ENABLED: "true",
      AI_GATEWAY_ENABLED_PROVIDERS: "openai",
      AI_GATEWAY_USAGE_LOG_DIR: "",
      PME_ENTERPRISE_AUTH_ENABLED: "true",
      PME_AUTH_TOKEN: "test-placeholder-auth-token",
    })).toThrowError(expect.objectContaining({
      code: "USAGE_LEDGER_UNAVAILABLE",
      category: "billing",
    }));
  });

  it("constructs real-provider mode only with durable usage and signed audit state", () => {
    const root = mkdtempSync(join(tmpdir(), "gateway-real-governance-"));
    try {
      const application = createGatewayApplication({
        AI_GATEWAY_PROVIDER_MODE: "real",
        AI_GATEWAY_REAL_PROVIDER_ENABLED: "true",
        AI_GATEWAY_ENABLED_PROVIDERS: "openai",
        AI_GATEWAY_USAGE_LOG_DIR: join(root, "usage"),
        AI_GATEWAY_PROVIDER_DISPATCH_SQLITE_PATH: join(root, "provider-dispatch.sqlite"),
        AI_GATEWAY_PROVIDER_DISPATCH_HMAC_SECRET: "application-provider-dispatch-secret".padEnd(64, "x"),
        PME_ENTERPRISE_AUTH_ENABLED: "true",
        PME_AUTH_TOKEN: "test-placeholder-auth-token",
        PME_AUDIT_LOG_PATH: join(root, "audit.jsonl"),
        PME_AUDIT_CHAIN_PATH: join(root, "audit-chain.jsonl"),
        PME_AUDIT_CHECKPOINT_PATH: join(root, "audit-checkpoint.json"),
        PME_AUDIT_CHECKPOINT_HMAC_KEY: `hex:${"71".repeat(32)}`,
      });

      expect(application.requestLogger.getHealth()).toEqual(expect.objectContaining({
        status: "ready",
        durableWritesRequired: true,
      }));
      expect(application.enterpriseGovernanceService.getSecurityReadiness().audit)
        .toEqual(expect.objectContaining({
          checkpointRequired: true,
          checkpoint: expect.objectContaining({ configured: true, signed: true }),
        }));
      expect(application.providerDispatchGate.getHealth()).toEqual(expect.objectContaining({
        mode: "sqlite",
        enabled: true,
        required: true,
        durable: true,
        available: true,
      }));
      application.requestLogger.close();
      application.providerDispatchGate.close();
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});

async function closeTestApplication(application) {
  if (!application) return;
  await application.localClientRoutePlanStore?.close?.();
  await application.localClientExecutionClaimStore?.close?.();
  await application.localClientExecutionControl?.close?.();
  await application.localClientSmartManagementScheduler?.close?.();
  await application.localClientExecutionReceiptRecoveryService?.close?.();
  await application.localClientExecutionFeedbackDispatcher?.close?.();
  await application.localClientExecutionFeedbackOutbox?.close?.();
  await application.localClientExecutionReceiptJournalRegistry?.close?.();
  await application.localClientGovernedOnboardingRuntime?.close?.();
  await application.localClientOnboardingReceiptAuthorityStore?.close?.();
  await application.localClientPopIdentityAuthority?.close?.();
  await application.localClientVerificationService?.close?.();
  await application.localClientAdapterRegistry?.close?.();
  await application.localClientManagementService?.close?.();
  await application.localClientFeedbackDedupStore?.close?.();
  await application.localClientAuthorityEpochStore?.close?.();
  await application.idempotencyCoordinator?.close?.();
  await application.workforceExecutor?.close?.();
  await application.requestLogger?.close?.();
  await application.providerDispatchGate?.close?.();
  await application.externalEffectGate?.close?.();
  await application.mcpGatewayService?.close?.();
  await application.enterpriseGovernanceService?.close?.();
}

function localClientFeedbackDedupTestEnv(root) {
  return {
    AI_GATEWAY_LOCAL_CLIENT_HOST_ID: "feedback-dedup-test-host",
    AI_GATEWAY_LOCAL_CLIENT_REGISTRY_PATH: join(root, "registry.json"),
    AI_GATEWAY_LOCAL_CLIENT_EXECUTION_LOG_PATH: join(root, "execution-log.jsonl"),
    AI_GATEWAY_LOCAL_CLIENT_FEEDBACK_DEDUP_STORE_MODE: "sqlite",
    AI_GATEWAY_LOCAL_CLIENT_FEEDBACK_DEDUP_SQLITE_PATH: join(root, "feedback-dedup.sqlite"),
    AI_GATEWAY_LOCAL_CLIENT_FEEDBACK_DEDUP_NAMESPACE: "feedback-dedup-test",
    AI_GATEWAY_LOCAL_CLIENT_FEEDBACK_DEDUP_TTL_MS: "90000",
    AI_GATEWAY_LOCAL_CLIENT_FEEDBACK_DEDUP_LEASE_TTL_MS: "5000",
    AI_GATEWAY_LOCAL_CLIENT_FEEDBACK_DEDUP_MAX_EVENTS: "64",
    AI_GATEWAY_LOCAL_CLIENT_FEEDBACK_DEDUP_BUSY_TIMEOUT_MS: "100",
    AI_GATEWAY_LOCAL_CLIENT_LOOPBACK_ENABLED: "true",
    AI_GATEWAY_LOCAL_CLIENT_LOOPBACK_ENDPOINT: "http://127.0.0.1:43122",
    AI_GATEWAY_LOCAL_CLIENT_LOOPBACK_CLIENT_ID: "feedback.client",
    AI_GATEWAY_LOCAL_CLIENT_LOOPBACK_TENANT_ID: "tenant-feedback-test",
    AI_GATEWAY_LOCAL_CLIENT_LOOPBACK_MANIFEST_SHA256: "e".repeat(64),
    AI_GATEWAY_LOCAL_CLIENT_LOOPBACK_SECRET_REF: "env_key_name:LOCAL_CLIENT_FEEDBACK_TEST_SECRET",
    LOCAL_CLIENT_FEEDBACK_TEST_SECRET: `hex:${"ab".repeat(32)}`,
    AI_GATEWAY_LOCAL_CLIENT_REGISTRY_INTEGRITY_SECRET_REF:
      "env_key_name:LOCAL_CLIENT_FEEDBACK_TEST_REGISTRY_SECRET",
    LOCAL_CLIENT_FEEDBACK_TEST_REGISTRY_SECRET: `hex:${"ad".repeat(32)}`,
  };
}

function onboardingTargetPaths(root) {
  return [
    join(root, "claude", "config.json"),
    join(root, "cursor", "mcp.json"),
    join(root, "vscode", "mcp.json"),
  ];
}

function localClientOnboardingTestEnv(root) {
  const [claudeTarget, cursorTarget, vscodeTarget] = onboardingTargetPaths(root);
  const profile = (name, targetPath) => ({
    targetPath,
    allowedRoot: root,
    backupDir: join(root, `${name}-backups`),
    journalPath: join(root, `${name}-state`, "journal.json"),
    maxBytes: 65536,
    maxTransactions: 16,
  });
  return {
    AI_GATEWAY_LOCAL_CLIENT_ONBOARDING_ENABLED: "true",
    AI_GATEWAY_LOCAL_CLIENT_HOST_ID: "onboarding-application-test-host",
    AI_GATEWAY_LOCAL_CLIENT_ONBOARDING_RECEIPT_AUTHORITY_SQLITE_PATH: join(root, "receipt-authority.sqlite"),
    AI_GATEWAY_LOCAL_CLIENT_ONBOARDING_RECEIPT_AUTHORITY_NAMESPACE: "onboarding-application-test",
    AI_GATEWAY_LOCAL_CLIENT_ONBOARDING_RECEIPT_AUTHORITY_TTL_MS: "2592000000",
    AI_GATEWAY_LOCAL_CLIENT_ONBOARDING_RECEIPT_AUTHORITY_LEASE_TTL_MS: "600000",
    AI_GATEWAY_LOCAL_CLIENT_ONBOARDING_RECEIPT_AUTHORITY_MAX_ROWS: "128",
    AI_GATEWAY_LOCAL_CLIENT_ONBOARDING_RECEIPT_AUTHORITY_BUSY_TIMEOUT_MS: "100",
    AI_GATEWAY_LOCAL_CLIENT_ONBOARDING_ROOT_SECRET_REF:
      "env_key_name:LOCAL_CLIENT_ONBOARDING_TEST_ROOT_SECRET",
    LOCAL_CLIENT_ONBOARDING_TEST_ROOT_SECRET: `hex:${"9a".repeat(32)}`,
    AI_GATEWAY_LOCAL_CLIENT_ONBOARDING_CONFIG_JSON: JSON.stringify({
      version: 1,
      ownerTenantId: "tenant-onboarding-flow",
      profiles: {
        claudeCompatible: profile("claude", claudeTarget),
        cursor: profile("cursor", cursorTarget),
        vscode: profile("vscode", vscodeTarget),
      },
      serverDefinition: {
        transport: "stdio",
        command: join(root, "bin", "node.exe"),
        args: [join(root, "gateway-entry.mjs"), "--mcp"],
        cwd: root,
      },
    }),
    AI_GATEWAY_LOCAL_CLIENT_CONTROL_STORE_MODE: "local",
    AI_GATEWAY_LOCAL_CLIENT_EXECUTION_CONTROL_DIR: join(root, "control"),
    AI_GATEWAY_IDEMPOTENCY_STORE_MODE: "sqlite",
    AI_GATEWAY_IDEMPOTENCY_SQLITE_PATH: join(root, "idempotency.sqlite"),
    AI_GATEWAY_IDEMPOTENCY_HMAC_SECRET: "onboarding-idempotency-secret".padEnd(64, "x"),
    AI_GATEWAY_EXTERNAL_EFFECT_STORE_MODE: "sqlite",
    AI_GATEWAY_EXTERNAL_EFFECT_SQLITE_PATH: join(root, "external-effects.sqlite"),
    AI_GATEWAY_EXTERNAL_EFFECT_HMAC_SECRET: "onboarding-external-effect-secret".padEnd(64, "x"),
    AI_GATEWAY_EXTERNAL_EFFECT_CENTRAL_REQUIRED: "false",
  };
}

function localClientAuthorityTestEnv(root) {
  return {
    AI_GATEWAY_LOCAL_CLIENT_HOST_ID: "authority-restart-test-host",
    AI_GATEWAY_LOCAL_CLIENT_REGISTRY_PATH: join(root, "registry.json"),
    AI_GATEWAY_LOCAL_CLIENT_EXECUTION_LOG_PATH: join(root, "execution-log.jsonl"),
    AI_GATEWAY_LOCAL_CLIENT_AUTHORITY_EPOCH_STORE_MODE: "sqlite",
    AI_GATEWAY_LOCAL_CLIENT_AUTHORITY_EPOCH_SQLITE_PATH: join(root, "authority-epoch.sqlite"),
    AI_GATEWAY_LOCAL_CLIENT_AUTHORITY_EPOCH_NAMESPACE: "authority-restart-test",
    AI_GATEWAY_LOCAL_CLIENT_AUTHORITY_EPOCH_MAX_CHECKPOINTS: "8",
    AI_GATEWAY_LOCAL_CLIENT_AUTHORITY_EPOCH_BUSY_TIMEOUT_MS: "100",
    AI_GATEWAY_LOCAL_CLIENT_LOOPBACK_ENABLED: "true",
    AI_GATEWAY_LOCAL_CLIENT_LOOPBACK_ENDPOINT: "http://127.0.0.1:43121",
    AI_GATEWAY_LOCAL_CLIENT_LOOPBACK_CLIENT_ID: "managed.local-client",
    AI_GATEWAY_LOCAL_CLIENT_LOOPBACK_TENANT_ID: "tenant-authority-test",
    AI_GATEWAY_LOCAL_CLIENT_LOOPBACK_MANIFEST_SHA256: "d".repeat(64),
    AI_GATEWAY_LOCAL_CLIENT_LOOPBACK_SECRET_REF: "env_key_name:LOCAL_CLIENT_AUTHORITY_TEST_SECRET",
    LOCAL_CLIENT_AUTHORITY_TEST_SECRET: `hex:${"de".repeat(32)}`,
    AI_GATEWAY_LOCAL_CLIENT_REGISTRY_INTEGRITY_SECRET_REF:
      "env_key_name:LOCAL_CLIENT_AUTHORITY_TEST_REGISTRY_SECRET",
    LOCAL_CLIENT_AUTHORITY_TEST_REGISTRY_SECRET: `hex:${"df".repeat(32)}`,
  };
}
