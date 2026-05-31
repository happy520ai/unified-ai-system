# Personal Decision Dashboard

Phase 240A adds a preview-only self-use decision dashboard on top of:

- Phase 237A Personal Operator Console
- Phase 238A Personal Daily Workflow
- Phase 239A Personal Project Knowledge Pack

The goal is to help the operator decide what to do next today. It does not
execute work, does not call real `codex exec`, does not create worktrees, does
not connect workflow runner, does not commit or push, and does not claim production-grade vector RAG or GraphRAG.

## 1. Purpose

The Personal Decision Dashboard turns project knowledge into a bounded
operator decision:

- What is the current status?
- What is the current blocker?
- What is the recommended next step?
- Which option should be chosen: A, B, or C?
- Is the task ready to hand to Codex manually?
- Should the operator stop expanding scope today?
- Which verification commands must run before calling the result sealed?

It is a decision aid, not an automated project manager.

## 2. Current Status Dimensions

Use these dimensions before recommending the next action:

- Phase status: newest personal/operator phase, matching docs, and evidence.
- Evidence status: `passed`, `failed`, or `skipped-not-enabled`.
- Workspace status: clean, dirty with known changes, or dirty with unknown
  changes.
- Blocker status: no blocker, documentation blocker, verification blocker,
  boundary blocker, or dirty-workspace blocker.
- Validation status: whether the required phase verifier and regression
  commands passed.
- Knowledge confidence: whether the answer is based on current docs and
  current evidence instead of old commercial or future-roadmap material.
- Boundary status: whether the proposed action stays preview-only and avoids
  real execution, worktrees, workflow runner, commit, push, secrets, and
  production RAG claims.
- Personal value: whether the action helps daily project operation instead of
  returning prematurely to commercial packaging.

## 3. Blocker Decision Rules

Classify the blocker before choosing the next step:

- No blocker: the latest verifier passed, evidence is current, and the next
  action is bounded.
- Documentation blocker: the intended behavior is not written down clearly
  enough for Codex or for later review.
- Verification blocker: a required command failed, evidence is missing, or a
  verifier does not cover the new surface.
- Boundary blocker: stop because the task asks for real Codex exec or workflow
  runner.
- Boundary blocker: stop because the task asks for worktree creation or
  automatic commit/push.
- Boundary blocker: stop because the task asks for production vector RAG, GraphRAG, or unattended development.
- Dirty-workspace blocker: unrelated changes are present and the next edit
  might overwrite or confuse them.
- Evidence blocker: the result is described as sealed before the matching
  evidence is refreshed by a passing verifier.

If any blocker exists, the recommended next step should reduce that blocker
before adding new capability.

## 4. Recommended Next Step Rules

Choose the next step with this order:

1. Fix boundary or verification blockers first.
2. If the workspace is dirty, isolate the allowed file range and avoid touching
   unrelated files.
3. If the current phase lacks a verifier, add the verifier before expanding UI
   or docs further.
4. If evidence is stale, run the matching verifier and refresh evidence only
   after it passes.
5. If the operator needs daily value, prefer self-use console, workflow,
   knowledge, review, or decision improvements over sales packaging.
6. If a task is small, bounded, and verifiable, generate a Next Codex Task
   template for manual handoff.
7. If the task needs real execution, commit/push, workflow runner, worktree, or
   production RAG, stop and require a new explicit phase.

## 5. Option A/B/C Comparison Format

Use this format when comparing routes:

| Option | Focus | When to choose | Risk / Boundary | Verification |
| --- | --- | --- | --- | --- |
| Option A | Stabilize current phase | A verifier failed, evidence is stale, or the workspace is confusing | Lowest scope; avoids new capability | Run the failed verifier and regression commands |
| Option B | Improve personal operator value | Current phase is sealed and the next self-use workflow gap is clear | Medium scope; must stay preview-only | Add a focused verifier and evidence |
| Option C | Pause or stop expansion | The task would cross boundaries or daily value is unclear | Safest decision when scope is drifting | Record blocker and next safe task |

