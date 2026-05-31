const REDACTION_PATTERNS = [
  /sk[-_][A-Za-z0-9_-]{12,}/giu,
  /nvapi[-_][A-Za-z0-9_-]{12,}/giu,
  /AKIA[0-9A-Z]{16}/gu,
  /bearer\s+[A-Za-z0-9._-]{12,}/giu,
];

export function sanitizeSafeProviderResponse(response = {}, expectedResponseContains = "") {
  const rawText = String(response.text ?? response.responseText ?? "");
  const sanitizedText = REDACTION_PATTERNS.reduce((text, pattern) => text.replace(pattern, "[redacted]"), rawText);
  const sanitizedResponsePreview = sanitizedText.slice(0, 300);
  const expectedResponseMatched = Boolean(expectedResponseContains) && sanitizedText.includes(expectedResponseContains);
  return {
    responseSanitized: true,
    expectedResponseMatched,
    oneShotProviderCallPassed: expectedResponseMatched,
    sanitizedResponsePreview,
    providerResponseMetadata: {
      status: response.status ?? null,
      latencyMs: response.latencyMs ?? null,
      providerId: response.providerId ?? null,
      modelId: response.modelId ?? null,
    },
  };
}
