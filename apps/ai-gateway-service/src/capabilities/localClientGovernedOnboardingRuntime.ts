import {
  createLocalClientGovernedOnboardingApi,
  type LocalClientGovernedOnboardingDependencies,
} from "./localClientGovernedOnboardingApi.ts";
import type { ResolvedLocalClientOnboardingConfiguration } from "./localClientOnboardingConfig.ts";
import {
  createLocalClientOnboardingRegistry,
  type LocalClientOnboardingRegistry,
} from "./localClientOnboardingRegistry.ts";

export type LocalClientOnboardingInitializationState =
  | "disabled"
  | "not-started"
  | "initializing"
  | "ready"
  | "recovery-required"
  | "closed"
  | "failed";

export type LocalClientGovernedOnboardingApi = ReturnType<
  typeof createLocalClientGovernedOnboardingApi
>;

export interface LocalClientGovernedOnboardingRuntimeOptions {
  readonly configuration: ResolvedLocalClientOnboardingConfiguration;
  readonly approvalGate: LocalClientGovernedOnboardingDependencies["approvalGate"];
  readonly idempotencyCoordinator: LocalClientGovernedOnboardingDependencies["idempotencyCoordinator"] | null;
  readonly externalEffectGate: LocalClientGovernedOnboardingDependencies["externalEffectGate"];
  readonly receiptAuthorityStore: LocalClientGovernedOnboardingDependencies["receiptAuthorityStore"] | null;
}

export type LocalClientGovernedOnboardingRuntime = Readonly<{
  api: LocalClientGovernedOnboardingApi;
  initialize(): Promise<void>;
  getStatus(): Readonly<{
    enabled: boolean;
    initializationState: LocalClientOnboardingInitializationState;
    configurationVersion: 1;
    configuredProfileCount: 0 | 3;
    clients: readonly ["claude-compatible", "cursor", "vscode"];
    format: "json-only";
    certificationStatus: "fixture-tested-not-real-client-certified";
    requiresExplicitApproval: true;
    requiresDurableIdempotency: true;
    requiresDurableExternalEffectFence: true;
    requiresDurableReceiptAuthority: true;
    automaticDiscoveryOrMutation: false;
    sensitiveConfigurationRedacted: true;
    tenantOwned: true;
    backupProtection: "aes-256-gcm";
  }>;
  close(): Promise<void>;
}>;

export function createLocalClientGovernedOnboardingRuntime(
  options: LocalClientGovernedOnboardingRuntimeOptions,
): LocalClientGovernedOnboardingRuntime {
  assertOptions(options);
  let initializationState: LocalClientOnboardingInitializationState = options.configuration.enabled
    ? "not-started"
    : "disabled";
  let apiPromise: Promise<LocalClientGovernedOnboardingApi> | null = null;
  let registryInstance: LocalClientOnboardingRegistry | null = null;
  let closed = false;
  let closePromise: Promise<void> | null = null;
  const backupEncryptionKey = options.configuration.enabled
    ? options.configuration.registryOptions.backupEncryptionKey
    : undefined;

  const getApi = (): Promise<LocalClientGovernedOnboardingApi> => {
    if (closed) return Promise.reject(closedError());
    if (!options.configuration.enabled) return Promise.reject(disabledError());
    if (!apiPromise) {
      initializationState = "initializing";
      apiPromise = createLocalClientOnboardingRegistry(options.configuration.registryOptions)
        .then(async (registry) => {
          if (closed) {
            await registry.close();
            backupEncryptionKey?.fill(0);
            throw closedError();
          }
          const api = createLocalClientGovernedOnboardingApi({
            registry,
            approvalGate: options.approvalGate,
            idempotencyCoordinator: options.idempotencyCoordinator!,
            externalEffectGate: options.externalEffectGate,
            receiptAuthorityStore: options.receiptAuthorityStore!,
          });
          registryInstance = registry;
          backupEncryptionKey?.fill(0);
          await refreshInitializationState(registry, (state) => {
            if (!closed) initializationState = state;
          });
          return api;
        })
        .catch((error: unknown) => {
          backupEncryptionKey?.fill(0);
          initializationState = closed ? "closed" : "failed";
          throw error;
        });
    }
    return apiPromise;
  };

  const api = Object.freeze({
    async list(...args: Parameters<LocalClientGovernedOnboardingApi["list"]>) {
      assertOwnedRequest(options.configuration, args[0]);
      return (await getApi()).list(...args);
    },
    async inspect(...args: Parameters<LocalClientGovernedOnboardingApi["inspect"]>) {
      assertOwnedRequest(options.configuration, args[0]);
      return (await getApi()).inspect(...args);
    },
    async verify(...args: Parameters<LocalClientGovernedOnboardingApi["verify"]>) {
      assertOwnedRequest(options.configuration, args[0]);
      return (await getApi()).verify(...args);
    },
    async plan(...args: Parameters<LocalClientGovernedOnboardingApi["plan"]>) {
      assertOwnedRequest(options.configuration, args[0]);
      return (await getApi()).plan(...args);
    },
    async approve(...args: Parameters<LocalClientGovernedOnboardingApi["approve"]>) {
      assertOwnedRequest(options.configuration, args[0]);
      return (await getApi()).approve(...args);
    },
    async apply(...args: Parameters<LocalClientGovernedOnboardingApi["apply"]>) {
      assertOwnedRequest(options.configuration, args[0]);
      return (await getApi()).apply(...args);
    },
    async rollback(...args: Parameters<LocalClientGovernedOnboardingApi["rollback"]>) {
      assertOwnedRequest(options.configuration, args[0]);
      return (await getApi()).rollback(...args);
    },
    async recover(...args: Parameters<LocalClientGovernedOnboardingApi["recover"]>) {
      assertOwnedRequest(options.configuration, args[0]);
      const result = await (await getApi()).recover(...args);
      if (registryInstance) {
        await refreshInitializationState(registryInstance, (state) => {
          initializationState = state;
        });
      }
      return result;
    },
  }) as LocalClientGovernedOnboardingApi;

  return Object.freeze({
    api,
    async initialize(): Promise<void> {
      await getApi();
    },
    getStatus() {
      return Object.freeze({
        ...options.configuration.status,
        initializationState,
      });
    },
    async close(): Promise<void> {
      if (closePromise) return closePromise;
      closed = true;
      initializationState = "closed";
      closePromise = (async () => {
        if (apiPromise) await apiPromise.catch(() => undefined);
        await registryInstance?.close();
        backupEncryptionKey?.fill(0);
        initializationState = "closed";
      })();
      return closePromise;
    },
  });
}

