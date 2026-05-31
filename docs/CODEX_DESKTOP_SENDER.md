# Controlled Codex Desktop Sender

This document describes the controlled desktop sender for the latest outbox
task.

The sender is not an unattended executor. It does not call the Codex CLI, does
not run `codex exec`, does not create a worktree, does not connect a workflow
runner, and does not grant commit/push permission.

## Source Files

The sender reads:

- `.codex-handoff/outbox/latest-codex-task.md`
- `.codex-handoff/outbox/latest-codex-task.json`

The JSON must keep:

- `mode=manual-handoff-only` or `mode=controlled-desktop-send`
- `executionEnabled=false`
- `codexExecInvoked=false`

## Commands

```powershell
cmd /c pnpm run codex:desktop:send -- --dry-run
cmd /c pnpm run codex:desktop:send -- --copy-only
cmd /c pnpm run codex:desktop:send -- --paste-only
cmd /c pnpm run codex:desktop:send -- --send --confirm-send
```

## Dry-run

`--dry-run` checks that the Markdown and JSON task files exist, validates the
disabled execution flags, prints the task title, task length, and boundary
summary, then stops.

It does not copy to clipboard, does not focus Codex Desktop, does not paste,
and does not send.

## Copy-only

`--copy-only` reads the latest outbox task and copies it to the system
clipboard.

It does not open Codex, does not paste, and does not send.

## Paste-only

`--paste-only` reads the latest outbox task, copies it to the clipboard, tries
to focus Codex Desktop, and sends Ctrl+V.

It does not press Enter and does not click Send.

## Send With Approval

`--send --confirm-send` must appear together. If either flag is missing, the
sender refuses to send.

Before sending, it prints:

```text
This will send the latest outbox task to Codex Desktop.
```

It checks:

- latest task Markdown exists,
- latest task JSON exists,
- allowed mode is present,
- `executionEnabled=false`,
- `codexExecInvoked=false`,
- no auto commit/push boundary is present,
- no workflow runner boundary is present,
- no worktree creation boundary is present,
- no plaintext secret is present.

After an approved send, it writes:

- `.codex-handoff/runs/latest-desktop-send-record.json`
- `.codex-handoff/runs/latest-desktop-send-record.md`

## Safety Boundary

- no real Codex exec
- no Codex CLI invocation
- no automatic commit
- no automatic push
- no PR creation
- no automatic release
- no worktree creation
- no workflow runner
- no `legacy/` modification
- no `PROJECT_CONTEXT.md` creation
- no real API key output
- desktop send is not execution completed
- approval-preview is not execution permission

Codex result handling remains manual: after Codex returns a result, the result
must still enter inbox, review, feedback, and evidence checks.
