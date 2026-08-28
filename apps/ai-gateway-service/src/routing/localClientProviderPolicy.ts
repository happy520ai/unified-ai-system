export const LOCAL_CLIENT_PROVIDER_POLICY_VERSION = "local-client-provider-policy-v1" as const;

export type LocalClientDataClass = "public" | "internal" | "confidential" | "restricted";

/**
 * A client-scoped provider policy. Omitted limits are never inferred from a
 * candidate. In particular, an explicit empty allow-list allows no provider.
 */
export interface LocalClientProviderPolicy {
  readonly allowedProviders?: readonly string[];
  readonly deniedProviders?: readonly string[];
  readonly dataClass: LocalClientDataClass;
  readonly allowedRegions?: readonly string[];
  readonly maxFanout?: number;
  readonly fusionAllowed?: boolean;
  readonly maxCostUsd?: number;
  readonly maxLatencyMs?: number;
  readonly minHealthScore?: number;
  readonly minQuotaRemaining?: number;
  readonly preferFree?: boolean;
}

/**
 * health, reliability and quotaRemaining are normalized to the inclusive
 * range 0..1. Unknown runtime observations must be represented as null/omitted.
 */
export interface LocalClientProviderCandidate {
  readonly provider: string;
  readonly model: string;
  readonly region?: string | null;
  readonly capabilities: readonly string[];
  readonly health: number;
  readonly reliability: number;
  readonly latencyMs?: number | null;
  readonly costUsd?: number | null;
  readonly quotaRemaining?: number | null;
  readonly free: boolean;
  readonly available: boolean;
}

export interface LocalClientProviderRoutingRequest {
  readonly policy: LocalClientProviderPolicy;
  readonly candidates: readonly LocalClientProviderCandidate[];
  readonly requiredCapabilities?: readonly string[];
  readonly requestedFanout?: number;
  readonly fusionRequested?: boolean;
}

export type LocalClientProviderReasonCode =
  | "candidate_unavailable"
  | "provider_not_allowed"
  | "provider_denied"
  | "capability_missing"
  | "region_required"
  | "region_not_allowed"
  | "cost_required"
  | "cost_exceeds_limit"
  | "latency_required"
  | "latency_exceeds_limit"
  | "health_below_minimum"
  | "quota_required"
  | "quota_exhausted"
  | "quota_below_minimum"
  | "cross_region_fanout_denied"
  | "fanout_limit"
  | "fusion_not_allowed";

export interface LocalClientProviderReason {
  readonly code: LocalClientProviderReasonCode;
  readonly message: string;
  readonly field?: string;
  readonly expected?: string | number | boolean;
  readonly actual?: string | number | boolean | null;
}

export interface LocalClientProviderScoreBreakdown {
  readonly exactCapabilityMatch: boolean;
  readonly capability: number;
  readonly health: number;
  readonly reliability: number;
  readonly latency: number;
  readonly cost: number;
  readonly quota: number;
  readonly freePreference: number;
  readonly total: number;
}

export type LocalClientProviderDisposition = "selected" | "eligible_not_selected" | "rejected";

export interface LocalClientProviderCandidateEvaluation {
  readonly candidate: LocalClientProviderCandidate;
  readonly candidateKey: string;
  readonly disposition: LocalClientProviderDisposition;
  readonly policyEligible: boolean;
  readonly selected: boolean;
  readonly rejectionReasons: readonly LocalClientProviderReason[];
  readonly notSelectedReasons: readonly LocalClientProviderReason[];
  readonly score: number | null;
  readonly scoreBreakdown: LocalClientProviderScoreBreakdown | null;
}

export interface LocalClientProviderRoutingDecision {
  readonly policyVersion: typeof LOCAL_CLIENT_PROVIDER_POLICY_VERSION;
  readonly dataClass: LocalClientDataClass;
  readonly requestedFanout: number;
  readonly policyMaxFanout: number;
  readonly effectiveFanout: number;
  readonly fanoutCapped: boolean;
  readonly fusionRequested: boolean;
  readonly fusionAllowed: boolean;
  readonly fusionEnabled: boolean;
  readonly sensitiveDefaultsApplied: boolean;
  readonly selected: readonly LocalClientProviderCandidate[];
  readonly evaluations: readonly LocalClientProviderCandidateEvaluation[];
  readonly decisionReasons: readonly LocalClientProviderReason[];
}

