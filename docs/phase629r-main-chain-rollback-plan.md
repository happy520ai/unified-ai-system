# Phase629R-Fix Main Chain Rollback Plan

## Policy

- no git reset --hard
- no git clean
- preserve evidence
- disable candidate route
- restore preview-only mode
- remove future main-chain candidate flag if added
- keep /chat unchanged in this phase
- keep /chat-gateway/execute unchanged in this phase

## Phase629 Rollback Scope

Because Phase629 does not perform main-chain integration, rollback is limited to disabling or ignoring future candidate approval artifacts and preserving the evidence trail for review.

## Future Phase Requirement

If Phase630R-Fix or later introduces any candidate flag, the rollback record must identify that flag, its default state, and the exact non-destructive way to return to preview-only behavior.
