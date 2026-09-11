// Lightweight HTTP health endpoint that runs on a localhost-only port.
// Intentionally minimal: built on Node's built-in `http` module so we don't
// pull Express or any runtime dependency just to expose a few endpoints.
// Endpoints:
//   GET /healthz   -> liveness (process up)
//   GET /readyz    -> readiness (child process up + last health check ok)
//   GET /status    -> minimal public status JSON
//   GET /logs      -> last N KB of stderr tail
//   POST /shutdown -> gracefully stop the supervisor (admin-only)
//
// All interfaces bind to 127.0.0.1 only so this cannot be reached off-host.

import { createServer } from "node:http";
import { createHash, timingSafeEqual } from "node:crypto";

// Empty token disables HTTP administration; it never disables probes.
export function validateHealthServerOptions({ host = "127.0.0.1", adminToken = "" } = {}) {
  if (host !== "127.0.0.1") {
    throw new Error("MCP service health host must be 127.0.0.1.");
  }
  if (typeof adminToken !== "string" ||
      (adminToken !== "" && !/^[A-Za-z0-9._~+\/-]{32,256}$/.test(adminToken))) {
    throw new Error("MCP service admin token must be empty or 32-256 Bearer-safe ASCII characters.");
  }
}

function authorized(req, expectedDigest) {
  let authorization;
  let count = 0;
  for (let i = 0; i < req.rawHeaders.length; i += 2) {
    if (req.rawHeaders[i].toLowerCase() === "authorization") {
      count++;
      authorization = req.rawHeaders[i + 1];
    }
  }
  if (count !== 1 || typeof authorization !== "string") return false;
  const match = /^Bearer ([A-Za-z0-9._~+\/-]{32,256})$/i.exec(authorization);
  if (!match) return false;
  return timingSafeEqual(createHash("sha256").update(match[1]).digest(), expectedDigest);
}

function publicStatus(supervisor) {
  const status = supervisor?.getStatus?.() ?? {};
  const number = (value) => Number.isFinite(value) && value >= 0 ? value : 0;
  return { running: status.running === true, restartCount: number(status.restartCount),
    uptimeMs: number(status.uptimeMs) };
}

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
    serviceVersion = "0.4.9",
    serviceName = "unified-ai-system-mcp-service",
    onShutdown = null,
    adminToken = "",
  } = options;

  validateHealthServerOptions({ host, adminToken });
  const adminDigest = adminToken ? createHash("sha256").update(adminToken).digest() : null;

  let server = null;
  let listening = false;
  let shutdownRequested = false;

  async function handle(req, res) {
    const url = new URL(req.url ?? "/", `http://${host}:${port}`);
    const requiredMethod = url.pathname === "/shutdown" ? "POST" : "GET";
    if (req.method !== requiredMethod) {
      sendText(res, 405, "method not allowed");
      return;
    }
    if (url.pathname === "/healthz") {
      sendJson(res, 200, { status: "ok", service: serviceName, version: serviceVersion });
      return;
    }
    if (url.pathname === "/readyz") {
      const status = publicStatus(supervisor);
      const ready = status.running;
      sendJson(res, ready ? 200 : 503, {
        status: ready ? "ready" : "starting",
        running: ready,
        restartCount: status.restartCount ?? 0,
        uptimeMs: status.uptimeMs ?? 0,
      });
      return;
    }
    if (url.pathname === "/status") {
      sendJson(res, 200, {
        service: serviceName,
        version: serviceVersion,
        ...publicStatus(supervisor),
      });
      return;
    }
    if (url.pathname === "/logs" || url.pathname === "/shutdown") {
      if (!adminDigest) {
        sendJson(res, 503, { error: "HTTP administration is disabled." });
        return;
      }
      if (!authorized(req, adminDigest)) {
        res.setHeader("www-authenticate", "Bearer");
        sendJson(res, 401, { error: "A valid administration Bearer token is required." });
        return;
      }
    }
    if (url.pathname === "/logs") {
      const limits = url.searchParams.getAll("limit");
      const rawLimit = limits[0] ?? "8000";
      if (limits.length > 1 || !/^[1-9]\d{0,4}$/.test(rawLimit) || Number(rawLimit) > 64000) {
        sendJson(res, 400, { error: "limit must be one integer from 1 to 64000." });
        return;
      }
      const limit = Number(rawLimit);
      const tail = (supervisor?.getStatus?.()?.stderrTail ?? "").slice(-limit);
      sendText(res, 200, tail, "text/plain; charset=utf-8");
      return;
    }
    if (url.pathname === "/shutdown" && req.method === "POST") {
      sendJson(res, 202, { status: "shutting_down" });
      if (!shutdownRequested && typeof onShutdown === "function") {
        shutdownRequested = true;
        queueMicrotask(() => {
          Promise.resolve().then(onShutdown).catch(() => {
            logger?.error?.("onShutdown handler failed");
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
