import { createGatewayApplication } from "../application/createGatewayApplication.js";
import { createGatewayHttpServer } from "../http/httpServer.js";

const SMOKE_MODES = new Set(["fake", "real-no-key", "real-with-key"]);
const mode = SMOKE_MODES.has(process.env.AI_GATEWAY_SMOKE_MODE) ? process.env.AI_GATEWAY_SMOKE_MODE : "fake";
const checks = [];

if (mode === "fake") {
  checks.push(
    await runRouteCheck({
      name: "fake-route",
      env: {
        ...process.env,
        AI_GATEWAY_PROVIDER_MODE: "fake",
        AI_GATEWAY_REAL_PROVIDER_ENABLED: "false",
      },
      expected: "fake route succeeds while NVIDIA remains inactive",
    }),
  );
}

if (mode === "real-no-key") {
  checks.push(
    await runRouteCheck({
      name: "nvidia-real-no-key-controlled-failure",
      env: {
        ...process.env,
        AI_GATEWAY_PROVIDER_MODE: "real",
        AI_GATEWAY_REAL_PROVIDER_ENABLED: "true",
        NVIDIA_API_KEY: "",
      },
      expected: "NVIDIA route returns NVIDIA_API_KEY_MISSING",
    }),
  );
}

if (mode === "real-with-key") {
  if (!process.env.NVIDIA_API_KEY) {
    checks.push({
      name: "nvidia-real-with-key-route",
      expected: "NVIDIA route calls the OpenAI-compatible NVIDIA endpoint when NVIDIA_API_KEY is present",
      skipped: true,
      reason: "NVIDIA_API_KEY is not present in the current environment.",
    });
  } else {
    checks.push(
      await runRouteCheck({
        name: "nvidia-real-with-key-route",
        env: {
          ...process.env,
          AI_GATEWAY_PROVIDER_MODE: "real",
          AI_GATEWAY_REAL_PROVIDER_ENABLED: "true",
        },
        expected: "NVIDIA route returns a route envelope from the real provider path",
      }),
    );
  }
}

console.log(
  JSON.stringify(
    {
      smoke: "nvidia-route",
      mode,
      nvidiaApiKeyPresent: Boolean(process.env.NVIDIA_API_KEY),
      nvidiaModel: process.env.NVIDIA_MODEL || "meta/llama-3.1-8b-instruct",
      checks,
    },
    null,
    2,
  ),
);

async function runRouteCheck({ name, env, expected }) {
  const application = createGatewayApplication(env);
  const server = createGatewayHttpServer(application);

  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));

  try {
    const response = await fetch(`http://127.0.0.1:${server.address().port}/route`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        taskType: "chat",
        messages: [
          {
            role: "user",
            content: "Phase 6N NVIDIA route smoke ping.",
          },
        ],
        options: {
          temperature: 0,
          maxOutputTokens: 32,
        },
      }),
    });
    const envelope = await response.json();

    return {
      name,
      expected,
      httpStatus: response.status,
      result: summarizeRouteEnvelope(envelope),
    };
  } catch (error) {
    return {
      name,
      expected,
      httpStatus: null,
      result: {
        success: false,
        code: "SMOKE_ROUTE_REQUEST_FAILED",
        message: error instanceof Error ? error.message : "Smoke route request failed.",
      },
    };
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
}

function summarizeRouteEnvelope(envelope) {
  return {
    success: envelope.success,
    code: envelope.code,
    message: envelope.message,
    data: {
      selectedProvider: envelope.data?.selectedProvider ?? null,
      selectedModel: envelope.data?.selectedModel ?? null,
      executionMode: envelope.data?.executionMode,
      executionStatus: envelope.data?.executionStatus,
      outputText: envelope.data?.outputText,
      warnings: envelope.data?.warnings ?? [],
    },
    error: envelope.error
      ? {
          code: envelope.error.code,
          type: envelope.error.type,
          message: envelope.error.message,
          retryable: envelope.error.retryable,
          provider: envelope.error.provider,
          model: envelope.error.model,
          details: envelope.error.details,
        }
      : null,
    meta: envelope.meta,
  };
}
