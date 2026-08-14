# Distributed WebSocket Execution Leases

WebSocket message-rate quotas limit admission frequency, but they do not bound
the number of model calls that remain active at the same time. In a replicated
deployment, process-local in-flight counters can be multiplied by the number of
gateway replicas.

When `AI_GATEWAY_RATE_LIMIT_STORE=postgres`, the gateway therefore uses the
existing PostgreSQL WebSocket lease control plane for both connection ownership
and message execution ownership. Execution leases use an internal `:execution`
namespace, so they do not consume connection capacity.

## Safety properties

- PostgreSQL serializes acquisition before checking global and per-subject
  limits across all replicas.
- Subjects are persisted only as HMAC-SHA-256 values.
- PostgreSQL `clock_timestamp()` is the lease-expiry authority.
- Every lease has a UUID and monotonically increasing fencing token.
- Exact release requires namespace, subject hash, UUID, and fencing token.
- TTL recovery permits progress after a crashed owner.
- A local monotonic deadline expires before the database TTL, so an event-loop,
  CPU, or GC pause cannot revive stale ownership.
- Limit denial closes the socket with temporary-overload code `1013` before a
  provider handler starts.
- Store failure, malformed decisions, renewal loss, and release failure all
  fail closed.

The execution limits reuse `AI_GATEWAY_WS_MAX_IN_FLIGHT_MESSAGES` and
`AI_GATEWAY_WS_MAX_IN_FLIGHT_PER_SUBJECT`. Lease duration, row capacity, pool
size, statement timeout, HMAC secret, and database URL reuse the existing
WebSocket/PostgreSQL lease settings.

Memory and SQLite rate-limit deployments retain process-local execution caps.
Cross-replica execution enforcement is claimed only when every serving replica
runs this implementation with the same PostgreSQL URL, HMAC secret, and lease
namespace. During a mixed-version rolling deployment, older replicas do not
participate in execution leasing and must be drained before this guarantee is
treated as active.

## Language selection

TypeScript extends the existing lease protocol because the workload is an
in-process ownership contract with typed limits, decisions, and fencing
lifecycle. A Go or Rust sidecar would add a process, RPC, packaging, telemetry,
credential, and rollback boundary without a measured isolation or throughput
benefit. Existing JavaScript transport files receive only compatibility wiring;
no new JavaScript runtime module or dependency is introduced.

## Evidence boundary

Component tests use two independent WebSocket servers and prove that a second
replica cannot start provider work after the shared execution cap is consumed.
The PostgreSQL 17 CI service uses independent pools to verify subject/global
limits, connection/execution namespace isolation, HMAC-only persistence, exact
release, expiry takeover, and stale-owner fencing. Passing these checks does not
prove provider cancellation, unlimited scale, production readiness, or freedom
from every denial-of-service technique.
