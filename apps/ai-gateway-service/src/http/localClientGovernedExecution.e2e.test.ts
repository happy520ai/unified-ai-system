import { createHash, createHmac, randomBytes } from "node:crypto";
import { mkdtemp, rm } from "node:fs/promises";
import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";
import type { AddressInfo } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";

import { describe, expect, it } from "vitest";
import WebSocket from "ws";

import {
  createGatewayApplication,
  createGatewayApplicationForLocalClientFixtureTests,
} from "../application/createGatewayApplication.js";
import {
  createManagedLocalClientPopIdentityAuthority,
  deriveManagedLocalClientPopKey,
} from "../capabilities/localClientPopIdentityAuthority.ts";
import { encodeLocalClientPopHttpProof } from "../capabilities/localClientPopHttpAuth.ts";
import {
  LOCAL_CLIENT_LOOPBACK_ACTION_ID,
  LOCAL_CLIENT_LOOPBACK_ACTION_VERSION,
  LOCAL_CLIENT_LOOPBACK_ADAPTER_ID,
  LOCAL_CLIENT_LOOPBACK_ADAPTER_TYPE,
  LOCAL_CLIENT_LOOPBACK_ADAPTER_VERSION,
  LOCAL_CLIENT_LOOPBACK_CAPABILITY_ID,
  LOCAL_CLIENT_LOOPBACK_CHALLENGE_VERSION,
  LOCAL_CLIENT_LOOPBACK_RECEIPT_VERSION,
  LOCAL_CLIENT_LOOPBACK_RECONCILIATION_PATH,
  LOCAL_CLIENT_LOOPBACK_VERIFICATION_VERSION,
} from "../capabilities/localClientLoopbackAdapter.ts";
import {
  createLocalClientSqliteExecutionReceiptJournal,
  type LocalClientSqliteExecutionReceiptJournal,
} from "../capabilities/localClientExecutionReceiptReconciliation.ts";
import { createGatewayHttpServer } from "./httpServer.js";

const TENANT_ID = "tenant-governed-http-e2e";
const PRIMARY_SUBJECT_ID = "operator-governed-http-e2e";
const SECONDARY_SUBJECT_ID = "operator-governed-http-e2e-other";
const CLIENT_SUBJECT_ID = "client-governed-http-e2e";
const CLIENT_ID = "fixture.governed-http-client";
const MANIFEST_SHA256 = "d".repeat(64);
const VERIFY_PATH = "/.well-known/unified-ai/local-client/verify";
const CHALLENGE_PATH = "/.well-known/unified-ai/local-client/challenge";
const ACTION_PATH = "/v1/unified-ai/local-client/actions/invoke";

type GatewayApplication = ReturnType<typeof createGatewayApplication>;
type GatewayServer = ReturnType<typeof createGatewayHttpServer>;

type FixtureState = {
  readonly server: Server;
  readonly endpoint: string;
  readonly requestPaths: string[];
  readonly protocolErrors: string[];
  verificationRequests: number;
  challengeRequests: number;
  actionRequests: number;
  readonly receiptJournal: LocalClientSqliteExecutionReceiptJournal;
  lastAction: Readonly<{
    executionId: string;
    planFingerprint: string;
    input: Record<string, unknown>;
  }> | null;
};

type HttpResult = {
  readonly response: Response;
  readonly payload: Record<string, any>;
};

