export const PROVIDER_ID = "mimo";
export const PROMPT = "Say MIMO_SMOKE_OK";
export const MAX_OUTPUT_TOKENS = 32;
export const TEMPERATURE = 0;
export const MAX_PAID_CALLS = 3;

export async function discoverModelsEndpoint({ baseUrl, apiKey }) {
  const summary = createModelsEndpointSummary();
  summary.attempted = true;
  const authStyles = ["bearer", "api-key"];

  for (const authStyle of authStyles) {
    try {
      const response = await fetch(`${normalizeBaseUrl(baseUrl)}/models`, {
        method: "GET",
        headers: createAuthHeaders({ apiKey, authStyle }),
        signal: AbortSignal.timeout(30_000),
      });
      const body = await readJsonOrText(response);
      summary.httpStatus = response.status;
      summary.authStyleTried = authStyle;

      if (response.ok) {
        const models = extractModelIds(body);
        summary.available = true;
        summary.modelCount = models.length;
        summary.matchingModels = rankMatchingModels(models);
        summary.errorType = "none";
        return summary;
      }

      summary.errorType = classifyHttpStatus(response.status, body).type;
      summary.message = sanitizeMessage(extractErrorMessage(body) || response.statusText);

      if (![401, 403].includes(response.status)) {
        return summary;
      }
    } catch (error) {
      summary.available = false;
      summary.errorType = error?.name === "TimeoutError" ? "network_timeout" : "unknown";
      summary.message = sanitizeMessage(error instanceof Error ? error.message : String(error));
      return summary;
    }
  }

  return summary;
}

export async function trySmokeWithAuthStyles({ baseUrl, apiKey, modelId, paidApiCallCount, candidateAttempts }) {
  const authStyles = ["bearer", "api-key"];
  let lastResult = null;

  for (const authStyle of authStyles) {
    if (paidApiCallCount >= MAX_PAID_CALLS) {
      break;
    }
    const result = await callChatCompletions({ baseUrl, apiKey, modelId, authStyle });
    paidApiCallCount += 1;
    candidateAttempts.push({
      modelId,
      authStyle,
      skipped: false,
      result,
    });
    lastResult = result;

    if (result.success) {
      return { success: true, result, paidApiCallCount };
    }

    if (!["auth_failed"].includes(classifyBlocker(result).type)) {
      break;
    }
  }

  return {
    success: false,
    result: lastResult ?? createSmokeSummary(),
    paidApiCallCount,
  };
}

async function callChatCompletions({ baseUrl, apiKey, modelId, authStyle }) {
  const requestBody = {
    model: modelId,
    messages: [{ role: "user", content: PROMPT }],
    temperature: TEMPERATURE,
    stream: false,
    max_tokens: MAX_OUTPUT_TOKENS,
    max_completion_tokens: MAX_OUTPUT_TOKENS,
    thinking: { type: "disabled" },
  };

  try {
    const response = await fetch(`${normalizeBaseUrl(baseUrl)}/chat/completions`, {
      method: "POST",
      headers: createAuthHeaders({ apiKey, authStyle }),
      body: JSON.stringify(requestBody),
      signal: AbortSignal.timeout(30_000),
    });
    const body = await readJsonOrText(response);
    const text = extractCompletionText(body);
    const usage = extractUsage(body);
    const textReceived = text.trim().length > 0;
    const exactSmokeTextMatched = text.trim().includes("MIMO_SMOKE_OK");
    const success = response.ok && textReceived;

    return {
      attempted: true,
      authStyle,
      httpStatus: response.status,
      success,
      textReceived,
      exactSmokeTextMatched,
      successWithNonExactText: success && !exactSmokeTextMatched,
      usageReturned: usage.usageReturned,
      inputTokens: usage.inputTokens,
      outputTokens: usage.outputTokens,
      totalTokens: usage.totalTokens,
      errorType: response.ok ? "none" : classifyHttpStatus(response.status, body).type,
      message: response.ok ? "" : sanitizeMessage(extractErrorMessage(body) || response.statusText),
    };
  } catch (error) {
    return {
      attempted: true,
      authStyle,
      httpStatus: 0,
      success: false,
      textReceived: false,
      exactSmokeTextMatched: false,
      usageReturned: false,
      inputTokens: null,
      outputTokens: null,
      totalTokens: null,
      errorType: error?.name === "TimeoutError" ? "network_timeout" : "unknown",
      message: sanitizeMessage(error instanceof Error ? error.message : String(error)),
    };
  }
}

export function createSmokeSummary() {
  return {
    attempted: false,
    paidApiCallCount: 0,
    successfulSmokeCallCount: 0,
    maxPaidApiCallAllowed: MAX_PAID_CALLS,
    maxOutputTokens: MAX_OUTPUT_TOKENS,
    temperature: TEMPERATURE,
    stream: false,
    longContextSent: false,
    httpStatus: 0,
    success: false,
    textReceived: false,
    exactSmokeTextMatched: false,
    usageReturned: false,
    inputTokens: null,
    outputTokens: null,
    totalTokens: null,
  };
}

