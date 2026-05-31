# Phase607R-AutoScale Risk Tier Gate

## Purpose

Phase607R-AutoScale expands the Phase605R safe runner from a small one-shot batch into a 20-candidate queue with risk-tier gating. It is still a bounded one-shot run, not a daemon, not a background loop, and not an unattended infinite runner.

## Risk Tiers

- `low`: local documentation, evidence, and verifier checks.
- `medium-safe`: local dry-run smoke, README/AGENTS guard, and syntax checks that do not call real Providers.
- `high`: any task involving real Provider calls, secret access, Codex config writes, `/chat`, `/chat-gateway/execute`, provider runtime, deployment, release, tag, push, commit, artifact upload, billing, or forged approvals.

## Gate Policy

- lowAutoAllowed=true
- mediumSafeAutoAllowed=true
- highRiskAutoAllowed=false
- highRiskGateOnly=true
- failureStopsBatch=true
- highRiskExecuted=false
- longRunningLoopStarted=false
- daemonStarted=false
- backgroundRunnerStarted=false
- workspaceCleanClaimed=false

High-risk candidates produce gate evidence only and are not executed.
