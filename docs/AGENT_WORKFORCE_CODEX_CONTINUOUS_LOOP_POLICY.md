# Agent Workforce Codex Continuous Loop Policy

Phase: 219A

This policy freezes the safe operating rules for any Codex feedback loop.

## Policy

- Default mode is dry-run.
- Real `codex exec` requires an explicit command and explicit parameter.
- Each real turn is limited to one Codex execution by default.
- Batch loops are capped at 3 rounds.
- A boundary violation immediately blocks the loop.
- Failed verification stops the loop.
- The system does not automatically commit or push.
- The system does not automatically create worktrees.
- The system does not connect workflow run.
- The system does not bypass human confirmation.
- The system does not change the default NVIDIA `/chat` main lane.
- The system does not call oh-my-codex / OMX / team / ralph.
- The system does not write plaintext API keys to logs, evidence, handoff,
  inbox, review, or run files.

## Required Human Control

Humans must explicitly choose when to move from dry-run to a one-shot real
trial. Humans must review generated results, changed files, verification
commands, evidence paths, and boundary checks before any follow-up action.

## Frozen Default

The frozen default is:

```text
codex exec disabled
dry-run enabled
MaxRounds <= 3
NoCommit=true
NoPush=true
RequireCleanGit=true
FailOnBoundaryViolation=true
```
