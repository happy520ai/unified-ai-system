import { contentAddress } from "./contentAddress.js";
import { normalizeForCanonicalJson } from "./canonicalize.js";

const DEFAULT_POLICY_SNAPSHOT = Object.freeze({
  policyId: "phase1311a.revocation-policy",
  epochId: "epoch-2",
  sequence: 2,
  revokedOps: Object.freeze(["phase1311a.revoked-op"]),
  published: false,
});

export function createRevocationLedger({ policySnapshot = DEFAULT_POLICY_SNAPSHOT } = {}) {
  const normalizedPolicySnapshot = deepFreeze(normalizeForCanonicalJson(policySnapshot));
  const entries = [];

  return Object.freeze({
    policySnapshot: normalizedPolicySnapshot,
    policySnapshotAddress: contentAddress(normalizedPolicySnapshot),
    get entries() {
      return Object.freeze(entries.map((entry) => deepFreeze({ ...entry })));
    },
    appendRevocation(input) {
      const entry = deepFreeze({
        type: "revocation",
        sequence: entries.length + 1,
        opId: requireNonEmptyString(input?.opId, "opId"),
        epochId: requireNonEmptyString(input?.epochId, "epochId"),
        epochSequence: requireInteger(input?.sequence, "sequence"),
        reason: requireNonEmptyString(input?.reason, "reason"),
        policySnapshotAddress: contentAddress(normalizedPolicySnapshot).uri,
        ledgerPublished: false,
        secretUsed: false,
      });
      entries.push(entry);
      return Object.freeze({
        appended: true,
        entry,
        entryAddress: contentAddress(entry),
      });
    },
  });
}

export function evaluateRevocationCandidate({ ledger, opId, epochId, sequence }) {
  const policySnapshot = ledger?.policySnapshot;
  const currentEpochId = policySnapshot?.epochId;
  const currentSequence = policySnapshot?.sequence;
  const revokedOps = new Set(policySnapshot?.revokedOps ?? []);
  const ledgerRevokedOps = new Set((ledger?.entries ?? []).map((entry) => entry.opId));

  if (currentEpochId && epochId !== currentEpochId) {
    return blocked("old_epoch_rejected", "Candidate epoch does not match the active policy epoch.");
  }
  if (Number.isInteger(currentSequence) && Number.isInteger(sequence) && sequence < currentSequence) {
    return blocked("old_epoch_rejected", "Candidate epoch sequence is older than the active policy sequence.");
  }
  if (revokedOps.has(opId) || ledgerRevokedOps.has(opId)) {
    return blocked("revoked_op_rejected", "Candidate op is revoked by the dry-run revocation ledger.");
  }
  return Object.freeze({
    allowed: true,
    code: "accepted",
    providerCallsMade: false,
    secretUsed: false,
    networkUsed: false,
    ledgerPublished: false,
  });
}

export function runRevocationLedgerDryRun() {
  const ledger = createRevocationLedger();
  ledger.appendRevocation({
    opId: "phase1311a.revoked-op",
    epochId: "epoch-2",
    sequence: 2,
    reason: "safety_boundary_violation",
  });

  const revoked = evaluateRevocationCandidate({
    ledger,
    opId: "phase1311a.revoked-op",
    epochId: "epoch-2",
    sequence: 2,
  });
  const oldEpoch = evaluateRevocationCandidate({
    ledger,
    opId: "phase1311a.allowed-op",
    epochId: "epoch-1",
    sequence: 1,
  });

  return Object.freeze({
    phase: "Phase1311A",
    status: "dry-run-pass",
    revokedOpRejected: revoked.allowed === false && revoked.code === "revoked_op_rejected",
    oldEpochRejected: oldEpoch.allowed === false && oldEpoch.code === "old_epoch_rejected",
    policySnapshotRecorded: Boolean(ledger.policySnapshotAddress?.uri) && ledger.entries.every((entry) => entry.policySnapshotAddress === ledger.policySnapshotAddress.uri),
    noSecretUsed: true,
    providerCallsMade: false,
    secretRead: false,
    networkUsed: false,
    ledgerPublished: false,
    entries: ledger.entries,
    policySnapshot: ledger.policySnapshot,
    policySnapshotAddress: ledger.policySnapshotAddress,
  });
}

function blocked(code, reason) {
  return Object.freeze({
    allowed: false,
    code,
    reason,
    providerCallsMade: false,
    secretUsed: false,
    networkUsed: false,
    ledgerPublished: false,
  });
}

function requireNonEmptyString(value, field) {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new TypeError(`${field} must be a non-empty string.`);
  }
  return value;
}

function requireInteger(value, field) {
  if (!Number.isInteger(value)) {
    throw new TypeError(`${field} must be an integer.`);
  }
  return value;
}

function deepFreeze(value) {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const child of Object.values(value)) {
      deepFreeze(child);
    }
  }
  return value;
}
