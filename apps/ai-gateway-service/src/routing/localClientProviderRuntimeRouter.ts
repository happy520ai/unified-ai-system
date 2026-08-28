import {
  evaluateLocalClientProviderPolicy,
  type LocalClientProviderCandidate,
  type LocalClientProviderPolicy,
  type LocalClientProviderRoutingDecision,
} from "./localClientProviderPolicy.ts";

export const LOCAL_CLIENT_PROVIDER_RUNTIME_ROUTER_VERSION = "local-client-provider-runtime-router-v1" as const;

type UnknownRecord = Record<string, unknown>;

export interface LocalClientProviderRuntimeIdentity {
  readonly tenantId: string;
  readonly subjectId: string;
}

export interface LocalClientProviderRuntimeRequest extends LocalClientProviderRuntimeIdentity {
  readonly clientId: string;
  readonly expectedClientRevision?: number;
  readonly requiredCapabilities?: readonly string[];
  readonly requestedFanout?: number;
  readonly fusionRequested?: boolean;
}

export interface ResolvedLocalClientProviderPolicy {
  readonly policyRevision: string;
  readonly policy: LocalClientProviderPolicy;
}

export interface ProviderObservationSnapshot {
  readonly sampleCount: number;
  readonly successRate: number | null;
  readonly p50LatencyMs: number | null;
}

export interface LocalClientProviderRuntimeRouterDependencies {
  readonly providerRegistry: {
    listDescriptors(): readonly unknown[];
  };
  readonly healthFacts: {
    getScore(providerId: string): number;
    getSnapshot?(providerId: string): ProviderObservationSnapshot;
  };
  readonly resolvePolicy: (input: Readonly<{
    identity: LocalClientProviderRuntimeIdentity;
    clientId: string;
  }>) => ResolvedLocalClientProviderPolicy | Promise<ResolvedLocalClientProviderPolicy>;
  readonly authorizeClient: (input: Readonly<{
    identity: LocalClientProviderRuntimeIdentity;
    clientId: string;
  }>) => unknown | Promise<unknown>;
}

export type LocalClientProviderRuntimeDecision = Readonly<{
  runtimeRouterVersion: typeof LOCAL_CLIENT_PROVIDER_RUNTIME_ROUTER_VERSION;
  clientRevision: number;
  policyRevision: string;
  dispatchPerformed: false;
  inventory: Readonly<{
    providerCount: number;
    modelCount: number;
    observedModelCount: number;
    unknownRegionCount: number;
    unknownCostCount: number;
    unknownQuotaCount: number;
  }>;
  decision: LocalClientProviderRoutingDecision;
  boundaries: Readonly<{
    verifiedClientRequired: true;
    candidatesFromTrustedRegistry: true;
    policyFromTrustedResolver: true;
    requestSuppliedFactsDenied: true;
    clientRevisionBound: true;
    dispatchPerformed: false;
  }>;
}>;

export type LocalClientProviderRuntimeRouterErrorCode =
  | "LOCAL_CLIENT_PROVIDER_RUNTIME_CONFIG_INVALID"
  | "LOCAL_CLIENT_PROVIDER_RUNTIME_REQUEST_INVALID"
  | "LOCAL_CLIENT_PROVIDER_RUNTIME_CLIENT_UNVERIFIED"
  | "LOCAL_CLIENT_PROVIDER_RUNTIME_POLICY_INVALID"
  | "LOCAL_CLIENT_PROVIDER_RUNTIME_INVENTORY_INVALID";

export class LocalClientProviderRuntimeRouterError extends Error {
  readonly code: LocalClientProviderRuntimeRouterErrorCode;
  readonly category: "configuration" | "validation" | "integrity";
  readonly statusCode: number;
  readonly retryable = false;

  constructor(
    code: LocalClientProviderRuntimeRouterErrorCode,
    message: string,
    category: LocalClientProviderRuntimeRouterError["category"],
    statusCode: number,
  ) {
    super(message);
    this.name = "LocalClientProviderRuntimeRouterError";
    this.code = code;
    this.category = category;
    this.statusCode = statusCode;
  }
}

const RUNTIME_KEY_PATTERN = /^@?[A-Za-z0-9][A-Za-z0-9@._:/-]{0,254}$/u;
const CLIENT_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/u;
const POLICY_REVISION_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/u;
const MAX_PROVIDERS = 256;
const MAX_MODELS = 4_096;
const MAX_CAPABILITIES = 128;
const REQUEST_KEYS = Object.freeze([
  "tenantId",
  "subjectId",
  "clientId",
  "expectedClientRevision",
  "requiredCapabilities",
  "requestedFanout",
  "fusionRequested",
]);
const BOUNDARIES = Object.freeze({
  verifiedClientRequired: true as const,
  candidatesFromTrustedRegistry: true as const,
  policyFromTrustedResolver: true as const,
  requestSuppliedFactsDenied: true as const,
  clientRevisionBound: true as const,
  dispatchPerformed: false as const,
});

