import { createHash } from "node:crypto";

import { describe, expect, it } from "vitest";

import type {
  ManagedLocalClientPopReplayConsumeInput,
  ManagedLocalClientPopReplayGuardStatus,
} from "./localClientPopIdentityAuthority.ts";
import { LOCAL_CLIENT_SQLITE_POP_REPLAY_BOUNDARIES } from "./localClientSqlitePopReplayGuard.ts";
import { LOCAL_CLIENT_WINDOWS_AUTHORITY_BROKER_BOUNDARIES } from "./localClientWindowsAuthorityBrokerService.ts";
import {
  LOCAL_CLIENT_POP_ANCHORED_MUTATION_PROTOCOL,
  LOCAL_CLIENT_POP_PROTECTED_ANCHOR_EVIDENCE_VERSION,
  LOCAL_CLIENT_POP_REPLAY_CHECKPOINT_VERSION,
  LOCAL_CLIENT_POP_SNAPSHOT_ROLLBACK_BOUNDARIES,
  LOCAL_CLIENT_POP_SNAPSHOT_ROLLBACK_NATIVE_DEPLOYMENT_BLOCKERS,
  composeManagedLocalClientPopReplayGuardStatus,
  createLocalClientPopSnapshotRollbackProtectedReplayGuard,
  resolveLocalClientPopSnapshotRollbackProtection,
  type LocalClientPopAnchoredReplayCheckpointPort,
  type LocalClientPopAnchoredReplayCheckpointStatus,
  type LocalClientPopExternalMonotonicAnchorPort,
  type LocalClientPopExternalMonotonicAnchorStatus,
  type LocalClientPopProtectedAnchorEvidence,
  type LocalClientPopReplayCheckpoint,
  type LocalClientPopSnapshotRollbackProtectionResolution,
} from "./localClientPopSnapshotRollbackProtection.ts";

const STORE_BINDING = "1".repeat(64);
const ANCHOR_BINDING = "2".repeat(64);
const DEPLOYMENT_EVIDENCE = "3".repeat(64);
const CHECKPOINT_ONE = "4".repeat(64);
const CHECKPOINT_TWO = "5".repeat(64);

