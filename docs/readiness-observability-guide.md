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
node tools/quality-scorecard.mjs --require-score 140
```

Current checks include:

- resilience metrics instrumentation markers
- health/readiness saturation markers
- hardening and workflow guard rails

## 4) Incident response checklist

1. Check `readinessFailures` in `/healthz` payload.
2. Compare `gateway_readiness_events_total` against reasons (`knowledge`, `workflow`, `service-dependency`, `inflight-saturation`, `gateway-error-circuit`).
3. Confirm `healthzInFlightThreshold` and in-flight counts in `saturation`.
4. Correlate with `/ready`, then `/health`, then dependency routes.
5. For recoverable degradation, wait and recheck; for dependency breaks, follow corresponding service rollback and warm restart.

## 5) Request-circuit failure drill (manual verification)

Use this lightweight drill to verify the request-circuit breaker behavior in a non-production environment:

1. Temporarily set lower thresholds in `.env.example` for faster transitions:

- `AI_GATEWAY_GATEWAY_ERROR_CIRCUIT_FAILURE_THRESHOLD=2`
- `AI_GATEWAY_GATEWAY_ERROR_CIRCUIT_SUCCESS_THRESHOLD=1`
- `AI_GATEWAY_GATEWAY_ERROR_CIRCUIT_RESET_MS=30000`
- `AI_GATEWAY_GATEWAY_ERROR_CIRCUIT_HALF_OPEN_MAX_CALLS=1`

2. Generate repeated 5xx-like failures on a route that is already connected to this gateway path (or run synthetic failure hooks if available).

3. Observe the transition:
- `GET /healthz` returns `503` with `readinessFailures` containing `gateway-error-circuit`.
- `GET /metrics` shows `ai_gateway_gateway_error_circuit_state{state="open"} 1`.

4. Wait for `AI_GATEWAY_GATEWAY_ERROR_CIRCUIT_RESET_MS` and send one probe request:
- `GET /healthz` (or a light-weight route) should become accepted again when `state="half-open"` appears.

5. Confirm recovery criteria:
- Half-open success path closes the breaker and `readinessFailures` no longer includes `gateway-error-circuit`.
- Check `ai_gateway_gateway_error_circuit_success_total` increments.
