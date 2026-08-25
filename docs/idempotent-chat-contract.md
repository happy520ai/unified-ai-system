# Idempotent chat request contract

The provider-backed `POST /chat` path accepts an optional `Idempotency-Key`
request header. It lets a caller retry an uncertain non-streaming request
without starting the same provider execution twice inside one gateway process
and retention window.

This response-replay contract is distinct from the mandatory real-provider
dispatch tombstone. The latter protects every core provider attempt, including
compatibility and streaming routes, and is documented in
[Real-provider dispatch idempotency](./provider-dispatch-idempotency.md).

The coordinator is an erasable TypeScript runtime module loaded directly by
Node.js. The repository therefore requires Node.js `>=22.18.0`, the first Node
22 release where type stripping is enabled by default. The module does not use
enums, parameter properties, path aliases, or other syntax that requires code
generation or `tsconfig.json` transformation.

## Client contract

1. Generate a new opaque key for each intended operation. UUID v4 is a good default.
2. Reuse that key only when retrying the same request body as the same authenticated caller.
3. Keep keys free of prompts, email addresses, account identifiers, and other sensitive data.
4. Do not automatically retry `POST /chat/stream` after response streaming has started.

Keys must contain 1 to 255 visible ASCII characters without spaces. The gateway
does not log or echo a key. It stores only an HMAC-derived identity and a SHA-256
digest of a canonical form of the parsed request body.

## Outcomes

| Outcome | HTTP behavior | Meaning |
| --- | --- | --- |
| First request with a durable replay record | Original status and body | `Idempotency-Status: created`, `Idempotency-Replayed: false`, and `Idempotency-Replayable: true`. |
| Same caller, key, route, and body | Cached status and body | `Idempotency-Status: replayed`, `Idempotency-Replayed: true`, and `Idempotency-Replayable: true`. Concurrent duplicates share the first execution. |
| Provider result returned but durable replay confirmation failed | Original status and body | `Idempotency-Status: created-unconfirmed` and `Idempotency-Replayable: false`. Do not automatically retry this operation. |
| Same caller and key, different body | `409` / `IDEMPOTENCY_KEY_REUSED` | The gateway refuses ambiguous caller intent. |
| Result exceeds the cache bound | First result is returned; later retry receives `409` / `IDEMPOTENCY_RESULT_NOT_REPLAYABLE` | A tombstone prevents another provider call without retaining an oversized response. |
| Execution throws after it starts | First attempt follows normal error handling; later retry receives `409` / `IDEMPOTENCY_PREVIOUS_ATTEMPT_FAILED` | The gateway fails closed rather than risking duplicate provider work. |
| Another owner remains active beyond the bounded wait | `409` / `IDEMPOTENCY_REQUEST_IN_PROGRESS` with `Retry-After` | The duplicate is not executed. The caller may retry the same key after the delay. |
| A shared-store owner loses its lease | `409` / `IDEMPOTENCY_PREVIOUS_ATTEMPT_UNKNOWN` | The row becomes a fail-closed tombstone. Reconcile the original operation before using a new key. |
| Shared store unavailable | `503` / `IDEMPOTENCY_STORE_UNAVAILABLE` with `Retry-After` | No provider call starts because cross-process ownership could not be proven. |
| Store at capacity | `503` / `IDEMPOTENCY_CAPACITY_REACHED` with `Retry-After` | New keyed work is rejected until retained entries expire. |

All three idempotency response headers are included in
`Access-Control-Expose-Headers`. On a
replay, the JSON response keeps the original provider execution request ID,
while `x-request-id` identifies the current HTTP transport attempt.

## Bounds and configuration

