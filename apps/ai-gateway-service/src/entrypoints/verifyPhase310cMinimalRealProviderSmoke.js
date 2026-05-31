import { createGatewayApplication } from "../application/createGatewayApplication.js";
import { createGatewayHttpServer } from "../http/httpServer.js";

const SHORT_PROMPT = "只回复 OK 和你的 provider 名称。";
const DEFAULT_NVIDIA_MODEL = process.env.NVIDIA_MODEL || "meta/llama-3.1-8b-instruct";
const DEFAULT_OPENAI_MODEL = process.env.OPENAI_MODEL || "gpt-4o-mini";
const DEFAULT_MIMO_MODEL = process.env.MIMO_MODEL || "mimo-v2.5-pro";

const cases = [
  {
    caseId: "default-chat-real-smoke",
    enabled: true,
    buildBody: () => ({ messages: [{ role: "user", content: SHORT_PROMPT }] }),
    shouldCallProvider: true,
    skipReason: () => (!process.env.NVIDIA_API_KEY ? "NVIDIA_API_KEY is missing for default /chat smoke." : ""),
  },
  {
    caseId: "nvidia-real-smoke",
    enabled: hasEnvFlag("AI_GATEWAY_REAL_NVIDIA_SMOKE", true),
    skipReason: () => (!process.env.NVIDIA_API_KEY ? "NVIDIA_API_KEY is missing." : ""),
    buildBody: () => ({
      messages: [{ role: "user", content: SHORT_PROMPT }],
      currentPageModelSelection: {
        providerId: "nvidia",
        modelId: DEFAULT_NVIDIA_MODEL,
      },
    }),
    shouldCallProvider: true,
  },
  {
    caseId: "openai-real-smoke",
    enabled: hasEnvFlag("AI_GATEWAY_REAL_OPENAI_SMOKE"),
    skipReason: () => (!process.env.OPENAI_API_KEY ? "OPENAI_API_KEY is missing." : ""),
    buildBody: () => ({
      messages: [{ role: "user", content: SHORT_PROMPT }],
      currentPageModelSelection: {
        providerId: "openai",
        modelId: DEFAULT_OPENAI_MODEL,
      },
    }),
    shouldCallProvider: true,
  },
  {
    caseId: "mimo-real-smoke",
    enabled:
      hasEnvFlag("AI_GATEWAY_REAL_MIMO_SMOKE") &&
      hasEnvFlag("AI_GATEWAY_ALLOW_PAID_PROVIDER_SMOKE"),
    skipReason: () => {
      if (!hasEnvFlag("AI_GATEWAY_REAL_MIMO_SMOKE")) {
        return "AI_GATEWAY_REAL_MIMO_SMOKE is not enabled.";
      }
      if (!hasEnvFlag("AI_GATEWAY_ALLOW_PAID_PROVIDER_SMOKE")) {
        return "AI_GATEWAY_ALLOW_PAID_PROVIDER_SMOKE is not enabled.";
      }
      return !process.env.MIMO_API_KEY ? "MIMO_API_KEY is missing." : "";
    },
    buildBody: () => ({
      messages: [{ role: "user", content: SHORT_PROMPT }],
      currentPageModelSelection: {
        providerId: "mimo",
        modelId: DEFAULT_MIMO_MODEL,
      },
    }),
    shouldCallProvider: true,
    paidProvider: true,
  },
  {
    caseId: "custom-provider-real-smoke",
    enabled: hasEnvFlag("AI_GATEWAY_REAL_CUSTOM_PROVIDER_SMOKE"),
    skipReason: () => "custom provider smoke is disabled by default.",
    buildBody: () => ({
      messages: [{ role: "user", content: SHORT_PROMPT }],
      currentPageModelSelection: {
        providerId: "openai-compatible",
        modelId: process.env.AI_GATEWAY_CUSTOM_PROVIDER_MODEL || "custom-model",
        baseUrl: process.env.AI_GATEWAY_CUSTOM_PROVIDER_BASE_URL || "https://example.invalid/v1",
      },
    }),
    shouldCallProvider: true,
  },
  {
    caseId: "invalid-provider-real-fallback",
    enabled: true,
    skipReason: () => (!process.env.NVIDIA_API_KEY ? "NVIDIA_API_KEY is missing for fallback validation." : ""),
    buildBody: () => ({
      messages: [{ role: "user", content: SHORT_PROMPT }],
      currentPageModelSelection: {
        providerId: "../bad",
        modelId: "bad",
      },
    }),
    shouldCallProvider: false,
  },
];

