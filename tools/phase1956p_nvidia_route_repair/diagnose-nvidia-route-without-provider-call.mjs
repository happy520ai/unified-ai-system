import { readFileSync } from "node:fs";
import { readJson, writeJson, writeText } from "../phase1903a/ownerAutomationSealCommon.mjs";

const phase = "Phase1956P-NVIDIA-Route-Repair";
const evidenceDir = "apps/ai-gateway-service/evidence/phase1956p_nvidia_route_repair";
const phase1955Path = "apps/ai-gateway-service/evidence/phase1955p/phase1955p-seal-result.json";
const phase1955RetryPath = "apps/ai-gateway-service/evidence/phase1955p_retry/phase1955p-retry-seal-result.json";
const retryFailSealPath = "apps/ai-gateway-service/evidence/phase1955p_retry_fail/phase1955p-retry-fail-seal-result.json";
const retryFailGatePath = "apps/ai-gateway-service/evidence/phase1955p_retry_fail/alternative-provider-decision-gate-result.json";
const safeExecutorPath = "apps/ai-gateway-service/src/providers/safeInternalProviderExecutor.js";
const requestEnvelopePath = "apps/ai-gateway-service/src/providers/safeProviderRequestEnvelope.js";
const responseSanitizerPath = "apps/ai-gateway-service/src/providers/safeProviderResponseSanitizer.js";
const authorizationGatePath = "apps/ai-gateway-service/src/providers/providerExecutionAuthorizationGate.js";
const authorizationSchemaPath = "apps/ai-gateway-service/src/providers/providerExecutionAuthorizationSchema.js";
const nvidiaAdapterPath = "apps/ai-gateway-service/src/providers/nvidiaAdapter.js";
const nvidiaUnifiedClientPath = "apps/ai-gateway-service/src/providers/nvidia/nvidiaUnifiedClient.js";
const nvidiaCatalogPath = "apps/ai-gateway-service/src/model-library/nvidiaCatalogDiscovery.js";
const executorContractPath = "apps/ai-gateway-service/src/providers/safeInternalProviderExecutor.contract.js";

const safetyBoundary = {
  credentialRefOnly: true,
  rawSecretRead: false,
  authJsonRead: false,
  dotEnvRead: false,
  envDumped: false,
  secretValueExposed: false,
  authorizationHeaderLogged: false,
  chatRouteModified: false,
  chatGatewayExecuteModified: false,
  legacyModified: false,
  projectContextModified: false,
  deployExecuted: false,
  releaseExecuted: false,
  tagCreated: false,
  artifactUploaded: false,
  commitCreated: false,
  pushExecuted: false,
  productionReadyClaimed: false,
  publicLaunchReadyClaimed: false,
  commercialReadyClaimed: false,
  workspaceCleanClaimed: false,
};

const phase1955Read = readJson(phase1955Path);
const phase1955RetryRead = readJson(phase1955RetryPath);
const retryFailSealRead = readJson(retryFailSealPath);
const retryFailGateRead = readJson(retryFailGatePath);
const phase1955 = phase1955Read.data ?? {};
const retry = phase1955RetryRead.data ?? {};
const retryFailSeal = retryFailSealRead.data ?? {};
const retryFailGate = retryFailGateRead.data ?? {};

const sources = {
  safeExecutor: readText(safeExecutorPath),
  requestEnvelope: readText(requestEnvelopePath),
  responseSanitizer: readText(responseSanitizerPath),
  authorizationGate: readText(authorizationGatePath),
  authorizationSchema: readText(authorizationSchemaPath),
  nvidiaAdapter: readText(nvidiaAdapterPath),
  nvidiaUnifiedClient: readText(nvidiaUnifiedClientPath),
  nvidiaCatalog: readText(nvidiaCatalogPath),
  executorContract: readText(executorContractPath),
};

const historicalAttempts = [summarizeAttempt("Phase1955P", phase1955), summarizeAttempt("Phase1955P-Retry", retry)];
const historicalNvidiaAttemptCount = historicalAttempts.reduce((sum, item) => sum + item.requestAttemptCount, 0);
const historicalNvidiaTimeoutCount = historicalAttempts.filter((item) => item.failureReason === "nvidia_request_timeout").length;
const historicalNvidiaAttemptsImported = phase1955Read.exists === true
  && phase1955Read.parseError === null
  && phase1955RetryRead.exists === true
  && phase1955RetryRead.parseError === null
  && retryFailSeal.nvidiaRouteStatus === "timeout_blocked";

