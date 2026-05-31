# Codex One-shot UI Readiness Panel

Phase 263A documents the Personal Operator Console readiness panel for future
one-shot review. The panel is preview-only.

## 1. Required UI Status

The `/ui` panel must show:

- One-shot readiness is preview-only
- executionEnabled=false
- Codex exec not invoked
- Worktree not created
- Workflow runner not connected
- Commit/push disabled
- Approval-preview is not execution permission
- Required preflight checks
- Required evidence
- Go/no-go decision

## 2. Operator Meaning

The panel helps the operator see whether a future task has readiness inputs.
It does not run Codex and does not modify code.

## 3. Required Preflight Checks

The panel should point to workspace, dirty state, allowed files, blocked files,
secret scan, required verification, expected evidence, rollback plan, and
human approval checks.

## 4. Required Evidence

The panel should show that evidence is required before any readiness conclusion
is sealed.

## 5. Go / No-go Decision

Go/no-go is a readiness decision only. It is not execution permission.

## 6. UI Prompt

The `/ui` Personal Operator Console should show One-shot UI Readiness Panel:

- preview-only readiness
- executionEnabled=false
- Codex exec not invoked
- worktree not created
- workflow runner not connected
- commit/push disabled
- approval-preview not permission
- preflight checks
- evidence
- go/no-go

## 7. Required Verification

```powershell
cmd /c pnpm run verify:phase263a-codex-one-shot-ui-readiness-panel
```

## 8. Boundary

This phase must not:

- Modify `legacy/`
- Create `PROJECT_CONTEXT.md`
- Do not add heavy dependencies
- Do not call real `codex exec`
- Do not execute codex command
- Do not create worktrees
- Do not connect workflow runner
- Do not automatically commit or push
- Do not change the default NVIDIA `/chat` mainline
- Do not promise unattended automatic development
- Do not treat approval-preview as execution authorization
- Do not write real API keys
- Do not describe dirty workspace as clean
- Do not describe readiness as execution completed

## 9. Final Conclusion

Phase 263A makes one-shot readiness visible in `/ui` while keeping all
execution disabled.
