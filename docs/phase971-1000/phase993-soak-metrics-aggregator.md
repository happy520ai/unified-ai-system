# Phase993 Soak Metrics Aggregator

## Goal

Create aggregator that refuses to treat templates as completed real soak.

## Facts

- soakMetricsAggregatorReady=true

## Boundaries

- No fake soak data.

## Outputs

- tools/phase971_1000/aggregate-seven-day-soak-metrics.mjs

## Non-claims

- This phase does not modify Phase941-960 original failed evidence.
- This phase does not call Providers or expand Provider requests.
- This phase does not change default /chat or /chat-gateway/execute behavior.
- This phase does not modify selectable model state.
- This phase does not deploy, release, tag, upload artifacts, push, or commit.
- This phase opens a local self-use path only; it is not production deployment or completed seven-day soak.
