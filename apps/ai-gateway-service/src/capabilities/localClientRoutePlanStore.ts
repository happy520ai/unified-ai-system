import { createHash, timingSafeEqual } from "node:crypto";

export const LOCAL_CLIENT_ROUTE_PLAN_VERSION = "local-client-route-plan-v1" as const;
export const LOCAL_CLIENT_ROUTE_PLAN_DEFAULT_TTL_MS = 60_000;
export const LOCAL_CLIENT_ROUTE_PLAN_MAX_TTL_MS = 5 * 60_000;
export const LOCAL_CLIENT_ROUTE_PLAN_DEFAULT_MAX_ENTRIES = 1_024;
export const LOCAL_CLIENT_ROUTE_PLAN_HARD_MAX_ENTRIES = 10_000;
export const LOCAL_CLIENT_ROUTE_PLAN_DEFAULT_MAX_INPUT_BYTES = 64 * 1_024;
export const LOCAL_CLIENT_ROUTE_PLAN_HARD_MAX_INPUT_BYTES = 64 * 1_024;

export interface LocalClientRoutePlanBoundaries {
  readonly storageMode: "single-process-memory" | "single-host-sqlite";
  readonly available: true;
  readonly durable: boolean;
  readonly distributed: false;
  readonly previewOnly: true;
  readonly grantsApproval: false;
  readonly providesExternalEffectFence: false;
  readonly oneTimeConsume: true;
  readonly singleHost?: true;
}

/**
 * A route plan is only an immutable, short-lived preview binding. Consuming a
 * plan does not approve an action, execute an adapter, or provide the durable
 * fence required at an external-effect boundary.
 */
export const LOCAL_CLIENT_ROUTE_PLAN_BOUNDARIES = Object.freeze({
  storageMode: "single-process-memory" as const,
  available: true as const,
  durable: false as const,
  distributed: false as const,
  previewOnly: true as const,
  grantsApproval: false as const,
  providesExternalEffectFence: false as const,
  oneTimeConsume: true as const,
});

export interface VerifiedLocalClientRoutePlanTarget {
  readonly descriptorVersion: "verified-local-client-adapter-target-v1";
  readonly clientId: string;
  readonly revision: number;
  readonly state: "verified";
  readonly trustDecision: "verified";
  readonly adapter: {
    readonly id: string;
    readonly type: string;
    readonly version: string;
  };
  readonly capabilityIds: readonly string[];
}

export interface CreateLocalClientRoutePlanRequest {
  readonly tenantId: string;
  readonly subjectId: string;
  readonly target: VerifiedLocalClientRoutePlanTarget;
  readonly capabilityId: string;
  readonly actionId: string;
  readonly input: Readonly<Record<string, unknown>>;
  readonly policyVersion: string;
}

export interface LocalClientRoutePlanReference {
  readonly tenantId: string;
  readonly subjectId: string;
  readonly planId: string;
}

export interface LocalClientRoutePlan {
  readonly planVersion: typeof LOCAL_CLIENT_ROUTE_PLAN_VERSION;
  readonly planId: string;
  readonly tenantId: string;
  readonly subjectId: string;
  readonly clientId: string;
  readonly clientRevision: number;
  readonly clientState: "verified";
  readonly clientTrustDecision: "verified";
  readonly adapterId: string;
  readonly adapterType: string;
  readonly adapterVersion: string;
  readonly capabilityId: string;
  readonly actionId: string;
  readonly inputSha256: string;
  readonly policyVersion: string;
  readonly createdAt: string;
  readonly expiresAt: string;
  readonly boundaries: LocalClientRoutePlanBoundaries;
}

export interface LocalClientRoutePlanStoreOptions {
  readonly ttlMs?: number;
  readonly maxEntries?: number;
  readonly maxInputBytes?: number;
  readonly now?: () => number;
}

export type VerifiedLocalClientRoutePlanInput = Readonly<Record<string, string | number | boolean>>;

