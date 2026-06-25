export function createPriorityProviderSelectionPolicy(config = {}) {
  const routeMode = config.mode ?? "registry-default";
  const defaultProviderId = config.defaultProviderId;
  const defaultModelId = config.defaultModelId;

  return {
    name: routeMode === "fixed" ? "fixed-default" : "registry-default",
    mode: routeMode,
    select({ request, candidates }) {
      const routeRequest = applyRouteDefaults(request, {
        routeMode,
        defaultProviderId,
        defaultModelId,
      });

      // 第一轮：严格匹配（provider + model）
      let rankedCandidates = candidates
        .filter((candidate) => matchesRequestPreference(candidate, routeRequest))
        .sort(compareCandidatePriority)
        .map((candidate, index) => ({
          ...candidate,
          rank: index + 1,
        }));

      // 第二轮：如果严格匹配无结果，放宽到只匹配 provider
      if (rankedCandidates.length === 0 && routeRequest.providerId) {
        const relaxedRequest = { ...routeRequest, model: undefined };
        rankedCandidates = candidates
          .filter((candidate) => matchesRequestPreference(candidate, relaxedRequest))
          .sort(compareCandidatePriority)
          .map((candidate, index) => ({
            ...candidate,
            rank: index + 1,
          }));
      }

      // 第三轮：如果仍然无结果，使用所有候选
      if (rankedCandidates.length === 0) {
        rankedCandidates = candidates
          .sort(compareCandidatePriority)
          .map((candidate, index) => ({
            ...candidate,
            rank: index + 1,
          }));
      }

      if (rankedCandidates.length === 0) {
        const error = new Error("No provider route available");
        error.code = "NO_PROVIDER_ROUTE";
        error.category = "routing";
        throw error;
      }

      const selected = rankedCandidates[0];

      return {
        selected,
        candidates: rankedCandidates,
        fallbackChain: {
          primary: selected.target,
          fallbacks: rankedCandidates.slice(1).map((candidate, index) => ({
            order: index + 1,
            target: candidate.target,
            trigger: "error",
            reason: "priority fallback candidate",
            metadata: {
              providerPriority: candidate.providerPriority,
              modelPriority: candidate.modelPriority,
            },
          })),
          maxAttempts: rankedCandidates.length,
        },
        reasons: buildReasons(routeRequest, selected, routeMode),
        warnings: buildWarnings(routeRequest, candidates, rankedCandidates),
        metadata: {
          policy: routeMode === "fixed" ? "fixed-default" : "registry-default",
          mode: routeMode,
          candidateCount: rankedCandidates.length,
        },
      };
    },
  };
}

function applyRouteDefaults(request, config) {
  if (request.providerId || request.model || config.routeMode !== "fixed") {
    return request;
  }

  return {
    ...request,
    providerId: config.defaultProviderId,
    model: config.defaultModelId,
  };
}

function matchesRequestPreference(candidate, request) {
  if (request.providerId && candidate.target.providerId !== request.providerId) {
    return false;
  }

  if (request.model && candidate.target.modelId !== request.model) {
    return false;
  }

  return true;
}

function compareCandidatePriority(a, b) {
  const providerPriority = a.providerPriority - b.providerPriority;
  if (providerPriority !== 0) {
    return providerPriority;
  }

  return a.modelPriority - b.modelPriority;
}

function buildReasons(request, selected, routeMode) {
  if (request.providerId || request.model) {
    return [routeMode === "fixed" ? "fixed default provider matched" : "explicit request preference matched"];
  }

  return ["registry default policy selected first enabled provider"];
}

function buildWarnings(request, candidates, rankedCandidates) {
  const warnings = [];

  if (rankedCandidates.length < candidates.length) {
    warnings.push({
      code: "candidate_filter_applied",
      message: "Provider candidates were filtered by route preferences or route mode.",
    });
  }

  if (rankedCandidates.length > 1) {
    warnings.push({
      code: "fallback_execution_disabled",
      message: "Fallback candidates are listed but not executed.",
    });
  }

  if (request.providerId || request.model) {
    warnings.push({
      code: "provider_preference_applied",
      message: "Provider selection used explicit request or fixed default preference.",
    });
  }

  return warnings;
}
