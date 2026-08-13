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
2. Compare `gateway_readiness_events_total` against reasons (`knowledge`, `workflow`, `service-dependency`, `inflight-saturation`).
3. Confirm `healthzInFlightThreshold` and in-flight counts in `saturation`.
4. Correlate with `/ready`, then `/health`, then dependency routes.
5. For recoverable degradation, wait and recheck; for dependency breaks, follow corresponding service rollback and warm restart.
