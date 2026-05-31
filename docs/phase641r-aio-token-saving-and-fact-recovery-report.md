# Phase641R-AIO Token Saving And Fact Recovery Report

## Metrics

Phase641R-AIO computes deterministic estimates in dry-run:

- `tokenEstimateBefore`
- `tokenEstimateAfter`
- `tokenSavingPercent`
- `requiredFactsTotal`
- `requiredFactsRecovered`
- `factRecoveryAccuracy`
- `factsMissing`
- `unsupportedClaimCount`
- `hallucinatedFactCount`
- `pointerCoverage`

## Seal Thresholds

- `tokenSavingPercent >= 30`
- `factRecoveryAccuracy >= 0.95`
- `pointerCoverage >= 0.9`
- `unsupportedClaimCount = 0`
- `hallucinatedFactCount = 0`

## Evidence

The final result is written to:

`apps/ai-gateway-service/evidence/phase641r/context-codec-core-shared-result.json`

The bridge also writes token and fact reports under `.codex-context`.