export class LocalClientProviderPolicyError extends Error {
  readonly code = "LOCAL_CLIENT_PROVIDER_POLICY_INVALID" as const;

  constructor(message = "The local-client provider policy request is invalid.") {
    super(message);
    this.name = "LocalClientProviderPolicyError";
  }
}

type NormalizedCandidate = {
  readonly original: LocalClientProviderCandidate;
  readonly originalIndex: number;
  readonly provider: string;
  readonly model: string;
  readonly region: string | null;
  readonly capabilities: readonly string[];
  readonly health: number;
  readonly reliability: number;
  readonly latencyMs: number | null;
  readonly costUsd: number | null;
  readonly quotaRemaining: number | null;
  readonly free: boolean;
  readonly available: boolean;
  readonly key: string;
};

type NormalizedPolicy = {
  readonly allowedProviders: ReadonlySet<string> | null;
  readonly deniedProviders: ReadonlySet<string>;
  readonly dataClass: LocalClientDataClass;
  readonly sensitive: boolean;
  readonly allowedRegions: ReadonlySet<string> | null;
  readonly maxFanout: number;
  readonly fusionAllowed: boolean;
  readonly maxCostUsd: number | null;
  readonly maxLatencyMs: number | null;
  readonly minHealthScore: number | null;
  readonly minQuotaRemaining: number | null;
  readonly preferFree: boolean;
  readonly sensitiveDefaultsApplied: boolean;
};

type InternalEvaluation = {
  readonly candidate: NormalizedCandidate;
  readonly rejectionReasons: readonly LocalClientProviderReason[];
  readonly scoreBreakdown: LocalClientProviderScoreBreakdown | null;
  selected: boolean;
  notSelectedReasons: LocalClientProviderReason[];
};

const DATA_CLASSES = new Set<LocalClientDataClass>([
  "public",
  "internal",
  "confidential",
  "restricted",
]);
const SENSITIVE_DATA_CLASSES = new Set<LocalClientDataClass>(["confidential", "restricted"]);
const MAX_CANDIDATES = 1_024;
const MAX_FANOUT = 32;
const MAX_LIST_ENTRIES = 256;
const MAX_IDENTIFIER_LENGTH = 256;
const CONTROL_CHARACTERS = /[\u0000-\u001f\u007f]/u;

const SCORE_WEIGHTS = Object.freeze({
  capability: 30,
  health: 20,
  reliability: 20,
  latency: 10,
  cost: 10,
  quota: 10,
  freePreference: 5,
});

/**
 * Evaluate a client-scoped provider policy without dispatching or mutating any
 * gateway/provider state. Policy filtering always completes before scoring.
 */
