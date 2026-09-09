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
| Attempt settlement | Each actual Gateway Provider attempt settles once, including observed work before cancellation, fallback, or postprocessing failure. Complete reported totals take precedence; missing components use the existing text estimator. |
| Cache interactions | JSON and SSE hits consume a new admission and charge using the complete internal settlement snapshot saved with the cache entry. Wire usage fields do not control billing. |
| Native idempotency | Replaying a completed non-streaming `/chat` request under its original idempotency key does not consume another request admission or token charge; concurrent duplicates share the same execution. This remains true when the key's budget is later exhausted. |
| Rate limit | Optional per-key requests-per-minute fixed window; rejects with 429 `VIRTUAL_KEY_RATE_LIMITED`. |
| Soft budget | When usage crosses `softThreshold` (default 0.8) a `virtual_key_soft_budget` service log event is emitted once per crossing. |
| Execution scope | Native chat, OpenAI chat/Responses, Anthropic Messages, Gemini normal/SSE/batch and WebSocket chat enter the same Gateway accounting boundary. Trusted Agent proposer, Workforce role and shadow-call projections retain the request capability. |

Gemini batches perform one request/RPM admission using the sum of normalized
input estimates; each actual item attempt contributes its own settlement. This is
an input preflight, not a reservation of the batch's eventual output tokens.
An explicitly reported zero is a known zero; a legacy synthesized zero is not.
Missing input uses the estimate of the request actually sent after compaction.
Missing output uses observed text, tool names/arguments and exposed reasoning.
Known partial components are retained. Estimates are not exact tokenizer counts
or guaranteed upper bounds. Unobserved output after a disconnect remains unknown.
Each settlement records `reported`, `estimated`, `partial` or `unknown`, its
completion status and correlation IDs. Unknown use never becomes a fictitious
zero-token record. Hidden transport retries do not invent separate token totals.

For JSON and SSE response caching, a complete internal billing snapshot is captured
from the actual Gateway settlement. `stream_options.include_usage` controls
only the wire response. Older records without that snapshot, or records with
invalid billing fields, are misses for virtual-key requests and can cause a new
Provider call under the existing execution policy. Existing records are retained.
Non-key callers can still replay legacy entries. A cache hit is a new HTTP request
with its own admission and charge; it is distinct from native idempotent replay.

Incomplete usage or a failed counter/audit write cannot create an exact-billing
cache entry. A shadow or failed fallback attempt keeps its separate settlement;
the response cache saves the successful response's own charge. WebSocket ping
and control-plane reads do not consume a model request admission.

The provider-operation lane currently has no supported token-metering contract
for image, audio or embedding operations. Token-budgeted keys receive
`VIRTUAL_KEY_METERING_UNSUPPORTED` before dispatch. RPM-only keys can use this
lane, with unknown token evidence. Image counts, seconds and bytes are not
converted into tokens. This restriction is explicit; it is not full multimodal
billing or a claim that such work is free.

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

The execution-accounting workload uses a TypeScript helper for private capability,
attempt lifetime and cache receipt contracts, with focused changes to the existing
ESM JS and TS owners. Keeping only route-local JavaScript hooks scores lower on
safety and maintenance because internal calls bypass them and protocol handlers
duplicate settlement. A full language rewrite has the migration cost shown above.
The chosen mixed approach preserves imports, synchronous manager operations,
Provider selection and the fake default; it adds no dependency or state store.

This slice exceeds eight files and 500 lines because the Core switch, removal of
normal HTTP charges, explicit cache settlement, adapter observations, cancellation
lifetimes and trusted internal projections must agree in one release. Their
actual Core/manager, HTTP/WS, native-adapter and governed-role tests cover charge
count, partial usage, callback failure and replay boundaries. Roll these changes
back as a unit, pause key traffic and preserve counters; reverting only the Core
or HTTP half causes missing or duplicate charges. Synthetic tests do not establish
Provider invoices, complete interrupted usage, distributed reservations or
production billing accuracy.

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

Gateway accounting consumes these observations before cancellation checks can
discard a returned result or usage-only stream frame. Current ledger dollar
values remain its existing static fallback
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

### Request accounting capability

`apiKeyManager.checkContinuation` rechecks expiry, revocation and the remaining
token budget, and repairs a retained failed write, without charging another
request or checking RPM as a new admission. The private request-accounting module
uses this operation for bounded child invocations. Server-created capabilities
are bound through WeakMaps; JSON fields, cloned handles and object spreads cannot
forge or transfer them. Trusted context projections must explicitly inherit the
binding.

One capability admits one logical request. Each child invocation has its own
settlement promise shared by completion, error and cleanup paths. Known partial
use is marked incomplete; unknown use emits a correlated audit event without
recording a fictitious zero. Failed counter persistence retains the existing
manager's charged state; audit failure blocks further work in that request.
Neither failure becomes a retryable Provider error. Unsupported non-token
operations reject token-budgeted capabilities; RPM-only capabilities still admit
once and retain unknown token evidence. Fake work still consumes virtual quota.

The authenticated HTTP request binds the capability to Gateway execution;
normal protocol handlers no longer charge the same successful call again.
Explicit cache settlement and native idempotency replay retain their distinct
semantics. Its capability is request-local and provides no
distributed or in-flight reservation. It adds no persistent schema or dependency.
TypeScript expresses the private lifetime and receipt contracts; the existing JS
manager only extracts its current checks so admission and continuation cannot
drift. Roll back the execution binding together with this helper rather than
removing a dependency under active request execution.
