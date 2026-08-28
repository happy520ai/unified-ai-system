import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { createErrorEnvelope, createOkEnvelope } from "@unified-ai-system/shared-utils";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createLocalClientManagementService } from "../capabilities/localClientManagementService.ts";
import { dispatchHttpRoutes03 } from "./httpServerRoutes03.js";
import { isPublicRoute } from "./routeAccessPolicy.js";
import { shouldRejectUnmappedRoute } from "./runtimeRouteAccessManifest.ts";
import {
  readCapabilityJson,
  resolvePermission,
  writeCapabilityError,
} from "./utils/enterpriseUtils.js";
import { writeJson } from "./utils/responseUtils.js";

type TestResponse = {
  statusCode: number;
  payload: any;
  headers: Record<string, string>;
  writableEnded: boolean;
  destroyed: boolean;
  headersSent: boolean;
  setHeader: (name: string, value: string) => void;
  writeHead: (statusCode: number, headers: Record<string, string>) => void;
  end: (raw: string) => void;
};

type LocalClientServiceOptions = NonNullable<
  Parameters<typeof createLocalClientManagementService>[0]
> & {
  registryPath: string;
  executionLogPath: string;
  discoveryHintsPath: string;
};

const LOCAL_CLIENT_ROUTE_PERMISSIONS = [
  ["GET", "/local-clients/status", "dashboard:read"],
  ["GET", "/local-clients/health", "dashboard:read"],
  ["GET", "/local-clients/registry", "audit:read"],
  ["GET", "/local-clients/intelligence", "dashboard:read"],
  ["POST", "/local-clients/discover", "workflow:approve"],
  ["POST", "/local-clients/discover/system", "workflow:approve"],
  ["POST", "/local-clients/maintenance", "workflow:approve"],
  ["POST", "/local-clients/smart-manage", "workflow:approve"],
  ["POST", "/local-clients/register", "workflow:approve"],
  ["POST", "/local-clients/disable", "workflow:approve"],
  ["POST", "/local-clients/revoke", "workflow:approve"],
  ["POST", "/local-clients/route", "workflow:run"],
  ["POST", "/local-clients/provider-route", "workflow:run"],
  ["POST", "/local-clients/verify", "workflow:approve"],
  ["POST", "/local-clients/executions/preview", "workflow:run"],
  ["POST", "/local-clients/executions/approve", "workflow:approve"],
  ["POST", "/local-clients/executions/execute", "workflow:approve"],
  ["GET", "/local-clients/executions/lc-exec-status-test", "dashboard:read"],
  ["POST", "/local-clients/executions/lc-exec-status-test/cancel", "workflow:approve"],
  ["POST", "/local-clients/execute", "workflow:approve"],
  ["POST", "/local-clients/heartbeat", "local-client:telemetry"],
  ["POST", "/local-clients/feedback", "local-client:telemetry"],
  ["GET", "/local-clients/onboarding/profiles", "dashboard:read"],
  ["GET", "/local-clients/onboarding/profiles/cursor-mcp-json", "audit:read"],
  ["GET", "/local-clients/onboarding/profiles/vscode-mcp-json/verify", "audit:read"],
  ["POST", "/local-clients/onboarding/plans", "workflow:run"],
  ["POST", "/local-clients/onboarding/approve", "workflow:approve"],
  ["POST", "/local-clients/onboarding/apply", "workflow:approve"],
  ["POST", "/local-clients/onboarding/rollback", "workflow:approve"],
  ["POST", "/local-clients/onboarding/recover", "workflow:approve"],
] as const;

function createResponse(): TestResponse {
  return {
    statusCode: 0,
    payload: undefined,
    headers: {},
    writableEnded: false,
    destroyed: false,
    headersSent: false,
    setHeader(name, value) {
      this.headers[name] = value;
    },
    writeHead(statusCode, headers) {
      this.statusCode = statusCode;
      this.headers = { ...this.headers, ...headers };
      this.headersSent = true;
    },
    end(raw) {
      this.payload = JSON.parse(raw);
      this.writableEnded = true;
    },
  };
}

