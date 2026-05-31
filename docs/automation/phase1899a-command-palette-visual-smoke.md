# Phase1899A Command Palette Visual Smoke

Route: Route A / local_self_use_only

## Goal

Open the real `/ui` page in a local Chrome or Edge browser and verify that the Owner OS command palette is visible.

This phase is visual smoke only. It does not create desktop files, scan Desktop, read Desktop files, call Providers, execute legacy scripts, or connect `/chat` and `/chat-gateway/execute`.

## Required Visual Checks

- Owner OS opens from `/ui`.
- The command palette title is visible: `小天现在会做什么`.
- The only registered command is visible: `帮我在桌面建一个表格`.
- Dry-run preview entry is visible.
- Real run is shown as owner approval required.
- Real run button is disabled or gated.
- Safety copy is visible.
- Evidence drawer is available.
- Desktop file list is not visible.
- Batch file actions are not visible.

## Artifacts

- Evidence: `apps/ai-gateway-service/evidence/phase1899a-command-palette-visual-smoke.json`
- Screenshot: `apps/ai-gateway-service/evidence/phase1899a/screenshots/command-palette-visual-smoke.png`
- DOM snapshot: `apps/ai-gateway-service/evidence/phase1899a/command-palette-visual-smoke.html`

## Verification

```powershell
pnpm run phase632:token-saving-preflight
node --check tools/phase1899a/run-command-palette-visual-smoke.mjs
node --check tools/phase1899a/validate-command-palette-visual-smoke.mjs
node tools/phase1899a/run-command-palette-visual-smoke.mjs
node tools/phase1899a/validate-command-palette-visual-smoke.mjs
pnpm run verify:phase1891a-owner-automation-command-palette
pnpm run verify:phase1889a-owner-automation-action-registry
pnpm run verify:phase107a-secret-safety
pnpm run verify:phase321a-workbench-product-recovery
pnpm run smoke:phase308a-desktop-workbench-ui
pnpm -r --if-present check
```

## Seal Boundary

Sealable:

- Real browser visual smoke of the read-only command palette.
- Screenshot and DOM evidence.
- Confirmation that no real execution, batch operation, desktop file list, desktop scan, desktop read, Provider call, deploy, release, push, or commit occurred.

Not sealable:

- Real desktop file creation.
- Generic desktop automation.
- Batch file operations.
- `/chat` or `/chat-gateway/execute` integration.
- Production readiness.
