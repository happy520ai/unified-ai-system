import { createHash, randomBytes, timingSafeEqual } from "node:crypto";

import type {
  ManagedLocalClientPopReplayConsumeInput,
  ManagedLocalClientPopReplayGuard,
  ManagedLocalClientPopReplayGuardStatus,
} from "./localClientPopIdentityAuthority.ts";

export const LOCAL_CLIENT_POP_REPLAY_CHECKPOINT_VERSION =
  "managed-local-client-pop-replay-checkpoint-v1" as const;
export const LOCAL_CLIENT_POP_PROTECTED_ANCHOR_EVIDENCE_VERSION =
  "managed-local-client-pop-protected-anchor-evidence-v1" as const;
export const LOCAL_CLIENT_POP_ANCHORED_MUTATION_PROTOCOL =
  "durable-intent-anchor-prepare-store-commit-anchor-finalize-v1" as const;

/**
 * This module is protocol core only. It performs no Windows, registry, ACL,
 * service-control, SQLite, or provisioning work.
 */
export const LOCAL_CLIENT_POP_SNAPSHOT_ROLLBACK_BOUNDARIES = Object.freeze({
  mutatesOperatingSystem: false as const,
  provisionsNativeAuthority: false as const,
  nativeWindowsAdapterImplemented: false as const,
  sqliteCheckpointCoordinatorImplemented: false as const,
  statusBooleanAloneIsEvidence: false as const,
  challengeBoundProtectedEvidenceRequired: true as const,
  checkpointReadBeforeAndAfterAttestation: true as const,
  everyReplayMutationMustAdvanceAnchor: true as const,
  crashRecoveryMustFailClosed: true as const,
  externalToReplaySnapshotRequired: true as const,
});

/** Current concrete implementation blockers; none is satisfied by this core. */
export const LOCAL_CLIENT_POP_SNAPSHOT_ROLLBACK_NATIVE_DEPLOYMENT_BLOCKERS =
  Object.freeze([
    "sqlite_pop_replay_generation_not_implemented",
    "sqlite_pop_replay_durable_intent_not_implemented",
    "sqlite_pop_replay_anchor_commit_coordinator_not_implemented",
    "windows_authority_native_adapter_not_implemented",
    "windows_authority_broker_transport_not_implemented",
    "windows_authority_provisioner_not_implemented",
    "windows_authority_protected_key_provisioning_not_implemented",
    "windows_authority_pop_checkpoint_evidence_adapter_not_implemented",
    "gateway_protected_anchor_async_preflight_not_implemented",
  ] as const);

export type LocalClientPopSnapshotRollbackBlocker =
  | "configuration_invalid"
  | "replay_guard_unavailable"
  | "replay_guard_not_durable"
  | "replay_set_not_authenticated"
  | "checkpoint_port_unavailable"
  | "checkpoint_not_authenticated"
  | "checkpoint_not_monotonic"
  | "replay_mutations_not_anchor_coupled"
  | "checkpoint_recovery_not_fail_closed"
  | "checkpoint_binding_invalid"
  | "protected_anchor_unavailable"
  | "native_anchor_deployment_unverified"
  | "anchor_not_monotonic"
  | "anchor_not_external_to_replay_snapshot"
  | "anchor_not_protected_from_replay_writer"
  | "anchor_challenge_attestation_unavailable"
  | "anchor_binding_invalid"
  | "checkpoint_anchor_binding_mismatch"
  | "challenge_generation_failed"
  | "checkpoint_unavailable"
  | "checkpoint_invalid"
  | "protected_anchor_evidence_unavailable"
  | "protected_anchor_evidence_invalid"
  | "checkpoint_changed_during_attestation"
  | "anchor_status_changed_during_attestation"
  | "protection_not_verified"
  | "closed";

export interface LocalClientPopReplayCheckpoint {
  readonly checkpointVersion: typeof LOCAL_CLIENT_POP_REPLAY_CHECKPOINT_VERSION;
  readonly state: "ready";
  readonly storeBindingSha256: string;
  readonly anchorBindingSha256: string;
  readonly generation: number;
  readonly checkpointDigestSha256: string;
}

export interface LocalClientPopAnchoredReplayCheckpointStatus {
  readonly available: boolean;
  readonly protocolVersion: typeof LOCAL_CLIENT_POP_REPLAY_CHECKPOINT_VERSION;
  readonly storeBindingSha256: string;
  readonly anchorBindingSha256: string;
  readonly authenticatedCheckpoint: boolean;
  readonly monotonicGeneration: boolean;
  readonly anchorsEveryMutation: boolean;
  readonly crashConsistentRecovery: boolean;
  readonly mutationProtocol: typeof LOCAL_CLIENT_POP_ANCHORED_MUTATION_PROTOCOL;
}

/**
 * Implementations must durably record mutation intent before preparing the
 * external anchor, commit the replay-store mutation before finalizing it, and
 * deterministically recover every crash window. Merely wrapping the existing
 * SQLite consumeOnce call and advancing an anchor afterwards violates this
 * contract.
 */
