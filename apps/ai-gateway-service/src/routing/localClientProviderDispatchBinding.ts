import { createHash } from "node:crypto";

import type { ManagedLocalClientPopVerification } from "../capabilities/localClientPopIdentityAuthority.ts";
import {
  LOCAL_CLIENT_PROVIDER_POLICY_VERSION,
  type LocalClientProviderCandidate,
  type LocalClientProviderRoutingDecision,
} from "./localClientProviderPolicy.ts";
import {
  LOCAL_CLIENT_PROVIDER_RUNTIME_ROUTER_VERSION,
  type LocalClientProviderRuntimeDecision,
} from "./localClientProviderRuntimeRouter.ts";

export const LOCAL_CLIENT_PROVIDER_DISPATCH_BINDING_VERSION =
  "local-client-provider-dispatch-binding-v1" as const;

export const LOCAL_CLIENT_PROVIDER_DISPATCH_BINDING_BOUNDARIES = Object.freeze({
  actualDispatchPerformed: false as const,
  pureDecisionRequired: true as const,
  verifiedPopIdentityRequired: true as const,
  singleProviderModelOnly: true as const,
  requestedFanout: 1 as const,
  fusionEnabled: false as const,
  weightedDispatchAllowed: false as const,
  fallbackDispatchAllowed: false as const,
  shadowDispatchAllowed: false as const,
  assertBeforeEveryProviderAttempt: true as const,
  decisionCarriesIdentityBinding: false as const,
  sameRequestPairingRequiredFromCaller: true as const,
  exactClientRevisionMatch: true as const,
  tenantAndSubjectExposed: false as const,
});

export interface LocalClientProviderDispatchBindingInput {
  readonly popVerification: ManagedLocalClientPopVerification;
  readonly runtimeDecision: LocalClientProviderRuntimeDecision;
}

export interface LocalClientProviderDispatchAttemptInput {
  readonly providerId: string;
  readonly modelId: string;
}

export interface LocalClientProviderDispatchAttemptAssertion {
  readonly allowed: true;
  readonly bindingVersion: typeof LOCAL_CLIENT_PROVIDER_DISPATCH_BINDING_VERSION;
  readonly providerId: string;
  readonly modelId: string;
  readonly decisionDigest: string;
  readonly actualDispatchPerformed: false;
}

export interface LocalClientProviderDispatchBinding {
  readonly bindingVersion: typeof LOCAL_CLIENT_PROVIDER_DISPATCH_BINDING_VERSION;
  readonly identityFingerprint: string;
  readonly clientId: string;
  readonly clientRevision: number;
  readonly policyRevision: string;
  readonly providerId: string;
  readonly modelId: string;
  readonly decisionDigest: string;
  readonly actualDispatchPerformed: false;
  readonly boundaries: typeof LOCAL_CLIENT_PROVIDER_DISPATCH_BINDING_BOUNDARIES;
  readonly assertAttempt: (
    input: LocalClientProviderDispatchAttemptInput,
  ) => LocalClientProviderDispatchAttemptAssertion;
}

export type LocalClientProviderDispatchBindingErrorCode =
  | "LOCAL_CLIENT_PROVIDER_DISPATCH_BINDING_INPUT_INVALID"
  | "LOCAL_CLIENT_PROVIDER_DISPATCH_BINDING_IDENTITY_INVALID"
  | "LOCAL_CLIENT_PROVIDER_DISPATCH_BINDING_DECISION_INVALID"
  | "LOCAL_CLIENT_PROVIDER_DISPATCH_BINDING_BOUNDARY_VIOLATION"
  | "LOCAL_CLIENT_PROVIDER_DISPATCH_ATTEMPT_DENIED";

export class LocalClientProviderDispatchBindingError extends Error {
  readonly code: LocalClientProviderDispatchBindingErrorCode;
  readonly category: "validation" | "integrity" | "authorization";
  readonly statusCode: number;
  readonly retryable = false as const;

  constructor(input: Readonly<{
    code: LocalClientProviderDispatchBindingErrorCode;
    message: string;
    category: LocalClientProviderDispatchBindingError["category"];
    statusCode: number;
  }>) {
    super(input.message);
    this.name = "LocalClientProviderDispatchBindingError";
    this.code = input.code;
    this.category = input.category;
    this.statusCode = input.statusCode;
  }
}

