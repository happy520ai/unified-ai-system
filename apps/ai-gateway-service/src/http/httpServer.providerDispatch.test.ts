import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect, it, vi } from "vitest";

import { createGatewayApplication } from "../application/createGatewayApplication.js";
import { GatewayService } from "../core/gatewayService.js";
import { createFakeProvider } from "../providers/fakeProvider.js";
import { createProviderDispatchGate } from "../providers/providerDispatchGate.ts";
import { ProviderRegistry } from "../providers/providerRegistry.js";
import { createGatewayHttpServer } from "./httpServer.js";

const temporaryDirectories: string[] = [];

afterEach(() => {
  for (const directory of temporaryDirectories.splice(0)) {
    rmSync(directory, { recursive: true, force: true });
  }
});

async function listen(server: ReturnType<typeof createGatewayHttpServer>) {
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("Gateway test server did not bind a TCP port.");
  return `http://127.0.0.1:${address.port}`;
}

async function closeServer(server: ReturnType<typeof createGatewayHttpServer>) {
  await new Promise<void>((resolve, reject) => {
    server.close((error?: Error) => error ? reject(error) : resolve());
    server.closeAllConnections?.();
  });
  await (server as typeof server & { shutdownResources?: () => Promise<void> }).shutdownResources?.();
}

async function readJson(response: Response) {
  return response.json() as Promise<Record<string, any>>;
}

