import { createConceptFieldSnapshot } from "./conceptFieldSnapshot.js";

export const CONCEPT_FIELD_ROUTE_AFFINITY_VERSION = "phase1478.concept-field-route-affinity.v1";

const routeProfiles = Object.freeze({
  tianshu: ["tianshu", "route", "planner", "coherence", "dryRun"],
  godMode: ["godMode", "synthesis", "coherence", "evidence", "capabilityCell"],
  securityShield: ["securityShield", "secretLeak", "providerBypass", "rollback", "evidence"],
});

export function scoreConceptFieldRouteAffinity(input = {}, options = {}) {
  const targetRoute = options.targetRoute || "tianshu";
  const snapshot = options.snapshot || createConceptFieldSnapshot(input, options);
  const profile = routeProfiles[targetRoute] || routeProfiles.tianshu;
  const activatedScore = averageProfileScore(snapshot.topActivatedConcepts, profile);
  const suppressedPenalty = averageProfileScore(snapshot.topSuppressedConcepts, profile) * 0.2;
  const routeAffinityScore = clamp01(
    snapshot.routeAffinityScore * 0.55 + activatedScore * 0.45 - suppressedPenalty,
  );

  return {
    schemaVersion: CONCEPT_FIELD_ROUTE_AFFINITY_VERSION,
    phase: "Phase1478",
    targetRoute,
    routeAffinityScore,
    routeAffinityScoreGenerated: Number.isFinite(routeAffinityScore),
    routeDecision: routeAffinityScore >= 0.68 ? "candidate_route_affinity_high" : "candidate_route_affinity_review",
    syntheticVectorsOnly: true,
    providerCallsMade: false,
    realSemanticValidationClaimed: false,
    profileConcepts: profile,
    topActivatedConcepts: snapshot.topActivatedConcepts,
    topSuppressedConcepts: snapshot.topSuppressedConcepts,
    explanation: "Route affinity is a deterministic synthetic dry-run score, not a real routing decision.",
  };
}

export function rankConceptFieldRoutes(input = {}, options = {}) {
  return Object.keys(routeProfiles)
    .map((route) => scoreConceptFieldRouteAffinity(input, { ...options, targetRoute: route }))
    .sort((left, right) => right.routeAffinityScore - left.routeAffinityScore || left.targetRoute.localeCompare(right.targetRoute));
}

function averageProfileScore(entries = [], profile = []) {
  if (!entries.length) return 0;
  const profileSet = new Set(profile);
  const matched = entries.filter((entry) => profileSet.has(entry.concept));
  if (!matched.length) return 0;
  return matched.reduce((sum, entry) => sum + Number(entry.score || 0), 0) / matched.length;
}

function clamp01(value) {
  return Number(Math.min(1, Math.max(0, Number(value) || 0)).toFixed(6));
}
