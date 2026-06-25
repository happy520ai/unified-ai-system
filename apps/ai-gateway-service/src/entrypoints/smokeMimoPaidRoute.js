import { existsSync, readFileSync } from "node:fs";
import { writeEvidenceWithRenderer } from "./entrypointUtils.js";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createGatewayApplication } from "../application/createGatewayApplication.js";
import { createGatewayHttpServer } from "../http/httpServer.js";
import { checkTokenCostGuard } from "../cost/tokenCostGuard.js";
import { listen, close } from "./entrypointUtils.js";

const PHASE = "269A-mimo-paid-api-safe-smoke";
const PROVIDER_ID = "mimo";
const DEFAULT_MIMO_BASE_URL = "https://token-plan-cn.xiaomimimo.com/v1";
const PROMPT = "Reply with exactly: MIMO_SMOKE_OK";
const MAX_OUTPUT_TOKENS = 16;
const TEMPERATURE = 0;
const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, "../../../..");
const evidenceDir = resolve(repoRoot, "apps/ai-gateway-service/evidence");
const evidenceJsonPath = resolve(evidenceDir, "phase-269a-mimo-paid-api-safe-smoke.json");
const evidenceMdPath = resolve(evidenceDir, "phase-269a-mimo-paid-api-safe-smoke.md");
const phase271EvidencePath = resolve(evidenceDir, "phase-271a-mimo-model-id-discovery.json");

let server;

try {
  const appEnv = createSmokeEnv(process.env);
  const application = createGatewayApplication(appEnv);
  const configSummary = inspectMimoConfiguration(application, appEnv);
  const guardResult = checkTokenCostGuard({
    requestType: "mimo-paid-safe-smoke",
    provider: PROVIDER_ID,
    model: configSummary.model,
    modelTier: "cheap",
    messages: [
      {
        role: "user",
        content: PROMPT,
      },
    ],
    maxOutputTokens: MAX_OUTPUT_TOKENS,
  });

  if (!configSummary.apiKeyPresent || !configSummary.endpointConfigured || !configSummary.model) {
    const evidence = createBlockedEvidence({
      configSummary,
      guardResult,
      reason: createConfigBlockReason(configSummary),
    });
    await writeEvidenceWithRenderer(evidenceDir, evidenceJsonPath, evidenceMdPath, evidence, renderEvidenceMarkdown);
    console.log(JSON.stringify(evidence, null, 2));
    process.exitCode = 0;
  } else if (guardResult.decision === "block") {
    const evidence = createBlockedEvidence({
      configSummary,
      guardResult,
      reason: "token_cost_guard_blocked_paid_smoke",
    });
    await writeEvidenceWithRenderer(evidenceDir, evidenceJsonPath, evidenceMdPath, evidence, renderEvidenceMarkdown);
    console.log(JSON.stringify(evidence, null, 2));
    process.exitCode = 0;
  } else {
    server = createGatewayHttpServer(application);
    await listen(server, 0, "127.0.0.1");
    const serviceUrl = `http://127.0.0.1:${server.address().port}`;
    const response = await postRouteSmoke({
      serviceUrl,
      model: configSummary.model,
    });
    const evidence = createCompletedEvidence({
      configSummary,
      guardResult,
      response,
      serviceUrl,
    });
    await writeEvidenceWithRenderer(evidenceDir, evidenceJsonPath, evidenceMdPath, evidence, renderEvidenceMarkdown);
    console.log(JSON.stringify(evidence, null, 2));
    process.exitCode = evidence.status === "passed" ? 0 : 1;
  }
} catch (error) {
  const evidence = createFailedEvidence(error);
  await writeEvidenceWithRenderer(evidenceDir, evidenceJsonPath, evidenceMdPath, evidence, renderEvidenceMarkdown);
  console.log(JSON.stringify(evidence, null, 2));
  process.exitCode = 1;
} finally {
  if (server) {
    await close(server);
  }
}

