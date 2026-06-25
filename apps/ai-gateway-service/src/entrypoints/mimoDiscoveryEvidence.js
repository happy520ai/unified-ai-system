import { MAX_PAID_CALLS, MAX_OUTPUT_TOKENS } from "./mimoDiscoveryHttp.js";

export function createModelsEndpointSummary() {
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

export function createSafetySummary() {
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

export function buildDiscoveryEvidence(baseEvidence, discovery) {
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

export function createPassedEvidenceFromPriorTextSmoke(baseEvidence, priorEvidence) {
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

export function createBlockedEvidence(baseEvidence, type, message) {
  return {
    ...baseEvidence,
    status: "blocked",
    conclusion: "mimo-model-id-discovery-blocked",
    configuration: redactConfiguration(baseEvidence.configuration),
    blocker: { type, message },
  };
}

export function createCandidates({ configuredModelId, runtimeModelIds, priorFailedModelId }) {
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

function createSmokeSummary() {
  return {
    attempted: false,
    paidApiCallCount: 0,
    successfulSmokeCallCount: 0,
    maxPaidApiCallAllowed: MAX_PAID_CALLS,
    maxOutputTokens: MAX_OUTPUT_TOKENS,
    temperature: 0,
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
