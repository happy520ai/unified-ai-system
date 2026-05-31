# Personal Review And Evidence Loop

Phase 243A defines the fixed self-use loop for reviewing Codex results,
running verification, checking evidence, and updating the next task.

It does not call real `codex exec`, does not create worktrees, does not connect
workflow runner, does not commit or push, and does not claim production-grade
vector RAG or GraphRAG.

## 1. Purpose

The Review And Evidence Loop prevents unverified Codex output from becoming a
sealed project conclusion.

## 2. First Read After Codex Result Returns

When a Codex result returns, read:

- The claimed summary.
- The changed files list.
- The verification commands it claims were run.
- The evidence paths it claims were generated.
- Any known issues or skipped commands.
- Any statement about execution, worktrees, workflow runner, commit, push, or
  production readiness.

Claims are not facts until verified locally.

## 3. Boundary Review

Check whether the result crossed scope:

- Compare changed files to allowed scope.
- Check whether `legacy/` changed.
- Check whether `PROJECT_CONTEXT.md` was created.
- Check whether package dependencies changed.
- Check whether default NVIDIA `/chat` mainline changed.
- Check whether preview-only was described as production-ready.

## 4. Legacy Check

Run or inspect:

```powershell
git status --short -- legacy
```

Expected result: no output. If there is output, the result is blocked.

## 5. PROJECT_CONTEXT.md Check

Run or inspect:

```powershell
Test-Path PROJECT_CONTEXT.md
```

Expected result: `False`. If it exists, the result is blocked.

## 6. Commit / Push Check

Confirm:

- No automatic commit was made.
- No automatic push was made.
- No PR was opened automatically.
- The final answer does not claim commit/push permission by default.

Commit/push remains No by default.

## 7. Real Execution / Worktree / Workflow Runner Check

Confirm:

- Real `codex exec` was not connected.
- Worktree creation did not happen.
- Workflow runner was not connected.
- Real Agent execution was not added.
- Approval-preview was not treated as execution authorization.

## 8. Evidence Review

Check:

- Evidence `.json` exists.
- Evidence `.md` exists.
- Evidence status is `passed` before calling the phase sealed.
- Safety fields record disabled real execution, runner, workflow run, worktree,
  commit, push, production RAG, and GraphRAG claims.
- Evidence timestamp matches the current verification round.

Do not forge evidence and do not cite failed evidence as sealed.

## 9. Verification Review

Check that the required commands were executed:

- Phase verifier for the current phase.
- Regression verifiers for personal value phases.
- Secret safety.
- User journey.
- Health check.
- Doctor check.
- Workspace check.

If any required verification fails, stop and report the failure.

## 10. Pass / Blocked / Redo Decision

Use this decision:

- passed: all required verification passed, evidence exists, and boundary
  checks are clean.
- blocked: boundary violation, missing evidence, failed verification, dirty
  workspace overlap, or unsafe claim.
- redo: the idea is valid but the implementation needs a narrower task.

## 11. Final A-M Summary Format

Use this final summary shape:

A. Prerequisite check conclusion
B. Completed phase list
C. Commands actually executed
D. Modified files
E. Evidence paths
F. UI changes
G. Self-use value conclusion
H. Current cannot-do list
I. Recommended next route
J. Current blocker state
K. Whether `legacy/` changed
L. Whether `PROJECT_CONTEXT.md` was created
M. Whether commit/push happened

## 12. Updating The Next Task Queue

After review:

- If passed, mark the task done and create the next candidate only after
  Decision Dashboard review.
- If blocked, keep the blocker visible and create a smaller unblock task.
- If redo, preserve the lesson and generate a narrower task.
- If commercial work is still paused, record that reason in the queue.
- If real execution is still blocked, record that reason in the queue.

## 13. Avoiding Preview-only Overclaim

Do not write:

- production-ready when the feature is preview-only.
- Do not write unattended automatic development when execution is manual.
- Do not write production vector RAG or GraphRAG when the boundary is local
  keyword / SQLite / citation preview.
- Do not write approval as execution permission.
- Do not write dirty workspace as clean workspace.

## 14. UI Review And Evidence Loop Prompt

The `/ui` Personal Operator Console should show:

- Boundary review
- Verification review
- Evidence review
- Conclusion review
- Next task update

## 15. Required Verification Commands

```powershell
cmd /c pnpm run verify:phase243a-personal-review-evidence-loop
cmd /c pnpm run verify:phase242a-personal-action-queue
cmd /c pnpm run verify:phase241a-personal-live-trial
cmd /c pnpm run verify:phase240a-personal-decision-dashboard
cmd /c pnpm run verify:phase239a-personal-project-knowledge-pack
cmd /c pnpm run verify:phase238a-personal-daily-workflow
cmd /c pnpm run verify:phase237a-personal-operator-console
cmd /c pnpm run verify:phase199a-real-ui-trial-runtime-sync
cmd /c pnpm run verify:phase107a-secret-safety
cmd /c pnpm run verify:phase105a-user-journey
cmd /c pnpm run health:phase12a
cmd /c pnpm run doctor:phase13a
cmd /c pnpm -r --if-present check
```

## 16. Phase 243A Boundary

This phase must not:

- Modify `legacy/`
- Create `PROJECT_CONTEXT.md`
- Do not add heavy dependencies
- Do not call real `codex exec`
- Do not create worktrees
- Do not connect workflow runner
- Do not automatically commit or push
- Do not change the default NVIDIA `/chat` mainline
- Do not promise unattended automatic development
- Do not promise production-grade vector RAG or GraphRAG
- Do not describe preview-only capability as production-ready
- Do not write real API keys
- Do not treat approval-preview as execution authorization
- Do not describe dirty workspace as clean
- Do not forge phase evidence

## 17. Final Conclusion

Phase 243A fixes the review loop: a Codex result is only accepted after local
boundary checks, verification, and evidence review.