export interface LocalClientPopAnchoredReplayCheckpointPort
  extends ManagedLocalClientPopReplayGuard {
  readonly checkpointStatus: LocalClientPopAnchoredReplayCheckpointStatus;
  readCurrentCheckpoint(this: void): Promise<LocalClientPopReplayCheckpoint>;
}

export interface LocalClientPopExternalMonotonicAnchorStatus {
  readonly available: boolean;
  readonly mode: string;
  readonly anchorBindingSha256: string;
  /** Digest of independently verified native deployment evidence. */
  readonly deploymentEvidenceSha256: string;
  readonly nativeDeploymentVerified: boolean;
  readonly monotonic: boolean;
  readonly externalToReplayStoreSnapshot: boolean;
  readonly protectedFromReplayStoreWriter: boolean;
  readonly challengeAttestation: boolean;
}

export interface LocalClientPopProtectedAnchorEvidence {
  readonly evidenceVersion: typeof LOCAL_CLIENT_POP_PROTECTED_ANCHOR_EVIDENCE_VERSION;
  readonly evidenceKind: "native-protected-external-monotonic-anchor";
  readonly anchorBindingSha256: string;
  readonly storeBindingSha256: string;
  readonly generation: number;
  readonly checkpointDigestSha256: string;
  readonly challengeSha256: string;
  readonly deploymentEvidenceSha256: string;
  readonly nativeDeploymentVerified: true;
  readonly monotonic: true;
  readonly externalToReplayStoreSnapshot: true;
  readonly protectedFromReplayStoreWriter: true;
  readonly attestationVerified: true;
}

/**
 * Trusted native deployment boundary. verifyCurrent must authenticate fresh,
 * challenge-bound evidence from protected storage. It must not manufacture
 * evidence from configuration flags or from a caller-provided status object.
 */
export interface LocalClientPopExternalMonotonicAnchorPort {
  readonly status: LocalClientPopExternalMonotonicAnchorStatus;
  verifyCurrent(
    this: void,
    input: Readonly<{
      checkpoint: LocalClientPopReplayCheckpoint;
      challenge: Uint8Array;
    }>,
  ): Promise<LocalClientPopProtectedAnchorEvidence>;
  close?(this: void): void | Promise<void>;
}

export interface LocalClientPopSnapshotRollbackProtectionOptions {
  readonly checkpointPort: LocalClientPopAnchoredReplayCheckpointPort;
  readonly anchorPort: LocalClientPopExternalMonotonicAnchorPort;
  /** Test seam. Ownership of the returned Buffer transfers and it is wiped. */
  readonly challengeFactory?: () => Buffer;
}

export interface LocalClientPopSnapshotRollbackProtectionResolution {
  readonly ready: boolean;
  readonly snapshotRollbackProtected: boolean;
  readonly evidenceVerified: boolean;
  readonly nativeDeploymentVerified: boolean;
  readonly blockers: readonly LocalClientPopSnapshotRollbackBlocker[];
  readonly checkpoint: LocalClientPopReplayCheckpoint | null;
  readonly evidence: LocalClientPopProtectedAnchorEvidence | null;
  readonly anchorMode: string | null;
  readonly boundaries: typeof LOCAL_CLIENT_POP_SNAPSHOT_ROLLBACK_BOUNDARIES;
}

export type LocalClientPopSnapshotRollbackProtectionErrorCode =
  | "LOCAL_CLIENT_POP_SNAPSHOT_ROLLBACK_PROTECTION_UNAVAILABLE"
  | "LOCAL_CLIENT_POP_SNAPSHOT_ROLLBACK_PROTECTION_CLOSED";

export class LocalClientPopSnapshotRollbackProtectionError extends Error {
  readonly code: LocalClientPopSnapshotRollbackProtectionErrorCode;
  readonly statusCode = 503;
  readonly retryable = false;
  readonly blockers: readonly LocalClientPopSnapshotRollbackBlocker[];

  constructor(
    code: LocalClientPopSnapshotRollbackProtectionErrorCode,
    blockers: readonly LocalClientPopSnapshotRollbackBlocker[],
  ) {
    super(code === "LOCAL_CLIENT_POP_SNAPSHOT_ROLLBACK_PROTECTION_CLOSED"
      ? "The snapshot-rollback-protected PoP replay guard is closed."
      : "Verified snapshot rollback protection is unavailable for the PoP replay guard.");
    this.name = "LocalClientPopSnapshotRollbackProtectionError";
    this.code = code;
    this.blockers = Object.freeze([...blockers]);
  }
}

const SHA256_PATTERN = /^[a-f0-9]{64}$/u;
const CHALLENGE_BYTES = 32;
const verifiedResolutionObjects = new WeakSet<object>();

/**
 * Resolves a fresh readiness snapshot. True requires two matching authenticated
 * checkpoint reads around fresh protected-anchor evidence.
 */
