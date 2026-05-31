# Phase1891A Owner Automation Command Palette v1

Route: Route A / local_self_use_only

## Goal

Add a read-only Owner OS command palette that answers: "小天现在会做什么".

The first registered command is `create_desktop_spreadsheet`, shown to the owner as:

- 帮我在桌面建一个表格

## Scope

This phase displays command metadata from `docs/automation/registered-owner-actions.json`.

Allowed:

- Show the registered command.
- Show its description.
- Show dry-run-first.
- Show real-run approval required state.
- Show safety boundaries.
- Show evidence references in an advanced record drawer.

Blocked:

- No real desktop file creation.
- No new desktop file.
- No desktop scan.
- No desktop other-file read.
- No batch file action.
- No ungated real-run button.
- No `/chat` integration.
- No `/chat-gateway/execute` integration.
- No Provider call.
- No secret or auth.json read.

## Owner OS Copy

Title:

- 小天现在会做什么

Command:

- 帮我在桌面建一个表格

Description:

- 在桌面创建一个 CSV 任务表，并尝试自动打开。

Status:

- 已登记，可用，但真实运行前需要你确认。

Safety copy:

- 默认先预览
- 真实创建前需要确认
- 不覆盖已有文件
- 不扫描桌面
- 不读取桌面其他文件
- 不调用真实模型
- 不读取密钥

Disabled real-run state:

- 真实创建需要单独确认，本阶段不会执行。

## Evidence

Phase evidence:

- `apps/ai-gateway-service/evidence/phase1891a-owner-automation-command-palette-v1.json`

Registry:

- `docs/automation/registered-owner-actions.json`

Schema:

- `docs/automation/owner-automation-action-registry.schema.json`

## Verification

Run:

```powershell
pnpm run phase632:token-saving-preflight
node --check tools/phase1891a/integrate-owner-automation-command-palette.mjs
node --check tools/phase1891a/validate-owner-automation-command-palette.mjs
node tools/phase1891a/integrate-owner-automation-command-palette.mjs
node tools/phase1891a/validate-owner-automation-command-palette.mjs
pnpm run verify:phase1889a-owner-automation-action-registry
pnpm run verify:phase107a-secret-safety
pnpm run verify:phase321a-workbench-product-recovery
pnpm run smoke:phase308a-desktop-workbench-ui
pnpm -r --if-present check
```

## Seal Boundary

Sealable:

- Read-only command palette.
- One registered command visible.
- Dry-run preview entry visible.
- Real run approval requirement visible.
- Safety copy visible.
- Evidence drawer available.

Not sealable:

- Real desktop action execution.
- Generic desktop automation.
- Batch file actions.
- Provider runtime integration.
- `/chat` or `/chat-gateway/execute` integration.