export type LocalClientRoutePlanStoreErrorCode =
  | "LOCAL_CLIENT_ROUTE_PLAN_CONFIGURATION_INVALID"
  | "LOCAL_CLIENT_ROUTE_PLAN_CLOCK_INVALID"
  | "LOCAL_CLIENT_ROUTE_PLAN_IDENTITY_REQUIRED"
  | "LOCAL_CLIENT_ROUTE_PLAN_REQUEST_INVALID"
  | "LOCAL_CLIENT_ROUTE_PLAN_TARGET_UNVERIFIED"
  | "LOCAL_CLIENT_ROUTE_PLAN_CAPABILITY_MISMATCH"
  | "LOCAL_CLIENT_ROUTE_PLAN_INPUT_INVALID"
  | "LOCAL_CLIENT_ROUTE_PLAN_INPUT_TOO_LARGE"
  | "LOCAL_CLIENT_ROUTE_PLAN_CAPACITY_REACHED"
  | "LOCAL_CLIENT_ROUTE_PLAN_UNAVAILABLE"
  | "LOCAL_CLIENT_ROUTE_PLAN_EXPIRED"
  | "LOCAL_CLIENT_ROUTE_PLAN_ALREADY_CONSUMED"
  | "LOCAL_CLIENT_ROUTE_PLAN_INTEGRITY_INVALID";

export class LocalClientRoutePlanStoreError extends Error {
  readonly code: LocalClientRoutePlanStoreErrorCode;
  readonly category: "configuration" | "auth" | "validation" | "capacity" | "lifecycle" | "integrity";
  readonly statusCode: number;
  readonly retryable: boolean;

  constructor(
    code: LocalClientRoutePlanStoreErrorCode,
    message: string,
    category: LocalClientRoutePlanStoreError["category"],
    statusCode: number,
    retryable = false,
  ) {
    super(message);
    this.name = "LocalClientRoutePlanStoreError";
    this.code = code;
    this.category = category;
    this.statusCode = statusCode;
    this.retryable = retryable;
  }
}

type UnsignedLocalClientRoutePlan = Omit<LocalClientRoutePlan, "planId">;

type StoredPlan = {
  readonly plan: LocalClientRoutePlan;
  readonly canonicalBody: string;
  readonly createdAtMs: number;
  readonly expiresAtMs: number;
  consumedAtMs: number | null;
};

const IDENTITY_MAX_LENGTH = 128;
const POLICY_VERSION_MAX_LENGTH = 128;
const ADAPTER_VERSION_MAX_LENGTH = 64;
const IDENTIFIER_PATTERN = /^[a-z][a-z0-9._-]{0,127}$/u;
const SEMVER_PATTERN = /^(?:0|[1-9][0-9]*)\.(?:0|[1-9][0-9]*)\.(?:0|[1-9][0-9]*)$/u;
const SHA256_PATTERN = /^[a-f0-9]{64}$/u;
const MAX_JSON_STRING_LENGTH = 4_096;
const MAX_JSON_KEY_LENGTH = 64;
const MAX_JSON_CONTAINER_ITEMS = 256;
const MAX_JSON_NODES = 2_048;
const MAX_JSON_DEPTH = 16;
const MAX_CAPABILITY_IDS = 128;
const MAX_DATE_MS = 8_640_000_000_000_000;

export class LocalClientRoutePlanStore {
  readonly status: Readonly<{
    storageMode: "single-process-memory";
    available: true;
    durable: false;
    distributed: false;
    previewOnly: true;
    grantsApproval: false;
    providesExternalEffectFence: false;
    oneTimeConsume: true;
    ttlMs: number;
    maxEntries: number;
    maxInputBytes: number;
  }>;

  readonly #ttlMs: number;
  readonly #maxEntries: number;
  readonly #maxInputBytes: number;
  readonly #now: () => number;
  readonly #entries = new Map<string, StoredPlan>();
  #lastObservedNowMs = -1;

