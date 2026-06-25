import {
  PROVIDER_CATALOG,
  MODEL_DISCOVERY_TIMEOUT_MS,
  MAX_DISCOVERED_MODELS,
} from "./providerCatalog.js";
import {
  normalizeDiscoveredModels,
  withModelSource,
  rankDiscoveredModels,
  createModelCandidates,
} from "./providerModelProfiler.js";
import {
  dedupeModels,
  createCandidateConfidence,
  createCandidateMatchMethod,
  createCandidateStatus,
  createUnavailableReason,
  summarizeModels,
  findProviderDescriptor,
  findProviderModelConfigs,
  extractOpenAiCompatibleBaseUrl,
  trimSlash,
  safeJsonParse,
} from "./providerDetectionResult.js";

export function matchProviderFamilies(apiKey, preferredProviderId) {
  if (preferredProviderId) {
    const family = PROVIDER_CATALOG.find((item) => item.providerId === preferredProviderId);
    return family ? [{ family, prefix: { value: "manual-provider-choice", unique: true, confidence: "manual" } }] : [];
  }

  const matches = [];
  for (const family of PROVIDER_CATALOG) {
    const match = findFamilyCredentialMatch(family, apiKey);
    if (match) {
      matches.push({ family, prefix: match });
    }
  }

  const uniqueMatches = matches.filter((match) => match.prefix.unique);
  if (uniqueMatches.length) {
    const providerSpecificMatches = uniqueMatches.filter((match) => match.family.providerId !== "generic-openai-compatible");
    return providerSpecificMatches.length ? providerSpecificMatches : uniqueMatches;
  }

  if (matches.length) {
    return matches.filter((match) => !match.family.testOnly);
  }

  return [];
}

export function findFamilyCredentialMatch(family, rawCredential) {
  const text = String(rawCredential ?? "").trim();
  const lower = text.toLowerCase();

  for (const prefix of family.prefixes ?? []) {
    if (prefix.unique && hasTokenWithPrefix(text, prefix.value)) {
      return prefix;
    }
  }

  if (family.providerId === "generic-openai-compatible" && extractOpenAiCompatibleBaseUrl(text) && hasTokenWithPrefix(text, "sk-")) {
    return {
      value: "base-url-and-sk",
      unique: true,
      confidence: "base-url",
    };
  }

  for (const pattern of family.credentialPatterns ?? []) {
    pattern.pattern.lastIndex = 0;
    if (pattern.pattern.test(text)) {
      return {
        value: pattern.name ?? "credential-pattern",
        unique: pattern.unique !== false,
        confidence: pattern.confidence ?? "medium",
      };
    }
  }

  for (const hint of family.hints ?? []) {
    if (lower.includes(String(hint).toLowerCase())) {
      return {
        value: "platform-hint",
        unique: true,
        confidence: "platform-hint",
      };
    }
  }

  for (const prefix of family.prefixes ?? []) {
    if (!prefix.unique && hasTokenWithPrefix(text, prefix.value)) {
      return prefix;
    }
  }

  return null;
}

export function hasTokenWithPrefix(rawCredential, prefix) {
  return Boolean(findTokenByPrefix(rawCredential, prefix));
}

export function findTokenByPrefix(rawCredential, prefix) {
  const text = String(rawCredential ?? "");
  const escapedPrefix = escapeRegExp(prefix);
  const pattern = new RegExp(`(^|[^A-Za-z0-9_\\-./])(${escapedPrefix}[A-Za-z0-9_\\-./]{4,})`, "i");
  const match = text.match(pattern);
  return match?.[2] ?? null;
}

export function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export async function createDetectionCandidate(application, family, context) {
  const runtimeEndpoint = resolveRuntimeDetectionEndpoint(family, context);
  const descriptor = findProviderDescriptor(application, family.providerId);
  const modelConfigs = findProviderModelConfigs(application, family.providerId);
  const supportedByRuntime = Boolean(descriptor || modelConfigs.length > 0);
  const discovery = await discoverModels(family, { ...context, endpoint: runtimeEndpoint });
  const models = createModelCandidates({ family, descriptor, modelConfigs, discovery, supportedByRuntime });
  const authFailed = discovery.status === "auth-failed";
  const chatExecutableModelCount = models.filter((model) => model.execution?.chat === true).length;
  const endpointReady = !family.endpointRequired || Boolean(runtimeEndpoint);
  const availableForChat = family.availableForChat && supportedByRuntime && endpointReady && chatExecutableModelCount > 0 && !authFailed;
  const credentialValidated = discovery.credentialValidated === true;
  const endpointMissing = family.endpointRequired && !runtimeEndpoint;
  const requiresProviderChoice = !credentialValidated && !authFailed && !endpointMissing && !context.matchedPrefix?.unique && context.preferredProviderId !== family.providerId;

  return {
    providerId: family.providerId,
    providerDisplayName: descriptor?.displayName ?? modelConfigs[0]?.providerDisplayName ?? family.displayName,
    keyFamily: family.family,
    confidence: createCandidateConfidence({ discovery, matchedPrefix: context.matchedPrefix }),
    matchMethod: createCandidateMatchMethod(discovery),
    status: createCandidateStatus({ availableForChat, supportedByRuntime, authFailed, requiresProviderChoice, chatExecutableModelCount }),
    supportedByRuntime,
    endpointRequired: Boolean(family.endpointRequired),
    endpointConfigured: Boolean(runtimeEndpoint || family.endpoint),
    suggestedEndpoint: runtimeEndpoint || undefined,
    runtimeEnabled: Boolean(application.providerRegistry?.enabledProviders?.has(family.providerId)),
    availableForChat,
    chatExecutableModelCount,
    requiresProviderChoice,
    credentialInputParsed: Boolean(context.rawCredentialWasParsed),
    reason: availableForChat ? family.reason : createUnavailableReason(family, supportedByRuntime, discovery, chatExecutableModelCount),
    modelDiscovery: discovery,
    capabilitySummary: summarizeModels(models),
    models,
  };
}

