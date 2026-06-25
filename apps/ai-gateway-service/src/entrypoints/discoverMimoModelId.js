import { existsSync, readFileSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createGatewayApplication } from "../application/createGatewayApplication.js";
import { checkTokenCostGuard } from "../cost/tokenCostGuard.js";
import {
  discoverModelsEndpoint,
  trySmokeWithAuthStyles,
  createSmokeSummary,
  classifyBlocker,
  MAX_PAID_CALLS,
  MAX_OUTPUT_TOKENS,
} from "./mimoDiscoveryHttp.js";
import {
  buildDiscoveryEvidence,
  createPassedEvidenceFromPriorTextSmoke,
  createBlockedEvidence,
  createModelsEndpointSummary,
  createSafetySummary,
  createCandidates,
} from "./mimoDiscoveryEvidence.js";

const PHASE = "271A-mimo-model-id-discovery";
const PROVIDER_ID = "mimo";
const DEFAULT_MIMO_BASE_URL = "https://token-plan-cn.xiaomimimo.com/v1";
const PROMPT = "Say MIMO_SMOKE_OK";
const TEMPERATURE = 0;
export { MAX_PAID_CALLS, MAX_OUTPUT_TOKENS };
const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, "../../../..");
const evidenceDir = resolve(repoRoot, "apps/ai-gateway-service/evidence");
const evidenceJsonPath = resolve(evidenceDir, "phase-271a-mimo-model-id-discovery.json");
const evidenceMdPath = resolve(evidenceDir, "phase-271a-mimo-model-id-discovery.md");
const phase269EvidencePath = resolve(evidenceDir, "phase-269a-mimo-paid-api-safe-smoke.json");

try {
  const previous271Evidence = readJsonIfExists(evidenceJsonPath);
  const application = createGatewayApplication(createDiscoveryEnv(process.env));
  const configuration = readMimoConfiguration(application);
  const guard = runGuard(configuration.configuredModelId ?? "mimo-v2.5-pro");
  const baseEvidence = {
    phase: PHASE,
    generatedAt: new Date().toISOString(),
    provider: PROVIDER_ID,
    configuredButNotDefault: true,
    defaultProvider: "nvidia",
    defaultNvidiaChatLaneChanged: false,
    mimoSetAsDefault: false,
    configuration,
    modelsEndpoint: createModelsEndpointSummary(),
    smoke: createSmokeSummary(),
    guard,
    blocker: {
      type: "unknown",
      message: "",
    },
    safety: createSafetySummary(),
  };

  if (!configuration.apiKeyPresent) {
    await finish(createBlockedEvidence(baseEvidence, "auth_failed", "MiMo API key is not present."));
  } else if (!configuration.baseUrlPresent) {
    await finish(createBlockedEvidence(baseEvidence, "base_url_invalid", "MiMo base URL is not configured."));
  } else if (guard.guardDecision === "block") {
    await finish(createBlockedEvidence(baseEvidence, "unknown", "Token Cost Guard blocked the tiny smoke request."));
  } else if (guard.guardDecision === "require_approval") {
    await finish(createBlockedEvidence(baseEvidence, "unknown", "Token Cost Guard requires approval; no paid call was made."));
  } else {
    const priorTextSmoke = createPassedEvidenceFromPriorTextSmoke(baseEvidence, previous271Evidence);
    if (priorTextSmoke) {
      await finish(priorTextSmoke);
    } else {
      const discovery = await discoverWorkingModelId({
        baseUrl: configuration.baseUrl,
        apiKey: configuration.apiKey,
        configuredModelId: configuration.configuredModelId,
        runtimeModelIds: configuration.runtimeModelIds,
        priorFailedModelId: configuration.priorFailedModelId,
        initialPaidApiCallCount: Number(previous271Evidence?.smoke?.paidApiCallCount ?? 0),
      });
      const evidence = buildDiscoveryEvidence(baseEvidence, discovery);
      await finish(evidence);
    }
  }
} catch (error) {
  await finish({
    phase: PHASE,
    status: "failed",
    conclusion: "mimo-model-id-discovery-failed",
    generatedAt: new Date().toISOString(),
    provider: PROVIDER_ID,
    configuredButNotDefault: true,
    defaultProvider: "nvidia",
    defaultNvidiaChatLaneChanged: false,
    mimoSetAsDefault: false,
    configuration: {
      baseUrlPresent: false,
      apiKeyPresent: false,
      apiKeyMasked: false,
      configuredModelId: null,
      discoveredWorkingModelId: null,
      modelDiscoveryMethod: "not_found",
    },
    modelsEndpoint: createModelsEndpointSummary(),
    smoke: createSmokeSummary(),
    guard: {
      tokenCostGuardUsed: false,
      guardDecision: "unavailable",
      estimatedInputTokens: 0,
      estimatedOutputTokens: MAX_OUTPUT_TOKENS,
      estimatedTotalTokens: 0,
    },
    blocker: {
      type: "unknown",
      message: sanitizeMessage(error instanceof Error ? error.message : String(error)),
    },
    safety: createSafetySummary(),
  });
  process.exitCode = 1;
}

