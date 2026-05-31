# Phase630R-Fix Main Chain Design Risk Matrix

## P0

- accidental /chat routing
- accidental /chat-gateway/execute execution
- provider runtime mutation
- secret/auth.json exposure
- uncontrolled provider call
- missing rollback flag
- missing emergency disable
- production claim drift

## P1

- stale context
- rate limit
- timeout
- invalid response
- operator misunderstanding
- evidence mismatch

## Phase630 Decision

The risk posture allows only a design patch preview. It does not allow runtime implementation, Provider calls, production traffic, deployment, or release.