describe("governed local-client HTTP execution", () => {
  // The durable replay case composes the governed local-client SQLite stores
// that fail closed unless the runtime provides node:sqlite defensive mode.
const durableLocalClientSqliteSupported = (() => {
  try {
    const probe = new DatabaseSync(":memory:");
    try {
      return typeof (probe as DatabaseSync & {
        enableDefensive?: unknown;
      }).enableDefensive === "function";
    } finally {
      probe.close();
    }
  } catch {
    return false;
  }
})();
const itDurableLocalClientSqlite = durableLocalClientSqliteSupported ? it : it.skip;

  itDurableLocalClientSqlite("verifies, approves, executes, and durably replays one signed loopback effect", async () => {
    const root = await mkdtemp(join(tmpdir(), "gateway-local-client-governed-http-e2e-"));
    const loopbackSecret = randomBytes(32);
    const primaryToken = randomBytes(24).toString("base64url");
    const secondaryToken = randomBytes(24).toString("base64url");
    const clientToken = randomBytes(24).toString("base64url");
    let fixture: FixtureState | null = null;
    let application: GatewayApplication | null = null;
    let gatewayServer: GatewayServer | null = null;
    let clientPopSigner: ReturnType<typeof createManagedLocalClientPopIdentityAuthority> | null = null;

    try {
      fixture = await startLoopbackFixture(loopbackSecret, root);
      application = createGatewayApplicationForLocalClientFixtureTests({
        NODE_ENV: "test",
        AI_GATEWAY_PROVIDER_MODE: "fake",
        AI_GATEWAY_REAL_PROVIDER_ENABLED: "false",
        AI_GATEWAY_MULTI_INSTANCE: "false",
        AI_GATEWAY_SERVICE_HOST: "127.0.0.1",
        AI_GATEWAY_RATE_LIMIT_WHITELIST: "127.0.0.1",

        PME_ENTERPRISE_AUTH_ENABLED: "true",
        PME_AUTH_TOKEN: primaryToken,
        PME_AUTH_USER_ID: PRIMARY_SUBJECT_ID,
        PME_AUTH_TENANT_ID: TENANT_ID,
        PME_AUTH_ROLE: "admin",
        PME_ENTERPRISE_USERS_JSON: JSON.stringify([
          {
            token: secondaryToken,
            userId: SECONDARY_SUBJECT_ID,
            tenantId: TENANT_ID,
            role: "admin",
          },
          {
            token: clientToken,
            userId: CLIENT_SUBJECT_ID,
            tenantId: TENANT_ID,
            role: "local_client",
          },
        ]),
        PME_ENTERPRISE_USER_STORE_PATH: join(root, "enterprise-users.json"),
        PME_API_KEY_STORE_PATH: join(root, "enterprise-api-keys.json"),
        PME_AUDIT_LOG_PATH: join(root, "audit.jsonl"),
        PME_AUDIT_CHAIN_PATH: join(root, "audit-chain.jsonl"),

        AI_GATEWAY_LOCAL_CLIENT_EXECUTION_ENABLED: "true",
        AI_GATEWAY_LOCAL_CLIENT_ALLOW_REGISTRY_ONLY_ROLLBACK_DETECTION: "true",
        AI_GATEWAY_LOCAL_CLIENT_HOST_ID: "governed-http-e2e-host",
        AI_GATEWAY_LOCAL_CLIENT_ROUTE_PLAN_STORE_MODE: "sqlite",
        AI_GATEWAY_LOCAL_CLIENT_ROUTE_PLAN_SQLITE_PATH: join(root, "route-plans.sqlite"),
        AI_GATEWAY_LOCAL_CLIENT_ROUTE_PLAN_TTL_MS: "60000",
        AI_GATEWAY_LOCAL_CLIENT_EXECUTION_CLAIM_STORE_MODE: "sqlite",
        AI_GATEWAY_LOCAL_CLIENT_EXECUTION_CLAIM_SQLITE_PATH: join(root, "execution-claims.sqlite"),
        AI_GATEWAY_LOCAL_CLIENT_EXECUTION_CLAIM_NAMESPACE: "governed-http-e2e",
        AI_GATEWAY_LOCAL_CLIENT_EXECUTION_CLAIM_TTL_MS: "60000",
        AI_GATEWAY_LOCAL_CLIENT_CONTROL_STORE_MODE: "local",
        AI_GATEWAY_LOCAL_CLIENT_CONTROL_CENTRAL_REQUIRED: "false",
        AI_GATEWAY_LOCAL_CLIENT_CONTROL_NAMESPACE: "governed-http-e2e",
        AI_GATEWAY_LOCAL_CLIENT_EXECUTION_CONTROL_DIR: join(root, "execution-control"),
        AI_GATEWAY_LOCAL_CLIENT_REGISTRY_PATH: join(root, "registry.json"),
        AI_GATEWAY_LOCAL_CLIENT_AUTHORITY_EPOCH_STORE_MODE: "sqlite",
        AI_GATEWAY_LOCAL_CLIENT_AUTHORITY_EPOCH_SQLITE_PATH: join(root, "authority-epoch.sqlite"),
        AI_GATEWAY_LOCAL_CLIENT_AUTHORITY_EPOCH_NAMESPACE: "governed-http-e2e",
        AI_GATEWAY_LOCAL_CLIENT_FEEDBACK_DEDUP_STORE_MODE: "sqlite",
        AI_GATEWAY_LOCAL_CLIENT_FEEDBACK_DEDUP_SQLITE_PATH: join(root, "feedback-dedup.sqlite"),
        AI_GATEWAY_LOCAL_CLIENT_FEEDBACK_DEDUP_NAMESPACE: "governed-http-e2e",
        AI_GATEWAY_LOCAL_CLIENT_EXECUTION_FEEDBACK_OUTBOX_STORE_MODE: "sqlite",
        AI_GATEWAY_LOCAL_CLIENT_EXECUTION_FEEDBACK_OUTBOX_SQLITE_PATH: join(root, "feedback-outbox.sqlite"),
        AI_GATEWAY_LOCAL_CLIENT_EXECUTION_FEEDBACK_OUTBOX_NAMESPACE: "governed-http-e2e",
        AI_GATEWAY_LOCAL_CLIENT_RECEIPT_RECONCILIATION_STORE_MODE: "sqlite",
        AI_GATEWAY_LOCAL_CLIENT_RECEIPT_RECONCILIATION_DIR: join(root, "receipt-journals"),
        AI_GATEWAY_LOCAL_CLIENT_RECEIPT_RECONCILIATION_NAMESPACE: "governed-http-e2e",
        AI_GATEWAY_LOCAL_CLIENT_PROVIDER_POLICIES_JSON: JSON.stringify({
          version: 1,
          defaultPolicy: {
            allowedProviders: ["backup-fake-provider"],
            dataClass: "internal",
            maxFanout: 1,
            fusionAllowed: false,
          },
          overrides: [],
        }),
        AI_GATEWAY_LOCAL_CLIENT_PROTOCOL_PRINCIPALS_JSON: JSON.stringify({
          version: 1,
          bindings: [{
            tenantId: TENANT_ID,
            subjectId: CLIENT_SUBJECT_ID,
            clientId: CLIENT_ID,
          }],
        }),
        AI_GATEWAY_LOCAL_CLIENT_EXECUTION_LOG_PATH: join(root, "execution-log.jsonl"),
        AI_GATEWAY_LOCAL_CLIENT_DISCOVERY_HINTS_PATH: join(root, "discovery-hints.json"),

        AI_GATEWAY_IDEMPOTENCY_STORE_MODE: "sqlite",
        AI_GATEWAY_IDEMPOTENCY_SQLITE_PATH: join(root, "idempotency.sqlite"),
        AI_GATEWAY_IDEMPOTENCY_HMAC_SECRET: randomBytes(32).toString("hex"),
        AI_GATEWAY_IDEMPOTENCY_TTL_MS: "60000",
        AI_GATEWAY_IDEMPOTENCY_LEASE_MS: "10000",
        AI_GATEWAY_IDEMPOTENCY_WAIT_MS: "2000",
        AI_GATEWAY_EXTERNAL_EFFECT_ENABLED: "true",
        AI_GATEWAY_EXTERNAL_EFFECT_STORE_MODE: "sqlite",
        AI_GATEWAY_EXTERNAL_EFFECT_SQLITE_PATH: join(root, "external-effects.sqlite"),
        AI_GATEWAY_EXTERNAL_EFFECT_HMAC_SECRET: randomBytes(32).toString("hex"),
        AI_GATEWAY_EXTERNAL_EFFECT_CENTRAL_REQUIRED: "false",

        AI_GATEWAY_LOCAL_CLIENT_LOOPBACK_ENABLED: "true",
        AI_GATEWAY_LOCAL_CLIENT_LOOPBACK_ENDPOINT: fixture.endpoint,
        AI_GATEWAY_LOCAL_CLIENT_LOOPBACK_CLIENT_ID: CLIENT_ID,
        AI_GATEWAY_LOCAL_CLIENT_LOOPBACK_TENANT_ID: TENANT_ID,
        AI_GATEWAY_LOCAL_CLIENT_LOOPBACK_MANIFEST_SHA256: MANIFEST_SHA256,
        AI_GATEWAY_LOCAL_CLIENT_LOOPBACK_SECRET_REF: "env_key_name:LOCAL_CLIENT_GOVERNED_HTTP_E2E_SECRET",
        LOCAL_CLIENT_GOVERNED_HTTP_E2E_SECRET: `hex:${loopbackSecret.toString("hex")}`,
        AI_GATEWAY_LOCAL_CLIENT_REGISTRY_INTEGRITY_SECRET_REF:
          "env_key_name:LOCAL_CLIENT_GOVERNED_HTTP_E2E_REGISTRY_SECRET",
        LOCAL_CLIENT_GOVERNED_HTTP_E2E_REGISTRY_SECRET:
          `hex:${randomBytes(32).toString("hex")}`,
        AI_GATEWAY_LOCAL_CLIENT_LOOPBACK_TIMEOUT_MS: "2000",
        AI_GATEWAY_LOCAL_CLIENT_LOOPBACK_CHALLENGE_TTL_MS: "1000",
        AI_GATEWAY_LOCAL_CLIENT_LOOPBACK_VERIFICATION_TTL_MS: "60000",
        AI_GATEWAY_LOCAL_CLIENT_LOOPBACK_MAX_RESPONSE_BYTES: "4096",
        WORKFORCE_EXECUTION_DIR: join(root, "workforce-execution"),
      });
      expect(application.localClientExecutionReadiness).toMatchObject({
        requested: true,
        ready: true,
        mode: "ready",
        blockers: [],
      });
      expect(application.localClientRoutePlanStore.status).toMatchObject({
        storageMode: "single-host-sqlite",
        durable: true,
        available: true,
      });
      expect(application.localClientExecutionClaimStore?.status).toMatchObject({
        storageMode: "single-host-sqlite",
        durable: true,
        available: true,
      });
      expect(application.localClientAuthorityEpochStore?.status).toMatchObject({
        durable: true,
        distributed: false,
        monotonicCheckpoint: true,
        rollbackResistant: false,
        rollbackDetectionScope: "registry-only unless checkpoint DB also rolled back",
      });
      expect(application.localClientExecutionControl.getHealth()).toMatchObject({
        durable: true,
        available: true,
      });
      expect(application.localClientExecutionIdempotency.getHealth()).toMatchObject({
        storeMode: "sqlite",
        durable: true,
        available: true,
      });
      expect(application.externalEffectGate.getHealth()).toMatchObject({
        mode: "sqlite",
        durable: true,
        available: true,
      });

      gatewayServer = createGatewayHttpServer(application);
      const gatewayBaseUrl = await listen(gatewayServer);
      const primary = requestAs(gatewayBaseUrl, primaryToken);
      const secondary = requestAs(gatewayBaseUrl, secondaryToken);
      const clientPrincipal = requestAs(gatewayBaseUrl, clientToken);

      const registered = await primary.post("/local-clients/register", {
        clientId: CLIENT_ID,
        displayName: "Governed HTTP Fixture",
        capabilityIds: [LOCAL_CLIENT_LOOPBACK_CAPABILITY_ID],
        adapterId: LOCAL_CLIENT_LOOPBACK_ADAPTER_ID,
        adapterType: LOCAL_CLIENT_LOOPBACK_ADAPTER_TYPE,
        adapterVersion: LOCAL_CLIENT_LOOPBACK_ADAPTER_VERSION,
        manifestSha256: MANIFEST_SHA256,
      });
      expect(registered.response.status).toBe(200);
      expect(registered.payload).toMatchObject({
        status: "ok",
        data: {
          action: "created",
          client: {
            clientId: CLIENT_ID,
            state: "declared",
            trustDecision: "declared",
            revision: 1,
          },
        },
      });

      const verified = await primary.post("/local-clients/verify", {
        clientId: CLIENT_ID,
        expectedRevision: 1,
        expectedAdapter: {
          id: LOCAL_CLIENT_LOOPBACK_ADAPTER_ID,
          type: LOCAL_CLIENT_LOOPBACK_ADAPTER_TYPE,
          version: LOCAL_CLIENT_LOOPBACK_ADAPTER_VERSION,
        },
        expectedManifestSha256: MANIFEST_SHA256,
      });
      expect(verified.response.status).toBe(200);
      expect(verified.payload).toMatchObject({
        status: "ok",
        data: {
          clientId: CLIENT_ID,
          revision: 2,
          state: "verified",
          trustDecision: "verified",
        },
      });
      expect(fixture.verificationRequests).toBe(1);

      const derivedPopKey = deriveManagedLocalClientPopKey({
        sharedSecret: loopbackSecret,
        tenantId: TENANT_ID,
        clientId: CLIENT_ID,
      });
      clientPopSigner = createManagedLocalClientPopIdentityAuthority({
        key: derivedPopKey.key,
        keyId: derivedPopKey.keyId,
      });
      const heartbeatBody = {
        clientId: CLIENT_ID,
        healthStatus: "healthy",
        latencyMs: 7,
      };
      const missingHeartbeatProof = await clientPrincipal.post(
        "/local-clients/heartbeat",
        heartbeatBody,
      );
      expect(missingHeartbeatProof.response.status).toBe(401);
      expect(missingHeartbeatProof.payload).toMatchObject({
        status: "error",
        error: { code: "LOCAL_CLIENT_POP_HTTP_UNAUTHORIZED" },
      });
      const heartbeatProof = await clientPopSigner.issue({
        identity: {
          tenantId: TENANT_ID,
          subjectId: CLIENT_SUBJECT_ID,
          clientId: CLIENT_ID,
          clientRevision: 2,
        },
        request: {
          method: "POST",
          path: "/local-clients/heartbeat",
          body: Buffer.from(JSON.stringify(heartbeatBody), "utf8"),
        },
      });
      const heartbeatProofHeader = encodeLocalClientPopHttpProof(heartbeatProof);
      const authenticatedHeartbeat = await clientPrincipal.post(
        "/local-clients/heartbeat",
        heartbeatBody,
        { "x-ai-gateway-local-client-proof": heartbeatProofHeader },
      );
      expect(authenticatedHeartbeat.response.status).toBe(200);
      expect(authenticatedHeartbeat.payload).toMatchObject({
        status: "ok",
        data: {
          clientId: CLIENT_ID,
          telemetryAuthority: {
            mode: "managed-client-pop",
            clientProofVerified: true,
            proofFingerprint: expect.stringMatching(/^[a-f0-9]{64}$/u),
          },
        },
      });
      const replayedHeartbeat = await clientPrincipal.post(
        "/local-clients/heartbeat",
        heartbeatBody,
        { "x-ai-gateway-local-client-proof": heartbeatProofHeader },
      );
      expect(replayedHeartbeat.response.status).toBe(401);
      expect(replayedHeartbeat.payload).toMatchObject({
        status: "error",
        error: { code: "LOCAL_CLIENT_POP_HTTP_UNAUTHORIZED" },
      });

      for (const [path, body] of [
        ["/v1/completions", { model: "local-fake-model", prompt: "bypass attempt" }],
        ["/v1/images/generations", { model: "local-fake-model", prompt: "bypass image" }],
      ] as const) {
        const unsupported = await clientPrincipal.post(path, body);
        expect(unsupported.response.status).toBe(403);
        expect(unsupported.payload).toMatchObject({
          error: { code: "LOCAL_CLIENT_PROTOCOL_ROUTE_UNSUPPORTED" },
        });
      }
      for (const path of ["/cache/health"]) {
        const denied = await clientPrincipal.get(path);
        expect(denied.response.status).toBe(403);
        expect(denied.payload).toMatchObject({
          error: { code: "LOCAL_CLIENT_PRINCIPAL_ROUTE_DENIED" },
        });
      }
      await expectWebSocketRejection(gatewayBaseUrl, clientToken, 403);

      const managedChatBody = {
        model: "local-fake-model",
        messages: [{ role: "user", content: "managed policy dispatch" }],
        unified_ai: { local_client_id: CLIENT_ID },
      };
      const omittedManagedIdentity = await clientPrincipal.post("/v1/chat/completions", {
        model: "local-fake-model",
        messages: [{ role: "user", content: "omit managed identity" }],
      });
      expect(omittedManagedIdentity.response.status).toBe(401);
      expect(omittedManagedIdentity.payload).toMatchObject({
        error: { code: "LOCAL_CLIENT_POP_HTTP_UNAUTHORIZED" },
      });
      const managedChatProof = await clientPopSigner.issue({
        identity: {
          tenantId: TENANT_ID,
          subjectId: CLIENT_SUBJECT_ID,
          clientId: CLIENT_ID,
          clientRevision: 2,
        },
        request: {
          method: "POST",
          path: "/v1/chat/completions",
          body: Buffer.from(JSON.stringify(managedChatBody), "utf8"),
        },
      });
      const managedChat = await clientPrincipal.post(
        "/v1/chat/completions",
        managedChatBody,
        {
          "x-ai-gateway-local-client-proof": encodeLocalClientPopHttpProof(managedChatProof),
        },
      );
      expect(managedChat.response.status, JSON.stringify(managedChat.payload)).toBe(200);
      expect(managedChat.response.headers.get("x-ai-gateway-local-client-routing"))
        .toBe("policy-pinned");
      expect(managedChat.response.headers.get("x-ai-gateway-local-client-revision")).toBe("2");
      expect(managedChat.payload).toMatchObject({
        object: "chat.completion",
        model: "backup-fake-model",
        choices: [{
          message: {
            role: "assistant",
            content: "[fake:backup-fake-provider/backup-fake-model] managed policy dispatch",
          },
        }],
        unified_ai: {
          selected_provider: "backup-fake-provider",
          selected_model: "backup-fake-model",
          execution_mode: "fake",
        },
      });

      const amplifiedStreamBody = {
        ...managedChatBody,
        stream: true,
        n: 2,
      };
      const amplifiedStreamProof = await clientPopSigner.issue({
        identity: {
          tenantId: TENANT_ID,
          subjectId: CLIENT_SUBJECT_ID,
          clientId: CLIENT_ID,
          clientRevision: 2,
        },
        request: {
          method: "POST",
          path: "/v1/chat/completions",
          body: Buffer.from(JSON.stringify(amplifiedStreamBody), "utf8"),
        },
      });
      const amplifiedStream = await clientPrincipal.post(
        "/v1/chat/completions",
        amplifiedStreamBody,
        {
          "x-ai-gateway-local-client-proof": encodeLocalClientPopHttpProof(amplifiedStreamProof),
        },
      );
      expect(amplifiedStream.response.status).toBe(409);
      expect(amplifiedStream.payload).toMatchObject({
        error: { code: "LOCAL_CLIENT_PROVIDER_MULTI_CHOICE_DENIED" },
      });

      const managedAnthropicBody = {
        model: "local-fake-model",
        max_tokens: 64,
        messages: [{ role: "user", content: "managed anthropic dispatch" }],
        unified_ai: { local_client_id: CLIENT_ID },
      };
      const managedAnthropicProof = await clientPopSigner.issue({
        identity: {
          tenantId: TENANT_ID,
          subjectId: CLIENT_SUBJECT_ID,
          clientId: CLIENT_ID,
          clientRevision: 2,
        },
        request: {
          method: "POST",
          path: "/v1/messages",
          body: Buffer.from(JSON.stringify(managedAnthropicBody), "utf8"),
        },
      });
      const managedAnthropic = await clientPrincipal.post(
        "/v1/messages",
        managedAnthropicBody,
        {
          "x-ai-gateway-local-client-proof": encodeLocalClientPopHttpProof(managedAnthropicProof),
        },
      );
      expect(managedAnthropic.response.status, JSON.stringify(managedAnthropic.payload)).toBe(200);
      expect(managedAnthropic.response.headers.get("x-ai-gateway-local-client-routing"))
        .toBe("policy-pinned");
      expect(managedAnthropic.payload).toMatchObject({
        type: "message",
        model: "backup-fake-model",
        content: [{
          type: "text",
          text: "[fake:backup-fake-provider/backup-fake-model] managed anthropic dispatch",
        }],
        unified_ai: {
          provider_id: "backup-fake-provider",
          model: "backup-fake-model",
          execution_mode: "fake",
        },
      });

      const managedGeminiPath = "/v1beta/models/local-fake-model:generateContent";
      const managedGeminiBody = {
        contents: [{ role: "user", parts: [{ text: "managed gemini dispatch" }] }],
        unified_ai: { local_client_id: CLIENT_ID },
      };
      const managedGeminiProof = await clientPopSigner.issue({
        identity: {
          tenantId: TENANT_ID,
          subjectId: CLIENT_SUBJECT_ID,
          clientId: CLIENT_ID,
          clientRevision: 2,
        },
        request: {
          method: "POST",
          path: managedGeminiPath,
          body: Buffer.from(JSON.stringify(managedGeminiBody), "utf8"),
        },
      });
      const managedGemini = await clientPrincipal.post(
        managedGeminiPath,
        managedGeminiBody,
        {
          "x-ai-gateway-local-client-proof": encodeLocalClientPopHttpProof(managedGeminiProof),
        },
      );
      expect(managedGemini.response.status, JSON.stringify(managedGemini.payload)).toBe(200);
      expect(managedGemini.response.headers.get("x-ai-gateway-local-client-routing"))
        .toBe("policy-pinned");
      expect(managedGemini.payload).toMatchObject({
        modelVersion: "backup-fake-model",
        candidates: [{
          content: {
            role: "model",
            parts: [{
              text: "[fake:backup-fake-provider/backup-fake-model] managed gemini dispatch",
            }],
          },
        }],
      });

      const managedNativeChatBody = {
        model: "local-fake-model",
        messages: [{ role: "user", content: "managed native dispatch" }],
        unified_ai: { local_client_id: CLIENT_ID },
      };
      const managedNativeChatProof = await clientPopSigner.issue({
        identity: {
          tenantId: TENANT_ID,
          subjectId: CLIENT_SUBJECT_ID,
          clientId: CLIENT_ID,
          clientRevision: 2,
        },
        request: {
          method: "POST",
          path: "/chat",
          body: Buffer.from(JSON.stringify(managedNativeChatBody), "utf8"),
        },
      });
      const managedNativeChat = await clientPrincipal.post(
        "/chat",
        managedNativeChatBody,
        {
          "idempotency-key": `managed-native-${randomBytes(12).toString("hex")}`,
          "x-ai-gateway-local-client-proof": encodeLocalClientPopHttpProof(managedNativeChatProof),
        },
      );
      expect(managedNativeChat.response.status, JSON.stringify(managedNativeChat.payload)).toBe(200);
      expect(managedNativeChat.response.headers.get("x-ai-gateway-local-client-routing"))
        .toBe("policy-pinned");
      expect(managedNativeChat.response.headers.get("x-ai-gateway-local-client-decision-digest"))
        .toMatch(/^[a-f0-9]{64}$/u);
      expect(managedNativeChat.payload).toMatchObject({
        success: true,
        data: {
          selectedProvider: "backup-fake-provider",
          selectedModel: "backup-fake-model",
          executionMode: "fake",
          outputText: "[fake:backup-fake-provider/backup-fake-model] managed native dispatch",
        },
      });

      const executionInput = Object.freeze({ payload: "perform-one-governed-http-action" });
      const preview = await primary.post("/local-clients/executions/preview", {
        clientId: CLIENT_ID,
        capabilityId: LOCAL_CLIENT_LOOPBACK_CAPABILITY_ID,
        actionId: LOCAL_CLIENT_LOOPBACK_ACTION_ID,
        input: executionInput,
      });
      expect(preview.response.status).toBe(200);
      expect(preview.payload).toMatchObject({
        status: "ok",
        data: {
          operation: "preview",
          status: "approval-required",
          executionPerformed: false,
          plan: {
            clientId: CLIENT_ID,
            clientRevision: 2,
            capabilityId: LOCAL_CLIENT_LOOPBACK_CAPABILITY_ID,
            actionId: LOCAL_CLIENT_LOOPBACK_ACTION_ID,
          },
          approval: { required: true },
        },
      });
      expect(preview.payload.data.plan).not.toHaveProperty("input");
      expect(executionInput).not.toHaveProperty("planFingerprint");
      const planId = String(preview.payload.data.plan.planId);
      expect(planId).toMatch(/^[a-f0-9]{64}$/u);
      expect(preview.payload.data.approval.planDigest).toBe(planId);

      const approved = await primary.post("/local-clients/executions/approve", {
        planId,
        note: "approve exact credential-free loopback plan",
      });
      expect(approved.response.status).toBe(200);
      expect(approved.payload).toMatchObject({
        status: "ok",
        data: {
          operation: "approve",
          status: "approved",
          executionPerformed: false,
          approval: {
            planId,
            planDigest: planId,
          },
        },
      });

      const idempotencyKey = `governed-http-e2e-${randomBytes(12).toString("hex")}`;
      const executionBody = { planId, input: executionInput };
      const executed = await primary.post(
        "/local-clients/executions/execute",
        executionBody,
        { "idempotency-key": idempotencyKey },
      );
      expect(executed.response.status, JSON.stringify(executed.payload)).toBe(200);
      expect(executed.response.headers.get("idempotency-status")).toBe("created");
      expect(executed.response.headers.get("idempotency-replayed")).toBe("false");
      expect(executed.payload).toMatchObject({
        status: "ok",
        data: {
          accepted: true,
          status: "completed",
          replayed: false,
          replayable: true,
          operationInvoked: true,
          retryAllowed: false,
          result: {
            status: "completed",
            planId,
            planFingerprint: planId,
            externalEffectCommitted: true,
            retryAllowed: false,
            receipt: {
              executionId: expect.stringMatching(/^lc-exec-[a-f0-9]{64}$/u),
              adapterId: LOCAL_CLIENT_LOOPBACK_ADAPTER_ID,
              adapterType: LOCAL_CLIENT_LOOPBACK_ADAPTER_TYPE,
              adapterVersion: LOCAL_CLIENT_LOOPBACK_ADAPTER_VERSION,
              clientId: CLIENT_ID,
              capabilityId: LOCAL_CLIENT_LOOPBACK_CAPABILITY_ID,
              actionId: LOCAL_CLIENT_LOOPBACK_ACTION_ID,
              planFingerprint: planId,
              executionMode: "governed",
              externalEffectPerformed: true,
              status: "completed",
            },
            feedback: {
              source: "verified-governed-receipt",
              attempted: true,
              persisted: true,
              exactlyOnce: true,
              replayed: false,
              deliveryStatus: "persisted",
              errorCode: null,
            },
          },
        },
      });
      const executionId = String(executed.payload.data.result.executionId);
      const feedbackEventId = String(executed.payload.data.result.feedback.eventId);
      expect(executionId).toMatch(/^lc-exec-[a-f0-9]{64}$/u);
      expect(feedbackEventId).toMatch(/^lcfb-[a-f0-9]{64}$/u);
      expect(fixture.actionRequests).toBe(1);
      await expect(application.localClientExecutionFeedbackOutbox!.checkHealth()).resolves.toMatchObject({
        pendingEvents: 0,
        deliveredEvents: 1,
      });
      expect(fixture.lastAction).toEqual({
        executionId,
        planFingerprint: planId,
        input: executionInput,
      });

      const replayed = await primary.post(
        "/local-clients/executions/execute",
        executionBody,
        { "idempotency-key": idempotencyKey },
      );
      expect(replayed.response.status).toBe(200);
      expect(replayed.response.headers.get("idempotency-status")).toBe("replayed");
      expect(replayed.response.headers.get("idempotency-replayed")).toBe("true");
      expect(replayed.payload).toMatchObject({
        status: "ok",
        data: {
          accepted: true,
          status: "replayed",
          replayed: true,
          replayable: true,
          operationInvoked: false,
          result: {
            status: "completed",
            executionId,
            planId,
            externalEffectCommitted: true,
            feedback: {
              eventId: feedbackEventId,
              persisted: true,
              exactlyOnce: true,
            },
          },
        },
      });
      expect(fixture.actionRequests).toBe(1);

      const status = await primary.get(`/local-clients/executions/${executionId}`);
      expect(status.response.status).toBe(200);
      expect(status.payload).toMatchObject({
        status: "ok",
        data: {
          operation: "status",
          executionId,
          status: "completed",
          cancelRequested: false,
        },
      });

      const crossSubjectStatus = await secondary.get(`/local-clients/executions/${executionId}`);
      expect(crossSubjectStatus.response.status).toBe(403);
      expect(crossSubjectStatus.payload).toMatchObject({
        status: "error",
        error: {
          code: "LOCAL_CLIENT_GOVERNED_API_STATUS_FAILED",
          category: "auth",
          retryable: false,
        },
      });

      expect(fixture.challengeRequests).toBe(1);
      expect(fixture.protocolErrors).toEqual([]);
      expect(fixture.requestPaths).toEqual([VERIFY_PATH, CHALLENGE_PATH, ACTION_PATH]);
      const publicTranscript = JSON.stringify([
        registered.payload,
        verified.payload,
        preview.payload,
        approved.payload,
        executed.payload,
        replayed.payload,
        status.payload,
        crossSubjectStatus.payload,
      ]);
      expect(publicTranscript).not.toContain(loopbackSecret.toString("hex"));
      expect(publicTranscript).not.toContain(primaryToken);
      expect(publicTranscript).not.toContain(secondaryToken);
      expect(publicTranscript).not.toContain(clientToken);
    } finally {
      if (gatewayServer) {
        await closeGatewayServer(gatewayServer);
      } else if (application) {
        await closeApplication(application);
      }
      if (fixture) {
        await closeServer(fixture.server);
        await fixture.receiptJournal.close();
      }
      await clientPopSigner?.close();
      loopbackSecret.fill(0);
      await rm(root, { recursive: true, force: true });
    }
  }, 20_000);

  it("fails closed when a local_client role has no exact server-side binding", async () => {
    const root = await mkdtemp(join(tmpdir(), "gateway-local-client-unbound-role-"));
    const token = randomBytes(24).toString("base64url");
    let application: GatewayApplication | null = null;
    let gatewayServer: GatewayServer | null = null;
    try {
      application = createGatewayApplication({
        NODE_ENV: "test",
        AI_GATEWAY_PROVIDER_MODE: "fake",
        AI_GATEWAY_REAL_PROVIDER_ENABLED: "false",
        AI_GATEWAY_SERVICE_HOST: "127.0.0.1",
        AI_GATEWAY_RATE_LIMIT_WHITELIST: "127.0.0.1",
        PME_ENTERPRISE_AUTH_ENABLED: "true",
        PME_AUTH_TOKEN: token,
        PME_AUTH_USER_ID: "unbound-local-client",
        PME_AUTH_TENANT_ID: TENANT_ID,
        PME_AUTH_ROLE: "local_client",
        PME_ENTERPRISE_USER_STORE_PATH: join(root, "enterprise-users.json"),
        PME_API_KEY_STORE_PATH: join(root, "enterprise-api-keys.json"),
        PME_AUDIT_LOG_PATH: join(root, "audit.jsonl"),
        PME_AUDIT_CHAIN_PATH: join(root, "audit-chain.jsonl"),
        WORKFORCE_EXECUTION_DIR: join(root, "workforce-execution"),
      });
      gatewayServer = createGatewayHttpServer(application);
      const baseUrl = await listen(gatewayServer);
      const client = requestAs(baseUrl, token);

      const response = await client.post("/v1/chat/completions", {
        model: "local-fake-model",
        messages: [{ role: "user", content: "must not bypass binding" }],
      });
      expect(response.response.status).toBe(403);
      expect(response.payload).toMatchObject({
        error: { code: "LOCAL_CLIENT_PRINCIPAL_BINDING_REQUIRED" },
      });
      expect(JSON.stringify(response.payload)).not.toContain("[fake:");
    } finally {
      if (gatewayServer) await closeGatewayServer(gatewayServer);
      else if (application) await closeApplication(application);
      await rm(root, { recursive: true, force: true });
    }
  });
});

