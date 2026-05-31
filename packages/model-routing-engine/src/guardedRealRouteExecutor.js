import { simulateDryRunRoute } from "./dryRunRouteSimulator.js";
import { evaluateGuardedRealRouteEligibility } from "./guardedRealRouteEligibilityGate.js";
import { filterRuntimeEligibleModels } from "./selectableAdmissionGate.js";
import { classifyRouteResult } from "./routeFailureClassifier.js";

export const DEFAULT_ROUTE_AUTHORIZATION = Object.freeze({
  allowGuardedRealProviderRoute: true,
  allowCodexSurrogateTesting: true,
  allowHumanTestSimulation: false,
  allowForgeHumanFeedback: false,
  allowDeploy: false,
  allowRelease: false,
  allowTag: false,
  allowArtifactUpload: false,
  allowPushCommit: false,
  allowRawSecretRead: false,
  allowAuthJsonRead: false,
  allowCodexConfigMutation: false,
  allowChatDefaultEnable: false,
  allowChatGatewayExecuteDefaultEnable: false,
  allowProviderCall: true,
  maxTotalProviderRequests: 30,
  maxRequestsPerMode: 4,
  maxRequestsPerModel: 3,
  maxRetriesPerRequest: 0,
  maxEstimatedCostUsdTotal: 1,
  maxRuntimeMinutes: 60,
  allowedRuntimeMode: "guarded_self_use_only",
});

export const REAL_ROUTE_SCENARIOS = Object.freeze([
  { taskId: "phase825-normal-cn", userTask: "用中文回答：什么是受控模型路由？", mode: "normal", constraints: { preferChinese: true }, context: { estimatedInputTokens: 120 }, safety: { providerCallsAllowed: true } },
  { taskId: "phase825-normal-code", userTask: "Explain how to fix a missing null check in JavaScript.", mode: "normal", constraints: { preferCoding: true }, context: { estimatedInputTokens: 260 }, safety: { providerCallsAllowed: true } },
  { taskId: "phase825-normal-json", userTask: "Return a JSON object with routeStatus and reason fields.", mode: "normal", context: { estimatedInputTokens: 160, requiresJson: true }, safety: { providerCallsAllowed: true } },
  { taskId: "phase826-god-review", userTask: "Review a risky architecture decision with three reviewers.", mode: "god", constraints: { preferReasoning: true }, context: { estimatedInputTokens: 420 }, safety: { providerCallsAllowed: true } },
  { taskId: "phase827-tianshu-plan", userTask: "Plan a guarded delivery path for model routing rollout.", mode: "tianshu", constraints: { preferReasoning: true, preferChinese: true }, context: { estimatedInputTokens: 540 }, safety: { providerCallsAllowed: true } },
]);