export function classifyBlocker(result = {}) {
  if (result.httpStatus >= 200 && result.httpStatus < 300 && result.textReceived === false) {
    return {
      type: "protocol_incompatible",
      message: "HTTP 2xx returned usage or an empty response, but no parseable completion text was found.",
    };
  }
  if (result.errorType && result.errorType !== "none") {
    return {
      type: normalizeBlockerType(result.errorType),
      message: sanitizeMessage(result.message ?? ""),
    };
  }
  return {
    type: "unknown",
    message: sanitizeMessage(result.message ?? "No working MiMo model id was found."),
  };
}

function createModelsEndpointSummary() {
  return {
    attempted: false,
    available: false,
    httpStatus: 0,
    modelCount: 0,
    matchingModels: [],
    authStyleTried: null,
    errorType: "not_found",
    message: "",
  };
}

function rankMatchingModels(models) {
  const unique = [...new Set(models.filter(Boolean))];
  return unique
    .filter((model) => /mimo/i.test(model) || /v2\.?5/i.test(model) || /pro/i.test(model))
    .sort((a, b) => scoreModel(b) - scoreModel(a))
    .slice(0, 12);
}

function scoreModel(model) {
  const value = String(model).toLowerCase();
  let score = 0;
  if (value === "mimo-v2.5-pro") score += 100;
  if (value.includes("mimo")) score += 20;
  if (value.includes("2.5") || value.includes("v2-5")) score += 20;
  if (value.includes("pro")) score += 20;
  if (value.includes("xiaomi")) score += 5;
  return score;
}

function normalizeBlockerType(type) {
  return [
    "none",
    "model_id_not_supported",
    "base_url_invalid",
    "auth_failed",
    "quota_or_billing",
    "protocol_incompatible",
    "network_timeout",
    "unknown",
  ].includes(type) ? type : "unknown";
}

function classifyHttpStatus(status, body) {
  const message = String(extractErrorMessage(body) ?? "").toLowerCase();
  if ([401, 403].includes(status)) return { type: "auth_failed" };
  if ([402, 429].includes(status) || message.includes("quota") || message.includes("billing")) return { type: "quota_or_billing" };
  if ([404].includes(status) && message.includes("model")) return { type: "model_id_not_supported" };
  if ([400, 404].includes(status) && (message.includes("not supported model") || message.includes("model"))) return { type: "model_id_not_supported" };
  if ([404].includes(status)) return { type: "base_url_invalid" };
  if ([405, 415, 422].includes(status)) return { type: "protocol_incompatible" };
  if (status >= 500) return { type: "unknown" };
  return { type: "unknown" };
}

function createAuthHeaders({ apiKey, authStyle }) {
  const headers = { "content-type": "application/json" };
  if (authStyle === "api-key") {
    headers["api-key"] = apiKey;
  } else {
    headers.authorization = `Bearer ${apiKey}`;
  }
  return headers;
}

async function readJsonOrText(response) {
  const text = await response.text();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return { text };
  }
}

function extractModelIds(body) {
  const data = Array.isArray(body?.data) ? body.data : Array.isArray(body?.models) ? body.models : [];
  return data.map((item) => {
    if (typeof item === "string") return item;
    return item?.id ?? item?.model ?? item?.name ?? "";
  }).filter(Boolean);
}

function extractCompletionText(body) {
  const message = body?.choices?.[0]?.message;
  const content = message?.content ?? body?.choices?.[0]?.text ?? body?.text ?? body?.output_text ?? body?.answer ?? "";
  if (Array.isArray(content)) {
    return content.map((item) => {
      if (typeof item === "string") return item;
      return item?.text ?? item?.content ?? "";
    }).join("");
  }
  return String(content ?? "");
}

function extractUsage(body) {
  const usage = body?.usage ?? {};
  const inputTokens = usage.prompt_tokens ?? usage.input_tokens ?? usage.inputTokens;
  const outputTokens = usage.completion_tokens ?? usage.output_tokens ?? usage.outputTokens;
  const totalTokens = usage.total_tokens ?? usage.totalTokens;
  const usageReturned = Number.isFinite(Number(inputTokens)) ||
    Number.isFinite(Number(outputTokens)) ||
    Number.isFinite(Number(totalTokens));

  return {
    usageReturned,
    inputTokens: Number.isFinite(Number(inputTokens)) ? Number(inputTokens) : null,
    outputTokens: Number.isFinite(Number(outputTokens)) ? Number(outputTokens) : null,
    totalTokens: Number.isFinite(Number(totalTokens)) ? Number(totalTokens) : null,
  };
}

function extractErrorMessage(body) {
  return body?.error?.message ?? body?.message ?? body?.text ?? "";
}

function sanitizeMessage(value) {
  return String(value ?? "")
    .replace(/(Bearer\s+)[A-Za-z0-9._-]+/gi, "$1<masked>")
    .replace(/(api[-_]?key\s*[:=]\s*)[A-Za-z0-9._-]+/gi, "$1<masked>")
    .replace(/(authorization\s*[:=]\s*)[A-Za-z0-9._\-\s]+/gi, "$1<masked>")
    .slice(0, 500);
}

function normalizeBaseUrl(baseUrl) {
  return String(baseUrl ?? "").trim().replace(/\/+$/, "");
}
