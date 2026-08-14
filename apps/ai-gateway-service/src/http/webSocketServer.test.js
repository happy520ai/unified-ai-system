import { createServer } from "node:http";
import WebSocket from "ws";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createGatewayHttpServer } from "./httpServer.js";
import { createWebSocketServer } from "./webSocketServer.js";

const cleanups = [];
const clients = new Set();

afterEach(async () => {
  for (const client of clients) client.terminate();
  clients.clear();
  await Promise.allSettled(cleanups.splice(0).reverse().map((cleanup) => cleanup()));
});

describe("governed websocket server", () => {
  it("fails closed when no authentication callback is configured", async () => {
    const { url } = await startGateway();
    await expect(rejectedStatus(url)).resolves.toBe(401);
  });

  it("rejects ambiguous object authentication results", async () => {
    const { url } = await startGateway({ authenticate: async () => ({ identity: { userId: "alice" } }) });
    await expect(rejectedStatus(url)).resolves.toBe(401);
  });

  it("preserves a server-authenticated identity without exposing mutable connection state", async () => {
    const identity = { userId: "alice", tenantId: "tenant-a", role: "operator" };
    const { url, gateway } = await startGateway({
      authenticate: async () => ({ allowed: true, identity }),
    });
    const client = await connect(url);

    const snapshot = gateway.getConnections();
    expect(snapshot.size).toBe(1);
    expect([...snapshot][0].identity).toEqual(identity);
    snapshot.clear();
    expect(gateway.getConnectionCount()).toBe(1);
    client.close();
  });

  it("rejects disallowed browser origins before authentication", async () => {
    const authenticate = vi.fn(async () => true);
    const { url, gateway } = await startGateway({
      allowedOrigins: ["https://allowed.example"],
      authenticate,
    });

    await expect(rejectedStatus(url, { origin: "https://blocked.example" })).resolves.toBe(403);
    expect(authenticate).not.toHaveBeenCalled();
    expect(gateway.getSecuritySnapshot().originRejected).toBe(1);
  });

  it("forbids wildcard origins in production", () => {
    expect(() => createWebSocketServer({
      allowedOrigins: ["*"],
      environment: "production",
      authenticate: async () => true,
    })).toThrow(/Wildcard WebSocket origins/);
  });

  it("rejects upgrades above the global connection cap", async () => {
    const { url, gateway } = await startGateway({
      authenticate: async () => true,
      maxConnections: 1,
    });
    await connect(url);
    await expect(rejectedStatus(url)).resolves.toBe(503);
    expect(gateway.getSecuritySnapshot()).toMatchObject({ activeConnections: 1, capacityRejected: 1 });
  });

  it("prevents one authenticated subject from exhausting all connections", async () => {
    const { url, gateway } = await startGateway({
      authenticate: async () => ({ allowed: true, identity: { userId: "alice", tenantId: "tenant-a" } }),
      maxConnections: 10,
      maxConnectionsPerSubject: 1,
    });
    await connect(url);
    await expect(rejectedStatus(url)).resolves.toBe(429);
    expect(gateway.getSecuritySnapshot().subjectConnectionRejected).toBe(1);
  });

  it("closes a subject that exceeds its sliding-window message quota", async () => {
    const onMessage = vi.fn();
    const { url, gateway } = await startGateway({
      authenticate: async () => ({ allowed: true, identity: { userId: "alice" } }),
      maxMessagesPerWindow: 1,
      messageWindowMs: 60_000,
      onMessage,
    });
    const client = await connect(url);
    client.send("first");
    await waitFor(() => onMessage.mock.calls.length === 1);
    const closed = waitForClose(client);
    client.send("second");

    await expect(closed).resolves.toMatchObject({ code: 1008 });
    expect(gateway.getSecuritySnapshot().rateLimitRejected).toBe(1);
  });

  it("enforces one shared message quota across independent gateway instances", async () => {
    let sharedCount = 0;
    const subjects = [];
    const consumeMessageQuota = vi.fn(async (subject) => {
      subjects.push(subject);
      sharedCount += 1;
      return {
        allowed: sharedCount <= 1,
        remaining: Math.max(0, 1 - sharedCount),
        retryAfterMs: 60_000,
      };
    });
    const firstMessage = vi.fn();
    const secondMessage = vi.fn();
    const authentication = async () => ({
      allowed: true,
      identity: { userId: "alice", tenantId: "tenant-a" },
    });
    const first = await startGateway({
      authenticate: authentication,
      consumeMessageQuota,
      onMessage: firstMessage,
    });
    const second = await startGateway({
      authenticate: authentication,
      consumeMessageQuota,
      onMessage: secondMessage,
    });
    const firstClient = await connect(first.url);
    const secondClient = await connect(second.url);

    firstClient.send("first node");
    await waitFor(() => firstMessage.mock.calls.length === 1);
    const closed = waitForClose(secondClient);
    secondClient.send("second node");

    await expect(closed).resolves.toMatchObject({ code: 1008, reason: "Message rate limit exceeded" });
    expect(secondMessage).not.toHaveBeenCalled();
    expect(consumeMessageQuota).toHaveBeenCalledTimes(2);
    expect(new Set(subjects).size).toBe(1);
  });

  it("enforces one shared upgrade quota across independent gateway instances", async () => {
    let sharedCount = 0;
    const consumeUpgradeQuota = vi.fn(async () => ({
      allowed: ++sharedCount <= 1,
      retryAfterMs: 60_000,
    }));
    const authentication = async () => ({
      allowed: true,
      identity: { userId: "alice", tenantId: "tenant-a" },
    });
    const first = await startGateway({ authenticate: authentication, consumeUpgradeQuota });
    const second = await startGateway({ authenticate: authentication, consumeUpgradeQuota });

    await connect(first.url);
    await expect(rejectedStatus(second.url)).resolves.toBe(429);
    expect(consumeUpgradeQuota).toHaveBeenCalledTimes(2);
    expect(second.gateway.getSecuritySnapshot().upgradeQuotaRejected).toBe(1);
  });

  it("fails closed when the shared message quota store is unavailable", async () => {
    const onMessage = vi.fn();
    const { url, gateway } = await startGateway({
      authenticate: async () => true,
      consumeMessageQuota: async () => { throw new Error("shared store down"); },
      onMessage,
    });
    const client = await connect(url);
    const closed = waitForClose(client);
    client.send("must not execute");

    await expect(closed).resolves.toMatchObject({ code: 1013, reason: "Message quota unavailable" });
    expect(onMessage).not.toHaveBeenCalled();
    expect(gateway.getSecuritySnapshot().quotaStoreUnavailable).toBe(1);
  });

  it("rejects an upgrade when the shared quota result cannot be proven", async () => {
    const { url, gateway } = await startGateway({
      authenticate: async () => true,
      consumeUpgradeQuota: async () => null,
    });

    await expect(rejectedStatus(url)).resolves.toBe(503);
    expect(gateway.getSecuritySnapshot()).toMatchObject({
      upgradeQuotaRejected: 1,
      quotaStoreUnavailable: 1,
    });
  });

  it("closes concurrent work instead of bypassing the per-subject execution cap", async () => {
    let release;
    const pending = new Promise((resolve) => { release = resolve; });
    const onMessage = vi.fn(async () => pending);
    const { url, gateway } = await startGateway({
      authenticate: async () => ({ allowed: true, identity: { userId: "alice" } }),
      maxInFlightMessages: 4,
      maxInFlightPerSubject: 1,
      onMessage,
    });
    const client = await connect(url);
    client.send("first");
    await waitFor(() => onMessage.mock.calls.length === 1);
    const closed = waitForClose(client);
    client.send("second");

    await expect(closed).resolves.toMatchObject({ code: 1013 });
    expect(gateway.getSecuritySnapshot().concurrencyRejected).toBe(1);
    release();
  });

  it("enforces one execution lease across independent gateway instances", async () => {
    const executionLeases = createSharedExecutionLeaseManager();
    let releaseFirst;
    const pending = new Promise((resolve) => { releaseFirst = resolve; });
    const firstMessage = vi.fn(async () => pending);
    const secondMessage = vi.fn();
    const authenticate = async () => ({
      allowed: true,
      identity: { userId: "alice", tenantId: "tenant-a" },
    });
    const first = await startGateway({
      authenticate,
      executionLeaseManager: executionLeases,
      maxInFlightMessages: 4,
      maxInFlightPerSubject: 1,
      onMessage: firstMessage,
    });
    const second = await startGateway({
      authenticate,
      executionLeaseManager: executionLeases,
      maxInFlightMessages: 4,
      maxInFlightPerSubject: 1,
      onMessage: secondMessage,
    });
    const firstClient = await connect(first.url);
    const secondClient = await connect(second.url);

    firstClient.send("first node");
    await waitFor(() => firstMessage.mock.calls.length === 1);
    const closed = waitForClose(secondClient);
    secondClient.send("second node");

    await expect(closed).resolves.toMatchObject({ code: 1013, reason: "Too many in-flight messages" });
    expect(secondMessage).not.toHaveBeenCalled();
    expect(second.gateway.getSecuritySnapshot()).toMatchObject({
      concurrencyRejected: 1,
      executionLeaseRejected: 1,
    });
    releaseFirst();
    await waitFor(() => executionLeases.active() === 0);
  });

  it("fails closed before provider work when the execution lease store is unavailable", async () => {
    const onMessage = vi.fn();
    const { url, gateway } = await startGateway({
      authenticate: async () => ({ allowed: true, identity: { userId: "alice" } }),
      executionLeaseManager: {
        acquireExecution: async () => { throw new Error("execution lease store down"); },
      },
      onMessage,
    });
    const client = await connect(url);
    const closed = waitForClose(client);
    client.send("must not execute");

    await expect(closed).resolves.toMatchObject({ code: 1013, reason: "Execution lease unavailable" });
    expect(onMessage).not.toHaveBeenCalled();
    expect(gateway.getSecuritySnapshot().executionLeaseUnavailable).toBe(1);
  });

  it("closes an executing socket when its distributed execution lease is lost", async () => {
    const executionLeases = createSharedExecutionLeaseManager();
    let releaseWork;
    const pending = new Promise((resolve) => { releaseWork = resolve; });
    const onMessage = vi.fn(async () => pending);
    const { url, gateway } = await startGateway({
      authenticate: async () => ({ allowed: true, identity: { userId: "alice" } }),
      executionLeaseManager: executionLeases,
      onMessage,
    });
    const client = await connect(url);
    const closed = waitForClose(client);
    client.send("long-running request");
    await waitFor(() => onMessage.mock.calls.length === 1);

    executionLeases.loseLatest();

    await expect(closed).resolves.toMatchObject({ code: 1013, reason: "Execution lease unavailable" });
    expect(gateway.getSecuritySnapshot().executionLeaseLost).toBe(1);
    releaseWork();
    await waitFor(() => executionLeases.active() === 0);
  });

  it("rejects binary messages", async () => {
    const onMessage = vi.fn();
    const { url, gateway } = await startGateway({ authenticate: async () => true, onMessage });
    const client = await connect(url);
    const closed = waitForClose(client);
    client.send(Buffer.from("binary"));

    await expect(closed).resolves.toMatchObject({ code: 1003 });
    expect(onMessage).not.toHaveBeenCalled();
    expect(gateway.getSecuritySnapshot().binaryRejected).toBe(1);
  });

  it("uses protocol-level maxPayload enforcement for fragmented or complete messages", async () => {
    const { url } = await startGateway({
      authenticate: async () => true,
      maxPayloadBytes: 64,
    });
    const client = await connect(url);
    const closed = waitForClose(client);
    client.send("x".repeat(128));

    await expect(closed).resolves.toMatchObject({ code: 1009 });
  });

  it("bounds authentication latency", async () => {
    const { url, gateway } = await startGateway({
      authenticate: async () => new Promise(() => {}),
      authenticationTimeoutMs: 20,
    });
    await expect(rejectedStatus(url)).resolves.toBe(401);
    expect(gateway.getSecuritySnapshot().authenticationTimedOut).toBe(1);
  });

  it("reauthorizes every business message with a minimized authentication context", async () => {
    const observedRequests = [];
    const authenticate = vi.fn(async (request) => {
      observedRequests.push({
        authorization: request.headers.authorization,
        enumerableHeaders: Object.keys(request.headers),
      });
      return { allowed: true, identity: { userId: "alice", tenantId: "tenant-a" } };
    });
    const onMessage = vi.fn();
    const { url } = await startGateway({ authenticate, onMessage });
    const client = await connect(url, {
      headers: { authorization: "Bearer websocket-test-token" },
    });
    client.send("authorized message");
    await waitFor(() => onMessage.mock.calls.length === 1);

    expect(authenticate).toHaveBeenCalledTimes(2);
    expect(observedRequests[1]).toEqual({
      authorization: "Bearer websocket-test-token",
      enumerableHeaders: expect.not.arrayContaining(["authorization"]),
    });
  });

  it("closes an active connection immediately after its authorization is revoked", async () => {
    let allowed = true;
    const onMessage = vi.fn();
    const { url, gateway } = await startGateway({
      authenticate: async () => ({
        allowed,
        identity: { userId: "alice", tenantId: "tenant-a" },
        statusCode: allowed ? 200 : 401,
      }),
      onMessage,
    });
    const client = await connect(url);
    allowed = false;
    const closed = waitForClose(client);
    client.send("must not execute");

    await expect(closed).resolves.toMatchObject({ code: 1008, reason: "Authorization expired" });
    expect(onMessage).not.toHaveBeenCalled();
    expect(gateway.getSecuritySnapshot().reauthorizationRejected).toBe(1);
  });

  it("rejects a token that is rebound to a different authenticated subject", async () => {
    let userId = "alice";
    const onMessage = vi.fn();
    const { url, gateway } = await startGateway({
      authenticate: async () => ({
        allowed: true,
        identity: { userId, tenantId: "tenant-a" },
      }),
      onMessage,
    });
    const client = await connect(url);
    userId = "mallory";
    const closed = waitForClose(client);
    client.send("identity drift attempt");

    await expect(closed).resolves.toMatchObject({ code: 1008, reason: "Authenticated identity changed" });
    expect(onMessage).not.toHaveBeenCalled();
    expect(gateway.getSecuritySnapshot().identityDriftRejected).toBe(1);
  });

  it("periodically reauthorizes idle connections and closes revoked sessions", async () => {
    let allowed = true;
    const { url, gateway } = await startGateway({
      authenticate: async () => ({
        allowed,
        identity: { userId: "alice", tenantId: "tenant-a" },
      }),
      heartbeatIntervalMs: 10,
      reauthorizationIntervalMs: 10,
      maxConnectionLifetimeMs: 1_000,
    });
    const client = await connect(url);
    allowed = false;
    const closed = waitForClose(client);

    await expect(closed).resolves.toMatchObject({ code: 1008, reason: "Authorization expired" });
    expect(gateway.getSecuritySnapshot().reauthorizationRejected).toBe(1);
  });

  it("forces a fresh handshake when the maximum connection lifetime expires", async () => {
    const { url, gateway } = await startGateway({
      authenticate: async () => ({
        allowed: true,
        identity: { userId: "alice", tenantId: "tenant-a" },
      }),
      heartbeatIntervalMs: 10,
      reauthorizationIntervalMs: 1_000,
      maxConnectionLifetimeMs: 25,
    });
    const client = await connect(url);
    const closed = waitForClose(client);

    await expect(closed).resolves.toMatchObject({
      code: 1008,
      reason: "Session reauthentication required",
    });
    expect(gateway.getSecuritySnapshot().sessionLifetimeRejected).toBe(1);
  });

  it("contains asynchronous message-handler failures", async () => {
    const onError = vi.fn();
    const { url } = await startGateway({
      authenticate: async () => true,
      onMessage: async () => { throw new Error("handler failed"); },
      onError,
    });
    const client = await connect(url);
    const closed = waitForClose(client);
    client.send("request");

    await expect(closed).resolves.toMatchObject({ code: 1011 });
    expect(onError).toHaveBeenCalledWith(
      expect.any(Error),
      expect.objectContaining({ event: "ws_message_rejected" }),
    );
  });

  it("binds the full gateway route, enforces enterprise auth, and executes only the fake test provider", async () => {
    const execute = vi.fn(async () => ({
      executionMode: "fake",
      providerId: "fake-provider",
      output: "governed websocket response",
    }));
    const authorize = vi.fn((request, permission) => {
      const allowed = request.headers.authorization === "Bearer websocket-test-token" && permission === "chat:use";
      return {
        allowed,
        identity: allowed ? { userId: "alice", tenantId: "tenant-a", role: "operator" } : null,
        permission,
        statusCode: allowed ? 200 : 401,
      };
    });
    const server = createGatewayHttpServer(createGatewayApplicationFixture({ execute, authorize }));
    await new Promise((resolve, reject) => {
      server.once("error", reject);
      server.listen(0, "127.0.0.1", resolve);
    });
    cleanups.push(async () => {
      server.closeRealtimeConnections?.();
      if (server.listening) {
        await new Promise((resolve) => server.close(() => resolve()));
      }
      await server.shutdownResources?.();
    });
    const address = server.address();
    const url = `ws://127.0.0.1:${address.port}/ws`;

    await expect(rejectedStatus(url, { origin: "https://console.example" })).resolves.toBe(401);
    const client = await connect(url, {
      origin: "https://console.example",
      headers: { authorization: "Bearer websocket-test-token" },
    });
    const response = waitForJsonMessage(client, (message) => message.type === "chat_response");
    client.send(JSON.stringify({ type: "chat", prompt: "hello through governed websocket" }));

    await expect(response).resolves.toMatchObject({
      type: "chat_response",
      data: { executionMode: "fake", providerId: "fake-provider" },
    });
    expect(execute.mock.calls[0][0]).toMatchObject({
      messages: [{ role: "user", content: "hello through governed websocket" }],
      metadata: {
        source: "websocket",
        userId: "alice",
        tenantId: "tenant-a",
      },
    });
    expect(authorize).toHaveBeenCalledWith(expect.anything(), "chat:use");
  });
});

