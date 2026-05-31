# Unified Model Library And Chat Gateway Orchestration

Phase312A upgrades the AI Gateway from a single model configuration surface to a unified model library, Provider Key configuration center, Chat Gateway control route, NVIDIA provider client, and evidence-backed smoke verification flow.

## Scope

- Provider integrated in this phase: NVIDIA only.
- Future provider slots are present for OpenAI, Claude, OpenRouter, MiMo, and Local, but they are not executed in Phase312A.
- Real external calls are blocked unless `PHASE312A_NVIDIA_REAL_SMOKE=1`.
- MiMo, paid APIs, OpenAI, Claude, OpenRouter, embedding batch training, deploy, release, commit, and push remain out of scope.
- The existing default `/chat` route is not replaced; Phase312A adds `/chat-gateway/execute`.

## Model Library Coverage

The registry lives in `apps/ai-gateway-service/src/model-library/` and every record includes provider identity, model id, display name, publisher, source, source URL or discovery note, catalog status, endpoint type/path, capabilities, UI grouping, free/partner/downloadable flags, commercial safety, usage restrictions, smoke status, and notes.

NVIDIA coverage is seeded from:

- NVIDIA API Catalog / NIM LLM API reference: https://docs.api.nvidia.com/nim/reference/llm-apis
- NVIDIA retrieval API reference for embeddings and rerank: https://docs.api.nvidia.com/nim/reference/retrieval-apis
- NVIDIA model catalog landing page: https://build.nvidia.com/models
- User-screenshot supplemental memory: models previously requested by the user are treated as `user_screenshot_supplement` when present in the seed list.
- Manual Phase312A supplemental records for specialized NVIDIA catalog families such as PII, safety, voice, video, autonomous driving, OpenUSD, and biology.

If live catalog discovery cannot run from the current Codex environment, the registry records blocker `catalog_discovery_unavailable`. The static seed remains usable as catalog-known coverage, but the phase does not claim exhaustive current coverage unless live discovery succeeds.

## Capability Layers

Direct Chat capabilities:

- `chat_general`
- `chat_reasoning`
- `chat_coding`
- `chat_multilingual`
- `chat_agent_tool`
- `rag_answer`

Task Tool capabilities:

- `embedding_text`
- `embedding_code`
- `rerank`
- `safety`
- `pii_detection`
- `translation`
- `multimodal_image`
- `voice_tts`
- `voice_chat`
- `video`
- `autonomous_driving`
- `openusd`
- `biology`
- `specialized_hidden`

Non-chat models are visible in the Chat model library, but they are not sent to `/chat/completions` as normal chat models. They can only be used as task-tool preferences when capability and endpoint checks allow it.

## State Rules

Model state is layered:

- `catalog_known`: the registry knows about the model.
- `configured`: the provider has a configured key from environment or runtime credential store.
- `smoke_passed`: a real NVIDIA smoke result succeeded.
- `selectable`: the model can be manually selected in Chat.
- `default_candidate`: the model can be used as a default task model.

Rules:

- `selectable` requires `smoke_passed=true`.
- Unverified models can be displayed but cannot be default-selected.
- Deprecated models cannot be default candidates.
- Commercial-unsafe models cannot be commercial defaults.
- Downloadable-only models cannot be called as hosted API models.
- Partner endpoints are not default candidates unless a real smoke proves usability.
- Specialized payload models remain catalog-known until endpoint-specific payload support exists.

## Provider Key Configuration

The Provider Key configuration center supports:

- `NVIDIA_API_KEY`
- `NVIDIA_BASE_URL`
- Default provider status
- Key status: not configured, configured, tested passed, tested failed

The UI never renders plaintext API keys. The backend may read environment presence or save a runtime credential locally, but responses only include status and sanitized metadata.

## Chat Gateway Control Flow

The Chat page uses the new `/chat-gateway/execute` route for Phase312A gateway mode.

Flow:

1. `gatewayIntentClassifier.js` classifies the user input.
2. `gatewayModelPlanner.js` maps the intent to required capabilities and selects a smoke-passed compatible model when available.
3. `capabilitySafeExecutionRouter.js` calls the NVIDIA endpoint only when provider, model, endpoint type, and capability all match.
4. `resultCompletionVerifier.js` verifies provider call evidence, model match, non-empty output, endpoint correctness, fallback evidence, and minimum intent fit.
5. `chatGatewayEvidenceRecorder.js` writes sanitized evidence without secrets.

Modes shown in the Chat UI:

- Automatic gateway mode
- Manual model mode
- Knowledge mode
- Programming mode
- Safety review mode
- Translation mode

## Real Smoke Boundary

`smokePhase312ANvidiaRealModels.js` does not call NVIDIA by default. It only calls NVIDIA when:

```powershell
set PHASE312A_NVIDIA_REAL_SMOKE=1
cmd /c pnpm smoke:phase312a-nvidia-real-models
```

The real smoke:

- Uses `NVIDIA_API_KEY` without printing it.
- Limits calls to at most 20 per minute.
- Tests every already-selectable NVIDIA model plus requested smoke candidates.
- Uses endpoint-specific payloads for chat, embeddings, rerank, safety, PII, and translation.
- Leaves multimodal, voice, video, OpenUSD, autonomous driving, biology, and other special payload models catalog-known unless a specific smoke path is implemented.
- Records `usable`, `blocked`, `wrong_endpoint`, or `rate_limited` per model.

## Evidence

Primary Phase312A evidence files:

- `apps/ai-gateway-service/evidence/phase-312a-unified-model-library.json`
- `apps/ai-gateway-service/evidence/phase-312a-unified-model-library.md`
- `apps/ai-gateway-service/evidence/phase-312a-nvidia-real-smoke.json`
- `apps/ai-gateway-service/evidence/phase-312a-nvidia-real-smoke.md`
- `apps/ai-gateway-service/evidence/phase-312a-chat-ui-runtime.json`
- `apps/ai-gateway-service/evidence/phase-312a-chat-ui-runtime.md`

Chat Gateway per-call evidence:

- `apps/ai-gateway-service/evidence/phase-312a-chat-gateway-evidence.jsonl`
- `apps/ai-gateway-service/evidence/phase-312a-chat-gateway-latest.json`

This phase does not guarantee production SLA. It only records local registry validation, local UI/backend wiring, and local real-smoke results when the explicit NVIDIA smoke switch is enabled.