type NormalizedPopIdentity = Readonly<{
  tenantId: string;
  subjectId: string;
  clientId: string;
  clientRevision: number;
  proofFingerprint: string;
  issuedAtMs: number;
  expiresAtMs: number;
}>;

type CheckedDecision = Readonly<{
  clientRevision: number;
  policyRevision: string;
  providerId: string;
  modelId: string;
  canonical: LocalClientProviderRuntimeDecision;
}>;

const SHA256_PATTERN = /^[a-f0-9]{64}$/u;
const OPAQUE_IDENTITY_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:@/-]{0,255}$/u;
const CLIENT_ID_PATTERN = /^[a-z][a-z0-9._-]{0,127}$/u;
const POLICY_REVISION_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/u;
const RUNTIME_KEY_PATTERN = /^@?[A-Za-z0-9][A-Za-z0-9@._:/-]{0,254}$/u;
const REASON_CODE_PATTERN = /^[a-z][a-z0-9_]{0,63}$/u;
const FIELD_PATTERN = /^[A-Za-z][A-Za-z0-9._-]{0,127}$/u;
const DATA_CLASSES = new Set(["public", "internal", "confidential", "restricted"]);
const MAX_EVALUATIONS = 4_096;
const MAX_REASONS = 256;
const MAX_CAPABILITIES = 128;
const FORBIDDEN_DISPATCH_KEYS = new Set([
  "weight",
  "weights",
  "weighted",
  "fallback",
  "fallbacks",
  "shadow",
  "shadows",
  "attemptkind",
  "dispatchmode",
  "trafficpercentage",
]);

export function createLocalClientProviderDispatchBinding(
  input: LocalClientProviderDispatchBindingInput,
): LocalClientProviderDispatchBinding {
  rejectForbiddenOwnKeys(input, boundaryViolation);
  assertExactDataRecord(
    input,
    ["popVerification", "runtimeDecision"],
    ["popVerification", "runtimeDecision"],
    inputInvalid,
  );
  const identity = normalizePopVerification(input.popVerification);
  const decision = validateRuntimeDecision(input.runtimeDecision);
  if (decision.clientRevision !== identity.clientRevision) throw identityInvalid();
  const identityFingerprint = digest("identity", {
    tenantId: identity.tenantId,
    subjectId: identity.subjectId,
    clientId: identity.clientId,
    clientRevision: identity.clientRevision,
    proofFingerprint: identity.proofFingerprint,
    issuedAtMs: identity.issuedAtMs,
    expiresAtMs: identity.expiresAtMs,
  });
  const decisionDigest = digest("decision-binding", {
    identityFingerprint,
    clientId: identity.clientId,
    clientRevision: identity.clientRevision,
    runtimeDecision: decision.canonical,
  });
  const assertAttempt = (
    rawAttempt: LocalClientProviderDispatchAttemptInput,
  ): LocalClientProviderDispatchAttemptAssertion => {
    try {
      assertExactDataRecord(
        rawAttempt,
        ["providerId", "modelId"],
        ["providerId", "modelId"],
        attemptDenied,
      );
      const providerId = normalizeRuntimeKey(rawAttempt.providerId, attemptDenied);
      const modelId = normalizeRuntimeKey(rawAttempt.modelId, attemptDenied);
      if (providerId !== decision.providerId || modelId !== decision.modelId) {
        throw attemptDenied();
      }
      return Object.freeze({
        allowed: true as const,
        bindingVersion: LOCAL_CLIENT_PROVIDER_DISPATCH_BINDING_VERSION,
        providerId,
        modelId,
        decisionDigest,
        actualDispatchPerformed: false as const,
      });
    } catch (error) {
      if (
        error instanceof LocalClientProviderDispatchBindingError
        && error.code === "LOCAL_CLIENT_PROVIDER_DISPATCH_ATTEMPT_DENIED"
      ) throw error;
      throw attemptDenied();
    }
  };
  return Object.freeze({
    bindingVersion: LOCAL_CLIENT_PROVIDER_DISPATCH_BINDING_VERSION,
    identityFingerprint,
    clientId: identity.clientId,
    clientRevision: identity.clientRevision,
    policyRevision: decision.policyRevision,
    providerId: decision.providerId,
    modelId: decision.modelId,
    decisionDigest,
    actualDispatchPerformed: false as const,
    boundaries: LOCAL_CLIENT_PROVIDER_DISPATCH_BINDING_BOUNDARIES,
    assertAttempt,
  });
}