| Environment variable | Default | Bound |
| --- | ---: | ---: |
| `AI_GATEWAY_IDEMPOTENCY_TTL_MS` | `600000` (10 minutes) | 1 second to 24 hours |
| `AI_GATEWAY_IDEMPOTENCY_MAX_ENTRIES` | `1000` | 1 to 100000 entries |
| `AI_GATEWAY_IDEMPOTENCY_MAX_RESULT_BYTES` | `1048576` (1 MiB) | 1 byte to 16 MiB |
| `AI_GATEWAY_IDEMPOTENCY_STORE_MODE` | `memory` | `memory`, `sqlite`, or `postgres` |
| `AI_GATEWAY_IDEMPOTENCY_SQLITE_PATH` | none | Required in `sqlite` mode. Every process must use the same local file. |
| `AI_GATEWAY_IDEMPOTENCY_POSTGRES_URL` | none | Required in `postgres` mode. Load credentials from a secret manager and require TLS outside a trusted local network. |
| `AI_GATEWAY_IDEMPOTENCY_HMAC_SECRET` | none | Required in `sqlite` and `postgres` modes; at least 32 bytes and identical across processes. Load it from a secret manager, never source control. |
| `AI_GATEWAY_IDEMPOTENCY_LEASE_MS` | `300000` (5 minutes) | 1 second to 30 minutes |
| `AI_GATEWAY_IDEMPOTENCY_WAIT_MS` | `30000` (30 seconds) | 0 to 120 seconds |
| `AI_GATEWAY_IDEMPOTENCY_POLL_MS` | `50` | 10 to 1000 milliseconds |
| `AI_GATEWAY_IDEMPOTENCY_POSTGRES_POOL_MAX` | `4` | 1 to 32 connections per gateway process |
| `AI_GATEWAY_IDEMPOTENCY_POSTGRES_STATEMENT_TIMEOUT_MS` | `5000` | 100 milliseconds to 30 seconds |
| `AI_GATEWAY_TRUSTED_PROXY_CIDRS` | empty | Comma-separated direct proxy CIDRs allowed to supply `X-Forwarded-For`. Empty means trust no forwarding headers. |
| `AI_GATEWAY_MAX_FORWARDED_HOPS` | `32` | 1 to 128 addresses before the chain is rejected and the direct peer is used. |

Retention is bounded but response bodies may contain sensitive model output, so
operators should keep the TTL and result limit no larger than their retry and
privacy requirements require.

## Explicit boundaries

- This contract covers the provider-backed fall-through branch of `POST /chat`.
- Chat preview and owner-automation branches retain their separate approval and execution contracts.
- Streaming replay is intentionally unsupported.
- The default store is process-local memory. It does not provide cross-process or restart-safe coordination.
- SQLite mode adds restart-safe and same-host, multi-process coordination with atomic claims, bounded waits, lease heartbeats, and fail-closed unknown tombstones.
- PostgreSQL mode adds cross-host atomic claims, database-clock leases, monotonically increasing fencing tokens, bounded connection pools, and durable replay records. The provider call remains outside the database transaction.
- The built-in `node:sqlite` API is still experimental in Node 22.18.0. Pin and regression-test the Node patch release before enabling this optional mode.
- SQLite WAL is not safe as a cross-host coordination service and must not be placed on NFS or another network filesystem. Cross-host replicas still need an atomic distributed store implementation.
- PostgreSQL availability is part of the keyed-request safety boundary. Initialization or transaction failure returns `503 IDEMPOTENCY_STORE_UNAVAILABLE` before provider execution; completion uncertainty returns `created-unconfirmed` after provider execution.
- The PostgreSQL runtime creates its fixed `public.ai_gateway_idempotency_entries` table, fencing sequence, and indexes idempotently. Production operators may pre-provision these objects and then grant the gateway role only `SELECT`, `INSERT`, `UPDATE`, `DELETE`, and sequence `USAGE`.
- Neither mode claims globally exactly-once execution. A provider can finish while the gateway loses the response or durable completion write; unknown outcomes require reconciliation.
- Credential-scoped keys use an HMAC-derived caller identity. Requests without credentials use the network identity defined by the [trusted proxy and request identity contract](./trusted-proxy-identity-contract.md); untrusted or malformed forwarding chains fall back to the direct socket peer.
- `Idempotency-Key` is an established industry convention, but the related IETF document expired as an Internet-Draft in April 2026 and is not represented here as a final RFC.

This design follows the caller-intent and payload-consistency principles used by
major idempotent APIs while preserving honest operational boundaries for the
gateway's current local-first runtime.