export async function resolveLocalClientPopSnapshotRollbackProtection(
  rawOptions: LocalClientPopSnapshotRollbackProtectionOptions,
): Promise<LocalClientPopSnapshotRollbackProtectionResolution> {
  if (!validOptions(rawOptions)) return createResolution(["configuration_invalid"]);
  const { checkpointPort, anchorPort } = rawOptions;

  let replayStatus: ManagedLocalClientPopReplayGuardStatus;
  let checkpointStatus: LocalClientPopAnchoredReplayCheckpointStatus;
  let anchorStatus: LocalClientPopExternalMonotonicAnchorStatus;
  try {
    replayStatus = cloneReplayStatus(checkpointPort.status);
    checkpointStatus = cloneCheckpointStatus(checkpointPort.checkpointStatus);
    anchorStatus = cloneAnchorStatus(anchorPort.status);
  } catch {
    return createResolution(["configuration_invalid"]);
  }

  const initialBlockers = readinessBlockers(replayStatus, checkpointStatus, anchorStatus);
  if (initialBlockers.length > 0) {
    return createResolution(initialBlockers, { anchorMode: anchorStatus.mode });
  }

  let challenge: Buffer | null = null;
  let challengeSha256: string;
  try {
    challenge = (rawOptions.challengeFactory ?? (() => randomBytes(CHALLENGE_BYTES)))();
    if (!Buffer.isBuffer(challenge) || challenge.byteLength !== CHALLENGE_BYTES) {
      challenge?.fill(0);
      return createResolution(["challenge_generation_failed"], {
        anchorMode: anchorStatus.mode,
      });
    }
    challengeSha256 = sha256(challenge);
  } catch {
    challenge?.fill(0);
    return createResolution(["challenge_generation_failed"], {
      anchorMode: anchorStatus.mode,
    });
  }

  let before: LocalClientPopReplayCheckpoint;
  try {
    before = cloneCheckpoint(await checkpointPort.readCurrentCheckpoint());
  } catch (error) {
    challenge.fill(0);
    return createResolution([
      error instanceof InvalidCheckpointError ? "checkpoint_invalid" : "checkpoint_unavailable",
    ], { anchorMode: anchorStatus.mode });
  }

  if (!checkpointMatchesStatus(before, checkpointStatus)) {
    challenge.fill(0);
    return createResolution(["checkpoint_binding_invalid"], {
      checkpoint: before,
      anchorMode: anchorStatus.mode,
    });
  }

  let evidence: LocalClientPopProtectedAnchorEvidence;
  try {
    const rawEvidence = await anchorPort.verifyCurrent(Object.freeze({
      checkpoint: before,
      challenge,
    }));
    evidence = cloneEvidence(rawEvidence);
  } catch (error) {
    challenge.fill(0);
    return createResolution([
      error instanceof InvalidEvidenceError
        ? "protected_anchor_evidence_invalid"
        : "protected_anchor_evidence_unavailable",
    ], { checkpoint: before, anchorMode: anchorStatus.mode });
  }
  challenge.fill(0);

  let after: LocalClientPopReplayCheckpoint;
  let replayStatusAfter: ManagedLocalClientPopReplayGuardStatus;
  let checkpointStatusAfter: LocalClientPopAnchoredReplayCheckpointStatus;
  let anchorStatusAfter: LocalClientPopExternalMonotonicAnchorStatus;
  try {
    after = cloneCheckpoint(await checkpointPort.readCurrentCheckpoint());
    replayStatusAfter = cloneReplayStatus(checkpointPort.status);
    checkpointStatusAfter = cloneCheckpointStatus(checkpointPort.checkpointStatus);
    anchorStatusAfter = cloneAnchorStatus(anchorPort.status);
  } catch (error) {
    return createResolution([
      error instanceof InvalidCheckpointError ? "checkpoint_invalid" : "checkpoint_unavailable",
    ], { checkpoint: before, evidence, anchorMode: anchorStatus.mode });
  }

  if (!sameCheckpoint(before, after)) {
    return createResolution(["checkpoint_changed_during_attestation"], {
      checkpoint: after,
      evidence,
      anchorMode: anchorStatus.mode,
    });
  }
  if (
    !sameCheckpointStatus(checkpointStatus, checkpointStatusAfter)
    || !sameAnchorStatus(anchorStatus, anchorStatusAfter)
  ) {
    return createResolution(["anchor_status_changed_during_attestation"], {
      checkpoint: after,
      evidence,
      anchorMode: anchorStatusAfter.mode,
    });
  }

  const finalBlockers = readinessBlockers(
    replayStatusAfter,
    checkpointStatusAfter,
    anchorStatusAfter,
  );
  if (finalBlockers.length > 0) {
    return createResolution(finalBlockers, {
      checkpoint: after,
      evidence,
      anchorMode: anchorStatusAfter.mode,
    });
  }
  if (!evidenceMatches(evidence, after, anchorStatusAfter, challengeSha256)) {
    return createResolution(["protected_anchor_evidence_invalid"], {
      checkpoint: after,
      evidence,
      anchorMode: anchorStatusAfter.mode,
    });
  }

  return createResolution([], {
    checkpoint: after,
    evidence,
    anchorMode: anchorStatusAfter.mode,
  }, true);
}