export function createLocalClientProviderRuntimeRouter(
  dependencies: LocalClientProviderRuntimeRouterDependencies,
) {
  assertDependencies(dependencies);

  return Object.freeze({
    boundaries: BOUNDARIES,

    async route(rawRequest: LocalClientProviderRuntimeRequest): Promise<LocalClientProviderRuntimeDecision> {
      const request = normalizeRequest(rawRequest);
      const identity = Object.freeze({
        tenantId: request.tenantId,
        subjectId: request.subjectId,
      });
      const authorizedClient = validateAuthorizedClient(
        await dependencies.authorizeClient({ identity, clientId: request.clientId }),
        request.clientId,
      );
      if (
        request.expectedClientRevision !== null
        && authorizedClient.revision !== request.expectedClientRevision
      ) {
        throw runtimeError(
          "LOCAL_CLIENT_PROVIDER_RUNTIME_CLIENT_UNVERIFIED",
          "Provider routing requires the exact authenticated client revision.",
          "integrity",
          409,
        );
      }
      const policyResolution = validatePolicyResolution(
        await dependencies.resolvePolicy({ identity, clientId: request.clientId }),
      );
      const inventory = buildTrustedInventory(
        dependencies.providerRegistry.listDescriptors(),
        dependencies.healthFacts,
      );
      const decision = evaluateLocalClientProviderPolicy({
        policy: policyResolution.policy,
        candidates: inventory.candidates,
        requiredCapabilities: request.requiredCapabilities,
        requestedFanout: request.requestedFanout,
        fusionRequested: request.fusionRequested,
      });

      return Object.freeze({
        runtimeRouterVersion: LOCAL_CLIENT_PROVIDER_RUNTIME_ROUTER_VERSION,
        clientRevision: authorizedClient.revision,
        policyRevision: policyResolution.policyRevision,
        dispatchPerformed: false as const,
        inventory: inventory.summary,
        decision,
        boundaries: BOUNDARIES,
      });
    },
  });
}

function buildTrustedInventory(
  rawDescriptors: readonly unknown[],
  healthFacts: LocalClientProviderRuntimeRouterDependencies["healthFacts"],
) {
  if (!Array.isArray(rawDescriptors) || rawDescriptors.length > MAX_PROVIDERS) throw inventoryError();
  const candidates: LocalClientProviderCandidate[] = [];
  const providerIds = new Set<string>();
  let observedModelCount = 0;
  let unknownRegionCount = 0;
  let unknownCostCount = 0;
  let unknownQuotaCount = 0;

  for (const rawDescriptor of rawDescriptors) {
    if (!isPlainRecord(rawDescriptor)) throw inventoryError();
    const provider = normalizeRuntimeKey(rawDescriptor.id);
    const providerKey = provider.toLowerCase();
    if (!provider || providerIds.has(providerKey)) throw inventoryError();
    providerIds.add(providerKey);
    const models = rawDescriptor.models;
    if (!Array.isArray(models)) throw inventoryError();
    if (candidates.length + models.length > MAX_MODELS) throw inventoryError();
    const providerMetadata = isPlainRecord(rawDescriptor.metadata) ? rawDescriptor.metadata : {};
    const providerRegion = optionalText(providerMetadata.routingRegion ?? providerMetadata.region);
    const providerAvailable = providerMetadata.runtimeAvailable !== false;
    const health = normalizeHealthScore(healthFacts.getScore(provider));
    const observation = normalizeObservation(healthFacts.getSnapshot?.(provider));
    const modelIds = new Set<string>();

    for (const rawModel of models) {
      if (!isPlainRecord(rawModel)) throw inventoryError();
      if (rawModel.enabled === false) continue;
      const model = normalizeRuntimeKey(rawModel.id);
      if (!model) throw inventoryError();
      const modelKey = model.toLowerCase();
      if (modelIds.has(modelKey)) throw inventoryError();
      modelIds.add(modelKey);
      const capabilities = normalizeCapabilities(rawModel.capabilities);
      const metadata = isPlainRecord(rawModel.metadata) ? rawModel.metadata : {};
      const region = optionalText(metadata.routingRegion ?? metadata.region) ?? providerRegion;
      const costUsd = optionalNonNegative(metadata.routingCostUsd);
      const quotaRemaining = optionalUnitInterval(metadata.routingQuotaRemaining ?? providerMetadata.routingQuotaRemaining);
      const latencyMs = observation.p50LatencyMs;
      const free = costUsd === 0 || String(rawModel.costTier ?? "").trim().toLowerCase() === "free";
      if (observation.sampleCount > 0) observedModelCount += 1;
      if (region === null) unknownRegionCount += 1;
      if (costUsd === null) unknownCostCount += 1;
      if (quotaRemaining === null) unknownQuotaCount += 1;

      candidates.push(Object.freeze({
        provider,
        model,
        region,
        capabilities,
        health,
        reliability: observation.successRate ?? 0.5,
        latencyMs,
        costUsd,
        quotaRemaining,
        free,
        available: providerAvailable && metadata.runtimeAvailable !== false,
      }));
    }
  }

  return Object.freeze({
    candidates: Object.freeze(candidates),
    summary: Object.freeze({
      providerCount: providerIds.size,
      modelCount: candidates.length,
      observedModelCount,
      unknownRegionCount,
      unknownCostCount,
      unknownQuotaCount,
    }),
  });
}

