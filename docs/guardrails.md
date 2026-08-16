# Chat Guardrails

Deterministic, local, zero-credential guardrails on the OpenAI-compatible
chat hot path — the self-hosted answer to cloud guardrail tiers. Every rule
is a local scan with an explicit action; nothing leaves the process and no
extra credentials are required.

- **Opt-in**: `AI_GATEWAY_GUARDRAILS_ENABLED=true` (mirrors the response cache)
- **Fail-open**: any engine error never changes the chat response
- **Configurable at runtime**: `GET/PUT /enterprise/guardrails` (admin)

## Where guardrails run

| Stage | Applies to | Effect |
| --- | --- | --- |
| Input | `/v1/chat/completions` and `/v1/messages` (JSON + SSE), before normalization, cache, and the provider call | `block` → HTTP 400 `guardrail_blocked`; `redact` → message text rewritten (redacted text also becomes the cache key input) |
| Output (JSON) | Final assistant text on both protocol surfaces | `redact` rewrites the payload; `block` returns 400 after generation |
| Output (SSE) | Each streamed delta on both protocol surfaces | Best-effort per-chunk redaction; cross-boundary patterns surface as findings |

The internal `/chat` protocol keeps its own in-service content guard
(`CONTENT_GUARDRAIL_BLOCKED`) and is unaffected by this engine's rule set.

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
| `banned.terms` | `block` | Configurable term list (input and output) |

Actions: `off | warn | redact | block`.

## Configuration

Env (process-wide defaults, JSON):

```bash
AI_GATEWAY_GUARDRAILS_ENABLED=true
AI_GATEWAY_GUARDRAILS_CONFIG='{"rules":{"input.injection":"block"},"bannedTerms":["internal-codename"]}'
```

Runtime override (persisted to `.data/enterprise/guardrails-config.json`,
audited as `enterprise_guardrails_updated`):

```bash
curl -X PUT http://127.0.0.1:3100/enterprise/guardrails \
  -H "authorization: Bearer $ADMIN_KEY" \
  -H "content-type: application/json" \
  -d '{"enabled":true,"rules":{"input.injection":"block"},"bannedTerms":["internal-codename"]}'
```

`GET /enterprise/guardrails` returns the effective config. Invalid rule
names, actions, and terms are ignored (never crash the hot path).

## Metrics

Prometheus counters on `/metrics`:

- `ai_gateway_guardrail_evaluations_total{stage,decision}`
- `ai_gateway_guardrail_findings_total{rule,action}`

Measured overhead on the benchmark workload: **< 0.2 ms mean**
([benchmark](benchmarks/2026-08-gateway-benchmark.md)); blocking rules
short-circuit before the provider call.

## Honest boundaries

- The injection rule is a deterministic phrase heuristic, not a classifier —
  it warns on common phrasings and is trivially bypassed by paraphrase.
- Phone detection covers E.164 and common grouped forms only.
- SSE output redaction is per-chunk; a pattern split across two chunks is
  recorded as a finding rather than rewritten.
