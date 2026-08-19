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

Runtime credential SQLite records are encrypted before they reach SQLite.
Every process must receive the same `PME_RUNTIME_CREDENTIAL_MASTER_KEY` (or
restricted key file). Key rotation is a coordinated operation: all replicas
must use the same new primary key and old-key fallback before any replica
rewrites the store. See
[Runtime credential encryption](./runtime-credential-encryption.md).

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

The `/ws` endpoint uses the same bearer-token authorization and
`AI_GATEWAY_CORS_ALLOWED_ORIGINS` allowlist as HTTP. Its secure defaults are 100
total connections, 5 connections per authenticated subject, 32 pending
handshakes, 256 KiB per message, 60 messages per 60 seconds, 64 total in-flight
messages, and 2 in-flight messages per subject. Operators may lower these with
`AI_GATEWAY_WS_MAX_CONNECTIONS`,
`AI_GATEWAY_WS_MAX_CONNECTIONS_PER_SUBJECT`,
`AI_GATEWAY_WS_MAX_PENDING_UPGRADES`,
`AI_GATEWAY_WS_MAX_MESSAGE_BYTES`,
`AI_GATEWAY_WS_MAX_MESSAGES_PER_WINDOW`,
`AI_GATEWAY_WS_MESSAGE_WINDOW_MS`,
`AI_GATEWAY_WS_MAX_IN_FLIGHT_MESSAGES`, and
`AI_GATEWAY_WS_MAX_IN_FLIGHT_PER_SUBJECT`. Every business message is
reauthorized, idle connections are reauthorized every 30 seconds, and the
default maximum connection lifetime is 15 minutes. Operators may lower the
periodic interval and lifetime with `AI_GATEWAY_WS_REAUTH_INTERVAL_MS` and
`AI_GATEWAY_WS_MAX_CONNECTION_LIFETIME_MS`. Production rejects wildcard
browser origins, compression is disabled, authentication is time-bounded, and
shutdown actively closes upgraded sockets before the HTTP listener exits.

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

### Workforce task ownership

Controlled Workforce execution now requires a hashed bearer claim bound to the
plan, task, agent, and monotonically increasing fencing token before an Agent can
start, complete, or fail a task. One manager-level lease core serves all local
claims without a timer per task, and active tasks are safely requeued after a
process restart because an in-memory bearer claim cannot survive that boundary.

This is a same-process correctness and resource-safety guarantee, not a
cross-host Workforce lease. Do not dispatch one Workforce queue across gateway
replicas until a reviewed PostgreSQL task-claim backend implements the same
issue, validate, renew, release, revoke, and fencing contract. The gateway must
remain the only authority allowed to cancel or requeue those claims.

## Cross-host PostgreSQL request quotas

Memory rate limits are process-local and SQLite counters are same-host only.
Cross-host replicas can enforce one shared fixed-window request quota with the
same PostgreSQL cluster:

```bash
AI_GATEWAY_RATE_LIMIT_STORE_MODE=postgres
AI_GATEWAY_RATE_LIMIT_POSTGRES_URL=<load-from-secret-manager>
AI_GATEWAY_RATE_LIMIT_HMAC_SECRET=<load-the-same-32-byte-or-longer-secret>
AI_GATEWAY_RATE_LIMIT_STORE_NAMESPACE=http
```

The store uses database time, atomic updates, and separate namespaces for the
global fallback and each route policy. It HMACs the request subject before
storage, so the table does not contain raw IP partition keys. A short advisory
transaction lock is used only when creating a new bucket or enforcing capacity;
requests to an existing hot bucket use one atomic update and do not take that
global capacity lock.

The same store and pool also enforce WebSocket admission and message quotas in
the scoped `websocket-upgrades` and `websocket-messages` namespaces. Configure
`AI_GATEWAY_WS_UPGRADE_WINDOW_MS`,
`AI_GATEWAY_WS_MAX_UPGRADES_PER_WINDOW`,
`AI_GATEWAY_WS_MESSAGE_WINDOW_MS`, and
`AI_GATEWAY_WS_MAX_MESSAGES_PER_WINDOW` identically on every replica. A quota
hit rejects the upgrade with HTTP 429 or closes an established connection with
WebSocket code 1008. Store or capacity failure rejects an upgrade with HTTP 503
or closes a connection with code 1013; provider execution does not proceed.