export function evaluateLocalClientProviderPolicy(
  request: LocalClientProviderRoutingRequest,
): LocalClientProviderRoutingDecision {
  if (!isPlainRecord(request) || !Array.isArray(request.candidates)) throw invalidPolicy();
  assertAllowedKeys(request, [
    "policy",
    "candidates",
    "requiredCapabilities",
    "requestedFanout",
    "fusionRequested",
  ]);
  if (request.candidates.length > MAX_CANDIDATES) throw invalidPolicy();

  const policy = normalizePolicy(request.policy);
  const requiredCapabilities = normalizeStringList(
    request.requiredCapabilities ?? [],
    "requiredCapabilities",
    false,
  );
  const requestedFanout = normalizePositiveInteger(request.requestedFanout ?? 1, MAX_FANOUT);
  if (request.fusionRequested !== undefined && typeof request.fusionRequested !== "boolean") {
    throw invalidPolicy();
  }
  const fusionRequested = request.fusionRequested === true;
  const candidates = request.candidates.map(normalizeCandidate);

  // Phase 1: policy/capability filtering. Rejected candidates never enter the
  // scoring function and therefore always expose null score components.
  const evaluations: InternalEvaluation[] = candidates.map((candidate) => {
    const rejectionReasons = filterCandidate(candidate, policy, requiredCapabilities);
    return {
      candidate,
      rejectionReasons,
      scoreBreakdown: rejectionReasons.length === 0
        ? scoreCandidate(candidate, requiredCapabilities, policy.preferFree)
        : null,
      selected: false,
      notSelectedReasons: [],
    };
  });

  // Phase 2: deterministic ranking of already-eligible candidates.
  const rankedEligible = evaluations
    .filter((evaluation) => evaluation.scoreBreakdown !== null)
    .sort(compareEligibleEvaluations);

  const decisionReasons: LocalClientProviderReason[] = [];
  let selectionLimit = Math.min(requestedFanout, policy.maxFanout);
  if (fusionRequested && !policy.fusionAllowed) {
    selectionLimit = Math.min(selectionLimit, 1);
    decisionReasons.push(reason(
      "fusion_not_allowed",
      "Fusion was requested but the client policy does not allow it.",
      "fusionAllowed",
      true,
      false,
    ));
  }

  let sensitiveAnchorRegion: string | null = null;
  let selectedCount = 0;
  for (const evaluation of rankedEligible) {
    if (evaluation.selected) continue;
    const candidateRegion = evaluation.candidate.region;
    if (
      policy.sensitive
      && sensitiveAnchorRegion !== null
      && candidateRegion !== sensitiveAnchorRegion
    ) {
      evaluation.notSelectedReasons.push(reason(
        "cross_region_fanout_denied",
        "Sensitive client data cannot fan out across provider regions.",
        "region",
        sensitiveAnchorRegion,
        candidateRegion,
      ));
      continue;
    }
    if (selectedCount >= selectionLimit) {
      evaluation.notSelectedReasons.push(reason(
        "fanout_limit",
        "The candidate is eligible but outside the client policy fanout limit.",
        "maxFanout",
        selectionLimit,
        requestedFanout,
      ));
      continue;
    }
    evaluation.selected = true;
    selectedCount += 1;
    if (policy.sensitive && sensitiveAnchorRegion === null) {
      sensitiveAnchorRegion = candidateRegion;
    }
  }

  const selectedEvaluations = rankedEligible.filter((evaluation) => evaluation.selected);
  const fusionEnabled = fusionRequested
    && policy.fusionAllowed
    && selectedEvaluations.length > 1;
  const finalEvaluations = Object.freeze(evaluations
    .sort((left, right) => left.candidate.originalIndex - right.candidate.originalIndex)
    .map(toPublicEvaluation));
  const selected = Object.freeze(selectedEvaluations.map((evaluation) => evaluation.candidate.original));

  return Object.freeze({
    policyVersion: LOCAL_CLIENT_PROVIDER_POLICY_VERSION,
    dataClass: policy.dataClass,
    requestedFanout,
    policyMaxFanout: policy.maxFanout,
    effectiveFanout: selected.length,
    fanoutCapped: requestedFanout > policy.maxFanout || selectionLimit < requestedFanout,
    fusionRequested,
    fusionAllowed: policy.fusionAllowed,
    fusionEnabled,
    sensitiveDefaultsApplied: policy.sensitiveDefaultsApplied,
    selected,
    evaluations: finalEvaluations,
    decisionReasons: Object.freeze(decisionReasons),
  });
}

function normalizePolicy(policy: LocalClientProviderPolicy): NormalizedPolicy {
  if (!isPlainRecord(policy) || !DATA_CLASSES.has(policy.dataClass as LocalClientDataClass)) {
    throw invalidPolicy();
  }
  assertAllowedKeys(policy, [
    "allowedProviders",
    "deniedProviders",
    "dataClass",
    "allowedRegions",
    "maxFanout",
    "fusionAllowed",
    "maxCostUsd",
    "maxLatencyMs",
    "minHealthScore",
    "minQuotaRemaining",
    "preferFree",
  ]);
  const dataClass = policy.dataClass as LocalClientDataClass;
  const sensitive = SENSITIVE_DATA_CLASSES.has(dataClass);
  if (policy.fusionAllowed !== undefined && typeof policy.fusionAllowed !== "boolean") {
    throw invalidPolicy();
  }
  if (policy.preferFree !== undefined && typeof policy.preferFree !== "boolean") {
    throw invalidPolicy();
  }

  return Object.freeze({
    allowedProviders: policy.allowedProviders === undefined
      ? null
      : new Set(normalizeStringList(policy.allowedProviders, "allowedProviders")),
    deniedProviders: new Set(normalizeStringList(
      policy.deniedProviders ?? [],
      "deniedProviders",
    )),
    dataClass,
    sensitive,
    allowedRegions: policy.allowedRegions === undefined
      ? null
      : new Set(normalizeStringList(policy.allowedRegions, "allowedRegions")),
    maxFanout: normalizePositiveInteger(policy.maxFanout ?? 1, MAX_FANOUT),
    fusionAllowed: policy.fusionAllowed ?? false,
    maxCostUsd: normalizeOptionalNonNegative(policy.maxCostUsd),
    maxLatencyMs: normalizeOptionalNonNegative(policy.maxLatencyMs),
    minHealthScore: normalizeOptionalUnitInterval(policy.minHealthScore),
    minQuotaRemaining: normalizeOptionalUnitInterval(policy.minQuotaRemaining),
    preferFree: policy.preferFree ?? false,
    sensitiveDefaultsApplied: sensitive
      && (policy.maxFanout === undefined || policy.fusionAllowed === undefined),
  });
}

