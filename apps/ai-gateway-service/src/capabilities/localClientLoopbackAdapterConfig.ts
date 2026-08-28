import { LOCAL_CLIENT_LOOPBACK_ADAPTER_ID } from "./localClientLoopbackAdapter.ts";

export interface LocalClientLoopbackAdapterConfigEntry {
  readonly adapterId: string;
  readonly tenantId: string;
  readonly clientId: string;
  readonly endpoint: string;
  readonly manifestSha256: string;
  readonly secretRef: string;
  readonly timeoutMs: number;
  readonly challengeTtlMs: number;
  readonly verificationTtlMs: number;
  readonly maxResponseBytes: number;
}

export interface LocalClientLoopbackAdapterConfiguration {
  readonly enabled: boolean;
  readonly source: "disabled" | "legacy-single" | "versioned-json";
  readonly entries: readonly LocalClientLoopbackAdapterConfigEntry[];
  readonly registryIntegritySecretRef: string | null;
  readonly status: Readonly<{
    enabled: boolean;
    source: "disabled" | "legacy-single" | "versioned-json";
    adapterCount: number;
    tenantCount: number;
    clientCount: number;
    secretReferencesExposed: false;
    gatewayAuthoritySecretRequired: true;
    gatewayClientSecretReuseForbidden: true;
  }>;
}

export class LocalClientLoopbackAdapterConfigError extends Error {
  readonly code = "LOCAL_CLIENT_LOOPBACK_ADAPTER_CONFIG_INVALID" as const;
  readonly category = "configuration" as const;
  readonly statusCode = 503;
  readonly retryable = false;

  constructor() {
    super("Local-client loopback adapter configuration is invalid.");
    this.name = "LocalClientLoopbackAdapterConfigError";
  }
}

type RuntimeEnv = Record<string, string | undefined>;
type UnknownRecord = Record<string, unknown>;

const MAX_CONFIG_BYTES = 256 * 1024;
const MAX_ADAPTERS = 64;
const IDENTIFIER_PATTERN = /^[a-z][a-z0-9._-]{0,127}$/u;
const SHA256_PATTERN = /^[a-f0-9]{64}$/u;
const ENTRY_KEYS = Object.freeze([
  "adapterId",
  "tenantId",
  "clientId",
  "endpoint",
  "manifestSha256",
  "secretRef",
  "timeoutMs",
  "challengeTtlMs",
  "verificationTtlMs",
  "maxResponseBytes",
]);
const LEGACY_FIELDS = Object.freeze([
  "AI_GATEWAY_LOCAL_CLIENT_LOOPBACK_ADAPTER_ID",
  "AI_GATEWAY_LOCAL_CLIENT_LOOPBACK_ENDPOINT",
  "AI_GATEWAY_LOCAL_CLIENT_LOOPBACK_TENANT_ID",
  "AI_GATEWAY_LOCAL_CLIENT_LOOPBACK_CLIENT_ID",
  "AI_GATEWAY_LOCAL_CLIENT_LOOPBACK_MANIFEST_SHA256",
  "AI_GATEWAY_LOCAL_CLIENT_LOOPBACK_SECRET_REF",
  "AI_GATEWAY_LOCAL_CLIENT_LOOPBACK_TIMEOUT_MS",
  "AI_GATEWAY_LOCAL_CLIENT_LOOPBACK_CHALLENGE_TTL_MS",
  "AI_GATEWAY_LOCAL_CLIENT_LOOPBACK_VERIFICATION_TTL_MS",
  "AI_GATEWAY_LOCAL_CLIENT_LOOPBACK_MAX_RESPONSE_BYTES",
] as const);

