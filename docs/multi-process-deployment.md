# Multi-process deployment guide

This guide covers same-host processes with local SQLite and cross-host response
idempotency plus real-provider dispatch reservations with PostgreSQL. It does
not claim complete high availability or globally exactly-once provider
execution.

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
| Real-provider dispatch | `AI_GATEWAY_PROVIDER_DISPATCH_STORE_MODE=sqlite` | `AI_GATEWAY_PROVIDER_DISPATCH_SQLITE_PATH` |
| Irreversible external effects | `AI_GATEWAY_EXTERNAL_EFFECT_STORE_MODE=sqlite` | `AI_GATEWAY_EXTERNAL_EFFECT_SQLITE_PATH` |

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

## Real-provider dispatch coordination

Response replay and provider dispatch use separate stores and capacities. Every
real-provider replica must share the provider-dispatch database and HMAC secret:

```bash
AI_GATEWAY_PROVIDER_DISPATCH_STORE_MODE=postgres
AI_GATEWAY_PROVIDER_DISPATCH_CENTRAL_REQUIRED=true
AI_GATEWAY_PROVIDER_DISPATCH_POSTGRES_URL=<same-database-as-usage-ledger>?sslmode=verify-full
AI_GATEWAY_PROVIDER_DISPATCH_HMAC_SECRET=<load-the-same-32-byte-or-longer-secret>
AI_GATEWAY_PROVIDER_DISPATCH_POSTGRES_TLS_REQUIRED=true
```

`AI_GATEWAY_MULTI_INSTANCE=true` makes PostgreSQL mandatory for real-provider
dispatch. Startup rejects SQLite, a missing stable secret, a non-verified remote
TLS URL, or a database target that differs from the central usage ledger. The
runtime creates `public.ai_gateway_provider_dispatch_entries` and its dedicated
fencing sequence/indexes; it does not share the HTTP idempotency table.

Route traffic is ready only when the redacted provider-dispatch health reports
`enabled=true` and `available=true`. Monitor
`ai_gateway_provider_dispatch_store_available`, retained tombstones, capacity,
statistics age, database lag, and restore drills. See
[the real-provider dispatch contract](./provider-dispatch-idempotency.md) for
client keys, failure codes, retention, and the exactly-once boundary.

## Irreversible external-effect coordination

Webhook sends and high-risk Agent Git/shell tools use a third, independent
tombstone store. Cross-host replicas must share the Workforce database and one
stable HMAC secret:

```bash
AI_GATEWAY_EXTERNAL_EFFECT_ENABLED=true
AI_GATEWAY_EXTERNAL_EFFECT_STORE_MODE=postgres
AI_GATEWAY_EXTERNAL_EFFECT_CENTRAL_REQUIRED=true
AI_GATEWAY_EXTERNAL_EFFECT_POSTGRES_URL=<same-database-as-workforce>?sslmode=verify-full
AI_GATEWAY_EXTERNAL_EFFECT_HMAC_SECRET=<load-the-same-32-byte-or-longer-secret>
AI_GATEWAY_EXTERNAL_EFFECT_POSTGRES_TLS_REQUIRED=true
```

Multi-instance mode rejects SQLite. Startup also rejects a database target that
differs from the Workforce queue/claim database. PostgreSQL creates the
dedicated `public.ai_gateway_external_effect_entries` table and fencing
sequence; it does not share HTTP idempotency or provider-dispatch capacity.

Only route redaction-safe health to telemetry. Monitor
`ai_gateway_external_effect_store_available`, reservation capacity, tombstone
growth, statistics age, database lag, and restore drills. See
[the durable external-effect contract](./external-effect-fencing.md) for client
keys, tool fences, failure codes, and the explicit at-most-once boundary.

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
8. Run the credential-free [PostgreSQL logical recovery drill](./postgresql-recovery-drill.md)
   after schema or persistence changes. Treat it as bounded logical-restore evidence,
   not production failover, PITR, RTO, or RPO proof.

