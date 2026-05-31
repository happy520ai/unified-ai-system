export const TOKEN_ESTIMATOR_METHOD = "approximate-no-provider-call";

export function estimateTokens(input = {}) {
  const text = collectInputText(input);
  const estimatedInputTokens = estimateTextTokens(text);
  const estimatedOutputTokens = estimateOutputTokens(input.maxOutputTokens, estimatedInputTokens);

  return {
    estimatedInputTokens,
    estimatedOutputTokens,
    estimatedTotalTokens: estimatedInputTokens + estimatedOutputTokens,
    method: TOKEN_ESTIMATOR_METHOD,
    confidence: "conservative-preview",
    safety: {
      externalApiCalled: false,
      paidApiCalled: false,
      apiKeyRead: false,
    },
  };
}

export function estimateTextTokens(value) {
  const text = String(value ?? "");
  const trimmed = text.trim();

  if (!trimmed) {
    return 0;
  }

  const compact = trimmed.replace(/\s+/g, " ");
  const cjkCount = (compact.match(/[\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff]/g) ?? []).length;
  const latinWords = (compact.match(/[A-Za-z0-9_]+(?:[-'][A-Za-z0-9_]+)*/g) ?? []).length;
  const nonWhitespaceChars = (compact.match(/\S/g) ?? []).length;
  const punctuationChars = Math.max(0, nonWhitespaceChars - cjkCount);

  const byCharacterDensity = Math.ceil(nonWhitespaceChars / 3);
  const byLanguageMix = Math.ceil(cjkCount * 1.1 + latinWords * 1.35 + punctuationChars * 0.18);
  const byUtf8Bytes = Math.ceil(Buffer.byteLength(compact, "utf8") / 4);

  return Math.max(1, byCharacterDensity, byLanguageMix, byUtf8Bytes);
}

function estimateOutputTokens(maxOutputTokens, estimatedInputTokens) {
  const parsed = Number(maxOutputTokens);

  if (Number.isFinite(parsed) && parsed > 0) {
    return Math.ceil(parsed);
  }

  if (estimatedInputTokens <= 0) {
    return 256;
  }

  return Math.min(1024, Math.max(256, Math.ceil(estimatedInputTokens * 0.35)));
}

function collectInputText(input) {
  const parts = [];

  if (Array.isArray(input.messages)) {
    for (const message of input.messages) {
      if (!message || typeof message.content !== "string") continue;
      const role = typeof message.role === "string" ? message.role : "message";
      parts.push(`${role}: ${message.content}`);
    }
  }

  if (typeof input.text === "string") {
    parts.push(input.text);
  }

  return parts.join("\n\n");
}
