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
- keeps request counters exact while retaining at most 100,000 deterministic
  latency and scheduler-lag samples, so memory use does not grow with every
  request in a long run;
- writes an atomic `.partial.json` checkpoint at startup, shutdown, and every
  five minutes by default; slow checkpoint storage remains single-flight and
  repeated timer requests coalesce instead of forming an unbounded promise
  queue;
- handles `SIGINT` and `SIGTERM` by aborting outstanding requests, writing
  failure evidence, and terminating the managed gateway;
- verifies final health and one protocol-valid fake chat before cleanup;
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

Managed authentication expires after the requested duration, request-drain
allowance, and a fixed 15-minute cleanup buffer. It is not silently renewed
during the measured workload. The remaining lifetime is checked again at the
actual measurement start and must cover measurement, request drain, and the
post-soak probe. Runs of one hour or longer must satisfy final absolute and
relative heap/RSS growth, peak increase from the initial median, and a bounded
positive linear slope; the short CI profile retains its original tolerant
`absolute OR relative` regression semantics.

## Six-hour release evidence

`.github/workflows/gateway-release-soak.yml` is intentionally separate from
ordinary `push` and `pull_request` CI. It runs only on a weekly schedule or an
authorized manual dispatch and requires a dedicated runner with all of these
labels:

```text
self-hosted, linux, x64, gateway-soak
```

The release profile checks out a complete immutable commit SHA, reruns the four
repository gates, and then fixes this workload contract:

```text
duration=360m
rate=10 RPS
maxOutstanding=64
sampleInterval=30s
requestTimeout=5s
minArrivalRatio=1
maxErrorRate=0
```

This produces exactly 216,000 scheduled fake-provider requests and at least 720
resource samples. `verify-gateway-release-soak.mjs` independently requires zero
client shedding, request errors, timeouts, transport failures, protocol
violations, metric scrape failures, or cleanup failures. It also binds the
evidence to the requested commit and an immutable manifest containing the tree
SHA, lockfile SHA-256, package version, workflow run identity, and exact evidence
digest.

The verifier treats raw resource samples as authoritative: values must be
finite, elapsed time strictly increasing, cumulative CPU/histogram counters
nondecreasing, cadence bounded, and coverage at least the requested duration.
Memory growth, peak increase, slope, and event-loop maxima are recomputed from
those samples instead of trusting report summaries.

The workflow job allows 390 minutes while the measured command is bounded at
365 minutes. This leaves time for graceful signal handling, fail-closed
verification, checksums, and artifact upload. A standard GitHub-hosted job has a
six-hour total execution ceiling, including setup and upload, so it cannot
honestly provide six continuous measured hours. Two shorter jobs are not a
substitute because they do not preserve one process lifetime. The dedicated
self-hosted runner should be ephemeral or otherwise isolated; registering and
operating that runner is an explicit infrastructure prerequisite, not something
the workflow performs.

Manual `dry-run` mode uses the same immutable-SHA and verification path but only
measures two minutes. Its artifact is labelled short-run evidence and must never
authorize a release. Scheduled runs use the default-branch event SHA. Manual
release runs require the candidate to be reachable from the repository's
default branch.

Retained artifacts include the final report, partial checkpoint, log, immutable
manifest, independent verification report, and SHA-256 checksum list. A missing,
aborted, timed-out, stale, malformed, or partially verified report fails the job;
a checkpoint alone is never release evidence. Before every run the workflow
removes the exact prior output paths, then binds the current workflow run ID and
attempt into both evidence and manifest. Mode, workload, evidence presence, run
identity, and digest must all match, so an old report cannot be repackaged as a
new run.

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
memory trends rather than a single best run. Even a passing six-hour run applies
only to its exact commit, runner class, and fake-provider workload; it does not
replace real-provider pre-production, independent security review, or
multi-host production evidence.

Related methods:

- [Gateway SLO Benchmark](gateway-slo-benchmark.md)
- [Gateway Open-Loop Soak](gateway-open-loop-soak.md)
- [Readiness & Observability Guide](readiness-observability-guide.md)
