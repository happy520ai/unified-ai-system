import { isAbsolute } from "node:path";

import {
  LOCAL_CLIENT_ONBOARDING_CERTIFICATION_STATUS,
  type LocalClientOnboardingRegistryOptions,
} from "./localClientOnboardingRegistry.ts";

export const LOCAL_CLIENT_ONBOARDING_CONFIG_VERSION = 1 as const;
export const LOCAL_CLIENT_ONBOARDING_CONFIG_ENV =
  "AI_GATEWAY_LOCAL_CLIENT_ONBOARDING_CONFIG_JSON" as const;

export interface LocalClientOnboardingConfigurationStatus {
  readonly enabled: boolean;
  readonly configurationVersion: typeof LOCAL_CLIENT_ONBOARDING_CONFIG_VERSION;
  readonly configuredProfileCount: 0 | 3;
  readonly clients: readonly ["claude-compatible", "cursor", "vscode"];
  readonly format: "json-only";
  readonly certificationStatus: typeof LOCAL_CLIENT_ONBOARDING_CERTIFICATION_STATUS;
  readonly requiresExplicitApproval: true;
  readonly requiresDurableIdempotency: true;
  readonly requiresDurableExternalEffectFence: true;
  readonly requiresDurableReceiptAuthority: true;
  readonly automaticDiscoveryOrMutation: false;
  readonly sensitiveConfigurationRedacted: true;
  readonly tenantOwned: true;
  readonly backupProtection: "aes-256-gcm";
}

export type ResolvedLocalClientOnboardingConfiguration =
  | Readonly<{
    enabled: false;
    ownerTenantId: null;
    registryOptions: null;
    status: LocalClientOnboardingConfigurationStatus;
  }>
  | Readonly<{
    enabled: true;
    ownerTenantId: string;
    registryOptions: LocalClientOnboardingRegistryOptions;
    status: LocalClientOnboardingConfigurationStatus;
  }>;

export type LocalClientOnboardingConfigurationErrorCode =
  | "LOCAL_CLIENT_ONBOARDING_ENABLEMENT_INVALID"
  | "LOCAL_CLIENT_ONBOARDING_CONFIG_REQUIRED"
  | "LOCAL_CLIENT_ONBOARDING_CONFIG_INVALID";

export class LocalClientOnboardingConfigurationError extends Error {
  readonly code: LocalClientOnboardingConfigurationErrorCode;
  readonly category = "configuration" as const;
  readonly statusCode = 503 as const;
  readonly retryable = false as const;

  constructor(code: LocalClientOnboardingConfigurationErrorCode, message: string) {
    super(message);
    this.name = "LocalClientOnboardingConfigurationError";
    this.code = code;
  }
}

const CLIENTS = Object.freeze([
  "claude-compatible",
  "cursor",
  "vscode",
] as const);
const MAX_CONFIG_BYTES = 65_536;
const MAX_PATH_BYTES = 4_096;
const MAX_COMMAND_BYTES = 4_096;
const MAX_ARG_BYTES = 8_192;
const MAX_ARGS = 128;
const CREDENTIAL_ARGUMENT_PATTERN = /^(?:--?|\/)(?:api[-_]?key|access[-_]?token|auth(?:orization)?|bearer|credential|password|secret|token)(?:[=:]|$)/iu;
const CREDENTIAL_HEADER_PATTERN = /^(?:authorization|proxy-authorization)\s*[:=]/iu;

export function resolveLocalClientOnboardingConfiguration(
  env: Readonly<Record<string, string | undefined>>,
): ResolvedLocalClientOnboardingConfiguration {
  const enabled = readStrictBoolean(
    env.AI_GATEWAY_LOCAL_CLIENT_ONBOARDING_ENABLED,
    "AI_GATEWAY_LOCAL_CLIENT_ONBOARDING_ENABLED",
  );
  if (!enabled) {
    return Object.freeze({
      enabled: false as const,
      ownerTenantId: null,
      registryOptions: null,
      status: createStatus(false),
    });
  }

  const raw = env[LOCAL_CLIENT_ONBOARDING_CONFIG_ENV];
  if (typeof raw !== "string" || raw.trim() === "") {
    throw new LocalClientOnboardingConfigurationError(
      "LOCAL_CLIENT_ONBOARDING_CONFIG_REQUIRED",
      `${LOCAL_CLIENT_ONBOARDING_CONFIG_ENV} is required when governed onboarding is enabled.`,
    );
  }
  if (Buffer.byteLength(raw, "utf8") > MAX_CONFIG_BYTES) throw invalidConfig();

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw invalidConfig();
  }
  const root = exactRecord(parsed, ["version", "ownerTenantId", "profiles", "serverDefinition"]);
  if (root.version !== LOCAL_CLIENT_ONBOARDING_CONFIG_VERSION) throw invalidConfig();
  const ownerTenantId = normalizeOwnerTenantId(root.ownerTenantId);
  const profiles = exactRecord(root.profiles, ["claudeCompatible", "cursor", "vscode"]);
  const serverDefinition = normalizeServerDefinition(root.serverDefinition);
  const registryOptions: LocalClientOnboardingRegistryOptions = Object.freeze({
    profiles: Object.freeze({
      claudeCompatible: normalizeProfile(profiles.claudeCompatible),
      cursor: normalizeProfile(profiles.cursor),
      vscode: normalizeProfile(profiles.vscode),
    }),
    serverDefinition,
  });

  return Object.freeze({
    enabled: true as const,
    ownerTenantId,
    registryOptions,
    status: createStatus(true),
  });
}

