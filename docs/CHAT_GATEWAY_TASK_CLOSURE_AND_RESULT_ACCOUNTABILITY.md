# Chat Gateway Task Closure & Result Accountability Chain

Phase 314A adds task-level accountability to the Chat Gateway introduced in Phase 312A and refined in Phase 313A.

## Why "model returned text" is not enough

A model returning text does not mean the task was completed correctly. Phase 314A introduces:

1. **Intent classification** — what does the user actually want?
2. **Task-aware model selection** — is the right model available for this task?
3. **Safe execution or safe refusal** — should we call the model, or refuse?
4. **Completion verification** — did the model actually complete the task?
5. **Evidence recording** — what exactly happened, and can we prove it?

## Task Types

| Task | Route Decision | Provider Called |
|------|---------------|----------------|
| general_chat | execute_with_verified_chat_model | Yes (if real smoke) |
| code_assist | execute_with_verified_chat_model | Yes (if real smoke) |
| summarization | execute_with_verified_chat_model | Yes (if real smoke) |
| translation | execute_with_verified_chat_model | Yes (if real smoke) |
| planning | execute_with_verified_chat_model | Yes (if real smoke) |
| project_status_reasoning | execute_with_verified_chat_model | Yes (if real smoke) |
| unsafe_secret_request | reject_unsafe_request | **No** |
| unsafe_release_request | reject_unsafe_request | **No** |
| unsupported_non_chat_model_request | block_non_chat_model | **No** |
| unknown_intent | require_clarification | **No** |

## Completion Verified Rules

- **providerCalled=false**: cannot be marked as completed, except for safety rejects
- **Safety rejects** (unsafe_secret_request, unsafe_release_request, unsupported_non_chat_model_request): `completionVerified=true`, verificationReason="拒绝动作已正确完成"
- **Provider call failed**: `completionVerified=false`
- **Model not selectable**: `completionVerified=false`
- **Response empty or malformed**: `completionVerified=false`
- **EvidenceId missing**: `completionVerified=false`

## Responsibility Chain

```
User Input
  → Intent Classification (gatewayIntentClassifier.js)
  → Task-Aware Model Selection (gatewayModelPlanner.js)
  → Execution or Block (capabilitySafeExecutionRouter.js)
  → Completion Verification (resultCompletionVerifier.js)
  → Evidence Recording (chatGatewayEvidenceRecorder.js)
```

## Model Selection Rules

Only models that pass the Phase 313A selectable gate can be called:
- `verificationStatus === "smoke_passed"`
- `selectable === true`
- `directChatAllowed === true` (for chat tasks)

## Smoke Coverage

### Dry-run smoke (Phase 314A)
- Covers all 10 task types
- Does NOT call any provider
- Verifies intent classification, route decisions, safety blocks

### Real NVIDIA smoke (Phase 314A)
- Gated behind `PHASE314A_NVIDIA_REAL_SMOKE=1`
- Up to 3 tasks: general_chat, summarization, code_assist
- 3.1s interval between calls (≤20 RPM)
- Does NOT call MiMo, OpenAI, Claude, OpenRouter, or paid APIs
- Does NOT do embedding batch training

## Boundaries

- Default /chat is NOT changed
- Phase 312A / 313A model selection and verification gates are preserved
- Only NVIDIA models are callable (Phase 312A provider restriction)
- No API keys, secrets, or .env content is exposed
- Workspace dirty state is acknowledged; no claim of cleanliness
