import { createHash } from "node:crypto";

import {
  evaluateLocalClientProviderPolicy,
  type LocalClientProviderPolicy,
} from "./localClientProviderPolicy.ts";
import type {
  LocalClientProviderRuntimeIdentity,
  ResolvedLocalClientProviderPolicy,
} from "./localClientProviderRuntimeRouter.ts";

type RuntimeEnv = Record<string, string | undefined>;
type UnknownRecord = Record<string, unknown>;

export const LOCAL_CLIENT_PROVIDER_POLICY_CONFIG_VERSION = 1 as const;

export interface LocalClientProviderPolicyOverride {
  readonly tenantId: string;
  readonly clientId: string;
  readonly policy: LocalClientProviderPolicy;
}

export interface LocalClientProviderPolicyConfiguration {
  readonly version: typeof LOCAL_CLIENT_PROVIDER_POLICY_CONFIG_VERSION;
  readonly defaultPolicy: LocalClientProviderPolicy;
  readonly overrides: readonly LocalClientProviderPolicyOverride[];
}

export interface LocalClientProviderPolicyResolverInput {
  readonly identity: LocalClientProviderRuntimeIdentity;
  readonly clientId: string;
}

export class LocalClientProviderPolicyConfigError extends Error {
  readonly code = "LOCAL_CLIENT_PROVIDER_POLICY_CONFIG_INVALID" as const;
  readonly category = "configuration" as const;
  readonly statusCode = 503;
  readonly retryable = false;

  constructor(message = "The local-client provider policy configuration is invalid.") {
    super(message);
    this.name = "LocalClientProviderPolicyConfigError";
  }
}

const ENV_NAME = "AI_GATEWAY_LOCAL_CLIENT_PROVIDER_POLICIES_JSON";
const MAX_CONFIG_BYTES = 256 * 1_024;
const MAX_OVERRIDES = 1_024;
const CLIENT_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/u;
const DEFAULT_POLICY: LocalClientProviderPolicy = deepFreezePolicy({
  dataClass: "internal",
  maxFanout: 1,
  fusionAllowed: false,
});

export function createConfiguredLocalClientProviderPolicyResolver(env: RuntimeEnv = {}) {
  const configuration = parseConfiguration(env[ENV_NAME]);
  const defaultResolution = resolvePolicy(configuration.defaultPolicy);
  const overrides = new Map<string, ResolvedLocalClientProviderPolicy>();
  for (const entry of configuration.overrides) {
    overrides.set(policyKey(entry.tenantId, entry.clientId), resolvePolicy(entry.policy));
  }

  return Object.freeze({
    status: Object.freeze({
      version: configuration.version,
      source: env[ENV_NAME] === undefined || String(env[ENV_NAME]).trim() === ""
        ? "secure-default"
        : "environment",
      overrideCount: overrides.size,
      requestBodyPolicyAccepted: false as const,
      defaultPolicyRevision: defaultResolution.policyRevision,
    }),

    resolve(raw: LocalClientProviderPolicyResolverInput): ResolvedLocalClientProviderPolicy {
      const input = normalizeResolverInput(raw);
      return overrides.get(policyKey(input.identity.tenantId, input.clientId)) ?? defaultResolution;
    },
  });
}

