export type LocalClientExecutionRuntimeEnv = Record<string, string | undefined>;

type DurabilityStatus = Readonly<{
  available?: boolean;
  durable?: boolean;
  distributed?: boolean;
  previewOnly?: boolean;
  enabled?: boolean;
  mode?: string;
  storageMode?: string;
  authenticated?: boolean;
  monotonicCheckpoint?: boolean;
  rollbackResistant?: boolean;
  rollbackDetectionScope?: string;
  recoveryContextEncrypted?: boolean;
  snapshotRollbackProtected?: boolean;
  clientAtomicEffectReceiptVerified?: boolean;
}>;

type AdapterDescriptor = Readonly<{
  id?: unknown;
  type?: unknown;
  version?: unknown;
}>;

export type LocalClientExecutionReadinessInput = Readonly<{
  env?: LocalClientExecutionRuntimeEnv;
  routePlanStatus?: DurabilityStatus | null;
  executionControlStatus?: DurabilityStatus | null;
  externalEffectStatus?: DurabilityStatus | null;
  idempotencyStatus?: DurabilityStatus | null;
  claimStatus?: DurabilityStatus | null;
  verificationAuthorityStatus?: DurabilityStatus | null;
  receiptJournalStatus?: DurabilityStatus | null;
  adapterDescriptors?: readonly AdapterDescriptor[] | null;
}>;

export type LocalClientExecutionReadiness = Readonly<{
  requested: boolean;
  ready: boolean;
  mode: "preview-only" | "ready" | "blocked";
  multiInstance: boolean;
  governedAdapterCount: number;
  blockers: readonly string[];
  boundaries: Readonly<{
    realExecutionDefault: false;
    requiresDurableRoutePlan: true;
    requiresSubjectBoundApproval: true;
    requiresDurableLifecycle: true;
    requiresExclusiveClaim: true;
    requiresDurableExternalEffectGate: true;
    requiresDurableIdempotency: true;
    requiresAuthenticatedVerificationAuthority: true;
    requiresMonotonicCheckpoint: true;
    requiresDurableReceiptReconciliation: true;
    requiresReceiptSnapshotRollbackProtectionByDefault: true;
    requiresClientAtomicEffectReceiptProofByDefault: true;
    requiresRollbackResistanceByDefault: true;
    unprotectedReceiptReconciliationRuntimeOverrideAllowed: false;
    multiInstanceRequiresDistributedState: true;
  }>;
}>;

export class LocalClientExecutionReadinessError extends Error {
  readonly code: "LOCAL_CLIENT_EXECUTION_RUNTIME_NOT_READY" | "LOCAL_CLIENT_EXECUTION_CONFIG_INVALID";
  readonly category = "configuration" as const;
  readonly statusCode = 503;
  readonly retryable = false;
  readonly blockers: readonly string[];

  constructor(
    code: LocalClientExecutionReadinessError["code"],
    message: string,
    blockers: readonly string[] = [],
  ) {
    super(message);
    this.name = "LocalClientExecutionReadinessError";
    this.code = code;
    this.blockers = Object.freeze([...blockers]);
  }
}

const BOUNDARIES = Object.freeze({
  realExecutionDefault: false as const,
  requiresDurableRoutePlan: true as const,
  requiresSubjectBoundApproval: true as const,
  requiresDurableLifecycle: true as const,
  requiresExclusiveClaim: true as const,
  requiresDurableExternalEffectGate: true as const,
  requiresDurableIdempotency: true as const,
  requiresAuthenticatedVerificationAuthority: true as const,
  requiresMonotonicCheckpoint: true as const,
  requiresDurableReceiptReconciliation: true as const,
  requiresReceiptSnapshotRollbackProtectionByDefault: true as const,
  requiresClientAtomicEffectReceiptProofByDefault: true as const,
  requiresRollbackResistanceByDefault: true as const,
  unprotectedReceiptReconciliationRuntimeOverrideAllowed: false as const,
  multiInstanceRequiresDistributedState: true as const,
});