Do not choose an option only because it sounds bigger. Choose the smallest
option that resolves the current blocker or improves daily project operation.

## 6. Codex-ready Decision

A task is Codex-ready when all of these are true:

- The goal is one concrete self-use improvement.
- The allowed modification range is explicit.
- The task says do not modify `legacy/`.
- The task says do not create `PROJECT_CONTEXT.md`.
- The task says default no commit/push.
- The task says default no real `codex exec`.
- The task says do not create worktrees or connect workflow runner.
- The task says do not write plaintext API keys.
- The required verification commands are listed.
- The expected output format includes summary, changed files, verification,
  evidence, boundary check, known issues, and recommended next step.

A task is not Codex-ready when it is broad, ambiguous, depends on unreviewed
dirty workspace changes, asks for real execution, or lacks verification.

## 7. Stop / Continue Decision

Continue when:

- The next action is small, bounded, and directly useful for daily operation.
- The allowed files are known.
- The verifier can prove the change.
- The boundary remains preview-only.

Stop when:

- The current result is not verified.
- Evidence is missing or stale.
- The workspace is dirty in files needed by the next task and the ownership is
  unclear.
- Do not continue when the next action asks for production vector RAG or
  GraphRAG.
- Do not continue when the next action asks for real Agent execution, workflow
  runner, worktree creation, automatic commit/push, or PR automation.
- Do not continue when the next action asks for unattended automatic
  development.
- The next action is commercial packaging while the current priority is still
  personal operator value.

Stopping is a valid decision when it prevents boundary drift.

## 8. Dirty Workspace Handling

When the workspace is dirty:

- Treat existing unrelated changes as user-owned.
- Do not revert unrelated files.
- Identify the exact allowed modification range before editing.
- Prefer docs, UI prompt text, package scripts, verifier, and matching
  evidence for the current phase.
- Avoid broad refactors.
- If the dirty files overlap the next task, read them first and work with the
  existing content.
- If the overlap makes the task unsafe, stop and record the blocker.

Dirty workspace does not automatically block every change, but it should make
the next action smaller and easier to verify.

## 9. Self-use Decision Output Template

Use this output template before generating or handing off a task:

```text
Today recommended action:
- <one bounded action>

Not recommended action:
- <what should not be done today>

Reason:
- <why this action is the best next step>

Codex task can be generated:
- Yes/No, with reason.

Required verification commands:
- cmd /c pnpm run verify:phase240a-personal-decision-dashboard
- cmd /c pnpm run verify:phase239a-personal-project-knowledge-pack
- cmd /c pnpm run verify:phase238a-personal-daily-workflow
- cmd /c pnpm run verify:phase237a-personal-operator-console
- cmd /c pnpm run verify:phase199a-real-ui-trial-runtime-sync
- cmd /c pnpm run verify:phase107a-secret-safety
- cmd /c pnpm run verify:phase105a-user-journey
- cmd /c pnpm run health:phase12a
- cmd /c pnpm run doctor:phase13a
- cmd /c pnpm -r --if-present check

Commit/push allowed:
- No by default.

Real execution allowed:
- No by default.
```

## 10. Preview-only Boundary

This phase may update:

- `docs/PERSONAL_DECISION_DASHBOARD.md`
- The preview-only Personal Operator Console section in `/ui`
- `apps/ai-gateway-service/src/entrypoints/verifyPersonalDecisionDashboard.js`
- Root and service package scripts for
  `verify:phase240a-personal-decision-dashboard`
- Phase 240A evidence generated by the verifier

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
- Do not write real API keys to docs, logs, evidence, UI, handoff, inbox,
  review, or run files

Required verification commands for this phase:

```powershell
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

## 11. Final Conclusion

Phase 240A helps the operator turn current project status, blockers, evidence,
and boundaries into a concrete next-step decision. It can recommend whether to
continue, stop, or prepare a bounded manual Codex handoff.

It remains preview-only decision guidance. It is not automatic execution, not
real Codex exec, not workflow-run integration, not commit/push automation, and
not a production vector RAG or GraphRAG system.
