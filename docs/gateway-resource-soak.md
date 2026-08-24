# Gateway Resource Stability Soak

`gateway-resource-soak.mjs` turns the gateway's process-resource metrics into a
credential-free, fail-closed regression gate.

## Why Node ESM

This tool coordinates a Node gateway child process, sends OpenAI-compatible
requests, and parses the gateway's Prometheus output. Node ESM is the most
appropriate language for this lifecycle and protocol work because it uses the
same cross-platform runtime without adding a build dependency. The existing Go
open-loop benchmark remains the independent high-precision arrival scheduler
for backpressure and interruption testing.

## CI profile

```bash
pnpm benchmark:gateway:resource-soak
```

The managed CI profile:

- starts a loopback-only gateway with the fake provider and no credential
  environment or persisted runtime credential store;
- redirects enterprise user/audit state to an isolated `.tmp` path and uses an
  in-memory runtime credential store;
- primes the runtime monitor before warmup so process bootstrap is excluded
  from the event-loop utilization gate;
- warms up 80 requests before recording the memory baseline;
- schedules 100 requests per second for 12 seconds;
- keeps 64 bounded client slots and requires at least 80% of fixed arrivals to
  start, so the resource workload remains substantial without turning latency
  backlog into an unbounded memory-pressure test;
- dispatches `/metrics` scrapes on fixed 500-millisecond targets without making
  the next target wait for the previous scrape response;
- requires zero errors for every started request and complete OpenAI response
  shapes; client shedding is recorded, while the preceding open-loop gate owns
  the separate 100 RPS / zero-drop capacity contract;
- gates heap and RSS growth using both absolute and relative allowances;
- gates event-loop p99 delay and utilization;
- proves that resource metrics contain real histogram samples;
- terminates the managed gateway in a `finally` path;
- writes `.tmp/gateway-resource-soak.json`.

The first and last three resource samples are reduced to medians so a single GC
or scrape outlier does not decide the result. The report also records linear
memory trend, peak memory, CPU delta, scheduler lag, every raw resource sample,
and scrape failures.

## Longer observation

```bash
pnpm benchmark:gateway:resource-soak -- \
  --profile observe \
  --duration 30m \
  --rate 200 \
  --output .tmp/gateway-resource-soak-30m.json
```

External targets require both `--target` and `--metrics-url`. The tool accepts
no URL credential, query parameter, or fragment. A temporary
`AI_GATEWAY_RESOURCE_SOAK_AUTH_TOKEN` is accepted only when chat and metrics use
the same origin, and non-loopback authenticated targets must use HTTPS; the
token is never emitted. Use a loopback-only adapter when those conditions cannot
be met.

## Evidence boundary

The 12-second CI profile catches obvious regressions and missing telemetry. It
does not prove leak freedom, production capacity, or superiority. Release
evidence requires repeated long runs on the same host class, with the same
upstream, arrival model, payload, and thresholds. Compare distributions and
memory trends rather than a single best run.

Related methods:

- [Gateway SLO Benchmark](gateway-slo-benchmark.md)
- [Gateway Open-Loop Soak](gateway-open-loop-soak.md)
- [Readiness & Observability Guide](readiness-observability-guide.md)
