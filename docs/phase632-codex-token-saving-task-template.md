# Phase632 Codex Token Saving Task Template

## Mandatory Rule

必须使用 docs/phase632-codex-token-saving-task-template.md。
未通过 Phase632 preflight，不得继续执行。

## Required Preflight

- Read `.codex-context/current-context-pack.md` first.
- Read `.codex-context/relevant-files.json`.
- Read `.codex-context/context-freshness-report.json`.
- Confirm `stale=false`.
- Confirm token budget is present and respected.
- Confirm relevant files count is within the hard limit.
- Confirm full repo scan is forbidden.
- Confirm output budget is defined.

## Execution Boundary

You may only read the context pack and files listed in relevant files unless a later explicit phase expands the scope.

Do not read secrets. Do not read auth.json. Do not output API key, secret, webhook, or raw base_url values. Do not write Codex config. Do not modify `/chat` or `/chat-gateway/execute` unless a later explicit phase authorizes it. Do not call Provider unless a later explicit phase authorizes it. Do not deploy, release, tag, push, or commit.

## Required Final Output

- Modified files
- Validation commands
- Evidence paths
- Boundary confirmation
- Whether codex exec was executed
- Whether Provider was called
- Whether auth.json was read
- Whether Codex config was written
- Whether `/chat` or `/chat-gateway/execute` was modified
- Whether deploy/release/tag/push/commit happened
- `workspaceCleanClaimed=false`
