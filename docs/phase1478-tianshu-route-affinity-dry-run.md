# Phase1478 Tianshu Route Affinity Dry-Run

Phase1478 scores a Tianshu route affinity profile from the synthetic concept field.

The routeAffinityScore is only a local dry-run signal. It does not change routing, does not call `/chat`, does not call `/chat-gateway/execute`, and does not enable a real Provider route.

Evidence target:
- apps/ai-gateway-service/evidence/phase1476_1485/phase1478-tianshu-route-affinity-dry-run.json

Expected result:
- routeAffinityScoreGenerated=true.
- providerCallsMade=false.
- realSemanticValidationClaimed=false.
