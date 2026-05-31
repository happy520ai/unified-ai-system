# Agent Workforce Safe Desktop Runner Design

Phase: 204A
Status: design only

## Purpose

Safe Desktop Runner Design records the minimum future safety principles for a
possible desktop runner. It is not an implementation. The current web service
does not call Codex CLI, run shell commands, dispatch external runners, create
worktrees, or execute code through Agent Workforce.

The Phase 205A-208A clipboard helper is not a runner. It only calls the local
read/export endpoints, writes `.codex-handoff/latest-codex-handoff.md`,
`.codex-handoff/latest-codex-handoff.json`, and
`.codex-handoff/latest-metadata.json`, and copies Markdown to the Windows
clipboard. `handoff:codex:app` may only open Codex for a human paste; it must
not execute a prompt or task.

The clipboard helper may only open Codex for a human paste and must not execute a prompt or task.

## Why Current Phase Does Not Implement A Runner

Real execution would need a separate mainline, explicit user approval, and a
security review. It would also need clean workspace checks, isolation,
redacted logs, cancellable state, per-task evidence, and a rollback procedure.
Those requirements are not implemented in this phase.

## Required Before Implementation

- explicit user approval
- security review
- clean git workspace check
- worktree isolation design
- task claim token
- log redaction
- cancellable execution state
- per-task evidence
- manual rollback procedure

## Forbidden By Default

- automatic Codex CLI invocation
- automatic shell execution
- automatic patch apply
- automatic git commit
- automatic push
- running without human approval
- using approval-preview as execution approval
- bypassing human confirmation
- changing the default NVIDIA `/chat` lane

## Design State

- runnerImplemented: false
- runnerEnabled: false
- codexCliInvocationEnabled: false
- executionEnabled: false
- designOnly: true

## Boundary

Safe Desktop Runner remains design-only. Real execution requires a later
explicit approval and a separate implementation/review phase.
