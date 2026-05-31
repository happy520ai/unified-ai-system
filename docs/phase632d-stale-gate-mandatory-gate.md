# Phase632D Stale Gate Mandatory Gate

## Gate Fields

freshnessReportRequired=true
staleFalseRequired=true
stopOnStale=true
rebuildContextRequiredWhenStale=true

## Policy

Every future Codex task must check `.codex-context/context-freshness-report.json` before implementation work. If `stale=true`, the task must stop and require a refreshed context pack instead of expanding reads.

## Enforcement

- Require `.codex-context/context-freshness-report.json`.
- Require `stale=false`.
- Stop on stale context.
- Rebuild or request a new context pack when stale.
- Do not bypass stale status by scanning the repository.

## Boundary

Phase632D does not execute codex exec, does not call Provider, does not read auth.json, does not write Codex config, does not modify `/chat`, does not modify `/chat-gateway/execute`, does not deploy, release, tag, push, or commit, and does not claim workspace clean.
