#!/usr/bin/env node

const DEFAULT_GATEWAY_URL = "http://127.0.0.1:3100";
const DEFAULT_PROMPT = "Hello from JavaScript";
const FAKE_PROVIDER = "local-fake-provider";
const FAKE_MODEL = "local-fake-model";
const REQUEST_TIMEOUT_MS = 10_000;

const gatewayUrl =
  process.env.AI_GATEWAY_SERVICE_URL ?? DEFAULT_GATEWAY_URL;
const prompt =
  process.argv.slice(2).join(" ").trim() || DEFAULT_PROMPT;

async function fetchJson(pathname, options = {}) {
  const endpoint = new URL(pathname, gatewayUrl);
  const response = await fetch(endpoint, {
    ...options,
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });
  const text = await response.text();
  let body;

  try {
    body = JSON.parse(text);
  } catch {
    throw new Error(
      `${pathname} returned non-JSON content with HTTP ${response.status}.`,
    );
  }

  if (!response.ok) {
    const detail =
      body?.error?.message ?? body?.message ?? "The request failed.";
    throw new Error(`${pathname} returned HTTP ${response.status}: ${detail}`);
  }

  return body;
}

function requireSafeGateway(health) {
  if (health?.status !== "ok" || health?.data?.status !== "ready") {
    throw new Error("The gateway is not ready.");
  }

  if (health.data.realProviderEnabled !== false) {
    throw new Error(
      "Refusing to send because the gateway may call a real provider.",
    );
  }
}

async function main() {
  const health = await fetchJson("/health/check");
  requireSafeGateway(health);

  const chat = await fetchJson("/chat", {
    method: "POST",
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify({
      prompt,
      providerId: FAKE_PROVIDER,
      model: FAKE_MODEL,
    }),
  });
  const result = chat?.data;

  if (
    chat?.success !== true
    || chat?.code !== "ROUTE_OK"
    || result?.executionMode !== "fake"
    || result?.selectedProvider !== FAKE_PROVIDER
  ) {
    throw new Error("The response did not prove fake-provider execution.");
  }

  console.log(`provider: ${result.selectedProvider}`);
  console.log(`mode: ${result.executionMode}`);
  console.log(`response: ${result.outputText ?? result.text ?? ""}`);
}

try {
  await main();
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`JavaScript example failed: ${message}`);
  process.exitCode = 1;
}