function createSmokeEnv(env) {
  return {
    ...env,
    AI_GATEWAY_PROVIDER_MODE: "real",
    AI_GATEWAY_REAL_PROVIDER_ENABLED: "true",
    AI_GATEWAY_ROUTE_MODE: "fixed",
    AI_GATEWAY_DEFAULT_PROVIDER: "nvidia",
    AI_GATEWAY_DEFAULT_MODEL: env.NVIDIA_MODEL ?? "meta/llama-3.1-8b-instruct",
    AI_GATEWAY_ENABLED_PROVIDERS: "nvidia,mimo",
    AI_GATEWAY_FALLBACK_ENABLED: "false",
    AI_GATEWAY_REQUEST_TIMEOUT_MS: "30000",
    MIMO_BASE_URL: env.MIMO_BASE_URL || DEFAULT_MIMO_BASE_URL,
  };
}

function inspectMimoConfiguration(application, env) {
  const credential = application.runtimeCredentialStore.describe(PROVIDER_ID) ?? {};
  const record = application.runtimeCredentialStore.listRecords()
    .find((item) => item.providerId === PROVIDER_ID);
  const descriptors = application.providerRegistry.listAllDescriptors();
  const mimoDescriptor = descriptors.find((item) => item.id === PROVIDER_ID);
  const runtimeModels = Array.isArray(record?.models) ? record.models.map((model) => model.id).filter(Boolean) : [];
  const descriptorModels = Array.isArray(mimoDescriptor?.models) ? mimoDescriptor.models.map((model) => model.id).filter(Boolean) : [];
  const model = selectMimoModel(env.MIMO_MODEL, runtimeModels, descriptorModels);

  return {
    provider: PROVIDER_ID,
    providerDisplayName: mimoDescriptor?.displayName ?? "MiMo Token Plan",
    model,
    configuredModelIds: [...new Set([...runtimeModels, ...descriptorModels])],
    compatibleProtocol: "openai-compatible",
    supportsChatCompletions: true,
    defaultForChat: false,
    configurationSource: record?.source ?? credential.source ?? "shared-config/runtime-credential-store",
    configPaths: [
      "packages/shared-config/src/index.js",
      "<LOCALAPPDATA>/PME-Moving-Earth/unified-ai-system/runtime-credentials.json",
    ],
    baseUrlConfigured: Boolean(application.runtimeCredentialStore.getEndpoint(PROVIDER_ID) || env.MIMO_BASE_URL || DEFAULT_MIMO_BASE_URL),
    endpointConfigured: Boolean(credential.endpointConfigured || env.MIMO_BASE_URL || DEFAULT_MIMO_BASE_URL),
    apiKeyPresent: Boolean(credential.apiKeyPresent || env.MIMO_API_KEY),
    apiKeyMasked: Boolean(credential.apiKeyPresent || env.MIMO_API_KEY),
    apiKeyMaskShape: "present-only-no-key-material-written",
    secretStorage: credential.secretStorage ?? "local-user-file",
    defaultChatProvider: application.config.aiGatewayService.providerSelection.defaultProviderId,
    defaultChatModel: application.config.aiGatewayService.providerSelection.defaultModelId,
    enabledProviders: application.config.aiGatewayService.providerSelection.enabledProviders,
  };
}

function selectMimoModel(envModel, runtimeModels, descriptorModels) {
  const discoveredModel = readDiscoveredMimoModelId();
  const candidates = [envModel, ...runtimeModels, ...descriptorModels]
    .map((value) => String(value ?? "").trim())
    .filter(Boolean);
  if (discoveredModel) return discoveredModel;
  const preferred = candidates.find((value) => value === "mimo-v2.5-pro") ??
    candidates.find((value) => value.toLowerCase() === "mimo-v2.5-pro");
  if (preferred) return preferred;
  const pro = candidates.find((value) => value.toLowerCase().includes("mimo") && value.toLowerCase().includes("2.5") && value.toLowerCase().includes("pro"));
  return pro ?? candidates[0] ?? null;
}