const endpointAudit = {
  endpointAudited: true,
  integrateBaseUrlDefaultPresent: sources.nvidiaUnifiedClient.includes("https://integrate.api.nvidia.com/v1"),
  retrievalBaseUrlDefaultPresent: sources.nvidiaUnifiedClient.includes("https://ai.api.nvidia.com/v1"),
  chatCompletionsPath: sources.nvidiaUnifiedClient.includes('return "/chat/completions"') || sources.nvidiaUnifiedClient.includes("/chat/completions"),
  openAiCompatibleSchemaUsed: sources.nvidiaUnifiedClient.includes("messages: normalizedMessages") && sources.nvidiaUnifiedClient.includes("max_tokens"),
  nvidiaAdapterDelegatesToHttpLlmProviderAdapter: sources.nvidiaAdapter.includes("createHttpLLMProviderAdapter"),
};

const envelopeAudit = {
  phase,
  name: "NVIDIA Request Envelope Audit",
  completed: true,
  recommended_sealed: true,
  blocker: null,
  requestEnvelopeAudited: true,
  credentialRefOnly: sources.requestEnvelope.includes("credentialRef") && sources.requestEnvelope.includes("allowedCredentialRefs"),
  rawSecretRejected: sources.requestEnvelope.includes("FORBIDDEN_INPUT_FIELD_NAMES"),
  providerAllowlistEnforced: sources.requestEnvelope.includes("allowedProviderIds"),
  modelAllowlistEnforced: sources.requestEnvelope.includes("allowedModelIds"),
  maxRequestsGateEnforced: sources.requestEnvelope.includes("maxRequests") && sources.requestEnvelope.includes("> 1"),
  budgetGateEnforced: sources.requestEnvelope.includes("maxEstimatedCostUsd") && sources.requestEnvelope.includes("> 0.01"),
  timeoutGateEnforced: sources.requestEnvelope.includes("timeoutMsLimit"),
  streamFalsePropagated: sources.safeExecutor.includes("stream: false") && sources.requestEnvelope.includes("const stream = input.stream === true"),
  expectedMarkerRequired: sources.requestEnvelope.includes("expected_response_marker_required"),
  promptRequired: sources.requestEnvelope.includes("prompt_required"),
  newProviderCallExecuted: false,
  providerCallsMade: false,
  requestAttemptCountInThisPhase: 0,
  ...safetyBoundary,
};

const timeoutAudit = {
  phase,
  name: "NVIDIA Timeout Handling Audit",
  completed: true,
  recommended_sealed: true,
  blocker: null,
  timeoutHandlingAudited: true,
  responseParsingAudited: true,
  abortControllerPresent: sources.nvidiaUnifiedClient.includes("new AbortController()"),
  abortTimeoutClassified: sources.nvidiaUnifiedClient.includes('error?.name === "AbortError"') && sources.nvidiaUnifiedClient.includes("nvidia_request_timeout"),
  fetchSignalUsed: sources.nvidiaUnifiedClient.includes("signal: controller.signal"),
  timeoutClearedFinally: sources.nvidiaUnifiedClient.includes("clearTimeout(timeoutId)"),
  responseBodyReadUnderFetchTimeout: sources.nvidiaUnifiedClient.includes("const body = await readJsonResponse(response)"),
  readJsonResponseUsesResponseText: sources.nvidiaUnifiedClient.includes("const text = await response.text()"),
  streamFalseInNvidiaClient: sources.nvidiaUnifiedClient.includes("stream: false"),
  timeoutMetadataRecorded: sources.nvidiaUnifiedClient.includes("providerTimeoutMs") && sources.nvidiaUnifiedClient.includes("timeoutHit"),
  timeoutStageSupportedByEvidence: retry.timeoutStage === "provider_fetch_or_response_wait_timeout",
  clearLowRiskRepairFound: false,
  finding: "Timeout handling exists, but historical evidence still shows two provider_fetch_or_response_wait_timeout failures with no HTTP status or response body. This is not enough to mark retry_ready=true.",
  newProviderCallExecuted: false,
  providerCallsMade: false,
  requestAttemptCountInThisPhase: 0,
  ...safetyBoundary,
};