  constructor(options: LocalClientRoutePlanStoreOptions = {}) {
    assertOptions(options);
    this.#ttlMs = boundedIntegerOption(
      options.ttlMs,
      LOCAL_CLIENT_ROUTE_PLAN_DEFAULT_TTL_MS,
      1,
      LOCAL_CLIENT_ROUTE_PLAN_MAX_TTL_MS,
    );
    this.#maxEntries = boundedIntegerOption(
      options.maxEntries,
      LOCAL_CLIENT_ROUTE_PLAN_DEFAULT_MAX_ENTRIES,
      1,
      LOCAL_CLIENT_ROUTE_PLAN_HARD_MAX_ENTRIES,
    );
    this.#maxInputBytes = boundedIntegerOption(
      options.maxInputBytes,
      LOCAL_CLIENT_ROUTE_PLAN_DEFAULT_MAX_INPUT_BYTES,
      2,
      LOCAL_CLIENT_ROUTE_PLAN_HARD_MAX_INPUT_BYTES,
    );
    if (options.now !== undefined && typeof options.now !== "function") {
      throw configurationError();
    }
    this.#now = options.now ?? Date.now;
    this.status = Object.freeze({
      ...LOCAL_CLIENT_ROUTE_PLAN_BOUNDARIES,
      ttlMs: this.#ttlMs,
      maxEntries: this.#maxEntries,
      maxInputBytes: this.#maxInputBytes,
    });
  }

  create(request: CreateLocalClientRoutePlanRequest): LocalClientRoutePlan {
    assertExactObjectShape(request, [
      "tenantId",
      "subjectId",
      "target",
      "capabilityId",
      "actionId",
      "input",
      "policyVersion",
    ]);
    const tenantId = assertIdentity(request.tenantId);
    const subjectId = assertIdentity(request.subjectId);
    const target = validateTarget(request.target);
    const capabilityId = assertIdentifier(request.capabilityId);
    const actionId = assertIdentifier(request.actionId);
    if (!target.capabilityIds.includes(capabilityId)) {
      throw routePlanError(
        "LOCAL_CLIENT_ROUTE_PLAN_CAPABILITY_MISMATCH",
        "The verified client does not declare the exact requested capability.",
        "validation",
        409,
      );
    }
    const policyVersion = assertBoundedText(request.policyVersion, POLICY_VERSION_MAX_LENGTH);
    const inputSha256 = hashLocalClientRoutePlanInput(request.input, this.#maxInputBytes);
    const nowMs = this.#readNow();
    const expiresAtMs = nowMs + this.#ttlMs;
    if (!Number.isSafeInteger(expiresAtMs) || expiresAtMs > MAX_DATE_MS) {
      throw clockError();
    }
    this.#purgeExpired(nowMs);

    const unsignedPlan: UnsignedLocalClientRoutePlan = {
      planVersion: LOCAL_CLIENT_ROUTE_PLAN_VERSION,
      tenantId,
      subjectId,
      clientId: target.clientId,
      clientRevision: target.revision,
      clientState: "verified",
      clientTrustDecision: "verified",
      adapterId: target.adapter.id,
      adapterType: target.adapter.type,
      adapterVersion: target.adapter.version,
      capabilityId,
      actionId,
      inputSha256,
      policyVersion,
      createdAt: new Date(nowMs).toISOString(),
      expiresAt: new Date(expiresAtMs).toISOString(),
      boundaries: LOCAL_CLIENT_ROUTE_PLAN_BOUNDARIES,
    };
    const canonicalBody = canonicalJson(unsignedPlan);
    const planId = sha256(canonicalBody);
    const existing = this.#entries.get(planId);
    if (existing) {
      this.#assertIntegrity(existing);
      if (existing.canonicalBody !== canonicalBody) throw integrityError();
      if (existing.consumedAtMs !== null) throw consumedError();
      return existing.plan;
    }
    if (this.#entries.size >= this.#maxEntries) {
      throw routePlanError(
        "LOCAL_CLIENT_ROUTE_PLAN_CAPACITY_REACHED",
        "The bounded single-process route-plan store is full.",
        "capacity",
        503,
        true,
      );
    }
    const plan = freezePlan({ ...unsignedPlan, planId });
    this.#entries.set(planId, {
      plan,
      canonicalBody,
      createdAtMs: nowMs,
      expiresAtMs,
      consumedAtMs: null,
    });
    return plan;
  }

  get(reference: LocalClientRoutePlanReference): LocalClientRoutePlan {
    const nowMs = this.#readNow();
    return this.#resolve(reference, nowMs).plan;
  }

  consume(reference: LocalClientRoutePlanReference): LocalClientRoutePlan {
    const nowMs = this.#readNow();
    const entry = this.#resolve(reference, nowMs);
    entry.consumedAtMs = nowMs;
    return entry.plan;
  }

  verifyInput(
    reference: LocalClientRoutePlanReference,
    input: unknown,
  ): VerifiedLocalClientRoutePlanInput {
    const plan = this.get(reference);
    return verifyLocalClientRoutePlanInput(plan, input, this.#maxInputBytes);
  }

  #resolve(reference: LocalClientRoutePlanReference, nowMs: number): StoredPlan {
    assertExactObjectShape(reference, ["tenantId", "subjectId", "planId"]);
    const tenantId = assertIdentity(reference.tenantId);
    const subjectId = assertIdentity(reference.subjectId);
    const planId = assertPlanId(reference.planId);
    const entry = this.#entries.get(planId);
    if (!entry) throw unavailableError();
    this.#assertIntegrity(entry);
    if (entry.plan.tenantId !== tenantId || entry.plan.subjectId !== subjectId) {
      throw unavailableError();
    }
    if (nowMs >= entry.expiresAtMs) {
      this.#entries.delete(planId);
      throw routePlanError(
        "LOCAL_CLIENT_ROUTE_PLAN_EXPIRED",
        "The route plan has expired and cannot be used.",
        "lifecycle",
        410,
      );
    }
    if (entry.consumedAtMs !== null) throw consumedError();
    return entry;
  }

  #readNow(): number {
    let value: unknown;
    try {
      value = this.#now();
    } catch {
      throw clockError();
    }
    if (
      typeof value !== "number"
      || !Number.isSafeInteger(value)
      || value < 0
      || value > MAX_DATE_MS
      || value < this.#lastObservedNowMs
    ) {
      throw clockError();
    }
    this.#lastObservedNowMs = value;
    return value;
  }

  #purgeExpired(nowMs: number): void {
    for (const [planId, entry] of this.#entries) {
      if (nowMs >= entry.expiresAtMs) this.#entries.delete(planId);
    }
  }

  #assertIntegrity(entry: StoredPlan): void {
    try {
      const unsigned = unsignedPlanFrom(entry.plan);
      const canonicalBody = canonicalJson(unsigned);
      const createdAtMs = Date.parse(entry.plan.createdAt);
      const expiresAtMs = Date.parse(entry.plan.expiresAt);
      if (
        entry.plan.planVersion !== LOCAL_CLIENT_ROUTE_PLAN_VERSION
        || !SHA256_PATTERN.test(entry.plan.planId)
        || canonicalBody !== entry.canonicalBody
        || sha256(canonicalBody) !== entry.plan.planId
        || createdAtMs !== entry.createdAtMs
        || expiresAtMs !== entry.expiresAtMs
        || expiresAtMs - createdAtMs !== this.#ttlMs
        || entry.plan.boundaries !== LOCAL_CLIENT_ROUTE_PLAN_BOUNDARIES
        || !Object.isFrozen(entry.plan)
        || !Object.isFrozen(entry.plan.boundaries)
      ) {
        throw integrityError();
      }
    } catch (error) {
      if (error instanceof LocalClientRoutePlanStoreError) throw error;
      throw integrityError();
    }
  }
}

