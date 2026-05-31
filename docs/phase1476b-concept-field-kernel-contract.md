# Phase1476B Concept Field Kernel Contract

## Status

The concept field kernel is `experimentalSubKernelOnly=true`. It is a synthetic dry-run scoring surface under Taiji / Beidou Engine and is not connected to the main runtime.

## Input

- inputConcepts: owner or system concepts to score.
- positiveSources: concepts that should attract the field.
- negativeSources: concepts that should suppress or raise risk.
- neutralSources: anchor concepts used for stabilizing readout.
- routeContext: local routing context, such as Tianshu or evidence replay hints.
- evidenceRefs: evidence references used only for coherence scoring.
- riskSignals: local risk markers used only for riskFieldScore.

## Output

- routeAffinityScore
- evidenceCoherenceScore
- surpriseScore
- riskFieldScore
- topActivatedConcepts
- topSuppressedConcepts
- unstableConcepts
- sleepConsolidationCandidates
- pruneCandidates

## Boundary

- syntheticVectorsOnly=true
- gloveDownloadExecuted=false
- externalDatasetLoaded=false
- providerCallsMade=false
- realSemanticValidationClaimed=false
- productionReadinessClaimed=false
- agiClaimAllowed=false
- trillionModelSurpassClaimAllowed=false