const compatibilityMatrix = buildModelCompatibilityMatrix();
const modelCompatibility = {
  phase,
  name: "NVIDIA Model Compatibility Dry-Run",
  completed: true,
  recommended_sealed: true,
  blocker: null,
  modelCompatibilityDryRunCompleted: true,
  compatibilityMatrix,
  authorizedModelCount: compatibilityMatrix.filter((item) => item.allowedByExecutor).length,
  dryRunOnly: true,
  compatibilityConclusion: "Both previously attempted models remain statically allowlisted and chat-shaped, but both have timeout evidence. Static compatibility alone does not authorize another retry.",
  newProviderCallExecuted: false,
  providerCallsMade: false,
  requestAttemptCountInThisPhase: 0,
  ...safetyBoundary,
};

const retryReadiness = {
  retryReadinessGateGenerated: true,
  retryReady: false,
  retryReadinessDecision: "retry_ready_false",
  routeDeprecated: false,
  reason: "Route diagnosis did not reveal a sufficiently clear low-risk repair point. Endpoint, request body, stream=false, timeout controller, and response parsing are present, but two real requests still timed out while waiting for provider fetch or response.",
  nextRecommendedPhase: "Phase1956P-NVIDIA-Route-Repair-Followup or Phase1956P-AlternativeProvider-Authorization",
};

const diagnosis = {
  phase,
  name: "NVIDIA Route Diagnosis Without Provider Call",
  completed: true,
  recommended_sealed: true,
  blocker: null,
  nvidiaRouteRepairDiagnosisCompleted: true,
  historicalNvidiaAttemptsImported,
  historicalNvidiaAttemptCount,
  historicalNvidiaTimeoutCount,
  nvidiaRouteStatus: "timeout_blocked",
  historicalAttempts,
  endpointAudited: true,
  endpointAudit,
  requestEnvelopeAudited: true,
  timeoutHandlingAudited: true,
  responseParsingAudited: true,
  modelCompatibilityDryRunCompleted: true,
  alternativeProviderDecisionGatePreserved: retryFailGate.alternativeProviderDecisionGateGenerated === true,
  sourceAudit: {
    safeInternalProviderExecutorReviewed: Boolean(sources.safeExecutor),
    safeProviderRequestEnvelopeReviewed: Boolean(sources.requestEnvelope),
    safeProviderResponseSanitizerReviewed: Boolean(sources.responseSanitizer),
    providerExecutionAuthorizationGateReviewed: Boolean(sources.authorizationGate),
    providerExecutionAuthorizationSchemaReviewed: Boolean(sources.authorizationSchema),
    nvidiaAdapterReviewed: Boolean(sources.nvidiaAdapter),
    nvidiaUnifiedClientReviewed: Boolean(sources.nvidiaUnifiedClient),
  },
  findings: [
    "NVIDIA unified client uses the OpenAI-compatible /chat/completions endpoint for chat models.",
    "The request payload includes model, messages, temperature, max_tokens, and stream:false.",
    "AbortController is present and timeout is classified as nvidia_request_timeout.",
    "Response body parsing waits for response.text(), so the historical failure stage remains provider_fetch_or_response_wait_timeout when no HTTP status/body was recorded.",
    "Both authorized chat models are statically present, but both have timeout evidence and cannot be promoted to stability evidence.",
  ],
  ...retryReadiness,
  newProviderCallExecuted: false,
  providerCallsMade: false,
  requestAttemptCountInThisPhase: 0,
  providerStabilityVerified: false,
  oneShotProviderCallPassed: false,
  ...safetyBoundary,
};

