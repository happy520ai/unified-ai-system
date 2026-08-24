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

Controlled Workforce execution requires a hashed bearer claim bound to the
plan, task, agent, and monotonically increasing fencing token before an Agent can
start, complete, or fail a task. Local preview uses one bounded manager-level
lease core without a timer per task. Cross-host ownership can use PostgreSQL:

```bash
AI_GATEWAY_WORKFORCE_CLAIM_STORE_MODE=postgres
AI_GATEWAY_WORKFORCE_CLAIM_POSTGRES_URL=<load-from-secret-manager>?sslmode=verify-full
AI_GATEWAY_WORKFORCE_CLAIM_NAMESPACE=production
AI_GATEWAY_WORKFORCE_CLAIM_STORE_REQUIRED=true
```

The PostgreSQL backend uses database-clock expiry, one atomic active owner per
`(namespace, plan, task)`, a global bigint fencing sequence, bounded capacity,
and separate pools. It supports issue, validate, renew, release, token/task/plan
revocation, cleanup, and health. Only a SHA-256 digest/fingerprint is stored;
the raw bearer token is returned once and never enters queue JSON, audit output,
or health. Non-loopback databases require `sslmode=verify-full` by default.

`WORKFORCE_EXECUTION_ENABLED=true` plus `AI_GATEWAY_MULTI_INSTANCE=true` fails
startup unless this PostgreSQL claim mode is selected. After a process restart,
a recovered local queue entry waits for the old database lease to expire before
it can acquire a higher fence; it does not revoke a possibly live worker during
a rolling restart. `/healthz` and `/ready` fail when a configured distributed
claim store is unavailable.

This closes cross-host **ownership**, not the entire distributed Workforce
system. Queue/result persistence remains same-host JSON, and every irreversible
downstream side effect must reject stale fencing tokens before the system can
claim end-to-end exactly-once execution. Do not dispatch one shared production
queue across hosts until a central queue/result backend, fence-aware side-effect
sinks, database failover, partition, and split-brain tests are complete. The
gateway remains the only authority allowed to cancel or requeue claims.

### A2A task persistence

A2A task state is bounded and scoped by the server-derived tenant and
authenticated owner in every mode. Local preview uses an in-memory SQLite
database. Same-host processes can share restart-safe state by using one local
path:

```bash
AI_GATEWAY_A2A_TASK_STORE_MODE=sqlite
AI_GATEWAY_A2A_TASK_STORE_PATH=/var/lib/unified-ai-system/a2a-tasks.sqlite
AI_GATEWAY_A2A_TASK_STORE_REQUIRED=true
```

When `AI_GATEWAY_MULTI_INSTANCE=true` and no A2A mode is explicit, the gateway
selects this SQLite mode. The store uses WAL, full synchronous commits, bounded
busy waiting, atomic capacity/upsert transactions, TTL, global/per-owner/task
size/history/artifact limits, and scope-bound keyset pagination. Health output
contains no database path or task content.

This is restart-safe same-host persistence, not a cross-host A2A store. Never
put the database on NFS, SMB, or another network filesystem. Gateway replicas
on different hosts still require a reviewed PostgreSQL task store plus database
failover and partition evidence.

### Same-host enterprise audit serialization

The enterprise audit hash chain serializes independent gateway processes with
an adjacent exclusive lock, revalidates the complete chain tail inside that
lock, and fsyncs each chained entry before a protected operation can return.
Lock acquisition is bounded and fails closed. A lock heartbeat plus same-host
process liveness check prevents an active writer from being reclaimed merely
because its original lock timestamp aged; an abandoned lock is recoverable only
after the stale interval.

All same-host processes must share both `PME_AUDIT_LOG_PATH` and
`PME_AUDIT_CHAIN_PATH` on the same restricted local filesystem. Optional bounds
are:

```bash
PME_AUDIT_CHAIN_LOCK_TIMEOUT_MS=5000
PME_AUDIT_CHAIN_STALE_LOCK_MS=60000
```

The local hash chain detects entry edits, insertion, middle deletion,
corruption, and concurrent-writer races. It cannot prove that an attacker with
control of the whole writable gateway filesystem did not roll back or replace
the chain and every local checkpoint. Cross-host audit consistency and complete
rollback detection still require a reviewed database-backed audit store or an
externally retained checkpoint. Do not put the JSONL chain or its lock on NFS,
SMB, or a cloud filesystem and do not describe this same-host lock as a
distributed consensus protocol.

For production-oriented or real-provider readiness, configure the signed
checkpoint on a separately retained, versioned, or WORM-backed path:

