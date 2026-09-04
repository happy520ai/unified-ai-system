import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, it, vi } from "vitest";
import { createGatewayApplication } from "../application/createGatewayApplication.js";
import { createGatewayHttpServer } from "./httpServer.js";

const AUTH_TOKEN = "route-concurrency-http-token";
const TENANT_ID = "route-concurrency-tenant";

function createApplication(root: string) {
  return createGatewayApplication({
    AI_GATEWAY_PROVIDER_MODE: "fake",
    AI_GATEWAY_REAL_PROVIDER_ENABLED: "false",
    AI_GATEWAY_AGENT_GOVERNANCE_ENABLED: "false",
    AI_GATEWAY_ROUTE_CONCURRENCY_LIMITS: JSON.stringify({
      "/agent-exec/run": { maxGlobal: 1, maxPerTenant: 1 },
    }),
    PME_ENTERPRISE_AUTH_ENABLED: "true",
    PME_AUTH_TOKEN: AUTH_TOKEN,
    PME_AUTH_USER_ID: "route-concurrency-owner",
    PME_AUTH_TENANT_ID: TENANT_ID,
    PME_AUTH_ROLE: "admin",
    PME_AUDIT_LOG_PATH: join(root, "enterprise-audit.jsonl"),
    PME_AUDIT_CHAIN_PATH: join(root, "enterprise-audit-chain.jsonl"),
  });
}

async function listen(server: ReturnType<typeof createGatewayHttpServer>) {
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("Gateway concurrency test server did not bind.");
  return `http://127.0.0.1:${address.port}`;
}

async function closeServer(server: ReturnType<typeof createGatewayHttpServer>) {
  await new Promise<void>((resolve, reject) => {
    server.close((error?: Error) => error ? reject(error) : resolve());
    server.closeAllConnections?.();
  });
  await (server as typeof server & { shutdownResources?: () => Promise<void> }).shutdownResources?.();
}

function postAgentExec(baseUrl: string, goal: string) {
  return fetch(`${baseUrl}/agent-exec/run`, {
    method: "POST",
    headers: {
      authorization: `Bearer ${AUTH_TOKEN}`,
      "content-type": "application/json",
      "x-pme-tenant-id": TENANT_ID,
    },
    body: JSON.stringify({
      goal,
      toolMode: "none",
      maxIterations: 1,
      timeoutMs: 10_000,
    }),
  });
}

function removeTestRoot(root: string) {
  rmSync(root, { recursive: true, force: true, maxRetries: 5, retryDelay: 50 });
}

describe("route concurrency admission over real HTTP", () => {
  it("rejects a second in-flight request and releases the slot after success", async () => {
    const root = mkdtempSync(join(tmpdir(), "route-concurrency-http-success-"));
    const application = createApplication(root);
    const provider = (application.gatewayService as any).providerRegistry.get("local-fake-provider");
    const originalGenerate = provider.generate.bind(provider);
    let signalStarted!: () => void;
    const started = new Promise<void>((resolve) => { signalStarted = resolve; });
    let releaseFirst!: () => void;
    const firstGate = new Promise<void>((resolve) => { releaseFirst = resolve; });
    let shouldBlock = true;
    provider.generate = vi.fn(async (request) => {
      if (shouldBlock) {
        shouldBlock = false;
        signalStarted();
        await firstGate;
      }
      return originalGenerate(request);
    });
    const server = createGatewayHttpServer(application);
    let firstRequest: Promise<Response> | null = null;
    try {
      const baseUrl = await listen(server);
      firstRequest = postAgentExec(baseUrl, "Hold the only concurrency slot.");
      await started;

      const rejected = await postAgentExec(baseUrl, "This request must be rejected immediately.");
      const rejectedPayload = await rejected.json() as any;
      expect(rejected.status).toBe(503);
      expect(rejected.headers.get("retry-after")).toBe("1");
      expect(rejected.headers.get("x-concurrency-route")).toBe("/agent-exec/run");
      expect(rejectedPayload.error?.code).toBe("route_concurrency_limited");

      releaseFirst();
      const first = await firstRequest;
      expect(first.status).toBe(200);

      const third = await postAgentExec(baseUrl, "The released slot must admit this request.");
      expect(third.status).toBe(200);
      expect((await third.json() as any).error?.code).not.toBe("route_concurrency_limited");
    } finally {
      releaseFirst?.();
      await firstRequest?.catch(() => undefined);
      await closeServer(server);
      removeTestRoot(root);
    }
  }, 30_000);

  it("releases the slot after a provider exception", async () => {
    const root = mkdtempSync(join(tmpdir(), "route-concurrency-http-error-"));
    const application = createApplication(root);
    const provider = (application.gatewayService as any).providerRegistry.get("local-fake-provider");
    const originalGenerate = provider.generate.bind(provider);
    let failNext = true;
    provider.generate = vi.fn(async (request) => {
      if (failNext) {
        failNext = false;
        throw Object.assign(new Error("Injected provider failure for slot-release proof."), {
          code: "INJECTED_PROVIDER_FAILURE",
          retryable: false,
        });
      }
      return originalGenerate(request);
    });
    const server = createGatewayHttpServer(application);
    try {
      const baseUrl = await listen(server);
      const failed = await postAgentExec(baseUrl, "Make the provider throw once.");
      const failedPayload = await failed.json() as any;
      expect(failed.status).toBe(200);
      expect(failedPayload.data?.status).toBe("error");

      const admitted = await postAgentExec(baseUrl, "The exception must not leak the slot.");
      expect(admitted.status).toBe(200);
      const admittedPayload = await admitted.json() as any;
      expect(admittedPayload.error?.code).not.toBe("route_concurrency_limited");
      expect(admittedPayload.data?.status).not.toBe("error");
    } finally {
      await closeServer(server);
      removeTestRoot(root);
    }
  }, 30_000);
});
