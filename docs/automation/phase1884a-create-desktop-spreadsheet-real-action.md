# Phase1884A Create Desktop Spreadsheet Real Local Action

## Scope

Phase1884A executes the owner-approved real local action for `create_desktop_spreadsheet`.

Route: `Route A / local_self_use_only`

This phase creates exactly one CSV file on the Windows Desktop and attempts to open that created file. It remains local-only and does not call Providers, read secrets, scan Desktop, execute legacy scripts, deploy, release, push, commit, or modify `/chat` and `/chat-gateway/execute`.

Marker: `real local action`

## Owner Explicit Approval

The action is allowed only by the following explicit approval packet:

```json
{
  "allowRealDesktopFileCreate": true,
  "approvedAction": "create_desktop_spreadsheet",
  "approvedTargetDirectory": "desktop",
  "approvedFileType": "csv",
  "approvedFileName": "小天任务表.csv",
  "allowOverwrite": false,
  "allowDesktopScan": false,
  "allowReadExistingDesktopFiles": false,
  "allowOpenAfterCreate": true,
  "maxFilesToCreate": 1
}
```

## Target

Primary target:

`C:\Users\Administrator\Desktop\小天任务表.csv`

If that exact file already exists, the runner must create a timestamp fallback:

`小天任务表-YYYYMMDD-HHmmss.csv`

The runner checks only the exact primary path and, if needed, the exact timestamp fallback path. It must not enumerate Desktop contents or read unrelated Desktop files.

## CSV Content

The file is written as UTF-8 with BOM to reduce Excel/WPS Chinese encoding issues.

```csv
任务,状态,备注
示例任务,待处理,这是小天创建的表格
今天要做的事,待填写,你可以在这里继续编辑
```

## Safety Rules

- Create only one `.csv` file.
- Write only under Desktop.
- Use exclusive create mode, not overwrite mode.
- Never delete files.
- Never move files.
- Never upload files.
- Do not use network.
- Do not call Providers.
- Do not read secret / auth.json / raw CredentialRef.
- Do not execute legacy scripts.
- Do not modify `/chat`.
- Do not modify `/chat-gateway/execute`.
- Do not deploy / release / tag / artifact upload.

## Evidence

Evidence is written to:

`apps/ai-gateway-service/evidence/phase1884a-create-desktop-spreadsheet-real-action.json`

Required evidence fields:

- `desktopPath`
- `targetPath`
- `actualCreatedPath`
- `fileCreated`
- `fileOpenedAttempted`
- `noExistingFileOverwritten`
- `csvHeadersValid`
- `spreadsheetHeadersValid`
- `chineseContentValid`
- `spreadsheetChineseContentValid`
- `fileSizeBytes`
- `actionStartedAt`
- `actionFinishedAt`
- safety booleans

## Verification

Run:

```powershell
pnpm run phase632:token-saving-preflight
node --check tools/phase1884a/create-desktop-spreadsheet-real-action.mjs
node --check tools/phase1884a/validate-desktop-spreadsheet-real-action.mjs
node tools/phase1884a/create-desktop-spreadsheet-real-action.mjs
node tools/phase1884a/validate-desktop-spreadsheet-real-action.mjs
pnpm run verify:phase107a-secret-safety
pnpm run verify:phase321a-workbench-product-recovery
pnpm -r --if-present check
```

## Seal Boundary

Phase1884A may claim only a local Desktop CSV action for the current owner machine. It must not claim full desktop automation, Excel automation, external Provider integration, production readiness, or workspace clean state.

## Next Phase

Phase1885A should connect the verified file action result into Owner OS / 老板日报 as a read-only result card and evidence link. It should not add broad file management or directory browsing.
