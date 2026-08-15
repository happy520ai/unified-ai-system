import { spawn } from "node:child_process";
import { randomBytes } from "node:crypto";
import { once } from "node:events";
import { createServer } from "node:net";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
const serviceEntrypoint = resolve(
  repoRoot,
  "apps/ai-gateway-service/src/index.js",
);
const STARTUP_TIMEOUT_MS = 30_000;
const OUTPUT_TAIL_LIMIT = 8_000;

function delay(milliseconds) {
  return new Promise((resolvePromise) => {
    setTimeout(resolvePromise, milliseconds);
  });
}

async function findFreePort() {
  const server = createServer();
  server.unref();
  await new Promise((resolvePromise, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolvePromise);
  });
  const address = server.address();
  const port = typeof address === "object" && address ? address.port : null;
  await new Promise((resolvePromise) => server.close(resolvePromise));
  if (!port) throw new Error("Unable to allocate a local MCP gateway port.");
  return port;
}

async function fetchHealth(baseUrl) {
  const response = await fetch(`${baseUrl}/health/check`, {
    redirect: "error",
    signal: AbortSignal.timeout(10_000),
  });
  const body = await response.json();
  if (!response.ok) {
    throw new Error(`Gateway health check failed with HTTP ${response.status}.`);
  }
  return body;
}

async function verifyAuthenticatedSession(baseUrl, requestHeaders) {
  const response = await fetch(`${baseUrl}/enterprise/session`, {
    headers: requestHeaders,
    redirect: "error",
    signal: AbortSignal.timeout(10_000),
  });
  if (!response.ok) {
    throw new Error(`Gateway authentication check failed with HTTP ${response.status}.`);
  }
  const body = await response.json();
  if ((body?.data ?? body)?.authenticated !== true) {
    throw new Error("Gateway authentication check did not return an authenticated session.");
  }
}

function assertFakeProviderRuntime(healthEnvelope) {
  const health = healthEnvelope?.data ?? healthEnvelope;
  if (
    health?.realProviderEnabled !== false
    || health?.providerMode === "real"
  ) {
    throw new Error(
      "MCP startup refused a gateway that may call a real provider.",
    );
  }
}

async function waitForReady(baseUrl, child, requestHeaders) {
  const deadline = Date.now() + STARTUP_TIMEOUT_MS;
  while (Date.now() < deadline) {
    if (child.exitCode !== null) {
      throw new Error(
        `Gateway exited before MCP startup with code ${child.exitCode}.`,
      );
    }
    try {
      const health = await fetchHealth(baseUrl);
      if ((health?.data ?? health)?.status === "ready") {
        assertFakeProviderRuntime(health);
        await verifyAuthenticatedSession(baseUrl, requestHeaders);
        return health;
      }
    } catch {
      // The managed gateway may briefly refuse connections during startup.
    }
    await delay(250);
  }
  throw new Error("Gateway did not become ready for MCP within 30 seconds.");
}

async function stopChild(child) {
  if (!child || child.exitCode !== null) return;
  child.kill("SIGTERM");
  await Promise.race([once(child, "exit"), delay(3_000)]);
  if (child.exitCode === null) {
    child.kill("SIGKILL");
    await Promise.race([once(child, "exit"), delay(2_000)]);
  }
}

function normalizeBaseUrl(value) {
  if (typeof value !== "string" || value.trim().length === 0) return null;
  const url = new URL(value.trim());
  if (!["http:", "https:"].includes(url.protocol)) {
    throw new Error("AI_GATEWAY_MCP_URL must use HTTP or HTTPS.");
  }
  if (url.username || url.password) {
    throw new Error("AI_GATEWAY_MCP_URL must not contain URL credentials.");
  }
  return url.toString().replace(/\/+$/, "");
}

function readGatewayAuthToken(value) {
  const token = typeof value === "string" ? value.trim() : "";
  if (!token) {
    throw new Error("AI_GATEWAY_MCP_AUTH_TOKEN is required for an external gateway.");
  }
  if (token.length < 32) {
    throw new Error("AI_GATEWAY_MCP_AUTH_TOKEN must contain at least 32 characters.");
  }
  return token;
}

function assertSafeGatewayAuthTarget(baseUrl) {
  const url = new URL(baseUrl);
  if (url.protocol === "https:") return;
  if (!new Set(["127.0.0.1", "::1", "[::1]"]).has(url.hostname.toLowerCase())) {
    throw new Error("AI_GATEWAY_MCP_AUTH_TOKEN requires HTTPS for non-loopback gateways.");
  }
}

