# Response Cache Hot Path (`/v1/chat/completions`)

The response-cache subsystem (policy, store, tenant scoping, audit trail) is
now wired into the OpenAI-compatible chat hot path. When enabled, an identical
request from the same tenant replays the exact wire response without a
provider call.

The feature is **off by default** and never changes behavior unless
`AI_GATEWAY_RESPONSE_CACHE_ENABLED=true` is set on the gateway process.

## Semantic layer (L2, opt-in)

With `AI_GATEWAY_RESPONSE_CACHE_SEMANTIC_ENABLED=true`, requests that miss
the exact key are matched against a per-tenant in-memory vector index
(bounded to 200 entries per tenant) using the credential-free deterministic
embedding (`deterministic-hash-v1`). A nearest neighbor at or above
`AI_GATEWAY_RESPONSE_CACHE_SEMANTIC_THRESHOLD` (default 0.92, range (0,1))
replays that neighbor's payload; the service log records `hitType:
"semantic"` with the similarity score, and
`ai_gateway_chat_cache_events_total{layer="semantic",outcome="hit"}`
counts it.

Honesty note: the deterministic embedding approximates lexical/subword
overlap, not true semantics — paraphrases that share little vocabulary will
not hit. It makes the semantic layer exercisable with zero credentials;
plugging in a real embedding provider later raises quality without changing
the contract.

## Enable

```bash
AI_GATEWAY_RESPONSE_CACHE_ENABLED=true \
AI_GATEWAY_RESPONSE_CACHE_SEMANTIC_ENABLED=true \
pnpm gateway serve
```

Optional tuning:

| Variable | Default | Meaning |
| --- | --- | --- |
| `AI_GATEWAY_RESPONSE_CACHE_ENABLED` | `false` | Enables the hot-path cache. |
| `AI_GATEWAY_RESPONSE_CACHE_TTL_MS` | `604800000` (7 days) | Per-record TTL. |
| `AI_GATEWAY_RESPONSE_CACHE_MAX_PAYLOAD_BYTES` | `262144` (256 KiB) | Responses larger than this are not cached. |

`GET /cache/health` reports the effective hot-path configuration under
`chatHotPath`.

## What is cached

- Key input: normalized `messages`, `model`, resolved `providerId`, generation
  `options`, `requiredCapabilities`, and whether the request is streaming.
  Inline strings longer than 256 characters (for example base64 images) are
  hashed into the key, so the key payload stays bounded.
- Value: the exact OpenAI-compatible wire payload — the JSON body for
  non-streaming requests, or the ordered SSE chunk list (plus the optional
  usage chunk) for streaming requests. A cache hit replays byte-identical
  output.
- Storage and lifecycle reuse the existing response-cache store: JSONL records
  under `apps/ai-gateway-service/evidence/response-cache/`, TTL pruning, entry
  caps, and the audit trail surfaced at `POST /cache/audit`.

## Eligibility rules (fail-closed to "do not cache")

- The feature flag is off.
- The request carries `tools` (tool-call responses are not replayed yet).
- The request text or the response payload matches the secret-like sanitizer
  patterns (`api_key=...`, `Bearer ...`, `sk-...`, and similar).
- No server-authenticated tenant identity is present. Cache lanes are strictly
  per tenant (`tenant-v1` scoping); unauthenticated requests always execute
  normally.
- The serialized payload exceeds `AI_GATEWAY_RESPONSE_CACHE_MAX_PAYLOAD_BYTES`.

Cache lookup and write errors never fail the chat request; the hot path fails
open to normal provider execution.

## Operations

- Inspect hit/miss/write decisions: `POST /cache/audit` and
  `GET /cache/summary` (both tenant-scoped).
- Invalidate a specific entry: `POST /cache/invalidate` with the `cacheKey`
  reported in the service log (`openai_chat_cache_hit` /
  `openai_chat_stream_cache_hit` / cache write audit events).
- The store performs synchronous file writes on cache misses. For the local
  fake-provider gateway this is negligible; deployments with high request
  rates should measure before enabling broadly.

## Boundaries

- Only `POST /v1/chat/completions` (and its aliases) is cached. The internal
  `/chat` route, `/v1/messages`, `/v1/completions`, and `/v1/responses` keep
  their existing behavior.
- Prompt enhancement remains upstream of the cache: the key is computed from
  the post-enhancement gateway input, so enhanced and non-enhanced variants
  occupy different keys.
- Idempotent chat semantics are unaffected: the cache key never includes
  request IDs or idempotency keys.
