# Phase639R Main-Chain Risk Matrix

## P0 Blockers

- accidental /chat routing
- accidental /chat-gateway/execute execution
- provider runtime mutation
- secret or auth.json exposure
- uncontrolled Provider call
- missing rollback flag
- missing emergency disable
- production or release claim drift

## P1 Risks

- stale context
- rate limit
- timeout
- invalid response
- operator misunderstanding
- evidence mismatch

## P2/P3 Items

- copy polish
- operator guide
- dashboard visibility
- documentation freshness

## Boundary

implementationInThisPhase=false
realCallAllowed=false
chatModificationAllowed=false
chatGatewayExecuteModificationAllowed=false
providerRuntimeModificationAllowed=false

