# Codex One-shot Readiness Policy

Phase 256A defines preview-only readiness policy for a possible future
single controlled Codex run. It does not enable execution.

## 1. What One-shot Readiness Is

One-shot readiness is a visible checklist of policy, scope, safety, evidence,
and human confirmation that must exist before a future single Codex run can
even be considered.

## 2. What One-shot Execution Is Not

Readiness is not one-shot execution. It is not a real Codex exec, not a Codex
CLI call, not code modification, not worktree creation, not workflow runner
dispatch, and not commit/push.

## 3. Tasks Allowed Into Readiness

Allowed readiness candidates:

- small documentation or verifier updates
- bounded UI text or preview panel updates
- evidence-only validation tasks
- manual handoff or result review tasks
- low-risk fixes with exact allowed files and verification commands

## 4. Tasks Not Allowed Into Readiness

Not allowed:

- secret handling changes without explicit review
- broad refactors
- dependency upgrades
- legacy migration
- provider mainline changes
- workflow runner integration
- Do not continue when the task asks for automatic commit, push, PR, release work, or any automatic code change.
- automatic code change is not allowed.
- no auto commit, no auto push, no auto PR.
- release work is not allowed in one-shot readiness.

## 5. Required Preconditions

- Phase 255A evidence must be passed.
- Task must have allowed scope and blocked scope.
- Required verification commands must be listed.
- Expected evidence paths must be listed.
- Stop condition must be explicit.
- executionEnabled=false.

## 6. Required Human Confirmations

Human confirmation must cover:

- requested task
- allowed files
- blocked files
- required verification
- expected evidence
- stop condition
- approval-preview is not execution permission

## 7. Dirty Workspace Rule

Dirty workspace must remain visible. Do not describe dirty workspace as clean.
If dirty changes overlap the task, readiness is blocked until a human decides
whether to continue, split the task, or stop.

## 8. Secret Safety Rule

Do not write real API keys. Secret scan must pass before any future real run is
considered. Evidence may record safety status only, not secret values.

## 9. legacy/ Rule

Do not modify `legacy/`. If a task requires `legacy/`, readiness is blocked.

## 10. PROJECT_CONTEXT.md Rule

Do not create `PROJECT_CONTEXT.md`. If a plan requires that file, readiness is
blocked.

## 11. Commit / Push Rule

Do not automatically commit or push. commit/push remains disabled by default.

## 12. Evidence Rule

Every readiness phase must generate verifier evidence. Failed evidence is not
sealed and must not be hand-edited to passed.

## 13. Failure Stop Rule

Stop immediately when verification fails, evidence is missing, boundary claims
are unclear, or readiness is described as execution completed.

## Required readiness-only markers

- readiness only
- not execution
- executionEnabled=false
- codexExecInvoked=false
- no automatic code change
- no auto commit/push/PR
- no release work
- approval-preview is not execution permission
- no worktree creation
- no workflow runner
- no real Codex exec
- no codex CLI invocation
- no unattended development

## 14. UI Prompt

The `/ui` Personal Operator Console should show One-shot Readiness Policy:

- Readiness policy
- Not execution
- Allowed tasks
- Blocked tasks
- Human confirmation
- Failure stop rule

## 15. Required Verification

```powershell
cmd /c pnpm run verify:phase256a-codex-one-shot-readiness-policy
```

## 16. Boundary

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

## 17. Final Conclusion

Phase 256A establishes policy for preview-only one-shot readiness and keeps
real execution disabled.
