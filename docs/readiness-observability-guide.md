# Readiness & Observability Guide

This guide standardizes how to use the gateway readiness signals exposed by
`/healthz`, `/ready`, and `/metrics`, and provides Prometheus alerting examples
for production readiness guardrails.

## 1) Readiness signals now exposed

- `GET /healthz` and `GET /ready`
  - `status`: `"ready"` / `"degraded"`
  - `readinessFailures`: array of strings
  - `readinessFailureCount`: number of current failures
  - `isReady`: boolean
  - `saturation`: `{ inFlight, threshold, thresholdPercent }`
- `GET /metrics`
  - `ai_gateway_gateway_readiness_status{state="ready"|"degraded"}`
  - `ai_gateway_gateway_readiness_failures`
  - `ai_gateway_gateway_readiness_failures{reason="..."}` (current reasons)
  - `ai_gateway_gateway_readiness_events_total{reason="..."}` (cumulative reason counts)
  - `ai_gateway_gateway_readiness_checks_total{result="total"|"ready"|"degraded"}`
  - `ai_gateway_gateway_resilience_in_flight_instant`
  - `ai_gateway_gateway_resilience_in_flight_peak`
  - `ai_gateway_gateway_error_circuit_state{state="open"|"half-open"|"closed"}`
  - `ai_gateway_gateway_error_circuit_open_seconds`
  - `ai_gateway_gateway_error_circuit_rejections_total`
  - `ai_gateway_gateway_error_circuit_failures_total`
  - `ai_gateway_gateway_error_circuit_success_total`
  - `ai_gateway_process_cpu_seconds_total{mode="user"|"system"}`
  - `ai_gateway_memory_usage_bytes{type="rss"|"heapUsed"|"heapTotal"|"external"|"arrayBuffers"}`
  - `ai_gateway_event_loop_utilization_ratio`
  - `ai_gateway_event_loop_active_seconds_total`
  - `ai_gateway_event_loop_idle_seconds_total`
  - `ai_gateway_event_loop_delay_seconds{quantile="0.5"|"0.95"|"0.99"}`
  - `ai_gateway_event_loop_delay_max_seconds`

## 2) Ready-to-use Prometheus alerts

Add these rules in your Prometheus alert config:

```yaml
groups:
  - name: ai-gateway-readiness
    rules:
      - alert: AiGatewayReadyDegraded
        expr: ai_gateway_gateway_readiness_status{state="degraded"} == 1
        for: 2m
        labels:
          severity: warning
        annotations:
          summary: "AI Gateway readiness degraded"
          description: "readiness_status is degraded for the last 2m; check readinessFailures and health/knowledge/workflow states."

      - alert: AiGatewayReadinessFailureSpike
        expr: sum(increase(ai_gateway_gateway_readiness_failures{reason=~".+"}[5m])) by (reason) > 5
        for: 1m
        labels:
          severity: warning
        annotations:
          summary: "AI Gateway readiness failure spike"
          description: "Readiness failures are increasing quickly in 5m by reason."

      - alert: AiGatewayInFlightSaturation
        expr: ai_gateway_gateway_readiness_failures{reason="inflight-saturation"} == 1
        for: 1m
        labels:
          severity: warning
        annotations:
          summary: "AI Gateway in-flight saturation readiness degradation"
          description: "Current readiness failures include inflight-saturation; check request concurrency and workers."

      - alert: AiGatewayRequestCircuitOpen
        expr: ai_gateway_gateway_error_circuit_state{state="open"} == 1
        for: 1m
        labels:
          severity: warning
        annotations:
          summary: "AI Gateway request circuit is open"
          description: "Request-level circuit breaker is open; check gateway error traces and dependent providers before resume."

      - alert: AiGatewayReadinessUnavailable
        expr: ai_gateway_gateway_readiness_status{state="ready"} == 0
        for: 5m
        labels:
          severity: critical
        annotations:
          summary: "AI Gateway not ready"
          description: "Gateway readiness has been not-ready too long; check dependencies and recovery procedures."

      - alert: AiGatewayEventLoopDelayHigh
        expr: ai_gateway_event_loop_delay_seconds{quantile="0.99"} > 0.2
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "AI Gateway event-loop p99 delay is high"
          description: "Event-loop delay p99 has exceeded 200ms for 5m; inspect CPU, synchronous work, GC pressure, and request concurrency."

      - alert: AiGatewayEventLoopUtilizationHigh
        expr: ai_gateway_event_loop_utilization_ratio > 0.9
        for: 10m
        labels:
          severity: warning
        annotations:
          summary: "AI Gateway event-loop utilization is persistently high"
          description: "Event-loop utilization has exceeded 0.9 for 10m; review load, blocking operations, and horizontal capacity."
```

