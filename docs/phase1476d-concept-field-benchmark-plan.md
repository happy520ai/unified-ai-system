# Phase1476D Concept Field Benchmark Plan

## Mode

- benchmarkMode=synthetic_only
- realSemanticValidationClaimed=false
- productionReadinessClaimed=false

## Baselines

- directSyntheticNearestNeighbor: compares the first input concept to local synthetic vectors.
- simpleKeywordAffinity: simple keyword match over input and route context.
- randomBaseline: deterministic seeded baseline with no semantic claim.
- conceptFieldKernelDryRun: Phase1476 synthetic field readout.

## Scope

The benchmark only checks repeatability and score shape. It does not validate real language understanding, does not download GloVe, does not load an external dataset, and does not call any provider.