export function createLocalClientRoutePlanStore(
  options: LocalClientRoutePlanStoreOptions = {},
): LocalClientRoutePlanStore {
  return new LocalClientRoutePlanStore(options);
}

/** Hashes bounded canonical JSON without persisting or returning the raw input. */
export function hashLocalClientRoutePlanInput(
  input: unknown,
  maxInputBytes = LOCAL_CLIENT_ROUTE_PLAN_DEFAULT_MAX_INPUT_BYTES,
): string {
  const boundedMaxInputBytes = boundedIntegerOption(
    maxInputBytes,
    LOCAL_CLIENT_ROUTE_PLAN_DEFAULT_MAX_INPUT_BYTES,
    2,
    LOCAL_CLIENT_ROUTE_PLAN_HARD_MAX_INPUT_BYTES,
  );
  return sha256(canonicalizeLocalClientRoutePlanInput(input, boundedMaxInputBytes));
}

/**
 * Returns bounded canonical JSON for immediate hashing/parsing. Callers must
 * not persist or log the returned string because it contains the raw input.
 */
export function canonicalizeLocalClientRoutePlanInput(
  input: unknown,
  maxInputBytes = LOCAL_CLIENT_ROUTE_PLAN_DEFAULT_MAX_INPUT_BYTES,
): string {
  const boundedMaxInputBytes = boundedIntegerOption(
    maxInputBytes,
    LOCAL_CLIENT_ROUTE_PLAN_DEFAULT_MAX_INPUT_BYTES,
    2,
    LOCAL_CLIENT_ROUTE_PLAN_HARD_MAX_INPUT_BYTES,
  );
  return canonicalizeInput(input, boundedMaxInputBytes);
}