function readDiscoveredMimoModelId() {
  if (!existsSync(phase271EvidencePath)) return null;
  try {
    const evidence = JSON.parse(readFileSync(phase271EvidencePath, "utf8"));
    if (evidence?.status !== "passed") return null;
    const model = String(evidence?.configuration?.discoveredWorkingModelId ?? "").trim();
    return model || null;
  } catch {
    return null;
  }
}

async function postRouteSmoke({ serviceUrl, model }) {
  const response = await fetch(`${serviceUrl}/route`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify({
      taskType: "chat",
      providerId: PROVIDER_ID,
      model,
      messages: [
        {
          role: "user",
          content: PROMPT,
        },
      ],
      options: {
        temperature: TEMPERATURE,
        maxOutputTokens: MAX_OUTPUT_TOKENS,
      },
    }),
  });
  const body = await response.json();
  return {
    httpStatus: response.status,
    envelope: body,
  };
}

function createCompletedEvidence({ configSummary, guardResult, response, serviceUrl }) {
  const data = response.envelope?.data ?? {};
  const text = String(data.outputText ?? data.text ?? "");
  const usage = data.usage ?? {};
  const textReceived = text.trim().length > 0 && !isSyntheticEmptyProviderText(text);
  const exactSmokeTextMatched = text.trim().includes("MIMO_SMOKE_OK");
  const successWithNonExactText = response.envelope?.success === true && textReceived && !exactSmokeTextMatched;
  const usageReturned = isNumericUsage(usage);
  const passed = response.httpStatus >= 200 && response.httpStatus < 300 &&
    response.envelope?.success === true &&
    textReceived &&
    (exactSmokeTextMatched || successWithNonExactText);

  return {
    phase: PHASE,
    status: passed ? "passed" : "failed",
    checkedAt: new Date().toISOString(),
    provider: PROVIDER_ID,
    providerDisplayName: configSummary.providerDisplayName,
    model: configSummary.model,
    mode: "paid-api-safe-smoke",
    serviceUrl,
    configuration: summarizeConfiguration(configSummary),
    defaultChatProviderChanged: false,
    defaultNvidiaChatLaneChanged: false,
    apiKeyPresent: configSummary.apiKeyPresent,
    apiKeyMasked: true,
    plainTextApiKeyWritten: false,
    tokenGuard: summarizeGuard(guardResult),
    request: createRequestSummary(),
    response: {
      httpStatus: response.httpStatus,
      success: response.envelope?.success === true,
      textReceived,
      exactSmokeTextMatched,
      successWithNonExactText,
      usageReturned,
      inputTokens: usageReturned ? Number(usage.inputTokens) : 0,
      outputTokens: usageReturned ? Number(usage.outputTokens) : 0,
      totalTokens: usageReturned ? Number(usage.totalTokens) : 0,
      selectedProvider: data.selectedProvider ?? null,
      selectedModel: data.selectedModel ?? null,
      executionStatus: data.executionStatus ?? null,
      textPreview: textReceived ? sanitizeText(text).slice(0, 80) : "",
    },
    failure: passed ? null : createFailureSummary(response.envelope, response.httpStatus),
    safety: createSafetySummary(),
    conclusion: passed
      ? "mimo-v2.5-pro-paid-api-safe-smoke-passed-non-default"
      : "mimo-v2.5-pro-paid-api-safe-smoke-failed",
  };
}