/**
 * Adapts a verified resolution to the narrow status accepted by the managed
 * PoP authority. A caller-created lookalike resolution cannot grant readiness.
 */
export function composeManagedLocalClientPopReplayGuardStatus(
  rawStatus: ManagedLocalClientPopReplayGuardStatus,
  resolution: LocalClientPopSnapshotRollbackProtectionResolution,
): ManagedLocalClientPopReplayGuardStatus {
  const status = cloneReplayStatus(rawStatus);
  const protectedReady = typeof resolution === "object"
    && resolution !== null
    && verifiedResolutionObjects.has(resolution)
    && resolution.ready === true
    && resolution.snapshotRollbackProtected === true
    && resolution.evidenceVerified === true
    && resolution.nativeDeploymentVerified === true
    && resolution.blockers.length === 0;
  return Object.freeze({
    available: status.available && protectedReady,
    durable: status.durable,
    distributed: status.distributed,
    mode: status.mode,
    ...(Object.hasOwn(status, "authenticatedReplaySet")
      ? { authenticatedReplaySet: status.authenticatedReplaySet }
      : {}),
    snapshotRollbackProtected: protectedReady,
    ...(Object.hasOwn(status, "defensiveEnabled")
      ? { defensiveEnabled: status.defensiveEnabled }
      : {}),
    ...(Object.hasOwn(status, "capacityIsolatedByScope")
      ? { capacityIsolatedByScope: status.capacityIsolatedByScope }
      : {}),
    ...(Object.hasOwn(status, "maxEntries") ? { maxEntries: status.maxEntries } : {}),
    ...(Object.hasOwn(status, "maxEntriesPerScope")
      ? { maxEntriesPerScope: status.maxEntriesPerScope }
      : {}),
  });
}

/**
 * Operational adapter for a checkpoint port that already implements the
 * durable-intent/anchor two-phase protocol. It re-attests before and after
 * every consume operation and suppresses an admitted result if post-attestation
 * fails. It cannot upgrade the current SQLite replay guard by itself.
 */
export class LocalClientPopSnapshotRollbackProtectedReplayGuard
implements ManagedLocalClientPopReplayGuard {
  readonly #options: LocalClientPopSnapshotRollbackProtectionOptions;
  #status: ManagedLocalClientPopReplayGuardStatus;
  #protection: LocalClientPopSnapshotRollbackProtectionResolution;
  #queue: Promise<void> = Promise.resolve();
  #closing = false;
  #closed = false;

  constructor(options: LocalClientPopSnapshotRollbackProtectionOptions) {
    this.#options = options;
    this.#protection = createResolution(["protection_not_verified"]);
    this.#status = unavailableReplayStatus(safeReplayStatus(options?.checkpointPort));
  }

  get status(): ManagedLocalClientPopReplayGuardStatus {
    return this.#status;
  }

  get protectionStatus(): LocalClientPopSnapshotRollbackProtectionResolution {
    return this.#protection;
  }

  readonly refresh = (): Promise<LocalClientPopSnapshotRollbackProtectionResolution> => (
    this.#enqueue(async () => {
      this.#assertOpen();
      this.#setUnverified("protection_not_verified");
      const resolved = await resolveLocalClientPopSnapshotRollbackProtection(this.#options);
      this.#applyResolution(resolved);
      return resolved;
    })
  );

  readonly consumeOnce = (
    input: ManagedLocalClientPopReplayConsumeInput,
  ): Promise<"consumed" | "replayed" | "capacity"> => this.#enqueue(async () => {
    this.#assertOpen();
    this.#setUnverified("protection_not_verified");
    const before = await resolveLocalClientPopSnapshotRollbackProtection(this.#options);
    if (!before.snapshotRollbackProtected) {
      this.#applyResolution(before);
      throw unavailableProtectionError(before.blockers);
    }

    let result: unknown;
    try {
      result = await Reflect.apply(this.#options.checkpointPort.consumeOnce, undefined, [input]);
    } catch (error) {
      this.#setUnverified("protection_not_verified");
      throw error;
    }
    if (result !== "consumed" && result !== "replayed" && result !== "capacity") {
      this.#setUnverified("protection_not_verified");
      throw unavailableProtectionError(["protection_not_verified"]);
    }

    const after = await resolveLocalClientPopSnapshotRollbackProtection(this.#options);
    this.#applyResolution(after);
    if (!after.snapshotRollbackProtected) {
      throw unavailableProtectionError(after.blockers);
    }
    return result;
  });

  readonly close = async (): Promise<void> => {
    if (this.#closing || this.#closed) return;
    this.#closing = true;
    this.#setUnverified("closed");
    await this.#enqueue(async () => {
      if (this.#closed) return;
      const closers: Array<() => void | Promise<void>> = [];
      if (typeof this.#options.checkpointPort?.close === "function") {
        closers.push(() => Reflect.apply(this.#options.checkpointPort.close!, undefined, []));
      }
      if (typeof this.#options.anchorPort?.close === "function") {
        closers.push(() => Reflect.apply(this.#options.anchorPort.close!, undefined, []));
      }
      const results = await Promise.allSettled(closers.map((close) => close()));
      this.#closed = true;
      this.#closing = false;
      this.#setUnverified("closed");
      const failure = results.find((result) => result.status === "rejected");
      if (failure?.status === "rejected") throw failure.reason;
    }, true);
  };

  #setUnverified(blocker: LocalClientPopSnapshotRollbackBlocker): void {
    this.#protection = createResolution([blocker]);
    this.#status = unavailableReplayStatus(safeReplayStatus(this.#options?.checkpointPort));
  }

  #applyResolution(resolution: LocalClientPopSnapshotRollbackProtectionResolution): void {
    this.#protection = resolution;
    try {
      this.#status = composeManagedLocalClientPopReplayGuardStatus(
        this.#options.checkpointPort.status,
        resolution,
      );
    } catch {
      this.#setUnverified("configuration_invalid");
    }
  }

  #assertOpen(): void {
    if (this.#closing || this.#closed) {
      throw new LocalClientPopSnapshotRollbackProtectionError(
        "LOCAL_CLIENT_POP_SNAPSHOT_ROLLBACK_PROTECTION_CLOSED",
        ["closed"],
      );
    }
  }

  #enqueue<T>(operation: () => Promise<T>, allowClosing = false): Promise<T> {
    const run = this.#queue.then(async () => {
      if (!allowClosing) this.#assertOpen();
      return operation();
    });
    this.#queue = run.then(() => undefined, () => undefined);
    return run;
  }
}

