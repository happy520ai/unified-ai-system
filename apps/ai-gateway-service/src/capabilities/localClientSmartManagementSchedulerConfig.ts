import type {
  LocalClientSmartManagementSchedulerOptions,
  LocalClientSmartManagementTenant,
} from "./localClientSmartManagementScheduler.ts";

export const LOCAL_CLIENT_SMART_MANAGEMENT_SCHEDULER_CONFIG_VERSION = 1 as const;
export const LOCAL_CLIENT_SMART_MANAGEMENT_SCHEDULER_ENV_PREFIX =
  "AI_GATEWAY_LOCAL_CLIENT_SMART_MANAGE_SCHEDULER_" as const;

export const LOCAL_CLIENT_SMART_MANAGEMENT_SCHEDULER_ENV = Object.freeze({
  enabled: `${LOCAL_CLIENT_SMART_MANAGEMENT_SCHEDULER_ENV_PREFIX}ENABLED`,
  tenantsJson: `${LOCAL_CLIENT_SMART_MANAGEMENT_SCHEDULER_ENV_PREFIX}TENANTS_JSON`,
  intervalMs: `${LOCAL_CLIENT_SMART_MANAGEMENT_SCHEDULER_ENV_PREFIX}INTERVAL_MS`,
  initialDelayMs: `${LOCAL_CLIENT_SMART_MANAGEMENT_SCHEDULER_ENV_PREFIX}INITIAL_DELAY_MS`,
  backoffBaseMs: `${LOCAL_CLIENT_SMART_MANAGEMENT_SCHEDULER_ENV_PREFIX}BACKOFF_BASE_MS`,
  backoffMaxMs: `${LOCAL_CLIENT_SMART_MANAGEMENT_SCHEDULER_ENV_PREFIX}BACKOFF_MAX_MS`,
  roundDeadlineMs: `${LOCAL_CLIENT_SMART_MANAGEMENT_SCHEDULER_ENV_PREFIX}ROUND_DEADLINE_MS`,
  maxConcurrency: `${LOCAL_CLIENT_SMART_MANAGEMENT_SCHEDULER_ENV_PREFIX}MAX_CONCURRENCY`,
  maxTenants: `${LOCAL_CLIENT_SMART_MANAGEMENT_SCHEDULER_ENV_PREFIX}MAX_TENANTS`,
  jitterRatio: `${LOCAL_CLIENT_SMART_MANAGEMENT_SCHEDULER_ENV_PREFIX}JITTER_RATIO`,
} as const);

export const LOCAL_CLIENT_SMART_MANAGEMENT_SCHEDULER_CONFIG_DEFAULTS = Object.freeze({
  intervalMs: 5 * 60_000,
  initialDelayMs: 0,
  failureBackoffBaseMs: 30_000,
  failureBackoffMaxMs: 30 * 60_000,
  roundDeadlineMs: 2 * 60_000,
  maxConcurrency: 4,
  maxTenants: 256,
  jitterRatio: 0.1,
} as const);

export const LOCAL_CLIENT_SMART_MANAGEMENT_SCHEDULER_CONFIG_BOUNDARIES = Object.freeze({
  defaultEnabled: false as const,
  executionMode: "dry-run" as const,
  applyConfigurationExposed: false as const,
  automaticApply: false as const,
  tenantConfigVersion: LOCAL_CLIENT_SMART_MANAGEMENT_SCHEDULER_CONFIG_VERSION,
  tenantCountMinimumWhenEnabled: 1 as const,
  tenantCountMaximum: 256 as const,
  maxTenantsMaximum: 256 as const,
  maxTenantsMinimum: 1 as const,
  maxConcurrencyMaximum: 32 as const,
  maxJsonBytes: 131_072 as const,
  unknownSchedulerEnvironmentRejected: true as const,
  tenantIdentitiesRedactedFromStatus: true as const,
});

type SchedulerWiringOptions = Readonly<Required<Pick<
  LocalClientSmartManagementSchedulerOptions,
  | "enableApply"
  | "intervalMs"
  | "initialDelayMs"
  | "failureBackoffBaseMs"
  | "failureBackoffMaxMs"
  | "roundDeadlineMs"
  | "maxConcurrency"
  | "maxTenants"
  | "jitterRatio"
>>> & Readonly<{ enableApply: false }>;

export interface LocalClientSmartManagementSchedulerConfigStatus {
  readonly enabled: boolean;
  readonly configurationVersion: typeof LOCAL_CLIENT_SMART_MANAGEMENT_SCHEDULER_CONFIG_VERSION;
  readonly executionMode: "dry-run";
  readonly applyEnabled: false;
  readonly applyConfigurable: false;
  readonly configuredTenantCount: number;
  readonly configuredTenantLimit: number;
  readonly tenantIdentitiesRedacted: true;
  readonly boundaries: typeof LOCAL_CLIENT_SMART_MANAGEMENT_SCHEDULER_CONFIG_BOUNDARIES;
}