## Honest readiness status

The repository now has a tested same-host, multi-process idempotency path for
non-streaming provider-backed chat. That is stronger than process-local
deduplication, but it is not cross-host HA, global exactly-once execution,
session affinity, or provider-side reconciliation.

PostgreSQL mode supplies cross-host atomic ownership and fencing for the covered
central stores. The repository now destructively restores a bounded twelve-table
fixture into PostgreSQL 17, builds a real asynchronous streaming standby with
`pg_basebackup -R`, proves post-basebackup WAL replay, interrupts an active query
by destroying primary, promotes standby, switches a stable local TCP endpoint,
and re-verifies the same eight application clients before/after the switch and
restart. The drill controller requires healthy arming, consecutive failures,
confirmation, recovery-state validation, and one-standby automatic promotion
and endpoint switching. Before primary destruction, a probe container and the
standby are separated from a still-writable primary by disconnecting the real
Docker replication bridge. The full failure sequence must be rejected by an
independent container-state fence; reconnecting the bridge must restore health
and replay a marker written during the partition. This closes one bounded
single-bridge unsafe-promotion and convergence precursor. It is not
multi-candidate quorum or an arbitrary multi-host partition. After promotion,
the drill retains the fenced old-primary volume, runs `pg_rewind -R` with
persisted `wal_log_hints` and WAL retention, and starts that volume only as a
standby; it must replay both a post-promotion marker and another marker after
the promoted primary restarts. The same drill also takes an independent
manifested physical base backup, continuously archives WAL to a separate
volume, removes bundled backup WAL, and restores through archive-only recovery
to an inclusive LSN between an included and excluded marker; all eight contracts
and inventory must match at that exact point. Complete deployment HA still needs independently verified
multi-candidate election/quorum, external HA control, synchronous policy, TLS
identity, long-duration/off-host archive retention, time/named PITR targets,
archive-loss fallback, production-scale restore,
broader partition and split-brain behavior, multi-candidate rejoin control,
provider reconciliation,
measured RTO/RPO, and load-balancer behavior.

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
AI_GATEWAY_WORKFORCE_QUEUE_STORE_MODE=postgres
AI_GATEWAY_WORKFORCE_QUEUE_POSTGRES_URL=<same-database-as-claims>?sslmode=verify-full
AI_GATEWAY_WORKFORCE_QUEUE_NAMESPACE=production
AI_GATEWAY_WORKFORCE_QUEUE_CENTRAL_REQUIRED=true
AI_GATEWAY_WORKFORCE_CONTROL_STORE_MODE=postgres
AI_GATEWAY_WORKFORCE_CONTROL_POSTGRES_URL=<same-database-as-queue-and-claims>?sslmode=verify-full
AI_GATEWAY_WORKFORCE_CONTROL_NAMESPACE=production
AI_GATEWAY_WORKFORCE_CONTROL_CENTRAL_REQUIRED=true
```

The PostgreSQL backend uses database-clock expiry, one atomic active owner per
`(namespace, plan, task)`, a global bigint fencing sequence, bounded capacity,
and separate pools. It supports issue, validate, renew, release, token/task/plan
revocation, cleanup, and health. Only a SHA-256 digest/fingerprint is stored;
the raw bearer token is returned once and never enters queue JSON, audit output,
or health. Non-loopback databases require `sslmode=verify-full` by default.

`WORKFORCE_EXECUTION_ENABLED=true` plus `AI_GATEWAY_MULTI_INSTANCE=true` now
fails startup unless PostgreSQL claims, central queue/results, and central
approval/lifecycle control are selected. All three stores must use the same database so a
terminal task write can lock the active claim, validate its digest and monotonic
fence, persist the bounded/redacted result, and delete the claim in one
transaction. Expired owners are recovered under a row lock and a replacement
receives a higher fence. The raw claim token is never persisted. Tenant, owner,
and claim scope originate from the authenticated server identity; public plan
IDs can therefore be reused without cross-tenant claim collisions.

The control backend stores only SHA-256 identity keys, atomically single-consumes
an approval across replicas, and keeps lifecycle transitions in versioned,
digest-verified, size-bounded rows. A remote replica can observe cancellation
and pause intent without reading raw tenant, user, plan, or execution IDs from
the database. This provides central authorization and lifecycle truth; it does
not by itself resurrect a crashed in-process role runner.

`POST /workforce/execute/approve` returns the opaque `executionId` derived from
that one approval. The authenticated owner can use
`POST /workforce/execute/status` or `POST /workforce/execute/cancel` with that
ID while the synchronous execute request is running. A replica polls central
lifecycle state and propagates cancellation through the DAG `AbortSignal` into
the provider adapter. Status/cancel access is re-bound to server-derived tenant
and subject fingerprints; possession of another execution ID is insufficient.
Pause/resume is not exposed as a production HTTP contract because the current
in-process role runner cannot durably reconstruct its call stack after a crash.

Timeout and remote-cancel paths do not treat an `AbortSignal` notification as
proof that the underlying role has stopped. The DAG waits up to
`WORKFORCE_ABORT_DRAIN_TIMEOUT_MS` (30 seconds by default, bounded from 100 ms
to 5 minutes) for each active role to settle. If a provider ignores cancellation
past that deadline, the execution fails with unconfirmed quiescence and retains
the isolated worktree for operator inspection; destructive cleanup is skipped.
This retention is a fail-closed safety outcome, not successful cancellation.

`/healthz`, `/ready`, and Prometheus report claims, queue/results, and execution
control separately, without database URLs, namespaces, tokens, or task payloads. A
configured distributed-store outage makes the gateway unready. Capacity,
retention, task-size, pool, timeout, namespace, and verify-full TLS settings are
bounded explicitly.

This closes central queue/result persistence and the **task-terminal database
commit** fence. It still does not make arbitrary external effects exactly once:
provider calls, git pushes, webhooks, deploys, and other irreversible sinks must
consume and reject stale fences at their own commit boundary. Production claims
also require database failover, network partition/split-brain, backup/restore,
and destructive DR evidence. The gateway remains the only authority allowed to
cancel or requeue claims.

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

This is restart-safe same-host persistence. Never put the database on NFS, SMB,
or another network filesystem. For cross-host shared task lifecycle state:

```bash
AI_GATEWAY_A2A_TASK_STORE_MODE=postgres
AI_GATEWAY_A2A_TASK_STORE_CENTRAL_REQUIRED=true
AI_GATEWAY_A2A_TASK_STORE_POSTGRES_URL=<load-from-secret-manager>?sslmode=verify-full
AI_GATEWAY_A2A_TASK_STORE_NAMESPACE=production
AI_GATEWAY_A2A_TASK_STORE_POSTGRES_POOL_MAX=4
AI_GATEWAY_A2A_TASK_STORE_POSTGRES_STATEMENT_TIMEOUT_MS=5000
```

The fixed PostgreSQL schema uses database-clock expiry, transactional global and
per-owner counters, task-scoped advisory transaction locks, stale status-time
rejection, task JSON digests, tenant/owner predicates on every read, and
repeatable-read keyset pages. Readiness fails closed when the configured store
is unavailable, without exposing the URL, namespace, task content, or raw
database error.

Selecting PostgreSQL task mode also requires the fenced execution-lease lane.
The lease must use the same PostgreSQL database and uses a separate opaque
namespace. It binds each claim to the server-derived tenant/owner scope, task,
and random gateway instance; retains only token digests; renews with database
time; rejects a second active executor; and rejects acquisition after a task is
terminal. Completed/failed terminal state is written in the same transaction
that locks, validates, and consumes the token digest plus monotonic fence.
Cross-replica cancellation writes `canceled` and deletes the current fence in
that same lock order and transaction, even when the canceling replica has no
local event bus. Exact replay is idempotent; any terminal rewrite/reopen and any
stale executor terminal write are rejected.
Optional bounds are `AI_GATEWAY_A2A_EXECUTION_LEASE_TTL_MS`,
`AI_GATEWAY_A2A_EXECUTION_LEASE_HEARTBEAT_MS`, and
`AI_GATEWAY_A2A_EXECUTION_LEASE_MAX_ENTRIES`. The gateway retains an in-memory
proof only until the SDK commits the terminal event; the bounded
`AI_GATEWAY_A2A_TERMINAL_COMMIT_GRACE_MS` watchdog releases an uncommitted lease
instead of renewing it indefinitely.

Unlike the usage and audit schemas, A2A rows intentionally hold task history,
metadata, and artifacts. Apply least-privilege grants, encryption at rest,
retention/deletion policy, and backup/restore tests. The row digest is a
corruption signal rather than cryptographic proof against a database writer.
The lease prevents two gateway replicas from remaining valid active executors
for one scoped task, and the TaskStore terminal commit now consumes that lease
atomically. This closes the database TaskStore revoke/commit race. It does not
make downstream providers or other irreversible sinks fence-aware, forcibly
interrupt an operation already inside a provider, prove exactly-once side
effects, or provide database failover/partition evidence.

### Same-host enterprise audit serialization

The enterprise audit hash chain serializes independent gateway processes with
an adjacent exclusive lock, revalidates the complete chain tail inside that
lock, and fsyncs each chained entry before a protected operation can return.
Lock acquisition is bounded and fails closed. A lock heartbeat plus same-host
process liveness check prevents an active writer from being reclaimed merely
because its original lock timestamp aged. Node worker threads share a PID but
not module memory, so lock reclamation never relies on a per-thread nonce set;
a lock attributed to any live process remains fail-closed. Only an ownerless,
malformed, or dead-process lock is recoverable after the stale interval.

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

For cross-host gateways, add the central PostgreSQL HMAC chain while retaining
the local chain as a host forensic mirror:

```bash
PME_AUDIT_STORE_MODE=postgres
PME_AUDIT_POSTGRES_URL=<load-from-secret-manager>?sslmode=verify-full
PME_AUDIT_POSTGRES_NAMESPACE=production
PME_AUDIT_POSTGRES_HMAC_KEY_FILE=/run/secrets/audit-postgres-hmac.key
PME_AUDIT_CENTRAL_REQUIRED=true
PME_AUDIT_POSTGRES_MINIMUM_SEQUENCE=<externally-recorded-floor>
PME_AUDIT_POSTGRES_TRUSTED_HASH=<hash-at-that-sequence>
```

The central backend serializes all replicas through a transactional state-row
lock, assigns one global sequence, and binds each sanitized event to its
previous hash with SHA-256 plus a dedicated 256-bit HMAC. State has its own
HMAC. Append verification is O(1); explicit integrity verification walks the
chain in bounded batches. Event IDs are idempotent and conflicting reuse fails
closed. Tenant list/export reads the central store as canonical and never
persist prompt, response, credential, or Authorization fields.

`AI_GATEWAY_MULTI_INSTANCE=true` plus real-provider execution fails startup
without central audit. `/healthz` and `/ready` emit
`audit-central-store-unavailable` when its signed state cannot be verified.
Non-loopback databases require `sslmode=verify-full` by default. The HMAC key,
database URL, namespace, row HMACs and hashes are excluded from public health
and metric labels.

A valid HMAC checkpoint prevents undetected editing without the key, and an
external sequence/hash floor detects replay below that floor. It still does not
prove the configured path is actually external, immutable, independently
retained, or protected from restoration of an older signed file. Health always
reports `externalRetentionVerified=false`; production evidence must come from
the storage and retention system, not this repository.

The PostgreSQL chain has the same honesty boundary: it detects row/state edits,
gaps and replay below the configured external floor, but a database administrator
who can restore the database and the application secret boundary is outside
that proof. Export signed checkpoints or sequence/hash floors to independently
retained WORM/object-lock storage and test rollback detection there.

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
