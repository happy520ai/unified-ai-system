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
```

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
- `AI_GATEWAY_GATEWAY_ERROR_CIRCUIT_BYPASS_ROUTES=/health,/health/check,/healthz,/ready,/setup/readiness,/metrics`
  - 也可追加自定义观�?健康路径（例�?`/dashboard/status`）；该变量会做去重与格式化（去掉空白、补齐前导斜杠、清理尾随斜杠、压缩重复斜杠）�?
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
pnpm drill:gateway-circuit --json
```

If you only need a safe readiness check (for CI or pre-merge), run:

```bash
node ./tools/circuit-recovery-drill.mjs --dry-run --json
```

The default CI pipeline already runs the quality scorecard and dry-run recovery drill command and stores the output artifacts for audit.

CI also runs both quality scorecard and the drill dry-run on every push/PR and publishes:

- `.tmp/quality-scorecard.json`
- `.tmp/circuit-recovery-drill-dry-run.json`
- `.tmp/quality-ci-verification.json`

You can locally validate the same CI artifacts with:

```bash
pnpm quality:verify-artifacts -- --json
```
Use trend-health strict mode when validating CI parity:

```bash
pnpm quality:verify-artifacts:trend-health -- --json --quality .tmp/quality-scorecard.json --drill .tmp/circuit-recovery-drill-dry-run.json --require-score 165
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
- `.tmp/quality-trend-summary.md`
- `.tmp/quality-trend-guardrail.json`
- `.tmp/quality-trend-check.json`
- `.tmp/quality-trend-digest.json`
- `.tmp/quality-trend-recommendations.md`
- `.tmp/quality-trend-incident-bundle.md`
- `.tmp/quality-trend-incident-bundle.json`

If you inspect workflow artifacts, you can load:

- `.tmp/quality-trend-guardrail.json` for threshold checks and guardrail status used in CI diagnostics.
- `.tmp/quality-trend-digest.json` for machine-readable digest state.
- `.tmp/quality-trend-check.json` for policy-level status, severity, and recommendation.
- `.tmp/quality-trend-recommendations.md` for the operator action list when a smoke check fails.
- `.tmp/quality-trend-incident-bundle.md` and `.tmp/quality-trend-incident-bundle.json` for structured triage evidence.
- Incident bundle fields must match `tools/quality-trend-incident-bundle.schema.json` (schemaVersion, thresholds, trendHealth, artifacts, failedSteps, etc.).

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
