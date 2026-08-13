import { EventEmitter } from "node:events";
import { describe, expect, it, vi } from "vitest";
import { createWebSocketServer } from "./webSocketServer.js";

class MockSocket extends EventEmitter {
  constructor() {
    super();
    this.destroyed = false;
    this.writes = [];
  }

  write(value) {
    this.writes.push(String(value));
    return true;
  }

  destroy() {
    this.destroyed = true;
  }

  end() {}
}

function upgrade(server, socket, headers = {}) {
  server.emit("upgrade", {
    url: "/ws",
    headers: {
      "sec-websocket-key": "dGhlIHNhbXBsZSBub25jZQ==",
      ...headers,
    },
  }, socket, Buffer.alloc(0));
}

describe("websocket server", () => {
  it("rejects upgrades above the configured connection cap", async () => {
    const transport = new EventEmitter();
    const onError = vi.fn();
    const websocket = createWebSocketServer({
      maxConnections: 1,
      onError,
    });
    websocket.attach(transport);

    const first = new MockSocket();
    const second = new MockSocket();
    upgrade(transport, first);
    upgrade(transport, second);
    await new Promise(setImmediate);

    expect(websocket.getConnectionCount()).toBe(1);
    expect(second.writes.join("")).toContain("503 Service Unavailable");
    expect(second.destroyed).toBe(true);
    expect(onError).toHaveBeenCalledWith(
      expect.any(Error),
      expect.objectContaining({ event: "ws_connection_limit" }),
    );

    first.emit("close");
    expect(websocket.getConnectionCount()).toBe(0);
  });

  it("rejects unauthorized upgrades before the handshake", async () => {
    const transport = new EventEmitter();
    const websocket = createWebSocketServer({
      authenticate: async () => false,
    });
    websocket.attach(transport);
    const socket = new MockSocket();

    upgrade(transport, socket);
    await new Promise(setImmediate);

    expect(socket.writes.join("")).toContain("401 Unauthorized");
    expect(socket.writes.join("")).not.toContain("101 Switching Protocols");
    expect(socket.destroyed).toBe(true);
  });

  it("rejects disallowed browser origins", async () => {
    const transport = new EventEmitter();
    const websocket = createWebSocketServer({
      allowedOrigins: ["https://allowed.example"],
    });
    websocket.attach(transport);
    const socket = new MockSocket();

    upgrade(transport, socket, { origin: "https://blocked.example" });
    await new Promise(setImmediate);

    expect(socket.writes.join("")).toContain("403 Forbidden");
    expect(socket.destroyed).toBe(true);
  });

  it("returns a snapshot instead of exposing its mutable connection set", async () => {
    const transport = new EventEmitter();
    const websocket = createWebSocketServer();
    websocket.attach(transport);
    const socket = new MockSocket();

    upgrade(transport, socket);
    await new Promise(setImmediate);
    const snapshot = websocket.getConnections();
    snapshot.clear();

    expect(websocket.getConnectionCount()).toBe(1);
    socket.emit("close");
  });

  it("preserves the authenticated identity on the connection", async () => {
    const transport = new EventEmitter();
    const websocket = createWebSocketServer({
      authenticate: async () => ({ allowed: true, identity: { userId: "alice" } }),
    });
    websocket.attach(transport);
    const socket = new MockSocket();

    upgrade(transport, socket);
    await new Promise(setImmediate);

    expect(socket.writes.join("")).toContain("101 Switching Protocols");
    const connections = websocket.getConnections();
    expect(connections.size).toBe(1);
    const ws = [...connections][0];
    expect(ws.identity).toEqual({ userId: "alice" });

    socket.emit("close");
  });

  it("rejects an object auth result with allowed:false", async () => {
    const transport = new EventEmitter();
    const websocket = createWebSocketServer({
      authenticate: async () => ({ allowed: false, identity: { userId: "bob" } }),
    });
    websocket.attach(transport);
    const socket = new MockSocket();

    upgrade(transport, socket);
    await new Promise(setImmediate);

    expect(socket.writes.join("")).toContain("401 Unauthorized");
    expect(socket.destroyed).toBe(true);
  });
});