export async function createLocalClientPopSnapshotRollbackProtectedReplayGuard(
  options: LocalClientPopSnapshotRollbackProtectionOptions,
): Promise<LocalClientPopSnapshotRollbackProtectedReplayGuard> {
  const guard = new LocalClientPopSnapshotRollbackProtectedReplayGuard(options);
  await guard.refresh();
  return guard;
}

function readinessBlockers(
  replay: ManagedLocalClientPopReplayGuardStatus,
  checkpoint: LocalClientPopAnchoredReplayCheckpointStatus,
  anchor: LocalClientPopExternalMonotonicAnchorStatus,
): LocalClientPopSnapshotRollbackBlocker[] {
  const blockers: LocalClientPopSnapshotRollbackBlocker[] = [];
  if (!replay.available) blockers.push("replay_guard_unavailable");
  if (!replay.durable) blockers.push("replay_guard_not_durable");
  if (replay.authenticatedReplaySet !== true) blockers.push("replay_set_not_authenticated");
  if (!checkpoint.available) blockers.push("checkpoint_port_unavailable");
  if (!checkpoint.authenticatedCheckpoint) blockers.push("checkpoint_not_authenticated");
  if (!checkpoint.monotonicGeneration) blockers.push("checkpoint_not_monotonic");
  if (
    !checkpoint.anchorsEveryMutation
    || checkpoint.mutationProtocol !== LOCAL_CLIENT_POP_ANCHORED_MUTATION_PROTOCOL
  ) blockers.push("replay_mutations_not_anchor_coupled");
  if (!checkpoint.crashConsistentRecovery) blockers.push("checkpoint_recovery_not_fail_closed");
  if (!isDigest(checkpoint.storeBindingSha256) || !isDigest(checkpoint.anchorBindingSha256)) {
    blockers.push("checkpoint_binding_invalid");
  }
  if (!anchor.available) blockers.push("protected_anchor_unavailable");
  if (!anchor.nativeDeploymentVerified || !isDigest(anchor.deploymentEvidenceSha256)) {
    blockers.push("native_anchor_deployment_unverified");
  }
  if (!anchor.monotonic) blockers.push("anchor_not_monotonic");
  if (!anchor.externalToReplayStoreSnapshot) {
    blockers.push("anchor_not_external_to_replay_snapshot");
  }
  if (!anchor.protectedFromReplayStoreWriter) {
    blockers.push("anchor_not_protected_from_replay_writer");
  }
  if (!anchor.challengeAttestation) blockers.push("anchor_challenge_attestation_unavailable");
  if (!isDigest(anchor.anchorBindingSha256)) blockers.push("anchor_binding_invalid");
  if (
    isDigest(checkpoint.anchorBindingSha256)
    && isDigest(anchor.anchorBindingSha256)
    && !safeDigestEqual(checkpoint.anchorBindingSha256, anchor.anchorBindingSha256)
  ) blockers.push("checkpoint_anchor_binding_mismatch");
  return [...new Set(blockers)];
}

function evidenceMatches(
  evidence: LocalClientPopProtectedAnchorEvidence,
  checkpoint: LocalClientPopReplayCheckpoint,
  anchor: LocalClientPopExternalMonotonicAnchorStatus,
  challengeSha256: string,
): boolean {
  return evidence.nativeDeploymentVerified === true
    && evidence.monotonic === true
    && evidence.externalToReplayStoreSnapshot === true
    && evidence.protectedFromReplayStoreWriter === true
    && evidence.attestationVerified === true
    && evidence.generation === checkpoint.generation
    && safeDigestEqual(evidence.anchorBindingSha256, checkpoint.anchorBindingSha256)
    && safeDigestEqual(evidence.anchorBindingSha256, anchor.anchorBindingSha256)
    && safeDigestEqual(evidence.storeBindingSha256, checkpoint.storeBindingSha256)
    && safeDigestEqual(evidence.checkpointDigestSha256, checkpoint.checkpointDigestSha256)
    && safeDigestEqual(evidence.challengeSha256, challengeSha256)
    && safeDigestEqual(evidence.deploymentEvidenceSha256, anchor.deploymentEvidenceSha256);
}

