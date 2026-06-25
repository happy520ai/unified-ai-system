import { randomUUID } from "node:crypto";
import { cleanSecretValue, isLikelyMaskedSecret, maskSecret } from "../security/secretSafety.js";
import {
  MODEL_IMPORT_SOURCE,
  MODEL_IMPORT_TIMEOUT_MS,
  PROVIDER_PROBES,
  getProviderProbeConfig,
  listModelImportProviders,
} from "./providerProbeCatalog.js";
import { normalizeProviderModels, safeJsonParse } from "./providerModelNormalizer.js";
import { resolveProviderCandidates } from "./providerCandidateResolver.js";

// Re-export the full public surface so existing consumers are unaffected.
export {
  MODEL_IMPORT_SOURCE,
  MODEL_IMPORT_TIMEOUT_MS,
  getProviderProbeConfig,
  listModelImportProviders,
  normalizeProviderModels,
  resolveProviderCandidates,
};

export function createApiKeyRef() {
  return `model-import-${randomUUID()}`;
}

export function cleanApiKey(value) {
  return cleanSecretValue(value);
}

export function maskApiKey(apiKey) {
  return maskSecret(apiKey);
}

export function isLikelyMaskedApiKey(value) {
  return isLikelyMaskedSecret(value);
}

export async function probeProviderModels({ candidate, apiKey, fetchImpl = globalThis.fetch, timeoutMs = MODEL_IMPORT_TIMEOUT_MS } = {}) {
  const config = PROVIDER_PROBES[candidate?.providerId];
  const clean = cleanApiKey(apiKey);
  const baseUrl = normalizeBaseUrl(candidate?.baseUrl ?? config?.baseUrl);

  if (!config) {
    return createProbeResult({
      ok: false,
      providerId: candidate?.providerId ?? "unknown",
      status: "probe_failed",
      reason: "provider_probe_not_registered",
    });
  }

  if (config.requiresBaseUrl && !baseUrl) {
    return createProbeResult({
      ok: false,
      providerId: config.providerId,
      status: "needs_user_selection",
      reason: "base_url_required_for_openai_compatible_probe",
      skipped: true,
    });
  }

  if (!clean) {
    return createProbeResult({
      ok: false,
      providerId: config.providerId,
      status: "invalid_api_key",
      reason: "api_key_required",
    });
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetchImpl(createModelListUrl({ config, baseUrl, apiKey: clean }), {
      method: "GET",
      headers: createModelListHeaders({ config, apiKey: clean }),
      signal: controller.signal,
    });
    const rawText = await response.text();
    const body = safeJsonParse(rawText);

    if (response.status === 401 || response.status === 403) {
      return createProbeResult({
        ok: false,
        providerId: config.providerId,
        status: "invalid_api_key",
        httpStatus: response.status,
        reason: "provider_rejected_api_key",
      });
    }

    if (!response.ok) {
      return createProbeResult({
        ok: false,
        providerId: config.providerId,
        status: "probe_failed",
        httpStatus: response.status,
        reason: "provider_models_api_failed",
      });
    }

    const models = normalizeProviderModels({
      providerId: config.providerId,
      defaultCapabilities: config.defaultCapabilities,
      body,
    });

    return createProbeResult({
      ok: true,
      providerId: config.providerId,
      status: models.length ? "models_discovered" : "provider_detected_but_no_models",
      httpStatus: response.status,
      models,
    });
  } catch (error) {
    return createProbeResult({
      ok: false,
      providerId: config.providerId,
      status: error?.name === "AbortError" ? "probe_timeout" : "probe_failed",
      reason: error?.name === "AbortError" ? "provider_models_api_timeout" : "provider_models_api_unreachable",
    });
  } finally {
    clearTimeout(timeout);
  }
}

function createModelListUrl({ config, baseUrl, apiKey }) {
  const path = config.modelsPath ?? "/models";
  const url = `${baseUrl}${path}`;
  if (config.auth !== "query-key") {
    return url;
  }
  const separator = url.includes("?") ? "&" : "?";
  return `${url}${separator}key=${encodeURIComponent(apiKey)}`;
}

function createModelListHeaders({ config, apiKey }) {
  if (config.auth === "query-key") {
    return {
      "accept": "application/json",
    };
  }
  if (config.auth === "anthropic-api-key") {
    return {
      "accept": "application/json",
      "anthropic-version": "2023-06-01",
      "x-api-key": apiKey,
    };
  }
  return {
    "accept": "application/json",
    "authorization": `Bearer ${apiKey}`,
  };
}

function createProbeResult(result) {
  return {
    ok: Boolean(result.ok),
    providerId: result.providerId,
    status: result.status,
    httpStatus: result.httpStatus,
    reason: result.reason,
    skipped: Boolean(result.skipped),
    models: result.models ?? [],
  };
}

function normalizeBaseUrl(value) {
  return String(value ?? "").trim().replace(/\/+$/, "");
}
