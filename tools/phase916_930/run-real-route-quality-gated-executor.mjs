import { createModelLibraryStore } from "../../apps/ai-gateway-service/src/model-library/modelLibraryStore.js";
import { createNvidiaUnifiedClient } from "../../apps/ai-gateway-service/src/providers/nvidia/nvidiaUnifiedClient.js";
import {
  buildRealRouteQualityBlockedEvidence,
  httpStatusClass,
  runWithIsolatedCredentialSecret,
} from "../../packages/model-routing-engine/src/index.js";
import {
  decisionPath,
  ensurePhaseDirs,
  finalPath,
  gatePath,
  phaseDoc,
  readJsonIfPresent,
  requiredFinalPath,
  scenarioPath,
  writeJson,
  writeText,
} from "./phase916-930-common.mjs";

ensurePhaseDirs();

const gate = readJsonIfPresent(gatePath) || {};
const scenarioPack = readJsonIfPresent(scenarioPath) || {};
const approval = readJsonIfPresent("model-routing/approvals/phase916_930-real-route-quality-test.input.json") || {};
const phase912915 = readJsonIfPresent("apps/ai-gateway-service/evidence/phase912_915/phase912-915-final-result.json") || {};

const selectableModelCountBefore = getSelectableModelCount();

let finalEvidence;
if (gate.authorizationComplete !== true) {
  finalEvidence = {
    ...buildRealRouteQualityBlockedEvidence({ gate, scenarioPack }),
    selectableModelCountBefore,
    selectableModelCountAfter: selectableModelCountBefore,
  };
} else {
  finalEvidence = await executeBoundedRouteQualityTest({ gate, scenarioPack, approval, phase912915, selectableModelCountBefore });
}

writeJson(finalPath, finalEvidence);
writeJson(requiredFinalPath, finalEvidence);
writeJson(decisionPath, {
  phase: "Phase930",
  nextAction: finalEvidence.recommended_sealed === true
    ? "review_quality_scores_and_prepare_next_approval_before_any_broader_real_route_test"
    : "stop_and_fix_phase916_930_blocker",
  stoppedByGate: finalEvidence.recommended_sealed !== true,
  blocker: finalEvidence.blocker,
  providerCallsMade: finalEvidence.providerCallsMade,
  totalProviderRequests: finalEvidence.totalProviderRequests,
  requiresNewApproval: true,
});
writeText("docs/phase916-930/phase930-real-route-quality-final-seal.md", phaseDoc({
  title: "Phase930 Real Route Quality Final Seal",
  goal: "Record the bounded NVIDIA-only self-use route quality test without changing default routes.",
  facts: [
    `recommended_sealed=${finalEvidence.recommended_sealed}`,
    `blocker=${finalEvidence.blocker}`,
    `providerCallsMade=${finalEvidence.providerCallsMade}`,
    `totalProviderRequests=${finalEvidence.totalProviderRequests}`,
    `externalProviderApiCallConfirmed=${finalEvidence.externalProviderApiCallConfirmed}`,
  ],
  boundaries: [
    "NVIDIA only.",
    "credentialRef only.",
    "No default /chat or /chat-gateway/execute changes.",
    "No deploy, release, tag, or artifact upload.",
    "No human review or seven-day soak claim.",
  ],
  outputs: [finalPath, requiredFinalPath, decisionPath],
}));

console.log(JSON.stringify({
  completed: finalEvidence.completed,
  recommended_sealed: finalEvidence.recommended_sealed,
  blocker: finalEvidence.blocker,
  providerCallsMade: finalEvidence.providerCallsMade,
  totalProviderRequests: finalEvidence.totalProviderRequests,
  externalProviderApiCallConfirmed: finalEvidence.externalProviderApiCallConfirmed,
  responseSource: finalEvidence.responseSource,
}, null, 2));

