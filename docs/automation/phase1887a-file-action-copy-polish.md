# Phase1887A File Action Copy Polish

Route: Route A / local_self_use_only

## Goal

Phase1887A only polishes the Owner OS and owner daily report copy for the already completed desktop spreadsheet action.

The phase does not create another Desktop file, scan Desktop, read other Desktop files, add batch file actions, call Providers, execute legacy scripts, deploy, release, or change `/chat` and `/chat-gateway/execute`.

## Owner Copy

- Title: `小天已经帮你建好桌面表格`
- Summary: `任务表已经放到桌面，可以直接打开继续填写。`
- File line: `文件：<fileName>`
- Status: `状态：已创建，并已尝试自动打开`
- Safety: `没有覆盖已有文件，没有读取桌面其他文件`
- Next step: `打开桌面上的表格，继续填写你的任务`

## Visual Hierarchy

The first-screen card keeps the file result readable and short. The full file path and evidence paths are still available, but they are moved into the advanced record details block so they do not dominate the owner-facing text.

## Daily Report Copy

The owner daily report uses an owner-facing sentence:

`小天已经帮你建好桌面表格：<fileName>。打开桌面上的表格，继续填写你的任务。`

## Evidence

- `apps/ai-gateway-service/evidence/phase1887a-file-action-copy-polish.json`

## Verification

```powershell
pnpm run phase632:token-saving-preflight
node --check tools/phase1887a/validate-file-action-copy-polish.mjs
node tools/phase1887a/validate-file-action-copy-polish.mjs
pnpm run verify:phase107a-secret-safety
pnpm run verify:phase321a-workbench-product-recovery
pnpm run smoke:phase308a-desktop-workbench-ui
pnpm -r --if-present check
```

## Sealed Criteria

- `completed=true`
- `recommended_sealed=true`
- `blocker=null`
- `ownerReadableFileActionCopy=true`
- `nextStepClear=true`
- `filePathAvailableButNotDominant=true`
- `evidenceLinkMovedToAdvancedRecord=true`
- `safetyCopyVisible=true`
- `newFileCreated=false`
- `desktopScanPerformed=false`
- `desktopOtherFilesRead=false`
- `bulkFileActionVisible=false`
- `providerCallsMade=false`
- `legacyScriptsExecuted=false`
- `chatModified=false`
- `chatGatewayExecuteModified=false`
- `deployExecuted=false`