function normalizePopVerification(raw: unknown): NormalizedPopIdentity {
  assertExactDataRecord(
    raw,
    ["verified", "identity", "proofFingerprint", "issuedAtMs", "expiresAtMs"],
    ["verified", "identity", "proofFingerprint", "issuedAtMs", "expiresAtMs"],
    identityInvalid,
  );
  assertExactDataRecord(
    raw.identity,
    ["tenantId", "subjectId", "clientId", "clientRevision"],
    ["tenantId", "subjectId", "clientId", "clientRevision"],
    identityInvalid,
  );
  const tenantId = normalizeIdentifier(
    raw.identity.tenantId,
    OPAQUE_IDENTITY_PATTERN,
    identityInvalid,
  );
  const subjectId = normalizeIdentifier(
    raw.identity.subjectId,
    OPAQUE_IDENTITY_PATTERN,
    identityInvalid,
  );
  const clientId = normalizeIdentifier(
    raw.identity.clientId,
    CLIENT_ID_PATTERN,
    identityInvalid,
  );
  if (
    raw.verified !== true
    || !Number.isSafeInteger(raw.identity.clientRevision)
    || Number(raw.identity.clientRevision) < 1
    || typeof raw.proofFingerprint !== "string"
    || !SHA256_PATTERN.test(raw.proofFingerprint)
    || !isPositiveSafeInteger(raw.issuedAtMs)
    || !isPositiveSafeInteger(raw.expiresAtMs)
    || Number(raw.expiresAtMs) <= Number(raw.issuedAtMs)
  ) throw identityInvalid();
  return Object.freeze({
    tenantId,
    subjectId,
    clientId,
    clientRevision: Number(raw.identity.clientRevision),
    proofFingerprint: raw.proofFingerprint,
    issuedAtMs: Number(raw.issuedAtMs),
    expiresAtMs: Number(raw.expiresAtMs),
  });
}

function validateRuntimeDecision(raw: unknown): CheckedDecision {
  rejectForbiddenOwnKeys(raw, boundaryViolation);
  assertExactDataRecord(
    raw,
    [
      "runtimeRouterVersion",
      "clientRevision",
      "policyRevision",
      "dispatchPerformed",
      "inventory",
      "decision",
      "boundaries",
    ],
    [
      "runtimeRouterVersion",
      "policyRevision",
      "dispatchPerformed",
      "inventory",
      "decision",
      "boundaries",
    ],
    decisionInvalid,
  );
  if (raw.runtimeRouterVersion !== LOCAL_CLIENT_PROVIDER_RUNTIME_ROUTER_VERSION) {
    throw decisionInvalid();
  }
  if (raw.dispatchPerformed !== false) throw boundaryViolation();
  const clientRevision = boundedInteger(
    raw.clientRevision,
    1,
    Number.MAX_SAFE_INTEGER,
    decisionInvalid,
  );
  const policyRevision = normalizeIdentifier(
    raw.policyRevision,
    POLICY_REVISION_PATTERN,
    decisionInvalid,
  );
  validateBoundaries(raw.boundaries);
  const inventory = validateInventory(raw.inventory);
  const selected = validateRoutingDecision(raw.decision, inventory.modelCount);
  return Object.freeze({
    policyRevision,
    clientRevision,
    providerId: selected.provider,
    modelId: selected.model,
    canonical: raw as unknown as LocalClientProviderRuntimeDecision,
  });
}