function requestAs(baseUrl: string, token: string) {
  const headers = Object.freeze({
    "content-type": "application/json",
    "x-pme-auth-token": token,
    "x-pme-tenant-id": TENANT_ID,
  });
  return Object.freeze({
    get(path: string) {
      return requestJson(`${baseUrl}${path}`, {
        method: "GET",
        headers,
      });
    },
    post(path: string, body: unknown, extraHeaders: Record<string, string> = {}) {
      return requestJson(`${baseUrl}${path}`, {
        method: "POST",
        headers: { ...headers, ...extraHeaders },
        body: JSON.stringify(body),
      });
    },
  });
}

async function expectWebSocketRejection(
  baseUrl: string,
  token: string,
  expectedStatus: number,
): Promise<void> {
  await new Promise<void>((resolvePromise, rejectPromise) => {
    const socket = new WebSocket(`${baseUrl.replace(/^http/u, "ws")}/ws`, {
      headers: { authorization: `Bearer ${token}` },
    });
    const timer = setTimeout(() => {
      socket.terminate();
      rejectPromise(new Error("WebSocket rejection timed out."));
    }, 2_000);
    timer.unref?.();
    socket.once("unexpected-response", (_request, response) => {
      clearTimeout(timer);
      socket.terminate();
      try {
        expect(response.statusCode).toBe(expectedStatus);
        resolvePromise();
      } catch (error) {
        rejectPromise(error);
      }
    });
    socket.once("open", () => {
      clearTimeout(timer);
      socket.terminate();
      rejectPromise(new Error("Managed local-client WebSocket unexpectedly opened."));
    });
    socket.once("error", () => {
      // `unexpected-response` is the authoritative rejection event.
    });
  });
}