async function startGateway(options = {}) {
  const transport = createServer();
  const gateway = createWebSocketServer({ shutdownGraceMs: 5, ...options });
  gateway.attach(transport);
  await new Promise((resolve, reject) => {
    transport.once("error", reject);
    transport.listen(0, "127.0.0.1", resolve);
  });
  const address = transport.address();
  const url = `ws://127.0.0.1:${address.port}/ws`;
  cleanups.push(async () => {
    gateway.close();
    if (!transport.listening) return;
    await new Promise((resolve) => transport.close(() => resolve()));
  });
  return { gateway, transport, url };
}

function createSharedExecutionLeaseManager() {
  let activeCount = 0;
  const activeBySubject = new Map();
  const leases = [];
  return {
    active: () => activeCount,
    loseLatest: () => leases.at(-1)?.lose(),
    async acquireExecution(subject, limits) {
      const subjectCount = activeBySubject.get(subject) ?? 0;
      if (subjectCount >= limits.maxInFlightPerSubject) {
        return { acquired: false, scope: "subject", retryAfterSeconds: 1 };
      }
      if (activeCount >= limits.maxInFlightMessages) {
        return { acquired: false, scope: "global", retryAfterSeconds: 1 };
      }
      let valid = true;
      let released = false;
      let onLost = null;
      activeCount += 1;
      activeBySubject.set(subject, subjectCount + 1);
      const controller = {
        lose() {
          if (!valid) return;
          valid = false;
          queueMicrotask(() => onLost?.());
        },
      };
      leases.push(controller);
      return {
        acquired: true,
        lease: {
          isValid: () => valid,
          start(callback) {
            onLost = callback;
          },
          async release() {
            if (released) return;
            released = true;
            valid = false;
            activeCount = Math.max(0, activeCount - 1);
            const remaining = Math.max(0, (activeBySubject.get(subject) ?? 1) - 1);
            if (remaining === 0) activeBySubject.delete(subject);
            else activeBySubject.set(subject, remaining);
          },
        },
      };
    },
  };
}

