import { spawn } from "node:child_process";
import { once } from "node:events";
import { createServer } from "node:net";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const serviceRoot = resolve(repoRoot, "apps/ai-gateway-service");
const serviceEntrypoint = resolve(serviceRoot, "src/index.js");

function delay(milliseconds) {
  return new Promise((resolvePromise) => setTimeout(resolvePromise, milliseconds));
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
  if (!port) throw new Error("Unable to allocate a local test port.");
  return port;
}

async function fetchJson(url, options) {
  const response = await fetch(url, options);
  const text = await response.text();
  let body = null;
  try {
    body = JSON.parse(text);
  } catch {
    body = { raw: text.slice(0, 500) };
  }
  return { status: response.status, body };
}

async function waitForReady(baseUrl, child) {
  const deadline = Date.now() + 30_000;
  while (Date.now() < deadline) {
    if (child.exitCode !== null) {
      throw new Error(`Gateway exited before becoming ready with code ${child.exitCode}.`);
    }
    try {
      const health = await fetchJson(`${baseUrl}/health/check`);
      if (health.status === 200) return health;
    } catch {
      // Startup can briefly refuse connections.
    }
    await delay(300);
  }
  throw new Error("Gateway did not become ready within 30 seconds.");
}

async function stopChild(child) {
  if (child.exitCode !== null) return;
  child.kill("SIGTERM");
  await Promise.race([once(child, "exit"), delay(3_000)]);
  if (child.exitCode === null) {
    child.kill("SIGKILL");
    await Promise.race([once(child, "exit"), delay(2_000)]);
  }
}

const port = await findFreePort();
const baseUrl = `http://127.0.0.1:${port}`;
let stdout = "";
let stderr = "";
const child = spawn(process.execPath, [serviceEntrypoint], {
  cwd: serviceRoot,
  windowsHide: true,
  env: {
    ...process.env,
    AI_GATEWAY_SERVICE_HOST: "127.0.0.1",
    AI_GATEWAY_SERVICE_PORT: String(port),
    AI_GATEWAY_PROVIDER_MODE: "fake",
    AI_GATEWAY_REAL_PROVIDER_ENABLED: "false",
    AI_GATEWAY_ROUTE_MODE: "registry-default",
    AI_GATEWAY_DEFAULT_PROVIDER: "local-fake-provider",
    AI_GATEWAY_DEFAULT_MODEL: "local-fake-model",
    AI_GATEWAY_ENABLED_PROVIDERS: "local-fake-provider,backup-fake-provider",
    PME_ENTERPRISE_AUTH_ENABLED: "false",
  },
  stdio: ["ignore", "pipe", "pipe"],
});

child.stdout.setEncoding("utf8");
child.stderr.setEncoding("utf8");
child.stdout.on("data", (chunk) => {
  stdout = `${stdout}${chunk}`.slice(-8_000);
});
child.stderr.on("data", (chunk) => {
  stderr = `${stderr}${chunk}`.slice(-8_000);
});

let result;
try {
  const health = await waitForReady(baseUrl, child);
  const setup = await fetchJson(`${baseUrl}/setup/readiness`);
  const uiResponse = await fetch(`${baseUrl}/ui`);
  const uiText = await uiResponse.text();
  const chat = await fetchJson(`${baseUrl}/chat`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ prompt: "Public clone smoke test" }),
  });

  const checks = {
    healthReady: health.status === 200 && health.body?.data?.status === "ready",
    setupReady: setup.status === 200 && setup.body?.data?.status === "ready",
    uiReady: uiResponse.status === 200 && /AI Gateway Workbench/i.test(uiText),
    fakeProviderDefault: health.body?.data?.realProviderEnabled === false,
    chatReady: chat.status === 200 && chat.body?.success === true && chat.body?.code === "ROUTE_OK",
    chatUsesFakeProvider:
      chat.body?.data?.executionMode === "fake"
      && chat.body?.data?.selectedProvider === "local-fake-provider",
  };

  result = {
    ok: Object.values(checks).every(Boolean),
    port,
    checks,
    realProviderCallsMade: false,
    realProviderEnabled: health.body?.data?.realProviderEnabled ?? null,
  };
  if (!result.ok) process.exitCode = 1;
} catch (error) {
  result = {
    ok: false,
    port,
    error: error.message,
    realProviderCallsMade: false,
    outputTail: `${stdout}\n${stderr}`.trim().slice(-4_000),
  };
  process.exitCode = 1;
} finally {
  await stopChild(child);
}

process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
