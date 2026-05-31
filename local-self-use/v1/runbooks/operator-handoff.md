# Operator Handoff

## Goal

Runbook for local self-use routing v1.

## Facts

- start: run local service and inspect Mission Control read-only panels
- stop: stop local service normally
- safe mode: disable route policy preview and provider route preview
- evidence check: inspect local-self-use/v1/evidence-ledger.json
- issue logging: add issues to local-self-use/v1/issues/issue-ledger.json
- mode choice: Normal for simple work, God for important review, Tianshu for complex planning
- when to stop: secret risk, unexpected deploy signal, route mutation, provider gate failure, or budget concern

## Boundaries

- No deploy, release, push, or production traffic.

## Outputs

- docs/phase998-local-self-use-routing-v1-operator-handoff.md

## Non-claims

- This phase does not modify Phase941-960 original failed evidence.
- This phase does not call Providers or expand Provider requests.
- This phase does not change default /chat or /chat-gateway/execute behavior.
- This phase does not modify selectable model state.
- This phase does not deploy, release, tag, upload artifacts, push, or commit.
- This phase opens a local self-use path only; it is not production deployment or completed seven-day soak.
