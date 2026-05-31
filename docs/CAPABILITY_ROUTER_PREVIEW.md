# Capability Router Preview

## Purpose

Capability Router is the preview-only model scheduler for unified-ai-system.
It analyzes a task, identifies required capabilities, compares them with the
currently configured or imported model inventory, and returns an advisory model
route.

This is not automatic model execution. It does not call providers, does not
change the default NVIDIA `/chat` lane, and does not dispatch video, vision,
coding, image generation, workflow, or Codex execution.

## Where It Fits

- `providerSelectionPolicy` remains the low-level `/chat` provider selection
  policy for explicit/default chat routes.
- `modelImportService` remains responsible for loading provider model lists and
  preserving capability metadata.
- `capabilityRouterService` sits above both as an advisory planning layer:
  task -> required capabilities -> model inventory -> recommended route.
- `/ui` exposes it in the Capability Panel so the user can manually inspect the
  route before choosing a model.

## Router Manager

The router should eventually be managed by a strong analysis model because task
classification can be ambiguous. The current implementation records that design
requirement but keeps it disabled:

- `routerManager.mode=heuristic-preview`
- `routerManager.managerModelInvoked=false`
- `routerManager.analysisModelRequiredForAutoMode=true`
- `executionEnabled=false`
- `autoInvokeSpecializedModels=false`

Future automatic routing must require an explicit manager model, human approval,
bounded execution rules, provider safety checks, and evidence. This phase only
creates the readiness surface.

## Supported Advisory Capabilities

The router recognizes these current capability buckets:

- `chat`
- `reasoning`
- `coding`
- `vision`
- `image-generation`
- `video-generation`
- `rag`
- `embedding`
- `rerank`
- `audio`
- `tool-use`

Imported provider model metadata may use aliases such as `image` or `video`.
The router normalizes them into `image-generation` and `video-generation` for
task matching.

## API

### `GET /models/capability-router/status`

Returns router status, model inventory summary, capability counts, manager
boundary, and safety boundary.

### `POST /models/capability-router/preview`

Example request:

```json
{
  "task": "Create a product intro video script and generate a short video",
  "requiredCapabilities": ["video-generation"]
}
```

Example response fields:

- `previewOnly=true`
- `executionEnabled=false`
- `autoInvokeSpecializedModels=false`
- `defaultChatLaneChanged=false`
- `task.requiredCapabilities`
- `routerManager`
- `recommendation`
- `alternatives`
- `nextActions`

## UI Behavior

The `/ui` Capability Panel includes a Capability Router Preview section. It can:

- analyze a task description,
- show required capabilities,
- show the recommended provider/model when one is available,
- show missing capabilities when no suitable model exists,
- show the router manager boundary,
- remind the user that selection is manual.

It cannot:

- auto-call video, image, vision, or coding models,
- change the default chat lane,
- invoke Codex,
- create a worktree,
- call a workflow runner,
- commit, push, or open a PR.

## Boundaries

- preview-only
- advisory route only
- no provider call from the router
- no automatic specialized model invocation
- no default NVIDIA `/chat` lane change
- no real Codex exec
- no codex CLI invocation
- no workflow runner
- no worktree creation
- no auto commit/push/PR
- no unattended development
- no real API key written to docs, logs, evidence, or UI output

## Verification

Run:

```powershell
cmd /c pnpm run verify:phase266a-capability-router-preview
```

The verifier checks the API, UI markers, routing output for coding, image, and
video tasks, and the safety boundary that keeps execution disabled.
