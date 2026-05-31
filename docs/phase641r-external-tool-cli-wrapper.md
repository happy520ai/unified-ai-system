# Phase641R External Tool CLI Wrapper

## Scope

Phase641R-ExternalTool adds a safe local wrapper for Codex external tool
preflight. The wrapper is a token-saving and engineering task assistant entry,
not a main AI Gateway runtime path.

## Command

```powershell
cmd /c pnpm run codex:external-tool:preflight
```

## Behavior

- Runs `pnpm run preflight:phase632-token-saving`.
- Requires `docs/phase632-codex-token-saving-task-template.md`.
- Requires `.codex-context/current-context-pack.md`.
- Requires `.codex-context/relevant-files.json`.
- Requires `.codex-context/context-freshness-report.json` with `stale=false`.
- Requires `.codex-context/token-budget-report.json` with respected token budget.
- Reports blocker, relevant file count, token budget status, stale status, and
  next command suggestion.

## Boundary

- codexExecExecutedByThisPhase=false
- providerCallsMadeByThisPhase=false
- authJsonRead=false
- codexConfigModified=false
- chatModified=false
- chatGatewayExecuteModified=false
- providerRuntimeModified=false
- deployExecuted=false
- pushExecuted=false
- commitCreated=false
- workspaceCleanClaimed=false