async function requestJson(url: string, init: RequestInit): Promise<HttpResult> {
  const response = await fetch(url, init);
  const payload = await response.json();
  if (!isPlainRecord(payload)) throw new Error("Gateway HTTP test response was not a JSON object.");
  return { response, payload };
}

async function listen(server: GatewayServer): Promise<string> {
  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      server.off("error", reject);
      resolve();
    });
  });
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("Gateway HTTP test server did not bind a port.");
  return `http://127.0.0.1:${address.port}`;
}

async function startLoopbackFixture(secret: Buffer, root: string): Promise<FixtureState> {
  const keyContext = `${TENANT_ID}\0${CLIENT_ID}`;
  const protocolKey = createHmac("sha256", secret)
    .update("local-client-receipt-reconciliation-protocol-v1\0", "utf8")
    .update(keyContext, "utf8")
    .digest();
  const clientIntegrityKey = createHmac("sha256", secret)
    .update("local-client-client-receipt-journal-integrity-v1\0", "utf8")
    .update(keyContext, "utf8")
    .digest();
  const receiptJournal = createLocalClientSqliteExecutionReceiptJournal({
    sqlitePath: join(root, "fixture-client-receipts.sqlite"),
    role: "client",
    hostId: "fixture-client-host-01",
    integrityKey: clientIntegrityKey,
    protocolKey,
    namespace: "governed-http-e2e-client",
  });
  protocolKey.fill(0);
  clientIntegrityKey.fill(0);
  const mutable = {
    server: null as unknown as Server,
    endpoint: "",
    requestPaths: [] as string[],
    protocolErrors: [] as string[],
    verificationRequests: 0,
    challengeRequests: 0,
    actionRequests: 0,
    receiptJournal,
    lastAction: null as FixtureState["lastAction"],
  };
  const server = createServer((request, response) => {
    void handleFixtureRequest(request, response, mutable, secret).catch((error) => {
      mutable.protocolErrors.push(safeFixtureError(error));
      if (!response.headersSent) sendJson(response, { error: "fixture-protocol-error" }, 400);
      else if (!response.writableEnded) response.end();
    });
  });
  try {
    await new Promise<void>((resolve, reject) => {
      server.once("error", reject);
      server.listen(0, "127.0.0.1", () => {
        server.off("error", reject);
        resolve();
      });
    });
  } catch (error) {
    await receiptJournal.close();
    throw error;
  }
  const address = server.address() as AddressInfo;
  mutable.server = server;
  mutable.endpoint = `http://127.0.0.1:${address.port}`;
  return mutable;
}

