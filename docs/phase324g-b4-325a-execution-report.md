# Phase324G + Phase324B-4 + Phase325A Execution Report

## 1. Scope

- Phase324G: documentation only.
- Phase324B-4: NVIDIA-only real smoke and evidence only.
- Phase325A: design only.

No selectable metadata was changed in this combined round.

## 2. Baseline

Verified facts from the latest verifier run before Phase324B-4:

- `verify:phase107a-secret-safety`: passed.
- `verify:phase321a-workbench-product-recovery`: passed.
- `verify:phase313a-model-usability-matrix`: passed.
- `smokePassedModels=9`.
- `selectableModels=9`.

Operations display baseline from Phase324E:

- `failedModels=9`.
- `unverifiedModels=125`.

The verifier baseline and the operations display baseline are not the same metric. Both were preserved as documented inputs.

## 3. Phase324G

Outputs:

- `docs/phase324g-model-library-operations-handbook.md`
- `docs/phase324g-model-library-operations-checklist.md`

Coverage:

- Candidate selection.
- NVIDIA smoke flow.
- Evidence requirements.
- Selectable review gate.
- Failed, unverified, and high-latency rules.
- Secret safety.
- NVIDIA-only boundary.
- Future-provider-slot boundary.

## 4. Phase324B-4 Candidate Selection

Preview inputs:

- `docs/phase324a-nvidia-model-candidate-inventory.json`
- `docs/phase324e-model-library-operations-report.json`
- `docs/phase324e-model-library-operations-dashboard-data.json`
- `docs/phase324d2f-model-selection-strategy.json`
- Previous Phase324B/B-2/B-3 batch results

Preview outcome:

- plannedModelCount: 5
- nonNvidiaPlanned: false
- selectablePlanned: false
- highRiskPlanned: false
- nonChatPlanned: false

Planned models:

- `bytedance/seed-oss-36b-instruct`
- `deepseek-ai/deepseek-v3.1-terminus`
- `deepseek-ai/deepseek-v3.2`
- `deepseek-ai/deepseek-v4-flash`
- `deepseek-ai/deepseek-v4-pro`

Excluded high-risk models:

- `meta/llama2-70b`
- `meta/llama3-8b`
- `microsoft/phi-3-mini-4k-instruct`
- `mistralai/mistral-7b-instruct`
- `mistralai/mistral-7b-instruct-v0.3`
- `nvidia/llama-3.1-nemotron-ultra-253b-v1`
- `nvidia/llama-3.3-nemotron-super-49b-v1.5`
- `nvidia/nemotron-3-nano-30b-a3b`
- `nvidia/nvidia-nemotron-nano-9b-v2`

Excluded selectable models:

- `abacusai/dracarys-llama-3.1-70b-instruct`
- `meta/llama-3.1-70b-instruct`
- `meta/llama-3.1-8b-instruct`
- `meta/llama-3.3-70b-instruct`
- `microsoft/phi-4-mini-instruct`
- `nvidia/llama-3.1-nemotron-nano-8b-v1`
- `nvidia/llama-3.3-nemotron-super-49b-v1`
- `nvidia/nemotron-3-super-120b-a12b`
- `nvidia/nemotron-mini-4b-instruct`

## 5. Phase324B-4 Results

Outputs:

- `tools/phase324b/run-phase324b4-nvidia-smoke-batch.mjs`
- `apps/ai-gateway-service/evidence/phase324b4/*.json`
- `docs/phase324b4-nvidia-smoke-batch-result.json`
- `docs/phase324b4-nvidia-smoke-batch-report.md`
- `docs/phase324b4-model-smoke-evidence-index.json`

Aggregate result:

- processedModelCount: 5
- smokePassedCount: 1
- smokeFailedCount: 4
- skippedEnvMissingCount: 0
- manualReviewRequiredCount: 0
- eligibleForPhase324C3Count: 1
- nonNvidiaCallsDetected: false
- secretExposureDetected: false

Per model:

- `bytedance/seed-oss-36b-instruct`
  - finalStatus: `smoke_failed`
  - httpStatus: `200`
  - errorCode: `nvidia_http_error`
  - latencyMs: `8574`
  - selectableRecommendation: `not_eligible`

- `deepseek-ai/deepseek-v3.1-terminus`
  - finalStatus: `smoke_failed`
  - httpStatus: `410`
  - errorCode: `nvidia_http_error`
  - latencyMs: `96`
  - selectableRecommendation: `not_eligible`

- `deepseek-ai/deepseek-v3.2`
  - finalStatus: `smoke_failed`
  - httpStatus: `410`
  - errorCode: `nvidia_http_error`
  - latencyMs: `96`
  - selectableRecommendation: `not_eligible`

- `deepseek-ai/deepseek-v4-flash`
  - finalStatus: `smoke_failed`
  - httpStatus: `null`
  - errorCode: `nvidia_request_timeout`
  - latencyMs: `45012`
  - selectableRecommendation: `not_eligible`

- `deepseek-ai/deepseek-v4-pro`
  - finalStatus: `smoke_passed`
  - httpStatus: `200`
  - errorCode: `null`
  - latencyMs: `930`
  - selectableRecommendation: `eligible_after_phase324c3`

## 6. Phase324C-3 Candidate

The only model eligible for later selectable review is:

- `deepseek-ai/deepseek-v4-pro`

This report does not treat that model as selectable yet. A separate Phase324C-3 review is required.

## 7. Phase325A

Outputs:

- `docs/phase325a-multi-provider-safety-design.md`
- `docs/phase325a-provider-rollout-gates.md`

Design boundaries:

- NVIDIA remains the only active real provider.
- OpenAI, Claude, OpenRouter, MiMo, and local remain future-provider-slot only.
- No non-NVIDIA API call happened.
- No provider client was changed.
- No route was changed.
- No UI enable switch was added.

## 8. Production Code Boundary

This round did not modify:

- `apps/ai-gateway-service/src/ui/consolePage.js`
- `apps/ai-gateway-service/src/ui/workbench/apiClient.js`
- `apps/ai-gateway-service/src/httpServer.js`
- `apps/ai-gateway-service/src/chat-gateway/`
- `apps/ai-gateway-service/src/providers/`
- `apps/ai-gateway-service/src/model-library/`
- `apps/ai-gateway-service/evidence/phase-313a-model-verification-state.json`
- `README.md`
- `AGENTS.md`

Only a new standalone smoke tool and new docs/evidence were added.

## 9. Safety Boundary

- NVIDIA API called: yes, in Phase324B-4 only.
- Non-NVIDIA API called: no.
- selectable modified: no.
- Chat main chain modified: no.
- Phase313 verification metadata modified: no.
- secret plaintext output: no.
- `.env` plaintext read or printed: no.
- `legacy/` modified: no.
- `PROJECT_CONTEXT.md` created: no.
- commit, push, deploy, release: no.

## 10. Seal Recommendation

Recommended seal status: yes.

Reason:

- Phase324G produced the required handbook and checklist.
- Phase324B-4 preview enforced the exclusion rules.
- Phase324B-4 real smoke stayed NVIDIA-only and produced full evidence.
- Phase325A remained documentation-only.
- selectable stayed at 9 according to the verifier baseline after the run.