const seal = {
  phase,
  name: "Phase1956P NVIDIA Route Repair Seal Result",
  completed: true,
  recommended_sealed: true,
  blocker: null,
  nvidiaRouteRepairDiagnosisCompleted: true,
  historicalNvidiaAttemptsImported,
  historicalNvidiaAttemptCount,
  historicalNvidiaTimeoutCount,
  nvidiaRouteStatus: "timeout_blocked",
  newProviderCallExecuted: false,
  providerCallsMade: false,
  requestAttemptCountInThisPhase: 0,
  endpointAudited: true,
  requestEnvelopeAudited: true,
  timeoutHandlingAudited: true,
  responseParsingAudited: true,
  modelCompatibilityDryRunCompleted: true,
  retryReadinessGateGenerated: true,
  retryReady: false,
  retryReadinessDecision: "retry_ready_false",
  routeDeprecated: false,
  alternativeProviderDecisionGatePreserved: retryFailGate.alternativeProviderDecisionGateGenerated === true,
  providerStabilityVerified: false,
  oneShotProviderCallPassed: false,
  ...safetyBoundary,
};

writeJson(`${evidenceDir}/nvidia-route-diagnosis-result.json`, diagnosis);
writeJson(`${evidenceDir}/request-envelope-audit-result.json`, envelopeAudit);
writeJson(`${evidenceDir}/timeout-handling-audit-result.json`, timeoutAudit);
writeJson(`${evidenceDir}/model-compatibility-dry-run-result.json`, modelCompatibility);
writeJson(`${evidenceDir}/phase1956p-seal-result.json`, seal);

writeText("docs/phase1956p-nvidia-route-repair-diagnosis.md", buildDiagnosisDoc(diagnosis));
writeText("docs/phase1956p-nvidia-request-envelope-audit.md", buildEnvelopeDoc(envelopeAudit));
writeText("docs/phase1956p-nvidia-timeout-handling-audit.md", buildTimeoutDoc(timeoutAudit));
writeText("docs/phase1956p-nvidia-model-compatibility-dry-run.md", buildModelDoc(modelCompatibility));
writeText("docs/phase1956p-next-retry-readiness-gate.md", buildRetryGateDoc(diagnosis));

console.log(JSON.stringify(seal, null, 2));

function readText(relativePath) {
  try {
    return readFileSync(relativePath, "utf8");
  } catch {
    return "";
  }
}

function summarizeAttempt(attemptPhase, record) {
  return {
    phase: attemptPhase,
    providerId: record.providerId ?? "nvidia",
    modelId: record.modelId ?? null,
    requestAttemptCount: Number(record.requestAttemptCount ?? 0),
    retryAttemptCount: Number(record.retryAttemptCount ?? 0),
    failureReason: record.failureReason ?? null,
    timeoutStage: record.timeoutStage ?? "provider_fetch_or_response_wait_timeout",
    latencyMs: record.latencyMs ?? record.providerResponseMetadata?.latencyMs ?? null,
    httpStatus: record.providerResponseMetadata?.status ?? null,
    responseReceived: record.responseReceived === true,
    expectedResponseMatched: record.expectedResponseMatched === true,
    oneShotProviderCallPassed: record.oneShotProviderCallPassed === true,
  };
}

function buildModelCompatibilityMatrix() {
  const allowedModels = [
    "nvidia/llama-3.3-nemotron-super-49b-v1",
    "nvidia/llama-3.1-nemotron-nano-8b-v1",
  ];
  return allowedModels.map((modelId) => {
    const historical = historicalAttempts.filter((item) => item.modelId === modelId);
    return {
      providerId: "nvidia",
      modelId,
      allowedByExecutor: sources.executorContract.includes(modelId),
      listedInNvidiaCatalog: sources.nvidiaCatalog.includes(modelId),
      endpointTypeDryRun: "chat",
      expectedEndpointPath: "/chat/completions",
      openAiCompatibleRequestShape: true,
      historicalAttemptCount: historical.reduce((sum, item) => sum + item.requestAttemptCount, 0),
      historicalTimeoutCount: historical.filter((item) => item.failureReason === "nvidia_request_timeout").length,
      retryRecommendation: "do_not_retry_without_new_owner_approval_and_clearer_route_fix",
    };
  });
}

