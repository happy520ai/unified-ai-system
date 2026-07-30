import { spawn } from "node:child_process";
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
    signal: AbortSignal.timeout(10_000),
  });
  const body = await response.json();
  if (!response.ok) {
    throw new Error(`Gateway health check failed with HTTP ${response.status}.`);
  }
  return body;
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

async function waitForReady(baseUrl, child) {
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
  return url.toString().replace(/\/+$/, "");
}

export async function createGatewayRuntime(options = {}) {
  const env = options.env ?? process.env;
  const externalBaseUrl = normalizeBaseUrl(env.AI_GATEWAY_MCP_URL);

  if (externalBaseUrl) {
    const health = await fetchHealth(externalBaseUrl);
    assertFakeProviderRuntime(health);
    return {
      baseUrl: externalBaseUrl,
      managed: false,
      health,
      stop: async () => {},
      killNow: () => {},
      getOutputTail: () => "",
    };
  }

  const port = await findFreePort();
  const baseUrl = `http://127.0.0.1:${port}`;
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
        PME_ENTERPRISE_AUTH_ENABLED: "false",
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
    const health = await waitForReady(baseUrl, child);
    return {
      baseUrl,
      managed: true,
      health,
      child,
      stop: () => stopChild(child),
      killNow: () => {
        if (child.exitCode === null) child.kill("SIGTERM");
      },
      getOutputTail: () => `${stdout}\n${stderr}`.trim(),
    };
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
  normalizeBaseUrl,
};
