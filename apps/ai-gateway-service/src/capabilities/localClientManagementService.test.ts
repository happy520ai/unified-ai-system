import { access, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { LocalClientAdapterDescriptor } from "./localClientAdapterRegistry.ts";
import {
  createLocalClientManagementService,
  preflightLocalClientRegistryIntegrity,
} from "./localClientManagementService.ts";
import {
  LOCAL_CLIENT_VERIFICATION_EVIDENCE_VERSION,
  LOCAL_CLIENT_VERIFICATION_PROBE_DESCRIPTOR_VERSION,
  createLocalClientVerificationService,
  fingerprintLocalClientVerificationDeclaration,
  type LocalClientVerificationDeclaration,
  type LocalClientVerificationEvidence,
} from "./localClientVerificationService.ts";
import { createLocalClientSqliteFeedbackDedupStore } from "./localClientSqliteFeedbackDedupStore.ts";

const TENANT_A_SCOPE = Object.freeze({ tenantId: "tenant-a", userId: "user-a" });
const TENANT_B_SCOPE = Object.freeze({ tenantId: "tenant-b", userId: "user-b" });
const TENANT_A_IDENTITY = Object.freeze({ tenantId: "tenant-a", subjectId: "subject-a" });
const MANIFEST_SHA256 = "a".repeat(64);

describe("local client management service", () => {
  let rootDir: string;
  let registryPath: string;
  let executionLogPath: string;

  beforeEach(async () => {
    rootDir = await mkdtemp(join(tmpdir(), "gateway-local-clients-"));
    registryPath = join(rootDir, "registry.json");
    executionLogPath = join(rootDir, "execution-log.jsonl");
  });

  afterEach(async () => {
    vi.useRealTimers();
    await rm(rootDir, { recursive: true, force: true });
  });

  function createService(overrides: Record<string, unknown> = {}) {
    const createTestService = createLocalClientManagementService as unknown as (
      options: Record<string, unknown>,
    ) => ReturnType<typeof createLocalClientManagementService>;
    return createTestService({
      registryPath,
      executionLogPath,
      discoveryHintsPath: join(rootDir, "discovery-hints.json"),
      processRowsProvider: async () => [],
      registryIntegrityKey: Buffer.alloc(32, 0x71),
      ...overrides,
    });
  }

  async function exists(path: string) {
    return access(path).then(() => true, () => false);
  }

  it("normalizes string configuration and keeps status reads side-effect free", async () => {
    const service = createService({
      executionEnabled: "false",
      staleClientThresholdMs: "60000",
      maxAlternatives: "2",
    });

    const status = await service.getStatus(TENANT_A_SCOPE);

    expect(status.executionEnabled).toBe(false);
    expect(status.boundaries).toMatchObject({
      previewOnly: true,
      tenantScoped: true,
      observedApplicationsRoutable: false,
      executionAdapterConfigured: false,
      executionRequested: false,
      executionReady: false,
      executionMode: "preview-only",
      executionBlockers: [],
      gatewayAuthoritySecretRequired: true,
      gatewayClientSecretReuseForbidden: true,
    });
    expect(status.feedbackDeduplication).toEqual({
      enabled: false,
      mode: "disabled",
      durable: false,
      distributed: false,
      exactlyOnceAdmission: false,
      deliveryMode: "disabled",
    });
    expect(await exists(registryPath)).toBe(false);
    expect(await exists(executionLogPath)).toBe(false);
  });

  it("preflights the actual authenticated registry before readiness can be reported", async () => {
    const key = Buffer.alloc(32, 0x71);
    expect(preflightLocalClientRegistryIntegrity({
      registryPath,
      registryIntegrityKey: key,
    })).toMatchObject({
      available: true,
      authenticated: true,
      existingRegistryVerified: false,
    });
    const service = createService();
    await service.register({
      clientId: "preflight-client",
      displayName: "Preflight Client",
      capabilityIds: ["browser"],
    }, TENANT_A_SCOPE);
    expect(preflightLocalClientRegistryIntegrity({
      registryPath,
      registryIntegrityKey: key,
    })).toMatchObject({ existingRegistryVerified: true });
    const persisted = JSON.parse(await readFile(registryPath, "utf8"));
    expect(persisted.generation).toBe(1);
    persisted.clients[0].displayName = "tampered";
    await writeFile(registryPath, JSON.stringify(persisted), "utf8");
    expect(() => preflightLocalClientRegistryIntegrity({
      registryPath,
      registryIntegrityKey: key,
    })).toThrowError(expect.objectContaining({
      code: "local_client_registry_corrupt",
      statusCode: 503,
    }));
  });

  it("keeps an uncomposed execution request blocked without performing an action", async () => {
    const service = createService({ executionEnabled: "true" });
    await expect(service.getStatus(TENANT_A_SCOPE)).resolves.toMatchObject({
      executionEnabled: true,
      boundaries: {
        previewOnly: true,
        executionAdapterConfigured: false,
        executionRequested: true,
        executionReady: false,
        executionMode: "blocked",
        executionBlockers: ["execution_runtime_not_composed"],
      },
    });
  });

  it("fails closed when a caller omits the authenticated scope", async () => {
    const service = createService();
    await expect(Reflect.apply(service.list, service, [{}])).rejects.toMatchObject({
      code: "local_client_scope_required",
      statusCode: 401,
      category: "auth",
    });
  });

  it("keeps the default smart-management cycle a filesystem-safe dry run", async () => {
    const service = createService({
      processRowsProvider: async () => [{ imageName: "chrome.exe", pid: "42" }],
    });

    const result = await service.smartManage({}, TENANT_A_SCOPE);

    expect(result).toMatchObject({
      dryRun: true,
      discovery: {
        dryRun: true,
        discovered: 1,
      },
      maintenance: {
        dryRun: true,
      },
    });
    expect(await exists(registryPath)).toBe(false);
    expect(await exists(executionLogPath)).toBe(false);
  });

  it("cooperatively aborts a scheduled dry-run before any registry or log mutation", async () => {
    const controller = new AbortController();
    let capturedSignal: AbortSignal | undefined;
    const service = createService({
      processRowsProvider: async (_maxRows: number, signal: AbortSignal) => {
        capturedSignal = signal;
        controller.abort();
        return [{ imageName: "chrome.exe", pid: "42" }];
      },
    });

    await expect(service.smartManage({
      dryRun: true,
      signal: controller.signal,
    }, TENANT_A_SCOPE)).rejects.toMatchObject({
      code: "local_client_operation_aborted",
      statusCode: 499,
      category: "cancellation",
    });
    expect(capturedSignal).toBe(controller.signal);
    expect(await exists(registryPath)).toBe(false);
    expect(await exists(executionLogPath)).toBe(false);
  });

  it("canonicalizes capability names and honors an explicit execute client", async () => {
    const service = createService();
    await service.register({
      clientId: "preferred-browser",
      name: "Preferred Browser",
      capabilities: ["web_automation"],
      priority: 10,
      trustLevel: "low",
    }, TENANT_A_SCOPE);
    await service.register({
      clientId: "other-browser",
      name: "Other Browser",
      capabilities: ["web automation"],
      priority: 100,
      trustLevel: "high",
    }, TENANT_A_SCOPE);

    const result = await service.execute({
      clientId: "preferred-browser",
      requiredCapabilities: ["web-automation"],
      dryRun: true,
    }, TENANT_A_SCOPE);

    expect(result.selectedClientId).toBe("preferred-browser");
    expect(result.route.status).toBe("route-ready");
    expect(result.route.selected?.missingCapabilities).toEqual([]);
  });

  it("always ranks a complete capability match above a healthier preferred partial match", async () => {
    const service = createService({ staleClientThresholdMs: 30_000 });
    await service.register({
      clientId: "complete-client",
      name: "Complete Client",
      capabilities: ["browser", "file_operation"],
      priority: 0,
      trustLevel: "low",
      healthStatus: "unhealthy",
    }, TENANT_A_SCOPE);
    await service.register({
      clientId: "partial-client",
      name: "Partial Client",
      capabilities: ["browser"],
      priority: 100,
      preferred: true,
      trustLevel: "high",
      healthStatus: "healthy",
    }, TENANT_A_SCOPE);

    const result = await service.route({
      requiredCapabilities: ["browser", "file-operation"],
      preferredClientId: "partial-client",
    }, TENANT_A_SCOPE);

    expect(result.status).toBe("route-ready");
    expect(result.selected?.clientId).toBe("complete-client");
    expect(result.selected?.missingCapabilities).toEqual([]);
  });

  it("does not report healthy when every enabled managed client is unhealthy", async () => {
    const service = createService();
    await service.register({
      clientId: "unhealthy-client",
      displayName: "Unhealthy Client",
      capabilityIds: ["browser"],
    }, TENANT_A_SCOPE);
    await service.heartbeat({
      clientId: "unhealthy-client",
      healthStatus: "unhealthy",
    }, TENANT_A_SCOPE);

    const health = await service.healthCheck(TENANT_A_SCOPE);

    expect(health.status).toBe("unhealthy");
    expect(health.unhealthyEnabledClients).toBe(1);
    await expect(service.route({ requiredCapabilities: ["browser"] }, TENANT_A_SCOPE)).resolves.toMatchObject({
      status: "no-client",
      selected: null,
    });
  });

  it("treats register as descriptor approval and preserves sticky admin state", async () => {
    const service = createService();
    await service.register({
      clientId: "sticky-client",
      displayName: "Sticky Client",
      capabilityIds: ["browser"],
      trustLevel: "high",
      priority: 100,
      healthStatus: "healthy",
      command: "should-not-be-stored",
      endpoint: "http://127.0.0.1:65535/private",
      metadata: { apiKey: "should-not-be-stored" },
      stats: { successes: 9999 },
    }, TENANT_A_SCOPE);
    await service.disable({ clientId: "sticky-client", dryRun: false }, TENANT_A_SCOPE);

    const updated = await service.register({
      clientId: "sticky-client",
      displayName: "Updated Sticky Client",
      capabilityIds: ["browser", "web_automation"],
      enabled: true,
      trustLevel: "high",
      healthStatus: "healthy",
    }, TENANT_A_SCOPE);

    expect(updated.client).toMatchObject({
      displayName: "Updated Sticky Client",
      state: "disabled",
      enabled: false,
      capabilityIds: ["browser", "web_automation"],
      trustDecision: "declared",
    });
    const persisted = await readFile(registryPath, "utf8");
    expect(persisted).not.toContain("should-not-be-stored");
    expect(persisted).not.toContain("65535/private");
    expect(persisted).not.toContain("apiKey");
    expect(persisted).not.toContain("9999");
  });

  it("revokes a client irreversibly with exact revision binding and restart persistence", async () => {
    let service = createService();
    const registered = await service.register({
      clientId: "revoked-client",
      displayName: "Revoked Client",
      capabilityIds: ["browser"],
    }, TENANT_A_SCOPE);
    const revision = Number(registered.client.revision);
    if (!Number.isSafeInteger(revision)) throw new Error("missing registered revision");

    await expect(service.revoke({
      clientId: "revoked-client",
      expectedRevision: revision,
      reason: "security_incident",
      dryRun: true,
    }, TENANT_A_SCOPE)).resolves.toMatchObject({
      mode: "preview",
      action: "revoke-preview",
      writesPerformed: false,
      client: { state: "declared" },
    });
    await expect(service.revoke({
      clientId: "revoked-client",
      expectedRevision: revision + 1,
    }, TENANT_A_SCOPE)).rejects.toMatchObject({
      code: "local_client_revoke_revision_conflict",
      statusCode: 409,
    });
    const revoked = await service.revoke({
      clientId: "revoked-client",
      expectedRevision: revision,
      reason: "security_incident",
    }, TENANT_A_SCOPE);
    expect(revoked).toMatchObject({
      mode: "applied",
      action: "revoked",
      client: {
        state: "revoked",
        enabled: false,
        routable: false,
        trustDecision: "rejected",
        revision: revision + 1,
      },
    });
    await expect(service.register({
      clientId: "revoked-client",
      displayName: "Attacker Re-Registration",
      capabilityIds: ["browser"],
    }, TENANT_A_SCOPE)).rejects.toMatchObject({
      code: "local_client_register_revoked",
      statusCode: 409,
    });
    await service.discover({
      source: "revocation-test",
      clients: [{ clientId: "revoked-client", name: "Discovered Again", capabilities: ["browser"] }],
    }, TENANT_A_SCOPE);
    await service.heartbeat({
      clientId: "revoked-client",
      healthStatus: "healthy",
      upsert: true,
    }, TENANT_A_SCOPE);
    await expect(service.list({ includeDisabled: true }, TENANT_A_SCOPE)).resolves.toMatchObject({
      clients: [{ clientId: "revoked-client", state: "revoked", enabled: false }],
    });
    await expect(service.revoke({
      clientId: "revoked-client",
      expectedRevision: revision + 1,
    }, TENANT_A_SCOPE)).resolves.toMatchObject({ action: "already-revoked" });

    await service.close();
    service = createService();
    await expect(service.list({ includeDisabled: true }, TENANT_A_SCOPE)).resolves.toMatchObject({
      clients: [{
        clientId: "revoked-client",
        state: "revoked",
        enabled: false,
        trustDecision: "rejected",
        revision: revision + 1,
      }],
    });
    await service.close();
  });

  it("refuses revocation without an authenticated registry authority", async () => {
    const service = createService({ registryIntegrityKey: undefined });
    const registered = await service.register({
      clientId: "unsigned-revoke-client",
      displayName: "Unsigned Revoke Client",
      capabilityIds: ["browser"],
    }, TENANT_A_SCOPE);
    await expect(service.revoke({
      clientId: "unsigned-revoke-client",
      expectedRevision: registered.client.revision,
    }, TENANT_A_SCOPE)).rejects.toMatchObject({
      code: "local_client_revoke_authority_unavailable",
      statusCode: 503,
    });
    await service.close();
  });

  it("stores diagnostic codes instead of caller-provided error or task text", async () => {
    const service = createService();
    await service.register({
      clientId: "privacy-client",
      displayName: "Privacy Client",
      capabilityIds: ["browser"],
    }, TENANT_A_SCOPE);
    await service.heartbeat({
      clientId: "privacy-client",
      healthStatus: "degraded",
      lastError: "secret-heartbeat-token-123",
    }, TENANT_A_SCOPE);
    await service.feedback({
      clientId: "privacy-client",
      taskId: "../../secret-task-id",
      status: "failure",
      error: "secret-feedback-token-456",
      requiredCapabilities: ["browser"],
    }, TENANT_A_SCOPE);
    await service.route({
      taskText: "secret route prompt 789",
      requiredCapabilities: ["browser"],
    }, TENANT_A_SCOPE);

    const persisted = `${await readFile(registryPath, "utf8")}\n${await readFile(executionLogPath, "utf8")}`;
    expect(persisted).not.toContain("secret-heartbeat-token-123");
    expect(persisted).not.toContain("secret-feedback-token-456");
    expect(persisted).not.toContain("../../secret-task-id");
    expect(persisted).not.toContain("secret route prompt 789");
    expect(persisted).toContain("client_reported_error");
  });

  it("applies a durable feedback event exactly once and rejects conflicting reuse", async () => {
    const feedbackStore = createLocalClientSqliteFeedbackDedupStore({
      sqlitePath: join(rootDir, "feedback.sqlite"),
      hostId: "management-test-host",
      integrityKey: Buffer.alloc(32, 0x45),
      namespace: "management-feedback-test",
    });
    const service = createService({ feedbackDedupStore: feedbackStore });
    await expect(service.getStatus(TENANT_A_SCOPE)).resolves.toMatchObject({
      feedbackDeduplication: {
        enabled: true,
        mode: "sqlite-feedback-dedup",
        durable: true,
        distributed: false,
        exactlyOnceAdmission: true,
        deliveryMode: "exclusive-leased-acknowledged",
      },
    });
    await service.register({
      clientId: "durable-feedback-client",
      displayName: "Durable Feedback Client",
      capabilityIds: ["browser"],
    }, TENANT_A_SCOPE);
    const event = {
      eventId: "event-0001",
      clientId: "durable-feedback-client",
      taskId: "task-0001",
      status: "success",
      latencyMs: 25,
      requiredCapabilities: ["browser"],
      observedAt: new Date().toISOString(),
    };

    const first = await service.feedback(event, TENANT_A_SCOPE);
    const replay = await service.feedback(event, TENANT_A_SCOPE);

    expect(first).toMatchObject({
      attempts: 1,
      successes: 1,
      failures: 0,
      deduplication: {
        exactlyOnce: true,
        state: "applied",
        replayed: false,
      },
    });
    expect(replay).toMatchObject({
      attempts: 1,
      successes: 1,
      failures: 0,
      deduplication: {
        exactlyOnce: true,
        state: "applied-replay",
        replayed: true,
      },
    });
    await expect(service.feedback({ ...event, latencyMs: 26 }, TENANT_A_SCOPE))
      .rejects.toMatchObject({ code: "LOCAL_CLIENT_FEEDBACK_EVENT_CONFLICT", statusCode: 409 });
    await service.close();
  });

  it("persists marker cleanup so the same event id is a new sample after the dedup TTL", async () => {
    let storeNowMs = Date.parse("2026-08-28T05:00:00.000Z");
    const feedbackStore = createLocalClientSqliteFeedbackDedupStore({
      sqlitePath: join(rootDir, "feedback-retirement.sqlite"),
      hostId: "management-retirement-host",
      integrityKey: Buffer.alloc(32, 0x47),
      namespace: "management-feedback-retirement",
      ttlMs: 20,
      leaseTtlMs: 10,
      now: () => storeNowMs,
    });
    const service = createService({ feedbackDedupStore: feedbackStore });
    await service.register({
      clientId: "feedback-retirement-client",
      displayName: "Feedback Retirement Client",
      capabilityIds: ["browser"],
    }, TENANT_A_SCOPE);
    const event = {
      eventId: "event-retirement-0001",
      clientId: "feedback-retirement-client",
      taskId: "task-retirement-0001",
      status: "success",
      latencyMs: 10,
      requiredCapabilities: ["browser"],
      observedAt: new Date(storeNowMs).toISOString(),
    };

    await expect(service.feedback(event, TENANT_A_SCOPE)).resolves.toMatchObject({ attempts: 1 });
    const afterFirst = JSON.parse(await readFile(registryPath, "utf8"));
    expect(afterFirst.clients[0].feedbackAppliedEventMarkers).toEqual([]);

    storeNowMs += 100;
    await expect(service.feedback(event, TENANT_A_SCOPE)).resolves.toMatchObject({
      attempts: 2,
      successes: 2,
      deduplication: { state: "applied", replayed: false },
    });
    await service.close();
  });

  it("reconciles a registry write after an acknowledgement crash without learning twice", async () => {
    const sqlitePath = join(rootDir, "feedback-recovery.sqlite");
    const feedbackKey = Buffer.alloc(32, 0x46);
    const firstStore = createLocalClientSqliteFeedbackDedupStore({
      sqlitePath,
      hostId: "management-recovery-host",
      integrityKey: feedbackKey,
      namespace: "management-feedback-recovery",
      leaseTtlMs: 1_000,
    });
    let failAcknowledgement = true;
    const crashingPort = {
      status: firstStore.status,
      admitAndClaim: firstStore.admitAndClaim.bind(firstStore),
      acknowledgeApplied: async (...args: Parameters<typeof firstStore.acknowledgeApplied>) => {
        if (failAcknowledgement) {
          failAcknowledgement = false;
          throw new Error("simulated crash after registry persistence");
        }
        return firstStore.acknowledgeApplied(...args);
      },
      releaseClaim: firstStore.releaseClaim.bind(firstStore),
      checkHealth: firstStore.checkHealth.bind(firstStore),
      close: firstStore.close.bind(firstStore),
    };
    const firstService = createService({ feedbackDedupStore: crashingPort });
    await firstService.register({
      clientId: "feedback-recovery-client",
      displayName: "Feedback Recovery Client",
      capabilityIds: ["browser"],
    }, TENANT_A_SCOPE);
    const event = {
      eventId: "event-recovery-0001",
      clientId: "feedback-recovery-client",
      taskId: "task-recovery-0001",
      status: "failure",
      latencyMs: 50,
      error: "must-not-govern-recovery",
      requiredCapabilities: ["browser"],
      observedAt: new Date().toISOString(),
    };
    await expect(firstService.feedback(event, TENANT_A_SCOPE)).rejects.toMatchObject({
      code: "local_client_feedback_outcome_unknown",
      statusCode: 503,
    });
    await firstService.close();

    const recoveredStore = createLocalClientSqliteFeedbackDedupStore({
      sqlitePath,
      hostId: "management-recovery-host",
      integrityKey: feedbackKey,
      namespace: "management-feedback-recovery",
      leaseTtlMs: 1_000,
    });
    const recoveredService = createService({ feedbackDedupStore: recoveredStore });
    const reconciled = await recoveredService.feedback(event, TENANT_A_SCOPE);
    const replayed = await recoveredService.feedback(event, TENANT_A_SCOPE);

    expect(reconciled).toMatchObject({
      attempts: 1,
      successes: 0,
      failures: 1,
      lastFailureMessage: "client_reported_error",
      deduplication: {
        exactlyOnce: true,
        state: "reconciled",
        replayed: true,
        reclaimed: true,
        reconciled: true,
        auditLogPersisted: false,
      },
    });
    expect(replayed).toMatchObject({
      attempts: 1,
      successes: 0,
      failures: 1,
      deduplication: {
        state: "applied-replay",
        replayed: true,
      },
    });
    const persisted = await readFile(registryPath, "utf8");
    expect(persisted).not.toContain("must-not-govern-recovery");
    expect(persisted).not.toContain("event-recovery-0001");
    await recoveredService.close();
  });

  it("disables only stale clients owned by the same discovery source", async () => {
    const service = createService({ staleClientThresholdMs: 30_000 });
    await service.discover({
      source: "scanner-a",
      clients: [{
        clientId: "scanner-client",
        name: "Scanner Client",
        capabilities: ["local-application"],
        lastSeenAt: "2000-01-01T00:00:00.000Z",
      }],
    }, TENANT_A_SCOPE);
    await service.register({
      clientId: "manual-client",
      name: "Manual Client",
      capabilities: ["local_application"],
      lastSeenAt: "2000-01-01T00:00:00.000Z",
    }, TENANT_A_SCOPE);

    await service.discover({
      source: "scanner-a",
      clients: [],
      includeMissingAsDisabled: true,
    }, TENANT_A_SCOPE);

    const registry = await service.list({ includeDisabled: true, limit: 10 }, TENANT_A_SCOPE);
    const clients = new Map(registry.clients.map((client: { clientId: string }) => [client.clientId, client]));
    expect(clients.get("scanner-client")).toMatchObject({ enabled: false });
    expect(clients.get("manual-client")).toMatchObject({ enabled: true });
  });

  it("fails closed without replacing a corrupt registry", async () => {
    const corrupt = "{not-json";
    await writeFile(registryPath, corrupt, "utf8");
    const service = createService();

    await expect(service.getStatus(TENANT_A_SCOPE)).rejects.toMatchObject({
      code: "local_client_registry_corrupt",
      statusCode: 503,
      category: "integrity",
    });
    expect(await readFile(registryPath, "utf8")).toBe(corrupt);
  });

  it("serializes concurrent registry persistence without losing clients", async () => {
    const service = createService();
    await Promise.all(Array.from({ length: 24 }, (_, index) => service.register({
      clientId: `client-${index}`,
      name: `Client ${index}`,
      capabilities: ["local_application"],
    }, TENANT_A_SCOPE)));

    const registry = await service.list({ includeDisabled: true, limit: 100 }, TENANT_A_SCOPE);
    const persisted = JSON.parse(await readFile(registryPath, "utf8")) as { clients: unknown[] };
    expect(registry.total).toBe(24);
    expect(persisted.clients).toHaveLength(24);
  });

  it("isolates identical client ids by caller scope and ignores tenant ids from request bodies", async () => {
    const service = createService();
    await service.register({
      tenantId: TENANT_B_SCOPE.tenantId,
      clientId: "shared-client",
      displayName: "Tenant A Client",
      capabilityIds: ["browser"],
    }, TENANT_A_SCOPE);
    await service.register({
      tenantId: TENANT_A_SCOPE.tenantId,
      clientId: "shared-client",
      displayName: "Tenant B Client",
      capabilityIds: ["terminal"],
    }, TENANT_B_SCOPE);
    await service.register({
      clientId: "tenant-a-only-client",
      displayName: "Tenant A Only Client",
      capabilityIds: ["browser"],
    }, TENANT_A_SCOPE);

    const tenantA = await service.list({ includeDisabled: true }, TENANT_A_SCOPE);
    const tenantB = await service.list({ includeDisabled: true }, TENANT_B_SCOPE);
    expect(tenantA.clients).toEqual(expect.arrayContaining([
      expect.objectContaining({
        clientId: "shared-client",
        displayName: "Tenant A Client",
        capabilityIds: ["browser"],
      }),
      expect.objectContaining({ clientId: "tenant-a-only-client" }),
    ]));
    expect(tenantB.clients).toEqual([expect.objectContaining({
      clientId: "shared-client",
      displayName: "Tenant B Client",
      capabilityIds: ["terminal"],
    })]);

    await service.disable({ clientId: "shared-client" }, TENANT_A_SCOPE);
    await expect(service.disable({ clientId: "tenant-a-only-client" }, TENANT_B_SCOPE)).rejects.toMatchObject({
      code: "local_client_disable_not_found",
      statusCode: 404,
    });
    const tenantAAfter = await service.list({ includeDisabled: true }, TENANT_A_SCOPE);
    expect(tenantAAfter.clients.find((client: { clientId: string }) => client.clientId === "shared-client")).toMatchObject({ enabled: false });
    expect(tenantAAfter.clients.find((client: { clientId: string }) => client.clientId === "tenant-a-only-client")).toMatchObject({ enabled: true });
    expect((await service.list({ includeDisabled: true }, TENANT_B_SCOPE)).clients[0]).toMatchObject({ enabled: true });
  });

  it("keeps discovered applications unverified and outside the routing pool", async () => {
    const service = createService();
    await service.discover({
      source: "tenant-a-scan",
      clients: [{
        clientId: "observed-browser",
        displayName: "Observed Browser",
        capabilities: ["browser"],
        trustLevel: "critical",
        routable: true,
      }],
    }, TENANT_A_SCOPE);

    const registry = await service.list({ includeDisabled: true }, TENANT_A_SCOPE);
    expect(registry.clients[0]).toMatchObject({
      state: "observed",
      routable: false,
      trustDecision: "unverified",
      capabilityIds: ["browser"],
    });
    await expect(service.route({ requiredCapabilities: ["browser"] }, TENANT_A_SCOPE)).resolves.toMatchObject({
      status: "no-client",
      selected: null,
    });
  });

  it("does not let discovery or heartbeat reactivate a disabled declared client", async () => {
    const service = createService();
    await service.register({
      clientId: "sticky-disabled-client",
      displayName: "Sticky Disabled Client",
      capabilityIds: ["browser"],
    }, TENANT_A_SCOPE);
    await service.disable({ clientId: "sticky-disabled-client" }, TENANT_A_SCOPE);
    await service.discover({
      source: "tenant-a-scan",
      clients: [{
        clientId: "sticky-disabled-client",
        displayName: "Spoofed Discovery Name",
        capabilities: ["terminal"],
      }],
    }, TENANT_A_SCOPE);
    await service.heartbeat({
      clientId: "sticky-disabled-client",
      healthStatus: "healthy",
      capabilities: ["terminal"],
    }, TENANT_A_SCOPE);

    const client = (await service.list({ includeDisabled: true }, TENANT_A_SCOPE)).clients[0];
    expect(client).toMatchObject({
      displayName: "Sticky Disabled Client",
      state: "disabled",
      enabled: false,
      routable: true,
      capabilityIds: ["browser"],
    });
    expect(await service.route({ requiredCapabilities: ["browser"] }, TENANT_A_SCOPE)).toMatchObject({
      status: "no-client",
      selected: null,
    });
  });

  it("redacts paths, commands, process ids, endpoints, metadata, and tenant ids from public projections", async () => {
    const service = createService({
      processRowsProvider: async () => [{ imageName: "chrome.exe", pid: "424242" }],
    });
    await service.register({
      tenantId: "body-tenant-must-not-leak",
      clientId: "redacted-client",
      displayName: "Redacted Client",
      capabilityIds: ["browser"],
      executable: "C:\\private\\secret-app.exe",
      command: "secret-app.exe --token hidden",
      endpoint: "http://127.0.0.1:9999/private",
      metadata: { processPid: 999999, rawSecret: "must-not-leak" },
    }, TENANT_A_SCOPE);

    const registryJson = JSON.stringify(await service.list({ includeDisabled: true }, TENANT_A_SCOPE));
    const statusJson = JSON.stringify(await service.getStatus(TENANT_A_SCOPE));
    const discoveryJson = JSON.stringify(await service.discoverFromSystem({ dryRun: true }, TENANT_A_SCOPE));
    for (const forbidden of [
      "private\\\\secret-app.exe",
      "--token hidden",
      "127.0.0.1:9999",
      "999999",
      "must-not-leak",
      "body-tenant-must-not-leak",
      registryPath,
      executionLogPath,
      "424242",
      "metadata",
    ]) {
      expect(registryJson).not.toContain(forbidden);
      expect(statusJson).not.toContain(forbidden);
      expect(discoveryJson).not.toContain(forbidden);
    }
  });

  it("persists a cryptographically verified promotion and resolves only its sanitized exact target", async () => {
    const adapterRegistry = governedAdapterRegistry();
    const service = createService({ adapterRegistry });
    const registered = await registerVerifiableClient(service);
    const currentTime = Date.now();
    const verifiedEvidence = verificationEvidence(currentTime);
    const verifier = createLocalClientVerificationService({
      store: service.verificationStore,
      probes: [verificationProbe(verifiedEvidence)],
      now: () => currentTime,
    });

    const promoted = await verifier.verifyAndPromote({
      clientId: "fixture.local-client",
      expectedRevision: registered.client.revision!,
      expectedAdapter: LOOPBACK_ADAPTER_REFERENCE,
      expectedManifestSha256: MANIFEST_SHA256,
      signal: new AbortController().signal,
    }, TENANT_A_IDENTITY);
    const listed = await service.list({ includeDisabled: true }, TENANT_A_SCOPE);
    const resolved = await service.resolveVerifiedTarget({
      identity: TENANT_A_IDENTITY,
      clientId: "fixture.local-client",
    });

    expect(promoted.revision).toBe(2);
    expect(listed.clients[0]).toMatchObject({
      clientId: "fixture.local-client",
      state: "verified",
      trustDecision: "verified",
      revision: 2,
      adapterId: LOOPBACK_ADAPTER_REFERENCE.id,
      adapterType: LOOPBACK_ADAPTER_REFERENCE.type,
      adapterVersion: LOOPBACK_ADAPTER_REFERENCE.version,
      manifestSha256: MANIFEST_SHA256,
      health: {
        leaseExpiresAt: new Date(verifiedEvidence.expiresAtMs).toISOString(),
      },
    });
    expect(resolved).toEqual({
      descriptorVersion: "verified-local-client-adapter-target-v1",
      clientId: "fixture.local-client",
      revision: 2,
      state: "verified",
      trustDecision: "verified",
      adapter: LOOPBACK_ADAPTER_REFERENCE,
      capabilityIds: ["local_application"],
    });
    const serializedPublic = JSON.stringify({ listed, resolved });
    for (const forbidden of [
      "tenant-a",
      "subject-a",
      verifiedEvidence.fingerprint,
      "sharedSecret",
      "endpoint",
      "nonce",
      "signature",
    ]) {
      expect(serializedPublic).not.toContain(forbidden);
    }

    const reloaded = createService({ adapterRegistry });
    await expect(reloaded.resolveVerifiedTarget({
      identity: TENANT_A_IDENTITY,
      clientId: "fixture.local-client",
    })).resolves.toEqual(resolved);
    expect((await reloaded.list({ includeDisabled: true }, TENANT_A_SCOPE)).clients[0]).toMatchObject({
      state: "verified",
      trustDecision: "verified",
      revision: 2,
    });
  });

  it("performs an exact synchronous CAS so only one concurrent promotion wins", async () => {
    const service = createService({ adapterRegistry: governedAdapterRegistry() });
    await registerVerifiableClient(service);
    const declaration = await service.verificationStore.readCurrent(
      TENANT_A_IDENTITY,
      "fixture.local-client",
    );
    expect(declaration).not.toBeNull();
    const evidence = verificationEvidence(Date.now());
    const request = {
      scope: TENANT_A_IDENTITY,
      expected: declaration!,
      declarationFingerprint: fingerprintLocalClientVerificationDeclaration(declaration!),
      evidence,
    };

    const results = await Promise.all([
      service.verificationStore.promoteExact(request),
      service.verificationStore.promoteExact(request),
    ]);

    expect(results.filter(Boolean)).toHaveLength(1);
    expect(results.filter((result) => result === null)).toHaveLength(1);
    expect((await service.list({ includeDisabled: true }, TENANT_A_SCOPE)).clients[0]).toMatchObject({
      state: "verified",
      revision: 2,
    });
  });

  it("rejects cross-tenant and stale-revision promotion attempts", async () => {
    const service = createService({ adapterRegistry: governedAdapterRegistry() });
    await registerVerifiableClient(service);
    const declaration = await service.verificationStore.readCurrent(
      TENANT_A_IDENTITY,
      "fixture.local-client",
    );
    expect(declaration).not.toBeNull();
    expect(await service.verificationStore.readCurrent(
      { tenantId: "tenant-b", subjectId: "subject-b" },
      "fixture.local-client",
    )).toBeNull();
    const stale = {
      ...declaration!,
      revision: declaration!.revision + 1,
    } satisfies LocalClientVerificationDeclaration;

    await expect(service.verificationStore.promoteExact({
      scope: TENANT_A_IDENTITY,
      expected: stale,
      declarationFingerprint: fingerprintLocalClientVerificationDeclaration(stale),
      evidence: verificationEvidence(Date.now()),
    })).resolves.toBeNull();
    await expect(service.verificationStore.promoteExact({
      scope: { tenantId: "tenant-b", subjectId: "subject-b" },
      expected: declaration!,
      declarationFingerprint: fingerprintLocalClientVerificationDeclaration(declaration!),
      evidence: verificationEvidence(Date.now()),
    })).resolves.toBeNull();
    expect((await service.list({ includeDisabled: true }, TENANT_A_SCOPE)).clients[0]).toMatchObject({
      state: "declared",
      revision: 1,
    });
  });

  it("rolls in-memory authority back when verified persistence fails", async () => {
    const service = createService({ adapterRegistry: governedAdapterRegistry() });
    await registerVerifiableClient(service);
    const declaration = await service.verificationStore.readCurrent(
      TENANT_A_IDENTITY,
      "fixture.local-client",
    );
    expect(declaration).not.toBeNull();
    const evidence = verificationEvidence(Date.now());
    await mkdir(`${registryPath}.tmp`);

    await expect(service.verificationStore.promoteExact({
      scope: TENANT_A_IDENTITY,
      expected: declaration!,
      declarationFingerprint: fingerprintLocalClientVerificationDeclaration(declaration!),
      evidence,
    })).rejects.toMatchObject({
      code: "local_client_verification_persistence_failed",
      category: "integrity",
      statusCode: 503,
    });
    expect((await service.list({ includeDisabled: true }, TENANT_A_SCOPE)).clients[0]).toMatchObject({
      state: "declared",
      trustDecision: "declared",
      revision: 1,
    });
    const persisted = await readFile(registryPath, "utf8");
    expect(persisted).not.toContain(evidence.fingerprint);
    expect(persisted).toContain('"verificationStatus": "declared"');
  });

  it("invalidates verified authority and removes evidence when a declaration changes", async () => {
    const service = createService({ adapterRegistry: governedAdapterRegistry() });
    const registered = await registerVerifiableClient(service);
    const currentTime = Date.now();
    const evidence = verificationEvidence(currentTime);
    const verifier = createLocalClientVerificationService({
      store: service.verificationStore,
      probes: [verificationProbe(evidence)],
      now: () => currentTime,
    });
    await verifier.verifyAndPromote({
      clientId: "fixture.local-client",
      expectedRevision: registered.client.revision!,
      expectedAdapter: LOOPBACK_ADAPTER_REFERENCE,
      expectedManifestSha256: MANIFEST_SHA256,
      signal: new AbortController().signal,
    }, TENANT_A_IDENTITY);

    const changed = await service.register({
      clientId: "fixture.local-client",
      displayName: "Changed Client",
      capabilityIds: ["local_application"],
      ...LOOPBACK_REGISTER_BINDING,
      manifestSha256: "c".repeat(64),
    }, TENANT_A_SCOPE);

    expect(changed.client).toMatchObject({
      state: "declared",
      trustDecision: "declared",
      revision: 3,
      manifestSha256: "c".repeat(64),
    });
    await expect(service.resolveVerifiedTarget({
      identity: TENANT_A_IDENTITY,
      clientId: "fixture.local-client",
    })).rejects.toMatchObject({
      code: "local_client_verified_target_unavailable",
    });
    expect(await readFile(registryPath, "utf8")).not.toContain(evidence.fingerprint);
  });

  it("rejects expired evidence and a changed registered adapter at resolution time", async () => {
    vi.useFakeTimers();
    const baseTime = Date.parse("2026-08-28T10:00:00.000Z");
    vi.setSystemTime(baseTime);
    const service = createService({ adapterRegistry: governedAdapterRegistry() });
    const registered = await registerVerifiableClient(service);
    const evidence = verificationEvidence(baseTime, 60_000);
    const verifier = createLocalClientVerificationService({
      store: service.verificationStore,
      probes: [verificationProbe(evidence)],
      now: () => baseTime,
    });
    await verifier.verifyAndPromote({
      clientId: "fixture.local-client",
      expectedRevision: registered.client.revision!,
      expectedAdapter: LOOPBACK_ADAPTER_REFERENCE,
      expectedManifestSha256: MANIFEST_SHA256,
      signal: new AbortController().signal,
    }, TENANT_A_IDENTITY);

    vi.setSystemTime(baseTime + 60_000);
    await expect(service.resolveVerifiedTarget({
      identity: TENANT_A_IDENTITY,
      clientId: "fixture.local-client",
    })).rejects.toMatchObject({
      code: "local_client_verified_target_unavailable",
    });

    vi.setSystemTime(baseTime + 1_000);
    const mismatchedReload = createService({
      adapterRegistry: governedAdapterRegistry({ version: "2.0.0" }),
    });
    await expect(mismatchedReload.resolveVerifiedTarget({
      identity: TENANT_A_IDENTITY,
      clientId: "fixture.local-client",
    })).rejects.toMatchObject({
      code: "local_client_verified_target_adapter_mismatch",
    });
  });

  it("rejects a persisted verified row whose authenticated declaration binding was changed", async () => {
    const adapterRegistry = governedAdapterRegistry();
    const service = createService({ adapterRegistry });
    const registered = await registerVerifiableClient(service);
    const currentTime = Date.now();
    const verifier = createLocalClientVerificationService({
      store: service.verificationStore,
      probes: [verificationProbe(verificationEvidence(currentTime))],
      now: () => currentTime,
    });
    await verifier.verifyAndPromote({
      clientId: "fixture.local-client",
      expectedRevision: registered.client.revision!,
      expectedAdapter: LOOPBACK_ADAPTER_REFERENCE,
      expectedManifestSha256: MANIFEST_SHA256,
      signal: new AbortController().signal,
    }, TENANT_A_IDENTITY);
    const persisted = JSON.parse(await readFile(registryPath, "utf8")) as {
      clients: Array<{ manifestSha256: string }>;
    };
    persisted.clients[0]!.manifestSha256 = "d".repeat(64);
    await writeFile(registryPath, JSON.stringify(persisted, null, 2), "utf8");

    const reloaded = createService({ adapterRegistry });
    await expect(reloaded.list({ includeDisabled: true }, TENANT_A_SCOPE)).rejects.toMatchObject({
      code: "local_client_registry_corrupt",
      category: "integrity",
      statusCode: 503,
    });
  });

  it("never exposes the built-in fake adapter as a verifiable declaration", async () => {
    const fakeDescriptor = governedAdapterDescriptor({
      id: "builtin.fake.local-client",
      type: "fake",
    });
    const service = createService({ adapterRegistry: { list: () => [fakeDescriptor] } });
    await service.register({
      clientId: "fixture.local-client",
      displayName: "Fake Client",
      capabilityIds: ["local_application"],
      adapterId: fakeDescriptor.id,
      adapterType: fakeDescriptor.type,
      adapterVersion: fakeDescriptor.version,
      manifestSha256: MANIFEST_SHA256,
    }, TENANT_A_SCOPE);

    await expect(service.verificationStore.readCurrent(
      TENANT_A_IDENTITY,
      "fixture.local-client",
    )).resolves.toBeNull();
    await expect(service.resolveVerifiedTarget({
      identity: TENANT_A_IDENTITY,
      clientId: "fixture.local-client",
    })).rejects.toMatchObject({
      code: "local_client_verified_target_unavailable",
    });
  });
});

const LOOPBACK_ADAPTER_REFERENCE = Object.freeze({
  id: "builtin.loopback.local-client",
  type: "loopback-http",
  version: "1.0.0",
});

const LOOPBACK_REGISTER_BINDING = Object.freeze({
  adapterId: LOOPBACK_ADAPTER_REFERENCE.id,
  adapterType: LOOPBACK_ADAPTER_REFERENCE.type,
  adapterVersion: LOOPBACK_ADAPTER_REFERENCE.version,
  manifestSha256: MANIFEST_SHA256,
});

function governedAdapterDescriptor(
  overrides: Partial<LocalClientAdapterDescriptor> = {},
): LocalClientAdapterDescriptor {
  return {
    descriptorVersion: "local-client-adapter-descriptor-v1",
    id: LOOPBACK_ADAPTER_REFERENCE.id,
    type: LOOPBACK_ADAPTER_REFERENCE.type,
    version: LOOPBACK_ADAPTER_REFERENCE.version,
    actions: [{
      actionId: "invoke",
      capabilityId: "local_application",
      inputSchema: {
        schemaId: "local-client.loopback.invoke.input",
        schemaVersion: 1,
        fields: [],
        additionalProperties: false,
      },
    }],
    ...overrides,
  };
}

function governedAdapterRegistry(
  overrides: Partial<LocalClientAdapterDescriptor> = {},
) {
  const descriptor = governedAdapterDescriptor(overrides);
  return Object.freeze({ list: () => Object.freeze([descriptor]) });
}

async function registerVerifiableClient(
  service: ReturnType<typeof createLocalClientManagementService>,
) {
  return service.register({
    clientId: "fixture.local-client",
    displayName: "Fixture Client",
    capabilityIds: ["local_application"],
    ...LOOPBACK_REGISTER_BINDING,
  }, TENANT_A_SCOPE);
}

function verificationEvidence(
  verifiedAtMs: number,
  ttlMs = 60_000,
): LocalClientVerificationEvidence {
  return Object.freeze({
    evidenceVersion: LOCAL_CLIENT_VERIFICATION_EVIDENCE_VERSION,
    fingerprint: "e".repeat(64),
    verifiedAtMs,
    expiresAtMs: verifiedAtMs + ttlMs,
  });
}

function verificationProbe(evidence: LocalClientVerificationEvidence) {
  return Object.freeze({
    descriptor: Object.freeze({
      descriptorVersion: LOCAL_CLIENT_VERIFICATION_PROBE_DESCRIPTOR_VERSION,
      assurance: "governed-hmac-sha256-loopback" as const,
      clientId: "fixture.local-client",
      adapter: LOOPBACK_ADAPTER_REFERENCE,
      manifestSha256: MANIFEST_SHA256,
    }),
    async probe() {
      return evidence;
    },
  });
}
