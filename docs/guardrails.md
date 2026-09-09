# Chat Guardrails

Deterministic, local, zero-credential guardrails on the OpenAI-compatible
chat hot path — the self-hosted answer to cloud guardrail tiers. Every rule
is a local scan with an explicit action; nothing leaves the process and no
extra credentials are required.

- **Opt-in**: `AI_GATEWAY_GUARDRAILS_ENABLED=true` (mirrors the response cache)
- **Bounded output inspection**: enabled output rules inspect complete message text before releasing streamed content
- **Tenant-scoped at runtime**: `GET/PUT /enterprise/guardrails` (admin), bound to the authenticated tenant

## Where guardrails run

| Stage | Applies to | Effect |
| --- | --- | --- |
| Input | Message text on the chat routes listed below, before Provider dispatch | `block` → HTTP 400 `guardrail_blocked`; `redact` → message text rewritten (redacted text also becomes the chat cache key input) |
| Output (JSON) | Final assistant text | `redact` rewrites the payload; `block` returns 400 after generation |
| Output (SSE) | Complete assistant body text accumulated across deltas | Bounded inspection before releasing text; split patterns receive the same block/redact treatment as complete strings |

The internal `/chat` and `/chat/stream` routes also use this engine. The separate
in-service content guard (`CONTENT_GUARDRAIL_BLOCKED`) remains an additional
Gateway boundary.

## Streaming and replay

When guardrails are enabled and an applicable output rule is active, the stream
retains at most 200,000 JavaScript string characters, 1,048,576 bytes of event
JSON and 4,096 events. Exceeding a bound returns `guardrail_output_limit` and
closes the source. A blocking rule returns `guardrail_blocked`. Each protocol
keeps its existing error shape; Anthropic uses `api_error` with the explicit
guardrail message.

Visible content waits until the source completes and passes inspection. Safe
redacted text may be combined into an existing text delta; tool events retain
their order. A source failure or cancellation discards withheld text and awaits
normal iterator cleanup. The terminal event retains the existing usage identity.
Disabling output checks preserves incremental streaming. Provider work already
performed can consume budget even when its output is blocked.

Stream and chat-cache inspection use a server-captured rule snapshot. An update
during generation applies to subsequent requests. Exact and approximate cache
matches require the same output-policy fingerprint; request metadata cannot
choose it. Entries from a different policy are misses and may require a new
Provider call. Old entries remain subject to their existing retention policy.

Stored Responses are scoped to the authenticated tenant and caller. Reading one
checks the current caller's output rules, and blocked generated output is not
stored as a successful response. See [Responses sessions](openai-compatible-api.md).

## Built-in rules and default actions

| Rule | Default action | What it matches |
| --- | --- | --- |
| `input.pii.email` | `redact` | Email addresses → `[redacted-email]` |
| `input.pii.phone` | `redact` | E.164 / grouped phone forms → `[redacted-phone]` |
| `input.secrets` | `block` | Pasted provider/cloud credentials (`sk-…`, `sk-ant-…`, `uai-…`, `AKIA…`, `ghp_…`, `AIza…`, `xox…`) |
| `input.injection` | `warn` | Common instruction-override / system-prompt exfiltration phrasings |
| `input.limits` | `block` | Cumulative characters across **all** messages above `maxInputChars` (default 200,000) |
| `output.pii.email` | `redact` | Emails echoed by the model |
| `output.pii.phone` | `redact` | Phones echoed by the model |
| `output.secrets` | `redact` | Credential-looking strings in responses |
| `banned.terms` | `block` | Configurable literal term list (input and output); `redact` replaces matches with `[redacted-term]` |

Actions: `off | warn | redact | block`.

Term matching is case-insensitive and literal, with the longest match taking
precedence at the same position. Findings count non-overlapping matches.
The input-only `input.injection` and `input.limits` rules currently implement
`off`, `warn` and `block`; their accepted `redact` setting reports a finding
without rewriting or truncating input. Use `block` when prevention is required
for those two rules. This limitation does not apply to PII, secrets or term
redaction.

## Configuration

Env (process-wide defaults, JSON):

```bash
AI_GATEWAY_GUARDRAILS_ENABLED=true
AI_GATEWAY_GUARDRAILS_CONFIG='{"rules":{"input.injection":"block"},"bannedTerms":["internal-codename"]}'
AI_GATEWAY_GUARDRAILS_STORAGE_DIR='.data/enterprise/guardrails'
```

Runtime overrides are isolated by credential tenant and persisted beneath
`.data/enterprise/guardrails/` by default. Tenant identifiers are
domain-separated and SHA-256 hashed before becoming filenames, so raw tenant
identifiers are not exposed through the filesystem. Updates are audited as
`enterprise_guardrails_updated`:

```bash
curl -X PUT http://127.0.0.1:3100/enterprise/guardrails \
  -H "authorization: Bearer $ADMIN_KEY" \
  -H "x-pme-tenant-id: $TENANT_ID" \
  -H "content-type: application/json" \
  -d '{"enabled":true,"rules":{"input.injection":"block"},"bannedTerms":["internal-codename"]}'
```

`GET /enterprise/guardrails` returns only the authenticated tenant's effective
config. A conflicting `x-pme-tenant-id` is rejected rather than accepted as an
administrative tenant override. Invalid rule names, actions, and terms are
ignored (never crash the hot path).

## Metrics

Prometheus counters on `/metrics`:

- `ai_gateway_guardrail_evaluations_total{stage,decision}`
- `ai_gateway_guardrail_findings_total{rule,action}`

The [earlier benchmark](benchmarks/2026-08-gateway-benchmark.md) measured its own
scan workload. It does not measure the latency of this buffered streaming
profile. Input blocking occurs before dispatch; output blocking occurs after
the inspected Provider work.

## Honest boundaries

- The injection rule is a deterministic phrase heuristic, not a classifier —
  it warns on common phrasings and is trivially bypassed by paraphrase.
- Phone detection covers E.164 and common grouped forms only.
- Output checks cover assistant message text. Function arguments, protocol
  metadata and exposed reasoning are separate fields, not a general data-loss
  prevention surface.
- Enabled streaming inspection adds completion latency and enforces the fixed
  bounds above. No new throughput or production-latency claim is made.

## Route Coverage

The engine covers all chat surfaces with the same rules and tenant
overrides:

- `/v1/chat/completions` and `/v1/completions` (input and output)
- `/v1/messages` (Anthropic profile)
- `/v1/responses` (Responses API — input on normalized messages, output on
  `output_text`, buffered stream inspection and current-rule stored retrieval)
- `/chat` and `/chat/stream` (internal lane)
- `/v1beta/models/*:generateContent` (Gemini inbound lane)

RAG context injected via `unified_ai.rag` is re-inspected before injection;
a block-level finding aborts the injection (not the request).

## Language Selection and rollback

The workload is bounded text inspection and asynchronous iteration. TypeScript
keeps the existing guardrail/cache contracts checked; local JS route changes
reuse the same inspector. A new parser service or streaming state-machine
framework would add ownership and cancellation boundaries without meeting an
additional current requirement.

This change crosses the scope checkpoint because six stream profiles, exact and
approximate caches, stored Responses and their regression tests must agree.
The selected bounded buffer preserves disabled-profile streaming and makes the
enabled-profile latency explicit. No dependency, service, endpoint or database
schema is introduced for inspection. Roll back the matching route, guardrail,
cache and session changes together after draining affected traffic; reverting
only one replay or stream path restores a bypass. Retain the existing cache and
configuration data. The tests establish local protocol and accounting behavior,
not Provider-side invoices or production capacity.
