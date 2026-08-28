import type {
  LocalClientVerificationScope,
  LocalClientVerificationStore,
} from "./localClientVerificationService.ts";
import type {
  ResolveVerifiedLocalClientTargetInput,
  ResolvedVerifiedLocalClientTarget,
} from "./localClientManagementService.ts";

export interface LocalClientVerificationOwnershipBinding {
  readonly tenantId: string;
  readonly clientId: string;
  readonly adapterId: string;
}

export interface LocalClientVerificationOwnershipDependencies {
  readonly store: LocalClientVerificationStore;
  readonly resolveVerifiedTarget: (
    input: ResolveVerifiedLocalClientTargetInput,
  ) => ResolvedVerifiedLocalClientTarget | Promise<ResolvedVerifiedLocalClientTarget>;
  readonly bindings: readonly LocalClientVerificationOwnershipBinding[];
}

export class LocalClientVerificationOwnershipError extends Error {
  readonly code = "LOCAL_CLIENT_VERIFIED_TARGET_NOT_FOUND" as const;
  readonly category = "not_found" as const;
  readonly statusCode = 404;
  readonly retryable = false;

  constructor() {
    super("No verified local client exists in the authenticated tenant scope.");
    this.name = "LocalClientVerificationOwnershipError";
  }
}

const IDENTIFIER_PATTERN = /^[a-z][a-z0-9._-]{0,127}$/u;

export function createLocalClientVerificationOwnershipGate(
  dependencies: LocalClientVerificationOwnershipDependencies,
) {
  assertDependencies(dependencies);
  const bindings = new Map<string, Readonly<LocalClientVerificationOwnershipBinding>>();
  for (const raw of dependencies.bindings) {
    const binding = normalizeBinding(raw);
    const key = ownerKey(binding.tenantId, binding.clientId);
    if (bindings.has(key)) throw configurationError();
    bindings.set(key, binding);
  }

  const store: LocalClientVerificationStore = Object.freeze({
    async readCurrent(scope: LocalClientVerificationScope, clientId: string) {
      const binding = bindings.get(ownerKey(scope?.tenantId, clientId));
      if (!binding) return null;
      const declaration = await dependencies.store.readCurrent(scope, clientId);
      return declaration?.adapter?.id === binding.adapterId ? declaration : null;
    },
    async promoteExact(request: Parameters<LocalClientVerificationStore["promoteExact"]>[0]) {
      const binding = bindings.get(ownerKey(request?.scope?.tenantId, request?.expected?.clientId));
      if (
        !binding
        || request.expected.tenantId !== binding.tenantId
        || request.expected.adapter.id !== binding.adapterId
      ) return null;
      return dependencies.store.promoteExact(request);
    },
  });

  return Object.freeze({
    store,
    status: Object.freeze({
      bindingCount: bindings.size,
      tenantCount: new Set([...bindings.values()].map((binding) => binding.tenantId)).size,
      clientCount: bindings.size,
      requestBodyOwnershipAccepted: false as const,
    }),
    async resolveVerifiedTarget(
      input: ResolveVerifiedLocalClientTargetInput,
    ): Promise<ResolvedVerifiedLocalClientTarget> {
      const binding = bindings.get(ownerKey(input?.identity?.tenantId, input?.clientId));
      if (!binding) throw notFound();
      let target: ResolvedVerifiedLocalClientTarget;
      try {
        target = await dependencies.resolveVerifiedTarget(input);
      } catch {
        throw notFound();
      }
      if (
        target.clientId !== binding.clientId
        || target.adapter.id !== binding.adapterId
        || target.state !== "verified"
        || target.trustDecision !== "verified"
      ) throw notFound();
      return target;
    },
  });
}

function assertDependencies(dependencies: LocalClientVerificationOwnershipDependencies): void {
  if (
    !isRecord(dependencies)
    || Reflect.ownKeys(dependencies).some((key) => !new Set([
      "store",
      "resolveVerifiedTarget",
      "bindings",
    ]).has(String(key)))
    || typeof dependencies.store?.readCurrent !== "function"
    || typeof dependencies.store?.promoteExact !== "function"
    || typeof dependencies.resolveVerifiedTarget !== "function"
    || !Array.isArray(dependencies.bindings)
    || dependencies.bindings.length < 1
    || dependencies.bindings.length > 64
  ) throw configurationError();
}

function normalizeBinding(raw: LocalClientVerificationOwnershipBinding) {
  if (
    !isRecord(raw)
    || Reflect.ownKeys(raw).length !== 3
    || !Object.hasOwn(raw, "tenantId")
    || !Object.hasOwn(raw, "clientId")
    || !Object.hasOwn(raw, "adapterId")
  ) throw configurationError();
  return Object.freeze({
    tenantId: opaqueIdentity(raw.tenantId),
    clientId: identifier(raw.clientId),
    adapterId: identifier(raw.adapterId),
  });
}

function ownerKey(tenantId: unknown, clientId: unknown): string {
  return `${typeof tenantId === "string" ? tenantId : ""}\0${typeof clientId === "string" ? clientId : ""}`;
}

function opaqueIdentity(value: unknown): string {
  if (typeof value !== "string") throw configurationError();
  const normalized = value.trim();
  if (!normalized || normalized.length > 128 || /[\u0000-\u001f\u007f]/u.test(normalized)) {
    throw configurationError();
  }
  return normalized;
}

function identifier(value: unknown): string {
  if (typeof value !== "string" || !IDENTIFIER_PATTERN.test(value)) throw configurationError();
  return value;
}

function isRecord(value: unknown): value is Record<string, any> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function configurationError(): Error {
  return Object.assign(new Error("Local-client verification ownership configuration is invalid."), {
    code: "LOCAL_CLIENT_VERIFICATION_OWNERSHIP_CONFIG_INVALID",
    category: "configuration",
    statusCode: 503,
  });
}

function notFound(): LocalClientVerificationOwnershipError {
  return new LocalClientVerificationOwnershipError();
}
