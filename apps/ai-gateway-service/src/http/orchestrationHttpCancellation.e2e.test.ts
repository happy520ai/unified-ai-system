import { request as httpRequest } from "node:http";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";

import { createGatewayApplication } from "../application/createGatewayApplication.js";
import { createGatewayHttpServer } from "./httpServer.js";

const TOKEN = "orchestration-http-cancellation-token";
const TENANT_ID = "orchestration-tenant";
const USER_ID = "orchestration-owner";
const GOVERNANCE_CONTEXT = {
  tenantId: TENANT_ID,
  userId: USER_ID,
  role: "admin",
  permissions: ["*"],
};

function createApplication(root: string, requestTimeoutMs = 1_000) {
  return createGatewayApplication({
    AI_GATEWAY_PROVIDER_MODE: "fake",
    AI_GATEWAY_REAL_PROVIDER_ENABLED: "false",
    AI_GATEWAY_AGENT_GOVERNANCE_ENABLED: "true",
    AI_GATEWAY_AGENT_GOVERNANCE_DATA_DIR: join(root, "governance"),
    AI_GATEWAY_AGENT_GOVERNANCE_HMAC_KEY: "orchestration-http-cancellation-secret-0123456789",
    PME_ENTERPRISE_AUTH_ENABLED: "true",
    PME_AUTH_TOKEN: TOKEN,
    PME_AUTH_USER_ID: USER_ID,
    PME_AUTH_TENANT_ID: TENANT_ID,
    PME_AUTH_ROLE: "admin",
    PME_ENTERPRISE_PLATFORM_TENANT_ID: TENANT_ID,
    PME_AUDIT_LOG_PATH: join(root, "enterprise-audit.jsonl"),
    PME_AUDIT_CHAIN_PATH: join(root, "enterprise-audit.chain.jsonl"),
    AI_GATEWAY_RATE_LIMIT_WHITELIST: "127.0.0.1",
    AI_GATEWAY_REQUEST_TIMEOUT_MS: String(requestTimeoutMs),
  });
}

async function createRootAgent(application: ReturnType<typeof createGatewayApplication>) {
  return application.agentGovernance!.service.generateAgent({
    name: "http-cancellation-root",
    task: "run bounded Forge and Workforce orchestration",
    requestedTools: ["forge_orchestrate", "workforce_execute"],
    ttlSeconds: 3600,
    parentAgentId: null,
  }, GOVERNANCE_CONTEXT);
}

async function listen(server: ReturnType<typeof createGatewayHttpServer>) {
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("Gateway test server did not bind.");
  return `http://127.0.0.1:${address.port}`;
}

async function closeServer(server: ReturnType<typeof createGatewayHttpServer>) {
  await new Promise<void>((resolve) => {
    server.close(() => resolve());
    server.closeAllConnections?.();
  });
  await (server as typeof server & { shutdownResources?: () => Promise<void> }).shutdownResources?.();
}

function disconnectingPost(url: URL, body: Record<string, unknown>, started: Promise<void>) {
  const payload = JSON.stringify(body);
  return new Promise<void>((resolve, reject) => {
    const request = httpRequest(url, {
      method: "POST",
      headers: {
        authorization: `Bearer ${TOKEN}`,
        "content-type": "application/json",
        "content-length": Buffer.byteLength(payload),
        "x-pme-tenant-id": TENANT_ID,
      },
    });
    request.once("response", (response) => {
      const statusCode = response.statusCode ?? 0;
      response.resume();
      response.once("end", () => {
        reject(new Error(`Expected the client disconnect to win, but the server responded with HTTP ${statusCode}.`));
      });
    });
    request.once("error", () => resolve());
    request.end(payload);
    const disconnect = () => request.destroy(Object.assign(new Error("intentional test disconnect"), {
      code: "TEST_CLIENT_DISCONNECT",
    }));
    void started.then(disconnect).catch(disconnect);
  });
}

function waitUntilAborted(signal: AbortSignal | null | undefined) {
  return new Promise<never>((_resolve, reject) => {
    if (!signal) return reject(new Error("HTTP execution signal was not propagated."));
    if (signal.aborted) return reject(signal.reason);
    signal.addEventListener("abort", () => reject(signal.reason), { once: true });
  });
}

describe("governed orchestration real HTTP cancellation", () => {
  it("propagates client disconnect into Forge and drains the route", async () => {
    const root = mkdtempSync(join(tmpdir(), "forge-http-cancel-"));
    // Keep the transport deadline outside this test's own timeout so this case
    // proves the client-disconnect path rather than racing the deadline case
    // exercised independently below.
    const application = createApplication(root, 60_000);
    const agent = await createRootAgent(application);
    let markStarted!: () => void;
    const started = new Promise<void>((resolve) => { markStarted = resolve; });
    let markAborted!: (reason: unknown) => void;
    const aborted = new Promise<unknown>((resolve) => { markAborted = resolve; });
    const orchestrate = vi.fn(async ({ signal }) => {
      markStarted();
      try {
        return await waitUntilAborted(signal);
      } finally {
        markAborted(signal?.reason);
      }
    });
    (application as any).__forgeGatewayService = { orchestrate };
    const server = createGatewayHttpServer(application);
    try {
      const baseUrl = await listen(server);
      const requestOutcome = disconnectingPost(
        new URL("/forge/orchestrate", baseUrl),
        { agentId: agent.agentId, goal: "wait for the HTTP disconnect" },
        started,
      );
      const [abortReason] = await Promise.all([aborted, requestOutcome]);
      expect(orchestrate).toHaveBeenCalledOnce();
      expect(orchestrate.mock.calls[0][0].signal.aborted).toBe(true);
      expect(abortReason).toMatchObject({ code: "CLIENT_DISCONNECTED" });
    } finally {
      await closeServer(server);
      rmSync(root, { recursive: true, force: true });
    }
  }, 30_000);

  it("propagates the HTTP deadline into Workforce and drains the route", async () => {
    const root = mkdtempSync(join(tmpdir(), "workforce-http-cancel-"));
    const application = createApplication(root);
    const agent = await createRootAgent(application);
    let markAborted!: () => void;
    const aborted = new Promise<void>((resolve) => { markAborted = resolve; });
    const execute = vi.fn(async (_input, options) => {
      try {
        return await waitUntilAborted(options?.signal);
      } finally {
        markAborted();
      }
    });
    (application as any).workforceExecutor = {
      describeExecution: vi.fn(async () => ({
        planId: "http-cancel-plan",
        planDigest: "a".repeat(64),
        autonomyMode: "controlled-execution",
        requiredScopes: [],
      })),
      execute,
    };
    const server = createGatewayHttpServer(application);
    try {
      const baseUrl = await listen(server);
      const response = await fetch(new URL("/workforce/execute", baseUrl), {
        method: "POST",
        headers: {
          authorization: `Bearer ${TOKEN}`,
          "content-type": "application/json",
          "x-pme-tenant-id": TENANT_ID,
        },
        body: JSON.stringify({
          agentId: agent.agentId,
          goal: "wait for the HTTP deadline",
        }),
      });
      await aborted;
      expect(response.status).toBe(504);
      expect(execute).toHaveBeenCalledOnce();
      expect(execute.mock.calls[0][1].signal.aborted).toBe(true);
    } finally {
      await closeServer(server);
      rmSync(root, { recursive: true, force: true });
    }
  }, 30_000);
});
