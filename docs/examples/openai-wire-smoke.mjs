#!/usr/bin/env node

const baseUrlInput = process.env.AI_GATEWAY_SERVICE_URL
  ?? process.env.AI_GATEWAY_BASE_URL
  ?? "http://127.0.0.1:3100";
const baseUrl = baseUrlInput.replace(/\/$/, "");
const MODEL = "local-fake-model";

async function callJson(path, body, { method } = {}) {
  const httpMethod = method ?? (body == null ? "GET" : "POST");
  const headers = body == null ? {} : { "content-type": "application/json" };
  const response = await fetch(`${baseUrl}${path}`, {
    method: httpMethod,
    headers,
    body: body == null ? undefined : JSON.stringify(body),
  });
  const text = await response.text();
  let data = null;
  try {
    data = JSON.parse(text);
  } catch {
    data = null;
  }
  return { status: response.status, text, data, headers: response.headers };
}

async function callStream(path, body) {
  const response = await fetch(`${baseUrl}${path}`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      accept: "text/event-stream",
    },
    body: JSON.stringify(body),
  });
  const text = await response.text();
  return { status: response.status, text, headers: response.headers };
}

async function main() {
  const results = {
    client: "openai-wire",
    baseUrl,
    checks: {},
    realProviderCallsMade: false,
  };

  const rootHealth = await fetch(`${baseUrl}/health/check`);
  const healthText = await rootHealth.text();
  results.checks.health = rootHealth.status === 200;
  results.checks.healthReady = rootHealth.ok && /ready/.test(healthText);

  const models = await callJson("/v1/models", null);
  const modelData = models.data?.data;
  results.checks.models = models.status === 200
    && Array.isArray(modelData)
    && modelData.some((model) => model?.id === MODEL);
  const providerType = modelData?.find((model) => model?.id === MODEL)?.unified_ai
    ?.execution_mode;

  const chat = await callJson("/v1/chat/completions", {
    model: MODEL,
    messages: [{ role: "user", content: "Wire compat profile test" }],
    stream: false,
  });
  const chatMode = chat.data?.unified_ai?.execution_mode;
  results.checks.chatV1 = chat.status === 200 && chatMode === "fake";

  const legacyCompletion = await callJson("/v1/completions", {
    model: MODEL,
    prompt: "Legacy completion wire compatibility test",
  });
  results.checks.completionsLegacy = (
    legacyCompletion.status === 200
    && legacyCompletion.data?.unified_ai?.execution_mode === "fake"
    && legacyCompletion.data?.object === "text_completion"
  );

  const responses = await callJson("/v1/responses", {
    model: MODEL,
    instructions: "Wire compatible response test",
    input: "Wire compatibility check for OpenAI-like clients.",
    store: false,
  });
  results.checks.responsesV1 = (
    responses.status === 200
    && responses.data?.unified_ai?.execution_mode === "fake"
    && responses.data?.object === "response"
    && responses.data?.status === "completed"
  );

  const aliasChat = await callJson("/chat/completions", {
    model: MODEL,
    messages: [{ role: "user", content: "Root alias chat endpoint test" }],
  });
  results.checks.chatAlias = aliasChat.status === 200
    && aliasChat.data?.unified_ai?.execution_mode === "fake";

  const aliasResponses = await callJson("/responses", {
    model: MODEL,
    instructions: "Alias responses endpoint test",
    input: "Alias responses test",
    store: false,
  });
  results.checks.responsesAlias = aliasResponses.status === 200
    && aliasResponses.data?.unified_ai?.execution_mode === "fake";

  const azChat = await callJson(`/openai/deployments/${MODEL}/chat/completions`, {
    messages: [{ role: "user", content: "Azure-style chat endpoint test" }],
  });
  results.checks.azureChatAlias = azChat.status === 200
    && azChat.data?.unified_ai?.execution_mode === "fake"
    && azChat.data?.unified_ai?.selected_model === MODEL;

  const azResponses = await callJson(`/openai/deployments/${MODEL}/responses`, {
    input: "Azure-style responses endpoint test",
    instructions: "Azure-compatible responses",
    store: false,
  });
  results.checks.azureResponsesAlias = azResponses.status === 200
    && azResponses.data?.unified_ai?.execution_mode === "fake"
    && azResponses.data?.model === MODEL;

  const engineChat = await callJson(`/v1/engines/${MODEL}/chat/completions`, {
    messages: [{ role: "user", content: "Engine chat endpoint test" }],
  });
  results.checks.legacyEngineChat = engineChat.status === 200
    && engineChat.data?.unified_ai?.execution_mode === "fake";

  const engineCompletions = await callJson(`/v1/engines/${MODEL}/completions`, {
    prompt: "Engine completions endpoint test",
  });
  results.checks.legacyEngineCompletions = engineCompletions.status === 200
    && engineCompletions.data?.unified_ai?.execution_mode === "fake";

  const stream = await callStream("/v1/chat/completions", {
    model: MODEL,
    messages: [{ role: "user", content: "Stream through wire check" }],
    stream: true,
  });
  results.checks.streamSse = stream.status === 200
    && /text\/event-stream/i.test(stream.headers.get("content-type") ?? "")
    && stream.text.includes("data: [DONE]");

  const responseChecks = Object.values(results.checks);
  results.ok = responseChecks.every((value) => value === true);
  results.executionMode = providerType ?? null;
  results.modelListCount = modelData?.length ?? 0;

  if (!results.ok) {
    results.failedChecks = responseChecks
      .map((value, index) => ({ [Object.keys(results.checks)[index]]: value }))
      .filter((entry) => Object.values(entry)[0] !== true);
  }

  process.stdout.write(`${JSON.stringify(results, null, 2)}\n`);
  process.exitCode = results.ok ? 0 : 1;
}

main().catch((error) => {
  process.stdout.write(
    JSON.stringify({
      ok: false,
      error: error instanceof Error ? error.message : String(error),
      client: "openai-wire",
      realProviderCallsMade: false,
    }, null, 2),
  );
  process.exitCode = 1;
});