function createAuthenticatedRuntime(runtime, authToken, tokenSource) {
  const requestHeaders = Object.freeze({ Authorization: `Bearer ${authToken}` });
  Object.defineProperty(runtime, "privateRequestHeaders", {
    configurable: false,
    enumerable: false,
    writable: false,
    value: requestHeaders,
  });
  runtime.gatewayAuth = Object.freeze({
    enabled: true,
    verified: true,
    tokenSource,
    tokenExposed: false,
    leastPrivilegeManaged: tokenSource === "ephemeral-managed",
  });
  return runtime;
}

export async function createGatewayRuntime(options = {}) {
  const env = options.env ?? process.env;
  const externalBaseUrl = normalizeBaseUrl(env.AI_GATEWAY_MCP_URL);

  if (externalBaseUrl) {
    const authToken = readGatewayAuthToken(env.AI_GATEWAY_MCP_AUTH_TOKEN);
    assertSafeGatewayAuthTarget(externalBaseUrl);
    const requestHeaders = Object.freeze({ Authorization: `Bearer ${authToken}` });
    const health = await fetchHealth(externalBaseUrl);
    assertFakeProviderRuntime(health);
    await verifyAuthenticatedSession(externalBaseUrl, requestHeaders);
    return createAuthenticatedRuntime({
      baseUrl: externalBaseUrl,
      managed: false,
      health,
      stop: async () => {},
      killNow: () => {},
      getOutputTail: () => "",
    }, authToken, "environment");
  }

  const port = await findFreePort();
  const baseUrl = `http://127.0.0.1:${port}`;
  const authToken = randomBytes(32).toString("base64url");
  // Ephemeral managed token with no wall-clock expiry. The gateway child process
  // is fake-provider, loopback-only, and killed when the MCP host disconnects, so
  // the token's lifetime is already bounded by the child process itself. A fixed
  // 10-minute expiry broke long-lived MCP hosts (WorkBuddy/Codex) with 401s once
  // the window elapsed and all authenticated tools became unusable.
  const authExpiresAt = null;
  const requestHeaders = Object.freeze({ Authorization: `Bearer ${authToken}` });
  let stdout = "";
  let stderr = "";
  const child = (options.spawnProcess ?? spawn)(
    process.execPath,
    [serviceEntrypoint],
    {
      cwd: repoRoot,
      windowsHide: true,
      env: {
        ...env,
        AI_GATEWAY_SERVICE_HOST: "127.0.0.1",
        AI_GATEWAY_SERVICE_PORT: String(port),
        AI_GATEWAY_PROVIDER_MODE: "fake",
        AI_GATEWAY_REAL_PROVIDER_ENABLED: "false",
        AI_GATEWAY_ROUTE_MODE: "registry-default",
        AI_GATEWAY_DEFAULT_PROVIDER: "local-fake-provider",
        AI_GATEWAY_DEFAULT_MODEL: "local-fake-model",
        AI_GATEWAY_ENABLED_PROVIDERS:
          "local-fake-provider,backup-fake-provider",
        PME_ENTERPRISE_AUTH_ENABLED: "true",
        PME_AUTH_TOKEN: "",
        PME_ENTERPRISE_USERS_JSON: JSON.stringify([{
          token: authToken,
          userId: "managed-mcp",
          tenantId: "managed-mcp",
          role: "operator",
          permissions: [
            "session:read",
            "dashboard:read",
            "chat:use",
            "knowledge:read",
            "workflow:run",
          ],
          expiresAt: authExpiresAt,
        }]),
      },
      stdio: ["ignore", "pipe", "pipe"],
    },
  );

  child.stdout?.setEncoding("utf8");
  child.stderr?.setEncoding("utf8");
  child.stdout?.on("data", (chunk) => {
    stdout = `${stdout}${chunk}`.slice(-OUTPUT_TAIL_LIMIT);
  });
  child.stderr?.on("data", (chunk) => {
    stderr = `${stderr}${chunk}`.slice(-OUTPUT_TAIL_LIMIT);
  });

  try {
    const health = await waitForReady(baseUrl, child, requestHeaders);
    return createAuthenticatedRuntime({
      baseUrl,
      managed: true,
      health,
      child,
      stop: () => stopChild(child),
      killNow: () => {
        if (child.exitCode === null) child.kill("SIGTERM");
      },
      getOutputTail: () => `${stdout}\n${stderr}`.trim(),
    }, authToken, "ephemeral-managed");
  } catch (error) {
    await stopChild(child);
    const outputTail = `${stdout}\n${stderr}`.trim().slice(-2_000);
    if (outputTail) {
      error.message = `${error.message}\nGateway output:\n${outputTail}`;
    }
    throw error;
  }
}

export const mcpRuntimeInternals = {
  assertFakeProviderRuntime,
  assertSafeGatewayAuthTarget,
  normalizeBaseUrl,
  readGatewayAuthToken,
};