function normalizeCandidate(
  candidate: LocalClientProviderCandidate,
  originalIndex: number,
): NormalizedCandidate {
  if (!isPlainRecord(candidate)) throw invalidPolicy();
  assertAllowedKeys(candidate, [
    "provider",
    "model",
    "region",
    "capabilities",
    "health",
    "reliability",
    "latencyMs",
    "costUsd",
    "quotaRemaining",
    "free",
    "available",
  ]);
  const provider = normalizeIdentifier(candidate.provider, "provider").toLowerCase();
  const model = normalizeIdentifier(candidate.model, "model");
  const region = candidate.region === undefined || candidate.region === null
    ? null
    : normalizeIdentifier(candidate.region, "region").toLowerCase();
  const capabilities = normalizeStringList(candidate.capabilities, "capabilities", false);
  if (typeof candidate.available !== "boolean" || typeof candidate.free !== "boolean") {
    throw invalidPolicy();
  }
  const health = normalizeUnitInterval(candidate.health);
  const reliability = normalizeUnitInterval(candidate.reliability);
  const latencyMs = normalizeNullableNonNegative(candidate.latencyMs);
  const costUsd = normalizeNullableNonNegative(candidate.costUsd);
  const quotaRemaining = normalizeNullableUnitInterval(candidate.quotaRemaining);
  const normalizedProjection: LocalClientProviderCandidate = Object.freeze({
    provider,
    model,
    region,
    capabilities,
    health,
    reliability,
    latencyMs,
    costUsd,
    quotaRemaining,
    free: candidate.free,
    available: candidate.available,
  });
  return Object.freeze({
    original: normalizedProjection,
    originalIndex,
    provider,
    model,
    region,
    capabilities,
    health,
    reliability,
    latencyMs,
    costUsd,
    quotaRemaining,
    free: candidate.free,
    available: candidate.available,
    key: `${provider}/${model}@${region ?? "unknown"}`,
  });
}

