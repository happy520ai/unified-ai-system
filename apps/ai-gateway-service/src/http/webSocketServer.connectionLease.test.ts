import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import WebSocket from "ws";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createWebSocketServer } from "./webSocketServer.js";
import type {
  WebSocketConnectionLease,
  WebSocketConnectionLeaseManager,
} from "./postgresWebSocketConnectionLeaseManager.ts";

type RunningGateway = {
  server: Server;
  transport: ReturnType<typeof createWebSocketServer>;
  port: number;
};

const running = new Set<RunningGateway>();

afterEach(async () => {
  await Promise.allSettled([...running].map(async ({ server, transport }) => {
    await transport.close(1001, "Test shutdown");
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }));
  running.clear();
});

describe("WebSocket distributed connection lease integration", () => {
  it("returns 503 when durable acquisition cannot be proven", async () => {
    const onMessage = vi.fn();
    const manager = createManager(async () => {
      throw new Error("database unavailable");
    });
    const gateway = await startGateway(manager, onMessage);

    await expect(readUpgradeStatus(gateway.port)).resolves.toBe(503);
    expect(onMessage).not.toHaveBeenCalled();
  });

  it("returns 429 when the cross-replica connection limit is exhausted", async () => {
    const manager = createManager(async () => ({
      acquired: false,
      scope: "subject",
      retryAfterSeconds: 7,
    }));
    const gateway = await startGateway(manager, vi.fn());

    await expect(readUpgradeStatus(gateway.port)).resolves.toBe(429);
  });

  it("releases the exact lease on a normal close", async () => {
    const lease = createLease();
    const manager = createManager(async () => ({ acquired: true, lease }));
    const gateway = await startGateway(manager, vi.fn());
    const socket = await connect(gateway.port);

    socket.close(1000, "Complete");
    await new Promise<void>((resolve) => socket.once("close", () => resolve()));
    await vi.waitFor(() => {
      expect(lease.release).toHaveBeenCalledTimes(1);
    });
  });

  it("closes with 1013 and starts no application work after lease loss", async () => {
    let valid = true;
    let onLost: (() => void) | null = null;
    const lease = createLease({
      isValid: () => valid,
      start: vi.fn((callback: () => void) => {
        onLost = callback;
      }),
    });
    const onMessage = vi.fn();
    const manager = createManager(async () => ({ acquired: true, lease }));
    const gateway = await startGateway(manager, onMessage);
    const socket = await connect(gateway.port);

    const closed = new Promise<number>((resolve) => socket.once("close", (code) => resolve(code)));
    valid = false;
    socket.send("must-not-execute");
    onLost?.();
    await expect(closed).resolves.toBe(1013);
    expect(onMessage).not.toHaveBeenCalled();
  });
});

async function startGateway(
  connectionLeaseManager: WebSocketConnectionLeaseManager,
  onMessage: ReturnType<typeof vi.fn>,
): Promise<RunningGateway> {
  const server = createServer((_request, response) => {
    response.writeHead(404).end();
  });
  const transport = createWebSocketServer({
    environment: "test",
    allowedOrigins: ["http://gateway.test"],
    heartbeatIntervalMs: 60_000,
    reauthorizationIntervalMs: 60_000,
    maxConnectionLifetimeMs: 60_000,
    connectionLeaseManager,
    authenticate: async () => ({
      allowed: true,
      identity: {
        userId: "operator-a",
        tenantId: "tenant-a",
        role: "operator",
        permissions: ["chat:use"],
      },
    }),
    onMessage,
  });
  transport.attach(server);
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address() as AddressInfo;
  const gateway = { server, transport, port: address.port };
  running.add(gateway);
  return gateway;
}

async function connect(port: number): Promise<WebSocket> {
  const socket = new WebSocket(`ws://127.0.0.1:${port}/ws`, {
    headers: { Origin: "http://gateway.test" },
  });
  await new Promise<void>((resolve, reject) => {
    socket.once("open", resolve);
    socket.once("error", reject);
  });
  return socket;
}

async function readUpgradeStatus(port: number): Promise<number> {
  const socket = new WebSocket(`ws://127.0.0.1:${port}/ws`, {
    headers: { Origin: "http://gateway.test" },
  });
  return new Promise<number>((resolve, reject) => {
    socket.once("unexpected-response", (_request, response) => {
      resolve(response.statusCode ?? 0);
      response.resume();
      socket.terminate();
    });
    socket.once("open", () => reject(new Error("The rejected WebSocket unexpectedly opened.")));
    socket.once("error", () => undefined);
  });
}

function createManager(
  acquire: WebSocketConnectionLeaseManager["acquire"],
): WebSocketConnectionLeaseManager {
  return {
    acquire,
    checkHealth: async () => ({ available: true }),
    getStats: () => ({ mode: "test" }),
    close: async () => undefined,
  };
}

function createLease(overrides: Partial<WebSocketConnectionLease> = {}): WebSocketConnectionLease & {
  release: ReturnType<typeof vi.fn>;
} {
  const release = vi.fn(async () => undefined);
  return {
    isValid: () => true,
    renewNow: async () => true,
    start: vi.fn(),
    release,
    ...overrides,
  };
}