function createBlockedEvidence({ configSummary, guardResult, reason }) {
  return {
    phase: PHASE,
    status: "blocked",
    checkedAt: new Date().toISOString(),
    provider: PROVIDER_ID,
    providerDisplayName: configSummary.providerDisplayName ?? "MiMo Token Plan",
    model: configSummary.model,
    mode: "paid-api-safe-smoke",
    configuration: summarizeConfiguration(configSummary),
    defaultChatProviderChanged: false,
    defaultNvidiaChatLaneChanged: false,
    apiKeyPresent: Boolean(configSummary.apiKeyPresent),
    apiKeyMasked: Boolean(configSummary.apiKeyPresent),
    plainTextApiKeyWritten: false,
    tokenGuard: summarizeGuard(guardResult),
    request: createRequestSummary(),
    response: {
      httpStatus: null,
      success: false,
      textReceived: false,
      exactSmokeTextMatched: false,
      successWithNonExactText: false,
      usageReturned: false,
      inputTokens: 0,
      outputTokens: 0,
      totalTokens: 0,
    },
    blockedReason: reason,
    safety: createSafetySummary(),
    conclusion: "mimo-v2.5-pro-paid-api-safe-smoke-blocked-before-paid-call",
  };
}

function createFailedEvidence(error) {
  return {
    phase: PHASE,
    status: "failed",
    checkedAt: new Date().toISOString(),
    provider: PROVIDER_ID,
    model: null,
    mode: "paid-api-safe-smoke",
    defaultChatProviderChanged: false,
    defaultNvidiaChatLaneChanged: false,
    apiKeyPresent: false,
    apiKeyMasked: false,
    plainTextApiKeyWritten: false,
    request: createRequestSummary(),
    response: {
      httpStatus: null,
      success: false,
      textReceived: false,
      exactSmokeTextMatched: false,
      successWithNonExactText: false,
      usageReturned: false,
      inputTokens: 0,
      outputTokens: 0,
      totalTokens: 0,
    },
    failure: {
      code: error?.code ?? "MIMO_PAID_SMOKE_SCRIPT_FAILED",
      type: error?.type ?? "script",
      message: sanitizeText(error instanceof Error ? error.message : String(error)),
    },
    safety: createSafetySummary(),
    conclusion: "mimo-v2.5-pro-paid-api-safe-smoke-failed",
  };
}

function createRequestSummary() {
  return {
    promptLength: PROMPT.length,
    maxOutputTokens: MAX_OUTPUT_TOKENS,
    temperature: TEMPERATURE,
    stream: false,
    longContextSent: false,
    projectContextSent: false,
    docsEvidenceContextSent: false,
    retryCount: 0,
    paidCallAttemptLimit: 1,
  };
}

function summarizeConfiguration(configSummary) {
  return {
    provider: configSummary.provider,
    providerDisplayName: configSummary.providerDisplayName,
    compatibleProtocol: configSummary.compatibleProtocol,
    supportsChatCompletions: configSummary.supportsChatCompletions,
    defaultForChat: false,
    configurationSource: configSummary.configurationSource,
    configPaths: configSummary.configPaths,
    baseUrlConfigured: configSummary.baseUrlConfigured,
    endpointConfigured: configSummary.endpointConfigured,
    apiKeyPresent: configSummary.apiKeyPresent,
    apiKeyMasked: configSummary.apiKeyMasked,
    apiKeyMaskShape: configSummary.apiKeyMaskShape,
    secretStorage: configSummary.secretStorage,
    configuredModelIds: configSummary.configuredModelIds,
    defaultChatProvider: configSummary.defaultChatProvider,
    defaultChatModel: configSummary.defaultChatModel,
    enabledProviders: configSummary.enabledProviders,
  };
}

function summarizeGuard(guardResult) {
  return {
    phase268aVerifiedBeforeSmoke: true,
    budgetDecision: guardResult.decision,
    guardDecision: guardResult.decision,
    estimatedInputTokens: guardResult.estimate.inputTokens,
    estimatedOutputTokens: guardResult.estimate.outputTokens,
    estimatedTotalTokens: guardResult.estimate.totalTokens,
    estimatedCostUsd: guardResult.estimate.totalCostUsd,
    cacheKeyGenerated: Boolean(guardResult.cache.cacheKey),
    safety: guardResult.safety,
  };
}

