# Phase639R Provider Runtime Risk Matrix

## P0 Blockers

- provider runtime mutation without approval
- uncontrolled Provider call
- auth.json access
- secret exposure
- raw endpoint value exposure
- Codex config write
- missing rollback flag
- missing emergency disable
- production or release claim drift

## P1 Risks

- model routing semantic drift
- stale capability boundary
- rate limit
- timeout
- invalid provider response
- operator misunderstanding
- evidence mismatch

## P2/P3 Items

- provider runtime candidate naming polish
- operator guide
- dashboard visibility
- documentation freshness

## Boundary

implementationInThisPhase=false
realCallAllowed=false
providerRuntimeModificationAllowed=false
providerCallsAllowed=false

