import { spawn } from "node:child_process";
import { once } from "node:events";
import { createServer } from "node:net";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const serviceRoot = resolve(repoRoot, "apps/ai-gateway-service");
const serviceEntrypoint = resolve(serviceRoot, "src/index.js");
const mcpSmokeEntrypoint = resolve(repoRoot, "tools/mcp-smoke.mjs");
const javascriptExampleEntrypoint = resolve(
  repoRoot,
  "docs/examples/javascript-chat.mjs",
);

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

async function runMcpSmoke() {
  let stdout = "";
  let stderr = "";
  const child = spawn(process.execPath, [mcpSmokeEntrypoint, "--json"], {
    cwd: repoRoot,
    windowsHide: true,
    env: {
      ...process.env,
      AI_GATEWAY_PROVIDER_MODE: "fake",
      AI_GATEWAY_REAL_PROVIDER_ENABLED: "false",
      PME_ENTERPRISE_AUTH_ENABLED: "false",
    },
    stdio: ["ignore", "pipe", "pipe"],
  });
  child.stdout.setEncoding("utf8");
  child.stderr.setEncoding("utf8");
  child.stdout.on("data", (chunk) => {
    stdout = `${stdout}${chunk}`.slice(-16_000);
  });
  child.stderr.on("data", (chunk) => {
    stderr = `${stderr}${chunk}`.slice(-8_000);
  });
  const [exitCode] = await once(child, "exit");
  let body;
  try {
    body = JSON.parse(stdout);
  } catch {
    body = {
      ok: false,
      error: "MCP smoke output was not valid JSON.",
      outputTail: `${stdout}\n${stderr}`.trim().slice(-4_000),
    };
  }
  return { exitCode, body };
}

async function runJavaScriptExample(baseUrl) {
  let stdout = "";
  let stderr = "";
  const child = spawn(
    process.execPath,
    [javascriptExampleEntrypoint, "Public clone JavaScript example"],
    {
      cwd: repoRoot,
      windowsHide: true,
      env: {
        ...process.env,
        AI_GATEWAY_SERVICE_URL: baseUrl,
      },
      stdio: ["ignore", "pipe", "pipe"],
    },
  );
  child.stdout.setEncoding("utf8");
  child.stderr.setEncoding("utf8");
  child.stdout.on("data", (chunk) => {
    stdout = `${stdout}${chunk}`.slice(-4_000);
  });
  child.stderr.on("data", (chunk) => {
    stderr = `${stderr}${chunk}`.slice(-4_000);
  });
  const [exitCode] = await once(child, "exit");
  return {
    exitCode,
    stdout: stdout.trim(),
    stderr: stderr.trim(),
  };
}

const mcpSmoke = await runMcpSmoke();
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
  const consoleResponse = await fetch(`${baseUrl}/console`);
  const javascriptExample = await runJavaScriptExample(baseUrl);
  const promptEnhancement = await fetchJson(`${baseUrl}/prompts/enhance`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      input: "Build a Node API with tests",
      profile: "coding",
    }),
  });
  const chat = await fetchJson(`${baseUrl}/chat`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ prompt: "Public clone smoke test" }),
  });
  const enhancedChat = await fetchJson(`${baseUrl}/chat`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      prompt: "Build a Node API with tests",
      promptEnhancement: {
        enabled: true,
        profile: "coding",
      },
    }),
  });
  const enhancedChatStreamResponse = await fetch(`${baseUrl}/chat/stream`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      prompt: "Build a Node API with tests",
      promptEnhancement: {
        enabled: true,
        profile: "coding",
      },
    }),
  });
  const enhancedChatStreamText = await enhancedChatStreamResponse.text();

  const checks = {
    healthReady: health.status === 200 && health.body?.data?.status === "ready",
    setupReady: setup.status === 200 && setup.body?.data?.status === "ready",
    terminalFirstSurface:
      uiResponse.status === 404
      && consoleResponse.status === 404,
    fakeProviderDefault: health.body?.data?.realProviderEnabled === false,
    promptEnhancementReady:
      promptEnhancement.status === 200
      && promptEnhancement.body?.status === "ok"
      && promptEnhancement.body?.data?.original === "Build a Node API with tests"
      && promptEnhancement.body?.data?.profile === "coding"
      && promptEnhancement.body?.data?.enhancedPrompt?.includes("Build a Node API with tests")
      && promptEnhancement.body?.data?.metadata?.providerCalled === false,
    chatReady: chat.status === 200 && chat.body?.success === true && chat.body?.code === "ROUTE_OK",
    chatDefaultEnhancementOff: chat.body?.data?.promptEnhancement === undefined,
    chatUsesFakeProvider:
      chat.body?.data?.executionMode === "fake"
      && chat.body?.data?.selectedProvider === "local-fake-provider",
    enhancedChatReady:
      enhancedChat.status === 200
      && enhancedChat.body?.success === true
      && enhancedChat.body?.data?.promptEnhancement?.applied === true
      && enhancedChat.body?.data?.promptEnhancement?.profile === "coding"
      && enhancedChat.body?.data?.executionMode === "fake"
      && enhancedChat.body?.data?.outputText?.includes("# Execution requirements"),
    enhancedChatStreamReady:
      enhancedChatStreamResponse.status === 200
      && enhancedChatStreamText.includes('"promptEnhancement":{"applied":true')
      && enhancedChatStreamText.includes("# Execution requirements"),
    javascriptExampleReady: javascriptExample.exitCode === 0,
    javascriptExampleUsesFakeProvider:
      javascriptExample.stdout.includes("provider: local-fake-provider")
      && javascriptExample.stdout.includes("mode: fake"),
    mcpStdioReady:
      mcpSmoke.exitCode === 0
      && mcpSmoke.body?.ok === true
      && mcpSmoke.body?.toolCount === 9
      && mcpSmoke.body?.executionMode === "fake"
      && mcpSmoke.body?.managedGatewayCleanedUp === true,
  };

  result = {
    ok: Object.values(checks).every(Boolean),
    port,
    checks,
    realProviderCallsMade: false,
    realProviderEnabled: health.body?.data?.realProviderEnabled ?? null,
    javascriptExample,
    mcp: mcpSmoke.body,
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