function connect(url, options = {}) {
  return new Promise((resolve, reject) => {
    const client = new WebSocket(url, { perMessageDeflate: false, ...options });
    clients.add(client);
    client.once("open", () => resolve(client));
    client.once("unexpected-response", (_request, response) => {
      response.resume();
      reject(new Error(`Unexpected HTTP ${response.statusCode}`));
    });
    client.once("error", reject);
  });
}

function rejectedStatus(url, options = {}) {
  return new Promise((resolve, reject) => {
    const client = new WebSocket(url, { perMessageDeflate: false, ...options });
    clients.add(client);
    client.once("open", () => reject(new Error("WebSocket upgrade unexpectedly succeeded.")));
    client.once("unexpected-response", (_request, response) => {
      const status = response.statusCode;
      response.resume();
      resolve(status);
    });
    client.once("error", (error) => reject(error));
  });
}

function waitForClose(client) {
  return new Promise((resolve) => {
    client.once("close", (code, reason) => resolve({ code, reason: reason.toString("utf8") }));
  });
}

function waitForJsonMessage(client, predicate) {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      cleanup();
      reject(new Error("Timed out waiting for governed WebSocket response."));
    }, 1_000);
    const onMessage = (data) => {
      let parsed;
      try {
        parsed = JSON.parse(data.toString("utf8"));
      } catch {
        return;
      }
      if (!predicate(parsed)) return;
      cleanup();
      resolve(parsed);
    };
    const cleanup = () => {
      clearTimeout(timeout);
      client.off("message", onMessage);
    };
    client.on("message", onMessage);
  });
}

