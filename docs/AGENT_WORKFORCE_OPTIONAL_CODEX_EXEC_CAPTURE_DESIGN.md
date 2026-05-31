# Agent Workforce Optional Codex Exec Capture Design

Phase: 213A

This design describes a future optional capture path for `codex exec`. The
default state is disabled and dry-run. The web service does not invoke Codex
CLI, and this design does not turn Agent Workforce into unattended production
execution.

## Default State

- `codexExecEnabled=false` by default.
- `designOnly=true` for the Phase 213A design layer.
- Real execution requires an explicit user command and explicit script
  parameter.
- The default command is dry-run and prints the planned `codex exec` command
  without invoking Codex.

## Capture Path

When a user explicitly enables a one-shot trial, the controlled runner may:

- Read `.codex-handoff/outbox/latest-codex-handoff.md`.
- Optionally append `.codex-handoff/review/latest-feedback-to-codex.md`.
- Invoke `codex exec` only after the safety gate passes.
- Capture stdout to `.codex-handoff/runs/codex-stdout.txt`.
- Capture stderr to `.codex-handoff/runs/codex-stderr.txt`.
- Write `.codex-handoff/inbox/latest-codex-result.md`.
- Run the result import script to generate system review and feedback.

## Safety Requirements

- Maximum rounds are limited to 3.
- The default one-shot command uses 1 round.
- Failure stops the loop.
- Boundary violations stop the loop.
- Logs and result files must be checked for plaintext secret exposure.
- No automatic commit or push is allowed.
- No automatic worktree creation is allowed.
- No workflow run hookup is allowed.
- No default NVIDIA `/chat` main lane change is allowed.

## Non-goals

- No unattended production execution.
- No automatic merge.
- No automatic external patch application.
- No oh-my-codex / OMX / team / ralph integration.
- No web-service-side Codex CLI invocation.