function createDiscoveryEnv(env) {
  return {
    ...env,
    AI_GATEWAY_PROVIDER_MODE: "real",
    AI_GATEWAY_REAL_PROVIDER_ENABLED: "true",
    AI_GATEWAY_ROUTE_MODE: "fixed",
    AI_GATEWAY_DEFAULT_PROVIDER: "nvidia",
    AI_GATEWAY_DEFAULT_MODEL: env.NVIDIA_MODEL ?? "nvidia/llama-3.3-nemotron-super-49b-v1",
    AI_GATEWAY_ENABLED_PROVIDERS: "nvidia,mimo",
    AI_GATEWAY_FALLBACK_ENABLED: "false",
    AI_GATEWAY_REQUEST_TIMEOUT_MS: "30000",
    MIMO_BASE_URL: env.MIMO_BASE_URL || DEFAULT_MIMO_BASE_URL,
  };
}

function readMimoConfiguration(application) {
  const credential = application.runtimeCredentialStore.describe(PROVIDER_ID) ?? {};
  const record = application.runtimeCredentialStore.listRecords()
    .find((item) => item.providerId === PROVIDER_ID);
  const descriptors = application.providerRegistry.listAllDescriptors();
  const mimoDescriptor = descriptors.find((item) => item.id === PROVIDER_ID);
  const runtimeModelIds = Array.isArray(record?.models)
    ? record.models.map((model) => model.id).filter(Boolean)
    : [];
  const descriptorModelIds = Array.isArray(mimoDescriptor?.models)
    ? mimoDescriptor.models.map((model) => model.id).filter(Boolean)
    : [];
  const prior269 = readJsonIfExists(phase269EvidencePath);
  const priorFailedModelId = prior269?.status === "failed" && prior269?.failure?.message?.includes("Not supported model")
    ? prior269.model
    : null;
  const configuredModelId = process.env.MIMO_MODEL ||
    priorFailedModelId ||
    runtimeModelIds.find((id) => id.toLowerCase().includes("mimo")) ||
    descriptorModelIds[0] ||
    "mimo-model-from-console";

  return {
    baseUrlPresent: Boolean(application.runtimeCredentialStore.getEndpoint(PROVIDER_ID) || process.env.MIMO_BASE_URL || DEFAULT_MIMO_BASE_URL),
    apiKeyPresent: Boolean(credential.apiKeyPresent || process.env.MIMO_API_KEY),
    apiKeyMasked: Boolean(credential.apiKeyPresent || process.env.MIMO_API_KEY),
    configuredModelId,
    discoveredWorkingModelId: null,
    modelDiscoveryMethod: "not_found",
    compatibleProtocol: "openai-compatible",
    adapter: "HttpLLMProviderAdapter",
    defaultForChat: false,
    defaultProvider: application.config.aiGatewayService.providerSelection.defaultProviderId,
    runtimeModelIds,
    configuredCandidateModelIds: [...new Set([configuredModelId, ...runtimeModelIds, ...descriptorModelIds].filter(Boolean))],
    priorFailedModelId,
    baseUrl: application.runtimeCredentialStore.getEndpoint(PROVIDER_ID) || process.env.MIMO_BASE_URL || DEFAULT_MIMO_BASE_URL,
    apiKey: application.runtimeCredentialStore.getApiKey(PROVIDER_ID) || process.env.MIMO_API_KEY || "",
  };
}