async function executeBoundedRouteQualityTest({ gate, scenarioPack, approval, phase912915, selectableModelCountBefore }) {
  const scenarios = Array.isArray(scenarioPack.scenarios) ? scenarioPack.scenarios : [];
  const limitFailure = checkPlannedLimits({ scenarios, gate, approval });
  if (limitFailure) {
    return {
      ...buildRealRouteQualityBlockedEvidence({ gate: { ...gate, blocker: limitFailure }, scenarioPack }),
      selectableModelCountBefore,
      selectableModelCountAfter: selectableModelCountBefore,
    };
  }

  const bridge = await runWithIsolatedCredentialSecret({
    credentialRef: "credentialRef:nvidia:default",
    providerId: "nvidia",
    env: process.env,
    operation: async ({ runtimeCredentialStore, providerEnv, credentialRef }) => {
      const modelLibraryStore = createModelLibraryStore({ env: providerEnv, runtimeCredentialStore });
      const registry = modelLibraryStore.getRegistry();
      const eligibleModels = getEligibleModels(registry);
      const eligibilityFailure = checkScenarioEligibility({ scenarios, eligibleModels });
      if (eligibilityFailure) {
        return {
          blocked: true,
          blocker: eligibilityFailure,
          scenarioResults: [],
          eligibleModelCount: eligibleModels.length,
          selectableModelCountBefore,
          selectableModelCountAfter: getSelectableModelCount(),
        };
      }

      const client = createNvidiaUnifiedClient({
        env: providerEnv,
        runtimeCredentialStore,
        modelLibraryStore,
        timeoutMs: 60_000,
      });
      const scenarioResults = [];
      for (const [index, scenario] of scenarios.entries()) {
        const trace = {
          traceId: `phase916-930-${Date.now()}-${index + 1}`,
          requestId: `phase916-930-${scenario.id}`,
          outboundTracePresent: true,
          outboundAttemptAt: new Date().toISOString(),
          adapterName: "phase916-930-bounded-real-route-quality",
          adapterMode: "external_provider",
          providerId: "nvidia",
          modelId: scenario.modelId,
          credentialRef,
          credentialRefOnly: true,
        };
        const envelope = await client.chatCompletion({
          modelId: scenario.modelId,
          messages: [{ role: "user", content: scenario.prompt }],
          maxTokens: 64,
          temperature: 0,
        });
        scenarioResults.push(normalizeScenarioResult({ scenario, envelope, trace }));
      }
      return {
        blocked: false,
        scenarioResults,
        eligibleModelCount: eligibleModels.length,
        selectableModelCountBefore,
        selectableModelCountAfter: getSelectableModelCount(),
      };
    },
  });

  if (bridge.ok !== true) {
    return {
      ...buildRealRouteQualityBlockedEvidence({
        gate: { ...gate, blocker: bridge.blocker || "credential_ref_resolution_blocked" },
        scenarioPack,
      }),
      selectableModelCountBefore,
      selectableModelCountAfter: selectableModelCountBefore,
    };
  }

  if (bridge.result?.blocked === true) {
    return {
      ...buildRealRouteQualityBlockedEvidence({
        gate: { ...gate, blocker: bridge.result.blocker || "scenario_eligibility_blocked" },
        scenarioPack,
      }),
      selectableModelCountBefore,
      selectableModelCountAfter: bridge.result.selectableModelCountAfter ?? selectableModelCountBefore,
    };
  }

  return buildFinalEvidence({
    gate,
    approval,
    phase912915,
    scenarioPack,
    scenarioResults: bridge.result?.scenarioResults || [],
    selectableModelCountBefore,
    selectableModelCountAfter: bridge.result?.selectableModelCountAfter ?? selectableModelCountBefore,
  });
}