export function verifyLocalClientRoutePlanInput(
  plan: Pick<LocalClientRoutePlan, "inputSha256">,
  input: unknown,
  maxInputBytes = LOCAL_CLIENT_ROUTE_PLAN_DEFAULT_MAX_INPUT_BYTES,
): VerifiedLocalClientRoutePlanInput {
  if (!isPlainRecord(plan) || !SHA256_PATTERN.test(String(plan.inputSha256 ?? ""))) {
    throw integrityError();
  }
  const canonical = canonicalizeLocalClientRoutePlanInput(input, maxInputBytes);
  const actual = sha256(canonical);
  if (!safeDigestEqual(plan.inputSha256, actual)) throw inputError();
  return parseVerifiedAdapterInput(canonical);
}

function validateTarget(target: VerifiedLocalClientRoutePlanTarget): VerifiedLocalClientRoutePlanTarget {
  assertExactObjectShape(target, [
    "descriptorVersion",
    "clientId",
    "revision",
    "state",
    "trustDecision",
    "adapter",
    "capabilityIds",
  ]);
  assertExactObjectShape(target.adapter, ["id", "type", "version"]);
  if (
    target.descriptorVersion !== "verified-local-client-adapter-target-v1"
    || target.state !== "verified"
    || target.trustDecision !== "verified"
  ) {
    throw routePlanError(
      "LOCAL_CLIENT_ROUTE_PLAN_TARGET_UNVERIFIED",
      "Route plans require a currently verified local-client target.",
      "auth",
      403,
    );
  }
  const clientId = assertIdentifier(target.clientId);
  if (!Number.isSafeInteger(target.revision) || target.revision < 1) {
    throw requestError();
  }
  const adapterId = assertIdentifier(target.adapter.id);
  const adapterType = assertIdentifier(target.adapter.type);
  if (
    typeof target.adapter.version !== "string"
    || target.adapter.version.length > ADAPTER_VERSION_MAX_LENGTH
    || !SEMVER_PATTERN.test(target.adapter.version)
  ) {
    throw requestError();
  }
  if (
    !Array.isArray(target.capabilityIds)
    || target.capabilityIds.length < 1
    || target.capabilityIds.length > MAX_CAPABILITY_IDS
  ) {
    throw requestError();
  }
  const capabilityIds = target.capabilityIds.map((value) => assertIdentifier(value));
  if (new Set(capabilityIds).size !== capabilityIds.length) throw requestError();
  return Object.freeze({
    descriptorVersion: "verified-local-client-adapter-target-v1",
    clientId,
    revision: target.revision,
    state: "verified",
    trustDecision: "verified",
    adapter: Object.freeze({ id: adapterId, type: adapterType, version: target.adapter.version }),
    capabilityIds: Object.freeze(capabilityIds),
  });
}

function canonicalizeInput(input: unknown, maxBytes: number): string {
  try {
    if (!isPlainRecord(input)) throw inputError();
    const canonical = serializeJson(input, 0, new Set<object>(), { nodes: 0 });
    if (Buffer.byteLength(canonical, "utf8") > maxBytes) {
      throw routePlanError(
        "LOCAL_CLIENT_ROUTE_PLAN_INPUT_TOO_LARGE",
        "The canonical adapter input exceeds the bounded route-plan hashing limit.",
        "validation",
        413,
      );
    }
    return canonical;
  } catch (error) {
    if (error instanceof LocalClientRoutePlanStoreError) throw error;
    throw inputError();
  }
}

function parseVerifiedAdapterInput(canonical: string): VerifiedLocalClientRoutePlanInput {
  let parsed: unknown;
  try {
    parsed = JSON.parse(canonical);
  } catch {
    throw inputError();
  }
  if (!isPlainRecord(parsed) || Object.hasOwn(parsed, "planFingerprint")) throw inputError();
  const output: Record<string, string | number | boolean> = {};
  for (const [key, value] of Object.entries(parsed)) {
    if (!/^[A-Za-z][A-Za-z0-9_]{0,63}$/u.test(key)) throw inputError();
    if (
      !new Set(["string", "number", "boolean"]).has(typeof value)
      || (typeof value === "number" && !Number.isFinite(value))
      || (typeof value === "string" && value.length > MAX_JSON_STRING_LENGTH)
    ) {
      throw inputError();
    }
    output[key] = value as string | number | boolean;
  }
  return Object.freeze(output);
}