function createProcessRowsProvider() {
  return vi.fn(async (_maxRows?: number): Promise<Array<{ imageName: string }>> => {
    throw new Error("process discovery must not run in HTTP route tests");
  });
}

describe("local client management HTTP routes", () => {
  let rootDir: string;
  let localClientManagementService: ReturnType<typeof createLocalClientManagementService>;
  let processRowsProvider: ReturnType<typeof createProcessRowsProvider>;

  beforeEach(async () => {
    rootDir = await mkdtemp(join(tmpdir(), "gateway-local-client-routes-"));
    processRowsProvider = createProcessRowsProvider();
    const options: LocalClientServiceOptions = {
      executionEnabled: false,
      registryPath: join(rootDir, "registry.json"),
      executionLogPath: join(rootDir, "execution-log.jsonl"),
      discoveryHintsPath: join(rootDir, "discovery-hints.json"),
      processRowsProvider,
      registryIntegrityKey: Buffer.alloc(32, 0x72),
    };
    localClientManagementService = createLocalClientManagementService(options);
  });

  afterEach(async () => {
    await rm(rootDir, { recursive: true, force: true });
  });

  async function dispatch(
    method: string,
    pathname: string,
    body: unknown = {},
    enterpriseIdentity: { tenantId: string; userId: string; role: string } = {
      tenantId: "tenant-local-route-test",
      userId: "route-test-user",
      role: "operator",
    },
    application: Record<string, unknown> = {},
    headers: Record<string, string> = {},
  ) {
    const response = createResponse();
    const request = {
      method,
      body,
      headers,
      enterpriseIdentity,
    };

    await dispatchHttpRoutes03({
      application,
      localClientManagementService,
      request,
      requestExecution: { signal: new AbortController().signal },
      response,
      url: new URL(`http://gateway.local${pathname}`),
      startedAt: Date.now(),
      createErrorEnvelope,
      createOkEnvelope,
      readCapabilityJson,
      writeCapabilityError,
      writeJson,
    } as any);

    return response;
  }

  it("supports register -> route -> execute-preview without process discovery or a provider", async () => {
    const registered = await dispatch("POST", "/local-clients/register", {
      clientId: "route-test-browser",
      displayName: "Route Test Browser",
      capabilityIds: ["browser", "web_automation"],
      healthStatus: "healthy",
      trustLevel: "high",
    });
    expect(registered).toMatchObject({
      statusCode: 200,
      headers: { "Cache-Control": "no-store" },
      payload: {
        status: "ok",
        data: {
          action: "created",
          client: { clientId: "route-test-browser" },
        },
      },
    });

    const routed = await dispatch("POST", "/local-clients/route", {
      requiredCapabilities: ["browser"],
    });
    expect(routed).toMatchObject({
      statusCode: 200,
      payload: {
        status: "ok",
        data: {
          status: "route-ready",
          selected: {
            clientId: "route-test-browser",
            missingCapabilities: [],
          },
        },
      },
    });

    const preview = await dispatch("POST", "/local-clients/execute", {
      clientId: "route-test-browser",
      requiredCapabilities: ["browser"],
      dryRun: false,
    });
    expect(preview).toMatchObject({
      statusCode: 200,
      payload: {
        status: "ok",
        data: {
          executionEnabled: false,
          dryRun: true,
          status: "preview-only",
          selectedClientId: "route-test-browser",
        },
      },
    });
    expect(processRowsProvider).not.toHaveBeenCalled();
  });

  it("degrades status only while receipt recovery reports a consecutive active failure", async () => {
    await dispatch("POST", "/local-clients/register", {
      clientId: "recovery-health-client",
      displayName: "Recovery Health Client",
      capabilityIds: ["browser"],
      healthStatus: "healthy",
      trustLevel: "high",
    });
    const recoveryStatus = {
      enabled: true,
      available: true,
      lifecycle: "started",
      executionRedispatchAllowed: false,
      failureCount: 2,
      consecutiveFailureCount: 1,
      lastRunSucceeded: false,
      lastSuccessAt: "2026-08-27T23:59:00.000Z",
    };

    const failed = await dispatch(
      "GET",
      "/local-clients/status",
      {},
      undefined,
      { localClientExecutionReceiptRecoveryStatus: recoveryStatus },
    );
    expect(failed.payload.data).toMatchObject({
      status: "degraded",
      boundaries: {
        gatewayAuthoritySecretRequired: true,
        gatewayClientSecretReuseForbidden: true,
      },
      executionFeedback: {
        receiptRecovery: {
          consecutiveFailureCount: 1,
          lastRunSucceeded: false,
        },
      },
    });

    const recovered = await dispatch(
      "GET",
      "/local-clients/status",
      {},
      undefined,
      {
        localClientExecutionReceiptRecoveryStatus: {
          ...recoveryStatus,
          consecutiveFailureCount: 0,
          lastRunSucceeded: true,
          lastSuccessAt: "2026-08-28T00:01:00.000Z",
        },
      },
    );
    expect(recovered.payload.data.status).toBe("preview-ready");
  });

  it("exposes exact-revision revocation and keeps the revoked client non-routable", async () => {
    const registered = await dispatch("POST", "/local-clients/register", {
      clientId: "http-revoked-client",
      displayName: "HTTP Revoked Client",
      capabilityIds: ["browser"],
    });
    const revision = registered.payload.data.client.revision;
    const revoked = await dispatch("POST", "/local-clients/revoke", {
      clientId: "http-revoked-client",
      expectedRevision: revision,
      reason: "identity_mismatch",
    });
    const routed = await dispatch("POST", "/local-clients/route", {
      requiredCapabilities: ["browser"],
    });

    expect(revoked).toMatchObject({
      statusCode: 200,
      headers: { "Cache-Control": "no-store" },
      payload: {
        status: "ok",
        data: {
          action: "revoked",
          client: {
            clientId: "http-revoked-client",
            state: "revoked",
            enabled: false,
            routable: false,
            trustDecision: "rejected",
            revision: revision + 1,
          },
        },
      },
    });
    expect(routed.payload.data).toMatchObject({ status: "no-client", selected: null });
  });

  it("returns the shared error envelope and preserves service status metadata", async () => {
    const response = await dispatch("POST", "/local-clients/heartbeat", {
      clientId: "missing-client",
      healthStatus: "healthy",
      upsert: false,
    });

    expect(response).toMatchObject({
      statusCode: 404,
      headers: { "Cache-Control": "no-store" },
      payload: {
        status: "error",
        error: {
          code: "local_client_heartbeat_not_found",
          category: "not_found",
          retryable: false,
        },
        meta: {
          durationMs: expect.any(Number),
        },
      },
    });
    expect(processRowsProvider).not.toHaveBeenCalled();
  });

  it.each([null, false, 0, "", []])(
    "rejects a valid JSON scalar/array body without leaving the response open (%j)",
    async (body) => {
      const response = await dispatch("POST", "/local-clients/executions/preview", body, undefined, {
        localClientGovernedExecutionApi: { preview: vi.fn() },
      });
      expect(response).toMatchObject({
        statusCode: 400,
        writableEnded: true,
        payload: {
          status: "error",
          error: {
            code: "local_client_execution_preview_invalid_json",
            category: "validation",
          },
        },
      });
    },
  );

  it("derives provider-policy identity from enterprise scope and rejects body-supplied routing facts", async () => {
    const route = vi.fn(async (input) => ({
      runtimeRouterVersion: "local-client-provider-runtime-router-v1",
      dispatchPerformed: false,
      received: input,
    }));
    const identity = { tenantId: "tenant-provider-route", userId: "provider-route-user", role: "operator" };
    const response = await dispatch("POST", "/local-clients/provider-route", {
      clientId: "desktop-agent",
      requiredCapabilities: ["reasoning"],
      requestedFanout: 1,
      fusionRequested: false,
    }, identity, {
      localClientProviderRuntimeRouter: { route },
    });
    expect(response).toMatchObject({
      statusCode: 200,
      headers: { "Cache-Control": "no-store" },
      payload: {
        status: "ok",
        data: {
          dispatchPerformed: false,
          received: {
            tenantId: identity.tenantId,
            subjectId: identity.userId,
            clientId: "desktop-agent",
          },
        },
      },
    });
    expect(route).toHaveBeenCalledWith({
      tenantId: identity.tenantId,
      subjectId: identity.userId,
      clientId: "desktop-agent",
      requiredCapabilities: ["reasoning"],
      requestedFanout: 1,
      fusionRequested: false,
    });

    const guardedRoute = vi.fn(async (input: Record<string, unknown>) => {
      if ("candidates" in input || "policy" in input) {
        throw Object.assign(new Error("request facts denied"), {
          code: "LOCAL_CLIENT_PROVIDER_RUNTIME_REQUEST_INVALID",
          category: "validation",
          statusCode: 400,
        });
      }
      return {};
    });
    const rejected = await dispatch("POST", "/local-clients/provider-route", {
      clientId: "desktop-agent",
      candidates: [{ provider: "attacker", health: 1 }],
      policy: { dataClass: "public" },
    }, identity, {
      localClientProviderRuntimeRouter: { route: guardedRoute },
    });
    expect(rejected).toMatchObject({
      statusCode: 400,
      payload: { status: "error", error: { code: "LOCAL_CLIENT_PROVIDER_RUNTIME_REQUEST_INVALID" } },
    });
  });

  it("binds trusted verification to enterprise identity and the HTTP cancellation signal", async () => {
    const verifyAndPromote = vi.fn(async (_request: unknown, _scope: unknown) => ({
      promotionVersion: "local-client-verification-promotion-v1",
      clientId: "managed.local-client",
      revision: 2,
      state: "verified",
    }));
    const identity = { tenantId: "tenant-verify-route", userId: "verify-route-user", role: "operator" };
    const response = await dispatch("POST", "/local-clients/verify", {
      tenantId: "attacker-tenant",
      clientId: "managed.local-client",
      expectedRevision: 1,
      expectedAdapter: {
        id: "builtin.loopback.local-client",
        type: "loopback-http",
        version: "1.0.0",
      },
      expectedManifestSha256: "a".repeat(64),
    }, identity, {
      localClientVerificationService: { verifyAndPromote },
    });
    expect(response).toMatchObject({
      statusCode: 200,
      headers: { "Cache-Control": "no-store" },
      payload: { status: "ok", data: { state: "verified", revision: 2 } },
    });
    expect(verifyAndPromote).toHaveBeenCalledWith(expect.objectContaining({
      clientId: "managed.local-client",
      signal: expect.any(AbortSignal),
    }), {
      tenantId: identity.tenantId,
      subjectId: identity.userId,
    });
    expect(verifyAndPromote.mock.calls[0]?.[0]).not.toHaveProperty("tenantId");
  });

  it("exposes governed preview and approval while deriving all identity fields from enterprise scope", async () => {
    const preview = vi.fn(async (input) => ({
      operation: "preview",
      status: "approval-required",
      executionPerformed: false,
      received: input,
    }));
    const approve = vi.fn(async (input) => ({
      operation: "approve",
      status: "approved",
      executionPerformed: false,
      received: input,
    }));
    const identity = { tenantId: "tenant-governed-route", userId: "governed-route-user", role: "operator" };
    const application = { localClientGovernedExecutionApi: { preview, approve } };
    const previewResponse = await dispatch("POST", "/local-clients/executions/preview", {
      clientId: "managed.local-client",
      capabilityId: "local_application",
      actionId: "invoke",
      input: { payload: "safe-public-payload" },
    }, identity, application);
    const approveResponse = await dispatch("POST", "/local-clients/executions/approve", {
      planId: "b".repeat(64),
      note: "operator approved exact plan",
    }, identity, application);

    expect(previewResponse).toMatchObject({
      statusCode: 200,
      payload: { status: "ok", data: { operation: "preview", status: "approval-required" } },
    });
    expect(approveResponse).toMatchObject({
      statusCode: 200,
      payload: { status: "ok", data: { operation: "approve", status: "approved" } },
    });
    expect(preview).toHaveBeenCalledWith(expect.objectContaining({
      tenantId: identity.tenantId,
      subjectId: identity.userId,
      clientId: "managed.local-client",
    }));
    expect(approve).toHaveBeenCalledWith({
      tenantId: identity.tenantId,
      subjectId: identity.userId,
      planId: "b".repeat(64),
      note: "operator approved exact plan",
    });
  });

  it("exposes redacted onboarding inspection and derives tenant/subject only from enterprise identity", async () => {
    const list = vi.fn(async () => [{
      profileId: "cursor-mcp-json",
      client: "cursor",
      format: "json-only",
      certificationStatus: "fixture-tested-not-real-client-certified",
      redacted: true,
    }]);
    const inspect = vi.fn(async () => ({
      profile: { profileId: "cursor-mcp-json", client: "cursor", redacted: true },
      installation: { state: "absent", installed: false, redacted: true },
      recoveryRequired: false,
      available: true,
    }));
    const verify = vi.fn(async () => ({
      profileId: "vscode-mcp-json",
      state: "exact",
      installed: true,
      format: "json-only",
      certificationStatus: "fixture-tested-not-real-client-certified",
      redacted: true,
    }));
    const plan = vi.fn(async () => ({
      planId: `onboarding_${"a".repeat(64)}`,
      planDigest: "a".repeat(64),
      writesPerformed: false,
      redacted: true,
    }));
    const approve = vi.fn(async (_input, port) => {
      expect(port.getHeader("idempotency-key")).toBe("onboarding-approval-key-1");
      return { operation: "approve", status: "approved", writesPerformed: false, redacted: true };
    });
    const identity = { tenantId: "tenant-onboarding", userId: "onboarding-operator", role: "operator" };
    const getOnboardingStatus = vi.fn(() => ({
      enabled: true,
      initializationState: "ready",
      configurationVersion: 1,
      configuredProfileCount: 3,
      clients: ["claude-compatible", "cursor", "vscode"],
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
    }));
    const application = {
      localClientGovernedOnboardingApi: { list, inspect, verify, plan, approve },
      localClientGovernedOnboardingRuntime: { getStatus: getOnboardingStatus },
    };

    const profilesResponse = await dispatch(
      "GET",
      "/local-clients/onboarding/profiles",
      {},
      identity,
      application,
    );
    const profileResponse = await dispatch(
      "GET",
      "/local-clients/onboarding/profiles/cursor-mcp-json",
      {},
      identity,
      application,
    );
    const verifyResponse = await dispatch(
      "GET",
      "/local-clients/onboarding/profiles/vscode-mcp-json/verify",
      {},
      identity,
      application,
    );
    const planResponse = await dispatch(
      "POST",
      "/local-clients/onboarding/plans",
      { profileId: "cursor-mcp-json", action: "enable", tenantId: "spoofed", subjectId: "spoofed" },
      identity,
      application,
    );
    const approveResponse = await dispatch(
      "POST",
      "/local-clients/onboarding/approve",
      { planId: `onboarding_${"a".repeat(64)}`, tenantId: "spoofed", subjectId: "spoofed" },
      identity,
      application,
      { "idempotency-key": "onboarding-approval-key-1" },
    );
    const statusResponse = await dispatch(
      "GET",
      "/local-clients/status",
      {},
      identity,
      application,
    );

    expect([profilesResponse, profileResponse, verifyResponse, planResponse, approveResponse, statusResponse]
      .map((entry) => entry.statusCode)).toEqual([200, 200, 200, 200, 200, 200]);
    expect(list).toHaveBeenCalledWith({ tenantId: identity.tenantId, subjectId: identity.userId });
    expect(inspect).toHaveBeenCalledWith({
      tenantId: identity.tenantId,
      subjectId: identity.userId,
      profileId: "cursor-mcp-json",
    });
    expect(verify).toHaveBeenCalledWith({
      tenantId: identity.tenantId,
      subjectId: identity.userId,
      profileId: "vscode-mcp-json",
    });
    expect(plan).toHaveBeenCalledWith({
      tenantId: identity.tenantId,
      subjectId: identity.userId,
      profileId: "cursor-mcp-json",
      action: "enable",
    });
    expect(approve).toHaveBeenCalledWith({
      tenantId: identity.tenantId,
      subjectId: identity.userId,
      planId: `onboarding_${"a".repeat(64)}`,
    }, expect.any(Object));
    expect(statusResponse.payload.data.onboarding).toMatchObject({
      enabled: true,
      initializationState: "ready",
      configuredProfileCount: 3,
      automaticDiscoveryOrMutation: false,
      sensitiveConfigurationRedacted: true,
      tenantOwned: true,
      backupProtection: "aes-256-gcm",
    });
    expect(JSON.stringify(profilesResponse.payload)).not.toContain("tenant-onboarding");
  });

  it("surfaces governed onboarding unknown outcomes with durable idempotency metadata", async () => {
    const apply = vi.fn(async (_input, port) => {
      expect(port.getHeader("idempotency-key")).toBe("onboarding-apply-key-1");
      expect(port.signal).toBeInstanceOf(AbortSignal);
      return {
        accepted: false,
        status: "unknown-reconcile-required",
        statusCode: 503,
        code: "LOCAL_CLIENT_ONBOARDING_OUTCOME_UNKNOWN",
        message: "Inspect the profile before any retry.",
        replayed: false,
        replayable: false,
        operationInvoked: true,
        retryAllowed: false,
        result: null,
      };
    });
    const identity = { tenantId: "tenant-onboarding", userId: "onboarding-operator", role: "operator" };
    const response = await dispatch(
      "POST",
      "/local-clients/onboarding/apply",
      { planId: `onboarding_${"b".repeat(64)}` },
      identity,
      { localClientGovernedOnboardingApi: { apply } },
      { "idempotency-key": "onboarding-apply-key-1" },
    );

    expect(apply).toHaveBeenCalledWith({
      tenantId: identity.tenantId,
      subjectId: identity.userId,
      planId: `onboarding_${"b".repeat(64)}`,
    }, expect.any(Object));
    expect(response).toMatchObject({
      statusCode: 503,
      headers: {
        "Cache-Control": "no-store",
        "Idempotency-Replayed": "false",
        "Idempotency-Replayable": "false",
      },
      payload: {
        status: "error",
        error: {
          code: "LOCAL_CLIENT_ONBOARDING_OUTCOME_UNKNOWN",
          category: "integrity",
          retryable: false,
          details: {
            status: "unknown-reconcile-required",
            retryAllowed: false,
            operationInvoked: true,
          },
        },
      },
    });
  });

  it("requires and surfaces durable idempotency outcomes on the governed execute route", async () => {
    const execute = vi.fn(async (_input, port) => {
      expect(port.getHeader("idempotency-key")).toBe("local-execution-key-1");
      expect(port.signal).toBeInstanceOf(AbortSignal);
      return {
        accepted: false,
        status: "unknown-reconcile-required",
        statusCode: 409,
        code: "LOCAL_CLIENT_EXECUTION_OUTCOME_UNKNOWN",
        message: "Reconcile before any retry.",
        idempotencyStatus: "operation-error",
        replayed: false,
        replayable: false,
        operationInvoked: true,
        retryAllowed: false,
        result: null,
      };
    });
    const identity = { tenantId: "tenant-execute-route", userId: "execute-route-user", role: "operator" };
    const response = await dispatch("POST", "/local-clients/executions/execute", {
      planId: "c".repeat(64),
      input: { payload: "bounded" },
    }, identity, {
      localClientGovernedExecutionApi: { execute },
    }, {
      "idempotency-key": "local-execution-key-1",
    });
    expect(execute).toHaveBeenCalledWith(expect.objectContaining({
      tenantId: identity.tenantId,
      subjectId: identity.userId,
      planId: "c".repeat(64),
    }), expect.any(Object));
    expect(response).toMatchObject({
      statusCode: 409,
      headers: {
        "Cache-Control": "no-store",
        "Idempotency-Status": "operation-error",
        "Idempotency-Replayed": "false",
        "Idempotency-Replayable": "false",
      },
      payload: {
        status: "error",
        error: {
          code: "LOCAL_CLIENT_EXECUTION_OUTCOME_UNKNOWN",
          retryable: false,
          details: {
            status: "unknown-reconcile-required",
            operationInvoked: true,
            retryAllowed: false,
          },
        },
      },
    });
  });

  it("keeps governed execution status and cancellation subject-bound", async () => {
    const status = vi.fn(async (input) => ({ operation: "status", status: "running", received: input }));
    const cancel = vi.fn(async (input) => ({ operation: "cancel", status: "cancel-requested", received: input }));
    const identity = { tenantId: "tenant-status-route", userId: "status-route-user", role: "operator" };
    const application = { localClientGovernedExecutionApi: { status, cancel } };
    const statusResponse = await dispatch(
      "GET",
      "/local-clients/executions/lc-exec-status-test",
      {},
      identity,
      application,
    );
    const cancelResponse = await dispatch(
      "POST",
      "/local-clients/executions/lc-exec-status-test/cancel",
      { reason: "operator requested cancellation" },
      identity,
      application,
    );
    expect(statusResponse.statusCode).toBe(200);
    expect(cancelResponse.statusCode).toBe(200);
    expect(status).toHaveBeenCalledWith({
      tenantId: identity.tenantId,
      subjectId: identity.userId,
      executionId: "lc-exec-status-test",
    });
    expect(cancel).toHaveBeenCalledWith({
      tenantId: identity.tenantId,
      subjectId: identity.userId,
      executionId: "lc-exec-status-test",
      reason: "operator requested cancellation",
    });
  });

  it("derives tenant scope only from enterprise identity", async () => {
    const tenantA = { tenantId: "tenant-http-a", userId: "http-user-a", role: "operator" };
    const tenantB = { tenantId: "tenant-http-b", userId: "http-user-b", role: "operator" };
    await dispatch("POST", "/local-clients/register", {
      tenantId: tenantB.tenantId,
      clientId: "http-scoped-client",
      displayName: "HTTP Scoped Client",
      capabilityIds: ["browser"],
      executable: "C:\\private\\http-client.exe",
      metadata: { processPid: 777777 },
    }, tenantA);

    const visibleToA = await dispatch("GET", "/local-clients/registry", {}, tenantA);
    const hiddenFromB = await dispatch("GET", "/local-clients/registry", {}, tenantB);
    expect(visibleToA.payload.data).toMatchObject({
      total: 1,
      clients: [{
        clientId: "http-scoped-client",
        displayName: "HTTP Scoped Client",
        capabilityIds: ["browser"],
      }],
    });
    expect(hiddenFromB.payload.data).toMatchObject({ total: 0, clients: [] });
    expect(visibleToA.headers["Cache-Control"]).toBe("no-store");
    expect(hiddenFromB.headers["Cache-Control"]).toBe("no-store");
    expect(JSON.stringify(visibleToA.payload)).not.toContain("private\\http-client.exe");
    expect(JSON.stringify(visibleToA.payload)).not.toContain("777777");
    expect(JSON.stringify(visibleToA.payload)).not.toContain(tenantA.tenantId);
    expect(JSON.stringify(visibleToA.payload)).not.toContain(tenantB.tenantId);
  });

  it.each(LOCAL_CLIENT_ROUTE_PERMISSIONS)(
    "keeps %s %s non-public with permission %s",
    (method, pathname, permission) => {
      expect(isPublicRoute(pathname)).toBe(false);
      expect(resolvePermission(method, pathname)).toBe(permission);
    },
  );

  it("rejects unlisted local-client methods and future routes even after wildcard authorization", () => {
    for (const [method, pathname] of [
      ["GET", "/local-clients/execute"],
      ["POST", "/local-clients/future-admin-action"],
    ] as const) {
      const permission = resolvePermission(method, pathname);
      expect(permission).toBe("route:unknown");
      expect(shouldRejectUnmappedRoute({
        isPublic: false,
        permission,
        authorizationAllowed: true,
      })).toBe(true);
    }
  });
});