async function handleFixtureRequest(
  request: IncomingMessage,
  response: ServerResponse,
  state: Omit<FixtureState, "readonly">,
  secret: Buffer,
): Promise<void> {
  if (request.method !== "POST") throw new Error("fixture-method-invalid");
  const path = new URL(request.url ?? "/", "http://127.0.0.1").pathname;
  const body = await readRequestJson(request);
  state.requestPaths.push(path);

  if (path === VERIFY_PATH) {
    assertVerificationRequest(body, secret);
    state.verificationRequests += 1;
    const unsigned = {
      protocolVersion: body.protocolVersion,
      nonce: body.nonce,
      clientId: body.clientId,
      adapterId: body.adapterId,
      adapterType: body.adapterType,
      adapterVersion: body.adapterVersion,
      manifestSha256: body.manifestSha256,
      issuedAtMs: body.issuedAtMs,
      expiresAtMs: body.expiresAtMs,
    };
    sendJson(response, {
      ...unsigned,
      signature: hmac(secret, [
        LOCAL_CLIENT_LOOPBACK_VERIFICATION_VERSION,
        "response",
        unsigned.nonce,
        unsigned.clientId,
        unsigned.adapterId,
        unsigned.adapterType,
        unsigned.adapterVersion,
        unsigned.manifestSha256,
        unsigned.issuedAtMs,
        unsigned.expiresAtMs,
      ]),
    });
    return;
  }

  if (path === CHALLENGE_PATH) {
    assertChallengeRequest(body, secret);
    state.challengeRequests += 1;
    const unsigned = {
      protocolVersion: body.protocolVersion,
      nonce: body.nonce,
      clientId: body.clientId,
      manifestSha256: body.manifestSha256,
      adapterVersion: body.adapterVersion,
      issuedAtMs: body.issuedAtMs,
      expiresAtMs: body.expiresAtMs,
    };
    sendJson(response, {
      ...unsigned,
      signature: hmac(secret, [
        LOCAL_CLIENT_LOOPBACK_CHALLENGE_VERSION,
        "response",
        unsigned.nonce,
        unsigned.clientId,
        unsigned.manifestSha256,
        unsigned.adapterVersion,
        unsigned.issuedAtMs,
        unsigned.expiresAtMs,
      ]),
    });
    return;
  }

  if (path === ACTION_PATH) {
    assertActionRequest(body, secret);
    const intent = body.dispatchIntent as any;
    await state.receiptJournal.acceptDispatchIntent(intent);
    const claim = await state.receiptJournal.claimEffect(intent);
    if (claim.execute) {
      state.actionRequests += 1;
      state.lastAction = Object.freeze({
        executionId: String(body.executionId),
        planFingerprint: String(body.planFingerprint),
        input: Object.freeze({ ...(body.input as Record<string, unknown>) }),
      });
    }
    const durable = await state.receiptJournal.recordCompleted(intent);
    const durableReceipt = durable.receipt;
    const receiptCore = {
      protocolVersion: LOCAL_CLIENT_LOOPBACK_RECEIPT_VERSION,
      executionId: body.executionId,
      clientId: body.clientId,
      manifestSha256: body.manifestSha256,
      adapterVersion: body.adapterVersion,
      nonce: body.nonce,
      capabilityId: body.capabilityId,
      actionId: body.actionId,
      planFingerprint: body.planFingerprint,
      inputSha256: body.inputSha256,
      durableReceiptSha256: sha256(canonicalJson(durableReceipt)),
      durableReceipt,
      executionMode: "governed",
      externalEffectPerformed: true,
      status: "completed",
    } as const;
    const receiptId = `loopback:${sha256(JSON.stringify([
      LOCAL_CLIENT_LOOPBACK_RECEIPT_VERSION,
      receiptCore.executionId,
      receiptCore.clientId,
      receiptCore.manifestSha256,
      receiptCore.adapterVersion,
      receiptCore.nonce,
      receiptCore.capabilityId,
      receiptCore.actionId,
      receiptCore.planFingerprint,
      receiptCore.inputSha256,
      receiptCore.durableReceiptSha256,
      receiptCore.executionMode,
      receiptCore.externalEffectPerformed,
      receiptCore.status,
    ]))}`;
    const receipt = { ...receiptCore, receiptId };
    sendJson(response, {
      ...receipt,
      signature: hmac(secret, [
        LOCAL_CLIENT_LOOPBACK_RECEIPT_VERSION,
        receipt.receiptId,
        receipt.executionId,
        receipt.clientId,
        receipt.manifestSha256,
        receipt.adapterVersion,
        receipt.nonce,
        receipt.capabilityId,
        receipt.actionId,
        receipt.planFingerprint,
        receipt.inputSha256,
        receipt.durableReceiptSha256,
        receipt.executionMode,
        receipt.externalEffectPerformed,
        receipt.status,
      ]),
    });
    return;
  }

  if (path === LOCAL_CLIENT_LOOPBACK_RECONCILIATION_PATH) {
    const reconciled = await state.receiptJournal.reconcile(body as any);
    sendJson(response, reconciled);
    return;
  }

  throw new Error("fixture-path-invalid");
}