export function resolveRuntimeDetectionEndpoint(family, context) {
  if (family.endpointRequired) {
    return extractRuntimeCredentialEndpoint(family.providerId, context.rawCredential ?? context.apiKey);
  }

  return family.endpoint;
}

export async function discoverModels(family, { apiKey, matchedPrefix, preferredProviderId, endpoint, allowModelListProbe }) {
  const discoveryEndpoint = endpoint || family.endpoint;
  const canProbe = Boolean(discoveryEndpoint && family.modelListPath && (
    matchedPrefix?.unique ||
    preferredProviderId === family.providerId ||
    (allowModelListProbe && !family.testOnly)
  ));

  if (!family.availableForChat && !canProbe) {
    return {
      status: "recognized-capability-catalog",
      networkProbePerformed: false,
      source: "provider-catalog",
      models: rankDiscoveredModels(family, family.defaultModels ?? []),
    };
  }

  if (!canProbe) {
    return {
      status: family.endpointRequired && !discoveryEndpoint ? "endpoint-required" : matchedPrefix?.confidence === "unknown" ? "manual-provider-choice" : "not-run-ambiguous-key",
      networkProbePerformed: false,
      source: "provider-catalog",
      models: rankDiscoveredModels(family, family.defaultModels ?? []),
    };
  }

  try {
    const request = createModelListRequest(family, discoveryEndpoint, apiKey);
    const response = await fetchJsonWithTimeout(request.url, request.options);

    if (!response.ok) {
      const authFailed = response.statusCode === 401 || response.statusCode === 403;
      return {
        status: authFailed ? "auth-failed" : "not-ready-catalog-fallback",
        networkProbePerformed: true,
        httpStatus: response.statusCode,
        source: "provider-models-api",
        models: authFailed ? [] : rankDiscoveredModels(family, family.defaultModels ?? []),
        warning: `Model list request returned HTTP ${response.statusCode}.`,
      };
    }

    const liveModels = rankDiscoveredModels(
      family,
      dedupeModels([
        ...withModelSource(family.defaultModels ?? [], "provider-catalog-default"),
        ...normalizeDiscoveredModels(response.body),
      ]),
    ).slice(0, MAX_DISCOVERED_MODELS);
    const credentialValidated = family.modelListValidatesCredential !== false;

    return {
      status: liveModels.length ? "ready" : "ready-empty-model-list",
      networkProbePerformed: true,
      httpStatus: response.statusCode,
      source: "provider-models-api",
      credentialValidated,
      credentialValidation: credentialValidated ? "model-list-authenticated" : "model-list-does-not-prove-key-valid",
      models: liveModels,
    };
  } catch (error) {
    return {
      status: "probe-failed",
      networkProbePerformed: true,
      source: "provider-models-api",
      models: rankDiscoveredModels(family, family.defaultModels ?? []),
      warning: error instanceof Error ? error.message : "Model discovery failed.",
    };
  }
}

export function createModelListRequest(family, discoveryEndpoint, apiKey) {
  const url = `${trimSlash(discoveryEndpoint)}${family.modelListPath}`;
  const headers = {
    accept: "application/json",
  };

  if (family.modelListAuth === "gemini-query-key") {
    return {
      url: appendQueryParam(url, "key", apiKey),
      options: { headers },
    };
  }

  if (family.modelListAuth === "anthropic-api-key") {
    return {
      url,
      options: {
        headers: {
          ...headers,
          "anthropic-version": "2023-06-01",
          "x-api-key": apiKey,
        },
      },
    };
  }

  return {
    url,
    options: {
      headers: {
        ...headers,
        authorization: `Bearer ${apiKey}`,
      },
    },
  };
}

export function appendQueryParam(rawUrl, key, value) {
  const url = new URL(rawUrl);
  url.searchParams.set(key, value);
  return url.toString();
}

export async function fetchJsonWithTimeout(url, options = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), MODEL_DISCOVERY_TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
    });
    const text = await response.text();
    return {
      ok: response.ok,
      statusCode: response.status,
      body: text ? safeJsonParse(text) : {},
    };
  } finally {
    clearTimeout(timeout);
  }
}
