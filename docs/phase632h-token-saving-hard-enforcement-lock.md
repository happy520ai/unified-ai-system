# Phase632H Token Saving Hard Enforcement Lock

## Mandatory Rule

必须使用 docs/phase632-codex-token-saving-task-template.md。
未通过 Phase632 preflight，不得继续执行。

## Lock Fields

hardEnforcementEnabled=true
tokenSavingTemplateRequired=true
phase632PreflightRequired=true
executionBlockedWithoutPreflight=true
fullRepoScanForbidden=true
outputBudgetRequired=true

## Required Codex Task Flow

All future Codex tasks must pass Phase632 preflight before continuing:

1. Read `.codex-context/current-context-pack.md`.
2. Read `.codex-context/relevant-files.json`.
3. Check token budget.
4. Check `.codex-context/context-freshness-report.json`.
5. Confirm `stale=false`.
6. Keep full repo scan forbidden.
7. Follow the output budget.
8. Use `docs/phase632-codex-token-saving-task-template.md`.

## Boundary

Phase632H is rules, docs, verifier, and evidence only. It does not execute codex exec, does not call Provider, does not read auth.json, does not write Codex config, does not modify `/chat`, does not modify `/chat-gateway/execute`, does not modify provider runtime, and does not deploy, release, tag, push, or commit.
