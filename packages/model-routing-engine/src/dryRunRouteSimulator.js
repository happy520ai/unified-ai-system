import { classifyTaskPressure } from "./taskPressureClassifier.js";
import { resolveModeRoutingPolicy } from "./modeRoutingPolicy.js";
import { applyContextPressureRouting } from "./contextPressureRouting.js";
import { applyCostPressureRouting } from "./costPressureRouting.js";
import { applyLatencyPressureRouting } from "./latencyPressureRouting.js";
import { applyReliabilityPressureRouting } from "./reliabilityPressureRouting.js";
import { scoreCandidates } from "./candidateScoringEngine.js";
import { selectNormalModeModel } from "./normalModeSelector.js";
import { selectGodModeReviewerPool } from "./godModeReviewerPoolSelector.js";
import { selectTianshuPlannerExecutor } from "./tianshuPlannerExecutorSelector.js";
import { buildProviderFallbackPolicy } from "./providerFallbackPolicy.js";
import { buildRouteExplanation } from "./routeExplanationBuilder.js";

export function simulateDryRunRoute(input = {}, capabilityIndex = {}) {
  const taskPressure = classifyTaskPressure(input);
  const modePolicy = resolveModeRoutingPolicy(input, taskPressure);
  const baseCandidates = capabilityIndex.models || capabilityIndex.runtimeCandidates || [];
  const pressureAdjusted = applyReliabilityPressureRouting(
    applyLatencyPressureRouting(
      applyCostPressureRouting(
        applyContextPressureRouting(baseCandidates, taskPressure),
        taskPressure,
      ),
      taskPressure,
    ),
    taskPressure,
  );
  const scoredCandidates = scoreCandidates(pressureAdjusted, { mode: modePolicy.resolvedMode, pressure: taskPressure });
  const normalSelection = selectNormalModeModel(scoredCandidates);
  const godMode = selectGodModeReviewerPool(scoredCandidates);
  const tianshuMode = selectTianshuPlannerExecutor(scoredCandidates);
  const selectedCandidate = modePolicy.resolvedMode === "normal"
    ? normalSelection.selected
    : modePolicy.resolvedMode === "god"
      ? godMode.reviewerPool[0] || normalSelection.selected
      : scoredCandidates.find((candidate) => candidate.modelId === tianshuMode.plannerModelId) || normalSelection.selected;
  const fallback = buildProviderFallbackPolicy(scoredCandidates, selectedCandidate?.modelId);
  const route = {
    routeId: `route-${input.taskId || "task"}`,
    mode: modePolicy.resolvedMode,
    taskPressure: {
      tokenPressure: taskPressure.tokenPressure,
      costPressure: taskPressure.costPressure,
      latencyPressure: taskPressure.latencyPressure,
      reasoningPressure: taskPressure.reasoningPressure,
      reliabilityPressure: taskPressure.reliabilityPressure,
      contextPressure: taskPressure.contextPressure,
    },
    selected: {
      primaryModelId: selectedCandidate?.modelId || null,
      providerId: selectedCandidate?.providerId || null,
      reason: selectedCandidate ? `score=${selectedCandidate.score}; ${selectedCandidate.reasonCodes.join(",")}` : "no_runtime_candidate",
    },
    godMode: {
      reviewerPool: godMode.reviewerPool.map((candidate) => candidate.modelId),
      adjudicatorModelId: godMode.adjudicatorModelId,
    },
    tianshuMode: {
      plannerModelId: tianshuMode.plannerModelId,
      executorModelIds: tianshuMode.executorModelIds,
      fallbackModelIds: tianshuMode.fallbackModelIds,
    },
    fallbackChain: fallback.fallbackChain,
    excludedModels: capabilityIndex.excludedModels || [],
    providerCallsMade: false,
    secretRead: false,
    dryRunOnly: true,
  };
  return {
    ...route,
    routeExplanation: buildRouteExplanation(route),
    scoredCandidates: scoredCandidates.slice(0, 8).map((candidate) => ({
      modelId: candidate.modelId,
      providerId: candidate.providerId,
      score: candidate.score,
      reasonCodes: candidate.reasonCodes,
      notRuntimeEligible: candidate.notRuntimeEligible,
    })),
  };
}

export function runDryRunRouteSimulator(fixtures = [], capabilityIndex = {}) {
  const routes = fixtures.map((fixture) => simulateDryRunRoute(fixture, capabilityIndex));
  return {
    phase: "Phase816",
    dryRunRouteSimulatorReady: true,
    routeFixtureCount: fixtures.length,
    routeSimulationPassed: routes.length >= 10 && routes.every((route) => route.routeExplanation && route.providerCallsMade === false && route.dryRunOnly === true),
    routes,
    providerCallsMade: false,
    secretRead: false,
  };
}