function serializeJson(
  value: unknown,
  depth: number,
  ancestors: Set<object>,
  budget: { nodes: number },
): string {
  budget.nodes += 1;
  if (budget.nodes > MAX_JSON_NODES || depth > MAX_JSON_DEPTH) throw inputError();
  if (value === null) return "null";
  if (typeof value === "boolean") return value ? "true" : "false";
  if (typeof value === "number") {
    if (!Number.isFinite(value)) throw inputError();
    return JSON.stringify(value);
  }
  if (typeof value === "string") {
    if (value.length > MAX_JSON_STRING_LENGTH) throw inputError();
    return JSON.stringify(value);
  }
  if (typeof value !== "object") throw inputError();
  if (ancestors.has(value)) throw inputError();
  ancestors.add(value);
  try {
    if (Array.isArray(value)) {
      if (value.length > MAX_JSON_CONTAINER_ITEMS || Object.getOwnPropertySymbols(value).length > 0) {
        throw inputError();
      }
      const ownKeys = Reflect.ownKeys(value);
      if (ownKeys.length !== value.length + 1 || !ownKeys.includes("length")) throw inputError();
      const output: string[] = [];
      for (let index = 0; index < value.length; index += 1) {
        const descriptor = Object.getOwnPropertyDescriptor(value, String(index));
        if (!descriptor || !("value" in descriptor) || descriptor.enumerable !== true) throw inputError();
        output.push(serializeJson(descriptor.value, depth + 1, ancestors, budget));
      }
      return `[${output.join(",")}]`;
    }
    if (!isPlainRecord(value) || Object.getOwnPropertySymbols(value).length > 0) throw inputError();
    const descriptors = Object.getOwnPropertyDescriptors(value);
    const keys = Object.keys(descriptors).sort();
    if (keys.length > MAX_JSON_CONTAINER_ITEMS) throw inputError();
    const output: string[] = [];
    for (const key of keys) {
      const descriptor = descriptors[key];
      if (
        key.length < 1
        || key.length > MAX_JSON_KEY_LENGTH
        || !("value" in descriptor)
        || descriptor.enumerable !== true
      ) {
        throw inputError();
      }
      output.push(`${JSON.stringify(key)}:${serializeJson(descriptor.value, depth + 1, ancestors, budget)}`);
    }
    return `{${output.join(",")}}`;
  } finally {
    ancestors.delete(value);
  }
}

