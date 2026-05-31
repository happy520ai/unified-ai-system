# Phase328A Three Mode Runtime Design

## Scope

Phase328A adds a guarded runtime MVP for:

- `normal`
- `god`
- `tianshu`

The new runtime entry is `POST /three-mode/execute`.

## Runtime boundary

- Existing `/chat-gateway/execute` remains unchanged.
- Phase328A real calls are limited to selectable NVIDIA models.
- Non-NVIDIA user-owned providers remain gated until secure credential runtime exists.
- Secret values are forbidden in request payloads.

## Execution flow

1. Validate request envelope.
2. Run mode governance gate.
3. Initialize audit trace.
4. Dispatch by mode.
5. Return unified success or error envelope.

## Mode behavior

### Normal Mode

- Requires one selectable model.
- Calls NVIDIA runtime through existing provider abstraction.
- Returns `finalAnswer`, `selectedModel`, and `auditTrace`.

### God Mode

- Requires 2-5 eligible participant models.
- Uses requested participants or auto-selection.
- Generates participant drafts.
- Produces one critic/review pass.
- Runs supervisor synthesis.
- Falls back to best participant when supervisor output is empty.

### Tianshu Mode

- Classifies task heuristically.
- Reads routing preference outputs from Phase324I.
- Selects a single model or escalates to God Mode.
- Returns `plannerDecision`, `selectedModels`, and `auditTrace`.

## Safety

- selectable gate enforced
- failed / high-risk / unverified models excluded
- non-NVIDIA real calls blocked
- `secretValueExposed=false`
- no change to legacy chat main chain