export function resolveLocalClientLoopbackAdapterConfiguration(
  env: RuntimeEnv = {},
): LocalClientLoopbackAdapterConfiguration {
  const enabled = strictBoolean(env.AI_GATEWAY_LOCAL_CLIENT_LOOPBACK_ENABLED, false);
  const rawJson = String(env.AI_GATEWAY_LOCAL_CLIENT_LOOPBACK_ADAPTERS_JSON ?? "").trim();
  const legacyPresent = LEGACY_FIELDS.some((name) => String(env[name] ?? "").trim() !== "");
  if (!enabled) {
    if (rawJson || legacyPresent || String(env.AI_GATEWAY_LOCAL_CLIENT_REGISTRY_INTEGRITY_SECRET_REF ?? "").trim()) {
      throw configError();
    }
    return freezeConfiguration(false, "disabled", [], null);
  }
  if (rawJson && legacyPresent) throw configError();

  const source = rawJson ? "versioned-json" as const : "legacy-single" as const;
  const entries = rawJson
    ? parseVersionedEntries(rawJson)
    : [normalizeEntry({
      adapterId: env.AI_GATEWAY_LOCAL_CLIENT_LOOPBACK_ADAPTER_ID ?? LOCAL_CLIENT_LOOPBACK_ADAPTER_ID,
      tenantId: env.AI_GATEWAY_LOCAL_CLIENT_LOOPBACK_TENANT_ID,
      clientId: env.AI_GATEWAY_LOCAL_CLIENT_LOOPBACK_CLIENT_ID,
      endpoint: env.AI_GATEWAY_LOCAL_CLIENT_LOOPBACK_ENDPOINT,
      manifestSha256: env.AI_GATEWAY_LOCAL_CLIENT_LOOPBACK_MANIFEST_SHA256,
      secretRef: env.AI_GATEWAY_LOCAL_CLIENT_LOOPBACK_SECRET_REF,
      timeoutMs: env.AI_GATEWAY_LOCAL_CLIENT_LOOPBACK_TIMEOUT_MS,
      challengeTtlMs: env.AI_GATEWAY_LOCAL_CLIENT_LOOPBACK_CHALLENGE_TTL_MS,
      verificationTtlMs: env.AI_GATEWAY_LOCAL_CLIENT_LOOPBACK_VERIFICATION_TTL_MS,
      maxResponseBytes: env.AI_GATEWAY_LOCAL_CLIENT_LOOPBACK_MAX_RESPONSE_BYTES,
    })];
  assertUniqueEntries(entries);
  const registryIntegritySecretRef = optionalBoundedText(
    env.AI_GATEWAY_LOCAL_CLIENT_REGISTRY_INTEGRITY_SECRET_REF,
    2_048,
  );
  // The registry authority is gateway-only. Falling back to a client-held
  // loopback secret would let that client derive registry, replay-store, and
  // receipt-journal authority keys.
  if (!registryIntegritySecretRef) throw configError();
  return freezeConfiguration(true, source, entries, registryIntegritySecretRef);
}

function parseVersionedEntries(rawJson: string): LocalClientLoopbackAdapterConfigEntry[] {
  if (Buffer.byteLength(rawJson, "utf8") > MAX_CONFIG_BYTES) throw configError();
  let parsed: unknown;
  try {
    parsed = JSON.parse(rawJson);
  } catch {
    throw configError();
  }
  if (
    !isPlainRecord(parsed)
    || !hasExactKeys(parsed, ["version", "adapters"])
    || parsed.version !== 1
    || !Array.isArray(parsed.adapters)
    || parsed.adapters.length < 1
    || parsed.adapters.length > MAX_ADAPTERS
  ) throw configError();
  return parsed.adapters.map(normalizeEntry);
}

function normalizeEntry(raw: unknown): LocalClientLoopbackAdapterConfigEntry {
  if (!isPlainRecord(raw)) throw configError();
  const actualKeys = Reflect.ownKeys(raw);
  if (actualKeys.some((key) => typeof key !== "string" || !ENTRY_KEYS.includes(key))) throw configError();
  for (const required of [
    "adapterId",
    "tenantId",
    "clientId",
    "endpoint",
    "manifestSha256",
    "secretRef",
  ]) {
    if (!Object.hasOwn(raw, required)) throw configError();
  }
  const adapterId = identifier(raw.adapterId);
  const tenantId = opaqueIdentity(raw.tenantId);
  const clientId = identifier(raw.clientId);
  const endpoint = exactLoopbackEndpoint(raw.endpoint);
  const manifestSha256 = typeof raw.manifestSha256 === "string"
    ? raw.manifestSha256.trim()
    : "";
  const secretRef = boundedText(raw.secretRef, 2_048);
  if (!SHA256_PATTERN.test(manifestSha256)) throw configError();
  return Object.freeze({
    adapterId,
    tenantId,
    clientId,
    endpoint,
    manifestSha256,
    secretRef,
    timeoutMs: boundedInteger(raw.timeoutMs, 5_000, 50, 30_000),
    challengeTtlMs: boundedInteger(raw.challengeTtlMs, 2_000, 10, 10_000),
    verificationTtlMs: boundedInteger(raw.verificationTtlMs, 5 * 60_000, 1_000, 24 * 60 * 60_000),
    maxResponseBytes: boundedInteger(raw.maxResponseBytes, 16_384, 256, 65_536),
  });
}

