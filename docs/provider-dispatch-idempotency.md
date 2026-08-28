# Real-provider dispatch idempotency

Every non-fake provider attempt owned by `GatewayService` is protected by a
durable dispatch reservation before the adapter is allowed to run. This
contract covers native chat, OpenAI/Anthropic/Gemini compatibility routes,
streaming, multiple choices, fallback attempts, explicitly enabled shadow
traffic, Forge LLM calls, LLM prompt enhancement, bounded agent execution, and
the image-generation, embedding, text-to-speech, and speech-to-text HTTP
surfaces.

It is a conservative duplicate-spend boundary, not a claim of provider-side
exactly-once execution.

## Client contract

Real-provider requests require exactly one of `Idempotency-Key` or
`Provider-Dispatch-Key` by default. Both protect the provider dispatch. The
standard `Idempotency-Key` also opts into response replay on routes such as
`POST /chat`; `Provider-Dispatch-Key` creates only the durable provider
tombstone and does not consume response-cache capacity. Use the standard
header for a caller-stable retry whose completed response should be replayed.
Use the provider-only header for a fresh one-shot operation where a duplicate
must fail closed with `409` instead of replaying a response.

Generate one opaque key per intended client operation and reuse it only with
the same route and payload. Keys must contain 1-255 visible ASCII characters
with no spaces and must not contain prompts, credentials, email addresses,
tenant IDs, or other sensitive data. Supplying both headers is invalid.

Example:

```bash
curl http://127.0.0.1:3100/v1/chat/completions \
  -H "content-type: application/json" \
  -H "authorization: Bearer <gateway-token>" \
  -H "idempotency-key: $(uuidgen)" \
  -d '{"model":"gpt-4o-mini","messages":[{"role":"user","content":"Hello"}]}'
```

Configure an SDK's default headers when it does not generate the header itself.
Credential-free fake-provider requests remain usable without a key.

First-party clients generate a fresh `Provider-Dispatch-Key` for ordinary
calls so they do not fill the response-replay store. The shared SDK accepts
`request.idempotencyKey` for caller-stable response replay and
`request.providerDispatchKey` for an explicitly stable provider-only key; a
per-request field safely replaces a configured default provider key. The CLI
generates a per-command provider-only key. Forge gateway calls accept
`options.idempotencyKey` for response replay and otherwise generate a
provider-only key. Forge image, video, embedding, text-to-speech, and
speech-to-text calls apply the same rule, reuse one key across their bounded
HTTP retries, and carry gateway authentication without putting either key in
the payload.

`GatewayBridge` and the lower-level Forge LLM client distinguish transport
unavailability from an HTTP authentication/readiness response. Direct fallback
is permitted only before any gateway POST after an explicit transport probe
fails, or after the gateway returns authoritative fake-provider proof. Once a
chat or stream POST begins, an uncertain result raises
`FORGE_GATEWAY_OUTCOME_UNCERTAIN`; Forge does not issue a direct or non-stream
retry that could duplicate a billable operation.

Legacy Tianshu, GodReview, and neurogenesis capability calls now use the same
authenticated dispatch contract. Exact loopback gateway targets are pinned to
loopback; other destinations retain the public-unicast-only outbound policy.
Neurogenesis defaults to the core gateway port (`3100` or
`AI_GATEWAY_SERVICE_PORT`) rather than the development-console port. A bounded
GodReview HTTP retry reuses the original dispatch key.

## Execution order

For each non-fake attempt, the core gateway:

1. validates provider policy and checks that durable usage storage is healthy;
2. commits a durable provider-dispatch tombstone;
3. commits the enterprise `attempt-authorized` audit and write-ahead usage row;
4. invokes the provider adapter;
5. commits terminal usage evidence before reporting success.

No raw idempotency key is retained in the gateway execution context. HTTP
ingress immediately converts it to SHA-256; the durable record identity is
then HMAC-scoped to the authenticated tenant and route. The store persists
only derived identities and fingerprints. Logs expose only a correlation hash
that also incorporates the request, tenant, route lane, provider, and model.

One HTTP operation has a stable invocation lane for every core-gateway call.
Fallback attempts and shadow traffic use separate lanes. Therefore OpenAI
`n > 1`, Forge refinement passes, and bounded agent iterations cannot collide
with one another while a replay of the same operation is still recognized.

Streaming routes prime the first gateway event before committing SSE headers.
A missing, conflicting, duplicate, or unavailable reservation therefore keeps
its normal `400`, `409`, or `503` HTTP status instead of becoming a misleading
`200` stream.

## Outcomes

