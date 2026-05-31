# Phase324G Model Library Operations Handbook

## 1. Baseline

This handbook is for the long-running unified-ai-system model library operation line.

Verified facts from the latest local verifier run on 2026-05-06:

- provider scope: NVIDIA-only real provider.
- totalModels: 148.
- smokePassedModels: 9.
- selectableModels: 9.
- unverifiedModels: 133 in `verify:phase313a-model-usability-matrix`.
- failedModels: 1 in `verify:phase313a-model-usability-matrix`.
- multi-provider status: OpenAI, Claude, OpenRouter, MiMo, and local are future-provider-slot only.

Operations display baseline from Phase324E:

- selectableModels: 9.
- smokePassedModels: 9.
- failedModels: 9, operations display count including Phase324B/B-2/B-3 smoke failures.
- unverifiedModels: 125, operations display count after excluding the 9 operations failures.

Current verified selectable models:

- `abacusai/dracarys-llama-3.1-70b-instruct`
- `meta/llama-3.1-70b-instruct`
- `meta/llama-3.1-8b-instruct`
- `meta/llama-3.3-70b-instruct`
- `microsoft/phi-4-mini-instruct`
- `nvidia/llama-3.1-nemotron-nano-8b-v1`
- `nvidia/llama-3.3-nemotron-super-49b-v1`
- `nvidia/nemotron-3-super-120b-a12b`
- `nvidia/nemotron-mini-4b-instruct`

Do not describe future-provider-slot entries as opened provider capability.

## 2. Smoke Candidate Selection

Candidate selection must happen before any real provider call.

Required inclusion rules:

- Provider route must be NVIDIA.
- Candidate must not already be one of the 9 selectable models.
- Candidate must not be in the short-term high-risk 404/410 or known failure list.
- Candidate capability must be `chat`, `reasoning_chat`, or `code`.
- Candidate must not require a special payload.
- Candidate must not be deprecated or blocked.
- Candidate batch size must be 5 or fewer.
- If fewer than 3 safe candidates remain, run fewer models; do not fill the batch with unsafe models.

Required exclusions:

- `meta/llama2-70b`
- `meta/llama3-8b`
- `microsoft/phi-3-mini-4k-instruct`
- `mistralai/mistral-7b-instruct`
- `mistralai/mistral-7b-instruct-v0.3`
- `nvidia/llama-3.1-nemotron-ultra-253b-v1`
- `nvidia/llama-3.3-nemotron-super-49b-v1.5`
- `nvidia/nemotron-3-nano-30b-a3b`
- `nvidia/nvidia-nemotron-nano-9b-v2`

Also exclude task-only buckets:

- `embedding`
- `rerank`
- `safety`
- `pii`
- `translation`
- `biology`
- `openusd`
- `autonomous_driving`
- `voice`
- `video`
- `vision`
- `multimodal`
- `unknown`
- `deprecated`

## 3. Smoke Execution

Real smoke is NVIDIA-only unless a later explicit phase opens another provider.

Execution rules:

- Run preview first.
- Confirm preview contains no already selectable model.
- Confirm preview contains no high-risk 404/410 model.
- Confirm preview contains no non-NVIDIA provider.
- Use a short health-check prompt.
- Keep `maxTokens` small.
- Keep the batch to 5 models or fewer.
- Respect 40 RPM by adding a delay between requests.
- Stop or record failure honestly on rate limit, timeout, HTTP error, empty response, or schema invalid response.

If `NVIDIA_API_KEY` is missing at runtime:

- Do not call the provider.
- Generate a `skipped_env_missing` summary.
- Do not record `smoke_passed`.
- Do not print the key or read `.env` plaintext.

## 4. Evidence

Each processed model must have one standalone evidence file.

Required evidence fields:

- `phase`
- `modelId`
- `providerId`
- `timestamp`
- `requestId`
- `dryRun`
- `providerCalled`
- `completionVerified`
- `assistantTextPresent`
- `assistantTextSample`, redacted and truncated
- `httpStatus`
- `latencyMs`
- `errorCode`
- `errorMessageRedacted`
- `finalStatus`
- `evidenceId`
- `selectableRecommendation`

Allowed `finalStatus` values:

- `smoke_passed`
- `smoke_failed`
- `skipped_env_missing`
- `manual_review_required`

`smoke_passed` requires all of these:

- Real NVIDIA call happened.
- `providerCalled=true`.
- `completionVerified=true`.
- `assistantTextPresent=true`.
- Response envelope is valid.
- No missing key.
- No timeout.
- No schema invalid condition.

## 5. Failed And Unverified Classification

Classify as failed when any of these occur:

- HTTP 404 or 410.
- `nvidia_http_error`.
- `completionVerified=false`.
- `assistantTextPresent=false`.
- Timeout.
- Schema invalid.
- Empty completion.
- `providerCalled=false` during a requested real smoke, unless the result is `skipped_env_missing`.
- Any non-NVIDIA routing.

Classify as unverified when:

- No smoke evidence exists.
- No real smoke was run.
- Capability is unclear.
- The model is not reviewed for direct chat.

Unverified models must not enter the Chat dropdown.

## 6. High Latency

Mark a model high latency when smoke latency is greater than 10000 ms.

High latency is a UX and selection-strategy warning only. It does not automatically remove a model from selectable status. Any de-selection requires a later review phase with evidence and an explicit metadata change.

## 7. Selectable Review

Smoke evidence does not automatically update selectable metadata.

A model may enter selectable review only when:

- `finalStatus=smoke_passed`.
- `providerCalled=true`.
- `completionVerified=true`.
- `assistantTextPresent=true`.
- `evidenceId` is present.
- Capability bucket is `chat`, `reasoning_chat`, or `code`.
- The model is not deprecated, blocked, failed, rate-limited, or unsupported.

The review phase must be separate, such as Phase324C-3 after Phase324B-4.

Failed, skipped, manual-review, and unverified models cannot enter the Chat dropdown.

## 8. Rollback

Rollback must be narrow and evidence-preserving.

Allowed rollback:

- Revert or correct the specific verification metadata entry in a later controlled patch.
- Keep historical smoke evidence files.
- Add a superseding evidence file explaining the correction.
- Re-run `verify:phase313a-model-usability-matrix`.
- Re-run secret safety and safe regression checks.

Do not use `git reset` or `git clean` as the default rollback method. Use targeted file edits and evidence-backed correction unless the user explicitly asks for destructive git operations.

## 9. Secret Safety

Never print or store plaintext API keys, `.env` values, tokens, or credentials.

Evidence may record:

- key presence as boolean.
- provider id.
- status.
- sanitized failure code.
- sanitized failure message.

Evidence must not record:

- API key values.
- bearer tokens.
- raw `.env` lines.
- request authorization headers.

## 10. Provider Boundary

NVIDIA is the only current real provider lane.

OpenAI, Claude, OpenRouter, MiMo, and local are future-provider-slot entries. They may be documented, but they must not be called, enabled, or exposed as real working providers until later phases add explicit config, route gates, evidence, and user authorization.

Do not change:

- default `/chat`.
- `/chat-gateway/execute`.
- Chat send request body.
- selectable gate.
- provider clients.
- route registry.