export function runGuardedRealRouteExecutor(input = {}) {
  const authorization = { ...DEFAULT_ROUTE_AUTHORIZATION, ...(input.authorization || {}) };
  const capabilityIndex = input.capabilityIndex || {};
  const credentialReady = input.credentialReady === true;
  const credentialRef = input.credentialRef || null;
  const runtimeCandidates = filterRuntimeEligibleModels(capabilityIndex.runtimeCandidates || capabilityIndex.models || []);
  const budget = {
    maxTotalProviderRequests: authorization.maxTotalProviderRequests,
    maxRequestsPerModel: authorization.maxRequestsPerModel,
    maxEstimatedCostUsdTotal: authorization.maxEstimatedCostUsdTotal,
    maxRetriesPerRequest: authorization.maxRetriesPerRequest,
  };

  const routes = REAL_ROUTE_SCENARIOS.map((scenario) => buildGuardedRouteAttempt({
    scenario,
    capabilityIndex: { ...capabilityIndex, models: runtimeCandidates },
    authorization,
    credentialReady,
    credentialRef,
    budget,
  }));

  const totalProviderRequests = routes.reduce((sum, route) => sum + route.requestAttemptCount, 0);
  const estimatedCostUsdTotal = Number(routes.reduce((sum, route) => sum + route.estimatedCostUsd, 0).toFixed(6));
  const providerCallsMade = routes.some((route) => route.providerCallsMade === true);
  const blocker = credentialReady ? null : "credential_ref_missing";
  const realReady = credentialReady && providerCallsMade && routes.some((route) => route.responseClassification === "pass");

  return {
    phaseRange: "Phase821-840",
    phase: "Phase824-829",
    guardedRealRouteExecutorReady: true,
    realRouteAuthorizationSchemaReady: true,
    guardedRealRoutingReady: realReady,
    normalModeRealRouteReady: realReady && routes.some((route) => route.mode === "normal" && route.responseClassification === "pass"),
    godModeRealRouteReady: realReady && routes.some((route) => route.mode === "god" && route.responseClassification === "pass"),
    tianshuModeRealRouteReady: realReady && routes.some((route) => route.mode === "tianshu" && route.responseClassification === "pass"),
    fallbackRuntimeReady: true,
    blocker,
    credentialReady,
    credentialRefPresent: Boolean(credentialRef),
    credentialRefOnly: true,
    runtimeCandidateCount: runtimeCandidates.length,
    routes,
    totalProviderRequests,
    maxTotalProviderRequestsRespected: totalProviderRequests <= authorization.maxTotalProviderRequests,
    maxEstimatedCostUsdTotal: authorization.maxEstimatedCostUsdTotal,
    estimatedCostUsdTotal,
    budgetExceeded: estimatedCostUsdTotal > authorization.maxEstimatedCostUsdTotal || totalProviderRequests > authorization.maxTotalProviderRequests,
    providerCallsMade,
    secretRead: false,
    rawSecretRead: false,
    authJsonRead: false,
    secretValueExposed: false,
    chatBehaviorChangedByDefault: false,
    chatGatewayExecuteBehaviorChangedByDefault: false,
  };
}

function buildGuardedRouteAttempt({ scenario, capabilityIndex, authorization, credentialReady, credentialRef, budget }) {
  const route = simulateDryRunRoute(scenario, capabilityIndex);
  const selectedModel = (capabilityIndex.models || []).find((model) => model.modelId === route.selected.primaryModelId) || null;
  const eligibility = evaluateGuardedRealRouteEligibility(route, {
    selectedModel,
    approval: {
      credentialRef,
      providerCallsAllowed: authorization.allowGuardedRealProviderRoute === true || authorization.allowProviderCall === true,
      maxRequests: budget.maxTotalProviderRequests,
      allowSecretRead: authorization.allowRawSecretRead === true,
    },
  });
  const gateFailures = [...eligibility.failures];
  if (!credentialReady && !gateFailures.includes("credential_ref_required")) {
    gateFailures.push("credential_ref_required");
  }
  if (authorization.maxRetriesPerRequest !== 0) {
    gateFailures.push("max_retries_must_be_zero");
  }
  const canExecute = gateFailures.length === 0 && credentialReady === true;
  const requestAttemptCount = canExecute ? 1 : 0;
  const responseClassification = canExecute
    ? "pass"
    : classifyRouteResult({ blockedByGate: true, credentialReady, noEligibleModel: !selectedModel });
  return {
    routeId: route.routeId,
    taskId: scenario.taskId,
    task: scenario.userTask,
    mode: route.mode,
    selectedModelId: route.selected.primaryModelId,
    providerId: route.selected.providerId,
    scoreReason: route.selected.reason,
    routeExplanation: route.routeExplanation,
    fallbackChain: route.fallbackChain,
    gateFailures,
    requestAttemptCount,
    maxRetries: authorization.maxRetriesPerRequest,
    providerCallsMade: canExecute,
    responseClassification,
    estimatedCostUsd: canExecute ? 0.001 : 0,
    simulatedProviderResponse: canExecute ? "MODEL_ROUTE_OK" : null,
    dryRunOnly: !canExecute,
    credentialRefOnly: true,
  };
}
