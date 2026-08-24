# Gateway Open-Loop Soak and Backpressure Benchmark

`tools/gateway-soak/main.go` is a credential-free, dependency-free Go load
generator for sustained arrival-rate, backpressure, and interrupted-stream
recovery evidence.

## Why Go

Go is the most appropriate language for this load-generation layer:

- goroutines and the standard HTTP transport support hundreds of independently
  scheduled requests without coupling arrivals to response completion;
- a compiled process isolates load-generator pauses from the Node gateway under
  test;
- the monotonic component of `time.Time` supports scheduler-lag and latency
  measurements;
- the standard library covers process lifecycle, HTTP, JSON, synchronization,
  and atomic counters without a third-party benchmark dependency;
- the repository CI already pins Go 1.23.

The Node ESM SLO harness remains the right tool for detailed OpenAI SSE parsing
and CI protocol regression. The Go tool owns sustained open-loop load and
resilience pressure. Using each language for its strongest role avoids a
multi-language rewrite of gateway runtime code.

## Managed CI run

```bash
pnpm benchmark:gateway:soak
```

The default credential-free v2 run:

- starts the real gateway HTTP process on a reserved loopback port;
- forwards only a small operating-system and Node launch environment allowlist;
- forces fake provider mode and disables real providers;
- schedules 500 requests over five seconds at a fixed 100 requests/second;
- does not wait for one response before scheduling the next request;
- records started arrivals, generator drops, outstanding concurrency,
  scheduler-lag percentiles, latency percentiles, throughput, timeouts, status
  codes, protocol validity, and fake-mode validity;
- runs the sustained phase against a managed `maxInFlight=80` boundary. At 100
  RPS this is greater than `ceil(rate * maxP95) + 5`, so the declared 750 ms
  latency allowance cannot contradict the zero-error capacity gate;
- sends a synchronized 256-request streaming burst against that boundary and
  requires both accepted streams and explicit
  `503 service_overloaded` responses;
- opens eight streaming requests, reads the first bytes, aborts each client
  connection, then proves health and normal chat recover;
- kills and reaps the managed process in all normal completion paths;
- writes `.tmp/gateway-soak-benchmark.json` for CI artifact retention.

Default regression thresholds:

| Dimension | Gate |
| --- | ---: |
| Sustained error rate | 0 |
| Generator drops | 0 |
| Started/scheduled arrivals | >= 90% |
| OpenAI protocol validity | 100% |
| Sustained latency p95 | <= 750 ms |
| Scheduler lag p95 | <= 100 ms |
| Controlled overload responses | >= 1 |
| Post-overload recovery | required |
| Interrupted stream recovery | required |

These thresholds are deliberately tolerant CI regression limits. They are not
production capacity targets.

For managed zero-error runs, argument validation rejects a service in-flight
cap below `ceil(targetRps * maxP95Seconds) + 5`. The v1 defaults used a cap of
16 while allowing 750 ms at 100 RPS (roughly 75 concurrent requests by
Little's Law). That internally inconsistent profile could pass on a fast runner
and emit sustained overload 503s on a slower runner even though latency stayed
inside its stated threshold. v2 separates sustained-capacity headroom from the
larger explicit overload burst instead of loosening the zero-error requirement.

In CI the open-loop gate runs immediately after dependency/toolchain setup and
before browser setup, maintained tests, public-clone processes, or the other
gateway benchmarks. This isolates fixed-arrival latency evidence from child
processes and resource pressure left by earlier suites. It is not a retry and
does not relax the 100 RPS, zero-error, protocol-validity, or 750 ms thresholds;
the later SLO and resource-soak gates remain independent checks.

## Arrival-model semantics

The existing Node SLO benchmark uses bounded workers and measures how quickly a
fixed request set completes. That closed-loop-style workload is useful for
latency and protocol regression, but slow responses naturally reduce new
arrivals and can conceal saturation.

The Go benchmark computes every intended launch time from one monotonic start
time. Requests are launched at that schedule regardless of earlier completion,
until the explicit client outstanding cap is reached. A full cap increments
`clientDropped`; it is never counted as gateway success. Scheduler lag measures
the difference between intended and actual launch time.

## External targets

```bash
pnpm benchmark:gateway:soak -- \
  --target http://127.0.0.1:4100/v1/chat/completions \
  --duration 60s \
  --rate 250 \
  --output .tmp/external-soak.json
```

External runs are observational by default. Backpressure and connection-abort
probes are disabled unless `--fault-probes` is explicitly supplied because they
are intentionally disruptive.

The tool accepts no authorization header or provider credential. URL userinfo,
query parameters, and fragments are rejected. Use a temporary loopback-only
adapter if a protected comparison target is required; the adapter, not command
arguments or evidence, must own authentication.

## Evidence boundary

A passing managed run proves repeatable behavior against the deterministic
local fake provider on the recorded host. It does not prove production
readiness, provider quality, global availability, or superiority over another
gateway. Defensible comparisons require the same machine class, network path,
upstream behavior, payload, arrival rate, duration, timeout, and connection
policy across every target, followed by multiple trials and distribution-level
analysis.

Related methodology: [Gateway SLO Benchmark](gateway-slo-benchmark.md).