export type ResolvedLocalClientSmartManagementSchedulerConfig =
  | Readonly<{
    enabled: false;
    tenants: readonly [];
    schedulerOptions: null;
    status: LocalClientSmartManagementSchedulerConfigStatus;
  }>
  | Readonly<{
    enabled: true;
    tenants: readonly LocalClientSmartManagementTenant[];
    schedulerOptions: SchedulerWiringOptions;
    status: LocalClientSmartManagementSchedulerConfigStatus;
  }>;

export type LocalClientSmartManagementSchedulerConfigErrorCode =
  | "LOCAL_CLIENT_SMART_MANAGEMENT_SCHEDULER_ENABLEMENT_INVALID"
  | "LOCAL_CLIENT_SMART_MANAGEMENT_SCHEDULER_ENV_UNKNOWN"
  | "LOCAL_CLIENT_SMART_MANAGEMENT_SCHEDULER_TENANTS_REQUIRED"
  | "LOCAL_CLIENT_SMART_MANAGEMENT_SCHEDULER_TENANTS_INVALID"
  | "LOCAL_CLIENT_SMART_MANAGEMENT_SCHEDULER_VALUE_INVALID";

export class LocalClientSmartManagementSchedulerConfigError extends Error {
  readonly code: LocalClientSmartManagementSchedulerConfigErrorCode;
  readonly category = "configuration" as const;
  readonly statusCode = 503 as const;
  readonly retryable = false as const;

  constructor(code: LocalClientSmartManagementSchedulerConfigErrorCode, message: string) {
    super(message);
    this.name = "LocalClientSmartManagementSchedulerConfigError";
    this.code = code;
  }
}

const KNOWN_ENV_NAMES: ReadonlySet<string> = new Set(
  Object.values(LOCAL_CLIENT_SMART_MANAGEMENT_SCHEDULER_ENV),
);
const MAX_JSON_BYTES = LOCAL_CLIENT_SMART_MANAGEMENT_SCHEDULER_CONFIG_BOUNDARIES.maxJsonBytes;
const MAX_SCALAR_BYTES = 64;
const MIN_SCHEDULE_DELAY_MS = 1_000;
const MAX_SCHEDULE_DELAY_MS = 24 * 60 * 60_000;
const TENANT_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:@-]{0,127}$/u;
const SUBJECT_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:@-]{0,255}$/u;
const STRICT_UNSIGNED_INTEGER_PATTERN = /^(?:0|[1-9][0-9]{0,9})$/u;
const STRICT_RATIO_PATTERN = /^(?:0|0\.[0-9]{1,6})$/u;