function assertVerificationRequest(body: Record<string, unknown>, secret: Buffer): void {
  assertExactKeys(body, [
    "protocolVersion",
    "nonce",
    "clientId",
    "adapterId",
    "adapterType",
    "adapterVersion",
    "manifestSha256",
    "issuedAtMs",
    "expiresAtMs",
    "signature",
  ]);
  if (
    body.protocolVersion !== LOCAL_CLIENT_LOOPBACK_VERIFICATION_VERSION
    || body.clientId !== CLIENT_ID
    || body.adapterId !== LOCAL_CLIENT_LOOPBACK_ADAPTER_ID
    || body.adapterType !== LOCAL_CLIENT_LOOPBACK_ADAPTER_TYPE
    || body.adapterVersion !== LOCAL_CLIENT_LOOPBACK_ADAPTER_VERSION
    || body.manifestSha256 !== MANIFEST_SHA256
    || !validNonceAndTimes(body)
    || body.signature !== hmac(secret, [
      LOCAL_CLIENT_LOOPBACK_VERIFICATION_VERSION,
      "request",
      body.nonce,
      body.clientId,
      body.adapterId,
      body.adapterType,
      body.adapterVersion,
      body.manifestSha256,
      body.issuedAtMs,
      body.expiresAtMs,
    ])
  ) {
    throw new Error("fixture-verification-signature-invalid");
  }
}

