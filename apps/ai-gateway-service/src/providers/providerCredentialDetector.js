import { PROVIDER_CATALOG } from "./providerCatalog.js";
import {
  createCapabilitySummary,
  createDetectionWarnings,
  extractRuntimeCredentialEndpoint,
  pickRecommendedCandidate,
} from "./providerDetectionResult.js";
import {
  createDetectionCandidate,
  findTokenByPrefix,
  matchProviderFamilies,
} from "./providerModelDiscovery.js";

export { extractRuntimeCredentialEndpoint };

export async function detectRuntimeCredentialProviders(application, body = {}) {
  const apiKey = String(body?.apiKey ?? "").trim();
  if (!apiKey) {
    const error = new Error("apiKey is required.");
    error.code = "provider_runtime_credential_detect_api_key_required";
    error.category = "validation";
    throw error;
  }

  const preferredProviderId = String(body?.preferredProviderId ?? "").trim();
  const allowModelListProbe = body?.allowModelListProbe === true || body?.probePolicy === "bounded-model-list";
  const matches = matchProviderFamilies(apiKey, preferredProviderId);
  const detected = [];
  let networkProbePerformed = false;

  for (const match of matches) {
    const extractedApiKey = extractRuntimeCredentialSecret(match.family.providerId, apiKey);
    const candidate = await createDetectionCandidate(application, match.family, {
      apiKey: extractedApiKey,
      rawCredential: apiKey,
      matchedPrefix: match.prefix,
      preferredProviderId,
      allowModelListProbe,
      rawCredentialWasParsed: extractedApiKey !== apiKey,
    });
    if (candidate) {
      detected.push(candidate);
      networkProbePerformed = networkProbePerformed || candidate.modelDiscovery?.networkProbePerformed === true;
    }
  }

  const available = detected
    .flatMap((candidate) => candidate.models.map((model) => ({ candidate, model })))
    .filter(({ candidate, model }) => candidate.availableForChat && candidate.supportedByRuntime && model.execution?.chat === true);
  const recommended = pickRecommendedCandidate(available);
  const capabilitySummary = createCapabilitySummary(detected);

  return {
    success: true,
    apiKeyPresent: true,
    secretStorage: "not-stored",
    mode: networkProbePerformed ? "provider-model-discovery" : "safe-catalog-detection",
    detected,
    recommended,
    capabilitySummary,
    warnings: createDetectionWarnings({ apiKey, detected, recommended, capabilitySummary, allowModelListProbe }),
    safety: {
      apiKeyStored: false,
      apiKeyLogged: false,
      providerProbePerformed: networkProbePerformed,
      networkProbePerformed,
      ambiguousKeySprayPrevented: detected.some((candidate) => candidate.requiresProviderChoice),
      modelListProbeEnabled: allowModelListProbe,
      probePolicy: allowModelListProbe ? "explicit-bounded-model-list" : "safe-prefix-catalog",
      fakeProviderExcludedFromRealKeyFallback: true,
      defaultChatMainLaneChanged: false,
    },
  };
}

export function extractRuntimeCredentialSecret(providerId, rawCredential) {
  const raw = String(rawCredential ?? "").trim();
  if (!raw) return raw;

  const family = PROVIDER_CATALOG.find((item) => item.providerId === providerId);
  if (!family) return raw;

  for (const pattern of family.credentialPatterns ?? []) {
    const match = raw.match(pattern.pattern);
    if (match?.[1]) return match[1];
    if (match?.[0]) return match[0];
  }

  for (const prefix of family.prefixes ?? []) {
    const match = findTokenByPrefix(raw, prefix.value);
    if (match) return match;
  }

  if (
    providerId === "tencent-hunyuan" ||
    providerId === "siliconflow" ||
    providerId === "dashscope" ||
    providerId === "openai" ||
    providerId === "generic-openai-compatible" ||
    providerId === "cohere" ||
    providerId === "volcengine-doubao" ||
    providerId === "minimax" ||
    providerId === "stepfun" ||
    providerId === "novita" ||
    providerId === "baichuan" ||
    providerId === "yi" ||
    providerId === "infini-ai"
  ) {
    const skToken = findTokenByPrefix(raw, "sk-");
    if (skToken) return skToken;
  }

  return raw;
}
