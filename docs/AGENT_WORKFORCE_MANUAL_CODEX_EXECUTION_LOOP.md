# Agent Workforce Manual Codex Execution Loop

Phase: 202A
Status: preview/design only

## Purpose

The manual Codex execution loop defines a human-operated handoff path:
Agent Workforce generates a Plan and Codex Desktop Handoff Pack, the user
copies that pack into desktop Codex or Codex CLI manually, Codex works outside
this web service, and the user reviews and pastes a result summary back for
review.

## Manual Loop

1. Generate Agent Workforce Plan.
2. Export Codex Desktop Handoff Pack.
3. Human copies the pack to desktop Codex.
4. Codex performs work outside this web service.
5. Human reviews Codex result.
6. Human pastes result summary back for review.

## Clipboard Shortcut

To avoid manually copying the large handoff pack, generate and save a Plan in
`/ui`, then run:

```powershell
cmd /c pnpm run handoff:codex
```

The helper pulls the latest saved Plan, writes
`.codex-handoff/latest-codex-handoff.md`,
`.codex-handoff/latest-codex-handoff.json`, and
`.codex-handoff/latest-metadata.json`, then copies the Markdown pack to the
Windows clipboard. The user still opens Codex and pastes manually.

```powershell
cmd /c pnpm run handoff:codex:app
```

This optional shortcut only attempts to open Codex. It does not send the
prompt, run `codex exec`, or execute a task.

The shortcut does not send the prompt automatically.

## Required Human Actions

- Copy the handoff pack.
- Start Codex manually.
- Approve local file changes manually.
- Run verification manually or via Codex.
- Paste the result summary back.

## Disabled By Design

- Automatic Codex invocation is disabled.
- autoRunEnabled is false.
- Codex execution inside the web system is disabled.
- External runner dispatch is disabled.
- Workflow run hookup is disabled.
- The service does not read Codex output folders.
- The service does not apply patches.
- The service does not commit, merge, or push.

## Boundary

This phase adds a manual loop description only. It does not call Codex, does
not call oh-my-codex / OMX, does not create worktrees, does not connect
workflow run, does not add real external runner dispatch, and does not change
the default NVIDIA `/chat` lane.