describe("managed-client PoP snapshot rollback protection", () => {
  it("keeps the current SQLite and Windows broker implementation boundary explicitly blocked", () => {
    expect(LOCAL_CLIENT_SQLITE_POP_REPLAY_BOUNDARIES.snapshotRollbackProtected).toBe(false);
    expect(LOCAL_CLIENT_WINDOWS_AUTHORITY_BROKER_BOUNDARIES).toMatchObject({
      nativeWindowsAdapterImplemented: false,
      brokerTransportImplemented: false,
      provisionerImplemented: false,
      integrityKeyProvisioningImplemented: false,
    });
    expect(LOCAL_CLIENT_POP_SNAPSHOT_ROLLBACK_BOUNDARIES).toMatchObject({
      mutatesOperatingSystem: false,
      provisionsNativeAuthority: false,
      statusBooleanAloneIsEvidence: false,
      everyReplayMutationMustAdvanceAnchor: true,
    });
    expect(LOCAL_CLIENT_POP_SNAPSHOT_ROLLBACK_NATIVE_DEPLOYMENT_BLOCKERS).toEqual([
      "sqlite_pop_replay_generation_not_implemented",
      "sqlite_pop_replay_durable_intent_not_implemented",
      "sqlite_pop_replay_anchor_commit_coordinator_not_implemented",
      "windows_authority_native_adapter_not_implemented",
      "windows_authority_broker_transport_not_implemented",
      "windows_authority_provisioner_not_implemented",
      "windows_authority_protected_key_provisioning_not_implemented",
      "windows_authority_pop_checkpoint_evidence_adapter_not_implemented",
      "gateway_protected_anchor_async_preflight_not_implemented",
    ]);
  });

  it("does not upgrade durable SQLite status without per-mutation anchor coupling", async () => {
    const checkpointPort = new FixtureCheckpointPort();
    checkpointPort.checkpointStatus = Object.freeze({
      ...checkpointPort.checkpointStatus,
      anchorsEveryMutation: false,
      crashConsistentRecovery: false,
    });
    const anchorPort = new FixtureAnchorPort();

    const resolved = await resolveLocalClientPopSnapshotRollbackProtection({
      checkpointPort,
      anchorPort,
      challengeFactory: fixedChallenge,
    });

    expect(resolved).toMatchObject({
      ready: false,
      snapshotRollbackProtected: false,
      evidenceVerified: false,
      blockers: [
        "replay_mutations_not_anchor_coupled",
        "checkpoint_recovery_not_fail_closed",
      ],
    });
    expect(checkpointPort.readCount).toBe(0);
    expect(anchorPort.verifyCount).toBe(0);
  });

  it("requires independently verified native deployment evidence", async () => {
    const checkpointPort = new FixtureCheckpointPort();
    const anchorPort = new FixtureAnchorPort();
    anchorPort.status = Object.freeze({
      ...anchorPort.status,
      nativeDeploymentVerified: false,
    });

    const resolved = await resolveLocalClientPopSnapshotRollbackProtection({
      checkpointPort,
      anchorPort,
      challengeFactory: fixedChallenge,
    });

    expect(resolved.blockers).toEqual(["native_anchor_deployment_unverified"]);
    expect(resolved.snapshotRollbackProtected).toBe(false);
    expect(anchorPort.verifyCount).toBe(0);
  });

  it("accepts fresh evidence bound to stable before/after replay checkpoints", async () => {
    const checkpointPort = new FixtureCheckpointPort();
    const anchorPort = new FixtureAnchorPort();

    const resolved = await resolveLocalClientPopSnapshotRollbackProtection({
      checkpointPort,
      anchorPort,
      challengeFactory: fixedChallenge,
    });

    expect(resolved).toMatchObject({
      ready: true,
      snapshotRollbackProtected: true,
      evidenceVerified: true,
      nativeDeploymentVerified: true,
      blockers: [],
      checkpoint: { generation: 1, checkpointDigestSha256: CHECKPOINT_ONE },
      evidence: {
        evidenceKind: "native-protected-external-monotonic-anchor",
        attestationVerified: true,
      },
    });
    expect(checkpointPort.readCount).toBe(2);
    expect(anchorPort.verifyCount).toBe(1);
    expect(composeManagedLocalClientPopReplayGuardStatus(checkpointPort.status, resolved)).toEqual({
      available: true,
      durable: true,
      distributed: false,
      mode: "fixture-anchored-sqlite",
      authenticatedReplaySet: true,
      snapshotRollbackProtected: true,
      defensiveEnabled: true,
    });
  });

  it("does not trust a lookalike resolution or a pre-set status boolean", async () => {
    const checkpointPort = new FixtureCheckpointPort();
    const anchorPort = new FixtureAnchorPort();
    const resolved = await resolveLocalClientPopSnapshotRollbackProtection({
      checkpointPort,
      anchorPort,
      challengeFactory: fixedChallenge,
    });
    const fabricated = Object.freeze({ ...resolved }) as LocalClientPopSnapshotRollbackProtectionResolution;
    const preSet = Object.freeze({
      ...checkpointPort.status,
      snapshotRollbackProtected: true,
    });

    expect(composeManagedLocalClientPopReplayGuardStatus(preSet, fabricated)).toMatchObject({
      available: false,
      snapshotRollbackProtected: false,
    });
  });

  it("rejects evidence that is not bound to the fresh challenge", async () => {
    const checkpointPort = new FixtureCheckpointPort();
    const anchorPort = new FixtureAnchorPort();
    anchorPort.evidenceTransform = (evidence) => Object.freeze({
      ...evidence,
      challengeSha256: "f".repeat(64),
    });

    const resolved = await resolveLocalClientPopSnapshotRollbackProtection({
      checkpointPort,
      anchorPort,
      challengeFactory: fixedChallenge,
    });

    expect(resolved).toMatchObject({
      snapshotRollbackProtected: false,
      blockers: ["protected_anchor_evidence_invalid"],
    });
  });

  it("rejects a replay checkpoint changed during anchor attestation", async () => {
    const checkpointPort = new FixtureCheckpointPort();
    checkpointPort.changeOnSecondRead = true;
    const anchorPort = new FixtureAnchorPort();

    const resolved = await resolveLocalClientPopSnapshotRollbackProtection({
      checkpointPort,
      anchorPort,
      challengeFactory: fixedChallenge,
    });

    expect(resolved).toMatchObject({
      snapshotRollbackProtected: false,
      blockers: ["checkpoint_changed_during_attestation"],
      checkpoint: { generation: 2, checkpointDigestSha256: CHECKPOINT_TWO },
    });
  });

  it("re-attests before and after every operational replay consume", async () => {
    const checkpointPort = new FixtureCheckpointPort();
    checkpointPort.advanceOnConsume = true;
    const anchorPort = new FixtureAnchorPort();
    const guard = await createLocalClientPopSnapshotRollbackProtectedReplayGuard({
      checkpointPort,
      anchorPort,
      challengeFactory: fixedChallenge,
    });

    await expect(guard.consumeOnce(consumeInput())).resolves.toBe("consumed");

    expect(checkpointPort.consumeCount).toBe(1);
    expect(anchorPort.verifyCount).toBe(3);
    expect(guard.status).toMatchObject({
      available: true,
      snapshotRollbackProtected: true,
    });
    await guard.close();
  });

  it("suppresses a consumed admission and fails closed when post-attestation fails", async () => {
    const checkpointPort = new FixtureCheckpointPort();
    checkpointPort.advanceOnConsume = true;
    const anchorPort = new FixtureAnchorPort();
    anchorPort.failAtVerification = 3;
    const guard = await createLocalClientPopSnapshotRollbackProtectedReplayGuard({
      checkpointPort,
      anchorPort,
      challengeFactory: fixedChallenge,
    });

    await expect(guard.consumeOnce(consumeInput())).rejects.toMatchObject({
      code: "LOCAL_CLIENT_POP_SNAPSHOT_ROLLBACK_PROTECTION_UNAVAILABLE",
      blockers: ["protected_anchor_evidence_unavailable"],
    });
    expect(checkpointPort.consumeCount).toBe(1);
    expect(guard.status).toMatchObject({
      available: false,
      snapshotRollbackProtected: false,
    });
    await guard.close();
  });
});

