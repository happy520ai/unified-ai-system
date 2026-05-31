# Model Usability Matrix And Selectable Gate

Phase313A adds a verification matrix around the Phase312A unified NVIDIA model library. The goal is to treat the 148 catalog records as model assets with explicit usability state, not as 148 automatically callable chat models.

## Why 148 Models Are Not 148 Usable Chat Models

The library can know that a model exists before the system knows that it can safely call that model through the current endpoint. A catalog record may be a chat model, an embedding model, a reranker, a safety or PII tool, a translation model, a multimodal model, a voice or video model, a biology model, an OpenUSD model, an autonomous driving model, a downloadable-only model, or a deprecated entry.

Only a model with `verificationStatus=smoke_passed` and a trusted evidence source may become `selectable=true`. Unverified, failed, blocked, wrong-endpoint, unsupported, rate-limited, unknown, and deprecated models are not selectable.

## Chat Models And Task Tool Models

The Chat direct model dropdown is limited to `chat`, `reasoning_chat`, and `code` buckets that are also `smoke_passed` and `directChatAllowed=true`.

Task tool models can appear in the task tool area with their bucket and verification state. Embedding, rerank, safety, PII, translation, multimodal, vision, audio, voice, video, biology, OpenUSD, autonomous driving, unknown, and deprecated records do not enter the ordinary Chat dropdown. If a task tool is not `smoke_passed`, the UI marks it as unverified and the system will not call it by default.

## Dry-run Verification Plan

Run:

```powershell
cmd /c pnpm smoke:phase313a-dry-run-model-verification-plan
```

The dry-run planner defaults to no provider calls, `maxModels<=5`, `rpmLimit<=40`, provider `nvidia`, and a small candidate set from chat, reasoning chat, or code buckets. It reports candidate models, skipped models, skip reasons, estimated request count, estimated minimum duration, policy warnings, and `willCallProvider=false`.

## Small-batch NVIDIA Smoke

Real smoke is blocked unless the environment explicitly enables it:

```powershell
$env:PHASE313A_NVIDIA_REAL_SMOKE="1"; $env:PHASE313A_MAX_REAL_SMOKE_MODELS="3"; pnpm smoke:phase313a-nvidia-model-usability
```

or:

```powershell
cmd /c "set PHASE313A_NVIDIA_REAL_SMOKE=1&& set PHASE313A_MAX_REAL_SMOKE_MODELS=3&& pnpm smoke:phase313a-nvidia-model-usability"
```

The runner caps the batch at 5 models, defaults to 3, preserves the Phase312A passed model `nvidia/llama-3.3-nemotron-super-49b-v1`, prioritizes direct chat buckets, and avoids embedding batch training and specialized large tasks. It calls only NVIDIA through the existing NVIDIA client.

## 40 RPM Safety

The free NVIDIA API limit is treated as 40 RPM. Phase313A uses a minimum spacing derived from that limit and stops the real smoke batch when a rate limit is observed. `rate_limited` is kept as a retry candidate but is not selectable.

## Boundaries

Phase313A does not change the default `/chat` route and does not replace it with `/chat-gateway/execute`. In plain terms: default /chat stays unchanged. The Chat Gateway route remains preserved as an explicit route.

Phase313A does not call paid API, MiMo, OpenAI, Claude, or OpenRouter. It does not do embedding batch training. It does not claim specialized, voice, video, biology, OpenUSD, autonomous driving, or unknown models are normal Chat models.

The workspace may be dirty before and after this phase. A dirty workspace is not itself a Phase313A failure, but the phase must not claim the workspace is clean.