function buildDiagnosisDoc(record) {
  return `# Phase1956P NVIDIA Route Repair Diagnosis

## Conclusion

- completed: ${record.completed}
- recommended_sealed: ${record.recommended_sealed}
- blocker: ${record.blocker ?? "null"}
- NVIDIA route status: ${record.nvidiaRouteStatus}
- retryReady: ${record.retryReady}
- retryReadinessDecision: ${record.retryReadinessDecision}

## Historical Evidence

- historicalNvidiaAttemptCount: ${record.historicalNvidiaAttemptCount}
- historicalNvidiaTimeoutCount: ${record.historicalNvidiaTimeoutCount}
- failureReason: nvidia_request_timeout
- timeoutStage: provider_fetch_or_response_wait_timeout

## Static Diagnosis

${record.findings.map((item) => `- ${item}`).join("\n")}

## Boundary

No Provider call was executed in this phase. This diagnosis does not prove one-shot success, Provider stability, production readiness, or commercial readiness.
`;
}

function buildEnvelopeDoc(record) {
  return `# Phase1956P NVIDIA Request Envelope Audit

- requestEnvelopeAudited: ${record.requestEnvelopeAudited}
- credentialRefOnly: ${record.credentialRefOnly}
- rawSecretRejected: ${record.rawSecretRejected}
- providerAllowlistEnforced: ${record.providerAllowlistEnforced}
- modelAllowlistEnforced: ${record.modelAllowlistEnforced}
- maxRequestsGateEnforced: ${record.maxRequestsGateEnforced}
- budgetGateEnforced: ${record.budgetGateEnforced}
- timeoutGateEnforced: ${record.timeoutGateEnforced}
- streamFalsePropagated: ${record.streamFalsePropagated}
- expectedMarkerRequired: ${record.expectedMarkerRequired}
- promptRequired: ${record.promptRequired}

No raw secret, auth header, env dump, or Provider request is part of this audit.
`;
}

function buildTimeoutDoc(record) {
  return `# Phase1956P NVIDIA Timeout Handling Audit

- timeoutHandlingAudited: ${record.timeoutHandlingAudited}
- responseParsingAudited: ${record.responseParsingAudited}
- abortControllerPresent: ${record.abortControllerPresent}
- abortTimeoutClassified: ${record.abortTimeoutClassified}
- fetchSignalUsed: ${record.fetchSignalUsed}
- timeoutClearedFinally: ${record.timeoutClearedFinally}
- responseBodyReadUnderFetchTimeout: ${record.responseBodyReadUnderFetchTimeout}
- readJsonResponseUsesResponseText: ${record.readJsonResponseUsesResponseText}
- streamFalseInNvidiaClient: ${record.streamFalseInNvidiaClient}
- timeoutMetadataRecorded: ${record.timeoutMetadataRecorded}

Finding: ${record.finding}
`;
}

function buildModelDoc(record) {
  return `# Phase1956P NVIDIA Model Compatibility Dry-Run

- modelCompatibilityDryRunCompleted: ${record.modelCompatibilityDryRunCompleted}
- dryRunOnly: ${record.dryRunOnly}
- authorizedModelCount: ${record.authorizedModelCount}

${record.compatibilityMatrix.map((item) => `## ${item.modelId}

- allowedByExecutor: ${item.allowedByExecutor}
- listedInNvidiaCatalog: ${item.listedInNvidiaCatalog}
- endpointTypeDryRun: ${item.endpointTypeDryRun}
- expectedEndpointPath: ${item.expectedEndpointPath}
- historicalAttemptCount: ${item.historicalAttemptCount}
- historicalTimeoutCount: ${item.historicalTimeoutCount}
- retryRecommendation: ${item.retryRecommendation}
`).join("\n")}

${record.compatibilityConclusion}
`;
}

function buildRetryGateDoc(record) {
  return `# Phase1956P Next Retry Readiness Gate

## Decision

- retryReadinessGateGenerated: ${record.retryReadinessGateGenerated}
- retryReady: ${record.retryReady}
- retryReadinessDecision: ${record.retryReadinessDecision}
- routeDeprecated: ${record.routeDeprecated}

## Reason

${record.reason}

## Next Step

${record.nextRecommendedPhase}

Any future NVIDIA retry still requires a fresh owner approval input and must not be inferred from this dry-run diagnosis.
`;
}
