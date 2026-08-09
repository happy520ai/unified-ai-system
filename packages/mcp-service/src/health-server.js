// Lightweight HTTP health endpoint that runs on a localhost-only port.
// Intentionally minimal: built on Node's built-in `http` module so we don't
// pull Express or any runtime dependency just to expose a few endpoints.
// Endpoints:
//   GET /healthz   -> liveness (process up)
//   GET /readyz    -> readiness (child process up + last health check ok)
//   GET /status    -> full status JSON
//   GET /logs      -> last N KB of stderr tail
//   POST /shutdown -> gracefully stop the supervisor (admin-only)
//
// All interfaces bind to 127.0.0.1 only so this cannot be reached off-host.

import { createServer } from "node:http";

function sendJson(res, code, body) {
  const payload = Buffer.from(JSON.stringify(body, null, 2));
  res.writeHead(code, {
    "content-type": "application/json; charset=utf-8",
    "content-length": payload.length,
    "cache-control": "no-store",
  });
  res.end(payload);
}

function sendText(res, code, text, contentType = "text/plain; charset=utf-8") {
  const payload = Buffer.from(text);
  res.writeHead(code, {
    "content-type": contentType,
    "content-length": payload.length,
    "cache-control": "no-store",
  });
  res.end(payload);
}

export function createHealthServer(options = {}) {
  const {
    host = "127.0.0.1",
    port = Number(process.env.MCP_SERVICE_HEALTH_PORT ?? 7788),
    supervisor,
    logger,
    serviceVersion = "0.4.6",
    serviceName = "unified-ai-system-mcp-service",
    onShutdown = null,
  } = options;

  let server = null;
  let listening = false;

  async function handle(req, res) {
    const url = new URL(req.url ?? "/", `http://${host}:${port}`);
    if (req.method !== "GET" && req.method !== "POST") {
      sendText(res, 405, "method not allowed");
      return;
    }
    if (url.pathname === "/healthz") {
      sendJson(res, 200, { status: "ok", service: serviceName, version: serviceVersion });
      return;
    }
    if (url.pathname === "/readyz") {
      const status = supervisor?.getStatus?.() ?? {};
      const ready = !!status.running;
      sendJson(res, ready ? 200 : 503, {
        status: ready ? "ready" : "starting",
        running: ready,
        restartCount: status.restartCount ?? 0,
        uptimeMs: status.uptimeMs ?? 0,
      });
      return;
    }
    if (url.pathname === "/status") {
      const status = supervisor?.getStatus?.() ?? {};
      sendJson(res, 200, {
        service: serviceName,
        version: serviceVersion,
        ...status,
      });
      return;
    }
    if (url.pathname === "/logs") {
      const limit = Number(url.searchParams.get("limit") ?? 8000);
      const tail = (supervisor?.getStatus?.()?.stderrTail ?? "").slice(-limit);
      sendText(res, 200, tail, "text/plain; charset=utf-8");
      return;
    }
    if (url.pathname === "/shutdown" && req.method === "POST") {
      sendJson(res, 202, { status: "shutting_down" });
      if (typeof onShutdown === "function") {
        queueMicrotask(() => {
          Promise.resolve(onShutdown()).catch((error) => {
            logger?.error?.("onShutdown handler failed", { message: error.message });
          });
        });
      }
      return;
    }
    sendText(res, 404, "not found");
  }

  async function listen() {
    if (server) return;
    server = createServer((req, res) => {
      Promise.resolve(handle(req, res)).catch((error) => {
        logger?.error?.("health endpoint failed", { message: error.message });
        try {
          sendText(res, 500, "internal error");
        } catch {
          // ignore
        }
      });
    });
    server.once("error", (error) => {
      logger?.error?.("health server error", { message: error.message });
    });
    await new Promise((resolve, reject) => {
      server.once("listening", () => {
        listening = true;
        resolve();
      });
      server.once("error", reject);
      server.listen(port, host);
    });
    logger?.info?.("health server listening", { host, port });
  }

  async function close() {
    if (!server) return;
    const closed = new Promise((resolve) => {
      server.close(() => resolve());
      server.closeAllConnections?.();
    });
    server = null;
    listening = false;
    await closed;
  }

  function isListening() {
    return listening;
  }

  function address() {
    if (!server) return null;
    const addr = server.address();
    return addr && typeof addr === "object" ? addr : null;
  }

  return {
    listen,
    close,
    isListening,
    address,
  };
}

export const healthServerInternals = {
  sendJson,
  sendText,
};
