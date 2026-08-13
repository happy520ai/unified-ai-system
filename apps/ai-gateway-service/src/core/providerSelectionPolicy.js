export function createPriorityProviderSelectionPolicy(config = {}) {
  const routeMode = config.mode ?? "registry-default";
  const defaultProviderId = config.defaultProviderId;
  const defaultModelId = config.defaultModelId;
  // Health-weighted mode: use health scorer to rank candidates by observed performance
  const healthScorer = config.healthScorer ?? null;
  const useLoadBalancer = config.useLoadBalancer ?? false;

  const policyName = resolvePolicyName(routeMode);

  return {
    name: policyName,
    mode: routeMode,
    select({ request, candidates }) {
      const routeRequest = applyRouteDefaults(request, {
        routeMode,
        defaultProviderId,
        defaultModelId,
      });
      const filtered = candidates.filter((candidate) =>
        matchesRequestPreference(candidate, routeRequest),
      );

      // Health-weighted mode: sort by health score first, then priority
      const sorted = routeMode === "health-weighted" && healthScorer
        ? filtered.sort((a, b) =>
            compareCandidateHealthThenPriority(a, b, healthScorer),
          )
        : filtered.sort(compareCandidatePriority);

      const rankedCandidates = sorted.map((candidate, index) => ({
        ...candidate,
        rank: index + 1,
        healthScore:
          routeMode === "health-weighted" && healthScorer
            ? healthScorer.getScore(candidate.target.providerId)
            : undefined,
      }));

      if (rankedCandidates.length === 0) {
        const error = new Error("No provider route available");
        error.code = "NO_PROVIDER_ROUTE";
        error.category = "routing";
        throw error;
      }

      // In health-weighted mode with load balancer, use weighted random for primary selection
      let selected;
      if (routeMode === "health-weighted" && useLoadBalancer && healthScorer && rankedCandidates.length > 1) {
        selected = selectByWeightedRandom(rankedCandidates, healthScorer);
      } else {
        selected = rankedCandidates[0];
      }

      return {
        selected,
        candidates: rankedCandidates,
        fallbackChain: {
          primary: selected.target,
          fallbacks: rankedCandidates
            .filter((c) => c.target !== selected.target)
            .map((candidate, index) => ({
              order: index + 1,
              target: candidate.target,
              trigger: "error",
              reason:
                routeMode === "health-weighted"
                  ? "health-weighted fallback candidate"
                  : "priority fallback candidate",
              metadata: {
                providerPriority: candidate.providerPriority,
                modelPriority: candidate.modelPriority,
                ...(candidate.healthScore !== undefined
                  ? { healthScore: candidate.healthScore }
                  : {}),
              },
            })),
          maxAttempts: rankedCandidates.length,
        },
        reasons: buildReasons(routeRequest, selected, routeMode),
        warnings: buildWarnings(routeRequest, candidates, rankedCandidates, routeMode),
        metadata: {
          policy: policyName,
          mode: routeMode,
          candidateCount: rankedCandidates.length,
          ...(routeMode === "health-weighted" && healthScorer
            ? { healthScores: healthScorer.getAllScores() }
            : {}),
        },
      };
    },
  };
}

function resolvePolicyName(routeMode) {
  if (routeMode === "fixed") return "fixed-default";
  if (routeMode === "health-weighted") return "health-weighted";
  return "registry-default";
}

function compareCandidateHealthThenPriority(a, b, healthScorer) {
  const scoreA = healthScorer.getScore(a.target.providerId);
  const scoreB = healthScorer.getScore(b.target.providerId);
  // Higher health score first
  if (scoreB !== scoreA) return scoreB - scoreA;
  // Fallback to priority ordering
  const providerPriority = a.providerPriority - b.providerPriority;
  if (providerPriority !== 0) return providerPriority;
  return a.modelPriority - b.modelPriority;
}

function selectByWeightedRandom(rankedCandidates, healthScorer) {
  const scored = rankedCandidates.map((c) => ({
    candidate: c,
    weight: Math.max(1, healthScorer.getScore(c.target.providerId)),
  }));
  const totalWeight = scored.reduce((sum, s) => sum + s.weight, 0);
  let random = Math.random() * totalWeight;
  for (const s of scored) {
    random -= s.weight;
    if (random <= 0) return s.candidate;
  }
  return scored[scored.length - 1].candidate;
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
    return [
      routeMode === "fixed"
        ? "fixed default provider matched"
        : "explicit request preference matched",
    ];
  }

  if (routeMode === "health-weighted") {
    return ["health-weighted policy selected highest-scoring provider"];
  }

  return ["registry default policy selected first enabled provider"];
}

function buildWarnings(request, candidates, rankedCandidates, routeMode) {
  const warnings = [];

  if (rankedCandidates.length < candidates.length) {
    warnings.push({
      code: "candidate_filter_applied",
      message: "Provider candidates were filtered by route preferences or route mode.",
    });
  }

  // health-weighted mode actively uses fallback in GatewayService; the legacy
  // "fallback_execution_disabled" warning only applies to registry-default mode.
  if (rankedCandidates.length > 1 && routeMode !== "health-weighted") {
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