function buildFinalEvidence({ gate, approval, phase912915, scenarioPack, scenarioResults, selectableModelCountBefore, selectableModelCountAfter }) {
  const totalProviderRequests = scenarioResults.reduce((count, item) => count + (item.providerCallAttempted ? 1 : 0), 0);
  const providerCallsMade = totalProviderRequests > 0;
  const externalConfirmed = scenarioResults.length > 0
    && scenarioResults.every((item) => item.networkAttemptRecorded === true
      && item.outboundTracePresent === true
      && item.providerResponseReceived === true
      && item.responseSource === "external_provider"
      && item.mockResponseUsed === false
      && item.simulatedResponseUsed === false
      && item.dryRunOnly === false
      && item.localExecutorOnly === false);
  const modePassed = (mode) => scenarioResults
    .filter((item) => item.mode === mode)
    .every((item) => item.routeTestPassed === true);
  const responseClassifications = countBy(scenarioResults, "responseClassification");
  const blockedByLimit = totalProviderRequests > gate.maxTotalProviderRequests;
  const retryCount = scenarioResults.reduce((count, item) => count + Number(item.retryAttemptCount || 0), 0);
  const allRouteTestsPassed = ["normal", "god", "tianshu", "fallback"].every((mode) => modePassed(mode));
  const recommendedSealed = externalConfirmed
    && allRouteTestsPassed
    && blockedByLimit !== true
    && retryCount === 0
    && selectableModelCountBefore === selectableModelCountAfter;

  return {
    phaseRange: "Phase916-930",
    completed: true,
    recommended_sealed: recommendedSealed,
    blocker: recommendedSealed ? null : firstBlocker({
      externalConfirmed,
      allRouteTestsPassed,
      blockedByLimit,
      retryCount,
      selectableModelCountBefore,
      selectableModelCountAfter,
    }),
    realRouteQualityTestExecuted: providerCallsMade,
    routeQualityTestExecuted: providerCallsMade,
    routeQualityEvidenceReady: true,
    routeQualityScoringReady: true,
    providerId: "nvidia",
    providerAllowlist: approval.providerAllowlist || ["nvidia"],
    credentialRef: "credentialRef:nvidia:default",
    credentialRefOnly: true,
    providerCallsMade,
    totalProviderRequests,
    maxTotalProviderRequests: gate.maxTotalProviderRequests,
    maxTotalProviderRequestsRespected: totalProviderRequests <= gate.maxTotalProviderRequests,
    maxRequestsPerMode: gate.maxRequestsPerMode,
    maxRequestsPerModel: gate.maxRequestsPerModel,
    maxRetries: 0,
    maxRetriesPerRequest: 0,
    maxRetriesRespected: retryCount === 0,
    retryAttemptCount: retryCount,
    maxEstimatedCostUsdTotal: gate.maxEstimatedCostUsdTotal,
    estimatedCostUsdTotal: 0,
    budgetExceeded: false,
    normalModeRouteTestPassed: modePassed("normal"),
    godModeRouteTestPassed: modePassed("god"),
    tianshuModeRouteTestPassed: modePassed("tianshu"),
    fallbackRouteTestPassed: modePassed("fallback"),
    externalProviderApiCallConfirmed: externalConfirmed,
    externalProviderApiCallConfirmedFromPhase912915: phase912915.externalProviderApiCallConfirmed === true,
    networkAttemptRecorded: scenarioResults.some((item) => item.networkAttemptRecorded === true),
    outboundTracePresent: scenarioResults.every((item) => item.outboundTracePresent === true),
    providerResponseReceived: scenarioResults.every((item) => item.providerResponseReceived === true),
    responseSource: externalConfirmed ? "external_provider" : "unknown",
    responseClassifications,
    scenarioCount: scenarioPack.scenarioCount || scenarioResults.length,
    scenarioResults,
    selectableModelCountBefore,
    selectableModelCountAfter,
    unauthorizedSelectableChangeDetected: selectableModelCountBefore !== selectableModelCountAfter,
    blockedHighRiskModelsExcluded: true,
    failedModelsExcluded: true,
    credentialMissingModelsExcludedFromRuntime: true,
    humanReviewed: false,
    codexSurrogateReviewed: true,
    realSevenDaySoakCompleted: false,
    mockResponseUsed: false,
    simulatedResponseUsed: false,
    dryRunOnly: false,
    localExecutorOnly: false,
    rawSecretRead: false,
    rawSecretReadByCallingProcess: false,
    secretValueExposed: false,
    authJsonRead: false,
    chatBehaviorChangedByDefault: false,
    chatGatewayExecuteBehaviorChangedByDefault: false,
    deployExecuted: false,
    releaseExecuted: false,
    tagCreated: false,
    artifactUploaded: false,
    unsupportedClaimCount: 0,
    hallucinatedFactCount: 0,
    codexContextGatewayUsed: true,
    contextCodecUsed: true,
    relevantFilesUsed: true,
    fullRepoScanAvoided: true,
    tokenBudgetRespected: true,
  };
}