Event-loop delay is sampled by Node's native `monitorEventLoopDelay` histogram
and exported in seconds. Utilization is a process-lifetime ratio in the range
`0..1`. Alert per instance; Prometheus summary quantiles must not be averaged
across replicas.

## 3) Quality scorecard expectations

Run this locally if you want to verify observability readiness checks:

```bash
pnpm quality:ci:trend-health -- --json --require-score 165
```

For a full trend-health smoke loop that runs CI, verification, optional trend-log,
summary, digest, and final trend check in one command, use:

```bash
pnpm quality:trend-health-smoke -- --require-score 165
```

Current checks include:

- resilience metrics instrumentation markers
- health/readiness saturation markers
- hardening and workflow guard rails

## 4) Incident response checklist

1. Check `error.details.readinessFailures` in `/healthz` (or `/ready`) when status is 503.
   Real-provider deployments report `usage-ledger-unavailable` when the
   required durable usage ledger is degraded; provider execution remains
   blocked until buffered evidence is committed and health recovers.
   A configured A2A store reports `a2a-task-store-unavailable`; distributed
   Workforce ownership reports `workforce-claim-store-unavailable`. Both
   snapshots omit file paths, database URLs, namespaces, task contents, bearer
   tokens, token digests, and fencing tokens. Treat either reason as a traffic
   gate, not permission to fall back to process-local state.
   A configured central enterprise audit reports
   `audit-central-store-unavailable`; real-provider attempts remain blocked and
   must not fall back to a replica-local audit chain.
2. Compare `gateway_readiness_events_total` against reasons (`knowledge`, `workflow`, `service-dependency`, `inflight-saturation`, `gateway-error-circuit`).
3. Confirm `healthzInFlightThreshold` and in-flight counts in `saturation`.
4. Correlate with `/ready`, then `/health`, then dependency routes.
5. For recoverable degradation, wait and recheck; for dependency breaks, follow corresponding service rollback and warm restart.
6. Note that during gateway request circuit open, `/health`, `/health/check`, `/healthz`, `/ready`, and `/metrics` remain reachable to provide recovery telemetry.

## 5) Request-circuit failure drill (manual verification)

Use this lightweight drill to verify the request-circuit breaker behavior in a non-production environment:

1. Temporarily set lower thresholds in `.env.example` for faster transitions:

- `AI_GATEWAY_GATEWAY_ERROR_CIRCUIT_FAILURE_THRESHOLD=2`
- `AI_GATEWAY_GATEWAY_ERROR_CIRCUIT_SUCCESS_THRESHOLD=1`
- `AI_GATEWAY_GATEWAY_ERROR_CIRCUIT_RESET_MS=30000`
- `AI_GATEWAY_GATEWAY_ERROR_CIRCUIT_HALF_OPEN_MAX_CALLS=1`
- `AI_GATEWAY_GATEWAY_ERROR_CIRCUIT_BYPASS_ROUTES=/health,/health/check,/healthz,/ready,/setup/readiness,/metrics,/dashboard/status`
  - You can add observability-only routes as needed, such as `/dashboard/status`; this
    value is normalized (trim spaces, ensure leading slash, remove trailing slash, and
    collapse duplicate slashes).
2. Generate repeated 5xx-like failures on a route that is already connected to this gateway path (or run synthetic failure hooks if available).

3. Observe the transition:
- `GET /healthz` and `/ready` remain reachable and return `503` with `error.details.readinessFailures` containing `gateway-error-circuit`.
- `GET /metrics` shows `ai_gateway_gateway_error_circuit_state{state="open"} 1`.

4. Wait for `AI_GATEWAY_GATEWAY_ERROR_CIRCUIT_RESET_MS` and send one probe request:
- `GET /healthz` and `/metrics` (or a light-weight route) should become accepted again when `state="half-open"` appears.