```bash
PME_AUDIT_CHECKPOINT_REQUIRED=true
PME_AUDIT_CHECKPOINT_PATH=/externally-retained/audit.checkpoint.json
PME_AUDIT_CHECKPOINT_HMAC_KEY=<32-byte canonical hex or base64 secret>
# Or use PME_AUDIT_CHECKPOINT_HMAC_KEY_FILE=<restricted-0600-key-file>
PME_AUDIT_CHECKPOINT_MINIMUM_SEQUENCE=<externally-recorded floor>
PME_AUDIT_CHECKPOINT_TRUSTED_HASH=<optional hash at that exact floor>
```

Configure exactly one of the inline key or key-file variables. The key is never
written to the checkpoint or health output. Each protected
append fsyncs the chain, then atomically commits a signed sequence/hash
checkpoint before returning. A missing checkpoint on a non-empty legacy chain
fails closed. One-time migration requires
`PME_AUDIT_CHECKPOINT_ALLOW_BOOTSTRAP=true`; remove it after the first verified
startup. A crash or storage failure between chain and checkpoint commits leaves
an explicit `AUDIT_CHECKPOINT_LAG` and blocks later protected writes. After an
operator independently reconciles that tail, one startup may use
`PME_AUDIT_CHECKPOINT_ALLOW_ADVANCE=true` to sign the verified current tail;
remove the flag immediately afterward.

Audit list/export operations read the reverified hash chain as their canonical
source and reconstruct the nested integrity metadata from it. The historical
plain JSONL audit file remains a compatibility mirror; a mirror write failure
still blocks the protected operation, but it cannot make a successfully chained
event disappear from later reads after restart.

A valid HMAC checkpoint prevents undetected editing without the key, and an
external sequence/hash floor detects replay below that floor. It still does not
prove the configured path is actually external, immutable, independently
retained, or protected from restoration of an older signed file. Health always
reports `externalRetentionVerified=false`; production evidence must come from
the storage and retention system, not this repository.

### Billable usage ledger

Real-provider mode writes and fsyncs every usage record before returning a
successful response. Each process uses a unique daily JSONL filename under the
shared `AI_GATEWAY_USAGE_LOG_DIR`, preventing append and rotation collisions;
the usage query endpoints aggregate a bounded window across those files. Keep
that directory on a restricted local volume and collect every per-process file.

For cross-host real-provider execution, use the central PostgreSQL ledger:

```bash
AI_GATEWAY_USAGE_LEDGER_STORE_MODE=postgres
AI_GATEWAY_USAGE_LEDGER_POSTGRES_URL=<load-from-secret-manager>?sslmode=verify-full
AI_GATEWAY_USAGE_LEDGER_NAMESPACE=production
AI_GATEWAY_USAGE_LEDGER_CENTRAL_REQUIRED=true
```

Gateway execution now awaits the central reservation before entering a
billable adapter and awaits the terminal usage commit before reporting success.
One attempt has an idempotent `start` key and one mutually exclusive terminal
key; a contradictory completed/failed replay is rejected. The table contains
tenant, provider/model, token, cost, latency, fallback/shadow and sanitized
error metadata, but no prompt, response body, credential, authorization header,
database URL, or raw identity token. Retention and namespace capacity are
bounded. Non-loopback databases require `sslmode=verify-full` by default.

`AI_GATEWAY_MULTI_INSTANCE=true` plus real-provider execution fails startup if
the central mode is not selected. `/healthz`, `/ready`, `/usage/*`, and
Prometheus expose safe availability/count/failure data; a database failure
blocks new billable execution rather than falling back to local files.

This closes central usage-event durability and duplicate ingestion. It is not a
payment processor, tax engine, legal invoice system, or provider-invoice
reconciliation proof. Unknown-cost/unresolved attempts must still be reconciled
against provider statements before financial reporting.

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

## Multi-instance defaults (AI_GATEWAY_MULTI_INSTANCE=true)

Set `AI_GATEWAY_MULTI_INSTANCE=true` to declare a same-host, multi-process
deployment. With the flag on and no explicit store-mode envs:

- HTTP rate limiting defaults to the cross-process **SQLite** backend
  (`.data/rate-limits.sqlite`).
- Idempotency dedup defaults to the shared **SQLite** store
  (`.data/idempotency.sqlite`); the required HMAC secret is loaded from — or
  first generated into — `.data/shared-hmac-secret.key` (0600) so every
  process derives identical request identities.
- The JSONL response cache and knowledge SQLite store are already
  file-backed and shared by default.
- A2A tasks default to the bounded same-host SQLite store
  (`.data/a2a-tasks.sqlite`).
- Real Workforce execution fails closed unless cross-host deployments select
  the PostgreSQL fenced-claim backend; dry-run preview remains local.

Explicit `AI_GATEWAY_RATE_LIMIT_STORE_MODE` /
`AI_GATEWAY_IDEMPOTENCY_STORE_MODE` configuration always wins (use the
postgres modes for cross-host instances). Cross-process store behavior is
covered by `apps/ai-gateway-service/src/http/multiInstanceConfig.test.js`.
