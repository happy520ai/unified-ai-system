// ── HTTP Provider Error Helpers ──
// Extracted from httpLlmProviderAdapter.js — error creation, URL normalization,
// network detection, SSRF guard, and secret redaction.

/**
 * Create a provider-category error with structured metadata.
 */
export function createProviderError({ code, type, message, retryable, details }) {
  const error = new Error(message);
  error.code = code;
  error.type = type;
  error.category = "provider";
  error.retryable = retryable;
  error.details = details;
  return error;
}

/**
 * Build provider error details from a gateway request.
 */
export function createErrorDetails(providerRequest, extra = {}) {
  return {
    providerId: providerRequest.target.providerId,
    modelId: providerRequest.target.modelId,
    ...extra,
  };
}

/**
 * Derive a SCREAMING_SNAKE_CASE prefix from a provider id.
 */
export function createErrorPrefix(providerId) {
  return String(providerId ?? "HTTP_LLM")
    .replace(/[^a-zA-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .toUpperCase();
}

/**
 * Strip trailing slashes from a base URL.
 */
export function normalizeBaseUrl(baseUrl) {
  if (!baseUrl) {
    return "";
  }
  return String(baseUrl).replace(/\/+$/, "");
}

/**
 * SSRF guard — block requests to private / reserved addresses.
 */
export function isPrivateOrReservedUrl(urlString) {
  try {
    const u = new URL(urlString);
    const host = u.hostname.replace(/^\[|\]$/g, "").toLowerCase();
    if (!host) return true;
    if (host === "localhost" || host === "::1" || host === "0.0.0.0" || host === "127.0.0.1") return true;
    if (/^127\./.test(host)) return true;
    if (/^10\./.test(host)) return true;
    if (/^172\.(1[6-9]|2\d|3[01])\./.test(host)) return true;
    if (/^192\.168\./.test(host)) return true;
    if (/^169\.254\./.test(host)) return true;
    if (/^0\./.test(host)) return true;
    if (/^100\.(6[4-9]|[7-9]\d|1[01]\d|12[0-7])\./.test(host)) return true;
    if (host === "metadata.google.internal" || host === "metadata" || host === "instance-data") return true;
    if (host.endsWith(".local") || host.endsWith(".internal")) return true;
    return false;
  } catch {
    return true; // block unparseable URLs
  }
}

/**
 * Detect transient network-level errors that are safe to retry.
 */
export function isNetworkError(error) {
  return (
    error instanceof TypeError ||
    error?.code === "ECONNRESET" ||
    error?.code === "ENOTFOUND" ||
    error?.code === "EAI_AGAIN"
  );
}

/**
 * Read a fetch Response body as JSON, falling back to { rawText } on parse failure.
 */
export async function readJsonResponse(response) {
  const text = await response.text();
  if (!text) {
    return {};
  }
  try {
    return JSON.parse(text);
  } catch {
    return { rawText: text };
  }
}

/**
 * Extract a human-readable error message from a provider error body,
 * redacting potential secrets.
 */
export function extractProviderErrorMessage(body, statusCode, fallbackMessage) {
  const raw = body?.error?.message ?? body?.rawText ?? fallbackMessage ?? `HTTP LLM provider request failed with HTTP ${statusCode}`;
  // Redact potential secrets: API keys, tokens, bearer fragments
  return String(raw).replace(/(?:sk-|key-|Bearer\s+)[A-Za-z0-9_\-]{4,}/g, "[REDACTED]");
}

/**
 * Map an HTTP status code to a structured error descriptor.
 */
export function describeHttpErrorStatus(statusCode, prefix, providerName) {
  const name = providerName || "HTTP LLM provider";
  if (statusCode === 401) {
    return {
      code: `${prefix}_UNAUTHORIZED`,
      type: "authentication",
      message: `${name} rejected the request with HTTP 401. Check the provider-specific API key, base URL, and model access.`,
      retryable: false,
    };
  }

  if (statusCode === 403) {
    return {
      code: `${prefix}_FORBIDDEN`,
      type: "authorization",
      message: `${name} rejected the request with HTTP 403. Check account permissions, subscription scope, and model access.`,
      retryable: false,
    };
  }

  if (statusCode === 429) {
    return {
      code: `${prefix}_RATE_LIMIT`,
      type: "rate_limit",
      message: `${name} rejected the request with HTTP 429. The provider rate limit or quota was reached; retry later or use another model.`,
      retryable: true,
    };
  }

  return {
    code: `${prefix}_HTTP_ERROR`,
    type: "http",
    message: `${name} request failed with HTTP ${statusCode}.`,
    retryable: statusCode >= 500,
  };
}

/**
 * Create a structured provider error from an HTTP response.
 */
export function createHttpProviderError({ response, body, providerRequest, prefix, providerName }) {
  const statusDescriptor = describeHttpErrorStatus(response.status, prefix, providerName);

  return createProviderError({
    code: statusDescriptor.code,
    type: statusDescriptor.type,
    message: extractProviderErrorMessage(body, response.status, statusDescriptor.message),
    retryable: statusDescriptor.retryable,
    details: createErrorDetails(providerRequest, {
      statusCode: response.status,
      errorType: body?.error?.type,
      errorCode: body?.error?.code,
    }),
  });
}

/**
 * Classify a caught error from a non-streaming generate attempt into
 * a structured provider error. Re-throws provider-category errors as-is.
 */
export function classifyNonStreamError(error, { errorPrefix, providerName, providerRequest, timeoutMs }) {
  const name = providerName;

  if (error?.category === "provider") {
    throw error;
  }

  if (error?.name === "AbortError") {
    throw createProviderError({
      code: `${errorPrefix}_REQUEST_TIMEOUT`,
      type: "timeout",
      message: `${name} request timed out after ${timeoutMs}ms.`,
      retryable: true,
      details: createErrorDetails(providerRequest, { timeoutMs }),
    });
  }

  if (isNetworkError(error)) {
    throw createProviderError({
      code: `${errorPrefix}_NETWORK_ERROR`,
      type: "network",
      message: `${name} request failed before receiving a response.`,
      retryable: true,
      details: createErrorDetails(providerRequest),
    });
  }

  throw createProviderError({
    code: `${errorPrefix}_UNKNOWN_ERROR`,
    type: "unknown",
    message: error instanceof Error ? error.message : "HTTP LLM provider request failed.",
    retryable: false,
    details: createErrorDetails(providerRequest),
  });
}