5. Confirm recovery criteria:
- Half-open success path closes the breaker and `error.details.readinessFailures` no longer includes `gateway-error-circuit`.
- Check `ai_gateway_gateway_error_circuit_success_total` increments.

### Quick automated drill

You can run the same recovery sequence with one command:

```bash
pnpm drill:gateway-circuit
```

If you only need a no-execution configuration preview, run:

```bash
node ./tools/circuit-recovery-drill.mjs --dry-run --json
```

The default CI pipeline already runs the quality scorecard and dry-run recovery drill command and stores the output artifacts for audit.

CI also runs both the quality scorecard and the managed live recovery drill on every push/PR and publishes:

- `.tmp/quality-scorecard.json`
- `.tmp/circuit-recovery-drill-live.json`
- `.tmp/quality-ci-verification.json`

You can locally validate the same CI artifacts with:

```bash
pnpm quality:verify-artifacts -- --json
```
Use trend-health strict mode when validating CI parity:

```bash
pnpm quality:verify-artifacts:trend-health -- --json --quality .tmp/quality-scorecard.json --drill .tmp/circuit-recovery-drill-live.json --require-score 165
```

Useful flags:
- `--base-url` (default: `AI_GATEWAY_SERVICE_URL` or `http://127.0.0.1:3100`)
- `--trip-route` (default: `/provider-config/save`)
- `--probe-route` (default: `/healthz`)
- `--trip-attempts` (default: `2`)
- `--trip-body` (default: `{}`)
- `--open-wait-ms` (defaults to `AI_GATEWAY_GATEWAY_ERROR_CIRCUIT_RESET_MS` or `30000`)
- `--poll-limit` (default: `20`)
- `--poll-interval-ms` (default: `1000`)

Example JSON fragment:

```json
{
  "status": "recovered",
  "expected": [
    "trip-route should return a 5xx response",
    "probe route should show open state in metrics",
    "after open-wait, circuit should enter half-open or closed"
  ],
  "recommendation": "recovered: traffic can continue after confirming dependency health"
}
```

Interpretation:
- `trip-failed`: the trip route is not producing a server-side failure in the target environment.
- `open-poll-timeout`: circuit did not enter `open` within probe window.
- `recovery-timeout`: circuit never reached `half-open`/`closed`.
- `recovered`: drill succeeded and probe payload is ready again (`finalHealthReady=true`).

### Example commands

```bash
curl -sS "http://127.0.0.1:3210/healthz" | jq
curl -sS "http://127.0.0.1:3210/metrics" | sed -n "/gateway_error_circuit/p"

# Probe readiness repeatedly during recovery and watch Retry-After.
while true; do
  curl -i -sS "http://127.0.0.1:3210/healthz" | sed -n '1,12p'
  sleep 1
done

curl -sS -D - "http://127.0.0.1:3210/healthz" | awk '/Retry-After/ {print}'
```

Client and browser retry behavior is documented in the [rate-limit client contract](./rate-limit-client-contract.md).

## 3.1) Trend guardrails (new)

The workflow now supports optional trend guardrails to prevent quality regressions from being treated as noise after a passing threshold.

```bash
pnpm quality:trend-summary -- --trend .tmp/quality-trend.json --output .tmp/quality-trend-summary.md
```

Use the following options to enforce regression guardrails:

- `--max-consecutive-failures <N>`: fail when latest consecutive failures is greater than or equal to N
- `--max-score-drop-points <N>`: fail when latest score drop over one run is greater than N
- `--guard-output <path>`: write guardrail evaluation JSON for audit and archiving
- `--enforce-guardrails`: exit non-zero when any guardrail issue is triggered

Example:

```bash
pnpm quality:trend-summary -- --trend .tmp/quality-trend.json --output .tmp/quality-trend-summary.md --guard-output .tmp/quality-trend-guardrail.json --max-consecutive-failures 3 --max-score-drop-points 20 --enforce-guardrails
```

## 6) CI trend artifacts (current pipeline)

The CI workflow now stores the following additional trend artifacts per run:

- `.tmp/quality-trend.json`
- `.tmp/quality-scorecard.json`
- `.tmp/circuit-recovery-drill-live.json`
- `.tmp/quality-trend-summary.md`
- `.tmp/quality-trend-guardrail.json`
- `.tmp/quality-trend-check.json`
- `.tmp/quality-trend-digest.json`
- `.tmp/quality-ci-verification.json`
- `.tmp/quality-trend-recommendations.md`
- `.tmp/quality-trend-incident-bundle.md`
- `.tmp/quality-trend-incident-bundle.json`
- `.tmp/quality-trend-verify-artifacts.json`
- `.tmp/quality-trend-health-smoke.json` (quality trend workflow smoke command output with flags and summary)

If you inspect workflow artifacts, you can load:

- `.tmp/quality-trend-guardrail.json` for threshold checks and guardrail status used in CI diagnostics.
- `.tmp/quality-trend-digest.json` for machine-readable digest state.
- `.tmp/quality-trend-check.json` for policy-level status, severity, and recommendation.
- `.tmp/quality-trend-recommendations.md` for the operator action list when a smoke check fails.
- `.tmp/quality-trend-incident-bundle.md` and `.tmp/quality-trend-incident-bundle.json` for structured triage evidence.
- Incident bundle fields must match `tools/quality-trend-incident-bundle.schema.json` (schemaVersion, thresholds, trendHealth, artifacts, failedSteps, etc.).
- Incident bundle payloads should also include `trendConsistency` (checks plus issue summary) so trend check parity is auditable.
- `.tmp/quality-trend-verify-artifacts.json` records parity check outputs including missing/mismatched consistency issues and is useful for root-cause review after a failed quality run.
- Runtime verification evidence files available in the `quality-scorecard` artifact:
  - `.tmp/public-clone-verify.log`
  - `.tmp/mcp-verify.log`
  - `.tmp/mcp-smoke.json`
  - `.tmp/gateway-doctor.json`
  - `.tmp/gateway-demo.json`
- Docker build-and-push evidence files available in `docker-smoke-evidence` and `docker-published-evidence` artifacts:
  - `.tmp/docker-smoke-gateway-demo.json`
  - `.tmp/docker-smoke-piped-demo.json`
  - `.tmp/docker-smoke-container-evidence.json`
  - `.tmp/docker-smoke-mcp-smoke.json`
  - `.tmp/docker-smoke-tools-mcp-smoke.json`
  - `.tmp/docker-smoke-openai-sdk-chat.log`
  - `.tmp/docker-smoke-container-runtime.log`
  - `.tmp/docker-smoke-base-url.json`
  - `.tmp/docker-published-gateway-demo.json`
  - `.tmp/docker-published-mcp-smoke.json`
  - `.tmp/docker-published-tools-mcp-smoke.json`
  - `.tmp/docker-published-openai-sdk-chat.log`
  - `.tmp/docker-published-runtime.log`

For full triage sequence and owners, follow:

- [Quality trend runbook](quality-trend-runbook.md)

Default guardrail thresholds are `--max-consecutive-failures 3` and `--max-score-drop-points 20` in the CI trend generation step. A breach sets `guardrail pass: fail` in the summary and can fail the CI job due `--enforce-guardrails`.

Set `QUALITY_TREND_HARD_BLOCK=true` to upgrade critical trend-check signals into a hard CI block. Set `QUALITY_REQUIRE_TREND_HEALTH=true` (recommended) to make CI and re-verification fail when trend health is not collected or `blocked`.

The same hard-block policy can be applied ad-hoc when dispatching `Quality Trend Snapshot` by setting `quality_trend_hard_block=true`.
## 6.1) Trend health check command (new)

Use this command for a policy-level health signal after digest/summary generation:

```bash
pnpm quality:trend-check -- \
  --digest .tmp/quality-trend-digest.json \
  --guardrail .tmp/quality-trend-guardrail.json \
  --summary .tmp/quality-trend-summary.md \
  --max-summary-reasons 8 \
  --json
```

The output includes:

- status (`stable`, `unstable-warning`, `unstable-critical`, etc.)
- severity (`none`/`info`/`warning`/`critical`)
- blocked (`true`/`false`)
- reasons and a short recommendation

Current CI artifacts include:

- `.tmp/quality-trend-check.json`
- `.tmp/quality-trend-digest.json`
- `.tmp/quality-trend-guardrail.json`
- `.tmp/quality-trend-recommendations.md`
- `.tmp/quality-trend-incident-bundle.md`
- `.tmp/quality-trend-incident-bundle.json`