function assertUniqueEntries(entries: readonly LocalClientLoopbackAdapterConfigEntry[]): void {
  const adapters = new Set<string>();
  const owners = new Set<string>();
  for (const entry of entries) {
    const owner = `${entry.tenantId}\0${entry.clientId}`;
    if (adapters.has(entry.adapterId) || owners.has(owner)) throw configError();
    adapters.add(entry.adapterId);
    owners.add(owner);
  }
}

function freezeConfiguration(
  enabled: boolean,
  source: LocalClientLoopbackAdapterConfiguration["source"],
  rawEntries: readonly LocalClientLoopbackAdapterConfigEntry[],
  registryIntegritySecretRef: string | null,
): LocalClientLoopbackAdapterConfiguration {
  const entries = Object.freeze([...rawEntries]);
  return Object.freeze({
    enabled,
    source,
    entries,
    registryIntegritySecretRef,
    status: Object.freeze({
      enabled,
      source,
      adapterCount: entries.length,
      tenantCount: new Set(entries.map((entry) => entry.tenantId)).size,
      clientCount: entries.length,
      secretReferencesExposed: false as const,
      gatewayAuthoritySecretRequired: true as const,
      gatewayClientSecretReuseForbidden: true as const,
    }),
  });
}

function strictBoolean(value: unknown, fallback: boolean): boolean {
  if (value === undefined || value === null || String(value).trim() === "") return fallback;
  const normalized = String(value).trim().toLowerCase();
  if (normalized === "true" || normalized === "1") return true;
  if (normalized === "false" || normalized === "0") return false;
  throw configError();
}

function boundedInteger(value: unknown, fallback: number, minimum: number, maximum: number): number {
  if (value === undefined || value === null || String(value).trim() === "") return fallback;
  const normalized = typeof value === "number" ? value : Number(String(value).trim());
  if (!Number.isSafeInteger(normalized) || normalized < minimum || normalized > maximum) throw configError();
  return normalized;
}

function identifier(value: unknown): string {
  if (typeof value !== "string") throw configError();
  const normalized = value.trim();
  if (!IDENTIFIER_PATTERN.test(normalized)) throw configError();
  return normalized;
}

function opaqueIdentity(value: unknown): string {
  const normalized = boundedText(value, 128);
  return normalized;
}

function optionalBoundedText(value: unknown, maxLength: number): string | null {
  if (value === undefined || value === null || String(value).trim() === "") return null;
  return boundedText(value, maxLength);
}

function exactLoopbackEndpoint(value: unknown): string {
  const raw = boundedText(value, 2_048);
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw configError();
  }
  const hostname = url.hostname.toLowerCase().replace(/^\[|\]$/gu, "");
  if (
    url.protocol !== "http:"
    || (hostname !== "127.0.0.1" && hostname !== "::1")
    || !url.port
    || url.username
    || url.password
    || url.pathname !== "/"
    || url.search
    || url.hash
    || raw !== url.origin
  ) throw configError();
  return url.origin;
}

function boundedText(value: unknown, maxLength: number): string {
  if (typeof value !== "string") throw configError();
  const normalized = value.trim();
  if (!normalized || normalized.length > maxLength || /[\u0000-\u001f\u007f]/u.test(normalized)) {
    throw configError();
  }
  return normalized;
}

function isPlainRecord(value: unknown): value is UnknownRecord {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function hasExactKeys(value: object, keys: readonly string[]): boolean {
  const actual = Reflect.ownKeys(value);
  return actual.length === keys.length
    && actual.every((key) => typeof key === "string" && keys.includes(key));
}

function configError(): LocalClientLoopbackAdapterConfigError {
  return new LocalClientLoopbackAdapterConfigError();
}
