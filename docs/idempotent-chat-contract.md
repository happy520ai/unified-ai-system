# Idempotent chat request contract

The provider-backed `POST /chat` path accepts an optional `Idempotency-Key`
request header. It lets a caller retry an uncertain non-streaming request
without starting the same provider execution twice inside one gateway process
and retention window.

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
| First request | Original status and body | `Idempotency-Status: created` and `Idempotency-Replayed: false`. |
| Same caller, key, route, and body | Cached status and body | `Idempotency-Status: replayed` and `Idempotency-Replayed: true`. Concurrent duplicates share the first execution. |
| Same caller and key, different body | `409` / `IDEMPOTENCY_KEY_REUSED` | The gateway refuses ambiguous caller intent. |
| Result exceeds the cache bound | First result is returned; later retry receives `409` / `IDEMPOTENCY_RESULT_NOT_REPLAYABLE` | A tombstone prevents another provider call without retaining an oversized response. |
| Execution throws after it starts | First attempt follows normal error handling; later retry receives `409` / `IDEMPOTENCY_PREVIOUS_ATTEMPT_FAILED` | The gateway fails closed rather than risking duplicate provider work. |
| Store at capacity | `503` / `IDEMPOTENCY_CAPACITY_REACHED` with `Retry-After` | New keyed work is rejected until retained entries expire. |

The response headers are included in `Access-Control-Expose-Headers`. On a
replay, the JSON response keeps the original provider execution request ID,
while `x-request-id` identifies the current HTTP transport attempt.

## Bounds and configuration

| Environment variable | Default | Bound |
| --- | ---: | ---: |
| `AI_GATEWAY_IDEMPOTENCY_TTL_MS` | `600000` (10 minutes) | 1 second to 24 hours |
| `AI_GATEWAY_IDEMPOTENCY_MAX_ENTRIES` | `1000` | 1 to 100000 entries |
| `AI_GATEWAY_IDEMPOTENCY_MAX_RESULT_BYTES` | `1048576` (1 MiB) | 1 byte to 16 MiB |

Retention is bounded but response bodies may contain sensitive model output, so
operators should keep the TTL and result limit no larger than their retry and
privacy requirements require.

## Explicit boundaries

- This contract covers the provider-backed fall-through branch of `POST /chat`.
- Chat preview and owner-automation branches retain their separate approval and execution contracts.
- Streaming replay is intentionally unsupported.
- The default store is process-local memory. It does not provide cross-process, cross-replica, restart-safe, or globally exactly-once execution.
- A distributed deployment needs an atomic shared store and a documented lease/recovery protocol before it can claim the same guarantee across replicas.
- `Idempotency-Key` is an established industry convention, but the related IETF document expired as an Internet-Draft in April 2026 and is not represented here as a final RFC.

This design follows the caller-intent and payload-consistency principles used by
major idempotent APIs while preserving honest operational boundaries for the
gateway's current local-first runtime.
