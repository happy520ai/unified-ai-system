# Phase1901A Command Palette dry-run preview drawer polish

## Route

Route A / local_self_use_only.

## Goal

Polish only the Owner Automation Command Palette `查看预览` drawer for the registered
`create_desktop_spreadsheet` action. The drawer now makes the dry-run boundary easier
to read and keeps evidence references close to the preview.

## Scope

- Show that preview displays the planned CSV table shape without writing to Desktop.
- Show the preview fields: `任务、状态、备注`.
- Show that preview will not create a file, open Excel / WPS, or scan Desktop.
- Link the preview drawer to the action contract, Phase1883A dry-run evidence, and
  Phase1900A Command Palette v1 seal evidence.
- Keep the advanced record evidence references available.

## Safety Boundary

- No real desktop file creation.
- No Desktop scan.
- No Desktop file read.
- No batch file action.
- No real execution button.
- No Provider call.
- No secret, `auth.json`, or raw CredentialRef read.
- No `/chat` or `/chat-gateway/execute` change.
- No deploy, release, tag, artifact upload, push, or commit.

## Verification

Run:

```powershell
pnpm run phase632:token-saving-preflight
node --check tools/phase1901a/validate-command-palette-dry-run-preview-drawer-polish.mjs
pnpm run verify:phase1901a-command-palette-dry-run-preview-drawer-polish
pnpm run verify:phase1900a-command-palette-v1-seal
pnpm run verify:phase1891a-owner-automation-command-palette
pnpm run smoke:phase1899a-command-palette-visual-smoke
pnpm run verify:phase107a-secret-safety
pnpm run verify:phase321a-workbench-product-recovery
pnpm run smoke:phase308a-desktop-workbench-ui
pnpm -r --workspace-concurrency=1 --if-present check
```

## Seal Criteria

- `previewDrawerPolished=true`
- `previewDrawerHierarchyClear=true`
- `previewEvidenceRefsVisible=true`
- `realRunButtonEnabled=false`
- `executionButtonAdded=false`
- `realExecutionCapabilityExpanded=false`
- `newFileCreated=false`
- `desktopScanPerformed=false`
- `desktopOtherFilesRead=false`
- `providerCallsMade=false`
- `chatModified=false`
- `chatGatewayExecuteModified=false`