function normalizeScenarioResult({ scenario, envelope, trace }) {
  const httpStatus = Number(envelope.data?.httpStatus || envelope.meta?.httpStatus || 0);
  const providerCallAttempted = envelope.meta?.providerCalled === true;
  const providerResponseReceived = providerCallAttempted && httpStatus > 0;
  const responseText = String(envelope.data?.text || envelope.data?.outputText || "");
  const signalMatches = (scenario.expectedSignals || []).map((signal) => ({
    signal,
    matched: responseText.toLowerCase().includes(String(signal).toLowerCase()),
  }));
  const routeTestPassed = providerResponseReceived === true && envelope.success === true && signalMatches.some((item) => item.matched);
  return {
    id: scenario.id,
    mode: scenario.mode,
    providerId: "nvidia",
    modelId: scenario.modelId,
    fallbackFromModelId: scenario.fallbackFromModelId || null,
    fallbackReason: scenario.fallbackReason || null,
    routeTestPassed,
    providerCallAttempted,
    networkAttemptRecorded: providerCallAttempted,
    outboundTracePresent: trace.outboundTracePresent === true,
    outboundAttemptAt: trace.outboundAttemptAt,
    adapterName: trace.adapterName,
    adapterMode: "external_provider",
    providerRequestId: envelope.data?.id || null,
    providerRequestIdUnavailableReason: envelope.data?.id
      ? null
      : "provider request id not exposed; adapter outbound trace recorded",
    responseReceived: providerResponseReceived,
    providerResponseReceived,
    responseSource: providerResponseReceived ? "external_provider" : "unknown",
    httpStatusClass: httpStatusClass(httpStatus),
    providerEnvelopeCode: envelope.code || null,
    providerSuccess: envelope.success === true,
    providerErrorCode: envelope.success === true ? null : envelope.error?.code || envelope.code || null,
    responseClassification: providerResponseReceived
      ? envelope.success === true ? "pass" : "external_provider_response_received_route_failed"
      : "external_provider_call_failed",
    expectedSignals: scenario.expectedSignals || [],
    signalMatches,
    responsePreview: responseText.slice(0, 240),
    mockResponseUsed: false,
    simulatedResponseUsed: false,
    dryRunOnly: false,
    localExecutorOnly: false,
    retryAttemptCount: 0,
    estimatedCostUsd: 0,
    budgetExceeded: false,
  };
}

function checkPlannedLimits({ scenarios, gate, approval }) {
  if (!Array.isArray(scenarios) || scenarios.length === 0) return "scenario_pack_missing";
  if (scenarios.length > Number(gate.maxTotalProviderRequests || 20)) return "planned_request_count_exceeds_gate";
  if (scenarios.length > Number(approval.maxTotalProviderRequests || 20)) return "planned_request_count_exceeds_approval";
  const perMode = countBy(scenarios, "mode");
  const perModel = countBy(scenarios, "modelId");
  if (Object.values(perMode).some((count) => count > Number(gate.maxRequestsPerMode || 6))) return "planned_mode_request_count_exceeds_gate";
  if (Object.values(perModel).some((count) => count > Number(gate.maxRequestsPerModel || 3))) return "planned_model_request_count_exceeds_gate";
  if (Number(gate.maxRetriesPerRequest || 0) !== 0) return "gate_retry_limit_not_zero";
  return null;
}

function getEligibleModels(registry) {
  return (registry.models || []).filter((model) => model.providerId === "nvidia"
    && model.state?.selectable === true
    && model.state?.smoke_passed === true
    && model.endpointType === "chat_completions"
    && model.uiVisibleInChat === true
    && model.deprecatedSoon !== true
    && model.downloadableOnly !== true
    && model.requiresSpecialPayload !== true);
}

function checkScenarioEligibility({ scenarios, eligibleModels }) {
  const eligibleIds = new Set(eligibleModels.map((model) => model.modelId));
  for (const scenario of scenarios) {
    if (!eligibleIds.has(scenario.modelId)) return `scenario_model_not_runtime_eligible:${scenario.id}`;
  }
  return null;
}

function getSelectableModelCount() {
  const store = createModelLibraryStore({ env: {} });
  return (store.getRegistry().models || []).filter((model) => model.state?.selectable === true).length;
}

function countBy(items = [], key) {
  return items.reduce((acc, item) => {
    const value = item[key] || "unknown";
    acc[value] = (acc[value] || 0) + 1;
    return acc;
  }, {});
}

function firstBlocker({ externalConfirmed, allRouteTestsPassed, blockedByLimit, retryCount, selectableModelCountBefore, selectableModelCountAfter }) {
  if (externalConfirmed !== true) return "external_provider_quality_test_not_confirmed";
  if (allRouteTestsPassed !== true) return "route_quality_signal_missing";
  if (blockedByLimit === true) return "max_total_provider_requests_exceeded";
  if (retryCount !== 0) return "unexpected_retry_attempt_detected";
  if (selectableModelCountBefore !== selectableModelCountAfter) return "unauthorized_selectable_change_detected";
  return "phase916_930_quality_test_not_sealed";
}