class FixtureCheckpointPort implements LocalClientPopAnchoredReplayCheckpointPort {
  readonly status: ManagedLocalClientPopReplayGuardStatus = Object.freeze({
    available: true,
    durable: true,
    distributed: false,
    mode: "fixture-anchored-sqlite",
    authenticatedReplaySet: true,
    snapshotRollbackProtected: false,
    defensiveEnabled: true,
  });

  checkpointStatus: LocalClientPopAnchoredReplayCheckpointStatus = Object.freeze({
    available: true,
    protocolVersion: LOCAL_CLIENT_POP_REPLAY_CHECKPOINT_VERSION,
    storeBindingSha256: STORE_BINDING,
    anchorBindingSha256: ANCHOR_BINDING,
    authenticatedCheckpoint: true,
    monotonicGeneration: true,
    anchorsEveryMutation: true,
    crashConsistentRecovery: true,
    mutationProtocol: LOCAL_CLIENT_POP_ANCHORED_MUTATION_PROTOCOL,
  });

  checkpoint: LocalClientPopReplayCheckpoint = createCheckpoint(1, CHECKPOINT_ONE);
  readCount = 0;
  consumeCount = 0;
  changeOnSecondRead = false;
  advanceOnConsume = false;

  readonly readCurrentCheckpoint = async (): Promise<LocalClientPopReplayCheckpoint> => {
    this.readCount += 1;
    if (this.changeOnSecondRead && this.readCount === 2) {
      this.checkpoint = createCheckpoint(2, CHECKPOINT_TWO);
    }
    return this.checkpoint;
  };

  readonly consumeOnce = async (
    _input: ManagedLocalClientPopReplayConsumeInput,
  ): Promise<"consumed"> => {
    this.consumeCount += 1;
    if (this.advanceOnConsume) this.checkpoint = createCheckpoint(2, CHECKPOINT_TWO);
    return "consumed";
  };

  readonly close = (): void => undefined;
}

class FixtureAnchorPort implements LocalClientPopExternalMonotonicAnchorPort {
  status: LocalClientPopExternalMonotonicAnchorStatus = Object.freeze({
    available: true,
    mode: "fixture-native-protected-anchor",
    anchorBindingSha256: ANCHOR_BINDING,
    deploymentEvidenceSha256: DEPLOYMENT_EVIDENCE,
    nativeDeploymentVerified: true,
    monotonic: true,
    externalToReplayStoreSnapshot: true,
    protectedFromReplayStoreWriter: true,
    challengeAttestation: true,
  });

  verifyCount = 0;
  failAtVerification: number | null = null;
  evidenceTransform: (
    evidence: LocalClientPopProtectedAnchorEvidence,
  ) => LocalClientPopProtectedAnchorEvidence = (evidence) => evidence;

  readonly verifyCurrent = async (input: Readonly<{
    checkpoint: LocalClientPopReplayCheckpoint;
    challenge: Uint8Array;
  }>): Promise<LocalClientPopProtectedAnchorEvidence> => {
    this.verifyCount += 1;
    if (this.verifyCount === this.failAtVerification) throw new Error("fixture anchor unavailable");
    const evidence = Object.freeze({
      evidenceVersion: LOCAL_CLIENT_POP_PROTECTED_ANCHOR_EVIDENCE_VERSION,
      evidenceKind: "native-protected-external-monotonic-anchor" as const,
      anchorBindingSha256: input.checkpoint.anchorBindingSha256,
      storeBindingSha256: input.checkpoint.storeBindingSha256,
      generation: input.checkpoint.generation,
      checkpointDigestSha256: input.checkpoint.checkpointDigestSha256,
      challengeSha256: createHash("sha256").update(input.challenge).digest("hex"),
      deploymentEvidenceSha256: DEPLOYMENT_EVIDENCE,
      nativeDeploymentVerified: true as const,
      monotonic: true as const,
      externalToReplayStoreSnapshot: true as const,
      protectedFromReplayStoreWriter: true as const,
      attestationVerified: true as const,
    });
    return this.evidenceTransform(evidence);
  };

  readonly close = (): void => undefined;
}

function createCheckpoint(
  generation: number,
  checkpointDigestSha256: string,
): LocalClientPopReplayCheckpoint {
  return Object.freeze({
    checkpointVersion: LOCAL_CLIENT_POP_REPLAY_CHECKPOINT_VERSION,
    state: "ready" as const,
    storeBindingSha256: STORE_BINDING,
    anchorBindingSha256: ANCHOR_BINDING,
    generation,
    checkpointDigestSha256,
  });
}

function fixedChallenge(): Buffer {
  return Buffer.alloc(32, 0x7a);
}

function consumeInput(): ManagedLocalClientPopReplayConsumeInput {
  return Object.freeze({
    replayKeySha256: "a".repeat(64),
    replayScopeSha256: "b".repeat(64),
    expiresAtMs: 2_000,
    nowMs: 1_000,
  });
}
