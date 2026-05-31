# Phase1477 Field Snapshot vs Token Replay Benchmark

Phase1477 generates synthetic field snapshots for fixed dry-run cases and compares them with token replay estimates.

Required baselines:
- randomBaseline
- simpleKeywordAffinity
- directSyntheticNearestNeighbor
- conceptFieldKernelDryRun

Evidence target:
- apps/ai-gateway-service/evidence/phase1476_1485/phase1477-field-snapshot-vs-token-replay-benchmark.json

Boundary:
- benchmark numbers are deterministic estimates.
- no GloVe download.
- no public dataset loading.
- no Provider call.
- no real semantic validation claim.
