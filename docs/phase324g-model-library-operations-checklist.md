# Phase324G Model Library Operations Checklist

Use this checklist before, during, and after every model-library smoke or selectable review phase.

## 1. Preflight

- [ ] Confirm `legacy/` will not be modified.
- [ ] Confirm `PROJECT_CONTEXT.md` will not be created.
- [ ] Confirm no commit, push, deploy, or release will be performed.
- [ ] Run `cmd /c pnpm run verify:phase107a-secret-safety`.
- [ ] Run `cmd /c pnpm run health:phase12a`.
- [ ] Run `cmd /c pnpm run doctor:phase13a`.
- [ ] Run `cmd /c pnpm run verify:phase313a-model-usability-matrix`.
- [ ] Confirm `smokePassedModels=9`.
- [ ] Confirm `selectableModels=9`.
- [ ] Confirm no secret is printed.

## 2. Candidate Selection

- [ ] Candidate provider is NVIDIA.
- [ ] Candidate is not already selectable.
- [ ] Candidate is not known 404/410 high risk.
- [ ] Candidate is not a previous short-term failed retry exclusion.
- [ ] Candidate capability is `chat`, `reasoning_chat`, or `code`.
- [ ] Candidate does not require special payload.
- [ ] Candidate is not embedding, rerank, safety, biology, voice, video, vision, OpenUSD, autonomous driving, multimodal, or unknown.
- [ ] Batch size is 5 or fewer.
- [ ] If fewer than 3 safe candidates exist, do not fill from unsafe pools.

## 3. Smoke Preview

- [ ] Run preview command.
- [ ] Preview lists planned smoke models.
- [ ] Preview lists excluded high-risk models.
- [ ] Preview lists excluded selectable models.
- [ ] Preview lists excluded non-chat models.
- [ ] Preview confirms NVIDIA-only.
- [ ] Stop if preview includes any high-risk 404/410 model.
- [ ] Stop if preview includes any selectable model.
- [ ] Stop if preview includes any non-NVIDIA provider.

## 4. Real NVIDIA Smoke

- [ ] Run only after preview passes.
- [ ] Use NVIDIA only.
- [ ] Do not call OpenAI, Claude, OpenRouter, MiMo, or local models.
- [ ] Do not read or print `.env`.
- [ ] Use small prompt and small token budget.
- [ ] Keep request count at 5 or fewer.
- [ ] Throttle requests for the 40 RPM limit.
- [ ] If key is missing, write `skipped_env_missing` and do not claim pass.
- [ ] If rate limited, stop or record the failure honestly.

## 5. Evidence

- [ ] Each processed model has one evidence JSON file.
- [ ] Evidence has `phase`.
- [ ] Evidence has `modelId`.
- [ ] Evidence has `providerId`.
- [ ] Evidence has `requestId`.
- [ ] Evidence has `dryRun=false` for real smoke, or `skipped_env_missing` when no call happened.
- [ ] Evidence has `providerCalled`.
- [ ] Evidence has `completionVerified`.
- [ ] Evidence has `assistantTextPresent`.
- [ ] Evidence has redacted/truncated `assistantTextSample`.
- [ ] Evidence has `httpStatus`.
- [ ] Evidence has `latencyMs`.
- [ ] Evidence has `errorCode`.
- [ ] Evidence has redacted error message.
- [ ] Evidence has `finalStatus`.
- [ ] Evidence has `evidenceId`.
- [ ] Evidence has `selectableRecommendation`.

## 6. Selectable Review Gate

- [ ] Do not update selectable in the smoke phase.
- [ ] Do not update Phase313A verification metadata in the smoke phase.
- [ ] Only `smoke_passed` models can enter a later review phase.
- [ ] Review requires `providerCalled=true`.
- [ ] Review requires `completionVerified=true`.
- [ ] Review requires `assistantTextPresent=true`.
- [ ] Review requires a non-empty `evidenceId`.
- [ ] Failed, skipped, manual-review, and unverified models stay out of Chat dropdown.

## 7. High Latency

- [ ] Mark latency greater than 10000 ms as high latency.
- [ ] Treat high latency as UX/strategy warning only.
- [ ] Do not automatically remove selectable status because of latency.

## 8. Multi-Provider Boundary

- [ ] NVIDIA is the only real provider.
- [ ] OpenAI is future-provider-slot.
- [ ] Claude is future-provider-slot.
- [ ] OpenRouter is future-provider-slot.
- [ ] MiMo is future-provider-slot.
- [ ] local is future-provider-slot.
- [ ] Do not expose real enable buttons for future providers.
- [ ] Do not configure provider keys.
- [ ] Do not call non-NVIDIA APIs.

## 9. Final Verification

- [ ] Run `node --check` for modified or new JS files.
- [ ] Run `cmd /c pnpm run verify:phase313a-model-usability-matrix`.
- [ ] Confirm `selectableModels=9`.
- [ ] Confirm `smokePassedModels=9` unless a later selectable phase explicitly changes it.
- [ ] Run `cmd /c pnpm run verify:phase107a-secret-safety`.
- [ ] Run `cmd /c pnpm -r --if-present check`.
- [ ] Run any phase-specific verifier required by the active phase.

## 10. Final Report

- [ ] Separate verified facts from operational display metrics.
- [ ] State whether NVIDIA API was called.
- [ ] State whether non-NVIDIA API was called.
- [ ] State whether selectable changed.
- [ ] State whether Chat main chain changed.
- [ ] State whether production code changed.
- [ ] List evidence files.
- [ ] List commands and results.
- [ ] Do not claim workspace clean.

