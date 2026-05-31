# Phase632 Codex Token Saving Preflight Checklist

## Mandatory Rule

必须使用 docs/phase632-codex-token-saving-task-template.md。
未通过 Phase632 preflight，不得继续执行。

## Checklist

- `.codex-context/current-context-pack.md` exists.
- `.codex-context/relevant-files.json` exists.
- `.codex-context/context-freshness-report.json` exists.
- `stale=false`.
- `tokenBudgetRequired=true`.
- `outputBudgetRequired=true`.
- `fullRepoScanForbidden=true`.
- relevant files count is at or below the hard limit.
- task scope is explicit.
- allowed files are listed for edit tasks.
- forbidden full repo scan instruction is present.
- auth.json reads are forbidden.
- Codex config writes are forbidden.
- `/chat` and `/chat-gateway/execute` modifications are forbidden unless explicitly authorized by a later phase.

## Stop Policy

If any required item is missing or false, stop before execution and record a blocker instead of expanding read scope.
