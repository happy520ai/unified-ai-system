# Phase632I Automatic Token-Saving Preflight Injection

## Lock Fields

automaticRuleInjectionEnabled=true
hardRuleManagedInAgents=true
hardRuleManagedInReadme=true
preflightWrapperGenerated=true
packagePreflightScriptGenerated=true
executionBlockedWithoutPreflight=true
manualRuleTextNoLongerRequired=true

## Mandatory Rule

All Codex tasks in this repository must use `docs/phase632-codex-token-saving-task-template.md`.

未通过 Phase632 preflight，不得继续执行。

## Automatic Preflight

Operators should run:

```powershell
cmd /c pnpm run preflight:phase632-token-saving
```

The wrapper checks:

- `docs/phase632-codex-token-saving-task-template.md` exists.
- `docs/phase632-codex-token-saving-preflight-checklist.md` exists.
- `.codex-context/current-context-pack.md` exists.
- `.codex-context/relevant-files.json` exists.
- `.codex-context/context-freshness-report.json` exists.
- `.codex-context/token-budget-report.json` exists.
- `stale=false`.
- relevant files count is at or below 50.
- full repo scan is forbidden.
- output budget is required.

If any required item fails, the wrapper exits non-zero and records a blocker.

## Boundary

Phase632I does not execute `codex exec`, does not call Providers, does not read auth.json, does not write Codex config, does not modify provider runtime, does not modify `/chat` or `/chat-gateway/execute`, and does not deploy, release, tag, push, or commit.
