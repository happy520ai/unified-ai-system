# Phase633A Token Saving Preflight Wrapper Policy

## Policy Fields

dryRunOnly=true
contextPackRequired=true
relevantFilesRequired=true
freshnessReportRequired=true
staleFalseRequired=true
tokenBudgetRequired=true
outputBudgetRequired=true
fullRepoScanForbidden=true
maxRelevantFilesDefault=20
maxRelevantFilesHardLimit=50

## Goal

Phase633A turns the Phase632A-G mandatory token-saving gate chain into a reusable local preflight wrapper. The wrapper verifies the required `.codex-context` files, token budget, stale status, relevant file limit, full repo scan prohibition, and output budget before future Codex task execution.

## Execution Boundary

The wrapper is local and dry-run only. It does not execute codex exec, does not call Provider, does not read auth.json, does not write Codex config, does not modify `/chat`, does not modify `/chat-gateway/execute`, does not modify provider runtime, and does not deploy, release, tag, push, or commit.

## Failure Policy

If any preflight check fails, stop before task execution and record a blocker. Do not compensate by scanning the full repository or reading unrelated history.