function checkpointMatchesStatus(
  checkpoint: LocalClientPopReplayCheckpoint,
  status: LocalClientPopAnchoredReplayCheckpointStatus,
): boolean {
  return safeDigestEqual(checkpoint.storeBindingSha256, status.storeBindingSha256)
    && safeDigestEqual(checkpoint.anchorBindingSha256, status.anchorBindingSha256);
}

function sameCheckpoint(
  left: LocalClientPopReplayCheckpoint,
  right: LocalClientPopReplayCheckpoint,
): boolean {
  return left.checkpointVersion === right.checkpointVersion
    && left.state === right.state
    && left.generation === right.generation
    && safeDigestEqual(left.storeBindingSha256, right.storeBindingSha256)
    && safeDigestEqual(left.anchorBindingSha256, right.anchorBindingSha256)
    && safeDigestEqual(left.checkpointDigestSha256, right.checkpointDigestSha256);
}

function sameCheckpointStatus(
  left: LocalClientPopAnchoredReplayCheckpointStatus,
  right: LocalClientPopAnchoredReplayCheckpointStatus,
): boolean {
  return left.available === right.available
    && left.protocolVersion === right.protocolVersion
    && safeDigestEqual(left.storeBindingSha256, right.storeBindingSha256)
    && safeDigestEqual(left.anchorBindingSha256, right.anchorBindingSha256)
    && left.authenticatedCheckpoint === right.authenticatedCheckpoint
    && left.monotonicGeneration === right.monotonicGeneration
    && left.anchorsEveryMutation === right.anchorsEveryMutation
    && left.crashConsistentRecovery === right.crashConsistentRecovery
    && left.mutationProtocol === right.mutationProtocol;
}

function sameAnchorStatus(
  left: LocalClientPopExternalMonotonicAnchorStatus,
  right: LocalClientPopExternalMonotonicAnchorStatus,
): boolean {
  return left.available === right.available
    && left.mode === right.mode
    && safeDigestEqual(left.anchorBindingSha256, right.anchorBindingSha256)
    && safeDigestEqual(left.deploymentEvidenceSha256, right.deploymentEvidenceSha256)
    && left.nativeDeploymentVerified === right.nativeDeploymentVerified
    && left.monotonic === right.monotonic
    && left.externalToReplayStoreSnapshot === right.externalToReplayStoreSnapshot
    && left.protectedFromReplayStoreWriter === right.protectedFromReplayStoreWriter
    && left.challengeAttestation === right.challengeAttestation;
}

function createResolution(
  blockers: readonly LocalClientPopSnapshotRollbackBlocker[],
  detail: Readonly<{
    checkpoint?: LocalClientPopReplayCheckpoint;
    evidence?: LocalClientPopProtectedAnchorEvidence;
    anchorMode?: string;
  }> = {},
  verified = false,
): LocalClientPopSnapshotRollbackProtectionResolution {
  const uniqueBlockers = Object.freeze([...new Set(blockers)]);
  const ready = verified && uniqueBlockers.length === 0;
  const resolution = Object.freeze({
    ready,
    snapshotRollbackProtected: ready,
    evidenceVerified: ready,
    nativeDeploymentVerified: ready,
    blockers: uniqueBlockers,
    checkpoint: detail.checkpoint ?? null,
    evidence: detail.evidence ?? null,
    anchorMode: detail.anchorMode ?? null,
    boundaries: LOCAL_CLIENT_POP_SNAPSHOT_ROLLBACK_BOUNDARIES,
  });
  if (ready) verifiedResolutionObjects.add(resolution);
  return resolution;
}