function validateBoundaries(raw: unknown): void {
  rejectForbiddenOwnKeys(raw, boundaryViolation);
  assertExactDataRecord(
    raw,
    [
      "verifiedClientRequired",
      "candidatesFromTrustedRegistry",
      "policyFromTrustedResolver",
      "requestSuppliedFactsDenied",
      "clientRevisionBound",
      "dispatchPerformed",
    ],
    [
      "verifiedClientRequired",
      "candidatesFromTrustedRegistry",
      "policyFromTrustedResolver",
      "requestSuppliedFactsDenied",
      "dispatchPerformed",
    ],
    boundaryViolation,
  );
  if (
    raw.verifiedClientRequired !== true
    || raw.candidatesFromTrustedRegistry !== true
    || raw.policyFromTrustedResolver !== true
    || raw.requestSuppliedFactsDenied !== true
    || raw.clientRevisionBound !== true
    || raw.dispatchPerformed !== false
  ) throw boundaryViolation();
}

function validateInventory(raw: unknown): Readonly<{ modelCount: number }> {
  assertExactDataRecord(
    raw,
    [
      "providerCount",
      "modelCount",
      "observedModelCount",
      "unknownRegionCount",
      "unknownCostCount",
      "unknownQuotaCount",
    ],
    [
      "providerCount",
      "modelCount",
      "observedModelCount",
      "unknownRegionCount",
      "unknownCostCount",
      "unknownQuotaCount",
    ],
    decisionInvalid,
  );
  const providerCount = boundedInteger(raw.providerCount, 1, 256, decisionInvalid);
  const modelCount = boundedInteger(raw.modelCount, 1, MAX_EVALUATIONS, decisionInvalid);
  const observedModelCount = boundedInteger(raw.observedModelCount, 0, modelCount, decisionInvalid);
  const unknownRegionCount = boundedInteger(raw.unknownRegionCount, 0, modelCount, decisionInvalid);
  const unknownCostCount = boundedInteger(raw.unknownCostCount, 0, modelCount, decisionInvalid);
  const unknownQuotaCount = boundedInteger(raw.unknownQuotaCount, 0, modelCount, decisionInvalid);
  void providerCount;
  void observedModelCount;
  void unknownRegionCount;
  void unknownCostCount;
  void unknownQuotaCount;
  return Object.freeze({ modelCount });
}

function validateRoutingDecision(
  raw: unknown,
  inventoryModelCount: number,
): LocalClientProviderCandidate {
  rejectForbiddenOwnKeys(raw, boundaryViolation);
  assertExactDataRecord(
    raw,
    [
      "policyVersion",
      "dataClass",
      "requestedFanout",
      "policyMaxFanout",
      "effectiveFanout",
      "fanoutCapped",
      "fusionRequested",
      "fusionAllowed",
      "fusionEnabled",
      "sensitiveDefaultsApplied",
      "selected",
      "evaluations",
      "decisionReasons",
    ],
    [
      "policyVersion",
      "dataClass",
      "requestedFanout",
      "policyMaxFanout",
      "effectiveFanout",
      "fanoutCapped",
      "fusionRequested",
      "fusionAllowed",
      "fusionEnabled",
      "sensitiveDefaultsApplied",
      "selected",
      "evaluations",
      "decisionReasons",
    ],
    decisionInvalid,
  );
  if (
    raw.policyVersion !== LOCAL_CLIENT_PROVIDER_POLICY_VERSION
    || typeof raw.dataClass !== "string"
    || !DATA_CLASSES.has(raw.dataClass)
    || raw.requestedFanout !== 1
    || raw.effectiveFanout !== 1
    || raw.fanoutCapped !== false
    || raw.fusionRequested !== false
    || typeof raw.fusionAllowed !== "boolean"
    || raw.fusionEnabled !== false
    || typeof raw.sensitiveDefaultsApplied !== "boolean"
  ) throw boundaryViolation();
  boundedInteger(raw.policyMaxFanout, 1, 32, decisionInvalid);
  if (!Array.isArray(raw.selected) || raw.selected.length !== 1) throw boundaryViolation();
  const selected = validateCandidate(raw.selected[0]);
  if (!selected.available) throw boundaryViolation();
  if (!Array.isArray(raw.evaluations) || raw.evaluations.length !== inventoryModelCount) {
    throw decisionInvalid();
  }
  if (raw.evaluations.length < 1 || raw.evaluations.length > MAX_EVALUATIONS) {
    throw decisionInvalid();
  }
  const seenCandidates = new Set<string>();
  let matchingSelectedEvaluations = 0;
  for (const evaluation of raw.evaluations) {
    const checked = validateEvaluation(evaluation);
    const key = candidateKey(checked.candidate);
    if (seenCandidates.has(key)) throw decisionInvalid();
    seenCandidates.add(key);
    if (checked.selected) {
      matchingSelectedEvaluations += 1;
      if (!sameCandidate(checked.candidate, selected)) throw decisionInvalid();
    }
  }
  if (matchingSelectedEvaluations !== 1) throw decisionInvalid();
  validateReasons(raw.decisionReasons);
  return selected;
}