function assertChallengeRequest(body: Record<string, unknown>, secret: Buffer): void {
  assertExactKeys(body, [
    "protocolVersion",
    "nonce",
    "clientId",
    "manifestSha256",
    "adapterVersion",
    "issuedAtMs",
    "expiresAtMs",
    "signature",
  ]);
  if (
    body.protocolVersion !== LOCAL_CLIENT_LOOPBACK_CHALLENGE_VERSION
    || body.clientId !== CLIENT_ID
    || body.manifestSha256 !== MANIFEST_SHA256
    || body.adapterVersion !== LOCAL_CLIENT_LOOPBACK_ADAPTER_VERSION
    || !validNonceAndTimes(body)
    || body.signature !== hmac(secret, [
      LOCAL_CLIENT_LOOPBACK_CHALLENGE_VERSION,
      "request",
      body.nonce,
      body.clientId,
      body.manifestSha256,
      body.adapterVersion,
      body.issuedAtMs,
      body.expiresAtMs,
    ])
  ) {
    throw new Error("fixture-challenge-signature-invalid");
  }
}

function assertActionRequest(body: Record<string, unknown>, secret: Buffer): void {
  assertExactKeys(body, [
    "protocolVersion",
    "executionId",
    "clientId",
    "manifestSha256",
    "adapterVersion",
    "nonce",
    "capabilityId",
    "actionId",
    "planFingerprint",
    "inputSha256",
    "dispatchIntentSha256",
    "dispatchIntent",
    "input",
    "signature",
  ]);
  if (!isPlainRecord(body.input)) throw new Error("fixture-action-input-invalid");
  if (!isPlainRecord(body.dispatchIntent)) throw new Error("fixture-dispatch-intent-invalid");
  assertExactKeys(body.input, ["payload"]);
  if (
    body.protocolVersion !== LOCAL_CLIENT_LOOPBACK_ACTION_VERSION
    || typeof body.executionId !== "string"
    || !/^lc-exec-[a-f0-9]{64}$/u.test(body.executionId)
    || body.clientId !== CLIENT_ID
    || body.manifestSha256 !== MANIFEST_SHA256
    || body.adapterVersion !== LOCAL_CLIENT_LOOPBACK_ADAPTER_VERSION
    || typeof body.nonce !== "string"
    || !/^[A-Za-z0-9_-]{43}$/u.test(body.nonce)
    || body.capabilityId !== LOCAL_CLIENT_LOOPBACK_CAPABILITY_ID
    || body.actionId !== LOCAL_CLIENT_LOOPBACK_ACTION_ID
    || typeof body.planFingerprint !== "string"
    || !/^[a-f0-9]{64}$/u.test(body.planFingerprint)
    || typeof body.input.payload !== "string"
    || body.inputSha256 !== sha256(canonicalJson(body.input))
    || body.dispatchIntentSha256 !== sha256(canonicalJson(body.dispatchIntent))
    || body.signature !== hmac(secret, [
      LOCAL_CLIENT_LOOPBACK_ACTION_VERSION,
      body.executionId,
      body.clientId,
      body.manifestSha256,
      body.adapterVersion,
      body.nonce,
      body.capabilityId,
      body.actionId,
      body.planFingerprint,
      body.inputSha256,
      body.dispatchIntentSha256,
    ])
  ) {
    throw new Error("fixture-action-signature-invalid");
  }
}

