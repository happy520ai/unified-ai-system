import { request as httpRequest } from "node:http";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";

import { createGatewayApplication } from "../application/createGatewayApplication.js";
import { createGatewayHttpServer } from "./httpServer.js";

const AUTH_TOKEN = "agent-exec-http-lifecycle-token";

function createApplication(root: string) {
  return createGatewayApplication({
    AI_GATEWAY_PROVIDER_MODE: "fake",
    AI_GATEWAY_REAL_PROVIDER_ENABLED: "false",
    AI_GATEWAY_AGENT_GOVERNANCE_ENABLED: "false",
    PME_ENTERPRISE_AUTH_ENABLED: "true",
    PME_AUTH_TOKEN: AUTH_TOKEN,
    PME_AUTH_USER_ID: "agent-exec-owner",
    PME_AUTH_TENANT_ID: "agent-exec-tenant",
    PME_AUTH_ROLE: "admin",
    PME_AUDIT_LOG_PATH: join(root, "enterprise-audit.jsonl"),
    PME_AUDIT_CHAIN_PATH: join(root, "enterprise-audit-chain.jsonl"),
  });
}

async function listen(server: ReturnType<typeof createGatewayHttpServer>) {
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("Gateway test server did not bind.");
  return `http://127.0.0.1:${address.port}`;
}

async function closeServer(server: ReturnType<typeof createGatewayHttpServer>) {
  await new Promise<void>((resolve, reject) => {
    server.close((error?: Error) => error ? reject(error) : resolve());
    server.closeAllConnections?.();
  });
  await (server as typeof server & { shutdownResources?: () => Promise<void> }).shutdownResources?.();
}

function authHeaders() {
  return {
    authorization: `Bearer ${AUTH_TOKEN}`,
    "content-type": "application/json",
    "x-pme-tenant-id": "agent-exec-tenant",
  };
}

describe("Agent Exec real HTTP cancellation lifecycle", () => {
  it("keeps the outer HTTP deadline beyond the route deadline and aborts the provider", async () => {
    const root = mkdtempSync(join(tmpdir(), "agent-exec-http-deadline-"));
    const application = createApplication(root);
    const provider = (application.gatewayService as any).providerRegistry.get("local-fake-provider");
    let observedSignal: AbortSignal | undefined;
    provider.generate = vi.fn(async (request) => {
      observedSignal = request.execution?.signal;
      await new Promise((resolve, reject) => {
        if (observedSignal?.aborted) return reject(observedSignal.reason);
        observedSignal?.addEventListener("abort", () => reject(observedSignal?.reason), { once: true });
      });
    });
    const server = createGatewayHttpServer(application);
    try {
      const baseUrl = await listen(server);
      const response = await fetch(`${baseUrl}/agent-exec/run`, {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({
          goal: "Wait for the bounded route deadline.",
          toolMode: "none",
          maxIterations: 1,
          // Allow provider dispatch to begin even under the full parallel suite;
          // the assertion still proves the route timer fires before HTTP outer.
          timeoutMs: 10_000,
        }),
      });
      const payload = await response.json() as any;

      expect(response.status).toBe(200);
      expect(payload.data).toMatchObject({
        status: "timeout",
        timing: { timedOut: true, timeoutMs: 10_000 },
      });
      expect(observedSignal?.aborted).toBe(true);
    } finally {
      await closeServer(server);
      rmSync(root, { recursive: true, force: true });
    }
  }, 45_000);

  it("aborts the provider when the real HTTP client disconnects", async () => {
    const root = mkdtempSync(join(tmpdir(), "agent-exec-http-disconnect-"));
    const application = createApplication(root);
    const provider = (application.gatewayService as any).providerRegistry.get("local-fake-provider");
    let signalProviderStarted!: () => void;
    const providerStarted = new Promise<void>((resolve) => { signalProviderStarted = resolve; });
    let signalProviderAborted!: () => void;
    const providerAborted = new Promise<void>((resolve) => { signalProviderAborted = resolve; });
    provider.generate = vi.fn(async (request) => {
      const signal = request.execution?.signal as AbortSignal | undefined;
      signalProviderStarted();
      await new Promise((resolve, reject) => {
        if (signal?.aborted) {
          signalProviderAborted();
          reject(signal.reason);
          return;
        }
        signal?.addEventListener("abort", () => {
          signalProviderAborted();
          reject(signal.reason);
        }, { once: true });
      });
    });
    const server = createGatewayHttpServer(application);
    try {
      const baseUrl = await listen(server);
      const url = new URL("/agent-exec/run", baseUrl);
      const body = JSON.stringify({
        goal: "Wait until the transport disconnects.",
        toolMode: "none",
        maxIterations: 1,
        timeoutMs: 10_000,
      });
      const requestError = new Promise<void>((resolve) => {
        const request = httpRequest(url, {
          method: "POST",
          headers: { ...authHeaders(), "content-length": Buffer.byteLength(body) },
        });
        request.once("error", () => resolve());
        request.end(body);
        void providerStarted.then(() => request.destroy()).catch(() => request.destroy());
      });

      await providerAborted;
      await requestError;
      expect(provider.generate).toHaveBeenCalledOnce();
    } finally {
      await closeServer(server);
      rmSync(root, { recursive: true, force: true });
    }
  }, 30_000);
});