function validateCandidate(raw: unknown): LocalClientProviderCandidate {
  rejectForbiddenOwnKeys(raw, boundaryViolation);
  assertExactDataRecord(
    raw,
    [
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
    ],
    [
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
    ],
    decisionInvalid,
  );
  const provider = normalizeRuntimeKey(raw.provider, decisionInvalid);
  const model = normalizeRuntimeKey(raw.model, decisionInvalid);
  const region = raw.region === null
    ? null
    : normalizeIdentifier(raw.region, RUNTIME_KEY_PATTERN, decisionInvalid);
  if (!Array.isArray(raw.capabilities) || raw.capabilities.length > MAX_CAPABILITIES) {
    throw decisionInvalid();
  }
  const capabilities = raw.capabilities.map((value) => (
    normalizeRuntimeKey(value, decisionInvalid)
  ));
  if (new Set(capabilities).size !== capabilities.length) throw decisionInvalid();
  const health = unitInterval(raw.health, decisionInvalid);
  const reliability = unitInterval(raw.reliability, decisionInvalid);
  const latencyMs = nullableNonNegative(raw.latencyMs, decisionInvalid);
  const costUsd = nullableNonNegative(raw.costUsd, decisionInvalid);
  const quotaRemaining = raw.quotaRemaining === null
    ? null
    : unitInterval(raw.quotaRemaining, decisionInvalid);
  if (typeof raw.free !== "boolean" || typeof raw.available !== "boolean") {
    throw decisionInvalid();
  }
  return Object.freeze({
    provider,
    model,
    region,
    capabilities: Object.freeze(capabilities),
    health,
    reliability,
    latencyMs,
    costUsd,
    quotaRemaining,
    free: raw.free,
    available: raw.available,
  });
}

function validateEvaluation(raw: unknown): Readonly<{
  candidate: LocalClientProviderCandidate;
  selected: boolean;
}> {
  rejectForbiddenOwnKeys(raw, boundaryViolation);
  assertExactDataRecord(
    raw,
    [
      "candidate",
      "candidateKey",
      "disposition",
      "policyEligible",
      "selected",
      "rejectionReasons",
      "notSelectedReasons",
      "score",
      "scoreBreakdown",
    ],
    [
      "candidate",
      "candidateKey",
      "disposition",
      "policyEligible",
      "selected",
      "rejectionReasons",
      "notSelectedReasons",
      "score",
      "scoreBreakdown",
    ],
    decisionInvalid,
  );
  const candidate = validateCandidate(raw.candidate);
  if (
    raw.candidateKey !== candidateKey(candidate)
    || typeof raw.disposition !== "string"
    || !new Set(["selected", "eligible_not_selected", "rejected"]).has(raw.disposition)
    || typeof raw.policyEligible !== "boolean"
    || typeof raw.selected !== "boolean"
    || (raw.selected === true) !== (raw.disposition === "selected")
    || (raw.selected === true && raw.policyEligible !== true)
  ) throw decisionInvalid();
  validateReasons(raw.rejectionReasons);
  validateReasons(raw.notSelectedReasons);
  if (
    (raw.score !== null && (typeof raw.score !== "number" || !Number.isFinite(raw.score)))
    || (raw.scoreBreakdown === null) !== (raw.score === null)
  ) throw decisionInvalid();
  if (raw.scoreBreakdown !== null) {
    const total = validateScoreBreakdown(raw.scoreBreakdown);
    if (total !== raw.score) throw decisionInvalid();
  }
  return Object.freeze({ candidate, selected: raw.selected });
}