function cloneReplayStatus(
  raw: ManagedLocalClientPopReplayGuardStatus,
): ManagedLocalClientPopReplayGuardStatus {
  if (!isPlainRecord(raw)) throw new Error("invalid replay status");
  if (
    typeof raw.available !== "boolean"
    || typeof raw.durable !== "boolean"
    || typeof raw.distributed !== "boolean"
    || typeof raw.mode !== "string"
    || raw.mode.length < 1
    || raw.mode.length > 64
  ) throw new Error("invalid replay status");
  for (const key of [
    "authenticatedReplaySet",
    "snapshotRollbackProtected",
    "defensiveEnabled",
    "capacityIsolatedByScope",
  ] as const) {
    if (Object.hasOwn(raw, key) && typeof raw[key] !== "boolean") {
      throw new Error("invalid replay status");
    }
  }
  for (const key of ["maxEntries", "maxEntriesPerScope"] as const) {
    if (
      Object.hasOwn(raw, key)
      && (!Number.isSafeInteger(raw[key]) || Number(raw[key]) < 1)
    ) throw new Error("invalid replay status");
  }
  return Object.freeze({
    available: raw.available,
    durable: raw.durable,
    distributed: raw.distributed,
    mode: raw.mode,
    ...(Object.hasOwn(raw, "authenticatedReplaySet")
      ? { authenticatedReplaySet: raw.authenticatedReplaySet }
      : {}),
    ...(Object.hasOwn(raw, "snapshotRollbackProtected")
      ? { snapshotRollbackProtected: raw.snapshotRollbackProtected }
      : {}),
    ...(Object.hasOwn(raw, "defensiveEnabled")
      ? { defensiveEnabled: raw.defensiveEnabled }
      : {}),
    ...(Object.hasOwn(raw, "capacityIsolatedByScope")
      ? { capacityIsolatedByScope: raw.capacityIsolatedByScope }
      : {}),
    ...(Object.hasOwn(raw, "maxEntries") ? { maxEntries: raw.maxEntries } : {}),
    ...(Object.hasOwn(raw, "maxEntriesPerScope")
      ? { maxEntriesPerScope: raw.maxEntriesPerScope }
      : {}),
  });
}

function cloneCheckpointStatus(
  raw: LocalClientPopAnchoredReplayCheckpointStatus,
): LocalClientPopAnchoredReplayCheckpointStatus {
  if (!isPlainRecord(raw)) throw new Error("invalid checkpoint status");
  if (
    typeof raw.available !== "boolean"
    || raw.protocolVersion !== LOCAL_CLIENT_POP_REPLAY_CHECKPOINT_VERSION
    || typeof raw.authenticatedCheckpoint !== "boolean"
    || typeof raw.monotonicGeneration !== "boolean"
    || typeof raw.anchorsEveryMutation !== "boolean"
    || typeof raw.crashConsistentRecovery !== "boolean"
    || raw.mutationProtocol !== LOCAL_CLIENT_POP_ANCHORED_MUTATION_PROTOCOL
  ) throw new Error("invalid checkpoint status");
  return Object.freeze({
    available: raw.available,
    protocolVersion: raw.protocolVersion,
    storeBindingSha256: String(raw.storeBindingSha256 ?? ""),
    anchorBindingSha256: String(raw.anchorBindingSha256 ?? ""),
    authenticatedCheckpoint: raw.authenticatedCheckpoint,
    monotonicGeneration: raw.monotonicGeneration,
    anchorsEveryMutation: raw.anchorsEveryMutation,
    crashConsistentRecovery: raw.crashConsistentRecovery,
    mutationProtocol: raw.mutationProtocol,
  });
}

function cloneAnchorStatus(
  raw: LocalClientPopExternalMonotonicAnchorStatus,
): LocalClientPopExternalMonotonicAnchorStatus {
  if (!isPlainRecord(raw)) throw new Error("invalid anchor status");
  if (
    typeof raw.available !== "boolean"
    || typeof raw.mode !== "string"
    || raw.mode.length < 1
    || raw.mode.length > 64
    || typeof raw.nativeDeploymentVerified !== "boolean"
    || typeof raw.monotonic !== "boolean"
    || typeof raw.externalToReplayStoreSnapshot !== "boolean"
    || typeof raw.protectedFromReplayStoreWriter !== "boolean"
    || typeof raw.challengeAttestation !== "boolean"
  ) throw new Error("invalid anchor status");
  return Object.freeze({
    available: raw.available,
    mode: raw.mode,
    anchorBindingSha256: String(raw.anchorBindingSha256 ?? ""),
    deploymentEvidenceSha256: String(raw.deploymentEvidenceSha256 ?? ""),
    nativeDeploymentVerified: raw.nativeDeploymentVerified,
    monotonic: raw.monotonic,
    externalToReplayStoreSnapshot: raw.externalToReplayStoreSnapshot,
    protectedFromReplayStoreWriter: raw.protectedFromReplayStoreWriter,
    challengeAttestation: raw.challengeAttestation,
  });
}

function cloneCheckpoint(raw: unknown): LocalClientPopReplayCheckpoint {
  if (!isPlainRecord(raw)) throw new InvalidCheckpointError();
  if (
    raw.checkpointVersion !== LOCAL_CLIENT_POP_REPLAY_CHECKPOINT_VERSION
    || raw.state !== "ready"
    || !isDigest(raw.storeBindingSha256)
    || !isDigest(raw.anchorBindingSha256)
    || !Number.isSafeInteger(raw.generation)
    || Number(raw.generation) < 1
    || !isDigest(raw.checkpointDigestSha256)
  ) throw new InvalidCheckpointError();
  return Object.freeze({
    checkpointVersion: raw.checkpointVersion,
    state: raw.state,
    storeBindingSha256: raw.storeBindingSha256,
    anchorBindingSha256: raw.anchorBindingSha256,
    generation: Number(raw.generation),
    checkpointDigestSha256: raw.checkpointDigestSha256,
  });
}

