# Phase575A Codex Real Browser Product Acceptance

## Goal

Phase575A verifies the Mission Control sample dry-run first-use path with a
real local service and real Chromium browser clicks.

This phase is product acceptance by Codex automation. It is not a non-Codex
human understanding test, not mock feedback, not a DOM-only check, and not a
source-only inspection.

## Acceptance URL

The required visible surface is:

`http://127.0.0.1:3100/ui?manual=phase575a&fresh=1`

The verifier either connects to an already running local service on port 3100
or starts the AI Gateway service in-process on `127.0.0.1:3100` with local fake
provider mode, memory credential storage, and no real provider execution.

## Browser Path

1. Open the Mission Control page in real Chromium.
2. Confirm the first screen shows Mission Control, `Try a sample task`, and
   `Start sample dry-run`.
3. Confirm `Sample dry-run result` and the execution detail drawer are hidden
   initially.
4. Click `Start sample dry-run`.
5. Confirm the dry-run result path becomes visible:
   - Mission Understanding
   - Recommended Mode
   - Tianshu recommendation
   - Security Shield
   - Provider / CredentialRef
   - Evidence Replay
   - Next Step
6. Click the auxiliary mode, Security Shield, and Evidence Replay buttons and
   verify they focus or scroll to their target sections.
7. Click `查看执行详情`.
8. Confirm the detail drawer opens with structured sample dry-run JSON:
   - `sampleDryRun.task`
   - `recommendedMode: Tianshu`
   - `providerCallsMade=false`
   - `secretValueExposed=false`
   - `productionAction=false`
   - `invoiceAction=false`

## Safety Boundary

- no-provider-call
- no-secret
- no-deploy
- no-billing
- no-invoice
- no MiMo / OpenAI / Claude / OpenRouter / NVIDIA call
- no `/chat` modification
- no `/chat-gateway/execute` modification
- no deploy / release / tag / artifact upload
- no Yiyi / character / Guided Showcase / floating avatar restoration
- workspaceCleanClaimed=false

## Evidence

The verifier writes:

- `apps/ai-gateway-service/evidence/phase575a/codex-real-browser-product-acceptance-result.json`
- `apps/ai-gateway-service/evidence/phase575a/initial-first-screen.png`
- `apps/ai-gateway-service/evidence/phase575a/after-start-sample-dry-run.png`
- `apps/ai-gateway-service/evidence/phase575a/detail-drawer-open.png`
- `apps/ai-gateway-service/evidence/phase575a/dom-snapshot.html`
- `apps/ai-gateway-service/evidence/phase575a/browser-stdout.log`
- `apps/ai-gateway-service/evidence/phase575a/browser-stderr.log`

## Seal Rule

`recommended_sealed=true` only means Codex real browser product acceptance
passed for the sample dry-run path. It does not mean real non-Codex human trial
feedback was collected, and it does not mean production deployment is complete.
