# Phase1883A Create Desktop Spreadsheet CSV Dry-Run

## Scope

Phase1883A implements a dry-run generator for `create_desktop_spreadsheet`.

Route: `Route A / local_self_use_only`

Marker: `CSV dry-run`

This phase may generate:

- Desktop path preview
- target file name preview
- timestamp fallback file name preview
- CSV preview
- wouldCreate evidence

This phase must not create a Desktop file, open Excel/WPS, read Desktop contents, scan Desktop privacy files, execute legacy scripts, call Providers, deploy, release, push, commit, or modify `/chat` and `/chat-gateway/execute`.

## Input

```json
{
  "action": "create_desktop_spreadsheet",
  "fileName": "小天任务表.csv",
  "targetDirectory": "desktop",
  "columns": ["任务", "状态", "备注"],
  "rows": [
    ["示例任务", "待处理", "这是小天创建的表格"],
    ["今天要做的事", "待填写", "你可以在这里继续编辑"]
  ],
  "openAfterCreate": true,
  "overwritePolicy": "never_overwrite_append_timestamp",
  "dryRun": true
}
```

## Dry-Run Output

The dry-run output is recorded in:

`apps/ai-gateway-service/evidence/phase1883a-create-desktop-spreadsheet-dry-run.json`

Required output fields:

- `ok=true`
- `dryRun=true`
- `action=create_desktop_spreadsheet`
- `desktopPathDetected=true`
- `targetPathPreview`
- `safePathCheckPassed=true`
- `wouldCreateFile=true`
- `realFileCreated=false`
- `wouldOpenAfterCreate=true`
- `csvPreview`
- `headersValid=true`
- `chineseContentValid=true`
- `noExistingFileWouldBeOverwritten=true`
- `timestampFallbackPreview`

## CSV Preview

The header must be:

```csv
任务,状态,备注
```

The generated preview must preserve Chinese text:

```csv
任务,状态,备注
示例任务,待处理,这是小天创建的表格
今天要做的事,待填写,你可以在这里继续编辑
```

## Desktop Path Detection

The runner detects the Desktop path by joining the current OS home directory with `Desktop`.

The dry-run does not:

- enumerate the Desktop directory;
- inspect other Desktop file names;
- read unrelated Desktop file contents;
- create the target CSV;
- open the target CSV.

The runner only verifies that the preview target path is inside the detected Desktop path.

## Timestamp Fallback

Because the contract uses `never_overwrite_append_timestamp`, the dry-run always generates a `timestampFallbackPreview`.

This proves the naming strategy for a possible collision without checking whether the requested Desktop file actually exists.

Future real creation must check only the exact requested target path and exact timestamp fallback path. It must not scan the Desktop directory.

## Evidence

Evidence records:

- input summary
- Desktop path detected
- target path preview
- timestamp fallback preview
- CSV preview
- safety booleans
- `wouldCreateFile=true`
- `realFileCreated=false`
- `realFileOpened=false`
- `providerCallsMade=false`
- `legacyScriptsExecuted=false`

Evidence must not contain API keys, tokens, raw CredentialRef values, `.env` values, `auth.json` contents, Desktop directory listings, or unrelated local file contents.

## Verification

Run:

```powershell
pnpm run phase632:token-saving-preflight
node --check tools/phase1883a/run-create-desktop-spreadsheet-dry-run.mjs
node --check tools/phase1883a/validate-create-desktop-spreadsheet-dry-run.mjs
node tools/phase1883a/run-create-desktop-spreadsheet-dry-run.mjs
node tools/phase1883a/validate-create-desktop-spreadsheet-dry-run.mjs
pnpm run verify:phase107a-secret-safety
pnpm run verify:phase321a-workbench-product-recovery
pnpm -r --if-present check
```

## Next Phase

Phase1884A should implement guarded real Desktop CSV creation only after explicit owner approval.

Required Phase1884A boundaries:

- create exactly one `.csv` file;
- use `never_overwrite_append_timestamp`;
- check only exact target paths;
- do not scan Desktop;
- optionally open the file only after explicit approval;
- preserve Provider, secret, legacy, deploy, `/chat`, and `/chat-gateway/execute` boundaries.