Use this output for pre-merge triage when trend score is noisy but verification still passes.

## 6.2) Trend-consistency parity checklist (operational)

For incidents, merge freeze, or pre-merge trend review, verify these trend artifacts together:

- `.tmp/quality-ci-verification.json`
- `.tmp/quality-trend-incident-bundle.json`
- `.tmp/quality-trend-check.json`

Check the parity rules:

1. Confirm consistency check contract:
- `trendConsistency.status` present in both verification and incident bundle.
- `trendConsistency.checksRequired` appears in both and includes:
  - `trendDigestHealth`
  - `trendSummaryGuardrails`
  - `trendDigestCheckConsistency`
- `trendConsistency.hasMissingRequired` and `trendConsistency.hasNotCollected` are identical in intent across `quality-ci-verification` and incident bundle.
- `trendConsistency.requiresTrendHealth` matches whether the smoke run used strict trend-health mode.

2. Confirm issue propagation:
- `trendConsistency.issueCodes` and `trendConsistency.issueCodeSummary` are present and consistent with top-level `issueCodes`/`issueCodeSummary`.
- Any high-severity trend consistency issue in verification output must appear in
  `trendIncidentBundle.issueCodes` and be called out in incident notes.

3. Confirm decision signal:
- `.tmp/quality-trend-check.json` has `blocked` aligned with incident severity expectations.
- In strict trend-health mode, avoid `trendConsistency.status === "degraded"`; treat it as blocking if required by policy.
- In compatibility mode, `degraded` is warning-only and must be explicitly called out with a mitigation ticket.

4. Confirm traceability:
- `trendConsistency.checks.trendDigestHealth`, `trendConsistency.checks.trendSummaryGuardrails`, and `trendConsistency.checks.trendDigestCheckConsistency` exist with object payload for status/reason.
- `artifacts` in incident bundle includes the exact trend verification files above so rebuildability is auditable.

Use `docs/quality-trend-runbook.md` and `docs/quality-trend-digest-guide.md` as the authoritative triage workflow once this checklist passes or fails.

## 7) Distributed tracing with OpenTelemetry

The gateway uses the official OpenTelemetry JavaScript SDK and OTLP HTTP trace
exporter. Incoming W3C `traceparent` and `tracestate` headers are extracted with
the standard propagator. Responses expose `traceparent`, `tracestate` when
present, and `x-trace-id` so an operator can correlate a request with exported
spans.

The runtime creates an HTTP server span plus child GenAI execution and streaming
spans. GenAI spans contain operational metadata such as provider, request and
response model, finish reason, and token usage. Prompt text, message content,
model output, API keys, authorization headers, and exporter authorization headers
are not attached to spans.

Telemetry is fail-open for request availability and fail-closed for export:

- tracing can remain enabled without starting any network exporter;
- export starts only when `OTEL_EXPORTER_OTLP_TRACES_ENDPOINT`,
  `AI_GATEWAY_OTEL_EXPORTER_OTLP_ENDPOINT`, or `OTEL_EXPORTER_OTLP_ENDPOINT` is
  explicitly configured;
- exporter URLs containing credentials or URL fragments are rejected;
- `batch` is the runtime default; `simple` exists for deterministic local and CI
  verification only;
- parent-based ratio sampling preserves an upstream sampling decision and uses
  `AI_GATEWAY_OTEL_SAMPLE_RATIO` for root traces;
- exporter shutdown errors are logged without endpoint, headers, or credentials.

Recommended local collector configuration:

```bash
AI_GATEWAY_OTEL_ENABLED=true
AI_GATEWAY_OTEL_SERVICE_NAME=unified-ai-gateway
AI_GATEWAY_OTEL_SAMPLE_RATIO=1
AI_GATEWAY_OTEL_EXPORTER_MODE=batch
OTEL_EXPORTER_OTLP_TRACES_ENDPOINT=http://127.0.0.1:4318/v1/traces
```

`pnpm verify:public-clone` starts a credential-free local OTLP receiver and
requires runtime evidence for valid W3C parent preservation, invalid all-zero
context regeneration, HTTP-to-GenAI parent/child linkage, semantic GenAI
attributes, and content privacy. This check never enables a real provider.
