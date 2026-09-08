# Virtual Keys (uai-) — Budgets and Rate Limits

Virtual keys are consumer-facing credentials for the OpenAI-compatible chat
surface. An operator issues a key; the key's consumer calls
`POST /v1/chat/completions` with it as a Bearer token; the gateway attributes
spend to that key, enforces a periodic token budget and an optional
per-minute request limit, and revokes keys instantly.

Real provider keys never leave the gateway — consumers only ever hold virtual
keys.

## Issue and manage keys (operator, `user:admin` permission)

```bash
# Create a chat key bound to tenant-a with a daily 1M-token budget,
# a soft-budget alert at 80%, and a 60 RPM limit.
curl -X POST http://127.0.0.1:3100/enterprise/virtual-keys \
  -H "x-pme-auth-token: <admin token>" \
  -H "x-pme-tenant-id: <tenant>" \
  -H "content-type: application/json" \
  -d '{
    "role": "operator",
    "tenantId": "tenant-a",
    "description": "mobile app backend",
    "budget": { "limitTokens": 1000000, "window": "daily" },
    "rateLimit": { "requestsPerMinute": 60 }
  }'
```

The response returns the raw `uai-...` key exactly once. Role permissions
follow the standard role map — use `operator` for chat-capable keys
(`chat:use`); `viewer` keys cannot call chat routes.

```bash
# List keys with live budget status (tenant-scoped).
curl http://127.0.0.1:3100/enterprise/virtual-keys \
  -H "x-pme-auth-token: <admin token>" -H "x-pme-tenant-id: <tenant>"

# Revoke immediately.
curl -X POST http://127.0.0.1:3100/enterprise/virtual-keys/revoke \
  -H "x-pme-auth-token: <admin token>" -H "x-pme-tenant-id: <tenant>" \
  -H "content-type: application/json" \
  -d '{ "keyId": "<fingerprint>" }'
```

Creation and revocation are recorded in the enterprise audit log. `GET
/enterprise/health` reports key-store health under `apiKeys`.

## Using a key

```bash
curl http://127.0.0.1:3100/v1/chat/completions \
  -H "authorization: Bearer uai-..." \
  -H "content-type: application/json" \
  -d '{"model":"<model>","messages":[{"role":"user","content":"hi"}]}'
```

The key authenticates through the same enterprise governance layer as user
tokens: role permissions, tenant binding, expiry, and revocation all apply.
The tenant header is not required — the key's own tenant is used.

## Enforcement semantics

| Rule | Behavior |
| --- | --- |
| Budget window | Fixed windows (`daily` = 24h, `monthly` = 30d, or an explicit `windowMs`), keyed by wall-clock window index; usage resets automatically at rollover. |
| Pre-request check | Before the provider call, the gateway estimates input tokens and rejects with HTTP 429 `VIRTUAL_KEY_BUDGET_EXHAUSTED` if the estimate would exceed the remaining budget. |
| Post-request record | Actual total tokens are recorded after success (upstream usage when available, conservative estimates otherwise). Streaming records from the final stream event, falling back to input estimate + output text estimate. |
| Cache interactions | Response-cache hits still consume budget (they are real requests); replayed usage comes from the cached payload. |
| Native idempotency | Replaying a completed non-streaming `/chat` request under its original idempotency key does not consume another request admission or token charge; concurrent duplicates share the same execution. This remains true when the key's budget is later exhausted. |
| Rate limit | Optional per-key requests-per-minute fixed window; rejects with 429 `VIRTUAL_KEY_RATE_LIMITED`. |
| Soft budget | When usage crosses `softThreshold` (default 0.8) a `openai_chat_virtual_key_soft_budget` service log event is emitted once per crossing. |
| Scope (v1) | Enforcement covers `POST /v1/chat/completions` and its aliases (streaming and non-streaming), plus non-streaming native `POST /chat` used by the MCP `gateway_chat` tool. Other routes authenticate the key but do not yet attribute spend. |

Native `/chat` fails closed with HTTP 503 `VIRTUAL_KEY_ACCOUNTING_UNAVAILABLE`
if an authenticated virtual-key request has no accounting manager. The existing
compatibility-lane helper still fails open when its manager is absent. These
different wiring boundaries must not be described as one global guarantee.

## Storage and boundaries

- Keys are stored as SHA-256 hashes in `.data/enterprise/api-keys.json`
  (mode 0600, atomic writes, configurable via `PME_API_KEY_STORE_PATH`);
  plaintext values exist only in the one-time creation response.
- Key-management operations persist the current record snapshot, but live
  request/token counter changes are not durably flushed for every request.
  A process restart can therefore reload an older usage snapshot; this code does
  not establish restart-safe budget enforcement. `lastUsedAt` is memory-only.
- Revoked keys are dropped from the store on next restart; revocation takes
  effect immediately in memory.
- Rate-limit windows are per-process (single gateway instance); budget windows
  are wall-clock derived. The shared control-center smoke proves three MCP
  sessions accounting against one live gateway, not durable cross-restart or
  distributed budget enforcement.