function normalizeProfile(value: unknown) {
  const raw = exactRecord(
    value,
    ["targetPath", "allowedRoot", "backupDir", "journalPath", "maxBytes", "maxTransactions"],
    new Set(["maxBytes", "maxTransactions"]),
  );
  const profile = {
    targetPath: normalizeLocalAbsolutePath(raw.targetPath),
    allowedRoot: normalizeLocalAbsolutePath(raw.allowedRoot),
    backupDir: normalizeLocalAbsolutePath(raw.backupDir),
    journalPath: normalizeLocalAbsolutePath(raw.journalPath),
    ...(raw.maxBytes === undefined ? {} : { maxBytes: normalizeInteger(raw.maxBytes, 256, 16 * 1_048_576) }),
    ...(raw.maxTransactions === undefined ? {} : { maxTransactions: normalizeInteger(raw.maxTransactions, 1, 10_000) }),
  };
  return Object.freeze(profile);
}

function normalizeServerDefinition(value: unknown) {
  const raw = exactRecord(value, ["transport", "command", "args", "cwd"], new Set(["cwd"]));
  if (raw.transport !== "stdio") throw invalidConfig();
  const command = normalizeLocalAbsolutePath(raw.command, MAX_COMMAND_BYTES);
  if (!Array.isArray(raw.args) || raw.args.length > MAX_ARGS) throw invalidConfig();
  const args = raw.args.map((argument) => normalizeArgument(argument));
  return Object.freeze({
    transport: "stdio" as const,
    command,
    args: Object.freeze(args),
    ...(raw.cwd === undefined ? {} : { cwd: normalizeLocalAbsolutePath(raw.cwd) }),
  });
}

function normalizeOwnerTenantId(value: unknown): string {
  if (
    typeof value !== "string"
    || !/^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/u.test(value)
  ) {
    throw invalidConfig();
  }
  return value;
}

function normalizeLocalAbsolutePath(value: unknown, maxBytes = MAX_PATH_BYTES): string {
  if (
    typeof value !== "string"
    || value.length === 0
    || value !== value.trim()
    || Buffer.byteLength(value, "utf8") > maxBytes
    || /[\u0000-\u001f\u007f]/u.test(value)
    || !isAbsolute(value)
    || value.startsWith("\\\\")
    || value.startsWith("//")
  ) {
    throw invalidConfig();
  }
  return value;
}

function normalizeArgument(value: unknown): string {
  if (
    typeof value !== "string"
    || Buffer.byteLength(value, "utf8") > MAX_ARG_BYTES
    || /[\u0000\r\n\u007f]/u.test(value)
  ) {
    throw invalidConfig();
  }
  if (
    CREDENTIAL_ARGUMENT_PATTERN.test(value.trim())
    || CREDENTIAL_HEADER_PATTERN.test(value.trim())
  ) {
    throw invalidConfig();
  }
  return value;
}

function normalizeInteger(value: unknown, minimum: number, maximum: number): number {
  if (!Number.isSafeInteger(value) || Number(value) < minimum || Number(value) > maximum) {
    throw invalidConfig();
  }
  return Number(value);
}

function exactRecord(
  value: unknown,
  allowedKeys: readonly string[],
  optionalKeys: ReadonlySet<string> = new Set(),
): Record<string, unknown> {
  if (!isPlainRecord(value)) throw invalidConfig();
  const keys = Reflect.ownKeys(value);
  if (
    keys.some((key) => typeof key !== "string" || !allowedKeys.includes(key))
    || allowedKeys.some((key) => !optionalKeys.has(key) && !Object.hasOwn(value, key))
  ) {
    throw invalidConfig();
  }
  return value;
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function readStrictBoolean(value: unknown, name: string): boolean {
  if (value === undefined || value === null || String(value).trim() === "") return false;
  const normalized = String(value).trim().toLowerCase();
  if (normalized === "true" || normalized === "1") return true;
  if (normalized === "false" || normalized === "0") return false;
  throw new LocalClientOnboardingConfigurationError(
    "LOCAL_CLIENT_ONBOARDING_ENABLEMENT_INVALID",
    `${name} must be true or false when configured.`,
  );
}

function createStatus(enabled: boolean): LocalClientOnboardingConfigurationStatus {
  return Object.freeze({
    enabled,
    configurationVersion: LOCAL_CLIENT_ONBOARDING_CONFIG_VERSION,
    configuredProfileCount: enabled ? 3 as const : 0 as const,
    clients: CLIENTS,
    format: "json-only" as const,
    certificationStatus: LOCAL_CLIENT_ONBOARDING_CERTIFICATION_STATUS,
    requiresExplicitApproval: true as const,
    requiresDurableIdempotency: true as const,
    requiresDurableExternalEffectFence: true as const,
    requiresDurableReceiptAuthority: true as const,
    automaticDiscoveryOrMutation: false as const,
    sensitiveConfigurationRedacted: true as const,
    tenantOwned: true as const,
    backupProtection: "aes-256-gcm" as const,
  });
}

function invalidConfig(): LocalClientOnboardingConfigurationError {
  return new LocalClientOnboardingConfigurationError(
    "LOCAL_CLIENT_ONBOARDING_CONFIG_INVALID",
    "The governed local-client onboarding configuration is invalid.",
  );
}
