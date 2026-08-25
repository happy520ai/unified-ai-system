import { readFile, stat } from "node:fs/promises";
import { resolve } from "node:path";

const MAX_EVIDENCE_BYTES = 1024 * 1024;
const evidencePath = resolve(process.argv[2] ?? ".tmp/postgres-recovery-drill.json");
const evidenceStat = await stat(evidencePath);
if (!evidenceStat.isFile() || evidenceStat.size <= 0 || evidenceStat.size > MAX_EVIDENCE_BYTES) {
  throw new Error("PostgreSQL recovery evidence file type or size is invalid.");
}

const text = await readFile(evidencePath, "utf8");
const evidence = JSON.parse(text);
const failures = [];
const requireTrue = (condition, code) => {
  if (condition !== true) failures.push(code);
};

requireTrue(evidence.status === "recovered", "status_not_recovered");
requireTrue(evidence.realProviderCallsMade === false, "real_provider_call_boundary_missing");
requireTrue(evidence.applicationChecks?.all === true, "initial_application_checks_failed");
requireTrue(evidence.failoverChecks?.all === true, "failover_application_checks_failed");
requireTrue(evidence.restartChecks?.all === true, "restart_application_checks_failed");
requireTrue(evidence.databaseInventory?.exactRestoreMatch === true, "logical_restore_mismatch");
requireTrue(evidence.databaseInventory?.standbyExactMatch === true, "standby_inventory_mismatch");

requireTrue(
  evidence.networkPartition?.singleBridgePartitionFenceProved === true
    && evidence.networkPartition?.primaryWritableWhilePartitioned === true
    && evidence.networkPartition?.markerAbsentWhilePartitioned === true
    && evidence.networkPartition?.markerReplayedAfterHeal === true,
  "single_bridge_partition_evidence_missing",
);
requireTrue(
  evidence.oldPrimaryRejoin?.safeOldPrimaryRejoinProved === true
    && evidence.oldPrimaryRejoin?.oldPrimaryRestartedBeforeRewind === false
    && evidence.oldPrimaryRejoin?.rejoinedInRecovery === true
    && evidence.oldPrimaryRejoin?.markerReplayedAfterPromotedPrimaryRestart === true
    && evidence.oldPrimaryRejoin?.inventoryExactMatch === true,
  "old_primary_rejoin_evidence_missing",
);

const pitr = evidence.pointInTimeRecovery ?? {};
requireTrue(
  pitr.pointInTimeRecoveryProved === true
    && pitr.boundedContinuousWalArchiveProved === true
    && pitr.backupManifestVerified === true
    && pitr.baseBackupWalRemovedBeforeRecovery === true
    && pitr.restoreCommandArchiveOnly === true
    && pitr.streamingRecoveryConfigured === false
    && pitr.includedMarkerPresent === true
    && pitr.excludedMarkerPresent === false
    && pitr.inventoryExactMatch === true
    && pitr.applicationChecks?.all === true
    && pitr.archiveFailuresObserved === 0
    && pitr.archiveFileNonEmpty === true,
  "pitr_evidence_missing",
);

try {
  const included = parsePgLsn(pitr.includedMarkerWalLsn);
  const target = parsePgLsn(pitr.restorePointLsn);
  const replay = parsePgLsn(pitr.replayLsn);
  const excluded = parsePgLsn(pitr.excludedMarkerWalLsn);
  requireTrue(included <= target && target <= replay && replay < excluded, "pitr_lsn_order_invalid");
} catch {
  failures.push("pitr_lsn_invalid");
}

requireTrue(evidence.boundaries?.boundedWalArchivePitrProved === true, "pitr_boundary_missing");
requireTrue(evidence.boundaries?.safeOldPrimaryRejoinProved === true, "rejoin_boundary_missing");
requireTrue(evidence.boundaries?.splitBrainProved === false, "split_brain_boundary_inflated");
requireTrue(evidence.boundaries?.productionRtoRpoProved === false, "production_rto_rpo_boundary_inflated");
requireTrue(
  evidence.cleanup?.complete === true
    && evidence.cleanup?.containersRemaining === 0
    && evidence.cleanup?.volumesRemaining === 0
    && evidence.cleanup?.networksRemaining === 0
    && evidence.cleanup?.artifactRetained === false
    && evidence.cleanup?.walArchiveRetained === false,
  "cleanup_incomplete",
);
requireTrue(
  !/postgres(?:ql)?:\/\//i.test(text)
    && !/POSTGRES_PASSWORD=/i.test(text),
  "credential_material_exposed",
);

if (failures.length > 0) {
  process.stderr.write(`PostgreSQL recovery evidence verification failed: ${failures.join(", ")}\n`);
  process.exitCode = 1;
} else {
  process.stdout.write(`${JSON.stringify({
    status: "passed",
    applicationContracts: 8,
    partitionFence: true,
    oldPrimaryRejoin: true,
    lsnPointInTimeRecovery: true,
    realProviderCallsMade: false,
    cleanupComplete: true,
  })}\n`);
}

function parsePgLsn(value) {
  const match = String(value ?? "").match(/^([0-9A-F]+)\/([0-9A-F]+)$/i);
  if (!match) throw new Error("invalid LSN");
  return (BigInt(`0x${match[1]}`) << 32n) + BigInt(`0x${match[2]}`);
}