function normalizeRequest(raw: LocalClientProviderRuntimeRequest) {
  if (!isPlainRecord(raw) || !hasOnlyKeys(raw, REQUEST_KEYS)) throw requestError();
  const tenantId = normalizeScopeValue(raw.tenantId);
  const subjectId = normalizeScopeValue(raw.subjectId);
  const clientId = normalizeClientId(raw.clientId);
  const requiredCapabilities = raw.requiredCapabilities === undefined
    ? Object.freeze([] as string[])
    : normalizeCapabilities(raw.requiredCapabilities);
  const requestedFanout = raw.requestedFanout === undefined
    ? 1
    : normalizeBoundedInteger(raw.requestedFanout, 1, 32);
  if (
    !tenantId
    || !subjectId
    || !clientId
    || (raw.fusionRequested !== undefined && typeof raw.fusionRequested !== "boolean")
  ) throw requestError();
  return Object.freeze({
    tenantId,
    subjectId,
    clientId,
    expectedClientRevision: raw.expectedClientRevision === undefined
      ? null
      : normalizeBoundedInteger(raw.expectedClientRevision, 1, Number.MAX_SAFE_INTEGER),
    requiredCapabilities,
    requestedFanout,
    fusionRequested: raw.fusionRequested === true,
  });
}

function validatePolicyResolution(raw: ResolvedLocalClientProviderPolicy): ResolvedLocalClientProviderPolicy {
  if (
    !isPlainRecord(raw)
    || !hasOnlyKeys(raw, ["policyRevision", "policy"])
    || typeof raw.policyRevision !== "string"
    || !POLICY_REVISION_PATTERN.test(raw.policyRevision.trim())
    || !isPlainRecord(raw.policy)
  ) throw policyError();
  return Object.freeze({
    policyRevision: raw.policyRevision.trim(),
    policy: raw.policy,
  });
}

function validateAuthorizedClient(raw: unknown, clientId: string): Readonly<{ revision: number }> {
  if (
    !isPlainRecord(raw)
    || raw.clientId !== clientId
    || raw.state !== "verified"
    || raw.trustDecision !== "verified"
    || !Number.isSafeInteger(raw.revision)
    || Number(raw.revision) < 1
    || !isPlainRecord(raw.adapter)
    || raw.adapter.type === "fake"
  ) {
    throw runtimeError(
      "LOCAL_CLIENT_PROVIDER_RUNTIME_CLIENT_UNVERIFIED",
      "Provider routing requires a current verified local client.",
      "integrity",
      409,
    );
  }
  return Object.freeze({ revision: Number(raw.revision) });
}

function normalizeObservation(raw: ProviderObservationSnapshot | undefined) {
  if (raw === undefined) {
    return Object.freeze({ sampleCount: 0, successRate: null, p50LatencyMs: null });
  }
  if (
    !isPlainRecord(raw)
    || !hasOnlyKeys(raw, ["sampleCount", "successRate", "p50LatencyMs"])
    || !Number.isSafeInteger(raw.sampleCount)
    || raw.sampleCount < 0
  ) throw inventoryError();
  const successRate = raw.successRate === null ? null : optionalUnitInterval(raw.successRate);
  const p50LatencyMs = raw.p50LatencyMs === null ? null : optionalNonNegative(raw.p50LatencyMs);
  if (
    (raw.successRate !== null && successRate === null)
    || (raw.p50LatencyMs !== null && p50LatencyMs === null)
    || (raw.sampleCount === 0 && (successRate !== null || p50LatencyMs !== null))
    || (raw.sampleCount > 0 && successRate === null)
  ) throw inventoryError();
  return Object.freeze({ sampleCount: raw.sampleCount, successRate, p50LatencyMs });
}