function runGuard(model) {
  try {
    const result = checkTokenCostGuard({
      requestType: "mimo-model-id-discovery",
      provider: PROVIDER_ID,
      model,
      modelTier: "cheap",
      messages: [{ role: "user", content: PROMPT }],
      maxOutputTokens: MAX_OUTPUT_TOKENS,
    });
    return {
      tokenCostGuardUsed: true,
      guardDecision: result.decision,
      estimatedInputTokens: result.estimate.inputTokens,
      estimatedOutputTokens: result.estimate.outputTokens,
      estimatedTotalTokens: result.estimate.totalTokens,
      estimatedCostUsd: result.estimate.totalCostUsd,
    };
  } catch {
    const estimatedInputTokens = Math.ceil(PROMPT.length / 3);
    return {
      tokenCostGuardUsed: false,
      guardDecision: PROMPT.length <= 80 && MAX_OUTPUT_TOKENS <= 32 ? "allow" : "block",
      estimatedInputTokens,
      estimatedOutputTokens: MAX_OUTPUT_TOKENS,
      estimatedTotalTokens: estimatedInputTokens + MAX_OUTPUT_TOKENS,
      estimatedCostUsd: null,
    };
  }
}

async function discoverWorkingModelId({ baseUrl, apiKey, configuredModelId, runtimeModelIds, priorFailedModelId, initialPaidApiCallCount = 0 }) {
  const modelsEndpoint = await discoverModelsEndpoint({ baseUrl, apiKey });
  const candidateAttempts = [];
  let paidApiCallCount = initialPaidApiCallCount;
  let successfulSmokeCallCount = 0;

  if (modelsEndpoint.available && modelsEndpoint.matchingModels.length) {
    const modelId = modelsEndpoint.matchingModels[0];
    const smoke = await trySmokeWithAuthStyles({
      baseUrl, apiKey, modelId, paidApiCallCount, candidateAttempts,
    });
    paidApiCallCount = smoke.paidApiCallCount;
    successfulSmokeCallCount += smoke.success ? 1 : 0;
    return {
      modelsEndpoint,
      candidateAttempts,
      smoke: smoke.result,
      paidApiCallCount,
      successfulSmokeCallCount,
      discoveredWorkingModelId: smoke.success ? modelId : null,
      modelDiscoveryMethod: smoke.success ? "models_endpoint" : "error_response",
      blocker: smoke.success ? { type: "none", message: "" } : classifyBlocker(smoke.result),
    };
  }

  const candidates = createCandidates({ configuredModelId, runtimeModelIds, priorFailedModelId });
  for (const candidate of candidates) {
    if (paidApiCallCount >= MAX_PAID_CALLS) break;
    if (candidate === priorFailedModelId) {
      candidateAttempts.push({
        modelId: candidate,
        skipped: true,
        reason: "known_failed_from_phase269_evidence",
      });
      continue;
    }

    const smoke = await trySmokeWithAuthStyles({
      baseUrl, apiKey, modelId: candidate, paidApiCallCount, candidateAttempts,
    });
    paidApiCallCount = smoke.paidApiCallCount;
    successfulSmokeCallCount += smoke.success ? 1 : 0;

    if (smoke.success) {
      return {
        modelsEndpoint,
        candidateAttempts,
        smoke: smoke.result,
        paidApiCallCount,
        successfulSmokeCallCount,
        discoveredWorkingModelId: candidate,
        modelDiscoveryMethod: "candidate_smoke",
        blocker: { type: "none", message: "" },
      };
    }
  }

  const lastAttempt = [...candidateAttempts].reverse().find((attempt) => attempt.skipped !== true);
  return {
    modelsEndpoint,
    candidateAttempts,
    smoke: lastAttempt?.result ?? createSmokeSummary(),
    paidApiCallCount,
    successfulSmokeCallCount,
    discoveredWorkingModelId: null,
    modelDiscoveryMethod: modelsEndpoint.attempted ? "error_response" : "not_found",
    blocker: classifyBlocker(lastAttempt?.result ?? modelsEndpoint),
  };
}

function readJsonIfExists(path) {
  if (!existsSync(path)) return null;
  try {
    return JSON.parse(readFileSync(path, "utf8"));
  } catch {
    return null;
  }
}

