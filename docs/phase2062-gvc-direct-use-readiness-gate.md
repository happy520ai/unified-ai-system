# Phase2062-GVC-Direct-Use-Readiness-Gate

## Goal

Decide whether the current GVC runner can enter controlled direct use.

## Required Conditions

- Low-risk autonomous mutation approval exists with `scope=low_risk_only`.
- `runner-control.json` has `paused=false` and `stopRequested=false`.
- Permission enforcement limited activation is enabled.
- Provider, secret, deploy, and chat-route authority remain blocked.
- Daily caps, rollback, runaway guard, quality gate, and no-op guard are present.

## Failure Rule

If any critical condition fails, the verifier writes `blocker=direct_use_readiness_failed` and the controlled direct-use run must not start.

## Evidence

`apps/ai-gateway-service/evidence/phase2062-gvc-direct-use-readiness-gate/result.json`