These shared counters govern admission attempts and business messages. Active
connection and in-flight execution caps remain process-local safety limits, not
cross-node leases. Deployments must not claim a global active-connection cap
without a separately verified lease and crash-recovery mechanism.

Operational bounds:

```bash
AI_GATEWAY_RATE_LIMIT_POSTGRES_POOL_MAX=4
AI_GATEWAY_RATE_LIMIT_POSTGRES_STATEMENT_TIMEOUT_MS=5000
AI_GATEWAY_RATE_LIMIT_POSTGRES_MAX_BUCKETS=100000
```

### Cross-replica WebSocket connection leases

PostgreSQL rate-limit mode also activates a fail-closed connection lease for every accepted WebSocket. Acquisition is serialized in PostgreSQL, enforces both the configured global and per-subject connection limits across replicas, stores only an HMAC of the authenticated subject, and uses database time plus a fencing token for renew and release operations.

```powershell
AI_GATEWAY_WEBSOCKET_CONNECTION_LEASE_NAMESPACE=production-cluster-a
AI_GATEWAY_WEBSOCKET_CONNECTION_LEASE_MS=30000
AI_GATEWAY_WEBSOCKET_CONNECTION_LEASE_MAX_ROWS=100000
AI_GATEWAY_WEBSOCKET_CONNECTION_LEASE_POOL_MAX=2
```

The dedicated pool is an intentional bulkhead: lease renewals cannot be starved by bursty HTTP rate-limit traffic. A handshake is rejected with `503` when lease ownership cannot be proved, an exhausted connection limit returns `429`, and an established socket is closed with `1013` if renewal fails or fencing ownership is lost. Each confirmation also receives a conservative monotonic local deadline with a 10% safety margin, so an event-loop or GC pause cannot resurrect a lease that may have expired in PostgreSQL. Normal closes release the exact lease; process crashes are recovered by the bounded TTL. Memory and SQLite modes remain node-local and must not be described as distributed active-connection enforcement.

Use the same namespace on every replica in one deployment and a different namespace for deployments that must not share limits. Keep `AI_GATEWAY_RATE_LIMIT_HMAC_SECRET` identical across those replicas, at least 32 bytes, and load it from a secret manager. Outside a trusted local network, require certificate-verified PostgreSQL TLS.

Kubernetes and load-balancer readiness probes should use `/healthz` or `/ready`. When distributed WebSocket leases are enabled, either endpoint returns `503` with the normalized reason `websocket-lease-store-unavailable` until the lease database is reachable. `/livez` remains a process-liveness signal and does not depend on PostgreSQL. Alert on `ai_gateway_websocket_lease_store_available{mode="postgres"} == 0`, unexpected growth in `ai_gateway_websocket_lease_events_total{event="lost"}`, or a mismatch between active connections and `ai_gateway_websocket_lease_active_local`. Metrics intentionally omit database addresses, namespaces, subjects, hashes, lease IDs, and fencing tokens.

The CI `PostgreSQL distributed state integration` job runs the lease protocol against PostgreSQL 17 on every pull request. It verifies independent-pool contention, subject and global limits, exact release, real TTL takeover, stale-owner fencing, database-clock behavior, and HMAC-only subject persistence. Fake-pool unit tests remain useful for deterministic fault injection, but they are not treated as proof that the SQL protocol works against PostgreSQL.

If the store cannot prove a counter update, the gateway returns
`503 RATE_LIMIT_STORE_UNAVAILABLE`; when the bounded active-bucket capacity is
full it returns `503 RATE_LIMIT_STORE_CAPACITY`. Neither condition fails open to
provider traffic. Monitor `ai_gateway_rate_limit_store_available`, active
buckets, statistics age, pool saturation, statement timeouts, and database
capacity. This controls gateway request counts, not provider token billing or a
tenant-wide quota unless the deployment's trusted proxy and partition policy
make the request subject tenant-specific.

Configure request identity according to the
[trusted proxy and request identity contract](./trusted-proxy-identity-contract.md).
Every ingress hop must overwrite rather than append client-supplied forwarding
headers, and every gateway replica must receive the same trusted CIDRs, hop
bound, subject mode, and HMAC secret. A stale or over-broad CIDR list can turn a
network boundary into attacker-controlled identity input.

\n
