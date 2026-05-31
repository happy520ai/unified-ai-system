# Agent Workforce Codex Result Inbox Contract

Phase: 209A

This contract defines the local file bridge used to read Codex output back into
Agent Workforce review. It is a local manual bridge by default. It does not
enable unattended production execution, external runner dispatch, workflow run
hookup, automatic patch application, automatic commit, or automatic push.

## Directory Contract

The bridge uses the repository-local `.codex-handoff/` directory:

```text
.codex-handoff/
  outbox/
    latest-codex-handoff.md
    feedback-to-codex.md
  inbox/
    latest-codex-result.md
    latest-codex-result.json
  review/
    latest-system-review.md
    latest-feedback-to-codex.md
    latest-review-summary.json
  runs/
    latest-run-summary.json
    codex-stdout.txt
    codex-stderr.txt
```

## Result Markdown Contract

Codex result markdown must be written to:

```text
.codex-handoff/inbox/latest-codex-result.md
```

It must use this shape:

```markdown
# Codex Result

## Summary

## Changed Files

## Commands Run

## Tests Passed

## Evidence Paths

## Known Issues

## Boundary Check

## Next Steps
```

## Boundary Check Requirements

The Boundary Check section must explicitly cover:

- Whether `legacy/` was modified.
- Whether `PROJECT_CONTEXT.md` was created.
- Whether `oh-my-codex / OMX / team / ralph` was called.
- Whether a worktree was created.
- Whether a workflow run hookup was used.
- Whether the default NVIDIA `/chat` main lane was modified.
- Whether any secret was exposed.
- Whether any required verification failed.

## Default Safety State

- Default bridge mode is manual/dry-run.
- `codex exec` is disabled unless a user explicitly enables it.
- Imported Codex results are reviewed only; they are not automatically applied.
- The bridge never commits or pushes automatically.
- The bridge never creates a worktree by default.
- The bridge never connects workflow run.
- The bridge must not write plaintext API keys to logs, evidence, inbox,
  outbox, review, or run files.
