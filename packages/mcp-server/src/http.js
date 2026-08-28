import { createHash, timingSafeEqual } from "node:crypto";
import { once } from "node:events";
import { createServer } from "node:http";
import { createMcpHandler } from "@modelcontextprotocol/server";
import {
  hostHeaderValidation,
  localhostHostValidation,
  localhostOriginValidation,
  originValidation,
  toNodeHandler,
} from "@modelcontextprotocol/node";
import { createGatewayRuntime } from "./runtime.js";
import { createUnifiedAiMcpServer } from "./server.js";

const DEFAULT_HOST = "127.0.0.1";
const DEFAULT_PORT = 3210;
const DEFAULT_PATH = "/mcp";
const MIN_REMOTE_TOKEN_BYTES = 32;
const LOOPBACK_HOSTS = new Set(["127.0.0.1", "::1", "[::1]", "localhost"]);
const MCP_CORS_REQUEST_HEADERS = [
  "Authorization",
  "Content-Type",
  "Mcp-Protocol-Version",
  "Mcp-Session-Id",
  "Mcp-Method",
  "Mcp-Name",
  "Last-Event-ID",
];

function isLoopbackHost(host) {
  return LOOPBACK_HOSTS.has(String(host).trim().toLowerCase());
}

function parseCsv(value) {
  if (typeof value !== "string") return [];
  return [...new Set(value.split(",").map((item) => item.trim()).filter(Boolean))];
}

function parsePort(value, { allowZero = false } = {}) {
  const port = Number(value);
  const minimum = allowZero ? 0 : 1;
  if (!Number.isInteger(port) || port < minimum || port > 65_535) {
    throw new Error(
      `MCP_HTTP_PORT must be an integer between ${minimum} and 65535.`,
    );
  }
  return port;
}

function normalizePath(value) {
  const path = String(value ?? DEFAULT_PATH).trim();
  if (!path.startsWith("/") || path.includes("?") || path.includes("#")) {
    throw new Error("MCP_HTTP_PATH must be an absolute URL path.");
  }
  return path.length > 1 ? path.replace(/\/+$/, "") : path;
}

function readOverride(overrides, key, fallback) {
  return Object.hasOwn(overrides, key) ? overrides[key] : fallback;
}

export function resolveMcpHttpConfig(env = process.env, overrides = {}) {
  const host = String(
    readOverride(overrides, "host", env.MCP_HTTP_HOST ?? DEFAULT_HOST),
  ).trim();
  if (!host) throw new Error("MCP_HTTP_HOST cannot be empty.");

  const hasPortOverride = Object.hasOwn(overrides, "port");
  const port = parsePort(
    hasPortOverride ? overrides.port : env.MCP_HTTP_PORT ?? DEFAULT_PORT,
    { allowZero: hasPortOverride },
  );
  const path = normalizePath(
    readOverride(overrides, "path", env.MCP_HTTP_PATH ?? DEFAULT_PATH),
  );
  const authToken = String(
    readOverride(overrides, "authToken", env.MCP_HTTP_AUTH_TOKEN ?? ""),
  );
  const localOnly = isLoopbackHost(host);
  const allowedHostnames = parseCsv(
    readOverride(overrides, "allowedHostnames", env.MCP_HTTP_ALLOWED_HOSTS ?? ""),
  );
  const allowedOriginHostnames = parseCsv(
    readOverride(
      overrides,
      "allowedOriginHostnames",
      env.MCP_HTTP_ALLOWED_ORIGINS ?? "",
    ),
  );

  if (!localOnly) {
    if (Buffer.byteLength(authToken, "utf8") < MIN_REMOTE_TOKEN_BYTES) {
      throw new Error(
        `Remote MCP HTTP requires MCP_HTTP_AUTH_TOKEN with at least ${MIN_REMOTE_TOKEN_BYTES} bytes.`,
      );
    }
    if (allowedHostnames.length === 0) {
      throw new Error(
        "Remote MCP HTTP requires MCP_HTTP_ALLOWED_HOSTS with explicit hostnames.",
      );
    }
    if (allowedOriginHostnames.length === 0) {
      throw new Error(
        "Remote MCP HTTP requires MCP_HTTP_ALLOWED_ORIGINS with explicit origin hostnames.",
      );
    }
  }

  return Object.freeze({
    host,
    port,
    path,
    authToken,
    authRequired: !localOnly || authToken.length > 0,
    localOnly,
    allowedHostnames,
    allowedOriginHostnames,
  });
}

function getHeader(headers, name) {
  const value = headers[name];
  return Array.isArray(value) ? value[0] : value;
}

function tokensMatch(actual, expected) {
  const actualDigest = createHash("sha256").update(actual).digest();
  const expectedDigest = createHash("sha256").update(expected).digest();
  return timingSafeEqual(actualDigest, expectedDigest);
}

