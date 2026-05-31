# Phase324E Model Library Operations Report

## Executive Summary

- totalModels: 148
- selectableModels: 9
- smokePassedModels: 9
- failedModels: 9
- unverifiedModels: 125
- providerScope: NVIDIA-only
- multiProviderOpen: false

## Selectable Growth

| Stage | selectableModels |
| --- | ---: |
| initial_verified | 2 |
| Phase324C | 4 |
| Phase324C-2 | 9 |

## Smoke Batch Performance

| Batch | Pass | Fail | Processed | Pass rate |
| --- | ---: | ---: | ---: | ---: |
| Phase324B | 2 | 3 | 5 | 0.4 |
| Phase324B-2 | 4 | 1 | 5 | 0.8 |
| Phase324B-3 | 1 | 4 | 5 | 0.2 |
- total new smoke candidates passed: 7/15
- total smokePassedModels after original verified models: 9

## Failure Analysis

- 404: 4
- 410: 1
- nvidia_http_error: 9
- completionVerified=false: 9
- assistantTextPresent=false: 9
- timeout: 0
- schema invalid: 0

### Not Recommended For Short-Term Retry

- meta/llama2-70b
- meta/llama3-8b
- microsoft/phi-3-mini-4k-instruct
- mistralai/mistral-7b-instruct
- mistralai/mistral-7b-instruct-v0.3

## Latency Analysis

- passedAverageLatencyMs: 7702.14
- failedAverageLatencyMs: 622.11
- overallAverageLatencyMs: 3719.63
- minLatency: nvidia/llama-3.1-nemotron-ultra-253b-v1 (0ms)
- maxLatency: meta/llama-3.1-8b-instruct (30503ms)

### Passed Model Latencies

- nvidia/nemotron-3-super-120b-a12b: 974ms
- nvidia/nemotron-mini-4b-instruct: 428ms
- abacusai/dracarys-llama-3.1-70b-instruct: 1011ms
- meta/llama-3.1-70b-instruct: 2143ms
- meta/llama-3.1-8b-instruct: 30503ms
- meta/llama-3.3-70b-instruct: 18410ms
- microsoft/phi-4-mini-instruct: 446ms

### Slow Models

- meta/llama-3.1-8b-instruct: 30503ms
- meta/llama-3.3-70b-instruct: 18410ms

## Evidence Coverage

- selectableModelsHaveEvidenceId: true
- smokeFailedModelsHaveEvidence: true
- unverifiedModels: 125
- missingEvidenceModels: 130
- evidenceCoverageRatio: 0.1216

## Model Status Buckets

- selectable verified: 9
- smoke_failed: 9
- unverified: 125
- deprecated: 5
- blocked: 0
- manual-review: 0

## Operational Risks

- 404/410 models are not good short-term retry candidates.
- High-latency models may affect UX and should be labeled or sorted in UI.
- Partner catalog availability may be unstable; evidence must remain explicit.
- Future provider slots are not real provider enablement.
- Multi-provider work still needs a separate safety design phase.

## Next Actions

- Phase324D-2: add UI filters, sorting, latency badges, and evidenceId search.
- Phase324B-4: continue NVIDIA-only smoke only after excluding 404/410 high-risk models.
- Phase324F: design model selection/default recommendation strategy.
- Phase325A: multi-provider safety design only; no OpenAI / Claude / OpenRouter / MiMo real calls.

## Safety

- apiCalled: false
- envRead: false
- verificationMetadataModified: false
- uiModified: false
- selectableGateModified: false
- chatGatewayModified: false