function validNonceAndTimes(body: Record<string, unknown>): boolean {
  return typeof body.nonce === "string"
    && /^[A-Za-z0-9_-]{43}$/u.test(body.nonce)
    && Number.isSafeInteger(body.issuedAtMs)
    && Number.isSafeInteger(body.expiresAtMs)
    && Number(body.expiresAtMs) > Number(body.issuedAtMs);
}

function assertExactKeys(body: Record<string, unknown>, expected: readonly string[]): void {
  const actual = Object.keys(body).sort();
  const normalizedExpected = [...expected].sort();
  if (
    actual.length !== normalizedExpected.length
    || actual.some((value, index) => value !== normalizedExpected[index])
  ) {
    throw new Error("fixture-object-shape-invalid");
  }
}

async function readRequestJson(request: IncomingMessage): Promise<Record<string, unknown>> {
  const chunks: Buffer[] = [];
  let totalBytes = 0;
  for await (const chunk of request) {
    const buffer = Buffer.from(chunk);
    totalBytes += buffer.length;
    if (totalBytes > 64 * 1024) throw new Error("fixture-request-too-large");
    chunks.push(buffer);
  }
  const parsed = JSON.parse(Buffer.concat(chunks).toString("utf8"));
  if (!isPlainRecord(parsed)) throw new Error("fixture-request-invalid");
  return parsed;
}

function sendJson(response: ServerResponse, payload: unknown, statusCode = 200): void {
  const encoded = JSON.stringify(payload);
  response.writeHead(statusCode, {
    "cache-control": "no-store",
    "content-length": String(Buffer.byteLength(encoded)),
    "content-type": "application/json; charset=utf-8",
  });
  response.end(encoded);
}

function hmac(secret: Buffer, fields: readonly unknown[]): string {
  return createHmac("sha256", secret).update(JSON.stringify(fields), "utf8").digest("hex");
}

function sha256(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

function canonicalJson(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  const record = value as Record<string, unknown>;
  return `{${Object.keys(record).sort().map((key) => (
    `${JSON.stringify(key)}:${canonicalJson(record[key])}`
  )).join(",")}}`;
}

function isPlainRecord(value: unknown): value is Record<string, any> {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function safeFixtureError(error: unknown): string {
  return error instanceof Error && /^fixture-[a-z-]+$/u.test(error.message)
    ? error.message
    : "fixture-handler-error";
}

async function closeGatewayServer(server: GatewayServer): Promise<void> {
  if (server.listening) {
    await new Promise<void>((resolve, reject) => {
      server.close((error?: Error) => error ? reject(error) : resolve());
      server.closeAllConnections?.();
      server.closeIdleConnections?.();
    });
  }
  await (server as GatewayServer & { shutdownResources?: () => Promise<void> }).shutdownResources?.();
}

async function closeServer(server: Server): Promise<void> {
  if (!server.listening) return;
  await new Promise<void>((resolve, reject) => {
    server.close((error?: Error) => error ? reject(error) : resolve());
    server.closeAllConnections?.();
    server.closeIdleConnections?.();
  });
}

async function closeApplication(application: GatewayApplication): Promise<void> {
  await application.localClientSmartManagementScheduler?.close?.();
  await application.localClientExecutionReceiptRecoveryService?.close?.();
  await application.localClientExecutionFeedbackDispatcher?.close?.();
  await application.localClientExecutionFeedbackOutbox?.close?.();
  await application.localClientExecutionReceiptJournalRegistry?.close?.();
  await (application.localClientRoutePlanStore as { close?: () => unknown })?.close?.();
  await application.localClientExecutionClaimStore?.close?.();
  await application.localClientPopIdentityAuthority?.close?.();
  await application.localClientVerificationService?.close?.();
  await application.localClientAdapterRegistry?.close?.();
  await application.localClientGovernedOnboardingRuntime?.close?.();
  await application.localClientOnboardingReceiptAuthorityStore?.close?.();
  await application.localClientManagementService?.close?.();
  await application.localClientExecutionControl?.close?.();
  await application.idempotencyCoordinator?.close?.();
  await application.workforceExecutor?.close?.();
  await application.requestLogger?.close?.();
  await application.providerDispatchGate?.close?.();
  await application.externalEffectGate?.close?.();
  await application.mcpGatewayService?.close?.();
  await application.enterpriseGovernanceService?.close?.();
}
