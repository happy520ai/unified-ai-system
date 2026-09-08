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

Native `/chat` and the compatibility request gate fail closed with HTTP 503
`VIRTUAL_KEY_ACCOUNTING_UNAVAILABLE` if an authenticated virtual-key request has
no accounting manager or admission cannot persist. Budget and rate exhaustion
remain HTTP 429. A storage failure degrades enterprise health and readiness.

## Storage and boundaries

- Keys are stored as SHA-256 hashes in `.data/enterprise/api-keys.json`
  (mode 0600, atomic writes, configurable via `PME_API_KEY_STORE_PATH`);
  plaintext values exist only in the one-time creation response.
- Each admission counter and completed token charge synchronously flushes the
  snapshot through an exclusively created temporary file, file sync and rename.
  A successful write survives an ordinary process restart without an unrelated
  create/revoke operation. Invalid or unreadable stores refuse startup; they are
  never replaced by an empty key set. `lastUsedAt` has no independent flush.
- Revoked keys are dropped from the store on next restart; revocation takes
  effect immediately in memory.
- Token budgets and minute rate limits use independent wall-clock windows.
  `requestCount` retains the original budget-window count; `rateRequestCount`
  reports the current minute. A v1 mixed-policy record conservatively carries
  its old rate count into the first minute of the upgrade without resetting spend.
- The JSON store is for one gateway process. It is not a distributed ledger or
  a strict reservation-based spend cap: concurrent in-flight work and output
  tokens can exceed the input estimate. A crash after provider work and before
  the completed token write can leave that charge unknown. File sync is not a
  claim of power-loss durability or network-filesystem support.

### Recover an accounting write failure

1. Pause new traffic and repair the configured storage permissions, free space
   or filesystem while keeping the gateway process alive. Do not replace the
   store with an empty file or restart to clear the degraded status.
2. The next admission first retries the complete retained in-memory snapshot.
   Only a successful flush restores health and allows policy checks to proceed.
   Already completed provider work is not automatically repeated. A failed
   admission may conservatively retain its request count.
3. Check authenticated key usage and readiness. If the process was lost before
   the charge committed, reconcile the unknown usage from independent provider
   evidence before restoring traffic. There is no automatic crash reconciliation
   or arbitrary counter-reset endpoint in this implementation.

Post-call write failures emit the safe `virtual_key_accounting_failed` event;
the completed response remains deliverable to avoid repeating paid work.
Storage paths, file contents and raw filesystem errors are not returned.

### Language Selection

Workload: make the existing synchronous virtual-key manager preserve usage and
report storage failure through existing HTTP and health paths. This is a local
change to existing ESM JavaScript with TypeScript declarations and regression
tests, without a new dependency or parallel store.

| Option | Domain | Maintenance | Operations | Safety | Migration | Ecosystem | Total |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Local JS fix with TS tests/declarations | 5 | 5 | 5 | 4 | 5 | 5 | 29 |
| Convert the whole manager and route modules to TS | 5 | 3 | 5 | 5 | 2 | 5 | 25 |

The local fix preserves the existing import and synchronous call contracts.
Additive v1 usage fields are readable by the old implementation, but rolling
back restores its old per-request persistence and mixed-window defects; pause
traffic and preserve the latest store before rollback. Synthetic restart,
write-failure, repair, HTTP rejection and legacy-record tests cover this boundary.
No provider selection, credential format or fake-provider default changes.
