export const LOCAL_CLIENT_PROTOCOL_PRINCIPAL_CONFIG_VERSION = 1 as const;
export const LOCAL_CLIENT_PROTOCOL_PRINCIPAL_ENV =
  "AI_GATEWAY_LOCAL_CLIENT_PROTOCOL_PRINCIPALS_JSON" as const;

export interface LocalClientProtocolPrincipalBinding {
  readonly tenantId: string;
  readonly subjectId: string;
  readonly clientId: string;
}

export interface LocalClientProtocolPrincipalConfiguration {
  readonly enabled: boolean;
  readonly bindings: readonly LocalClientProtocolPrincipalBinding[];
  readonly status: Readonly<{
    enabled: boolean;
    version: typeof LOCAL_CLIENT_PROTOCOL_PRINCIPAL_CONFIG_VERSION;
    bindingCount: number;
    tenantCount: number;
    identitiesRedacted: true;
    requestBodySelectsPrincipal: false;
  }>;
  resolve(identity: Readonly<{ tenantId?: unknown; userId?: unknown; subjectId?: unknown; subject?: unknown }>):
    LocalClientProtocolPrincipalBinding | null;
}

export class LocalClientProtocolPrincipalConfigError extends Error {
  readonly code = "LOCAL_CLIENT_PROTOCOL_PRINCIPAL_CONFIG_INVALID" as const;
  readonly category = "configuration" as const;
  readonly statusCode = 503 as const;
  readonly retryable = false as const;

  constructor() {
    super("The managed local-client protocol principal configuration is invalid.");
    this.name = "LocalClientProtocolPrincipalConfigError";
  }
}

const MAX_CONFIG_BYTES = 128 * 1024;
const MAX_BINDINGS = 64;
const CLIENT_ID_PATTERN = /^[a-z][a-z0-9._-]{0,127}$/u;
const IDENTITY_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:@/-]{0,255}$/u;

export function resolveLocalClientProtocolPrincipalConfiguration(
  env: Readonly<Record<string, string | undefined>> = {},
): LocalClientProtocolPrincipalConfiguration {
  const raw = env[LOCAL_CLIENT_PROTOCOL_PRINCIPAL_ENV];
  if (raw === undefined || raw === "") return freezeConfiguration([]);
  if (
    typeof raw !== "string"
    || raw !== raw.trim()
    || Buffer.byteLength(raw, "utf8") > MAX_CONFIG_BYTES
  ) throw configError();
  let parsed: unknown;
  try { parsed = JSON.parse(raw); } catch { throw configError(); }
  if (
    !isExactRecord(parsed, ["version", "bindings"])
    || parsed.version !== LOCAL_CLIENT_PROTOCOL_PRINCIPAL_CONFIG_VERSION
    || !Array.isArray(parsed.bindings)
    || parsed.bindings.length < 1
    || parsed.bindings.length > MAX_BINDINGS
  ) throw configError();
  const subjects = new Set<string>();
  const bindings = parsed.bindings.map((entry) => {
    if (!isExactRecord(entry, ["tenantId", "subjectId", "clientId"])) throw configError();
    const tenantId = identity(entry.tenantId);
    const subjectId = identity(entry.subjectId);
    const clientId = clientIdValue(entry.clientId);
    const key = `${tenantId}\0${subjectId}`;
    if (subjects.has(key)) throw configError();
    subjects.add(key);
    return Object.freeze({ tenantId, subjectId, clientId });
  });
  return freezeConfiguration(bindings);
}

function freezeConfiguration(
  rawBindings: readonly LocalClientProtocolPrincipalBinding[],
): LocalClientProtocolPrincipalConfiguration {
  const bindings = Object.freeze([...rawBindings]);
  const bySubject = new Map(bindings.map((binding) => [
    `${binding.tenantId}\0${binding.subjectId}`,
    binding,
  ]));
  return Object.freeze({
    enabled: bindings.length > 0,
    bindings,
    status: Object.freeze({
      enabled: bindings.length > 0,
      version: LOCAL_CLIENT_PROTOCOL_PRINCIPAL_CONFIG_VERSION,
      bindingCount: bindings.length,
      tenantCount: new Set(bindings.map((binding) => binding.tenantId)).size,
      identitiesRedacted: true as const,
      requestBodySelectsPrincipal: false as const,
    }),
    resolve(rawIdentity: Readonly<{
      tenantId?: unknown;
      userId?: unknown;
      subjectId?: unknown;
      subject?: unknown;
    }>) {
      if (!rawIdentity || typeof rawIdentity !== "object") return null;
      const tenantId = typeof rawIdentity.tenantId === "string" ? rawIdentity.tenantId : "";
      const subjectId = typeof rawIdentity.userId === "string"
        ? rawIdentity.userId
        : typeof rawIdentity.subjectId === "string"
          ? rawIdentity.subjectId
          : typeof rawIdentity.subject === "string"
            ? rawIdentity.subject
            : "";
      return bySubject.get(`${tenantId}\0${subjectId}`) ?? null;
    },
  });
}

function identity(value: unknown): string {
  if (typeof value !== "string" || !IDENTITY_PATTERN.test(value)) throw configError();
  return value;
}

function clientIdValue(value: unknown): string {
  if (typeof value !== "string" || !CLIENT_ID_PATTERN.test(value)) throw configError();
  return value;
}

function isExactRecord(value: unknown, keys: readonly string[]): value is Record<string, unknown> {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) return false;
  const actual = Reflect.ownKeys(value);
  return actual.length === keys.length
    && actual.every((key) => typeof key === "string" && keys.includes(key))
    && keys.every((key) => Object.hasOwn(value, key));
}

function configError(): LocalClientProtocolPrincipalConfigError {
  return new LocalClientProtocolPrincipalConfigError();
}