function createGatewayApplicationFixture({ execute, authorize }) {
  return {
    runtimeEnv: {
      AI_GATEWAY_CORS_ALLOWED_ORIGINS: "https://console.example",
      AI_GATEWAY_WS_SHUTDOWN_GRACE_MS: "5",
    },
    config: {
      aiGatewayService: {
        providerMode: "fake-provider",
        realProviderEnabled: false,
      },
    },
    knowledgeService: { getHealth: () => ({ status: "ready" }) },
    knowledgeInfra: { getReadiness: () => ({ status: "ready" }) },
    workflowService: { getHealth: () => ({ status: "ready" }) },
    workforceService: { getHealth: () => ({ status: "ready" }) },
    enterpriseGovernanceService: {
      getHealth: () => ({ status: "ready" }),
      authorize,
      recordAudit: () => undefined,
    },
    gatewayService: {
      getProviderDescriptors: () => [{ id: "fake-provider", type: "fake" }],
      execute,
    },
    requestLogger: { getStats: () => ({}) },
    healthScorer: { getAllScores: () => ({}) },
    userExperienceService: { getDashboard: () => ({ route: "/dashboard/status" }) },
  };
}

async function waitFor(predicate, timeoutMs = 1_000) {
  const deadline = Date.now() + timeoutMs;
  while (!predicate()) {
    if (Date.now() >= deadline) throw new Error("Timed out waiting for WebSocket test condition.");
    await new Promise((resolve) => setTimeout(resolve, 5));
  }
}
