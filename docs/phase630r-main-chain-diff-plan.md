# Phase630R-Fix Main Chain Diff Plan

plannedOnly=true
notApplied=true
futurePhaseRequired=true

## Future File Types That May Need Review

- /chat route entry
- /chat-gateway/execute route entry
- route selection layer
- safety gate layer
- rollback flag layer
- Mission Control operator display

## Phase630 Non-Application Rule

No diff from this plan is applied in Phase630. The future phase must prepare an isolated implementation patch candidate with feature flag off by default and separate explicit approval.

## Review Requirements For Future Patch

- Preserve default `/chat` behavior unless explicitly authorized in a later phase.
- Preserve `/chat-gateway/execute` main-chain behavior unless explicitly authorized in a later phase.
- Keep provider runtime unchanged unless explicitly authorized in a later phase.
- Keep Provider calls blocked in dry-run and preview states.
- Maintain maxRequestsDefault=1, maxRequestsHardLimit=3, retryLimit=0.
