# Phase324C-3 + Phase324B-5 + Phase325B Execution Report

## 1. Phase324C-3

Completed a narrow selectable review for:

- `deepseek-ai/deepseek-v4-pro`

The review used Phase324B-4 evidence only:

- `phase324b4-deepseek_ai_deepseek_v4_pro-20260506151431`

Rejected models stayed non-selectable:

- `bytedance/seed-oss-36b-instruct`
- `deepseek-ai/deepseek-v3.1-terminus`
- `deepseek-ai/deepseek-v3.2`
- `deepseek-ai/deepseek-v4-flash`

After apply and verifier refresh:

- smokePassedModels: 10
- selectableModels: 10

## 2. Phase324B-5

Completed NVIDIA-only smoke for 5 models:

- `google/codegemma-7b`
- `google/gemma-2-2b-it`
- `google/gemma-3-27b-it`
- `google/gemma-3n-e2b-it`
- `google/gemma-3n-e4b-it`

Preview outcome:

- safeCandidateCount: 57
- plannedModelCount: 5
- already selectable models excluded: 10
- 404/410/timeout high-risk models excluded: 13
- non-chat models excluded: 68
- non-NVIDIA planned: false
- selectable planned: false
- high-risk planned: false
- non-chat planned: false

Smoke outcome:

- smoke_passed: 2
- smoke_failed: 3
- skipped_env_missing: 0
- manual_review_required: 0
- eligibleForPhase324C4Count: 2

Per-model summary:

- `google/codegemma-7b`: failed, `httpStatus=404`
- `google/gemma-2-2b-it`: failed, `httpStatus=422`
- `google/gemma-3-27b-it`: failed, `httpStatus=400`
- `google/gemma-3n-e2b-it`: passed
- `google/gemma-3n-e4b-it`: passed

The two passed models were not added to selectable in this round. They require a later Phase324C-4 review.

## 3. Phase325B

Completed design-only config schema work for multi-provider support.

Outputs:

- `docs/phase325b-provider-config-schema-design.md`
- `docs/phase325b-provider-config-schema-draft.json`
- `docs/phase325b-provider-config-validation-rules.md`
- `docs/phase325b-execution-report.md`

This phase did not call OpenAI, Claude, OpenRouter, MiMo, or local.

## 4. Safety Boundary

- Non-NVIDIA API called: no
- Chat main chain changed: no
- /chat-gateway/execute changed: no
- Chat send changed: no
- provider client changed: no
- selectable gate changed: no
- legacy/ changed: no
- PROJECT_CONTEXT.md created: no
- commit/push/deploy/release: no
- secret printed: no
- embedding batch training: no

## 5. Verification

Commands run:

- `cmd /c pnpm run verify:phase107a-secret-safety`
- `cmd /c pnpm run health:phase12a`
- `cmd /c pnpm run doctor:phase13a`
- `cmd /c pnpm run verify:phase321a-workbench-product-recovery`
- `cmd /c pnpm run verify:phase313a-model-usability-matrix`
- `cmd /c pnpm -r --if-present check`
- `node --check tools/phase324c/build-phase324c3-selectable-review.mjs`
- `cmd /c node tools/phase324c/build-phase324c3-selectable-review.mjs`
- `cmd /c node tools/phase324c/apply-phase324c3-selectable-update.mjs --dry-run`
- `node --check tools/phase324c/apply-phase324c3-selectable-update.mjs`
- `cmd /c node tools/phase324c/apply-phase324c3-selectable-update.mjs --apply`
- `cmd /c pnpm run verify:phase313a-model-usability-matrix`
- `node --check tools/phase324b/run-phase324b5-nvidia-smoke-batch.mjs`
- `cmd /c node tools/phase324b/run-phase324b5-nvidia-smoke-batch.mjs --preview`
- `cmd /c node tools/phase324b/run-phase324b5-nvidia-smoke-batch.mjs --run`
- `cmd /c pnpm run verify:phase322a-workbench-chat-gateway-real-nvidia`

All passed.

## 6. Rollback Notes

- C-3 rollback: revert `apps/ai-gateway-service/evidence/phase-313a-model-verification-state.json` targeted record and refresh verifier outputs.
- B-5 rollback: delete only the B-5 evidence/docs/tool files if needed.
- 325B rollback: remove only the new design docs.

No git reset or git clean is required.

## 7. Recommendation

Seal recommended: yes.

Reason:

- C-3 was narrow and evidence-backed.
- B-5 stayed NVIDIA-only and did not touch selectable.
- 325B remained design-only.
- Base verifier chain remained green.