function sanitizeMessage(value) {
  return String(value ?? "")
    .replace(/(Bearer\s+)[A-Za-z0-9._-]+/gi, "$1<masked>")
    .replace(/(api[-_]?key\s*[:=]\s*)[A-Za-z0-9._-]+/gi, "$1<masked>")
    .replace(/(authorization\s*[:=]\s*)[A-Za-z0-9._\-\s]+/gi, "$1<masked>")
    .slice(0, 500);
}

async function finish(evidence) {
  await mkdir(evidenceDir, { recursive: true });
  await writeFile(evidenceJsonPath, `${JSON.stringify(evidence, null, 2)}\n`, "utf8");
  await writeFile(evidenceMdPath, renderMarkdown(evidence), "utf8");
  console.log(JSON.stringify({
    phase: evidence.phase,
    status: evidence.status,
    conclusion: evidence.conclusion,
    provider: evidence.provider,
    configuredModelId: evidence.configuration?.configuredModelId,
    discoveredWorkingModelId: evidence.configuration?.discoveredWorkingModelId,
    discoveryMethod: evidence.configuration?.modelDiscoveryMethod,
    paidApiCallCount: evidence.smoke?.paidApiCallCount,
    successfulSmokeCallCount: evidence.smoke?.successfulSmokeCallCount,
    blocker: evidence.blocker,
    evidenceJsonPath,
    evidenceMdPath,
  }, null, 2));
  if (evidence.status !== "passed") {
    process.exitCode = 1;
  }
}

function renderMarkdown(evidence) {
  return `# Phase 271A MiMo Model ID Discovery Evidence

## Goal

Identify the working MiMo model id safely, without changing the default NVIDIA /chat lane and without writing plaintext API keys.

## Configuration

- Provider: ${evidence.provider}
- Configured but not default: ${evidence.configuredButNotDefault}
- Default provider: ${evidence.defaultProvider}
- Default NVIDIA /chat lane changed: ${evidence.defaultNvidiaChatLaneChanged}
- MiMo set as default: ${evidence.mimoSetAsDefault}
- Base URL present: ${evidence.configuration?.baseUrlPresent}
- API key present: ${evidence.configuration?.apiKeyPresent}
- API key masked: ${evidence.configuration?.apiKeyMasked}
- Current configured model id: ${evidence.configuration?.configuredModelId ?? "n/a"}
- Discovered working model id: ${evidence.configuration?.discoveredWorkingModelId ?? "n/a"}
- Model discovery method: ${evidence.configuration?.modelDiscoveryMethod ?? "n/a"}

## Models Endpoint

- Attempted: ${evidence.modelsEndpoint?.attempted}
- Available: ${evidence.modelsEndpoint?.available}
- Model count: ${evidence.modelsEndpoint?.modelCount}
- Matching models: ${(evidence.modelsEndpoint?.matchingModels ?? []).join(", ") || "none"}

## Tiny Smoke

- Attempted: ${evidence.smoke?.attempted}
- Paid API call count: ${evidence.smoke?.paidApiCallCount}
- Successful smoke call count: ${evidence.smoke?.successfulSmokeCallCount}
- Max output tokens: ${evidence.smoke?.maxOutputTokens}
- Temperature: ${evidence.smoke?.temperature}
- Stream: ${evidence.smoke?.stream}
- Long context sent: ${evidence.smoke?.longContextSent}
- HTTP status: ${evidence.smoke?.httpStatus}
- Success: ${evidence.smoke?.success}
- Text received: ${evidence.smoke?.textReceived}
- Exact smoke text matched: ${evidence.smoke?.exactSmokeTextMatched}
- Usage returned: ${evidence.smoke?.usageReturned}
- Input tokens: ${evidence.smoke?.inputTokens ?? "n/a"}
- Output tokens: ${evidence.smoke?.outputTokens ?? "n/a"}
- Total tokens: ${evidence.smoke?.totalTokens ?? "n/a"}

## Blocker

- Type: ${evidence.blocker?.type}
- Message: ${evidence.blocker?.message || "none"}

## Safety

${Object.entries(evidence.safety ?? {}).map(([key, value]) => `- ${key}: ${value}`).join("\n")}

No plaintext API key and no Authorization header are written in this evidence.
`;
}
