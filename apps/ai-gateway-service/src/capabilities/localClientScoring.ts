// Extracted verbatim from localClientManagementCore.ts so the scoring cluster
// (health/reliability scores, candidate ranking, risk classification) lives
// beside its consumer localClientManagementService. now/safeNumber moved with
// it as the shared primitives the cluster leans on; the core imports them
// back. Type references to the core are fully erased (import type), so there
// is no runtime cycle. Pure mechanical move; behaviour unchanged.
import type { StoredLocalClient, StoredClientStats, RankedLocalClient } from "./localClientManagementCore.types.ts";
import type { normalizeRouteRequest, normalizeMaintenanceInput } from "./localClientManagementCore.ts";

const ADAPTIVE_RELIABILITY_ALPHA = 0.35;
const ADAPTIVE_RELIABILITY_INITIAL = 0.7;
const AUTO_RISK_PENALTY = 20;

export function now(): string {
  return new Date().toISOString();
}

export function safeNumber(value: unknown, fallback: null): number | null;
export function safeNumber(value: unknown, fallback?: number): number;
export function safeNumber(value: unknown, fallback: number | null = 0): number | null {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export function safeTrim(value: unknown, fallback = ""): string {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function computeHealthScore(client: StoredLocalClient, nowTs: number, staleThresholdMs: number): number {
  const lastSeenAt = Date.parse(client.lastSeenAt || "") || nowTs;
  const staleMs = Math.max(0, nowTs - lastSeenAt);
  const stalePenalty = Math.min(40, staleMs / staleThresholdMs * 40);
  const baseByStatus = client.health.status === "healthy"
    ? 50
    : client.health.status === "degraded"
      ? 20
      : client.health.status === "unknown"
        ? 10
        : 0;
  const latencyPenalty = Math.min(10, safeNumber(client.health.latencyMs) / 500);
  const loadPenalty = Math.min(10, (safeNumber(client.load.queueDepth) / 20) * 10);
  return Math.max(0, Math.round((baseByStatus - stalePenalty - latencyPenalty - loadPenalty) * 100) / 100);
}

export function computeReliabilityScore(
  stats: StoredClientStats,
  _nowTs?: number,
  _staleThresholdMs?: number,
): number {
  const attempts = safeNumber(stats.attempts, 0);
  const staleFactor = computeStaleReliabilityPenalty(stats, attempts);
  const ewmaSuccessRate = safeNumber(stats.ewmaSuccessRate, null);
  const ewmaScore = ewmaSuccessRate !== null && Number.isFinite(ewmaSuccessRate)
    ? Math.max(0, Math.min(100, ewmaSuccessRate * 100))
    : null;
  const failureStreakPenalty = Math.min(25, safeNumber(stats.failureStreak, 0) * 4);

  const base = attempts <= 0 ? 40 : computeRatioReliability(stats, attempts);
  if (ewmaScore === null) {
    return Math.max(0, Math.min(100, base - staleFactor - failureStreakPenalty));
  }
  const blended = Math.round((ewmaScore * 0.65 + base * 0.35) * 100) / 100;
  return Math.max(0, Math.min(100, blended - staleFactor - failureStreakPenalty));
}

function computeRatioReliability(stats: StoredClientStats, attempts = safeNumber(stats.attempts, 0)): number {
  if (attempts <= 0) return 40;
  const successes = Math.min(attempts, safeNumber(stats.successes, 0));
  const failures = Math.min(attempts, safeNumber(stats.failures, 0));
  const ratio = attempts > 0 ? successes / attempts : 0;
  const failurePenalty = (failures / attempts) * 15;
  const score = Math.min(100, Math.max(0, ratio * 100 - failurePenalty));
  return Math.round(score * 100) / 100;
}

function computeStaleReliabilityPenalty(stats: StoredClientStats, attempts = safeNumber(stats.attempts, 0)): number {
  const feedbackAt = Date.parse(stats.lastFeedbackAt || "");
  if (!Number.isFinite(feedbackAt) || attempts <= 0) return 0;
  const staleMs = Date.now() - feedbackAt;
  return Math.min(25, (staleMs / (5 * 60_000)) * 15);
}

export function updateOutcomeEwma(
  previousValue: number | null | undefined,
  latestOutcome: boolean,
  alpha = ADAPTIVE_RELIABILITY_ALPHA,
): number {
  const safeAlpha = Number.isFinite(alpha) ? Math.max(0, Math.min(1, alpha)) : ADAPTIVE_RELIABILITY_ALPHA;
  const previous = typeof previousValue === "number" && Number.isFinite(previousValue)
    ? previousValue
    : ADAPTIVE_RELIABILITY_INITIAL;
  const normalizedOutcome = Number(latestOutcome === true ? 1 : 0);
  return (safeAlpha * normalizedOutcome) + ((1 - safeAlpha) * previous);
}

function trustLevelBonus(level: string): number {
  if (level === "high") return 12;
  if (level === "critical") return 20;
  if (level === "low") return -12;
  return 0;
}

function matchCapabilities(requestCapabilities: string[], clientCapabilities: string[]) {
  const set = new Set(clientCapabilities);
  const matched: string[] = [];
  const missing: string[] = [];
  for (const capability of requestCapabilities) {
    if (set.has(capability)) {
      matched.push(capability);
    } else {
      missing.push(capability);
    }
  }
  return { matched, missing };
}

export function rankCandidates(
  clients: StoredLocalClient[],
  routeRequest: ReturnType<typeof normalizeRouteRequest>,
  staleThresholdMs: number,
  nowTs: number,
): RankedLocalClient[] {
  const scored = clients.map((client) => {
    const { matched, missing } = matchCapabilities(routeRequest.requiredCapabilities, client.capabilities);
    const neededCount = routeRequest.requiredCapabilities.length || 1;
    const matchRatio = matched.length / neededCount;
    const preferredBonus = routeRequest.preferredClientId && routeRequest.preferredClientId === client.clientId ? 30 : 0;
    const enabledBonus = client.enabled ? 10 : -99;
    const priorityBonus = client.priority ? Math.max(0, client.priority - 50) / 10 : 0;
    const reliabilityScore = computeReliabilityScore(client.stats || {}, nowTs, staleThresholdMs);
    const trustBonus = trustLevelBonus(client.trustLevel);
    const healthScore = computeHealthScore(client, nowTs, staleThresholdMs);
    const stalePenalty = client.lastSeenAt
      ? Math.min(40, Math.max(0, (nowTs - Date.parse(client.lastSeenAt || "")) / staleThresholdMs * 40))
      : 0;
    const autoRiskPenalty = client?.metadata?.autoRiskFlag ? AUTO_RISK_PENALTY : 0;
    const base = matchRatio * 100 + enabledBonus + preferredBonus + priorityBonus + healthScore + reliabilityScore / 10 + trustBonus;
    const failurePenalty = Math.min(25, safeNumber(client.stats?.failureStreak, 0) * 4);
    const penalty = (missing.length * 12) + failurePenalty + autoRiskPenalty;
    return {
      ...client,
      matchedCapabilities: matched,
      missingCapabilities: missing,
      score: Math.max(0, Math.round((base - penalty - stalePenalty) * 100) / 100),
      reasonFactors: {
        matchRatio: Math.round(matchRatio * 100) / 100,
        reliability: reliabilityScore,
        trustLevel: client.trustLevel,
        stalePenalty: Math.round(stalePenalty * 100) / 100,
        failureStreak: safeNumber(client.stats?.failureStreak, 0),
        autoRiskPenalty,
        requestedCapabilityCount: routeRequest.requiredCapabilities.length,
      },
      reasons: [
        routeRequest.requiredCapabilities.length ? `Required capability match: ${matched.length}/${neededCount}` : "No explicit required capabilities.",
        `Health score: ${healthScore.toFixed(2)}.`,
        `Reliability: ${reliabilityScore.toFixed(2)}.`,
      ].filter(Boolean),
    };
  });
  return scored.sort((left, right) => {
    const leftIsFullMatch = left.missingCapabilities.length === 0;
    const rightIsFullMatch = right.missingCapabilities.length === 0;
    if (leftIsFullMatch !== rightIsFullMatch) {
      return rightIsFullMatch ? 1 : -1;
    }
    return right.score - left.score;
  });
}

export function classifyRiskProfile(
  client: StoredLocalClient,
  nowTs: number,
  staleThresholdMs: number,
  maintenanceRequest: ReturnType<typeof normalizeMaintenanceInput>,
) {
  const lastSeenAt = Date.parse(client.lastSeenAt || client.updatedAt || client.discoveredAt || "");
  const staleMs = Number.isFinite(lastSeenAt) ? nowTs - lastSeenAt : null;
  const failureStreak = safeNumber(client.stats?.failureStreak, 0);
  const healthScore = computeHealthScore(client, nowTs, staleThresholdMs);
  const reliabilityScore = computeReliabilityScore(client.stats || {}, nowTs, staleThresholdMs);
  const autoRiskFlag = Boolean(safeTrim(client.metadata?.autoRiskFlag));
  const reasons = [];
  if (autoRiskFlag) reasons.push("auto-risk-flag");
  if (!Number.isFinite(staleMs)) reasons.push("missing-last-seen");
  if (failureStreak > 0) reasons.push(`failure-streak:${failureStreak}`);
  if (client.health.status === "degraded") reasons.push("health:degraded");
  if (client.health.status === "unhealthy") reasons.push("health:unhealthy");

  const isCritical = autoRiskFlag
    || client.health.status === "unhealthy"
    || failureStreak >= maintenanceRequest.riskDisableFailureStreak
    || healthScore <= maintenanceRequest.criticalHealthScore;
  const isWarning = !isCritical && (
    client.health.status === "degraded"
    || (staleMs !== null && Number.isFinite(staleMs) && staleMs > staleThresholdMs * 2)
    || healthScore < Math.max(maintenanceRequest.criticalHealthScore + 8, maintenanceRequest.criticalHealthScore * 1.25)
  );
  return {
    isCritical,
    isWarning,
    healthScore,
    reliabilityScore,
    failureStreak,
    staleMs,
    reasons,
    level: isCritical ? "critical" : isWarning ? "warning" : "stable",
    compositeScore: Math.max(0, Math.round(((healthScore * 0.7) + (reliabilityScore * 0.3)) * 100) / 100),
  };
}
