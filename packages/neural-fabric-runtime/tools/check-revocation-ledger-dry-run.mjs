import {
  createRevocationLedger,
  evaluateRevocationCandidate,
  runRevocationLedgerDryRun,
} from "../src/index.js";

const result = runRevocationLedgerDryRun();

const ledger = createRevocationLedger({
  policySnapshot: {
    policyId: "phase1311.policy",
    epochId: "epoch-2",
    sequence: 2,
    revokedOps: ["phase1311.revoked-op"],
    published: false,
  },
});

const appendResult = ledger.appendRevocation({
  opId: "phase1311.revoked-op",
  epochId: "epoch-2",
  sequence: 2,
  reason: "safety_boundary_violation",
});

const accepted = evaluateRevocationCandidate({
  ledger,
  opId: "phase1311.allowed-op",
  epochId: "epoch-2",
  sequence: 2,
});

const checks = [
  ["exports_create_revocation_ledger", typeof createRevocationLedger === "function"],
  ["exports_evaluate_revocation_candidate", typeof evaluateRevocationCandidate === "function"],
  ["exports_run_revocation_ledger_dry_run", typeof runRevocationLedgerDryRun === "function"],
  ["revoked_op_rejected", result.revokedOpRejected === true],
  ["old_epoch_rejected", result.oldEpochRejected === true],
  ["policy_snapshot_recorded", result.policySnapshotRecorded === true],
  ["no_secret_used", result.noSecretUsed === true],
  ["network_used_false", result.networkUsed === false],
  ["ledger_published_false", result.ledgerPublished === false],
  ["append_only_sequence", appendResult.entry.sequence === 1],
  ["append_only_entries_frozen", Object.isFrozen(ledger.entries)],
  ["non_revoked_current_epoch_allowed", accepted.allowed === true],
];

const failed = checks.filter(([, passed]) => passed !== true);
if (failed.length > 0) {
  console.error(JSON.stringify({
    status: "failed",
    failed: failed.map(([id]) => id),
  }, null, 2));
  process.exitCode = 1;
} else {
  console.log(JSON.stringify({
    status: "passed",
    phase: "Phase1311A",
    revokedOpRejected: result.revokedOpRejected,
    oldEpochRejected: result.oldEpochRejected,
    policySnapshotRecorded: result.policySnapshotRecorded,
    noSecretUsed: result.noSecretUsed,
  }, null, 2));
}