| Condition | HTTP/code | Provider adapter called |
| --- | --- | --- |
| Missing key while strict mode is enabled | `400 PROVIDER_DISPATCH_KEY_REQUIRED` | No |
| Malformed key or both key headers supplied | `400 PROVIDER_DISPATCH_KEY_INVALID` | No |
| Same key and lane already consumed | `409 PROVIDER_DISPATCH_ALREADY_RESERVED` | No |
| Same key and lane, changed request/provider/model | `409 PROVIDER_DISPATCH_KEY_REUSED` | No |
| Reservation completion cannot be confirmed | `409 PROVIDER_DISPATCH_RESERVATION_UNCONFIRMED` | No; manual reconciliation is required |
| Store capacity reached | `503 PROVIDER_DISPATCH_CAPACITY_REACHED` | No |
| Store unavailable or missing | `503 PROVIDER_DISPATCH_STORE_UNAVAILABLE` / `PROVIDER_DISPATCH_GATE_UNAVAILABLE` | No |
| First confirmed reservation | normal route behavior | Yes, once for that lane |

The dispatch tombstone intentionally does not cache a provider response.
`POST /chat` has a separate response-replay coordinator; compatibility routes
return `409` on a consumed dispatch key when no outer response cache can prove
the result. Use provider statements and the usage ledger to reconcile an
outcome that became unknown after the external request was sent.

## Configuration

| Environment variable | Default | Contract |
| --- | --- | --- |
| `AI_GATEWAY_PROVIDER_DISPATCH_KEY_REQUIRED` | `true` | Set `false` only as an explicit compatibility downgrade; cross-request duplicate protection is then bypassed for keyless calls. |
| `AI_GATEWAY_PROVIDER_DISPATCH_STORE_MODE` | `sqlite`, or `postgres` when a central URL is configured | `sqlite` or `postgres`; `disabled` is rejected in real-provider mode. |
| `AI_GATEWAY_PROVIDER_DISPATCH_SQLITE_PATH` | `.data/provider-dispatch.sqlite` | Same-host durable database. Never place its WAL on NFS. |
| `AI_GATEWAY_PROVIDER_DISPATCH_HMAC_SECRET` | generated restricted local secret in SQLite mode | Stable value of at least 32 bytes; PostgreSQL always requires an explicit stable secret. |
| `AI_GATEWAY_PROVIDER_DISPATCH_HMAC_SECRET_PATH` | `.data/provider-dispatch-hmac.key` | Restricted local secret file used only by SQLite mode. |
| `AI_GATEWAY_PROVIDER_DISPATCH_POSTGRES_URL` | usage-ledger or idempotency PostgreSQL URL | Cross-host database; must target the same database as the central usage ledger. |
| `AI_GATEWAY_PROVIDER_DISPATCH_POSTGRES_TLS_REQUIRED` | `true` | Non-loopback URLs require `sslmode=verify-full`. |
| `AI_GATEWAY_PROVIDER_DISPATCH_CENTRAL_REQUIRED` | `false` | Explicitly require PostgreSQL; multi-instance real-provider mode enables this requirement automatically. |
| `AI_GATEWAY_PROVIDER_DISPATCH_TTL_MS` | `86400000` | 1 minute to 24 hours. Expiry ends duplicate protection, so choose a window longer than client retry/reconciliation behavior. |
| `AI_GATEWAY_PROVIDER_DISPATCH_MAX_ENTRIES` | `100000` | 1 to 1,000,000 retained reservations. Capacity is fail-closed. |

PostgreSQL uses dedicated objects, isolated from normal HTTP response
idempotency:

- `public.ai_gateway_provider_dispatch_entries`
- `public.ai_gateway_provider_dispatch_fencing_seq`
- dedicated expiry and lease indexes

This prevents provider tombstones from consuming the capacity of
`public.ai_gateway_idempotency_entries`. Every replica must share the same
database and HMAC secret. Health is exposed as the redacted `providerDispatch`
object on `/healthz` and `/ready`; Prometheus metrics use the
`ai_gateway_provider_dispatch_*` prefix.

## Honest boundaries

- A reservation is written before the network call. A crash immediately after
  reservation can consume the key even though the provider was not contacted.
  This favors no duplicate spend over automatic retry.
- A provider can accept work while the gateway loses the response. The local
  tombstone cannot prove the provider outcome and is not a substitute for
  provider-side idempotency or statement reconciliation.
- Protection ends when the configured TTL expires.
- SQLite coordinates processes on one host only. Cross-host replicas require
  PostgreSQL.
- The contract covers provider attempts that enter `GatewayService`, including
  multimodal operations through `executeProviderOperation`. A new direct
  adapter sink is not covered merely because it uses the same credentials; it
  must explicitly re-enter this lifecycle and prove that boundary in tests.
- Online Knowledge `sqlite-vec` remains deterministic unless an injected
  embedding provider carries the governed-operation marker. Environment
  embedding credentials alone cannot activate an unmetered direct HTTP sink.
  The explicit vector production probe remains an operator-run diagnostic, not
  an online application execution path.
