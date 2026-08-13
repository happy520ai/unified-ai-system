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
const sharedSdkExampleEntrypoint = resolve(
  repoRoot,
  "docs/examples/shared-sdk-prompt-enhancement.mjs",
);
const openAiSdkExampleEntrypoint = resolve(
  repoRoot,
  "docs/examples/openai-sdk-chat.mjs",
);
const anthropicSdkExampleEntrypoint = resolve(
  repoRoot,
  "docs/examples/anthropic-sdk-messages.mjs",
);
const a2aSdkExampleEntrypoint = resolve(
  repoRoot,
  "docs/examples/a2a-sdk-client.mjs",
);
const ISSUE_SOURCE = "verify-public-clone";

function normalizeIssueCode(raw) {
  const slug = String(raw ?? "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
  return slug.length === 0 ? "unknown_issue" : slug;
}

function normalizeSeverity(raw) {
  const normalized = String(raw ?? "").toLowerCase();
  if (["high", "medium", "low", "info", "unknown"].includes(normalized)) {
    return normalized;
  }
  return "unknown";
}

function summarizeIssueCodes(issueCodes) {
  const summary = {
    total: 0,
    high: 0,
    medium: 0,
    low: 0,
    info: 0,
    unknown: 0,
    blocking: false,
  };
  if (!Array.isArray(issueCodes)) return summary;
  for (const issue of issueCodes) {
    const severity = normalizeSeverity(issue?.severity);
    if (severity === "high") summary.high += 1;
    else if (severity === "medium") summary.medium += 1;
    else if (severity === "low") summary.low += 1;
    else if (severity === "info") summary.info += 1;
    else summary.unknown += 1;
    summary.total += 1;
  }
  summary.blocking = summary.high > 0;
  return summary;
}

function createIssueCode(code, message, severity = "high", artifactPath = null) {
  return {
    code: normalizeIssueCode(code),
    severity: normalizeSeverity(severity),
    message,
    artifactPath,
    source: ISSUE_SOURCE,
  };
}

const CHECK_ISSUE_CATALOG = {
  healthReady: {
    code: "public_clone_health_not_ready",
    severity: "high",
    message: "Gateway health check endpoint did not return ready status.",
    artifactPath: "/health/check",
  },
  setupReady: {
    code: "public_clone_setup_readiness_failed",
    severity: "high",
    message: "Gateway readiness setup probe did not return ready status.",
    artifactPath: "/setup/readiness",
  },
  terminalFirstSurface: {
    code: "public_clone_terminal_first_surface_not_gated",
    severity: "medium",
    message: "Terminal-first surfaces were unexpectedly available.",
    artifactPath: "terminal-first pages",
  },
  fakeProviderDefault: {
    code: "public_clone_fake_provider_default_missing",
    severity: "high",
    message: "Gateway did not start with fake-provider default mode.",
    artifactPath: "/health/check",
  },
  promptEnhancementReady: {
    code: "public_clone_prompt_enhancement_invalid",
    severity: "high",
    message: "Prompt-enhancement endpoint did not return expected deterministic result.",
    artifactPath: "/prompts/enhance",
  },
  chatReady: {
    code: "public_clone_chat_invalid",
    severity: "high",
    message: "Chat endpoint did not return a valid success envelope.",
    artifactPath: "/chat",
  },
  chatDefaultEnhancementOff: {
    code: "public_clone_chat_default_enhancement_enabled",
    severity: "low",
    message: "Chat default request unexpectedly had promptEnhancement in response.",
    artifactPath: "/chat",
  },
  chatUsesFakeProvider: {
    code: "public_clone_chat_non_fake_provider",
    severity: "high",
    message: "Chat endpoint did not route to local fake provider.",
    artifactPath: "/chat",
  },
  enhancedChatReady: {
    code: "public_clone_enhanced_chat_failed",
    severity: "high",
    message: "Enhanced chat request did not apply prompt enhancement as expected.",
    artifactPath: "/chat",
  },
  enhancedChatStreamReady: {
    code: "public_clone_enhanced_chat_stream_invalid",
    severity: "high",
    message: "Enhanced streaming chat response did not include expected SSE body.",
    artifactPath: "/chat/stream",
  },
  streamingChatReady: {
    code: "public_clone_stream_chat_invalid",
    severity: "high",
    message: "Streaming chat endpoint did not emit the expected SSE events.",
    artifactPath: "/chat/stream",
  },
  openAiModelsReady: {
    code: "public_clone_openai_models_invalid",
    severity: "high",
    message: "OpenAI-compatible models endpoint missing local fake model.",
    artifactPath: "/v1/models",
  },
  openAiChatReady: {
    code: "public_clone_openai_chat_invalid",
    severity: "high",
    message: "OpenAI-compatible chat endpoint did not return expected success response.",
    artifactPath: "/v1/chat/completions",
  },
  openAiChatUsesFakeProvider: {
    code: "public_clone_openai_chat_non_fake_provider",
    severity: "high",
    message: "OpenAI-compatible chat response did not indicate fake provider execution.",
    artifactPath: "/v1/chat/completions",
  },
  enhancedOpenAiChatReady: {
    code: "public_clone_openai_enhanced_chat_invalid",
    severity: "high",
    message: "Enhanced OpenAI-compatible chat did not apply prompt enhancement.",
    artifactPath: "/v1/chat/completions",
  },
  openAiChatStreamReady: {
    code: "public_clone_openai_stream_invalid",
    severity: "high",
    message: "OpenAI-compatible streaming chat endpoint did not return expected chunked format.",
    artifactPath: "/v1/chat/completions",
  },
  javascriptExampleReady: {
    code: "public_clone_javascript_example_exit_nonzero",
    severity: "medium",
    message: "JavaScript smoke example exited non-zero.",
    artifactPath: "docs/examples/javascript-chat.mjs",
  },
  javascriptExampleUsesFakeProvider: {
    code: "public_clone_javascript_example_non_fake_provider",
    severity: "high",
    message: "JavaScript smoke example did not prove fake provider path.",
    artifactPath: "docs/examples/javascript-chat.mjs",
  },
  sharedSdkExampleReady: {
    code: "public_clone_shared_sdk_invalid",
    severity: "high",
    message: "Shared SDK example did not return expected deterministic fake metadata.",
    artifactPath: "docs/examples/shared-sdk-prompt-enhancement.mjs",
  },
  officialOpenAiSdkReady: {
    code: "public_clone_openai_sdk_invalid",
    severity: "high",
    message: "Official OpenAI SDK compatibility example did not pass all checks.",
    artifactPath: "docs/examples/openai-sdk-chat.mjs",
  },
  officialAnthropicSdkReady: {
    code: "public_clone_anthropic_sdk_invalid",
    severity: "high",
    message: "Official Anthropic SDK compatibility example did not pass all checks.",
    artifactPath: "docs/examples/anthropic-sdk-messages.mjs",
  },
  officialA2ASdkReady: {
    code: "public_clone_a2a_sdk_invalid",
    severity: "high",
    message: "A2A SDK compatibility example did not pass all checks.",
    artifactPath: "docs/examples/a2a-sdk-client.mjs",
  },
  mcpStdioReady: {
    code: "public_clone_mcp_smoke_invalid",
    severity: "high",
    message: "MCP smoke validation failed.",
    artifactPath: "tools/mcp-smoke.mjs",
  },
};

function buildIssueCodesFromChecks(checks) {
  if (!checks || typeof checks !== "object") return [];
  const issueCodes = [];
  const seen = new Set();
  for (const [check, passed] of Object.entries(checks)) {
    if (passed) continue;
    const rule = CHECK_ISSUE_CATALOG[check];
    if (!rule) continue;
    const code = normalizeIssueCode(rule.code);
    const key = `${code}:${rule.severity}`;
    if (seen.has(key)) continue;
    seen.add(key);
    issueCodes.push(
      createIssueCode(code, `${rule.message} (${check}=${String(passed)})`, rule.severity, rule.artifactPath),
    );
  }
  return issueCodes;
}

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

async function runSharedSdkExample(baseUrl) {
  let stdout = "";
  let stderr = "";
  const child = spawn(
    process.execPath,
    [
      sharedSdkExampleEntrypoint,
      "Build a Node API with tests",
      "--profile",
      "coding",
      "--language",
      "en",
    ],
    {
      cwd: repoRoot,
      windowsHide: true,
      env: {
        ...process.env,
        AI_GATEWAY_BASE_URL: baseUrl,
      },
      stdio: ["ignore", "pipe", "pipe"],
    },
  );
  child.stdout.setEncoding("utf8");
  child.stderr.setEncoding("utf8");
  child.stdout.on("data", (chunk) => {
    stdout = `${stdout}${chunk}`.slice(-8_000);
  });
  child.stderr.on("data", (chunk) => {
    stderr = `${stderr}${chunk}`.slice(-4_000);
  });
  const [exitCode] = await once(child, "exit");
  let body = null;
  try {
    body = JSON.parse(stdout);
  } catch {
    // The checks below report the captured output when the example is invalid.
  }
  return {
    exitCode,
    body,
    stdout: stdout.trim(),
    stderr: stderr.trim(),
  };
}

async function runOpenAiSdkExample(baseUrl) {
  let stdout = "";
  let stderr = "";
  const child = spawn(process.execPath, [openAiSdkExampleEntrypoint], {
    cwd: repoRoot,
    windowsHide: true,
    env: {
      ...process.env,
      AI_GATEWAY_SERVICE_URL: baseUrl,
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
  let body = null;
  try {
    body = JSON.parse(stdout);
  } catch {
    // The checks below report the captured output when the example is invalid.
  }
  return {
    exitCode,
    body,
    stdout: stdout.trim(),
    stderr: stderr.trim(),
  };
}

async function runAnthropicSdkExample(baseUrl) {
  let stdout = "";
  let stderr = "";
  const child = spawn(process.execPath, [anthropicSdkExampleEntrypoint], {
    cwd: repoRoot,
    windowsHide: true,
    env: {
      ...process.env,
      AI_GATEWAY_SERVICE_URL: baseUrl,
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
  let body = null;
  try {
    body = JSON.parse(stdout);
  } catch {
    // The checks below report the captured output when the example is invalid.
  }
  return {
    exitCode,
    body,
    stdout: stdout.trim(),
    stderr: stderr.trim(),
  };
}

async function runA2ASdkExample(baseUrl) {
  let stdout = "";
  let stderr = "";
  const child = spawn(process.execPath, [a2aSdkExampleEntrypoint], {
    cwd: repoRoot,
    windowsHide: true,
    env: {
      ...process.env,
      AI_GATEWAY_SERVICE_URL: baseUrl,
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
  let body = null;
  try {
    body = JSON.parse(stdout);
  } catch {
    // The checks below report the captured output when the example is invalid.
  }
  return {
    exitCode,
    body,
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
  const sharedSdkExample = await runSharedSdkExample(baseUrl);
  const openAiSdkExample = await runOpenAiSdkExample(baseUrl);
  const anthropicSdkExample = await runAnthropicSdkExample(baseUrl);
  const a2aSdkExample = await runA2ASdkExample(baseUrl);
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
  const streamingChatResponse = await fetch(`${baseUrl}/chat/stream`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      prompt: "Say hello in one short sentence",
      providerId: "local-fake-provider",
      model: "local-fake-model",
    }),
  });
  const streamingChatText = await streamingChatResponse.text();
  const openAiModels = await fetchJson(`${baseUrl}/v1/models`);
  const openAiChat = await fetchJson(`${baseUrl}/v1/chat/completions`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      model: "local-fake-model",
      messages: [{ role: "user", content: "OpenAI-compatible public clone test" }],
    }),
  });
  const enhancedOpenAiChat = await fetchJson(`${baseUrl}/v1/chat/completions`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      model: "local-fake-model",
      messages: [{ role: "user", content: "Build a Node API with tests" }],
      unified_ai: {
        prompt_enhancement: { enabled: true, profile: "coding", language: "en" },
      },
    }),
  });
  const openAiStreamResponse = await fetch(`${baseUrl}/v1/chat/completions`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      model: "local-fake-model",
      messages: [{ role: "user", content: "Stream through the compatibility API" }],
      stream: true,
    }),
  });
  const openAiStreamText = await openAiStreamResponse.text();

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
    streamingChatReady:
      streamingChatResponse.status === 200
      && streamingChatText.includes("event: start")
      && streamingChatText.includes("event: chunk")
      && streamingChatText.includes("event: done")
      && streamingChatText.includes('"selectedProvider":"local-fake-provider"')
      && streamingChatText.includes('"executionMode":"fake"')
      && streamingChatText.includes('"executionStatus":"success"')
      && streamingChatText.includes("Say hello in one short sentence"),
    openAiModelsReady:
      openAiModels.status === 200
      && openAiModels.body?.object === "list"
      && openAiModels.body?.data?.some((model) =>
        model.id === "local-fake-model"
        && model.owned_by === "local-fake-provider"
        && model.unified_ai?.execution_mode === "fake"
      ),
    openAiChatReady:
      openAiChat.status === 200
      && openAiChat.body?.object === "chat.completion"
      && openAiChat.body?.model === "local-fake-model"
      && openAiChat.body?.choices?.[0]?.message?.role === "assistant"
      && openAiChat.body?.choices?.[0]?.message?.content?.includes("OpenAI-compatible public clone test")
      && openAiChat.body?.choices?.[0]?.finish_reason === "stop",
    openAiChatUsesFakeProvider:
      openAiChat.body?.unified_ai?.selected_provider === "local-fake-provider"
      && openAiChat.body?.unified_ai?.execution_mode === "fake"
      && openAiChat.body?.unified_ai?.execution_status === "success",
    enhancedOpenAiChatReady:
      enhancedOpenAiChat.status === 200
      && enhancedOpenAiChat.body?.unified_ai?.prompt_enhancement?.applied === true
      && enhancedOpenAiChat.body?.unified_ai?.prompt_enhancement?.profile === "coding"
      && enhancedOpenAiChat.body?.choices?.[0]?.message?.content?.includes("# Execution requirements"),
    openAiChatStreamReady:
      openAiStreamResponse.status === 200
      && openAiStreamText.includes('"object":"chat.completion.chunk"')
      && openAiStreamText.includes('"delta":{"role":"assistant","content":""}')
      && openAiStreamText.includes('"selected_provider":"local-fake-provider"')
      && openAiStreamText.includes('"execution_mode":"fake"')
      && openAiStreamText.includes('"finish_reason":"stop"')
      && openAiStreamText.endsWith("data: [DONE]\n\n")
      && !openAiStreamText.includes("event:"),
    javascriptExampleReady: javascriptExample.exitCode === 0,
    javascriptExampleUsesFakeProvider:
      javascriptExample.stdout.includes("provider: local-fake-provider")
      && javascriptExample.stdout.includes("mode: fake"),
    sharedSdkExampleReady:
      sharedSdkExample.exitCode === 0
      && sharedSdkExample.body?.client === "@unified-ai-system/shared-sdk"
      && sharedSdkExample.body?.original === "Build a Node API with tests"
      && sharedSdkExample.body?.metadata?.providerCalled === false
      && sharedSdkExample.body?.metadata?.credentialRequired === false
      && sharedSdkExample.body?.metadata?.deterministic === true,
    officialOpenAiSdkReady:
      openAiSdkExample.exitCode === 0
      && openAiSdkExample.body?.ok === true
      && openAiSdkExample.body?.client === "openai"
      && openAiSdkExample.body?.sdkVersion === "7.4.0"
      && openAiSdkExample.body?.model === "local-fake-model"
      && openAiSdkExample.body?.executionMode === "fake"
      && Object.values(openAiSdkExample.body?.checks ?? {}).every(Boolean)
      && openAiSdkExample.body?.invalidRequest?.status === 400
      && openAiSdkExample.body?.realProviderCallsMade === false,
    officialAnthropicSdkReady:
      anthropicSdkExample.exitCode === 0
      && anthropicSdkExample.body?.ok === true
      && anthropicSdkExample.body?.client === "@anthropic-ai/sdk"
      && anthropicSdkExample.body?.sdkVersion === "0.116.0"
      && anthropicSdkExample.body?.model === "local-fake-model"
      && anthropicSdkExample.body?.executionMode === "fake"
      && Object.values(anthropicSdkExample.body?.checks ?? {}).every(Boolean)
      && anthropicSdkExample.body?.invalidRequest?.status === 400
      && anthropicSdkExample.body?.realProviderCallsMade === false,
    officialA2ASdkReady:
      a2aSdkExample.exitCode === 0
      && a2aSdkExample.body?.ok === true
      && a2aSdkExample.body?.client === "@a2a-js/sdk"
      && a2aSdkExample.body?.sdkVersion === "1.0.1"
      && a2aSdkExample.body?.protocolVersion === "1.0"
      && a2aSdkExample.body?.transport === "JSONRPC"
      && Object.values(a2aSdkExample.body?.checks ?? {}).every(Boolean)
      && a2aSdkExample.body?.realProviderCallsMade === false,
    mcpStdioReady:
      mcpSmoke.exitCode === 0
      && mcpSmoke.body?.ok === true
      && mcpSmoke.body?.toolCount === 12
      && mcpSmoke.body?.executionMode === "fake"
      && mcpSmoke.body?.managedGatewayCleanedUp === true,
  };
  const issueCodes = buildIssueCodesFromChecks(checks);

  result = {
    ok: Object.values(checks).every(Boolean),
    issueCodes,
    issueCodeSummary: summarizeIssueCodes(issueCodes),
    port,
    checks,
    realProviderCallsMade: false,
    realProviderEnabled: health.body?.data?.realProviderEnabled ?? null,
    javascriptExample,
    sharedSdkExample,
    openAiSdkExample,
    anthropicSdkExample,
    a2aSdkExample,
    mcp: mcpSmoke.body,
  };
  if (!result.ok) process.exitCode = 1;
} catch (error) {
  const issueCodes = [
    createIssueCode(
      "public_clone_fatal_failure",
      error instanceof Error ? error.message : String(error),
      "high",
      "tools/verify-public-clone.mjs",
    ),
  ];
  result = {
    ok: false,
    issueCodes,
    issueCodeSummary: summarizeIssueCodes(issueCodes),
    port,
    error: error instanceof Error ? error.message : String(error),
    realProviderCallsMade: false,
    outputTail: `${stdout}\n${stderr}`.trim().slice(-4_000),
  };
  process.exitCode = 1;
} finally {
  await stopChild(child);
}

process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
