# Phase983 Tianshu Mode Local Self-use Console

## Goal

Describe Tianshu local self-use planner/executor boundaries.

## Facts

- planner / executor 分工，适合复杂任务，默认 guarded，需要更多 evidence。

## Boundaries

- Guarded by default.
- More evidence required before runtime tuning.

## Outputs

- model-routing/v1-closure/operator/tianshu-mode-local-self-use-console.json

## Non-claims

- This phase does not modify Phase941-960 original failed evidence.
- This phase does not call Providers or expand Provider requests.
- This phase does not change default /chat or /chat-gateway/execute behavior.
- This phase does not modify selectable model state.
- This phase does not deploy, release, tag, upload artifacts, push, or commit.
- This phase opens a local self-use path only; it is not production deployment or completed seven-day soak.