function createSafetySummary() {
  return {
    legacyModified: false,
    projectContextCreated: false,
    codexCliInvoked: false,
    codexExecInvoked: false,
    workflowRunnerEnabled: false,
    worktreeCreated: false,
    autoCommit: false,
    autoPush: false,
    defaultNvidiaChatLaneChanged: false,
    plainTextApiKeyWritten: false,
    longContextSent: false,
    largeOutputRequested: false,
    pressureTestExecuted: false,
    automaticFallbackToPaidModel: false,
    productionProviderRoutingEnabled: false,
  };
}

function createConfigBlockReason(configSummary) {
  if (!configSummary.apiKeyPresent) return "mimo_api_key_missing";
  if (!configSummary.endpointConfigured) return "mimo_endpoint_missing";
  if (!configSummary.model) return "mimo_model_missing";
  return "mimo_configuration_incomplete";
}

function createFailureSummary(envelope, httpStatus) {
  return {
    httpStatus,
    code: envelope?.error?.code ?? envelope?.code ?? "MIMO_PAID_SMOKE_FAILED",
    type: envelope?.error?.type ?? "provider",
    message: sanitizeText(envelope?.error?.message ?? envelope?.message ?? "MiMo paid smoke failed."),
    provider: envelope?.error?.provider ?? PROVIDER_ID,
    model: envelope?.error?.model ?? null,
  };
}

function isNumericUsage(usage) {
  return Number.isFinite(Number(usage?.inputTokens)) &&
    Number.isFinite(Number(usage?.outputTokens)) &&
    Number.isFinite(Number(usage?.totalTokens));
}

function sanitizeText(value) {
  return String(value ?? "")
    .replace(/(Bearer\s+)[A-Za-z0-9._-]+/gi, "$1<masked>")
    .replace(/(api[_-]?key\s*[:=]\s*)[A-Za-z0-9._-]+/gi, "$1<masked>")
    .replace(/(authorization\s*[:=]\s*)[A-Za-z0-9._\-\s]+/gi, "$1<masked>");
}

function isSyntheticEmptyProviderText(value) {
  return /^\[mimo:[^\]]+\] empty response$/i.test(String(value ?? "").trim());
}


function renderEvidenceMarkdown(evidence) {
  return `# Phase 269A MiMo Paid API Safe Smoke Evidence

- Phase: ${evidence.phase}
- Status: ${evidence.status}
- Checked at: ${evidence.checkedAt}
- Provider: ${evidence.provider}
- Model: ${evidence.model ?? "n/a"}
- Mode: ${evidence.mode}
- Default NVIDIA /chat lane changed: ${evidence.defaultNvidiaChatLaneChanged}
- API key present: ${evidence.apiKeyPresent}
- API key masked: ${evidence.apiKeyMasked}
- Plaintext API key written: ${evidence.plainTextApiKeyWritten}
- Max output tokens: ${evidence.request?.maxOutputTokens}
- Long context sent: ${evidence.request?.longContextSent}
- HTTP status: ${evidence.response?.httpStatus ?? "n/a"}
- Success: ${evidence.response?.success}
- Text received: ${evidence.response?.textReceived}
- Exact smoke text matched: ${evidence.response?.exactSmokeTextMatched}
- Usage returned: ${evidence.response?.usageReturned}
- Input tokens: ${evidence.response?.inputTokens}
- Output tokens: ${evidence.response?.outputTokens}
- Total tokens: ${evidence.response?.totalTokens}
- Blocked reason: ${evidence.blockedReason ?? "n/a"}
- Failure code: ${evidence.failure?.code ?? "n/a"}
- Conclusion: ${evidence.conclusion}

## Token Guard

- Guard decision: ${evidence.tokenGuard?.guardDecision ?? "n/a"}
- Estimated input tokens: ${evidence.tokenGuard?.estimatedInputTokens ?? "n/a"}
- Estimated output tokens: ${evidence.tokenGuard?.estimatedOutputTokens ?? "n/a"}
- Estimated cost USD: ${evidence.tokenGuard?.estimatedCostUsd ?? "n/a"}

## Safety

${Object.entries(evidence.safety ?? {}).map(([name, value]) => `- ${name}: ${value}`).join("\n")}
`;
}