function cloneEvidence(raw: unknown): LocalClientPopProtectedAnchorEvidence {
  if (!isPlainRecord(raw)) throw new InvalidEvidenceError();
  if (
    raw.evidenceVersion !== LOCAL_CLIENT_POP_PROTECTED_ANCHOR_EVIDENCE_VERSION
    || raw.evidenceKind !== "native-protected-external-monotonic-anchor"
    || !isDigest(raw.anchorBindingSha256)
    || !isDigest(raw.storeBindingSha256)
    || !Number.isSafeInteger(raw.generation)
    || Number(raw.generation) < 1
    || !isDigest(raw.checkpointDigestSha256)
    || !isDigest(raw.challengeSha256)
    || !isDigest(raw.deploymentEvidenceSha256)
    || raw.nativeDeploymentVerified !== true
    || raw.monotonic !== true
    || raw.externalToReplayStoreSnapshot !== true
    || raw.protectedFromReplayStoreWriter !== true
    || raw.attestationVerified !== true
  ) throw new InvalidEvidenceError();
  return Object.freeze({
    evidenceVersion: raw.evidenceVersion,
    evidenceKind: raw.evidenceKind,
    anchorBindingSha256: raw.anchorBindingSha256,
    storeBindingSha256: raw.storeBindingSha256,
    generation: Number(raw.generation),
    checkpointDigestSha256: raw.checkpointDigestSha256,
    challengeSha256: raw.challengeSha256,
    deploymentEvidenceSha256: raw.deploymentEvidenceSha256,
    nativeDeploymentVerified: true,
    monotonic: true,
    externalToReplayStoreSnapshot: true,
    protectedFromReplayStoreWriter: true,
    attestationVerified: true,
  });
}

function validOptions(raw: unknown): raw is LocalClientPopSnapshotRollbackProtectionOptions {
  if (!isPlainRecord(raw)) return false;
  if (Object.keys(raw).some((key) => !new Set([
    "checkpointPort",
    "anchorPort",
    "challengeFactory",
  ]).has(key))) return false;
  return validCheckpointPort(raw.checkpointPort)
    && validAnchorPort(raw.anchorPort)
    && (!Object.hasOwn(raw, "challengeFactory") || typeof raw.challengeFactory === "function");
}

function validCheckpointPort(raw: unknown): raw is LocalClientPopAnchoredReplayCheckpointPort {
  return (typeof raw === "object" || typeof raw === "function")
    && raw !== null
    && typeof (raw as LocalClientPopAnchoredReplayCheckpointPort).consumeOnce === "function"
    && typeof (raw as LocalClientPopAnchoredReplayCheckpointPort).readCurrentCheckpoint === "function";
}

function validAnchorPort(raw: unknown): raw is LocalClientPopExternalMonotonicAnchorPort {
  return (typeof raw === "object" || typeof raw === "function")
    && raw !== null
    && typeof (raw as LocalClientPopExternalMonotonicAnchorPort).verifyCurrent === "function";
}

function safeReplayStatus(raw: unknown): ManagedLocalClientPopReplayGuardStatus | null {
  try {
    if (!validCheckpointPort(raw)) return null;
    return cloneReplayStatus(raw.status);
  } catch {
    return null;
  }
}

function unavailableReplayStatus(
  source: ManagedLocalClientPopReplayGuardStatus | null,
): ManagedLocalClientPopReplayGuardStatus {
  return Object.freeze({
    available: false,
    durable: source?.durable === true,
    distributed: source?.distributed === true,
    mode: source?.mode ?? "snapshot-rollback-unavailable",
    authenticatedReplaySet: source?.authenticatedReplaySet === true,
    snapshotRollbackProtected: false,
    defensiveEnabled: source?.defensiveEnabled === true,
    capacityIsolatedByScope: source?.capacityIsolatedByScope === true,
    ...(Number.isSafeInteger(source?.maxEntries) ? { maxEntries: source?.maxEntries } : {}),
    ...(Number.isSafeInteger(source?.maxEntriesPerScope)
      ? { maxEntriesPerScope: source?.maxEntriesPerScope }
      : {}),
  });
}

function unavailableProtectionError(
  blockers: readonly LocalClientPopSnapshotRollbackBlocker[],
): LocalClientPopSnapshotRollbackProtectionError {
  return new LocalClientPopSnapshotRollbackProtectionError(
    "LOCAL_CLIENT_POP_SNAPSHOT_ROLLBACK_PROTECTION_UNAVAILABLE",
    blockers,
  );
}

function isDigest(value: unknown): value is string {
  return typeof value === "string" && SHA256_PATTERN.test(value);
}

function sha256(value: Uint8Array): string {
  return createHash("sha256").update(value).digest("hex");
}

function safeDigestEqual(left: unknown, right: unknown): boolean {
  if (!isDigest(left) || !isDigest(right)) return false;
  return timingSafeEqual(Buffer.from(left, "hex"), Buffer.from(right, "hex"));
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

class InvalidCheckpointError extends Error {}
class InvalidEvidenceError extends Error {}
