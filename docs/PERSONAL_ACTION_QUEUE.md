# Personal Action Queue

Phase 242A turns the next-step decision into a self-use action queue format.
It builds on the Phase 240A Decision Dashboard and stays preview-only.

It does not call real `codex exec`, does not create worktrees, does not connect
workflow runner, does not commit or push, and does not claim production-grade
vector RAG or GraphRAG.

## 1. Purpose

The Personal Action Queue keeps the operator from scattering next steps across
notes. Each task should be small enough to hand to Codex manually or to defer
with a clear reason.

## 2. Task Queue Format

Use this format:

```json
{
  "taskId": "personal-queue-001",
  "title": "Improve self-use decision output",
  "whyNow": "It removes the current blocker or improves daily operation.",
  "allowedScope": ["docs/", "apps/ai-gateway-service/src/ui/consolePage.js"],
  "blockedScope": ["legacy/", "PROJECT_CONTEXT.md", "real codex exec"],
  "codexReady": false,
  "requiredVerification": ["cmd /c pnpm run verify:<phase>"],
  "expectedEvidence": ["apps/ai-gateway-service/evidence/<phase>.json"],
  "stopCondition": "Stop if verification fails or boundary expands."
}
```

## 3. Required Task Fields

Every task must contain:

- taskId
- title
- why now
- allowed scope
- blocked scope
- Codex-ready or not
- required verification
- expected evidence
- stop condition

Missing fields mean the task is not ready for Codex.

## 4. Generating The Next Task From Decision Dashboard

Use this process:

1. Read Current status.
2. Read Current blocker.
3. Read Recommended next step.
4. Compare Option A/B/C.
5. Choose the smallest useful action.
6. Write one queue item.
7. Mark Codex-ready only if scope, boundary, verification, and evidence are
   explicit.

Do not generate multiple active implementation tasks when one blocker is still
unresolved.

## 5. Avoiding Infinite Expansion

Avoid infinite expansion with these rules:

- One active task at a time.
- Prefer blocker removal over new surface area.
- Stop when the task asks for real execution, workflow runner, or worktree.
- Stop when the task asks for commit/push, production vector RAG, GraphRAG, or unattended development.
- Stop when the next action is only "make it bigger" without daily value.
- Record skipped tasks instead of keeping them active forever.
- Return to Decision Dashboard before creating another task.

## 6. Handling Blocked / Skipped / Done

Use these statuses:

- blocked: required verification failed, evidence is missing, scope is unclear,
  or boundary would be crossed.
- skipped: useful later, but not part of the current personal value line.
- done: verifier passed, evidence exists, and boundary checks are clean.

Do not mark a task done because a handoff claims success. Done requires
verification and evidence.

## 7. Recording Commercialization Pause

Record "commercialization paused" when:

- The task does not improve daily self-use.
- The personal operator line is still being sealed.
- The requested output is sales packaging rather than operational value.
- The current decision gate recommends self-use improvement first.

This does not delete commercial work. It simply keeps the current active line
focused on personal value.

## 8. Recording No Real Execution

Record "no real execution" when:

- Codex task generation is manual only.
- Real `codex exec` is not enabled by this phase.
- Worktree creation is not allowed.
- Workflow runner connection is not allowed.
- Commit/push is not allowed by default.
- Approval-preview is review metadata only.

## 9. UI Action Queue Prompt

The `/ui` Personal Operator Console should show:

- Next task
- Why now
- Ready for Codex
- Verification required
- Stop condition

## 10. Required Verification Commands

```powershell
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

## 11. Phase 242A Boundary

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

## 12. Final Conclusion

Phase 242A gives the self-use line a small queue format for deciding what to do
next. It does not execute tasks; it only makes manual task selection clearer.
