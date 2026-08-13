# Multi-process deployment guide

This guide covers same-host processes with local SQLite and cross-host chat
idempotency with PostgreSQL. It does not claim complete high availability or
globally exactly-once provider execution.

## Deployment boundary

Node.js `node:sqlite` provides synchronous access to a file-backed SQLite
database. WAL mode allows readers and a writer to make progress concurrently,
but SQLite still permits only one writer at a time.

`node:sqlite` is still experimental in Node 22.18.0. Treat SQLite-backed modes
as opt-in same-host deployment capabilities, pin the Node patch release, and
rerun the repository gates before upgrading the runtime.

All processes that use one WAL database must run on the same host and open the
same local filesystem path. Do not place a WAL database on NFS, SMB, a cloud
filesystem, or another network filesystem. SQLite WAL uses a shared-memory
index and is explicitly not a cross-host coordination protocol.

Use PostgreSQL, Redis with an atomic lease design, or another reviewed
distributed store before deploying stateful gateway replicas across hosts.

## Cross-host PostgreSQL idempotency

PostgreSQL is the built-in cross-host backend for provider-backed, non-streaming
`POST /chat` idempotency. Every replica must use the same database and HMAC
secret:

```bash
AI_GATEWAY_IDEMPOTENCY_STORE_MODE=postgres
AI_GATEWAY_IDEMPOTENCY_POSTGRES_URL=<load-from-secret-manager>
AI_GATEWAY_IDEMPOTENCY_HMAC_SECRET=<load-the-same-32-byte-or-longer-secret>
```

Do not put either value in source control, command-line arguments, logs, or
support bundles. Require certificate-verified TLS outside a trusted local
network and configure it in the PostgreSQL connection string or platform secret.

The coordinator uses a short transaction and a transaction-scoped advisory
lock for claim/capacity serialization. Provider calls happen after commit. A
database sequence supplies a monotonically increasing fencing token; renew,
complete, and fail writes must match the identity, owner UUID, token, state, and
an unexpired database-clock lease. A stale owner therefore cannot overwrite a
newer result.

Per-process bounds are intentionally small by default:

```bash
AI_GATEWAY_IDEMPOTENCY_POSTGRES_POOL_MAX=4
AI_GATEWAY_IDEMPOTENCY_POSTGRES_STATEMENT_TIMEOUT_MS=5000
```

The runtime idempotently creates its fixed table, sequence, and indexes in the
`public` schema. A production DBA can pre-provision those objects, grant the
gateway role only data access plus sequence `USAGE`, and remove schema creation
privileges. Monitor pool exhaustion, statement timeouts, stale/unknown rows,
fencing completion misses, table growth, replication lag, backup restore tests,
and database availability. Do not route keyed traffic to this mode until every
replica reports `storeMode=postgres` and `available=true`.

## Existing same-host SQLite stores

These switches preserve the existing local defaults unless `sqlite` is
selected explicitly.

| State | Mode variable | Path variable |
| --- | --- | --- |
| Workforce plans | `WORKFORCE_PLAN_STORE_MODE=sqlite` | `WORKFORCE_PLAN_STORE_PATH` |
| Enterprise users | `PME_ENTERPRISE_USER_STORE_MODE=sqlite` | `PME_ENTERPRISE_USER_STORE_PATH` |
| Runtime credentials | `PME_RUNTIME_CREDENTIAL_STORE_MODE=sqlite` | `PME_RUNTIME_CREDENTIAL_STORE_PATH` |
| Chat idempotency | `AI_GATEWAY_IDEMPOTENCY_STORE_MODE=sqlite` | `AI_GATEWAY_IDEMPOTENCY_SQLITE_PATH` |

Use a `.db` extension for operational clarity. Do not point one store type at
another store's database unless its schema and lifecycle have been reviewed for
that deployment.

## Idempotent chat coordination

Every gateway process that serves provider-backed `POST /chat` traffic must
use the same three values:

```bash
AI_GATEWAY_IDEMPOTENCY_STORE_MODE=sqlite
AI_GATEWAY_IDEMPOTENCY_SQLITE_PATH=/data/gateway/idempotency.db
AI_GATEWAY_IDEMPOTENCY_HMAC_SECRET=<load-the-same-32-byte-or-longer-secret>
```

Load the HMAC secret through the deployment secret manager. Never commit it,
print it, pass it in command-line arguments, or include it in support bundles.

The SQLite coordinator uses short `BEGIN IMMEDIATE` transactions to atomically
claim a caller/key/route tuple. Provider network calls happen outside database
transactions. A lease heartbeat keeps a live owner current. If ownership
becomes uncertain, the row becomes an `unknown` tombstone and the gateway
refuses a second provider call until the record expires or an operator
reconciles the operation.

Optional bounds:

```bash
AI_GATEWAY_IDEMPOTENCY_TTL_MS=600000
AI_GATEWAY_IDEMPOTENCY_MAX_ENTRIES=1000
AI_GATEWAY_IDEMPOTENCY_MAX_RESULT_BYTES=1048576
AI_GATEWAY_IDEMPOTENCY_LEASE_MS=300000
AI_GATEWAY_IDEMPOTENCY_WAIT_MS=30000
AI_GATEWAY_IDEMPOTENCY_POLL_MS=50
```

See [the idempotent chat contract](./idempotent-chat-contract.md) for response
headers, conflict behavior, and retry rules.

## Example same-host layout

Create a restricted local state directory:

```bash
install -d -m 0700 /data/gateway
```

Run two processes with distinct ports and the same store configuration:

```bash
AI_GATEWAY_SERVICE_PORT=3100 pnpm gateway serve &
AI_GATEWAY_SERVICE_PORT=3101 pnpm gateway serve &
```

A reverse proxy can then balance requests:

```nginx
upstream ai_gateway {
    server 127.0.0.1:3100;
    server 127.0.0.1:3101;
    keepalive 32;
}
```

Keep the existing TLS, WebSocket, and SSE proxy settings. Graceful process
draining and a load-balancer health check are still required during restart.
See the [graceful shutdown contract](./graceful-shutdown-contract.md) for the
probe routes, propagation window, and forced termination boundary.

## Operational rules

1. Keep each SQLite database and its WAL/SHM files on a restricted local volume.
2. Configure every process in the deployment with the same backend mode.
3. Back up or snapshot only with a SQLite-aware procedure; copying the main
   database while WAL writes are active is not a consistent backup.
4. Monitor `SQLITE_BUSY`, disk capacity, WAL growth, idempotency store
   saturation, in-progress responses, and unknown tombstones.
5. Keep provider timeouts below the configured lease or retain the heartbeat.
6. Treat `created-unconfirmed` and
   `IDEMPOTENCY_PREVIOUS_ATTEMPT_UNKNOWN` as reconciliation events, not
   permission to retry with a new key.
7. Exercise process termination and restart with the fake provider before any
   authorized real-provider rollout.

## Honest readiness status

The repository now has a tested same-host, multi-process idempotency path for
non-streaming provider-backed chat. That is stronger than process-local
deduplication, but it is not cross-host HA, global exactly-once execution,
session affinity, or provider-side reconciliation.

PostgreSQL mode supplies a cross-host atomic ownership and fencing mechanism for
one bounded feature: non-streaming chat idempotency. Complete deployment HA
still needs independently verified database failover, TLS identity, retention,
backup/restore, disaster recovery, replica convergence, provider reconciliation,
and load-balancer behavior.

\n
