# Phase646R External Tool Daily Workflow

Phase646R turns the Codex Context Gateway external tool into a daily, bounded workflow for engineering task assistance and token saving. It remains an external Codex relay/token-saving tool, not the main AI Gateway Provider path.

## Daily Start Checklist

- Run `cmd /c pnpm run preflight:phase632-token-saving`.
- Use `docs/phase632-codex-token-saving-task-template.md` for every task.
- Confirm `.codex-context/current-context-pack.md` exists.
- Confirm `.codex-context/relevant-files.json` exists and start from relevant files.
- Confirm `.codex-context/context-freshness-report.json` reports `stale=false`.
- Confirm `.codex-context/token-budget-report.json` exists and is respected.
- Keep full repo scan forbidden.
- Keep output budget required.
- Keep high-risk tasks gate-only.

## Workflow Policy

- `phase632PreflightRequired=true`
- `contextPackRequired=true`
- `relevantFilesRequired=true`
- `staleFalseRequired=true`
- `tokenBudgetRequired=true`
- `fullRepoScanForbidden=true`
- `outputBudgetRequired=true`
- `maxTasksPerManualBatch=6`
- `maxTasksPerNightlyBatch=8`
- `highRiskGateOnly=true`

## Boundaries

- No `codex exec` is executed by this phase.
- No Provider is called.
- No `auth.json`, secret, webhook, or raw base_url is read or exposed.
- Codex config is not written.
- `/chat`, `/chat-gateway/execute`, and provider runtime are not modified.
- No deploy, release, tag, push, commit, or artifact upload is performed.
- Production and release readiness are not claimed.
