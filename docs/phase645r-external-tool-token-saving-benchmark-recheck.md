# Phase645R External Tool Token Saving Benchmark Recheck

## Goal

Recheck token-saving evidence for the external Codex tool using only the
existing context pack, relevant files, freshness report, token budget report,
and prior token-saving evidence.

## Checks

- contextPackExists
- relevantFilesExists
- relevantFilesCount
- tokenBudgetReportExists
- stale=false
- fullRepoScanAvoided=true
- outputBudgetRequired=true
- estimatedSavingRecorded=true

## Boundary

This is an estimate recheck. It is not a real billing saving claim and does not
generate invoice evidence. It does not execute `codex exec` and does not call
Providers.
