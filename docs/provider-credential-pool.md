# Provider Credential Pool (multi-key rotation)

A single provider can hold many API keys and rotate between them per request,
instead of being limited to one credential. This is an additive layer over the
existing single-credential store: a provider with no pool behaves exactly as
before.

## What it does

- **Weighted selection.** Each request picks a key weighted by
  `balance × remaining validity`, so keys with more credit and a later expiry
  are preferred. Keys that are expired, exhausted, or temporarily benched are
  skipped.
- **Failover on rejection.** An auth or quota rejection (HTTP 401/403, or a
  rate-limit/authentication error type) benches that key for a cooldown
  (default 10 minutes) and retries with another key. Non-auth failures (e.g.
  HTTP 500) do **not** bench a key.
- **Bounded but larger rotation budget.** A pooled provider may use more
  attempts than `maxRetries`, because each attempt consumes a *different*
  credential. The bound is capped at 8 attempts.

A pool with no usable key (all keys benched or exhausted) fails closed with
`<PROVIDER>_CREDENTIAL_POOL_EXHAUSTED` rather than sending an empty key.

## Configuration

| Variable | Purpose |
|---|---|
| `SENSEAUDIO_POOL_ENABLED=true` | Serve the `senseaudio` provider from a pool instead of a single key. |
| `PME_CREDENTIAL_POOL_STORE_MODE` | `memory` (default), `local-file`, or `sqlite`. Non-memory modes encrypt at rest. |
| `PME_CREDENTIAL_POOL_STORE_PATH` | Pool store location (defaults under the local app data dir). |
| `PME_RUNTIME_CREDENTIAL_MASTER_KEY` | Required for encrypted persistence (32 bytes, base64 or hex). |
| `PME_CREDENTIAL_POOL_MAX_ENTRIES` | Optional entry cap per pool (defaults to an effectively unbounded internal limit). |

When a pool is enabled, `SENSEAUDIO_API_KEY` is not required: credentials are
supplied per request from the pool.

Encrypted mode fails closed at startup when no master key is configured. If the
pool store cannot be constructed, the gateway logs
`credential_pool_init_failed` and continues **without** a pool — degrading to
the previous single-key behavior rather than refusing to start.

## Loading keys

Keys are written through the authenticated HTTP boundary, which requires the
`provider:write` permission:

```bash
curl -X POST http://127.0.0.1:3100/providers/credential-pool \
  -H "Authorization: Bearer <gateway-token>" \
  -H "Content-Type: application/json" \
  -d '{
    "providerId": "senseaudio",
    "entries": [
      { "key": "sk-...", "balance": 60, "expire": "2026-11-11T00:22:00+08:00" },
      { "key": "sk-...", "balance": 30, "expire": "2026-11-04T18:30:31+08:00" }
    ]
  }'
```

`balance` defaults to 0 (excluded from selection) and `expire` is optional (a
key with no expiry is treated as long-lived). Duplicate keys in one call are
deduplicated, last-write-wins.

## Inspecting state

`GET /providers` reports counts only, never key material:

```json
{
  "credentialPoolConfigured": true,
  "credentialPoolSize": 286,
  "credentialPoolAlive": 283,
  "credentialPoolBenched": 0,
  "credentialPoolExhausted": 3
}
```

No gateway output path — logs, API responses, or `/providers` — contains a key
or a reversible fingerprint of one.

## Operational notes

- Real-provider mode additionally requires a configured signed audit checkpoint
  and, for outbound dispatch, an explicit idempotency key header
  (`provider-dispatch-key`). Both are deliberate governance gates, not pool
  behavior.
- A pool never triggers provider calls on its own. Key health is updated only by
  real request outcomes; there is no background probing.
- Recharge or clear a pool by writing the full desired entry set again, or set
  `entries: []` to empty it.