function normalizeHealthScore(value: unknown): number {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0 || value > 100) {
    throw inventoryError();
  }
  return value / 100;
}

function normalizeCapabilities(value: unknown): readonly string[] {
  if (!Array.isArray(value) || value.length > MAX_CAPABILITIES) throw inventoryError();
  const values = value.map((item) => normalizeRuntimeKey(item).toLowerCase());
  if (values.some((item) => !item)) throw inventoryError();
  return Object.freeze([...new Set(values)]);
}

function normalizeRuntimeKey(value: unknown): string {
  if (typeof value !== "string") return "";
  const normalized = value.trim();
  return RUNTIME_KEY_PATTERN.test(normalized) ? normalized : "";
}

function normalizeScopeValue(value: unknown): string {
  if (typeof value !== "string") return "";
  const normalized = value.trim();
  if (
    normalized.length < 1
    || normalized.length > 128
    || /[\u0000-\u001f\u007f]/u.test(normalized)
  ) return "";
  return normalized;
}

function normalizeClientId(value: unknown): string {
  if (typeof value !== "string") return "";
  const normalized = value.trim();
  return CLIENT_ID_PATTERN.test(normalized) ? normalized : "";
}

function optionalText(value: unknown): string | null {
  if (value === undefined || value === null || value === "") return null;
  if (typeof value !== "string") throw inventoryError();
  const normalized = value.trim().toLowerCase();
  if (!normalized || normalized.length > 128 || /[\u0000-\u001f\u007f]/u.test(normalized)) {
    throw inventoryError();
  }
  return normalized;
}

function optionalNonNegative(value: unknown): number | null {
  if (value === undefined || value === null || value === "") return null;
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) throw inventoryError();
  return value;
}

function optionalUnitInterval(value: unknown): number | null {
  if (value === undefined || value === null || value === "") return null;
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0 || value > 1) {
    throw inventoryError();
  }
  return value;
}

function normalizeBoundedInteger(value: unknown, minimum: number, maximum: number): number {
  if (!Number.isSafeInteger(value) || Number(value) < minimum || Number(value) > maximum) throw requestError();
  return Number(value);
}

function assertDependencies(dependencies: LocalClientProviderRuntimeRouterDependencies): void {
  if (
    !isPlainRecord(dependencies)
    || !hasOnlyKeys(dependencies, ["providerRegistry", "healthFacts", "resolvePolicy", "authorizeClient"])
    || typeof dependencies.providerRegistry?.listDescriptors !== "function"
    || typeof dependencies.healthFacts?.getScore !== "function"
    || (dependencies.healthFacts.getSnapshot !== undefined && typeof dependencies.healthFacts.getSnapshot !== "function")
    || typeof dependencies.resolvePolicy !== "function"
    || typeof dependencies.authorizeClient !== "function"
  ) throw configError();
}

function isPlainRecord(value: unknown): value is UnknownRecord {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function hasOnlyKeys(value: object, allowedKeys: readonly string[]): boolean {
  const allowed = new Set(allowedKeys);
  return Reflect.ownKeys(value).every((key) => typeof key === "string" && allowed.has(key));
}

function runtimeError(
  code: LocalClientProviderRuntimeRouterErrorCode,
  message: string,
  category: LocalClientProviderRuntimeRouterError["category"],
  statusCode: number,
) {
  return new LocalClientProviderRuntimeRouterError(code, message, category, statusCode);
}

function configError() {
  return runtimeError(
    "LOCAL_CLIENT_PROVIDER_RUNTIME_CONFIG_INVALID",
    "The local-client provider runtime router configuration is invalid.",
    "configuration",
    503,
  );
}

function requestError() {
  return runtimeError(
    "LOCAL_CLIENT_PROVIDER_RUNTIME_REQUEST_INVALID",
    "The local-client provider runtime request is invalid.",
    "validation",
    400,
  );
}

function policyError() {
  return runtimeError(
    "LOCAL_CLIENT_PROVIDER_RUNTIME_POLICY_INVALID",
    "The trusted local-client provider policy could not be resolved.",
    "integrity",
    409,
  );
}

function inventoryError() {
  return runtimeError(
    "LOCAL_CLIENT_PROVIDER_RUNTIME_INVENTORY_INVALID",
    "The trusted provider inventory or health facts are invalid.",
    "integrity",
    503,
  );
}