async function refreshInitializationState(
  registry: LocalClientOnboardingRegistry,
  update: (state: "ready" | "recovery-required" | "failed") => void,
): Promise<void> {
  const inspections = await Promise.all(
    registry.listProfiles().map((profile) => registry.inspect(profile.profileId)),
  );
  if (inspections.some((inspection) => inspection.journalCorrupt === true)) {
    update("failed");
    return;
  }
  if (inspections.some((inspection) => inspection.recoveryRequired === true)) {
    update("recovery-required");
    return;
  }
  update("ready");
}

function assertOwnedRequest(
  configuration: ResolvedLocalClientOnboardingConfiguration,
  request: unknown,
): void {
  if (!configuration.enabled) return;
  if (
    typeof request !== "object"
    || request === null
    || Array.isArray(request)
    || !("tenantId" in request)
    || (request as { tenantId?: unknown }).tenantId !== configuration.ownerTenantId
  ) {
    throw Object.assign(new Error(
      "The authenticated tenant does not own the configured local-client onboarding profiles.",
    ), {
      code: "LOCAL_CLIENT_ONBOARDING_TENANT_FORBIDDEN",
      category: "auth",
      statusCode: 403,
      retryable: false,
    });
  }
}

function assertOptions(options: LocalClientGovernedOnboardingRuntimeOptions): void {
  if (!options || typeof options !== "object" || !options.configuration) throw configurationError();
  if (!options.configuration.enabled) return;
  if (
    !(options.configuration.registryOptions.backupEncryptionKey instanceof Uint8Array)
    || options.configuration.registryOptions.backupEncryptionKey.byteLength !== 32
    || !Number.isSafeInteger(options.configuration.registryOptions.committedRetentionMs)
    || Number(options.configuration.registryOptions.committedRetentionMs) < 10
    || typeof options.approvalGate?.approve !== "function"
    || typeof options.approvalGate?.consume !== "function"
    || typeof options.idempotencyCoordinator?.execute !== "function"
    || typeof options.idempotencyCoordinator?.getStats !== "function"
    || typeof options.idempotencyCoordinator?.checkHealth !== "function"
    || typeof options.externalEffectGate?.reserve !== "function"
    || typeof options.receiptAuthorityStore?.recordApplied !== "function"
    || typeof options.receiptAuthorityStore?.authorizeRollback !== "function"
    || typeof options.receiptAuthorityStore?.markRolledBack !== "function"
    || typeof options.receiptAuthorityStore?.releaseRollbackClaim !== "function"
    || options.receiptAuthorityStore?.status.available !== true
    || options.receiptAuthorityStore?.status.durable !== true
    || options.receiptAuthorityStore?.status.oneTimeRollbackAuthorization !== true
  ) {
    throw configurationError();
  }
}

function disabledError(): Error {
  return Object.assign(new Error(
    "Governed local-client onboarding is disabled; no client configuration was inspected or changed.",
  ), {
    code: "LOCAL_CLIENT_ONBOARDING_DISABLED",
    category: "configuration",
    statusCode: 503,
    retryable: false,
  });
}

function closedError(): Error {
  return Object.assign(new Error(
    "Governed local-client onboarding runtime is closed.",
  ), {
    code: "LOCAL_CLIENT_ONBOARDING_RUNTIME_CLOSED",
    category: "configuration",
    statusCode: 503,
    retryable: false,
  });
}

function configurationError(): Error {
  return Object.assign(new Error(
    "Governed local-client onboarding dependencies are unavailable.",
  ), {
    code: "LOCAL_CLIENT_ONBOARDING_RUNTIME_CONFIGURATION_INVALID",
    category: "configuration",
    statusCode: 503,
    retryable: false,
  });
}