function canonicalJson(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  const record = value as Record<string, unknown>;
  return `{${Object.keys(record)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${canonicalJson(record[key])}`)
    .join(",")}}`;
}

function freezePlan(plan: LocalClientRoutePlan): LocalClientRoutePlan {
  return Object.freeze({ ...plan, boundaries: LOCAL_CLIENT_ROUTE_PLAN_BOUNDARIES });
}

function unsignedPlanFrom(plan: LocalClientRoutePlan): UnsignedLocalClientRoutePlan {
  return {
    planVersion: plan.planVersion,
    tenantId: plan.tenantId,
    subjectId: plan.subjectId,
    clientId: plan.clientId,
    clientRevision: plan.clientRevision,
    clientState: plan.clientState,
    clientTrustDecision: plan.clientTrustDecision,
    adapterId: plan.adapterId,
    adapterType: plan.adapterType,
    adapterVersion: plan.adapterVersion,
    capabilityId: plan.capabilityId,
    actionId: plan.actionId,
    inputSha256: plan.inputSha256,
    policyVersion: plan.policyVersion,
    createdAt: plan.createdAt,
    expiresAt: plan.expiresAt,
    boundaries: plan.boundaries,
  };
}

function assertOptions(options: LocalClientRoutePlanStoreOptions): void {
  if (!isPlainRecord(options)) throw configurationError();
  const allowed = new Set(["ttlMs", "maxEntries", "maxInputBytes", "now"]);
  if (Object.keys(options).some((key) => !allowed.has(key))) throw configurationError();
}

function boundedIntegerOption(value: number | undefined, fallback: number, min: number, max: number): number {
  const resolved = value ?? fallback;
  if (!Number.isSafeInteger(resolved) || resolved < min || resolved > max) throw configurationError();
  return resolved;
}

function assertExactObjectShape(value: unknown, keys: readonly string[]): asserts value is Record<string, unknown> {
  if (!isPlainRecord(value)) throw requestError();
  const actual = Reflect.ownKeys(value);
  if (
    actual.length !== keys.length
    || actual.some((key) => typeof key !== "string" || !keys.includes(key))
    || keys.some((key) => !Object.hasOwn(value, key))
  ) {
    throw requestError();
  }
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function assertIdentity(value: unknown): string {
  if (
    typeof value !== "string"
    || value.length < 1
    || value.length > IDENTITY_MAX_LENGTH
    || value !== value.trim()
    || /[\u0000-\u001f\u007f]/u.test(value)
  ) {
    throw routePlanError(
      "LOCAL_CLIENT_ROUTE_PLAN_IDENTITY_REQUIRED",
      "A bounded tenant and subject identity is required.",
      "auth",
      401,
    );
  }
  return value;
}

function assertIdentifier(value: unknown): string {
  if (typeof value !== "string" || !IDENTIFIER_PATTERN.test(value)) throw requestError();
  return value;
}

function assertBoundedText(value: unknown, maxLength: number): string {
  if (
    typeof value !== "string"
    || value.length < 1
    || value.length > maxLength
    || value !== value.trim()
    || /[\u0000-\u001f\u007f]/u.test(value)
  ) {
    throw requestError();
  }
  return value;
}

function assertPlanId(value: unknown): string {
  if (typeof value !== "string" || !SHA256_PATTERN.test(value)) throw requestError();
  return value;
}

function sha256(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

function safeDigestEqual(left: string, right: string): boolean {
  if (!SHA256_PATTERN.test(left) || !SHA256_PATTERN.test(right)) return false;
  return timingSafeEqual(Buffer.from(left, "hex"), Buffer.from(right, "hex"));
}

function routePlanError(
  code: LocalClientRoutePlanStoreErrorCode,
  message: string,
  category: LocalClientRoutePlanStoreError["category"],
  statusCode: number,
  retryable = false,
): LocalClientRoutePlanStoreError {
  return new LocalClientRoutePlanStoreError(code, message, category, statusCode, retryable);
}

function configurationError(): LocalClientRoutePlanStoreError {
  return routePlanError(
    "LOCAL_CLIENT_ROUTE_PLAN_CONFIGURATION_INVALID",
    "The bounded route-plan store configuration is invalid.",
    "configuration",
    500,
  );
}

function clockError(): LocalClientRoutePlanStoreError {
  return routePlanError(
    "LOCAL_CLIENT_ROUTE_PLAN_CLOCK_INVALID",
    "The route-plan clock is invalid or moved backwards.",
    "integrity",
    503,
  );
}

function requestError(): LocalClientRoutePlanStoreError {
  return routePlanError(
    "LOCAL_CLIENT_ROUTE_PLAN_REQUEST_INVALID",
    "The route-plan request has an invalid bounded shape.",
    "validation",
    400,
  );
}

function inputError(): LocalClientRoutePlanStoreError {
  return routePlanError(
    "LOCAL_CLIENT_ROUTE_PLAN_INPUT_INVALID",
    "The adapter input must be bounded canonical JSON.",
    "validation",
    400,
  );
}

function unavailableError(): LocalClientRoutePlanStoreError {
  return routePlanError(
    "LOCAL_CLIENT_ROUTE_PLAN_UNAVAILABLE",
    "The route plan is unavailable in this tenant and subject scope.",
    "auth",
    404,
  );
}

function consumedError(): LocalClientRoutePlanStoreError {
  return routePlanError(
    "LOCAL_CLIENT_ROUTE_PLAN_ALREADY_CONSUMED",
    "The one-time route plan has already been consumed.",
    "lifecycle",
    409,
  );
}

function integrityError(): LocalClientRoutePlanStoreError {
  return routePlanError(
    "LOCAL_CLIENT_ROUTE_PLAN_INTEGRITY_INVALID",
    "The route plan failed canonical integrity validation.",
    "integrity",
    409,
  );
}
