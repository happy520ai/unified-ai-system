# Phase1888A File Action Copy Visual Recheck

Route: Route A / local_self_use_only

## Goal

Phase1888A verifies in a real local browser pass that the Phase1887A polished file action copy is visible in Owner OS and the owner daily report area.

This phase only opens `/ui`, captures an HTML snapshot and a screenshot, and validates visible copy hierarchy. It does not create a new Desktop file, scan Desktop, read other Desktop files, add batch file actions, call Providers, execute legacy scripts, deploy, release, or modify `/chat` and `/chat-gateway/execute`.

## Required Visual Checks

- `/ui` opens.
- Owner OS is visible.
- The file action result card shows `小天已经帮你建好桌面表格`.
- The description shows `任务表已经放到桌面，可以直接打开继续填写。`.
- The next step shows `打开桌面上的表格，继续填写你的任务`.
- The full file path is available only inside the advanced record.
- Evidence paths are available only inside the advanced record.
- The safety copy shows `没有覆盖已有文件，没有读取桌面其他文件`.
- No Desktop file list is visible.
- No batch file action button is visible.
- No new file is created.

## Evidence

- `apps/ai-gateway-service/evidence/phase1888a-file-action-copy-visual-recheck.json`
- `apps/ai-gateway-service/evidence/phase1888a/file-action-copy-visual-recheck.html`
- `apps/ai-gateway-service/evidence/phase1888a/screenshots/file-action-copy-visual-recheck.png`

## Verification

```powershell
pnpm run phase632:token-saving-preflight
node --check tools/phase1888a/run-file-action-copy-visual-recheck.mjs
node --check tools/phase1888a/validate-file-action-copy-visual-recheck.mjs
node tools/phase1888a/run-file-action-copy-visual-recheck.mjs
node tools/phase1888a/validate-file-action-copy-visual-recheck.mjs
pnpm run verify:phase107a-secret-safety
pnpm run verify:phase321a-workbench-product-recovery
pnpm run smoke:phase308a-desktop-workbench-ui
pnpm -r --if-present check
```

## Sealed Criteria

- `completed=true`
- `recommended_sealed=true`
- `blocker=null`
- `ownerOsOpened=true`
- `polishedFileActionCopyVisible=true`
- `titleVisible=true`
- `descriptionVisible=true`
- `nextStepVisible=true`
- `filePathInAdvancedRecord=true`
- `evidenceInAdvancedRecord=true`
- `safetyCopyVisible=true`
- `desktopFileListVisible=false`
- `bulkFileActionVisible=false`
- `newFileCreated=false`
- `desktopScanPerformed=false`
- `desktopOtherFilesRead=false`
- `providerCallsMade=false`
- `legacyScriptsExecuted=false`
- `chatModified=false`
- `chatGatewayExecuteModified=false`
- `deployExecuted=false`
