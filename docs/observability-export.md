# Observability: AI Metrics and Langfuse Export

## Prometheus (`GET /metrics`)

Beyond the existing runtime/resilience metrics, the exposition now includes
chat-specific series under the `ai_gateway_` prefix:

| Metric | Type | Labels | Meaning |
| --- | --- | --- | --- |
| `ai_gateway_chat_requests_total` | counter | `route`, `stream` | Requests handled on the OpenAI-compatible hot path (hits included). |
| `ai_gateway_chat_tokens_total` | counter | `model`, `direction` | Token usage attributed per model (input/output; upstream usage or conservative estimates for streams). |
| `ai_gateway_chat_ttft_ms` | histogram | `route` | Time to first token for streaming requests. |
| `ai_gateway_chat_cache_events_total` | counter | `layer`, `outcome` | Response-cache outcomes (`hit` / `miss` / `write` / `bypassed`). |
| `ai_gateway_chat_virtual_key_rejections_total` | counter | `code` | Virtual-key budget/rate rejections. |

Label cardinality is capped (200 series per metric); unseen combinations
beyond the cap are dropped instead of growing memory.

## Langfuse export (opt-in)

Set both keys to enable generation export to the Langfuse ingestion API:

```bash
LANGFUSE_PUBLIC_KEY=pk-lf-... \
LANGFUSE_SECRET_KEY=sk-lf-... \
LANGFUSE_HOST=https://cloud.langfuse.com \   # optional, default cloud.langfuse.com
LANGFUSE_CAPTURE_CONTENT=true               # optional, default true
pnpm gateway serve
```

- Completed chat requests (streaming and non-streaming, cache hits included)
  are exported as `generation-create` events with usage, model, provider,
  latency, cache-hit flag, and the virtual-key fingerprint (never the key).
- Input/output text is captured truncated to 4,000 characters; set
  `LANGFUSE_CAPTURE_CONTENT=false` to export usage/metadata only.
- Events are batched (≤50 per request, 5s flush interval, 500-event queue
  cap). Export is fail-open: network or auth failures are dropped silently
  and never affect the chat path. Non-retryable 4xx responses are not
  retried; transient failures get one retry.
- The egress target goes through the same outbound URL policy as provider
  calls.