export function evaluateLocalClientExecutionReadiness(
  input: LocalClientExecutionReadinessInput = {},
): LocalClientExecutionReadiness {
  assertExactInput(input);
  const env = input.env ?? {};
  const requested = readBoolean(env.AI_GATEWAY_LOCAL_CLIENT_EXECUTION_ENABLED, false);
  const multiInstance = readBoolean(env.AI_GATEWAY_MULTI_INSTANCE, false);
  const allowRegistryOnlyRollbackDetection = readBoolean(
    env.AI_GATEWAY_LOCAL_CLIENT_ALLOW_REGISTRY_ONLY_ROLLBACK_DETECTION,
    false,
  );
  const descriptors = Array.isArray(input.adapterDescriptors) ? input.adapterDescriptors : [];
  const governedAdapterCount = descriptors.filter(isGovernedAdapter).length;
  const blockers: string[] = [];

  if (requested) {
    requireStatus(input.routePlanStatus, "route_plan", blockers, { durable: true, available: true });
    requireStatus(input.executionControlStatus, "execution_control", blockers, { durable: true, available: true });
    requireStatus(input.externalEffectStatus, "external_effect", blockers, { durable: true, available: true, enabled: true });
    requireStatus(input.idempotencyStatus, "idempotency", blockers, { durable: true, available: true });
    requireStatus(input.claimStatus, "claim", blockers, { durable: true, available: true });
    requireStatus(input.verificationAuthorityStatus, "verification_authority", blockers, {
      durable: true,
      available: true,
      authenticated: true,
      monotonicCheckpoint: true,
    });
    requireStatus(input.receiptJournalStatus, "receipt_journal", blockers, {
      durable: true,
      available: true,
    });
    if (
      input.receiptJournalStatus
      && input.receiptJournalStatus.recoveryContextEncrypted !== true
    ) {
      blockers.push("receipt_journal_recovery_context_not_encrypted");
    }
    if (input.receiptJournalStatus) {
      if (input.receiptJournalStatus.snapshotRollbackProtected !== true) {
        blockers.push("receipt_journal_snapshot_rollback_not_protected");
      }
      if (input.receiptJournalStatus.clientAtomicEffectReceiptVerified !== true) {
        blockers.push("receipt_journal_client_atomic_effect_receipt_unverified");
      }
    }
    if (
      input.verificationAuthorityStatus
      && input.verificationAuthorityStatus.rollbackResistant !== true
      && !allowRegistryOnlyRollbackDetection
    ) {
      blockers.push("verification_authority_not_rollback_resistant");
    }
    if (governedAdapterCount === 0) blockers.push("governed_adapter_missing");

    if (multiInstance) {
      for (const [name, status] of [
        ["route_plan", input.routePlanStatus],
        ["execution_control", input.executionControlStatus],
        ["external_effect", input.externalEffectStatus],
        ["idempotency", input.idempotencyStatus],
        ["claim", input.claimStatus],
        ["verification_authority", input.verificationAuthorityStatus],
        ["receipt_journal", input.receiptJournalStatus],
      ] as const) {
        if (status?.distributed !== true) blockers.push(`${name}_not_distributed`);
      }
    }
  }

  const uniqueBlockers = Object.freeze([...new Set(blockers)].sort());
  return Object.freeze({
    requested,
    ready: requested && uniqueBlockers.length === 0,
    mode: requested ? (uniqueBlockers.length === 0 ? "ready" : "blocked") : "preview-only",
    multiInstance,
    governedAdapterCount,
    blockers: uniqueBlockers,
    boundaries: BOUNDARIES,
  });
}

export function assertLocalClientExecutionReadiness(
  input: LocalClientExecutionReadinessInput = {},
): LocalClientExecutionReadiness {
  const result = evaluateLocalClientExecutionReadiness(input);
  if (result.requested && !result.ready) {
    throw new LocalClientExecutionReadinessError(
      "LOCAL_CLIENT_EXECUTION_RUNTIME_NOT_READY",
      "Local-client execution was requested but its durable governed runtime is incomplete.",
      result.blockers,
    );
  }
  return result;
}

function requireStatus(
  status: DurabilityStatus | null | undefined,
  name: string,
  blockers: string[],
  requirements: Readonly<{
    durable?: boolean;
    available?: boolean;
    enabled?: boolean;
    authenticated?: boolean;
    monotonicCheckpoint?: boolean;
  }>,
): void {
  if (!status) {
    blockers.push(`${name}_missing`);
    return;
  }
  if (requirements.available === true && status.available !== true) blockers.push(`${name}_unavailable`);
  if (requirements.durable === true && status.durable !== true) blockers.push(`${name}_not_durable`);
  if (requirements.enabled === true && status.enabled !== true) blockers.push(`${name}_disabled`);
  if (requirements.authenticated === true && status.authenticated !== true) blockers.push(`${name}_not_authenticated`);
  if (requirements.monotonicCheckpoint === true && status.monotonicCheckpoint !== true) {
    blockers.push(`${name}_not_monotonic`);
  }
}

function isGovernedAdapter(value: AdapterDescriptor): boolean {
  return typeof value.id === "string"
    && value.id.length > 0
    && typeof value.version === "string"
    && value.version.length > 0
    && typeof value.type === "string"
    && value.type.length > 0
    && value.type !== "fake";
}

function readBoolean(value: unknown, fallback: boolean): boolean {
  if (value === undefined || value === null || value === "") return fallback;
  if (typeof value === "boolean") return value;
  if (typeof value !== "string") throw configError();
  const normalized = value.trim().toLowerCase();
  if (normalized === "true" || normalized === "1") return true;
  if (normalized === "false" || normalized === "0") return false;
  throw configError();
}

function assertExactInput(value: LocalClientExecutionReadinessInput): void {
  if (value === null || typeof value !== "object" || Array.isArray(value)) throw configError();
  const allowed = new Set([
    "env",
    "routePlanStatus",
    "executionControlStatus",
    "externalEffectStatus",
    "idempotencyStatus",
    "claimStatus",
    "verificationAuthorityStatus",
    "receiptJournalStatus",
    "adapterDescriptors",
  ]);
  if (Reflect.ownKeys(value).some((key) => typeof key !== "string" || !allowed.has(key))) throw configError();
}

function configError(): LocalClientExecutionReadinessError {
  return new LocalClientExecutionReadinessError(
    "LOCAL_CLIENT_EXECUTION_CONFIG_INVALID",
    "Local-client execution configuration contains an invalid boolean or field.",
  );
}
