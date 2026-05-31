# Phase1882A Owner Automation Kernel Local File/Table Contract

## Scope

Phase1882A defines the Owner Automation Kernel contract for local file/table automation only. It does not create a desktop file, does not execute legacy scripts, does not call Providers, and does not modify `/chat` or `/chat-gateway/execute`.

Route: `Route A / local_self_use_only`

Primary future owner request:

> 帮我在桌面建一个表格文件

Current phase answer: the action contract is ready, but runtime file creation remains blocked until the next gated phases.

## Action Schema

The Owner Automation Kernel action is:

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
  "overwritePolicy": "never_overwrite_append_timestamp"
}
```

The schema is stored at:

`docs/automation/create-desktop-spreadsheet-action-contract.json`

## create_desktop_spreadsheet Input

Required input fields:

- `action`: must be `create_desktop_spreadsheet`.
- `fileName`: requested table file name. Phase1883A and Phase1884A should keep the first real implementation CSV-only.
- `targetDirectory`: one of `desktop`, `project_evidence`, or `project_reports`.
- `columns`: table header array.
- `rows`: table row array.
- `openAfterCreate`: future runtime hint. It must not open anything in Phase1882A.
- `overwritePolicy`: must be `never_overwrite_append_timestamp`.

## create_desktop_spreadsheet Output

Expected future output shape:

```json
{
  "ok": true,
  "action": "create_desktop_spreadsheet",
  "filePath": "<desktop>\\小天任务表.csv",
  "fileCreated": true,
  "fileOpened": true,
  "noExistingFileOverwritten": true,
  "evidencePath": "apps/ai-gateway-service/evidence/phase1883a-create-desktop-spreadsheet-dry-run.json"
}
```

In Phase1882A, this output is a contract only. The evidence for this phase must keep:

- `realDesktopFileCreated=false`
- `desktopFileCreationExecuted=false`
- `fileWriteExecutionImplemented=false`

## allowedDirectories

The contract allows only these target buckets:

- `desktop`: the current Windows user's Desktop path, resolved by the future runtime without scanning Desktop contents.
- `project_evidence`: `apps/ai-gateway-service/evidence/`
- `project_reports`: a project-owned `reports/` directory or a future approved reports directory.

No other write target is allowed by default.

## forbiddenDirectories

The contract blocks these paths and path classes:

- `legacy/`
- `PROJECT_CONTEXT.md`
- `.env`
- `.git`
- `node_modules`
- `auth.json`
- raw CredentialRef paths or values
- provider runtime paths
- `/chat`
- `/chat-gateway/execute`

## 防止覆盖

Overwrite protection is mandatory:

- Default `overwritePolicy` is `never_overwrite_append_timestamp`.
- Existing files must not be overwritten.
- If the requested file already exists, the future runtime must append a timestamp before writing.
- Delete, move, rename-over-existing, and truncate operations are outside this action contract.
- Evidence must record `noExistingFileOverwritten=true` only after the future runtime proves it used a non-conflicting path.

## Evidence Ledger

Evidence entries must follow:

`docs/automation/owner-automation-evidence-ledger.schema.json`

Each action evidence record must include:

- phase and route
- action name
- dry-run flag
- sanitized input summary
- sanitized output summary
- resolved target bucket
- overwrite policy result
- whether a desktop open was skipped, simulated, or executed
- provider/secret/legacy/deploy safety booleans
- evidence path

Evidence must never include API keys, tokens, raw CredentialRef values, `.env` content, `auth.json` content, Desktop file listings, or unrelated local file content.

## Owner OS Result Contract

Owner OS should show the result as a short owner-facing status, not raw engineering traces:

- Action: 创建桌面表格
- Result: 已创建 / dry-run 预览 / 已阻断
- File path: only the target file path, not a Desktop directory listing
- Open status: opened / skipped / blocked
- Evidence: a clickable evidence path for Advanced Mode

Owner OS must not claim the file was created when `dryRun=true` or when the runtime did not write the file.

This is the owner 显示结果 contract for Phase1882A.

## Boss Daily Report Integration

Boss Daily Report should record a concise action summary:

- `action=create_desktop_spreadsheet`
- target bucket and final file path
- created/opened/skipped/blocked status
- `noExistingFileOverwritten`
- evidence path

Boss Daily Report integration must not scan Desktop, read other files, upload files, or include raw local private content.

Surface name: `Boss Daily Report` / `老板日报`

## Why Current Owner OS Still Cannot Create Desktop Tables

Verified fact from Phase1881A: legacy contains automation concepts, but they are not current Owner OS capability.

Current Phase1882A adds only the contract. Current Owner OS still cannot create desktop tables because:

- no current Owner Automation Kernel file writer has been wired;
- no approval-gated Desktop path resolver has been implemented;
- no CSV serializer dry-run has been verified;
- no overwrite-protection runtime has been tested;
- no desktop-open adapter has been approved;
- legacy automation is read-only reference and must not be executed or directly reused.

## Minimum Migration Plan

1. Phase1883A: implement CSV dry-run only. It should validate input, compute a safe target path, generate CSV preview text in evidence, and keep `fileCreated=false`.
2. Phase1884A: implement guarded real desktop CSV creation after explicit owner approval. It should write only one CSV file, append timestamp on collision, record evidence, and optionally open the file only if approved.
3. Later phase: consider XLSX support only after CSV is sealed and only with a separate dependency/risk review.

## Phase1883A CSV dry-run

Next phase should:

- add a dry-run runner for `create_desktop_spreadsheet`;
- generate sanitized CSV preview;
- resolve target bucket without scanning Desktop;
- write evidence only under project evidence;
- keep `realDesktopFileCreated=false`;
- keep `fileOpened=false`;
- keep Provider, secret, legacy, deploy, `/chat`, and `/chat-gateway/execute` boundaries unchanged.

## Phase1884A 真实桌面 CSV 创建

The following phase should:

- require explicit owner approval;
- write a single `.csv` file to Desktop only when allowed;
- apply `never_overwrite_append_timestamp`;
- not read Desktop contents except for a direct existence check on the target path;
- not delete or overwrite files;
- record evidence;
- optionally open the created CSV after create only when `openAfterCreate=true` and the approval gate permits it.

## Non-Claims

Phase1882A does not claim:

- current desktop file creation capability;
- current Excel/XLSX automation;
- legacy automation integration;
- Provider execution;
- production readiness;
- workspace clean state.