function filterCandidate(
  candidate: NormalizedCandidate,
  policy: NormalizedPolicy,
  requiredCapabilities: readonly string[],
): readonly LocalClientProviderReason[] {
  const reasons: LocalClientProviderReason[] = [];
  if (!candidate.available) {
    reasons.push(reason("candidate_unavailable", "The provider candidate is not available.", "available", true, false));
  }
  if (policy.allowedProviders !== null && !policy.allowedProviders.has(candidate.provider)) {
    reasons.push(reason(
      "provider_not_allowed",
      "The provider is outside the client allow-list.",
      "allowedProviders",
      [...policy.allowedProviders].sort(compareAscii).join(","),
      candidate.provider,
    ));
  }
  if (policy.deniedProviders.has(candidate.provider)) {
    reasons.push(reason(
      "provider_denied",
      "The provider is explicitly denied for this client.",
      "deniedProviders",
      false,
      true,
    ));
  }

  for (const capability of requiredCapabilities) {
    if (!candidate.capabilities.includes(capability)) {
      reasons.push(reason(
        "capability_missing",
        `The candidate does not provide required capability ${capability}.`,
        "capabilities",
        capability,
        false,
      ));
    }
  }

  if (policy.sensitive && candidate.region === null) {
    reasons.push(reason(
      "region_required",
      "Confidential and restricted data require a known provider region.",
      "region",
      "known",
      null,
    ));
  }
  if (policy.allowedRegions !== null) {
    if (candidate.region === null && !reasons.some((item) => item.code === "region_required")) {
      reasons.push(reason(
        "region_required",
        "A region allow-list is active, so an unknown provider region is denied.",
        "region",
        "known",
        null,
      ));
    } else if (candidate.region !== null && !policy.allowedRegions.has(candidate.region)) {
      reasons.push(reason(
        "region_not_allowed",
        "The provider region is outside the client region allow-list.",
        "allowedRegions",
        [...policy.allowedRegions].sort(compareAscii).join(","),
        candidate.region,
      ));
    }
  }

  if (policy.maxCostUsd !== null) {
    if (candidate.costUsd === null) {
      reasons.push(reason(
        "cost_required",
        "A cost ceiling is active, so an unknown candidate cost is denied.",
        "costUsd",
        policy.maxCostUsd,
        null,
      ));
    } else if (candidate.costUsd > policy.maxCostUsd) {
      reasons.push(reason(
        "cost_exceeds_limit",
        "The candidate cost exceeds the client ceiling.",
        "maxCostUsd",
        policy.maxCostUsd,
        candidate.costUsd,
      ));
    }
  }

  if (policy.maxLatencyMs !== null) {
    if (candidate.latencyMs === null) {
      reasons.push(reason(
        "latency_required",
        "A latency ceiling is active, so unknown latency is denied.",
        "latencyMs",
        policy.maxLatencyMs,
        null,
      ));
    } else if (candidate.latencyMs > policy.maxLatencyMs) {
      reasons.push(reason(
        "latency_exceeds_limit",
        "The candidate latency exceeds the client ceiling.",
        "maxLatencyMs",
        policy.maxLatencyMs,
        candidate.latencyMs,
      ));
    }
  }

  if (policy.minHealthScore !== null && candidate.health < policy.minHealthScore) {
    reasons.push(reason(
      "health_below_minimum",
      "The candidate health score is below the client minimum.",
      "minHealthScore",
      policy.minHealthScore,
      candidate.health,
    ));
  }

  if (candidate.quotaRemaining === 0) {
    reasons.push(reason(
      "quota_exhausted",
      "The provider candidate has no remaining quota.",
      "quotaRemaining",
      ">0",
      0,
    ));
  }
  if (policy.minQuotaRemaining !== null) {
    if (candidate.quotaRemaining === null) {
      reasons.push(reason(
        "quota_required",
        "A quota floor is active, so unknown provider quota is denied.",
        "quotaRemaining",
        policy.minQuotaRemaining,
        null,
      ));
    } else if (
      candidate.quotaRemaining > 0
      && candidate.quotaRemaining < policy.minQuotaRemaining
    ) {
      reasons.push(reason(
        "quota_below_minimum",
        "The remaining provider quota is below the client floor.",
        "minQuotaRemaining",
        policy.minQuotaRemaining,
        candidate.quotaRemaining,
      ));
    }
  }
  return Object.freeze(reasons);
}

function scoreCandidate(
  candidate: NormalizedCandidate,
  requiredCapabilities: readonly string[],
  preferFree: boolean,
): LocalClientProviderScoreBreakdown {
  const exactCapabilityMatch = sameStringSet(candidate.capabilities, requiredCapabilities);
  const capability = requiredCapabilities.length === 0
    ? SCORE_WEIGHTS.capability
    : exactCapabilityMatch
      ? SCORE_WEIGHTS.capability
      : SCORE_WEIGHTS.capability * 0.8;
  const health = SCORE_WEIGHTS.health * candidate.health;
  const reliability = SCORE_WEIGHTS.reliability * candidate.reliability;
  const latency = candidate.latencyMs === null
    ? 0
    : SCORE_WEIGHTS.latency / (1 + candidate.latencyMs / 1_000);
  const cost = candidate.costUsd === null
    ? 0
    : SCORE_WEIGHTS.cost / (1 + candidate.costUsd);
  const quota = candidate.quotaRemaining === null
    ? 0
    : SCORE_WEIGHTS.quota * candidate.quotaRemaining;
  const freePreference = preferFree && candidate.free ? SCORE_WEIGHTS.freePreference : 0;
  const total = capability + health + reliability + latency + cost + quota + freePreference;
  return Object.freeze({
    exactCapabilityMatch,
    capability: rounded(capability),
    health: rounded(health),
    reliability: rounded(reliability),
    latency: rounded(latency),
    cost: rounded(cost),
    quota: rounded(quota),
    freePreference: rounded(freePreference),
    total: rounded(total),
  });
}