function validateScoreBreakdown(raw: unknown): number {
  assertExactDataRecord(
    raw,
    [
      "exactCapabilityMatch",
      "capability",
      "health",
      "reliability",
      "latency",
      "cost",
      "quota",
      "freePreference",
      "total",
    ],
    [
      "exactCapabilityMatch",
      "capability",
      "health",
      "reliability",
      "latency",
      "cost",
      "quota",
      "freePreference",
      "total",
    ],
    decisionInvalid,
  );
  if (typeof raw.exactCapabilityMatch !== "boolean") throw decisionInvalid();
  for (const key of [
    "capability",
    "health",
    "reliability",
    "latency",
    "cost",
    "quota",
    "freePreference",
    "total",
  ] as const) {
    if (typeof raw[key] !== "number" || !Number.isFinite(raw[key]) || raw[key] < 0) {
      throw decisionInvalid();
    }
  }
  return Number(raw.total);
}

function validateReasons(raw: unknown): void {
  if (!Array.isArray(raw) || raw.length > MAX_REASONS) throw decisionInvalid();
  for (const reason of raw) {
    assertExactDataRecord(
      reason,
      ["code", "message", "field", "expected", "actual"],
      ["code", "message"],
      decisionInvalid,
    );
    if (
      typeof reason.code !== "string"
      || !REASON_CODE_PATTERN.test(reason.code)
      || typeof reason.message !== "string"
      || reason.message.length < 1
      || reason.message.length > 1_024
      || /[\u0000-\u001f\u007f]/u.test(reason.message)
      || (reason.field !== undefined && (
        typeof reason.field !== "string" || !FIELD_PATTERN.test(reason.field)
      ))
      || (reason.expected !== undefined && !isReasonScalar(reason.expected, false))
      || (reason.actual !== undefined && !isReasonScalar(reason.actual, true))
    ) throw decisionInvalid();
  }
}

function candidateKey(candidate: LocalClientProviderCandidate): string {
  return `${candidate.provider}/${candidate.model}@${candidate.region ?? "unknown"}`;
}

function sameCandidate(
  left: LocalClientProviderCandidate,
  right: LocalClientProviderCandidate,
): boolean {
  return canonicalJson(left) === canonicalJson(right);
}

function digest(domain: "identity" | "decision-binding", value: unknown): string {
  return createHash("sha256")
    .update(`local-client-provider-dispatch-${domain}-v1\0`, "utf8")
    .update(canonicalJson(value), "utf8")
    .digest("hex");
}

function canonicalJson(value: unknown, ancestors = new Set<object>()): string {
  if (value === null || typeof value === "boolean" || typeof value === "string") {
    return JSON.stringify(value);
  }
  if (typeof value === "number") {
    if (!Number.isFinite(value)) throw decisionInvalid();
    return JSON.stringify(value);
  }
  if (typeof value !== "object") throw decisionInvalid();
  if (ancestors.has(value)) throw decisionInvalid();
  ancestors.add(value);
  try {
    if (Array.isArray(value)) {
      return `[${value.map((entry) => canonicalJson(entry, ancestors)).join(",")}]`;
    }
    if (!isPlainRecord(value)) throw decisionInvalid();
    return `{${Object.keys(value).sort().map((key) => (
      `${JSON.stringify(key)}:${canonicalJson(value[key], ancestors)}`
    )).join(",")}}`;
  } finally {
    ancestors.delete(value);
  }
}

function normalizeRuntimeKey(
  value: unknown,
  errorFactory: () => LocalClientProviderDispatchBindingError,
): string {
  return normalizeIdentifier(value, RUNTIME_KEY_PATTERN, errorFactory);
}

function normalizeIdentifier(
  value: unknown,
  pattern: RegExp,
  errorFactory: () => LocalClientProviderDispatchBindingError,
): string {
  if (typeof value !== "string" || value !== value.trim() || !pattern.test(value)) {
    throw errorFactory();
  }
  return value;
}

function boundedInteger(
  value: unknown,
  minimum: number,
  maximum: number,
  errorFactory: () => LocalClientProviderDispatchBindingError,
): number {
  if (!Number.isSafeInteger(value) || Number(value) < minimum || Number(value) > maximum) {
    throw errorFactory();
  }
  return Number(value);
}