export function resolveLocalClientSmartManagementSchedulerConfig(
  env: Readonly<Record<string, string | undefined>>,
): ResolvedLocalClientSmartManagementSchedulerConfig {
  assertEnvironment(env);
  rejectUnknownSchedulerEnvironment(env);
  const enabled = readStrictBoolean(env[LOCAL_CLIENT_SMART_MANAGEMENT_SCHEDULER_ENV.enabled]);
  if (!enabled) {
    return Object.freeze({
      enabled: false as const,
      tenants: Object.freeze([]) as readonly [],
      schedulerOptions: null,
      status: createStatus(false, 0, 0),
    });
  }

  const tenants = parseTenantConfiguration(
    env[LOCAL_CLIENT_SMART_MANAGEMENT_SCHEDULER_ENV.tenantsJson],
  );
  const intervalMs = readInteger(
    env[LOCAL_CLIENT_SMART_MANAGEMENT_SCHEDULER_ENV.intervalMs],
    LOCAL_CLIENT_SMART_MANAGEMENT_SCHEDULER_CONFIG_DEFAULTS.intervalMs,
    MIN_SCHEDULE_DELAY_MS,
    MAX_SCHEDULE_DELAY_MS,
  );
  const initialDelayMs = readInteger(
    env[LOCAL_CLIENT_SMART_MANAGEMENT_SCHEDULER_ENV.initialDelayMs],
    LOCAL_CLIENT_SMART_MANAGEMENT_SCHEDULER_CONFIG_DEFAULTS.initialDelayMs,
    0,
    MAX_SCHEDULE_DELAY_MS,
  );
  const failureBackoffBaseMs = readInteger(
    env[LOCAL_CLIENT_SMART_MANAGEMENT_SCHEDULER_ENV.backoffBaseMs],
    LOCAL_CLIENT_SMART_MANAGEMENT_SCHEDULER_CONFIG_DEFAULTS.failureBackoffBaseMs,
    MIN_SCHEDULE_DELAY_MS,
    MAX_SCHEDULE_DELAY_MS,
  );
  const failureBackoffMaxMs = readInteger(
    env[LOCAL_CLIENT_SMART_MANAGEMENT_SCHEDULER_ENV.backoffMaxMs],
    LOCAL_CLIENT_SMART_MANAGEMENT_SCHEDULER_CONFIG_DEFAULTS.failureBackoffMaxMs,
    failureBackoffBaseMs,
    MAX_SCHEDULE_DELAY_MS,
  );
  const roundDeadlineMs = readInteger(
    env[LOCAL_CLIENT_SMART_MANAGEMENT_SCHEDULER_ENV.roundDeadlineMs],
    LOCAL_CLIENT_SMART_MANAGEMENT_SCHEDULER_CONFIG_DEFAULTS.roundDeadlineMs,
    MIN_SCHEDULE_DELAY_MS,
    MAX_SCHEDULE_DELAY_MS,
  );
  const maxConcurrency = readInteger(
    env[LOCAL_CLIENT_SMART_MANAGEMENT_SCHEDULER_ENV.maxConcurrency],
    LOCAL_CLIENT_SMART_MANAGEMENT_SCHEDULER_CONFIG_DEFAULTS.maxConcurrency,
    1,
    LOCAL_CLIENT_SMART_MANAGEMENT_SCHEDULER_CONFIG_BOUNDARIES.maxConcurrencyMaximum,
  );
  const maxTenants = readInteger(
    env[LOCAL_CLIENT_SMART_MANAGEMENT_SCHEDULER_ENV.maxTenants],
    LOCAL_CLIENT_SMART_MANAGEMENT_SCHEDULER_CONFIG_DEFAULTS.maxTenants,
    LOCAL_CLIENT_SMART_MANAGEMENT_SCHEDULER_CONFIG_BOUNDARIES.maxTenantsMinimum,
    LOCAL_CLIENT_SMART_MANAGEMENT_SCHEDULER_CONFIG_BOUNDARIES.maxTenantsMaximum,
  );
  if (tenants.length > maxTenants) throw invalidValue();
  const jitterRatio = readRatio(
    env[LOCAL_CLIENT_SMART_MANAGEMENT_SCHEDULER_ENV.jitterRatio],
    LOCAL_CLIENT_SMART_MANAGEMENT_SCHEDULER_CONFIG_DEFAULTS.jitterRatio,
  );
  const schedulerOptions = Object.freeze({
    enableApply: false as const,
    intervalMs,
    initialDelayMs,
    failureBackoffBaseMs,
    failureBackoffMaxMs,
    roundDeadlineMs,
    maxConcurrency,
    maxTenants,
    jitterRatio,
  });
  return Object.freeze({
    enabled: true as const,
    tenants,
    schedulerOptions,
    status: createStatus(true, tenants.length, maxTenants),
  });
}

function parseTenantConfiguration(value: unknown): readonly LocalClientSmartManagementTenant[] {
  if (typeof value !== "string" || value.length === 0 || value !== value.trim()) {
    throw tenantsRequired();
  }
  if (Buffer.byteLength(value, "utf8") > MAX_JSON_BYTES) throw invalidTenants();
  let parsed: unknown;
  try { parsed = JSON.parse(value); } catch { throw invalidTenants(); }
  const root = exactRecord(parsed, ["version", "tenants"]);
  if (root.version !== LOCAL_CLIENT_SMART_MANAGEMENT_SCHEDULER_CONFIG_VERSION) {
    throw invalidTenants();
  }
  if (
    !Array.isArray(root.tenants)
    || root.tenants.length < LOCAL_CLIENT_SMART_MANAGEMENT_SCHEDULER_CONFIG_BOUNDARIES
      .tenantCountMinimumWhenEnabled
    || root.tenants.length > LOCAL_CLIENT_SMART_MANAGEMENT_SCHEDULER_CONFIG_BOUNDARIES
      .tenantCountMaximum
  ) throw invalidTenants();
  const seenTenantIds = new Set<string>();
  const tenants = root.tenants.map((entry) => {
    const record = exactRecord(entry, ["tenantId", "subjectId"]);
    const tenantId = normalizeIdentity(record.tenantId, TENANT_ID_PATTERN);
    const subjectId = normalizeIdentity(record.subjectId, SUBJECT_ID_PATTERN);
    if (seenTenantIds.has(tenantId)) throw invalidTenants();
    seenTenantIds.add(tenantId);
    return Object.freeze({ tenantId, subjectId });
  });
  return Object.freeze(tenants);
}

function normalizeIdentity(value: unknown, pattern: RegExp): string {
  if (typeof value !== "string" || !pattern.test(value)) throw invalidTenants();
  return value;
}

