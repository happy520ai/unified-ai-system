const secretLikePatterns = [
  /Bearer\s+[A-Za-z0-9._-]{12,}/i,
  /\b(api[_-]?key|authorization|password|secret|token)\s*[:=]\s*\S{8,}/i,
  /\b(sk|nvapi)-[A-Za-z0-9_-]{8,}\b/i,
  /\b[A-Z0-9_]*API_KEY\b/i,
  /(^|\n)\s*[A-Z0-9_]*SECRET\s*=/i,
];

export function inspectCacheSafety(input = {}) {
  const text = [
    input.query,
    input.prompt,
    input.requestPreview,
    input.rawContextText,
    input.response,
    input.value,
  ].filter((value) => value !== undefined && value !== null).join("\n");
  const containsSecret = secretLikePatterns.some((pattern) => pattern.test(text));

  return {
    containsSecret,
    cacheEligible: !containsSecret,
    sanitizedText: sanitizeCacheText(text),
    rejectionReason: containsSecret ? "secret_like_text_rejected" : null,
    externalApiCalled: false,
    paidApiCallCount: 0,
  };
}

export function sanitizeCacheText(value = "") {
  let text = String(value);
  for (const pattern of secretLikePatterns) {
    text = text.replace(pattern, "[REDACTED]");
  }
  return text.slice(0, 4_000);
}
