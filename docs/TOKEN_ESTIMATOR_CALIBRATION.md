# Token Estimator Calibration

## Purpose

Phase 272A calibrates the local token estimator preview against already-recorded MiMo usage evidence. The goal is to understand how far the no-provider-call estimator is from MiMo v2.5 Pro usage on tiny smoke requests before any broader paid-provider integration.

## Current status

This is a first calibration baseline. It is preview-only, local, and evidence-driven. It makes no new paid API call, performs no provider smoke, and does not change the default NVIDIA /chat lane.

## Source evidence

The calibration reads existing 269A/271A evidence only:

- `apps/ai-gateway-service/evidence/phase-269a-mimo-paid-api-safe-smoke.json`
- `apps/ai-gateway-service/evidence/phase-271a-mimo-model-id-discovery.json`

## MiMo usage samples

The source evidence provides two tiny MiMo usage samples:

- 269A repaired smoke: model `mimo-v2.5-pro`, actual input tokens 263, actual output tokens 16, actual total tokens 279.
- 271A discovery smoke: model `mimo-v2.5-pro`, actual input tokens 260, actual output tokens 32, actual total tokens 292.

## Estimate vs actual comparison

The original prompt text is not stored verbatim in the evidence, so the calibration uses reconstructed smoke metadata and marks each sample as `estimateInputSource=reconstructed-smoke-metadata`. This keeps calibrationCoverage as `smoke-only-limited` and avoids pretending this is full prompt-level calibration.

Each sample records:

- estimated input, output, and total tokens from the current local estimator.
- actual MiMo usage input, output, and total token numbers from evidence.
- signed token error and signed error ratio.
- estimatorBias as under_estimate, over_estimate, close, or mixed.

## Calibration profile

The generated profile applies only to:

- provider: `mimo`
- model: `mimo-v2.5-pro`
- coverage: `smoke-only-limited`
- confidence: `low`

The profile is stored in `apps/ai-gateway-service/evidence/phase-272a-token-estimator-calibration.json`.

## Safety multiplier

The recommended safety multipliers are derived from the maximum actual/estimated ratio observed in the two tiny samples, with a conservative margin. They are preview metadata only and are not auto-applied to paid production calls.

## Token floor observation

Both tiny samples show MiMo input usage around 260 tokens even for very short prompts. Phase 272A therefore records a recommended minimum input token floor based on the observed smoke samples. This is a smoke-only observation, not a general billing rule.

## Limitations

Only two tiny smoke samples are available. The calibration does not prove estimator accuracy for long context, RAG answers, normal multi-message chats, streaming, tool calls, retries, or production billing. It is not a production token-billing accuracy claim.

## How Token Cost Guard uses this

Token Cost Guard can read the latest calibration profile and expose it as preview metadata in guard results or summary surfaces. The default estimate remains unchanged unless a future phase explicitly adds a separate preview-calibrated estimate field with verification.

## What this does not do

- It does not call MiMo API.
- It does not call any paid API.
- It does not create a new paid smoke.
- It does not read or print API keys.
- It does not send project context to any external API.
- It does not set MiMo as default.
- It does not change the default NVIDIA /chat lane.
- It does not auto-apply calibration to production calls.

## Safety boundaries

- no new paid API call
- existing 269A/271A evidence only
- confidence=low
- smoke-only-limited
- does not change the default NVIDIA /chat lane
- does not set MiMo as default
- no plaintext API key
- no long context sent to paid API
- no large output request
- no stress test
- no codex CLI
- no real Codex exec
- no workflow runner
- no worktree
- no auto commit/push

## Verification commands

```powershell
node --check apps/ai-gateway-service/src/cost/tokenEstimatorCalibration.js
node --check apps/ai-gateway-service/src/entrypoints/runTokenEstimatorCalibration.js
node --check apps/ai-gateway-service/src/entrypoints/verifyTokenEstimatorCalibration.js
cmd /c pnpm run calibrate:token-estimator
cmd /c pnpm run verify:phase272a-token-estimator-calibration
```

## Next phase options

1. Keep this profile as a preview-only guardrail and gather no more paid samples yet.
2. Add optional calibrated estimate fields without replacing default estimates.
3. Run a future tiny calibration set only after explicit approval and a fixed request cap.
4. Compare RAG selected-context prompts against the MiMo token floor before any real paid workflow.
