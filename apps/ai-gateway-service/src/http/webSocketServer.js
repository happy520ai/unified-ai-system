/**
 * WebSocket Support
 * Provides real-time bidirectional communication for chat.
 */

import { createServer } from "node:http";
import { createHash } from "node:crypto";

const WS_MAGIC_STRING = "258EAFA5-E914-47DA-95CA-5AB9FFC3B2E8";
const WS_FRAME_TYPES = { TEXT: 0x01, BINARY: 0x02, CLOSE: 0x08, PING: 0x09, PONG: 0x0a };
const MAX_WS_CONNECTIONS = 100;
const MAX_WS_PAYLOAD = 16 * 1024 * 1024;
const DEFAULT_ALLOWED_ORIGINS = [
  "http://127.0.0.1:3100",
  "http://localhost:3100",
];

/**
 * Create a WebSocket server that upgrades HTTP connections.
 * @param {Object} options
 * @param {Function} options.onConnection - Called when a client connects
 * @param {Function} options.onMessage - Called when a message is received
 * @param {Function} [options.authenticate] - Optional auth check
 * @param {string[]} [options.allowedOrigins] - Browser origins allowed to upgrade
 * @param {Function} options.onClose - Called when a connection closes
 * @param {Function} options.onError - Called when frame handling or close fails
 * @returns {Object} WebSocket server with attach() method
 */
export function createWebSocketServer(options = {}) {
  const connections = new Set();
  const configuredMax = Number(options.maxConnections);
  const maxConnections = Number.isInteger(configuredMax) && configuredMax > 0
    ? Math.min(configuredMax, MAX_WS_CONNECTIONS)
    : MAX_WS_CONNECTIONS;
  const allowedOrigins = Array.isArray(options.allowedOrigins) && options.allowedOrigins.length > 0
    ? options.allowedOrigins
    : DEFAULT_ALLOWED_ORIGINS;

  function attach(httpServer) {
    httpServer.on("upgrade", async (request, socket, head) => {
      if (request.url !== "/ws") {
        socket.destroy();
        return;
      }

      const reportError = (error, context = {}) => {
        options.onError?.(error, { path: request.url, ...context });
      };
      const origin = request.headers.origin;
      const wildcardAllowed = allowedOrigins.includes("*") && process.env.NODE_ENV !== "production";
      if (origin && !wildcardAllowed && !allowedOrigins.includes(origin)) {
        rejectUpgrade(socket, "403 Forbidden");
        return;
      }

      if (options.authenticate) {
        try {
          const authorized = await options.authenticate(request);
          if (!authorized) {
            rejectUpgrade(socket, "401 Unauthorized");
            return;
          }
        } catch (error) {
          reportError(error, { event: "ws_authentication_failed" });
          rejectUpgrade(socket, "401 Unauthorized");
          return;
        }
      }

      const key = request.headers["sec-websocket-key"];
      if (!key) {
        socket.destroy();
        return;
      }

      if (connections.size >= maxConnections) {
        socket.write(
          "HTTP/1.1 503 Service Unavailable\r\n"
          + "Connection: close\r\n"
          + "Retry-After: 5\r\n"
          + "Content-Length: 0\r\n\r\n",
        );
        socket.destroy();
        options.onError?.(
          new Error("WebSocket connection limit reached."),
          { event: "ws_connection_limit", maxConnections },
        );
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

      const ws = createWebSocketConnection(socket, reportError);
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
            if (result && typeof result.catch === "function") {
              result.catch((error) => reportError(error, { event: "ws_message_rejected" }));
            }
          } else if (frame.type === WS_FRAME_TYPES.CLOSE) {
            ws.close();
          } else if (frame.type === WS_FRAME_TYPES.PING) {
            ws.sendPong(frame.payload);
          }
        } catch (error) {
          reportError(error, { event: "ws_frame_rejected" });
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
    return new Set(connections);
  }

  return { attach, broadcast, getConnectionCount, getConnections };
}

function rejectUpgrade(socket, status) {
  socket.write(
    `HTTP/1.1 ${status}\r\n`
    + "Connection: close\r\n"
    + "Content-Length: 0\r\n\r\n",
  );
  socket.destroy();
}

function createWebSocketConnection(socket, reportError = () => {}) {
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
      } catch (error) {
        reportError(error, { event: "ws_close_failed" });
        socket.destroy();
      }
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
    if (buffer.length < 4) throw new Error("Incomplete WebSocket frame header");
    payloadLength = buffer.readUInt16BE(2);
    offset = 4;
  } else if (payloadLength === 127) {
    if (buffer.length < 10) throw new Error("Incomplete WebSocket frame header");
    payloadLength = Number(buffer.readBigUInt64BE(2));
    offset = 10;
  }

  if (!Number.isSafeInteger(payloadLength) || payloadLength > MAX_WS_PAYLOAD) {
    throw new Error("WebSocket frame payload exceeds maximum size (16MB)");
  }
  if (!masked) {
    throw new Error("Client WebSocket frames must be masked");
  }

  let maskKey = null;
  if (masked) {
    if (buffer.length < offset + 4) throw new Error("Incomplete WebSocket mask");
    maskKey = buffer.slice(offset, offset + 4);
    offset += 4;
  }

  if (offset + payloadLength > buffer.length) {
    throw new Error("Incomplete WebSocket frame");
  }

  const payload = Buffer.from(buffer.subarray(offset, offset + payloadLength));
  if (masked && maskKey) {
    for (let i = 0; i < payload.length; i++) {
      payload[i] ^= maskKey[i % 4];
    }
  }

  return { type, payload };
}
