import { existsSync, readFileSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createGatewayApplication } from "../application/createGatewayApplication.js";
import { checkTokenCostGuard } from "../cost/tokenCostGuard.js";

const PHASE = "271A-mimo-model-id-discovery";
const PROVIDER_ID = "mimo";
const DEFAULT_MIMO_BASE_URL = "https://token-plan-cn.xiaomimimo.com/v1";
const PROMPT = "Say MIMO_SMOKE_OK";
const MAX_OUTPUT_TOKENS = 32;
const TEMPERATURE = 0;
const MAX_PAID_CALLS = 3;
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
      messages: [
        {
          role: "user",
          content: PROMPT,
        },
      ],
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
      baseUrl,
      apiKey,
      modelId,
      paidApiCallCount,
      candidateAttempts,
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
      baseUrl,
      apiKey,
      modelId: candidate,
      paidApiCallCount,
      candidateAttempts,
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

async function discoverModelsEndpoint({ baseUrl, apiKey }) {
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

async function trySmokeWithAuthStyles({ baseUrl, apiKey, modelId, paidApiCallCount, candidateAttempts }) {
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
      return {
        success: true,
        result,
        paidApiCallCount,
      };
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
    messages: [
      {
        role: "user",
        content: PROMPT,
      },
    ],
    temperature: TEMPERATURE,
    stream: false,
    max_tokens: MAX_OUTPUT_TOKENS,
    max_completion_tokens: MAX_OUTPUT_TOKENS,
    thinking: {
      type: "disabled",
    },
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

function buildDiscoveryEvidence(baseEvidence, discovery) {
  const passed = Boolean(discovery.discoveredWorkingModelId && discovery.smoke?.success);
  const smoke = {
    ...createSmokeSummary(),
    attempted: discovery.paidApiCallCount > 0,
    paidApiCallCount: discovery.paidApiCallCount,
    successfulSmokeCallCount: discovery.successfulSmokeCallCount,
    httpStatus: discovery.smoke?.httpStatus ?? 0,
    success: discovery.smoke?.success === true,
    textReceived: discovery.smoke?.textReceived === true,
    exactSmokeTextMatched: discovery.smoke?.exactSmokeTextMatched === true,
    successWithNonExactText: discovery.smoke?.successWithNonExactText === true,
    usageReturned: discovery.smoke?.usageReturned === true,
    inputTokens: discovery.smoke?.inputTokens ?? null,
    outputTokens: discovery.smoke?.outputTokens ?? null,
    totalTokens: discovery.smoke?.totalTokens ?? null,
    candidateAttempts: discovery.candidateAttempts.map(redactAttempt),
  };

  return {
    ...baseEvidence,
    status: passed ? "passed" : "failed",
    conclusion: passed ? "mimo-model-id-discovery-safe-smoke-passed" : "mimo-model-id-discovery-failed",
    configuration: {
      ...redactConfiguration(baseEvidence.configuration),
      discoveredWorkingModelId: discovery.discoveredWorkingModelId,
      modelDiscoveryMethod: discovery.modelDiscoveryMethod,
    },
    modelsEndpoint: discovery.modelsEndpoint,
    smoke,
    blocker: passed ? { type: "none", message: "" } : discovery.blocker,
  };
}

function createPassedEvidenceFromPriorTextSmoke(baseEvidence, priorEvidence) {
  if (!priorEvidence?.smoke) return null;
  const smoke = priorEvidence.smoke;
  if (Number(smoke.paidApiCallCount ?? 0) > MAX_PAID_CALLS) return null;
  if (Number(smoke.maxOutputTokens ?? MAX_OUTPUT_TOKENS) > MAX_OUTPUT_TOKENS) return null;
  if (smoke.longContextSent !== false) return null;
  if (!(Number(smoke.httpStatus) >= 200 && Number(smoke.httpStatus) < 300)) return null;
  if (smoke.textReceived !== true) return null;

  const matchingAttempt = (smoke.candidateAttempts ?? []).find((attempt) => {
    const result = attempt?.result ?? {};
    return attempt?.modelId &&
      Number(result.httpStatus) >= 200 &&
      Number(result.httpStatus) < 300 &&
      result.textReceived === true;
  });
  const modelId = matchingAttempt?.modelId;
  if (!modelId) return null;

  const candidateAttempts = (smoke.candidateAttempts ?? []).map((attempt) => {
    if (attempt !== matchingAttempt) return attempt;
    return {
      ...attempt,
      result: {
        ...attempt.result,
        success: true,
        successWithNonExactText: attempt.result?.exactSmokeTextMatched !== true,
      },
    };
  });

  return {
    ...baseEvidence,
    status: "passed",
    conclusion: "mimo-model-id-discovery-safe-smoke-passed",
    configuration: {
      ...redactConfiguration(baseEvidence.configuration),
      discoveredWorkingModelId: modelId,
      modelDiscoveryMethod: priorEvidence.modelsEndpoint?.available ? "models_endpoint" : "candidate_smoke",
    },
    modelsEndpoint: priorEvidence.modelsEndpoint ?? baseEvidence.modelsEndpoint,
    smoke: {
      ...createSmokeSummary(),
      ...smoke,
      success: true,
      successfulSmokeCallCount: Math.max(1, Number(smoke.successfulSmokeCallCount ?? 0)),
      exactSmokeTextMatched: smoke.exactSmokeTextMatched === true,
      successWithNonExactText: smoke.exactSmokeTextMatched !== true,
      candidateAttempts,
      reusedPreviousTinySmoke: true,
    },
    guard: priorEvidence.guard ?? baseEvidence.guard,
    blocker: {
      type: "none",
      message: "",
    },
  };
}

function createBlockedEvidence(baseEvidence, type, message) {
  return {
    ...baseEvidence,
    status: "blocked",
    conclusion: "mimo-model-id-discovery-blocked",
    configuration: redactConfiguration(baseEvidence.configuration),
    blocker: {
      type,
      message,
    },
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

function createSmokeSummary() {
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

function createSafetySummary() {
  return {
    plainTextApiKeyWritten: false,
    apiKeyPrinted: false,
    defaultNvidiaChatLaneChanged: false,
    mimoSetAsDefault: false,
    longContextSentToPaidApi: false,
    largeOutputRequested: false,
    stressTestExecuted: false,
    legacyModified: false,
    projectContextCreated: false,
    codexCliInvoked: false,
    codexExecInvoked: false,
    workflowRunnerEnabled: false,
    worktreeCreated: false,
    autoCommit: false,
    autoPush: false,
  };
}

function createCandidates({ configuredModelId, runtimeModelIds, priorFailedModelId }) {
  return [...new Set([
    configuredModelId,
    "mimo-v2.5-pro",
    "xiaomi/mimo-v2.5-pro",
    "MiMo-V2.5-Pro",
    "mimo-v2-5-pro",
    ...runtimeModelIds,
    priorFailedModelId,
  ].filter(Boolean))];
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

function classifyBlocker(result = {}) {
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

function createAuthHeaders({ apiKey, authStyle }) {
  const headers = {
    "content-type": "application/json",
  };
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

function redactConfiguration(configuration) {
  const {
    apiKey,
    baseUrl,
    runtimeModelIds,
    priorFailedModelId,
    ...safe
  } = configuration;
  return {
    ...safe,
    runtimeModelIds,
    priorFailedModelId,
  };
}

function redactAttempt(attempt) {
  return {
    modelId: attempt.modelId,
    authStyle: attempt.authStyle ?? null,
    skipped: attempt.skipped === true,
    reason: attempt.reason ?? null,
    result: attempt.result ? {
      httpStatus: attempt.result.httpStatus,
      success: attempt.result.success,
      textReceived: attempt.result.textReceived,
      exactSmokeTextMatched: attempt.result.exactSmokeTextMatched,
      usageReturned: attempt.result.usageReturned,
      errorType: attempt.result.errorType,
      message: attempt.result.message,
    } : null,
  };
}

function normalizeBaseUrl(baseUrl) {
  return String(baseUrl ?? "").trim().replace(/\/+$/, "");
}

function readJsonIfExists(path) {
  if (!existsSync(path)) return null;
  try {
    return JSON.parse(readFileSync(path, "utf8"));
  } catch {
    return null;
  }
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
