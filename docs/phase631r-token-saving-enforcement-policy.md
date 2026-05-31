# Phase631R-Fix Token Saving Enforcement Policy

## Required Gate Fields

contextPackRequired=true
relevantFilesRequired=true
staleFalseRequired=true
tokenBudgetRequired=true
fullRepoScanForbidden=true
unrelatedHistoryForbidden=true
maxRelevantFilesDefault=20
maxRelevantFilesHardLimit=50
outputBudgetRequired=true
phaseScopeRequired=true

## Policy

Codex task execution must start from `.codex-context/current-context-pack.md` and `.codex-context/relevant-files.json`. The operator or runner must reject tasks when the freshness report is stale, when the relevant file list exceeds the hard limit, or when the task scope is not explicit.

## Token Saving Enforcement

- Full repository scans are forbidden by default.
- Repeated reading of unrelated history is forbidden by default.
- Relevant file reads should default to 20 files or fewer.
- The hard limit is 50 relevant files unless a later phase explicitly approves a wider scope.
- Output must stay within a task-specific output budget and include concise evidence rather than long logs.

## Boundary

Phase631 does not execute codex exec, does not call Provider, does not modify `/chat`, does not modify `/chat-gateway/execute`, does not modify provider runtime, and does not deploy, release, tag, push, or commit.