function authorizeRequest(req, config) {
  if (!config.authRequired) return true;
  const authorization = getHeader(req.headers, "authorization");
  const match = typeof authorization === "string"
    ? /^Bearer\s+(.+)$/i.exec(authorization)
    : null;
  return Boolean(match && tokensMatch(match[1], config.authToken));
}

function writeJson(res, statusCode, payload, headers = {}) {
  res.writeHead(statusCode, {
    "content-type": "application/json; charset=utf-8",
    ...headers,
  });
  res.end(`${JSON.stringify(payload)}\n`);
}

function setCorsHeaders(req, res) {
  const origin = getHeader(req.headers, "origin");
  if (!origin) return;
  const requestedHeaders = String(
    getHeader(req.headers, "access-control-request-headers") ?? "",
  )
    .split(",")
    .map((header) => header.trim())
    .filter((header) => /^mcp-param-[a-z0-9-]+$/i.test(header));
  res.setHeader("access-control-allow-origin", origin);
  res.setHeader("vary", "Origin");
  res.setHeader(
    "access-control-allow-headers",
    [...new Set([...MCP_CORS_REQUEST_HEADERS, ...requestedHeaders])].join(", "),
  );
  res.setHeader("access-control-allow-methods", "GET, POST, DELETE, OPTIONS");
  res.setHeader(
    "access-control-expose-headers",
    "Mcp-Protocol-Version, Mcp-Session-Id, Mcp-Method, Mcp-Name",
  );
}

function endpointFor(config, actualPort) {
  const bracketedHost = config.host.includes(":") && !config.host.startsWith("[")
    ? `[${config.host}]`
    : config.host;
  return `http://${bracketedHost}:${actualPort}${config.path}`;
}

export async function startMcpHttpServer(options = {}) {
  const config = resolveMcpHttpConfig(options.env, options);
  const ownsRuntime = !options.runtime;
  const runtime = options.runtime ?? await createGatewayRuntime({ env: options.env });
  const onerror = options.onerror ?? (() => {});
  const handler = createMcpHandler(
    () => createUnifiedAiMcpServer(runtime),
    { onerror },
  );
  const nodeHandler = toNodeHandler(handler, { onerror });
  const validateHost = config.localOnly
    ? localhostHostValidation()
    : hostHeaderValidation(config.allowedHostnames);
  const validateOrigin = config.localOnly
    ? localhostOriginValidation()
    : originValidation(config.allowedOriginHostnames);

  const httpServer = createServer((req, res) => {
    void (async () => {
      if (!validateHost(req, res) || !validateOrigin(req, res)) return;
      setCorsHeaders(req, res);
      const requestUrl = new URL(req.url ?? "/", "http://mcp.invalid");
      if (requestUrl.pathname !== config.path) {
        writeJson(res, 404, {
          error: { code: "MCP_HTTP_NOT_FOUND", message: "MCP endpoint not found." },
        });
        return;
      }
      if (req.method === "OPTIONS") {
        res.writeHead(204);
        res.end();
        return;
      }
      if (!authorizeRequest(req, config)) {
        writeJson(
          res,
          401,
          {
            error: {
              code: "MCP_HTTP_UNAUTHORIZED",
              message: "A valid Bearer token is required.",
            },
          },
          { "www-authenticate": "Bearer" },
        );
        return;
      }
      if (config.authRequired) {
        req.auth = {
          token: config.authToken,
          clientId: "mcp-http-client",
          scopes: ["mcp:tools"],
        };
      }
      await nodeHandler(req, res);
    })().catch((error) => {
      onerror(error);
      if (!res.headersSent) {
        writeJson(res, 500, {
          error: {
            code: "MCP_HTTP_INTERNAL_ERROR",
            message: "The MCP HTTP request failed.",
          },
        });
      } else if (!res.writableEnded) {
        res.end();
      }
    });
  });

  let stopped = false;
  async function stop() {
    if (stopped) return;
    stopped = true;
    await handler.close();
    if (httpServer.listening) {
      const closed = once(httpServer, "close");
      httpServer.close();
      httpServer.closeAllConnections?.();
      await closed;
    }
    if (ownsRuntime) await runtime.stop();
  }

  try {
    await new Promise((resolvePromise, reject) => {
      httpServer.once("error", reject);
      httpServer.listen(config.port, config.host, resolvePromise);
    });
  } catch (error) {
    await handler.close();
    if (ownsRuntime) await runtime.stop();
    throw error;
  }

  const address = httpServer.address();
  const actualPort = typeof address === "object" && address ? address.port : config.port;
  return {
    config: Object.freeze({ ...config, port: actualPort }),
    endpoint: endpointFor(config, actualPort),
    runtime,
    stop,
    killNow() {
      httpServer.closeAllConnections?.();
      httpServer.close();
      if (ownsRuntime) runtime.killNow();
    },
  };
}

export const mcpHttpInternals = {
  authorizeRequest,
  isLoopbackHost,
  normalizePath,
  parseCsv,
  parsePort,
  tokensMatch,
};