function compareEligibleEvaluations(left: InternalEvaluation, right: InternalEvaluation): number {
  const leftScore = left.scoreBreakdown?.total ?? Number.NEGATIVE_INFINITY;
  const rightScore = right.scoreBreakdown?.total ?? Number.NEGATIVE_INFINITY;
  if (leftScore !== rightScore) return rightScore - leftScore;
  const keyOrder = compareAscii(left.candidate.key, right.candidate.key);
  return keyOrder !== 0 ? keyOrder : left.candidate.originalIndex - right.candidate.originalIndex;
}

function toPublicEvaluation(evaluation: InternalEvaluation): LocalClientProviderCandidateEvaluation {
  const policyEligible = evaluation.rejectionReasons.length === 0;
  const disposition: LocalClientProviderDisposition = !policyEligible
    ? "rejected"
    : evaluation.selected
      ? "selected"
      : "eligible_not_selected";
  return Object.freeze({
    candidate: evaluation.candidate.original,
    candidateKey: evaluation.candidate.key,
    disposition,
    policyEligible,
    selected: evaluation.selected,
    rejectionReasons: evaluation.rejectionReasons,
    notSelectedReasons: Object.freeze(evaluation.notSelectedReasons),
    score: evaluation.scoreBreakdown?.total ?? null,
    scoreBreakdown: evaluation.scoreBreakdown,
  });
}

function reason(
  code: LocalClientProviderReasonCode,
  message: string,
  field?: string,
  expected?: string | number | boolean,
  actual?: string | number | boolean | null,
): LocalClientProviderReason {
  return Object.freeze({
    code,
    message,
    ...(field === undefined ? {} : { field }),
    ...(expected === undefined ? {} : { expected }),
    ...(actual === undefined ? {} : { actual }),
  });
}

function normalizeStringList(
  value: readonly string[],
  field: string,
  lowercase = true,
): readonly string[] {
  if (!Array.isArray(value) || value.length > MAX_LIST_ENTRIES) throw invalidPolicy(field);
  const normalized = value.map((entry) => {
    const item = normalizeIdentifier(entry, field);
    return lowercase ? item.toLowerCase() : item;
  });
  if (new Set(normalized).size !== normalized.length) throw invalidPolicy(field);
  return Object.freeze(normalized);
}

function normalizeIdentifier(value: unknown, field: string): string {
  if (
    typeof value !== "string"
    || value.length < 1
    || value.length > MAX_IDENTIFIER_LENGTH
    || value !== value.trim()
    || CONTROL_CHARACTERS.test(value)
  ) {
    throw invalidPolicy(field);
  }
  return value;
}

function normalizePositiveInteger(value: unknown, max: number): number {
  if (!Number.isSafeInteger(value) || (value as number) < 1 || (value as number) > max) {
    throw invalidPolicy();
  }
  return value as number;
}

function normalizeUnitInterval(value: unknown): number {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0 || value > 1) {
    throw invalidPolicy();
  }
  return value;
}

function normalizeOptionalUnitInterval(value: unknown): number | null {
  return value === undefined ? null : normalizeUnitInterval(value);
}

function normalizeNullableUnitInterval(value: unknown): number | null {
  return value === undefined || value === null ? null : normalizeUnitInterval(value);
}

function normalizeOptionalNonNegative(value: unknown): number | null {
  if (value === undefined) return null;
  return normalizeNonNegative(value);
}

function normalizeNullableNonNegative(value: unknown): number | null {
  if (value === undefined || value === null) return null;
  return normalizeNonNegative(value);
}

function normalizeNonNegative(value: unknown): number {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) throw invalidPolicy();
  return value;
}

function sameStringSet(left: readonly string[], right: readonly string[]): boolean {
  if (left.length !== right.length) return false;
  const rightSet = new Set(right);
  return left.every((value) => rightSet.has(value));
}

function rounded(value: number): number {
  return Math.round((value + Number.EPSILON) * 1_000_000) / 1_000_000;
}

function compareAscii(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function assertAllowedKeys(value: Record<string, unknown>, allowedKeys: readonly string[]): void {
  const allowed = new Set(allowedKeys);
  if (Reflect.ownKeys(value).some((key) => typeof key !== "string" || !allowed.has(key))) {
    throw invalidPolicy();
  }
}

function invalidPolicy(field?: string): LocalClientProviderPolicyError {
  return new LocalClientProviderPolicyError(
    field
      ? `The local-client provider policy field ${field} is invalid.`
      : undefined,
  );
}
