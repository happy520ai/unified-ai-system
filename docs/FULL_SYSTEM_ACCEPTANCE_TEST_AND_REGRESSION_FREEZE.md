# Phase315A Full System Acceptance Test, Regression Freeze & Simulated Human Journey QA

Phase315A is a system acceptance phase. It does not add new gateway business capability. It verifies that the existing UI, model library, selectable gate, Chat Gateway responsibility chain, safety rejection, and evidence surfaces work together as a usable local product flow.

## Scope

This phase validates:

- service routes: `/health`, `/health/check`, `/ui`, `/model-library`, `/model-library/usability-matrix`, `/provider-config/status`, `/chat-gateway/execute`, `/chat-gateway/task-matrix`, and `/chat-gateway/dry-run-task`
- Workbench UI reachability
- Chat page reachability
- model dropdown safety
- provider configuration visibility without plaintext key display
- Chat Gateway evidence panel visibility
- unsafe secret / release / non-chat misuse rejection
- simulated human journey across main pages and key controls
- timeoutHit / latency evidence display from the Phase315A provider latency chain
- regression freeze for Phase312A, Phase313A, Phase314A, secret safety, health, doctor, and safe regression

## Human Journey Mode

The acceptance scripts prefer real browser automation if available. In the current Codex execution context no browser automation tool is available, so the human journey smoke uses:

- DOM smoke from `/ui`
- HTML marker checks
- button and disabled-state scans
- HTTP route simulation for the actions a user would trigger

The evidence records `realBrowserUsed=false`, `domSmokeUsed=true`, and `httpRouteSimulationUsed=true`. It must not claim real browser clicking passed.

## Acceptance Journeys

The simulated journey covers:

- first open
- model selection
- general Chat Gateway request
- summarization
- code assist
- unsafe secret request
- unsafe release request
- unsupported non-chat model request
- provider configuration page
- model library page
- full button sweep

## Model Gate Acceptance

The Chat model dropdown is accepted only when it resolves to:

- `nvidia/llama-3.3-nemotron-super-49b-v1`
- `nvidia/llama-3.1-nemotron-nano-8b-v1`

The known failed model `nvidia/llama-3.1-nemotron-ultra-253b-v1`, unverified models, deprecated models, and non-chat buckets must not appear in the normal Chat dropdown.

## Chat Gateway Acceptance

The dry-run acceptance covers:

- `general_chat`
- `code_assist`
- `summarization`
- `translation`
- `planning`
- `project_status_reasoning`
- `unsafe_secret_request`
- `unsafe_release_request`
- `unsupported_non_chat_model_request`
- `unknown_intent`

Dry-run must not call provider. Unsafe secret, release, non-chat misuse, and unknown intent must have `providerCalled=false`.

## Real NVIDIA Acceptance

Real NVIDIA acceptance is off by default. It only runs when:

```powershell
set PHASE315A_NVIDIA_REAL_ACCEPTANCE=1
```

It is capped to 2 tasks by default and 3 tasks maximum, uses Phase313A selectable chat models only, waits at least 3.1 seconds between calls, and records duration, HTTP status, timeoutHit, evidenceId, and completion confidence. If `NVIDIA_API_KEY` is missing, the status must be `blocked_missing_key` or `skipped_missing_key`, not pass.

## Timeout And Slow Response Acceptance

The UI must expose timeout and latency fields from the provider latency accountability chain. If `timeoutHit=true`, evidence and UI must show a slow-response or timeout-protection state instead of showing a risk-free success.

## Boundaries

- Does not modify `legacy/`
- Does not create `PROJECT_CONTEXT.md`
- Does not commit / push / deploy / release
- Does not claim clean workspace
- Does not change default /chat
- Does not call MiMo, OpenAI, Claude, OpenRouter, or paid API
- Does not do embedding batch training
- Does not expand the model library
- Does not add a browser real-smoke button

Workspace dirty is an existing local state and is not a phase failure, but this phase must record `workspaceCleanClaimed=false`.

workspace dirty is not a failure, but this phase cannot claim a clean workspace.