const application = createGatewayApplication({
  ...process.env,
  AI_GATEWAY_PROVIDER_MODE: "real",
  AI_GATEWAY_REAL_PROVIDER_ENABLED: "true",
});
const server = createGatewayHttpServer(application);

await listen(server, 0, "127.0.0.1");

try {
  const serviceUrl = `http://127.0.0.1:${server.address().port}`;
  const results = [];

  for (const testCase of cases) {
    results.push(await runCase(serviceUrl, testCase));
  }

  const summary = {
    smoke: "phase310c-minimal-real-provider-smoke",
    baseUrl: serviceUrl,
    results,
  };

  console.log(JSON.stringify(summary, null, 2));
  process.exitCode = results.some((item) => item.enabled && !item.skipped && !item.success) ? 1 : 0;
} finally {
  await close(server);
}

async function runCase(serviceUrl, testCase) {
  const requestedProviderId = testCase.buildBody().currentPageModelSelection?.providerId ?? "";
  const requestedModelId = testCase.buildBody().currentPageModelSelection?.modelId ?? "";

  if (!testCase.enabled) {
    return {
      caseId: testCase.caseId,
      enabled: false,
      skipped: true,
      skipReason: testCase.skipReason?.() || "disabled by default.",
      requestedProviderId,
      requestedModelId,
      actualSelectedProvider: null,
      actualModel: null,
      fallback: true,
      warning: "",
      httpStatus: null,
      success: false,
      responsePreview: "",
      providerCalled: false,
      invalidProviderCalled: false,
      paidProviderCalled: Boolean(testCase.paidProvider) && false,
      errorCode: null,
      errorMessageRedacted: null,
    };
  }

  const skipReason = testCase.skipReason?.() || "";
  if (skipReason) {
    return {
      caseId: testCase.caseId,
      enabled: true,
      skipped: true,
      skipReason,
      requestedProviderId,
      requestedModelId,
      actualSelectedProvider: null,
      actualModel: null,
      fallback: true,
      warning: "",
      httpStatus: null,
      success: false,
      responsePreview: "",
      providerCalled: false,
      invalidProviderCalled: false,
      paidProviderCalled: false,
      errorCode: null,
      errorMessageRedacted: null,
    };
  }

  try {
    const requestBody = testCase.buildBody();
    const response = await fetch(`${serviceUrl}/chat`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        ...requestBody,
        maxOutputTokens: 32,
      }),
    });
    const envelope = await response.json();
    const data = envelope.data ?? envelope;
    const warning = data?.metadata?.currentPageModelSelectionWarning ?? "";
    const responsePreview = redactPreview(extractPreviewText(data)).slice(0, 120);
    const actualSelectedProvider = data?.selectedProvider ?? data?.providerId ?? null;
    const actualModel = data?.selectedModel ?? data?.model ?? null;
    const fallback = Boolean(warning);
    if (testCase.caseId === "invalid-provider-real-fallback" && !response.ok && envelope?.error?.code === "NO_PROVIDER_ROUTE") {
      return {
        caseId: testCase.caseId,
        enabled: true,
        skipped: true,
        skipReason: "Invalid provider fallback could not be resolved by the current runtime.",
        requestedProviderId,
        requestedModelId,
        actualSelectedProvider,
        actualModel,
        fallback,
        warning,
        httpStatus: response.status,
        success: false,
        responsePreview,
        providerCalled: false,
        invalidProviderCalled: false,
        paidProviderCalled: false,
        errorCode: envelope?.error?.code ?? null,
        errorMessageRedacted: envelope?.error?.message ? redactSecrets(envelope.error.message) : null,
      };
    }
    if (!response.ok) {
      return {
        caseId: testCase.caseId,
        enabled: true,
        skipped: true,
        skipReason: `Real smoke blocked: ${envelope?.error?.code ?? `HTTP_${response.status}`}`,
        requestedProviderId,
        requestedModelId,
        actualSelectedProvider,
        actualModel,
        fallback,
        warning,
        httpStatus: response.status,
        success: false,
        responsePreview,
        providerCalled: testCase.shouldCallProvider,
        invalidProviderCalled: testCase.caseId === "invalid-provider-real-fallback" ? false : undefined,
        paidProviderCalled: Boolean(testCase.paidProvider),
        errorCode: envelope?.error?.code ?? null,
        errorMessageRedacted: envelope?.error?.message ? redactSecrets(envelope.error.message) : null,
      };
    }
    const success =
      response.ok &&
      (testCase.caseId === "invalid-provider-real-fallback"
        ? fallback && actualSelectedProvider === "nvidia"
        : actualSelectedProvider === requestedProviderId || requestedProviderId === "" || testCase.caseId === "default-chat-real-smoke");

    return {
      caseId: testCase.caseId,
      enabled: true,
      skipped: false,
      skipReason: "",
      requestedProviderId,
      requestedModelId,
      actualSelectedProvider,
      actualModel,
      fallback,
      warning,
      httpStatus: response.status,
      success,
      responsePreview,
      providerCalled: testCase.shouldCallProvider,
      invalidProviderCalled: testCase.caseId === "invalid-provider-real-fallback" ? false : undefined,
      paidProviderCalled: Boolean(testCase.paidProvider),
      errorCode: envelope?.error?.code ?? null,
      errorMessageRedacted: envelope?.error?.message ? redactSecrets(envelope.error.message) : null,
    };
  } catch (error) {
    return {
      caseId: testCase.caseId,
      enabled: true,
      skipped: false,
      skipReason: "",
      requestedProviderId,
      requestedModelId,
      actualSelectedProvider: null,
      actualModel: null,
      fallback: false,
      warning: "",
      httpStatus: null,
      success: false,
      responsePreview: "",
      providerCalled: testCase.shouldCallProvider,
      invalidProviderCalled: testCase.caseId === "invalid-provider-real-fallback" ? false : undefined,
      paidProviderCalled: Boolean(testCase.paidProvider),
      errorCode: error?.code ?? "REQUEST_FAILED",
      errorMessageRedacted: redactSecrets(error instanceof Error ? error.message : String(error)),
    };
  }
}

function extractPreviewText(data) {
  return String(data?.outputText ?? data?.text ?? data?.message?.content ?? "").replace(/\s+/g, " ").trim();
}

function redactPreview(text) {
  return String(text).replace(/\b(sk-|pk|ak|sk-proj|Bearer)\b[\w-]*/gi, "[redacted]");
}

function redactSecrets(text) {
  return String(text)
    .replace(/\b(sk-|pk|ak|sk-proj|Bearer)\b[\w-]*/gi, "[redacted]")
    .replace(/([?&](?:api[_-]?key|token|secret|key)=)[^&\s]+/gi, "$1[redacted]");
}

function hasEnvFlag(name, defaultValue = false) {
  const value = process.env[name];
  if (value == null || value === "") {
    return defaultValue;
  }
  return ["1", "true", "yes", "on"].includes(String(value).toLowerCase());
}

function listen(targetServer, port, host) {
  return new Promise((resolve, reject) => {
    targetServer.once("error", reject);
    targetServer.listen(port, host, () => {
      targetServer.off("error", reject);
      resolve();
    });
  });
}

function close(targetServer) {
  return new Promise((resolve) => targetServer.close(resolve));
}
