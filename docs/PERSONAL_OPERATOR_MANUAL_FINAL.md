# Personal Operator Manual Final

Phase 244A consolidates the self-use operator line from Phase 237A through
Phase 243A into a final personal manual.

It does not call real `codex exec`, does not create worktrees, does not connect
workflow runner, does not commit or push, and does not claim production-grade
vector RAG or GraphRAG.

Phase 244A safety state:

- preview-only
- manual handoff only
- no unattended development
- no real Codex exec
- no auto commit/push
- no workflow runner
- no production vector RAG
- no GraphRAG
- no enterprise ACL sync
- no multi-tenant knowledge base
- Knowledge/RAG is local/self-use preview only

## 1. Daily Startup

Every day:

1. Start or confirm the local service.
2. Open `/ui`.
3. Open Personal Operator Console.
4. Read status, blocker, and recommended next step.
5. Run health if needed.

## 2. What To Read First

Read in this order:

- Current project status
- Current blocker
- Recommended next step
- Daily Workflow
- Project Knowledge Pack
- Decision Dashboard
- Action Queue
- Review And Evidence Loop

## 3. Judging Current Status

Use:

- Latest personal phase doc.
- Latest matching evidence.
- Current verification results.
- Dirty workspace state.
- Boundary status.

Do not call a dirty workspace clean.

## 4. Generating The Next Codex Task

Generate a task only when:

- The action is small.
- The goal is clear.
- The allowed scope is explicit.
- The blocked scope is explicit.
- Verification commands are listed.
- Evidence expectation is listed.
- Commit/push allowed is No by default.
- Real execution allowed is No by default.

## 5. Handing Work To Codex

Use manual handoff only:

- Copy the bounded task text.
- Do not run real `codex exec` by default.
- Do not create a worktree.
- Do not connect workflow runner.
- Do not ask Codex to commit or push.

## 6. Importing Or Reading Codex Result

When a result exists:

- Read it manually first.
- If using the file bridge, save it to the expected inbox path.
- Run the import command only when appropriate for the current manual bridge.
- Treat imported review as review metadata, not automatic approval.

## 7. Reviewing Result

Check:

- Allowed scope.
- `legacy/`.
- `PROJECT_CONTEXT.md`.
- Dependencies.
- Secrets.
- Verification commands.
- Evidence paths.
- Preview-only claims.
- Commit/push claims.
- Real execution claims.

## 8. Running Verification

Run:

- Current phase verifier.
- Personal value regression verifiers.
- Secret safety.
- User journey.
- Health.
- Doctor.
- Workspace check.

Stop if any required verification fails.

## 9. Reading Evidence

Evidence is sealed only when:

- `.json` exists.
- `.md` exists.
- `status` is `passed`.
- Safety flags record disabled execution and disabled automation.
- The evidence corresponds to the current phase and current run.

## 10. Updating The Next Step

After verification:

- Mark current task done, blocked, skipped, or redo.
- Update Action Queue.
- Return to Decision Dashboard.
- Choose one next route.
- Do not auto-enter the route.

## 11. When To Stop

Stop when:

- Verification fails.
- Evidence is missing.
- Scope is unclear.
- Dirty workspace overlap is unsafe.
- The next action asks for real execution, workflow runner, or worktree.
- Do not continue when the next action asks for commit, push, production vector RAG, GraphRAG, or unattended development.
- The next action is commercial packaging while self-use value remains active.

## 12. Things That Must Never Be Default

Never default to:

- Do not modify `legacy/`
- Do not create `PROJECT_CONTEXT.md`
- Do not add heavy dependencies
- Do not call real `codex exec`
- Do not create worktrees
- Do not connect workflow runner
- Do not automatically commit/push
- Do not change default NVIDIA `/chat`
- Do not promise unattended automatic development
- Do not promise production vector RAG or GraphRAG
- Do not write real API keys
- Do not treat approval-preview as execution authorization
- Do not call dirty workspace clean
- Do not forge phase evidence

## 13. Common Commands

```powershell
cmd /c pnpm run verify:phase245a-personal-value-closure
cmd /c pnpm run verify:phase244a-personal-operator-manual-final
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

## 14. Common Exception Handling

Dirty workspace:

- Treat unrelated changes as user-owned.
- Do not revert them.
- Narrow the allowed scope.
- Stop if overlap is unsafe.

Verification failure:

- Stop.
- Record failed command.
- Do not mark the phase sealed.

Evidence missing:

- Run the matching verifier.
- Do not invent evidence paths.

Boundary violation:

- Mark blocked.
- Create a smaller unblock task.

Commercial drift:

- Record commercialization paused.
- Return to personal value decision.

## 15. Self-use Value Boundary

This manual is for local personal operation:

- It helps manage the project.
- It helps generate bounded Codex tasks.
- It helps review Codex results.
- It helps read project knowledge.
- It helps decide next actions.

It is not production automation, not real Agent execution, not production
vector RAG, and not commercial release packaging.

## 16. UI Final Manual Prompt

The `/ui` Personal Operator Console should show:

- Daily use manual
- Commands
- Review checklist
- Stop rules
- Boundaries

## 17. Phase 244A Boundary

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

## 18. Final Conclusion

Phase 244A gives the operator one final manual for daily self-use. It is a
manual control surface, not an execution engine.