describe("real-provider HTTP dispatch idempotency", () => {
  it("blocks missing, duplicate, conflicting, and multi-choice replay before an adapter call", async () => {
    const root = mkdtempSync(join(tmpdir(), "gateway-provider-dispatch-http-"));
    temporaryDirectories.push(root);
    const authToken = "provider-dispatch-http-test-token";
    const baseEnvironment = {
      AI_GATEWAY_PROVIDER_MODE: "fake",
      AI_GATEWAY_REAL_PROVIDER_ENABLED: "false",
      PME_ENTERPRISE_AUTH_ENABLED: "true",
      PME_AUTH_TOKEN: authToken,
      PME_AUDIT_LOG_PATH: join(root, "http-audit.jsonl"),
      PME_AUDIT_CHAIN_PATH: join(root, "audit-chain.jsonl"),
      AI_GATEWAY_RATE_LIMIT_WHITELIST: "127.0.0.1",
    };
    const application = createGatewayApplication(baseEnvironment);
    const mcpGatewayClose = vi.spyOn(application.mcpGatewayService, "close");
    const originalRequestLogger = application.requestLogger;
    const provider = createFakeProvider({
      providerId: "dispatch-provider",
      modelId: "dispatch-model",
      providerType: "openai",
      capabilities: ["chat"],
      enabled: true,
      fixedLatencyMs: 1,
    });
    const generate = vi.spyOn(provider, "generate");
    const generateStream = vi.spyOn(provider, "generateStream");
    const providerRegistry = new (ProviderRegistry as any)({ enabledProviders: ["dispatch-provider"] });
    providerRegistry.register(provider);
    const usageEntries: Array<Record<string, unknown>> = [];
    const requestLogger = {
      assertDurable: vi.fn(async () => true),
      log: vi.fn(async (entry: Record<string, unknown>) => {
        usageEntries.push(entry);
      }),
      getStats: vi.fn(async () => ({ totalRequests: usageEntries.length })),
      getHealth: vi.fn(() => ({
        status: "ready",
        storeMode: "test",
        available: true,
        durableWritesRequired: true,
      })),
      close: vi.fn(async () => {}),
    };
    const providerDispatchGate = createProviderDispatchGate({
      realProviderEnabled: true,
      env: {
        AI_GATEWAY_PROVIDER_DISPATCH_STORE_MODE: "sqlite",
        AI_GATEWAY_PROVIDER_DISPATCH_SQLITE_PATH: join(root, "provider-dispatch.sqlite"),
        AI_GATEWAY_PROVIDER_DISPATCH_HMAC_SECRET: "provider-dispatch-http-secret".padEnd(64, "x"),
      },
    });
    const gatewayService = new GatewayService({
      providerRegistry,
      runtimeConfig: {
        providerMode: "real",
        realProviderEnabled: true,
        enabledProviders: ["dispatch-provider"],
        fallbackEnabled: false,
        costGuardEnforce: false,
        requireDurableUsageLedger: true,
        requireProviderDispatchGate: true,
      },
      requestLogger,
      enterpriseAudit: { recordAudit: vi.fn(async () => {}) },
      providerDispatchGate,
    });
    const generateImage = vi.fn(async () => ({
      data: {
        provider: "dispatch-provider",
        model: "dispatch-image-model",
        usage: { images: 1 },
        data: [{ url: "https://example.invalid/generated.png" }],
      },
    }));
    const multimodalAdapter = { generateImage };
    Object.assign(application, {
      gatewayService,
      providerRegistry,
      providerDispatchGate,
      requestLogger,
      multimodalAdapter,
    });
    const server = createGatewayHttpServer(application);
    const baseUrl = await listen(server);
    const commonHeaders = {
      "content-type": "application/json",
      "x-pme-auth-token": authToken,
      "x-pme-tenant-id": "default",
    };
    const body = {
      model: "dispatch-model",
      messages: [{ role: "user", content: "one billable operation" }],
    };

    try {
      const first = await fetch(`${baseUrl}/v1/chat/completions`, {
        method: "POST",
        headers: { ...commonHeaders, "idempotency-key": "operation-1" },
        body: JSON.stringify(body),
      });
      expect(first.status).toBe(200);
      expect((await readJson(first)).choices).toHaveLength(1);
      expect(generate).toHaveBeenCalledTimes(1);

      const duplicate = await fetch(`${baseUrl}/v1/chat/completions`, {
        method: "POST",
        headers: { ...commonHeaders, "idempotency-key": "operation-1" },
        body: JSON.stringify(body),
      });
      expect(duplicate.status).toBe(409);
      expect((await readJson(duplicate)).error.code).toBe("PROVIDER_DISPATCH_ALREADY_RESERVED");
      expect(generate).toHaveBeenCalledTimes(1);

      const conflict = await fetch(`${baseUrl}/v1/chat/completions`, {
        method: "POST",
        headers: { ...commonHeaders, "idempotency-key": "operation-1" },
        body: JSON.stringify({
          ...body,
          messages: [{ role: "user", content: "different operation" }],
        }),
      });
      expect(conflict.status).toBe(409);
      expect((await readJson(conflict)).error.code).toBe("PROVIDER_DISPATCH_KEY_REUSED");
      expect(generate).toHaveBeenCalledTimes(1);

      const missing = await fetch(`${baseUrl}/v1/chat/completions`, {
        method: "POST",
        headers: commonHeaders,
        body: JSON.stringify(body),
      });
      expect(missing.status).toBe(400);
      expect((await readJson(missing)).error.code).toBe("PROVIDER_DISPATCH_KEY_REQUIRED");
      expect(generate).toHaveBeenCalledTimes(1);

      const malformed = await fetch(`${baseUrl}/v1/chat/completions`, {
        method: "POST",
        headers: { ...commonHeaders, "idempotency-key": "contains space" },
        body: JSON.stringify(body),
      });
      expect(malformed.status).toBe(400);
      expect((await readJson(malformed)).error.code).toBe("PROVIDER_DISPATCH_KEY_INVALID");
      expect(generate).toHaveBeenCalledTimes(1);

      const ambiguous = await fetch(`${baseUrl}/v1/chat/completions`, {
        method: "POST",
        headers: {
          ...commonHeaders,
          "idempotency-key": "response-replay-operation",
          "provider-dispatch-key": "provider-only-operation",
        },
        body: JSON.stringify(body),
      });
      expect(ambiguous.status).toBe(400);
      expect((await readJson(ambiguous)).error.code).toBe("PROVIDER_DISPATCH_KEY_INVALID");
      expect(generate).toHaveBeenCalledTimes(1);

      const multiple = await fetch(`${baseUrl}/v1/chat/completions`, {
        method: "POST",
        headers: { ...commonHeaders, "idempotency-key": "operation-multiple" },
        body: JSON.stringify({ ...body, n: 2 }),
      });
      expect(multiple.status).toBe(200);
      expect((await readJson(multiple)).choices).toHaveLength(2);
      expect(generate).toHaveBeenCalledTimes(3);

      const multipleReplay = await fetch(`${baseUrl}/v1/chat/completions`, {
        method: "POST",
        headers: { ...commonHeaders, "idempotency-key": "operation-multiple" },
        body: JSON.stringify({ ...body, n: 2 }),
      });
      expect(multipleReplay.status).toBe(409);
      expect((await readJson(multipleReplay)).error.code).toBe("PROVIDER_DISPATCH_ALREADY_RESERVED");
      expect(generate).toHaveBeenCalledTimes(3);

      const missingStreamKey = await fetch(`${baseUrl}/v1/chat/completions`, {
        method: "POST",
        headers: commonHeaders,
        body: JSON.stringify({ ...body, stream: true }),
      });
      expect(missingStreamKey.status).toBe(400);
      expect(missingStreamKey.headers.get("content-type")).toContain("application/json");
      expect((await readJson(missingStreamKey)).error.code).toBe("PROVIDER_DISPATCH_KEY_REQUIRED");
      expect(generateStream).not.toHaveBeenCalled();

      const firstStream = await fetch(`${baseUrl}/v1/chat/completions`, {
        method: "POST",
        headers: { ...commonHeaders, "idempotency-key": "operation-stream" },
        body: JSON.stringify({ ...body, stream: true }),
      });
      expect(firstStream.status).toBe(200);
      expect(firstStream.headers.get("content-type")).toContain("text/event-stream");
      expect(await firstStream.text()).toContain("data: [DONE]");
      expect(generateStream).toHaveBeenCalledTimes(1);

      const streamReplay = await fetch(`${baseUrl}/v1/chat/completions`, {
        method: "POST",
        headers: { ...commonHeaders, "idempotency-key": "operation-stream" },
        body: JSON.stringify({ ...body, stream: true }),
      });
      expect(streamReplay.status).toBe(409);
      expect(streamReplay.headers.get("content-type")).toContain("application/json");
      expect((await readJson(streamReplay)).error.code).toBe("PROVIDER_DISPATCH_ALREADY_RESERVED");
      expect(generateStream).toHaveBeenCalledTimes(1);

      const missingNativeStreamKey = await fetch(`${baseUrl}/chat/stream`, {
        method: "POST",
        headers: commonHeaders,
        body: JSON.stringify({ messages: body.messages, modelId: "dispatch-model" }),
      });
      expect(missingNativeStreamKey.status).toBe(400);
      expect(missingNativeStreamKey.headers.get("content-type")).toContain("application/json");
      expect((await readJson(missingNativeStreamKey)).error.code).toBe("PROVIDER_DISPATCH_KEY_REQUIRED");
      expect(generateStream).toHaveBeenCalledTimes(1);

      const nativeStream = await fetch(`${baseUrl}/chat/stream`, {
        method: "POST",
        headers: { ...commonHeaders, "idempotency-key": "operation-native-stream" },
        body: JSON.stringify({ messages: body.messages, modelId: "dispatch-model" }),
      });
      expect(nativeStream.status).toBe(200);
      expect(nativeStream.headers.get("content-type")).toContain("text/event-stream");
      expect(await nativeStream.text()).toContain("event: done");
      expect(generateStream).toHaveBeenCalledTimes(2);

      const nativeStreamReplay = await fetch(`${baseUrl}/chat/stream`, {
        method: "POST",
        headers: { ...commonHeaders, "idempotency-key": "operation-native-stream" },
        body: JSON.stringify({ messages: body.messages, modelId: "dispatch-model" }),
      });
      expect(nativeStreamReplay.status).toBe(409);
      expect(nativeStreamReplay.headers.get("content-type")).toContain("application/json");
      expect((await readJson(nativeStreamReplay)).error.code).toBe("PROVIDER_DISPATCH_ALREADY_RESERVED");
      expect(generateStream).toHaveBeenCalledTimes(2);

      const missingImageKey = await fetch(`${baseUrl}/v1/images/generations`, {
        method: "POST",
        headers: commonHeaders,
        body: JSON.stringify({
          provider: "dispatch-provider",
          model: "dispatch-image-model",
          prompt: "a governed image",
        }),
      });
      expect(missingImageKey.status).toBe(400);
      expect((await readJson(missingImageKey)).error.code).toBe("PROVIDER_DISPATCH_KEY_REQUIRED");
      expect(generateImage).not.toHaveBeenCalled();

      const firstImage = await fetch(`${baseUrl}/v1/images/generations`, {
        method: "POST",
        headers: { ...commonHeaders, "provider-dispatch-key": "operation-image" },
        body: JSON.stringify({
          provider: "dispatch-provider",
          model: "dispatch-image-model",
          prompt: "a governed image",
        }),
      });
      expect(firstImage.status).toBe(200);
      expect((await readJson(firstImage)).data).toMatchObject({
        provider: "dispatch-provider",
        model: "dispatch-image-model",
      });
      expect(generateImage).toHaveBeenCalledOnce();

      const imageReplay = await fetch(`${baseUrl}/v1/images/generations`, {
        method: "POST",
        headers: { ...commonHeaders, "provider-dispatch-key": "operation-image" },
        body: JSON.stringify({
          provider: "dispatch-provider",
          model: "dispatch-image-model",
          prompt: "a governed image",
        }),
      });
      expect(imageReplay.status).toBe(409);
      expect((await readJson(imageReplay)).error.code).toBe("PROVIDER_DISPATCH_ALREADY_RESERVED");
      expect(generateImage).toHaveBeenCalledOnce();
      expect(usageEntries.filter((entry) => entry.path === "/v1/images/generations")
        .map((entry) => entry.usageEventType)).toEqual([
          "attempt-failed",
          "attempt-started",
          "attempt-completed",
          "attempt-failed",
        ]);

      const health = await fetch(`${baseUrl}/healthz`);
      expect(health.status).toBe(200);
      expect((await readJson(health)).data.providerDispatch).toMatchObject({
        mode: "sqlite",
        enabled: true,
        required: true,
        durable: true,
        available: true,
        entries: 6,
        tombstones: 6,
      });

      const metrics = await fetch(`${baseUrl}/metrics`, {
        headers: { "x-pme-auth-token": authToken, "x-pme-tenant-id": "default" },
      });
      expect(metrics.status).toBe(200);
      const metricsText = await metrics.text();
      expect(metricsText).toContain('ai_gateway_provider_dispatch_store_available{mode="sqlite"} 1');
      expect(metricsText).toContain('ai_gateway_provider_dispatch_reservations{mode="sqlite",state="total"} 6');

      const preflight = await fetch(`${baseUrl}/v1/chat/completions`, {
        method: "OPTIONS",
        headers: {
          origin: "http://127.0.0.1:3100",
          "access-control-request-method": "POST",
          "access-control-request-headers": "content-type,idempotency-key,provider-dispatch-key,x-ai-gateway-local-client-proof",
        },
      });
      expect(preflight.status).toBe(204);
      expect(preflight.headers.get("access-control-allow-headers")?.toLowerCase())
        .toContain("idempotency-key");
      expect(preflight.headers.get("access-control-allow-headers")?.toLowerCase())
        .toContain("provider-dispatch-key");
      expect(preflight.headers.get("access-control-allow-headers")?.toLowerCase())
        .toContain("external-effect-key");
      expect(preflight.headers.get("access-control-allow-headers")?.toLowerCase())
        .toContain("x-ai-gateway-local-client-proof");
      const exposed = preflight.headers.get("access-control-expose-headers")?.toLowerCase() ?? "";
      expect(exposed).toContain("x-ai-gateway-local-client-routing");
      expect(exposed).toContain("x-ai-gateway-local-client-policy-revision");
      expect(exposed).toContain("x-ai-gateway-local-client-revision");
      expect(exposed).toContain("x-ai-gateway-local-client-decision-digest");
    } finally {
      await closeServer(server);
      expect(mcpGatewayClose).toHaveBeenCalledOnce();
      await originalRequestLogger?.close?.();
    }
  });
});

describe("gateway application resource shutdown", () => {
  it("closes an explicitly configured local-client execution claim store", async () => {
    const root = mkdtempSync(join(tmpdir(), "gateway-local-client-claim-shutdown-"));
    temporaryDirectories.push(root);
    const application = createGatewayApplication({
      AI_GATEWAY_LOCAL_CLIENT_EXECUTION_CLAIM_STORE_MODE: "sqlite",
      AI_GATEWAY_LOCAL_CLIENT_EXECUTION_CLAIM_SQLITE_PATH: join(root, "claims.sqlite"),
      AI_GATEWAY_LOCAL_CLIENT_HOST_ID: "http-shutdown-test-host",
    });
    const claimStore = application.localClientExecutionClaimStore;
    if (!claimStore) throw new Error("The explicit local-client execution claim store was not created.");
    const claimClose = vi.spyOn(claimStore, "close");
    const server = createGatewayHttpServer(application);

    expect(claimStore.status.available).toBe(true);
    await (server as typeof server & { shutdownResources(): Promise<void> }).shutdownResources();
    expect(claimClose).toHaveBeenCalledOnce();
    expect(claimStore.status.available).toBe(false);
  });
});