function unitInterval(
  value: unknown,
  errorFactory: () => LocalClientProviderDispatchBindingError,
): number {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0 || value > 1) {
    throw errorFactory();
  }
  return value;
}

function nullableNonNegative(
  value: unknown,
  errorFactory: () => LocalClientProviderDispatchBindingError,
): number | null {
  if (value === null) return null;
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) {
    throw errorFactory();
  }
  return value;
}

function isReasonScalar(value: unknown, allowNull: boolean): boolean {
  if (allowNull && value === null) return true;
  if (typeof value === "string") {
    return value.length <= 1_024 && !/[\u0000-\u001f\u007f]/u.test(value);
  }
  return typeof value === "boolean"
    || (typeof value === "number" && Number.isFinite(value));
}

function isPositiveSafeInteger(value: unknown): boolean {
  return Number.isSafeInteger(value) && Number(value) > 0;
}

function rejectForbiddenOwnKeys(
  value: unknown,
  errorFactory: () => LocalClientProviderDispatchBindingError,
): void {
  if (!isPlainRecord(value)) return;
  if (Reflect.ownKeys(value).some((key) => (
    typeof key === "string" && FORBIDDEN_DISPATCH_KEYS.has(key.toLowerCase())
  ))) throw errorFactory();
}

function assertExactDataRecord(
  value: unknown,
  allowedKeys: readonly string[],
  requiredKeys: readonly string[],
  errorFactory: () => LocalClientProviderDispatchBindingError,
): asserts value is Record<string, unknown> {
  if (!isPlainRecord(value)) throw errorFactory();
  const keys = Reflect.ownKeys(value);
  if (
    keys.some((key) => typeof key !== "string" || !allowedKeys.includes(key))
    || requiredKeys.some((key) => !Object.hasOwn(value, key))
  ) throw errorFactory();
  const descriptors = Object.getOwnPropertyDescriptors(value);
  if (keys.some((key) => {
    if (typeof key !== "string") return true;
    const descriptor = descriptors[key];
    return !descriptor || !("value" in descriptor) || descriptor.get !== undefined || descriptor.set !== undefined;
  })) throw errorFactory();
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function dispatchError(
  input: ConstructorParameters<typeof LocalClientProviderDispatchBindingError>[0],
): LocalClientProviderDispatchBindingError {
  return new LocalClientProviderDispatchBindingError(input);
}

function inputInvalid(): LocalClientProviderDispatchBindingError {
  return dispatchError({
    code: "LOCAL_CLIENT_PROVIDER_DISPATCH_BINDING_INPUT_INVALID",
    message: "The local-client provider dispatch binding input is invalid.",
    category: "validation",
    statusCode: 400,
  });
}

function identityInvalid(): LocalClientProviderDispatchBindingError {
  return dispatchError({
    code: "LOCAL_CLIENT_PROVIDER_DISPATCH_BINDING_IDENTITY_INVALID",
    message: "A current verified local-client proof identity is required.",
    category: "integrity",
    statusCode: 401,
  });
}

function decisionInvalid(): LocalClientProviderDispatchBindingError {
  return dispatchError({
    code: "LOCAL_CLIENT_PROVIDER_DISPATCH_BINDING_DECISION_INVALID",
    message: "The local-client provider routing decision is invalid.",
    category: "integrity",
    statusCode: 409,
  });
}

function boundaryViolation(): LocalClientProviderDispatchBindingError {
  return dispatchError({
    code: "LOCAL_CLIENT_PROVIDER_DISPATCH_BINDING_BOUNDARY_VIOLATION",
    message: "The provider decision exceeds the single-target dispatch boundary.",
    category: "integrity",
    statusCode: 409,
  });
}

function attemptDenied(): LocalClientProviderDispatchBindingError {
  return dispatchError({
    code: "LOCAL_CLIENT_PROVIDER_DISPATCH_ATTEMPT_DENIED",
    message: "The provider attempt is outside the verified dispatch binding.",
    category: "authorization",
    statusCode: 403,
  });
}
