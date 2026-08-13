# Gateway SLO Benchmark

`gateway-slo-benchmark.mjs` is a credential-free black-box performance,
streaming-quality, and fault-isolation gate for the OpenAI-compatible
chat-completions route.

## Why Node ESM

Node ESM is the most appropriate implementation language for this harness:

- the gateway and CI runtime are already Node-based;
- built-in `fetch`, `performance`, child processes, and networking provide the
  required timing and lifecycle primitives without an extra dependency;
- the harness can validate the same JSON protocol the service exposes;
- using Rust or Go here would add build and supply-chain cost without improving
  the precision needed for a CI regression gate.

Application and reusable package code remains TypeScript-first. This `.mjs`
tool follows the repository's existing cross-platform operations-tool pattern.

## Managed CI profile

```bash
pnpm benchmark:gateway:slo
```

The default run:

- reserves a loopback port and starts the real gateway HTTP process;
- constructs a minimal child environment that does not forward credential
  variables;
- forces `providerMode=fake` and `realProviderEnabled=false`;
- warms up both response modes, then runs 80 non-streaming and 80 streaming
  requests with concurrency 8;
- validates every JSON response and every SSE stream against its OpenAI shape;
- records p50, p95, p99, throughput, errors, timeouts, status codes, response
  headers, first SSE event, first non-empty content delta, complete response,
  inter-content-chunk intervals, usage chunks, finish reasons, and `[DONE]`;
- sends malformed JSON and an oversized payload, then proves normal traffic and
  health recover;
- terminates the managed gateway in a `finally` path;
- writes evidence to `.tmp/gateway-slo-benchmark.json`.

The CI thresholds are deliberately conservative regression limits, not an
industry-performance claim:

| Metric | CI gate |
| --- | ---: |
| Error rate | 0 |
| Protocol-valid responses | 100% |
| p95 | <= 750 ms |
| p99 | <= 1500 ms |
| Successful throughput | >= 10 requests/s |
| Streaming error rate | 0 |
| Streaming protocol-valid responses | 100% |
| Streaming first-content p95 | <= 1000 ms |
| Streaming total-response p95 | <= 2500 ms |
| Successful streaming throughput | >= 5 requests/s |

Override a limit with a CLI option, or use `none` to observe a latency or
throughput metric without gating it.

## External comparison runs

The target is a complete, credential-free chat-completions endpoint:

```bash
pnpm benchmark:gateway:slo -- \
  --target http://127.0.0.1:4100/v1/chat/completions \
  --profile observe \
  --requests 1000 \
  --concurrency 32 \
  --output .tmp/comparison-candidate.json
```

The harness intentionally accepts no authorization header, API key, embedded
URL credential, query parameter, or fragment. For a protected target, expose a
temporary loopback-only adapter that owns authentication and pass its local URL
to the benchmark. Do not place credentials in command arguments or evidence.

Fault probes are automatic only for the managed local gateway. Add
`--fault-probes` to opt in for an external target.

## Metric semantics

- Latency uses a monotonic clock and includes HTTP response body receipt and
  JSON or SSE parsing.
- Percentiles use nearest-rank selection over successful, protocol-valid
  responses.
- Successful throughput is successful responses divided by measured wall time.
- Streaming first-content latency is measured to the first non-empty
  `choices[0].delta.content`. It is a protocol-level TTFT proxy, not proof of
  an upstream model's internal token emission timestamp.
- Inter-content-chunk latency is measured between non-empty content deltas. A
  local transport may coalesce multiple SSE events, so zero intervals are valid
  observations and should not be presented as provider token cadence.
- A valid managed stream requires SSE content type, parseable
  `chat.completion.chunk` events, content, finish reason, requested usage chunk,
  `[DONE]`, and fake execution metadata.
- Error rate includes non-200 responses, invalid protocol shapes, fake-mode
  safety failures in managed mode, transport errors, and timeouts.
- Warmup samples are reported separately and excluded from measured metrics.
- Managed evidence reports `realProviderCallsMade=false` only because the child
  is forced into fake-only mode and every measured response must report
  `unified_ai.execution_mode=fake`.

## Comparison boundary

A defensible gateway comparison must use the same host class, network path,
model or deterministic upstream, request payload, streaming mode, concurrency,
request count, timeout, and warmup policy. Run multiple trials and compare
distributions, not one best result. The local fake-provider run proves
repeatability and regression control; it does not prove production readiness or
superiority by itself.

The dimensions align with capabilities documented by major gateway vendors:

- [Cloudflare AI Gateway REST API](https://developers.cloudflare.com/ai-gateway/usage/rest-api/)
- [Cloudflare AI Gateway observability](https://developers.cloudflare.com/ai-gateway/observability/)
- [Kong AI Gateway](https://developer.konghq.com/ai-gateway/)
- [Kong AI Gateway OpenTelemetry metrics](https://developer.konghq.com/ai-gateway/ai-otel-metrics/)
- [Kong AI Gateway load balancing](https://developer.konghq.com/ai-gateway/load-balancing/)

These references define relevant dimensions such as compatibility, latency,
throughput, errors, retries, fallback, tokens, and cost. They are not evidence
that this repository outperforms those products.
