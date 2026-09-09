# Virtual Keys (uai-) — Budgets and Rate Limits

Virtual keys are consumer-facing credentials for gateway chat APIs.
An operator issues a key; for example, the key's consumer calls
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
| Soft budget | When usage crosses `softThreshold` (default 0.8) a `virtual_key_soft_budget` service log event is emitted once per crossing. |
| Validated scope | OpenAI chat/completions and aliases, non-streaming native `/chat`, and Gemini normal/SSE/batch have per-key gates and successful-result charging. Anthropic Messages and Responses also have route-local accounting hooks; their interruption/unknown-usage handling still requires the unified accounting work below. |

Gemini batches perform one request/RPM admission using the sum of normalized
input estimates; each successful item contributes its own token charge. This is
an input preflight, not a reservation of the batch's eventual output tokens.
Completed text without a valid positive reported total uses the existing text
estimator and records `calculationSource: estimated`; positive valid totals use
`reported`. A normalized zero cannot yet distinguish a genuine reported zero
from missing upstream usage. Failed/interrupted calls and non-token operations
still need the broader accounting coverage work; do not read them as free usage.

For SSE response caching, the same internal billing snapshot settles both the
live response and later cache requests. `stream_options.include_usage` controls
only the wire response. Older SSE records without that snapshot, or records with
invalid billing fields, are misses for virtual-key requests and can cause a new
Provider call under the existing execution policy. Existing records are retained.
Non-key callers can still replay legacy entries. A cache hit is a new HTTP request
with its own admission and charge; it is distinct from native idempotent replay.

Native stream/route variants, internal Workforce/Forge/Agent/proposer calls,
WebSocket messages and multimodal requests are not yet universally covered by
these route-local hooks. Attempt ledgers and metrics do not prove per-key charging.

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

The protocol coverage slice reuses the existing JS compatibility helper and
TypeScript Gemini/cache owners, with no dependency or persistence migration.
Its workload is route admission plus a versioned internal cache payload, not a
new billing service; the local JS/TS approach keeps the score above and avoids
rewriting unrelated routes. Rolling back reintroduces the missing Gemini charges
and inconsistent SSE-cache totals; preserve counters and pause affected traffic.
Real-manager synthetic-route tests cover batch admission, native idempotency,
cache wire options, legacy refusal and cache-store reload. They do not establish
actual Provider invoices, complete interrupted usage, distributed reservations
or production billing accuracy.

### Provider usage observations

The OpenAI mapper and native Anthropic/Gemini adapters now retain a versioned
`raw.usageObservation` before filling legacy numeric fields. It distinguishes
reported totals (including explicit zero), totals derived from complete reported
components, partial known counts and missing usage. Negative, fractional, unsafe,
coerced or contradictory counts are invalid; `totalTokens: null` is not a free
request. `complete` describes the observed protocol termination, not invoice
reconciliation. Cumulative stream snapshots replace earlier counts; they are not
added together. Usage-only frames stay available to Gateway execution without
becoming application output or disabling the existing pre-output fallback.

Canonical input includes Anthropic uncached input plus cache reads and creation.
Canonical output includes Gemini visible output plus thoughts. OpenAI reasoning
and cached-input fields already form subsets of its reported counts. Gemini and
Anthropic response translators split these canonical counts back into their
respective wire fields, avoiding double counting. These rules follow the
[OpenAI chunk schema](https://developers.openai.com/api/reference/cli/__sdk_schema?declaration=%28resource%29+chat.completions+%3E+%28model%29+chat_completion_chunk+%3E+%28schema%29&selected=%28resource%29+chat.completions),
[Anthropic cache usage contract](https://platform.claude.com/docs/en/build-with-claude/prompt-caching?s=09)
and [Gemini UsageMetadata](https://ai.google.dev/api/generate-content).

This observation slice does not yet activate unified request accounting. The
route-local charge helper still needs migration to consume provenance and settle
interrupted work. Current ledger dollar values remain its existing static fallback
estimates; corrected token totals do not provide cache-tier pricing or an actual
Provider invoice. Earlier failed attempts and missing stream remainders remain
unknown until independently reconciled.

Language Selection: the new bounded mapping helper uses TypeScript alongside
the existing TS Gemini owner and ESM JS OpenAI/Anthropic owners. A local helper
keeps the same count-validation contract at all three actual protocol boundaries;
rewriting the adapters or adding a billing dependency would not improve this
workload. The slice exceeds eight files because both response translators and
Gateway's stream-emission boundary must change together to prevent count and
fallback regressions. Adapter/translator regressions and the actual Gateway
fallback/cancellation suites cover these interactions. There is no new state
store, dependency, credential read or Provider selection rule. Revert this slice
as a unit to preserve compatibility; doing so restores the old counting and
missing-observation defects, so pause affected key traffic before rollback.
