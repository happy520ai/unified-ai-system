/**
 * WebSocket Support
 * Provides real-time bidirectional communication for chat.
 */

import { createServer } from "node:http";
import { createHash } from "node:crypto";

const WS_MAGIC_STRING = "258EAFA5-E914-47DA-95CA-5AB9FFC3B2E8";
const WS_FRAME_TYPES = { TEXT: 0x01, BINARY: 0x02, CLOSE: 0x08, PING: 0x09, PONG: 0x0a };

/**
 * Create a WebSocket server that upgrades HTTP connections.
 * @param {Object} options
 * @param {Function} options.onConnection - Called when a client connects
 * @param {Function} options.onMessage - Called when a message is received
 * @param {Function} [options.authenticate] - Optional auth check: (request) => boolean | Promise<boolean>
 * @param {Function} options.onClose - Called when a connection closes
 * @returns {Object} WebSocket server with attach() method
 */
export function createWebSocketServer(options = {}) {
  const connections = new Set();
  const MAX_WS_CONNECTIONS = 100;

  function attach(httpServer) {
    httpServer.on("upgrade", async (request, socket, head) => {
      if (request.url !== "/ws") {
        socket.destroy();
        return;
      }

      // --- Origin validation ---
      const allowedOrigins = options.allowedOrigins ?? ["http://127.0.0.1:3100", "http://localhost:3100"];
      const origin = request.headers.origin;
      if (origin && !allowedOrigins.includes("*") && !allowedOrigins.includes(origin)) {
        socket.write("HTTP/1.1 403 Forbidden\r\n\r\n");
        socket.destroy();
        return;
      }

      // Authentication gate (if configured)
      if (options.authenticate) {
        let authorized = false;
        try {
          authorized = await options.authenticate(request);
        } catch {
          authorized = false;
        }
        if (!authorized) {
          socket.write("HTTP/1.1 401 Unauthorized\r\n\r\n");
          socket.destroy();
          return;
        }
      }

      const key = request.headers["sec-websocket-key"];
      if (!key) {
        socket.destroy();
        return;
      }

      const acceptKey = createHash("sha1")
        .update(key + WS_MAGIC_STRING)
        .digest("base64");

      socket.write(
        "HTTP/1.1 101 Switching Protocols\r\n" +
        "Upgrade: websocket\r\n" +
        "Connection: Upgrade\r\n" +
        `Sec-WebSocket-Accept: ${acceptKey}\r\n\r\n`
      );

      // Connection cap: reject if too many connections
      if (connections.size >= MAX_WS_CONNECTIONS) {
        socket.write("HTTP/1.1 503 Service Unavailable\r\n\r\n");
        socket.destroy();
        return;
      }

      const ws = createWebSocketConnection(socket);
      connections.add(ws);

      if (options.onConnection) {
        options.onConnection(ws);
      }

      ws.onMessage = options.onMessage || (() => {});
      ws.onClose = options.onClose || (() => {});

      socket.on("data", (buffer) => {
        try {
          const frame = decodeFrame(buffer);
          if (frame.type === WS_FRAME_TYPES.TEXT) {
            const result = ws.onMessage(frame.payload.toString("utf8"), ws);
            // Catch async rejections to prevent unhandled promise rejection crash
            if (result && typeof result.catch === "function") {
              result.catch((err) => { console.warn("[ws] async message handler error:", err?.message); });
            }
          } else if (frame.type === WS_FRAME_TYPES.CLOSE) {
            ws.close();
          } else if (frame.type === WS_FRAME_TYPES.PING) {
            ws.sendPong(frame.payload);
          }
        } catch (e) {
          // Invalid frame, ignore
        }
      });

      socket.on("close", () => {
        connections.delete(ws);
        if (ws.onClose) ws.onClose(ws);
      });

      socket.on("error", () => {
        connections.delete(ws);
        if (ws.onClose) ws.onClose(ws);
      });
    });
  }

  function broadcast(message) {
    for (const ws of connections) {
      ws.send(message);
    }
  }

  function getConnectionCount() {
    return connections.size;
  }

  function getConnections() {
    return connections;
  }

  return { attach, broadcast, getConnectionCount, getConnections };
}

function createWebSocketConnection(socket) {
  return {
    socket,
    send(data) {
      const payload = Buffer.from(typeof data === "string" ? data : JSON.stringify(data), "utf8");
      socket.write(encodeFrame(payload, WS_FRAME_TYPES.TEXT));
    },
    sendPong(data) {
      socket.write(encodeFrame(data || Buffer.alloc(0), WS_FRAME_TYPES.PONG));
    },
    close() {
      try {
        socket.write(encodeFrame(Buffer.alloc(0), WS_FRAME_TYPES.CLOSE));
        socket.end();
      } catch (err) { console.error("[webSocketServer]:", err?.message || err); }
    },
    onMessage: null,
    onClose: null,
  };
}

function encodeFrame(payload, type) {
  const payloadLength = payload.length;
  let header;

  if (payloadLength < 126) {
    header = Buffer.alloc(2);
    header[0] = 0x80 | type; // FIN + type
    header[1] = payloadLength;
  } else if (payloadLength < 65536) {
    header = Buffer.alloc(4);
    header[0] = 0x80 | type;
    header[1] = 126;
    header.writeUInt16BE(payloadLength, 2);
  } else {
    header = Buffer.alloc(10);
    header[0] = 0x80 | type;
    header[1] = 127;
    header.writeBigUInt64BE(BigInt(payloadLength), 2);
  }

  return Buffer.concat([header, payload]);
}

function decodeFrame(buffer) {
  if (buffer.length < 2) throw new Error("Frame too short");

  const firstByte = buffer[0];
  const secondByte = buffer[1];
  const type = firstByte & 0x0f;
  const masked = (secondByte & 0x80) !== 0;
  let payloadLength = secondByte & 0x7f;
  let offset = 2;

  if (payloadLength === 126) {
    payloadLength = buffer.readUInt16BE(2);
    offset = 4;
  } else if (payloadLength === 127) {
    payloadLength = Number(buffer.readBigUInt64BE(2));
    offset = 10;
  }

  const MAX_WS_PAYLOAD = 16 * 1024 * 1024; // 16 MB
  if (payloadLength > MAX_WS_PAYLOAD) {
    throw new Error("WebSocket frame payload exceeds maximum size (16MB)");
  }
  if (offset + payloadLength > buffer.length) {
    throw new Error("Incomplete WebSocket frame");
  }

  let maskKey = null;
  if (masked) {
    maskKey = Buffer.from(buffer.subarray(offset, offset + 4));
    offset += 4;
  }

  const payload = Buffer.from(buffer.subarray(offset, offset + payloadLength));
  if (masked && maskKey) {
    for (let i = 0; i < payload.length; i++) {
      payload[i] ^= maskKey[i % 4];
    }
  }

  return { type, payload };
}