function readStrictBoolean(value: unknown): boolean {
  if (value === undefined || value === null || value === "") return false;
  if (typeof value !== "string" || value !== value.trim() || value.length > MAX_SCALAR_BYTES) {
    throw enablementInvalid();
  }
  const normalized = value.toLowerCase();
  if (normalized === "true" || normalized === "1") return true;
  if (normalized === "false" || normalized === "0") return false;
  throw enablementInvalid();
}

function readInteger(
  value: unknown,
  fallback: number,
  minimum: number,
  maximum: number,
): number {
  if (value === undefined || value === null || value === "") return fallback;
  if (
    typeof value !== "string"
    || value.length > MAX_SCALAR_BYTES
    || !STRICT_UNSIGNED_INTEGER_PATTERN.test(value)
  ) throw invalidValue();
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < minimum || parsed > maximum) {
    throw invalidValue();
  }
  return parsed;
}

function readRatio(value: unknown, fallback: number): number {
  if (value === undefined || value === null || value === "") return fallback;
  if (
    typeof value !== "string"
    || value.length > MAX_SCALAR_BYTES
    || !STRICT_RATIO_PATTERN.test(value)
  ) throw invalidValue();
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0 || parsed > 0.5) throw invalidValue();
  return parsed;
}

function rejectUnknownSchedulerEnvironment(
  env: Readonly<Record<string, string | undefined>>,
): void {
  // Inspect names first so unrelated environment values (including provider
  // credentials) are never read by this parser.
  for (const name of Object.keys(env)) {
    if (
      name.startsWith(LOCAL_CLIENT_SMART_MANAGEMENT_SCHEDULER_ENV_PREFIX)
      && !KNOWN_ENV_NAMES.has(name)
    ) {
      const value = env[name];
      if (typeof value !== "string" || value === "") continue;
      throw new LocalClientSmartManagementSchedulerConfigError(
        "LOCAL_CLIENT_SMART_MANAGEMENT_SCHEDULER_ENV_UNKNOWN",
        "An unsupported local-client smart-management scheduler environment variable is configured.",
      );
    }
  }
}

function createStatus(
  enabled: boolean,
  configuredTenantCount: number,
  configuredTenantLimit: number,
): LocalClientSmartManagementSchedulerConfigStatus {
  return Object.freeze({
    enabled,
    configurationVersion: LOCAL_CLIENT_SMART_MANAGEMENT_SCHEDULER_CONFIG_VERSION,
    executionMode: "dry-run" as const,
    applyEnabled: false as const,
    applyConfigurable: false as const,
    configuredTenantCount,
    configuredTenantLimit,
    tenantIdentitiesRedacted: true as const,
    boundaries: LOCAL_CLIENT_SMART_MANAGEMENT_SCHEDULER_CONFIG_BOUNDARIES,
  });
}

function exactRecord(value: unknown, expectedKeys: readonly string[]): Record<string, unknown> {
  if (!isPlainRecord(value)) throw invalidTenants();
  const keys = Reflect.ownKeys(value);
  if (
    keys.length !== expectedKeys.length
    || keys.some((key) => typeof key !== "string" || !expectedKeys.includes(key))
    || expectedKeys.some((key) => !Object.hasOwn(value, key))
  ) throw invalidTenants();
  return value;
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function assertEnvironment(value: unknown): asserts value is Readonly<Record<string, string | undefined>> {
  if (value === null || typeof value !== "object" || Array.isArray(value)) throw invalidValue();
}

function enablementInvalid(): LocalClientSmartManagementSchedulerConfigError {
  return new LocalClientSmartManagementSchedulerConfigError(
    "LOCAL_CLIENT_SMART_MANAGEMENT_SCHEDULER_ENABLEMENT_INVALID",
    "The local-client smart-management scheduler enablement value is invalid.",
  );
}

function tenantsRequired(): LocalClientSmartManagementSchedulerConfigError {
  return new LocalClientSmartManagementSchedulerConfigError(
    "LOCAL_CLIENT_SMART_MANAGEMENT_SCHEDULER_TENANTS_REQUIRED",
    "A versioned tenant configuration is required when the scheduler is enabled.",
  );
}

function invalidTenants(): LocalClientSmartManagementSchedulerConfigError {
  return new LocalClientSmartManagementSchedulerConfigError(
    "LOCAL_CLIENT_SMART_MANAGEMENT_SCHEDULER_TENANTS_INVALID",
    "The local-client smart-management scheduler tenant configuration is invalid.",
  );
}

function invalidValue(): LocalClientSmartManagementSchedulerConfigError {
  return new LocalClientSmartManagementSchedulerConfigError(
    "LOCAL_CLIENT_SMART_MANAGEMENT_SCHEDULER_VALUE_INVALID",
    "A local-client smart-management scheduler value is invalid.",
  );
}
