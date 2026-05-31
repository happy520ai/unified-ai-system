# Phase1882A Safe Local File Action Policy

## Purpose

This policy defines the safe local file boundary for future Owner Automation Kernel table actions. Phase1882A is contract-only and must not create, open, delete, upload, or scan desktop files.

## allowedDirectories

Default allowed write buckets:

- `desktop`: the current owner Desktop path, for a future approved real action only.
- `project_evidence`: `apps/ai-gateway-service/evidence`
- `project_reports`: `reports`

The runtime must resolve these buckets internally. The owner should not be asked to paste raw system paths for normal table creation.

## forbiddenDirectories

Default forbidden targets:

- `legacy/`
- `PROJECT_CONTEXT.md`
- `.env`
- `.git`
- `node_modules`
- `auth.json`
- raw CredentialRef
- provider runtime directories
- `/chat`
- `/chat-gateway/execute`
- deploy, release, tag, or artifact upload output paths

Any resolved target matching a forbidden path must be blocked before write.

## Required Safety Rules

- 不允许删除文件。
- 不允许覆盖已有文件。
- 文件已存在时必须按 `never_overwrite_append_timestamp` 自动追加时间戳。
- 不读取桌面其他文件内容。
- 不扫描桌面隐私文件。
- 不上传文件。
- 不联网。
- 不读取 secret / auth.json / raw CredentialRef。
- 不写入 API key / token / CredentialRef。
- 不执行 deploy / release / tag / artifact。
- 不执行 legacy 脚本。
- 不修改 `/chat`。
- 不修改 `/chat-gateway/execute`。

## Overwrite Protection

Policy id: `never_overwrite_append_timestamp`

Required behavior:

1. Normalize and validate the requested file name.
2. Resolve the allowed target bucket.
3. Check only the exact requested target path.
4. If it exists, create a new candidate name with a timestamp suffix.
5. Check only the exact timestamped candidate path.
6. Write only after a non-existing candidate is found.
7. Record `noExistingFileOverwritten=true` only when no existing file was replaced.

The runtime must never delete, truncate, rename over, or move over an existing file to satisfy this action.

## Desktop Privacy Boundary

The future runtime may check whether the exact target file path exists. It must not enumerate Desktop files, index Desktop folders, read unrelated Desktop file names into evidence, or inspect file contents.

## Evidence Boundary

Evidence may record:

- action name
- target bucket
- final file path
- dry-run or real-run state
- fileCreated/fileOpened booleans
- overwrite policy result
- safety booleans
- warnings

Evidence must not record:

- API keys
- tokens
- `.env` values
- `auth.json` content
- raw CredentialRef values
- Desktop directory listings
- unrelated local file contents

## Owner-Facing Result Boundary

Owner OS should show:

- short Chinese result summary;
- final file path or preview path;
- created/opened/skipped/blocked status;
- evidence path in Advanced Mode.

Owner OS must not show raw stack traces, raw credentials, full Desktop listings, Provider internals, or claim creation when only dry-run occurred.

## Boss Daily Report Boundary

老板日报 may summarize the action and link evidence. It must not scan Desktop or copy table contents from unrelated files. It should report only the file action requested by the owner.

## Phase1882A Boundary

Phase1882A sets the policy only:

- `realDesktopFileCreated=false`
- `desktopFileCreationExecuted=false`
- `fileWriteExecutionImplemented=false`
- `providerCallsMade=false`
- `legacyScriptsExecuted=false`
- `deployExecuted=false`
