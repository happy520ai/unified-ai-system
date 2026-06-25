export function summarizeModels(models) {
  const byCapability = {};
  let chatExecutable = 0;
  for (const model of Array.isArray(models) ? models : []) {
    if (model.execution?.chat === true) chatExecutable += 1;
    for (const capability of model.capabilities ?? []) {
      byCapability[capability] = (byCapability[capability] ?? 0) + 1;
    }
  }
  return {
    totalModels: Array.isArray(models) ? models.length : 0,
    chatExecutableModels: chatExecutable,
    byCapability,
  };
}

export function createCapabilitySummary(detected) {
  const providerSummaries = (Array.isArray(detected) ? detected : []).map((provider) => ({
    providerId: provider.providerId,
    providerDisplayName: provider.providerDisplayName,
    status: provider.status,
    availableForChat: provider.availableForChat,
    ...provider.capabilitySummary,
  }));
  const allModels = (Array.isArray(detected) ? detected : []).flatMap((provider) => provider.models ?? []);
  return {
    totalProviders: providerSummaries.length,
    totalModels: allModels.length,
    providerSummaries,
    ...summarizeModels(allModels),
  };
}

export function dedupeModels(models) {
  const seen = new Set();
  return models.filter((model) => {
    if (!model?.modelId) return false;
    const key = `${model.providerId ?? ""}::${model.modelId}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function pickRecommendedCandidate(available) {
  const verified = available.find(({ candidate }) => candidate.modelDiscovery?.credentialValidated === true);
  const stable = verified ?? available.find(({ candidate }) => !candidate.requiresProviderChoice);
  return stable ? createRecommendedCandidate(stable) : null;
}

export function createRecommendedCandidate({ candidate, model }) {
  return {
    providerId: candidate.providerId,
    providerDisplayName: candidate.providerDisplayName,
    modelId: model.modelId,
    modelDisplayName: model.modelDisplayName,
    value: `${candidate.providerId}::${model.modelId}`,
    label: `${candidate.providerDisplayName} / ${model.modelDisplayName}`,
    confidence: candidate.confidence,
    modelDiscoveryStatus: candidate.modelDiscovery?.status,
    credentialValidated: candidate.modelDiscovery?.credentialValidated === true,
    capabilities: model.capabilities ?? [],
    modalities: model.modalities ?? {},
    execution: model.execution ?? {},
  };
}

export function createCandidateConfidence({ discovery, matchedPrefix }) {
  if (discovery.status === "ready") {
    return discovery.credentialValidated ? "verified" : "catalog-live-needs-chat-probe";
  }

  return matchedPrefix?.confidence ?? "unknown";
}

export function createCandidateMatchMethod(discovery) {
  if (discovery.status === "ready") {
    return discovery.credentialValidated ? "provider-models-api-authenticated" : "provider-models-api-catalog";
  }

  return "api-key-prefix-or-manual-choice";
}

export function createCandidateStatus({ availableForChat, supportedByRuntime, authFailed, requiresProviderChoice, chatExecutableModelCount }) {
  if (authFailed) return "credential-rejected-by-provider";
  if (availableForChat && requiresProviderChoice) return "candidate-provider-choice-required";
  if (availableForChat) return "candidate";
  if (supportedByRuntime && chatExecutableModelCount === 0) return "recognized-no-chat-executable-model";
  if (supportedByRuntime) return "recognized-not-chat-available";
  return "recognized-not-supported";
}

export function createUnavailableReason(family, supportedByRuntime, discovery, chatExecutableModelCount) {
  if (family.endpointRequired && discovery.status === "endpoint-required") {
    return `${family.displayName} is recognized, but a base URL ending in /v1 or /v2 is required before it can be added.`;
  }

  if (!supportedByRuntime) {
    return `${family.displayName} is recognized, but this runtime does not expose a matching provider adapter.`;
  }

  if (discovery.status === "auth-failed") {
    return `${family.displayName} rejected this API key while listing models. Check whether the key belongs to this provider.`;
  }

  if (chatExecutableModelCount === 0) {
    return `${family.displayName} is recognized and may expose non-chat capabilities, but no model is executable through the current chat lane.`;
  }

  return family.reason;
}

export function createDetectionWarnings({ apiKey, detected, recommended, capabilitySummary, allowModelListProbe = false }) {
  if (!detected.length) {
    return [
      "unknown-key-family",
      "The key prefix is not recognized. To avoid sending a secret to the wrong provider, the system did not auto-select a model.",
    ];
  }

  if (detected.some((candidate) => candidate.requiresProviderChoice)) {
    return [
      "ambiguous-key-provider-choice-required",
      allowModelListProbe
        ? "This key family can belong to multiple providers. The explicit model-list probe did not produce exactly one verified chat provider, so the system still requires provider choice."
        : "This key family can belong to multiple providers. The system listed safe candidates but did not send the key to every provider automatically.",
    ];
  }

  if (!recommended && capabilitySummary?.totalModels > 0) {
    return [
      "recognized-capabilities-not-chat-executable",
      "The key family was recognized and model capabilities were classified, but no model can be safely added to the current chat lane.",
    ];
  }

  if (!recommended) {
    return [
      "recognized-but-not-chat-available",
      "The key was recognized, but no supported chat model is available for one-click add in the current runtime.",
    ];
  }

  if (detected.some((candidate) => candidate.modelDiscovery?.status === "ready" && candidate.modelDiscovery?.credentialValidated === false)) {
    return [
      "model-list-does-not-prove-key-valid",
      "The provider model list is reachable, but this does not prove the API key can run chat. The one-click add step must still run a real /chat probe.",
    ];
  }

  if (apiKey.startsWith("sk-") && recommended.confidence !== "verified") {
    return ["generic-sk-key-needs-provider-confirmation"];
  }

  return [];
}

export function findProviderDescriptor(application, providerId) {
  const descriptors = typeof application.providerRegistry?.listAllDescriptors === "function"
    ? application.providerRegistry.listAllDescriptors()
    : application.gatewayService?.getProviderDescriptors?.() ?? [];
  return descriptors.find((provider) => provider.id === providerId) ?? null;
}

export function findProviderModelConfigs(application, providerId) {
  const models = application.config?.aiGatewayService?.providerModels ?? [];
  return models.filter((provider) => provider.providerId === providerId);
}

export function trimSlash(value) {
  return String(value ?? "").replace(/\/+$/, "");
}

export function extractOpenAiCompatibleBaseUrl(rawCredential) {
  const text = String(rawCredential ?? "");
  const match = text.match(/https?:\/\/[^\s"'<>]+/i);
  if (!match) return "";

  let url = match[0].trim().replace(/[),.;，。]+$/, "");
  url = url.replace(/\/chat\/completions\/?$/i, "");
  url = url.replace(/\/models\/?$/i, "");
  url = url.replace(/\/+$/, "");

  if (!/\/v\d+$/i.test(url)) {
    url = `${url}/v1`;
  }

  return url;
}

export function safeJsonParse(text) {
  try {
    return JSON.parse(text);
  } catch {
    return { rawText: text };
  }
}
