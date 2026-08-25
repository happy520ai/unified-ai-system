# PostgreSQL logical recovery drill

The repository includes a credential-free destructive drill for the gateway's
central PostgreSQL state:

```bash
pnpm drill:postgres-recovery -- --json --output .tmp/postgres-recovery-drill.json
```

The drill needs a working Docker engine. It does not read `.env`, provider
credentials, or production database URLs. It creates a random test-only
password in a private temporary environment file, binds each database only to a
random loopback port, and removes both containers, both named volumes, and the
logical-backup artifact before returning.

## What the drill does

1. Starts a disposable PostgreSQL 17 source database on loopback.
2. Seeds eight central-state contracts through the same application APIs used
   by the gateway:
   - response idempotency and replay;
   - real-provider dispatch tombstones, using only the fake-provider identity;
   - irreversible external-effect tombstones, without sending an effect;
   - usage-ledger lifecycle and accounting;
   - the HMAC-protected enterprise audit chain;
   - an A2A task;
   - a Workforce claim and fencing token;
   - a Workforce execution lifecycle.
3. Records an exact table/row/sequence inventory and creates a custom-format
   `pg_dump` artifact.
4. Deletes the source container and its data volume before recovery begins.
5. Starts a clean PostgreSQL 17 database and restores the artifact with
   `pg_restore --exit-on-error`.
6. Requires an exact inventory digest match and verifies all eight contracts
   through fresh application clients.
7. Keeps the same eight application clients and connection pools open, restarts
   the recovery database on a stable loopback endpoint, and verifies all eight
   contracts again without constructing replacement clients.
8. Removes every disposable resource. A cleanup failure makes the drill fail.

CI runs the same command after the real PostgreSQL integration suite. The JSON
result is retained with the quality artifacts, while the temporary database
backup itself is deliberately not retained.

## Evidence interpretation

A passing result proves a bounded logical snapshot can recover the covered
gateway schemas into a clean PostgreSQL 17 instance, that the recovered rows
remain application-readable, and that the same in-process application pools can
reconnect after a database restart. The reported `controlledRecoveryTimeMs` is
only the wall clock of this disposable fixture; it is not a production RTO.

The drill does **not** prove:

- continuous WAL archiving or point-in-time recovery;
- synchronous replication, automatic leader election, or transparent
  connection failover;
- network-partition or split-brain safety;
- object-lock/WORM retention or independent backup custody;
- production data volume, encryption-at-rest, certificate rotation, RPO, or
  RTO;
- end-to-end exactly-once behavior in a remote Provider or other external
  system.

Those remain deployment-specific E4 evidence. A production program should add
managed backup retention, independently stored restore points, continuous WAL
or an equivalent mechanism, a separate recovery account and environment,
certificate-verified connections, destructive restore rehearsals, failover and
partition injection, measured recovery objectives, and operator sign-off.

## Failure handling

The command returns non-zero unless `status` is `recovered`. It emits bounded,
redacted diagnostics and never prints a database URL or test password. A failed
application contract is named in `failedChecks`. Container-local readiness and
the real loopback SQL path are checked separately so an early `pg_isready`
result cannot be mistaken for client reachability.

Use the dry run to inspect the plan without starting Docker:

```bash
pnpm drill:postgres-recovery:dry-run
```

Do not modify this tool to point at a production database. Production restore
automation requires an independently reviewed change window, exact source and
target identities, backup custody, rollback, and destructive-action approval.

## Enterprise envelope boundary

The gateway's [enterprise backup envelope](./enterprise-backup-security.md)
protects a portable tenant-facing metadata export and validates restore
eligibility. It does not dump or mutate the central PostgreSQL schemas. The two
mechanisms are complementary and must not be described as substitutes.

## Language Selection

The orchestrator remains Node.js ESM because it composes existing TypeScript
gateway contracts and the Docker CLI from the repository's established
`tools/*.mjs` boundary. The production state implementations remain TypeScript.
The backup artifact is PostgreSQL's implementation-neutral custom format. A new
runtime service or language would add deployment and rollback cost without
improving this bounded CI workload.