function parseConfiguration(rawValue: unknown): LocalClientProviderPolicyConfiguration {
  if (rawValue === undefined || rawValue === null || String(rawValue).trim() === "") {
    return Object.freeze({
      version: LOCAL_CLIENT_PROVIDER_POLICY_CONFIG_VERSION,
      defaultPolicy: DEFAULT_POLICY,
      overrides: Object.freeze([]),
    });
  }
  if (typeof rawValue !== "string" || Buffer.byteLength(rawValue, "utf8") > MAX_CONFIG_BYTES) {
    throw configError();
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(rawValue);
  } catch {
    throw configError();
  }
  if (
    !isPlainRecord(parsed)
    || !hasExactKeys(parsed, ["version", "defaultPolicy", "overrides"])
    || parsed.version !== LOCAL_CLIENT_PROVIDER_POLICY_CONFIG_VERSION
    || !Array.isArray(parsed.overrides)
    || parsed.overrides.length > MAX_OVERRIDES
  ) throw configError();

  const defaultPolicy = validateAndFreezePolicy(parsed.defaultPolicy);
  const seen = new Set<string>();
  const overrides = parsed.overrides.map((raw) => {
    if (!isPlainRecord(raw) || !hasExactKeys(raw, ["tenantId", "clientId", "policy"])) {
      throw configError();
    }
    const tenantId = normalizeIdentity(raw.tenantId);
    const clientId = normalizeClientId(raw.clientId);
    if (!tenantId || !clientId) throw configError();
    const key = policyKey(tenantId, clientId);
    if (seen.has(key)) throw configError();
    seen.add(key);
    return Object.freeze({
      tenantId,
      clientId,
      policy: validateAndFreezePolicy(raw.policy),
    });
  });
  return Object.freeze({
    version: LOCAL_CLIENT_PROVIDER_POLICY_CONFIG_VERSION,
    defaultPolicy,
    overrides: Object.freeze(overrides),
  });
}

function validateAndFreezePolicy(raw: unknown): LocalClientProviderPolicy {
  if (!isPlainRecord(raw)) throw configError();
  let decision;
  try {
    decision = evaluateLocalClientProviderPolicy({
      policy: raw as unknown as LocalClientProviderPolicy,
      candidates: [],
    });
  } catch {
    throw configError();
  }
  if (decision.policyVersion !== "local-client-provider-policy-v1") throw configError();
  return deepFreezePolicy(raw as unknown as LocalClientProviderPolicy);
}

function deepFreezePolicy(policy: LocalClientProviderPolicy): LocalClientProviderPolicy {
  const copy: LocalClientProviderPolicy = {
    ...policy,
    ...(policy.allowedProviders === undefined
      ? {}
      : { allowedProviders: Object.freeze([...policy.allowedProviders]) }),
    ...(policy.deniedProviders === undefined
      ? {}
      : { deniedProviders: Object.freeze([...policy.deniedProviders]) }),
    ...(policy.allowedRegions === undefined
      ? {}
      : { allowedRegions: Object.freeze([...policy.allowedRegions]) }),
  };
  return Object.freeze(copy);
}

function resolvePolicy(policy: LocalClientProviderPolicy): ResolvedLocalClientProviderPolicy {
  return Object.freeze({
    policyRevision: createHash("sha256")
      .update("local-client-provider-policy-config-v1\0")
      .update(canonicalize(policy))
      .digest("hex"),
    policy,
  });
}

function canonicalize(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalize).join(",")}]`;
  const record = value as UnknownRecord;
  return `{${Object.keys(record).sort().map((key) => `${JSON.stringify(key)}:${canonicalize(record[key])}`).join(",")}}`;
}

function normalizeResolverInput(raw: LocalClientProviderPolicyResolverInput) {
  if (
    !isPlainRecord(raw)
    || !hasExactKeys(raw, ["identity", "clientId"])
    || !isPlainRecord(raw.identity)
    || !hasExactKeys(raw.identity, ["tenantId", "subjectId"])
  ) throw configError();
  const tenantId = normalizeIdentity(raw.identity.tenantId);
  const subjectId = normalizeIdentity(raw.identity.subjectId);
  const clientId = normalizeClientId(raw.clientId);
  if (!tenantId || !subjectId || !clientId) throw configError();
  return Object.freeze({
    identity: Object.freeze({ tenantId, subjectId }),
    clientId,
  });
}

function normalizeIdentity(value: unknown): string {
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

function policyKey(tenantId: string, clientId: string): string {
  return `${tenantId}\0${clientId}`;
}

function isPlainRecord(value: unknown): value is UnknownRecord {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function hasExactKeys(value: object, allowedKeys: readonly string[]): boolean {
  const allowed = new Set(allowedKeys);
  const ownKeys = Reflect.ownKeys(value);
  return ownKeys.length === allowed.size
    && ownKeys.every((key) => typeof key === "string" && allowed.has(key));
}

function configError(): LocalClientProviderPolicyConfigError {
  return new LocalClientProviderPolicyConfigError();
}
