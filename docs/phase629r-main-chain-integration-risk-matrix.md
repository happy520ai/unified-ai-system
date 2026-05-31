# Phase629R-Fix Main Chain Integration Risk Matrix

## P0 Blockers

- secret exposure
- auth.json access
- Codex config persistent write
- unintended /chat routing
- unintended /chat-gateway/execute execution
- provider runtime mutation
- uncontrolled provider call
- missing rollback
- missing emergency disable
- production/release claim drift

## P1 Risks

- cost overrun
- rate limit
- timeout
- invalid response
- stale context
- UI operator misunderstanding
- evidence mismatch

## P2/P3 Risks

- copy polish
- operator guide
- dashboard visibility
- documentation freshness

## Phase629 Decision

The risk posture supports an approval packet only. It does not support direct main-chain integration, production readiness, release readiness, Provider calls, or deployment.
