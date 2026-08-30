# Enterprise backup security

Enterprise backups are portable encrypted envelopes rather than plaintext JSON snapshots.
The protection is deliberately outside the request hot path and only consumes CPU and
memory when an operator creates or validates a backup.

## Security properties

- AES-256-GCM encrypts the complete tenant payload.
- A separately HKDF-derived Ed25519 key signs the authenticated manifest.
- Tenant, payload version, backup identifier, timestamp, sequence, previous digest, and
  key identifiers are authenticated metadata.
- Each tenant has a signed checkpoint in a directory separate from portable artifacts.
- Backup creation is serialized per gateway process and uses atomic private-file writes.
- Restore validation rejects plaintext legacy snapshots, wrong keys, modified metadata,
  modified ciphertext, cross-tenant artifacts, symbolic links, oversized files, invalid
  checkpoints, and sequences below the trusted rollback floor.
- Up to three previous keys can be configured during a bounded rotation window.

## Agent Governance consistency export

When Agent Governance is enabled, a backup created by the configured platform
tenant includes an encrypted, verify-only consistency summary. It covers the
central Registry, Policy Catalog, approvals, usage counters, central governance
audit, per-Agent bundles, and the signed state heads. Only record/file counts,
byte counts, and SHA-256 aggregate digests enter the already encrypted enterprise
payload; no Agent record, approval ciphertext, audit event, policy body, path, or
identifier is copied into the summary.

The exporter performs a governance startup/integrity probe, deeply verifies
every Registry Agent's record, policy delta, effective policy and Manifest HMAC, reads every supported
component, repeats the integrity probe, and reads everything again. Both aggregate
digests must match. An active generation, activation, state-write journal,
non-empty bundle staging directory, unsafe link, incomplete registered bundle,
or concurrent change makes backup creation fail closed and requires an operator
retry after mutations drain.

The SQLite Agent Registry is never copied from its live database file and the
exporter never reads SQLite `-wal` or `-shm` bytes. It uses the Registry's logical
query API for each pass, which gives a transactionally consistent SQLite SELECT
snapshot. PostgreSQL Registry mode uses the same bounded logical-query summary
and never exports connection strings or physical database bytes. JSON Registry mode reads the anchored regular file using bounded,
no-link file-handle checks. Both modes remain single-host evidence; this is not a
distributed backup transaction.

The following are always excluded:

- `secret.key` and all HMAC/encryption key material;
- `owner.lease.json`, PID/fingerprint/owner metadata, and legacy owner files;
- generation, activation, and state-write WAL/journal contents;
- bundle staging/temp files;
- raw SQLite database, WAL, and shared-memory files.

Non-platform tenant backups contain only an authenticated marker that governance
export requires the platform tenant; they never receive a global governance
digest. Restore validation checks the summary schema and aggregate digest, but
reports `restoreMode=verify-only`, `restorable=false`, and `mutation=none`.
There is deliberately no automatic Agent Governance restore in this slice, so
backup creation and restore validation report warning rather than ready whenever
governance evidence is included.

## Required configuration

Configure one dedicated 32-byte backup key. Do not reuse provider or runtime credential
keys.

```text
PME_ENTERPRISE_BACKUP_MASTER_KEY=base64:<canonical-32-byte-base64>
```

Use `PME_ENTERPRISE_BACKUP_MASTER_KEY_FILE` instead when the deployment can mount a
private secret file. Configuring both forms is rejected. On POSIX, the key file must not
be accessible to group or other users.

Optional settings:

```text
PME_ENTERPRISE_BACKUP_DIR=.data/enterprise/backups
PME_ENTERPRISE_BACKUP_CHECKPOINT_DIR=.data/enterprise/backup-checkpoints
PME_ENTERPRISE_BACKUP_PREVIOUS_MASTER_KEYS=<old-key-1>,<old-key-2>
PME_ENTERPRISE_BACKUP_MIN_RESTORE_SEQUENCE=42
PME_ENTERPRISE_BACKUP_TRUSTED_CHECKPOINT_DIGEST=<sha256-of-sequence-42-artifact>
```

The checkpoint directory is not part of the portable artifact bundle. Give it a separate
durable mount and stricter write permissions. For cross-host recovery, provision the
minimum sequence and optional digest from an external trusted configuration source before
validating imported artifacts.

## Rotation procedure

1. Set the new key as `PME_ENTERPRISE_BACKUP_MASTER_KEY`.
2. Put the immediately previous key in `PME_ENTERPRISE_BACKUP_PREVIOUS_MASTER_KEYS`.
3. Restart the gateway and create a new backup. The new artifact and checkpoint use the
   new key while old artifacts remain verifiable during the bounded window.
4. Complete restore drills and retire old keys after the retention period.

## Remaining trust boundary

A local signed checkpoint detects tampering but cannot defeat an attacker who can restore
the entire host, including an older valid checkpoint. Production anti-rollback therefore
requires `PME_ENTERPRISE_BACKUP_MIN_RESTORE_SEQUENCE` to come from an external monotonic
or immutable control plane. This module validates artifacts only; it does not perform a
destructive data restore.

The envelope contains tenant-facing enterprise users, a bounded audit export, readiness,
knowledge-health metadata, and—when authorized—the Agent Governance consistency summary
described above. It does **not** contain restorable Agent Governance state bytes or the central PostgreSQL tables used
for idempotency, Provider dispatch, external-effect tombstones, usage, A2A, Workforce, or
the canonical audit chain. Back up and restore those schemas with a database-native
procedure. The repository's disposable [PostgreSQL logical recovery drill](./postgresql-recovery-drill.md)
proves a bounded CI fixture only; it is not production RTO/RPO or automatic-failover
evidence.

## Language Selection

The cryptographic boundary is TypeScript because typed envelope shapes, exhaustive
metadata binding, and direct testability are more valuable than introducing a separate
service. Existing JavaScript orchestration receives a narrow integration. Rust or Go
would add deployment, FFI, and rollback cost without improving the low-frequency workload
enough to justify a sidecar. The on-disk JSON envelope remains implementation-neutral.
