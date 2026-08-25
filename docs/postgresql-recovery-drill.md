# PostgreSQL logical recovery drill

The repository includes a credential-free destructive drill for the gateway's
central PostgreSQL state:

```bash
pnpm drill:postgres-recovery -- --json --output .tmp/postgres-recovery-drill.json
```

The drill needs a working Docker engine. It does not read `.env`, provider
credentials, or production database URLs. It creates a random test-only
password in a private temporary environment file, binds each database only to a
preallocated loopback port, and removes every client, proxy, container, named
volume, Docker network, credential file, and logical-backup artifact before
returning.

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
7. Enables WAL senders on recovery and limits one `scram-sha-256` replication
   HBA rule to the exact disposable Docker-network CIDR. `pg_basebackup -R`
   builds a real streaming standby in a separate volume.
8. Writes a marker after the base backup. The standby must report
   `pg_is_in_recovery()=true`, replay that marker, expose a replay LSN, and
   retain the same gateway inventory digest.
9. Keeps the same eight application clients and pools connected through one
   bounded local TCP endpoint.
10. Arms a bounded single-standby controller only after three healthy primary
    probes. One explicitly labelled synthetic single-probe failure must recover
    without promotion. A separate bounded probe container then reaches primary
    through the replication bridge. The drill disconnects primary from that
    bridge: the probe and streaming standby lose it, while an in-container SQL
    write proves the old primary is still running and writable. The standby
    must stay in recovery and not see that partition marker. Three failures plus
    confirmation reach the promotion path, where an independent Docker
    container-state fence must reject promotion. The bridge is reconnected with
    the same `primary` alias; a healthy probe must reset the controller and the
    standby must replay the partition marker with bounded LSN lag. Finally, a
    checked-out sentinel runs an in-flight query and the active primary
    container is destroyed while its fenced volume is retained, which must
    interrupt the query. Three failures plus
    confirmation are required again; only an independently fenced old primary
    permits `pg_ctl promote`, writable wait, and stable endpoint switch. The
    original sentinel Pool and all eight clients must recover without
    reconstruction and pass 8/8 again.
11. Writes a marker on the promoted primary, then runs PostgreSQL 17
    `pg_rewind -R` against the fenced old-primary volume. `wal_log_hints=on`,
    `full_page_writes=on`, and a persisted 128 MiB WAL retention window are
    required. The old volume is never started before rewind. Its first start
    must report `pg_is_in_recovery()=true`, replay the post-promotion marker,
    match the gateway inventory, and leave the stable endpoint and original
    clients healthy.
12. Restarts the promoted primary and requires the same sentinel Pool plus the
    same eight application clients to recover and pass a third 8/8. The rewound
    old primary must remain a standby and replay another marker after that
    source restart.
13. Removes every client, proxy, container, volume, network, credential file,
    and dump artifact. A cleanup failure makes the drill fail.

CI runs the same command after the real PostgreSQL integration suite. The JSON
result is retained with the quality artifacts, while the temporary database
backup itself is deliberately not retained.

## Evidence interpretation

A passing result proves a bounded logical snapshot can recover the covered
gateway schemas into a clean PostgreSQL 17 primary, establish a real asynchronous
streaming standby, replay post-basebackup WAL, perform controlled promotion, and
exercise bounded automatic failure detection/promotion/switching for exactly one
standby. It also proves one real Docker-bridge partition: the old primary stays
writable, the standby cannot replay a new marker, the health path reaches its
full failure threshold, and the independent Docker-state fence blocks
promotion. After bridge healing, health recovers and the standby replays that
marker before the destructive failover proceeds. The same in-process
application pools recover after switch and restart. The fenced old-primary
volume is then rewound against the promoted primary, starts only in recovery,
and proves both initial and post-source-restart streaming convergence.
The reported `controlledRecoveryTimeMs` and `controlledFailoverTimeMs` are only
the wall clocks of this disposable fixture; neither is a production RTO.

The drill does **not** prove:

- continuous WAL archiving or point-in-time recovery;
- synchronous replication, multi-candidate leader election/quorum, or a
  production external HA controller (the repository controller knows exactly
  one standby and runs only inside this disposable drill);
- arbitrary multi-link/multi-host partition or complete split-brain safety. The
  covered partition is one disposable Docker bridge with one known standby;
  the independent fence and rewind path are not a quorum service, automatic
  multi-candidate rejoin controller, or proof for missing-WAL/archive recovery;
- object-lock/WORM retention or independent backup custody;
- production data volume, encryption-at-rest, certificate rotation, RPO, or
  RTO;
- end-to-end exactly-once behavior in a remote Provider or other external
  system.

Those remain deployment-specific E4 evidence. The drill reuses its ephemeral
PostgreSQL superuser for replication; production must use a dedicated bounded
replication identity. A production program should also add
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
