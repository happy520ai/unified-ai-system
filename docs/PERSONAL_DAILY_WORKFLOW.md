# Personal Daily Workflow / 每日自用工作流

Phase 238A freezes the daily self-use workflow on top of the Phase 237A
Personal Operator Console. The purpose is simple: know what to look at every
day, generate the next bounded Codex task, hand it off manually, review the
result, verify evidence, decide whether to continue, and stop cleanly.

This is preview-only and manual. It does not add real Codex execution, real
Agent execution, workflow-run dispatch, worktree creation, automatic patch
application, automatic commit/push, or production-grade RAG.

## 1. Daily Start

Start from the project root:

```powershell
cd E:\AI-Data\AI网关系统\unified-ai-system
cmd /c pnpm run status:phase10a
cmd /c pnpm run health:phase12a
```

If the service is not running, start it:

```powershell
cmd /c pnpm run dev:phase7b
cmd /c pnpm run health:phase12a
```

Daily opening rule:

- Open `http://127.0.0.1:3100/ui`.
- Do not start with a commercial package.
- Do not start with real Codex exec.
- Do not commit or push as part of the daily workflow.

## 2. What To Check First In /ui

After opening `/ui`, look at the Personal Operator Console first.

Read these items in order:

1. Current project status.
2. Current blocker.
3. Recommended next step.
4. Agent Workforce / Codex Bridge / Knowledge Base status.
5. Common verification commands.
6. Daily Workflow: Today Start -> Next Codex Task -> Review Result -> Verify
   Evidence -> Stop / Decide Next.

If the blocker says the workspace is dirty, treat real execution as blocked.
Dirty workspace does not block preview docs/UI/verifier work, but it does block
real one-shot execution unless the user separately approves it and the safety
gate passes.

## 3. How To Read Personal Operator Console

Use the console as a cockpit, not as an executor.

Project status tells you what the system can do today:

- Local AI Gateway and `/ui`.
- Agent Workforce Preview planning.
- Codex Bridge file handoff/review/feedback.
- Local Knowledge/RAG keyword and citation preview.

Current blocker tells you what not to do yet:

- Do not treat a dirty workspace as ready for real exec.
- Do not treat approval-preview as execution authorization.
- Do not describe local keyword RAG as production vector RAG.

Recommended next step tells you what to ask Codex to do next:

- Prefer one small self-use improvement.
- Keep allowed files explicit.
- Keep verification commands explicit.
- Keep output format explicit.

## 4. Generate Next Codex Task

Use the Next Codex Task template from the Personal Operator Console.

Fill these fields:

- Goal: one concrete self-use improvement.
- Context: current phase, current blocker, and why this helps daily operation.
- Boundary: legacy, project context, NVIDIA `/chat`, no Codex exec, worktree,
  workflow runner, commit, push, secrets, and preview claims.
- Allowed modification range: exact files or folders.
- Expected deliverables: doc/UI/script/evidence changes.
- Verification commands: include the phase verifier and safety checks.
- Output format: summary, changed files, verification, evidence, boundary,
  known issues, next step.

Default task boundary:

- Do not modify `legacy/`.
- Do not create `PROJECT_CONTEXT.md`.
- Do not change the default NVIDIA `/chat` lane.
- Do not automatically commit or push.
- Do not call real `codex exec`.
- Do not create worktrees.
- Do not connect workflow runner.
- Do not write plaintext API keys.

## 5. Hand Task To Codex

Preferred manual path:

1. Generate or write the bounded task text.
2. Run the manual handoff helper only if a saved Agent Workforce plan should be
   exported:

```powershell
cmd /c pnpm run handoff:codex
```

3. Review `.codex-handoff/outbox/latest-codex-handoff.md`.
4. Paste the task into Codex manually.
5. Keep Codex result review manual.

Allowed handoff posture:

- Manual copy/paste is allowed.
- Dry-run helper output is allowed.
- Real `codex exec` is not part of this daily workflow.
- Desktop GUI send is not part of this daily workflow.
- No automatic patch application is allowed.

## 6. Import Codex Result

When Codex returns a result:

1. Put the result text in `.codex-handoff/inbox/latest-codex-result.md`.
2. Run:

```powershell
cmd /c pnpm run codex:result:import
```

3. Read the generated review and feedback files under `.codex-handoff`.
4. Do not automatically apply external patches.
5. Do not automatically merge, commit, push, or create PRs.

## 7. Review Result

Use the Codex Result Review checklist:

- Scope: did the result stay inside the requested goal and allowed files?
- Legacy: did it modify `legacy/`?
- Project context: did it create `PROJECT_CONTEXT.md`?
- Evidence: was evidence refreshed only after matching verification passed?
- Verification: were required commands run and reported?
- Secrets: did it avoid plaintext keys, tokens, and credentials?
- Execution: did it avoid real Codex exec, workflow runner, worktree creation,
  automatic patch apply, commit, push, and PR creation?
- NVIDIA lane: did it preserve the default NVIDIA `/chat` mainline?
- Claims: did it avoid overstating preview-only, design-only, approval-preview,
  local keyword RAG, or dry-run behavior?

Review decision labels:

- `accepted-preview`: keep the work as preview/docs/UI/verifier changes.
- `changes-requested`: ask Codex for a correction.
- `blocked-unverified`: verification is missing or failed.
- `rejected-boundary`: hard boundary was crossed.

## 8. Verify Evidence

For Phase 238A, run:

```powershell
cmd /c pnpm run verify:phase238a-personal-daily-workflow
cmd /c pnpm run verify:phase237a-personal-operator-console
cmd /c pnpm run verify:phase199a-real-ui-trial-runtime-sync
cmd /c pnpm run verify:phase107a-secret-safety
cmd /c pnpm run verify:phase105a-user-journey
cmd /c pnpm run health:phase12a
cmd /c pnpm run doctor:phase13a
cmd /c pnpm -r --if-present check
```

Evidence rule:

- Refresh phase evidence only after the matching verifier passes.
- If verification fails, keep the evidence honest and fix the cause.
- Do not record plaintext API keys in evidence.
- Do not claim real execution from a dry-run or preview-only result.

## 9. Decide Whether To Enter The Next Phase

Enter the next phase only when:

- The current phase verifier passes.
- Required regression checks pass.
- Evidence exists and matches the actual result.
- The blocker is explicit.
- The next step is explicit.
- Boundaries were not crossed.
- The user intentionally chooses the next phase.

Do not enter the next phase when:

- Verification failed.
- Evidence is missing.
- Codex result is unreviewed.
- The workspace state creates a real-exec risk.
- A boundary was crossed.
- The next step is still vague.

## 10. Stop The Work Round

Stop cleanly by recording:

- What changed.
- Which commands passed or failed.
- Evidence paths.
- Boundary check.
- Current blocker.
- Recommended next step.

If the local service should be stopped:

```powershell
cmd /c pnpm run stop:phase9c
cmd /c pnpm run status:phase10a
```

Stopping the round is not a commit or release. It is just a clean operator
checkpoint.

## 11. Blocker Playbook

Dirty workspace:

- Treat real Codex exec as blocked.
- Continue preview-only docs/UI/verifier work only if the allowed file range is
  clear.
- Do not reset or revert unrelated changes.
- Record the dirty state as a blocker if it affects the next action.

Verification failure:

- Do not claim the phase passed.
- Read the failing check.
- Fix only the scoped cause.
- Rerun the failing verifier and required regression commands.

Evidence missing:

- Do not hand-wave evidence.
- Rerun the matching verifier.
- Confirm `.json` and `.md` evidence exist.
- If evidence cannot be generated, mark the phase blocked.

Boundary overrun:

- Stop and label the result `rejected-boundary`.
- Do not apply or merge the result.
- Do not commit or push.
- Ask for a corrected bounded task or manually remove only the offending scoped
  change after review.

Secret exposure:

- Stop immediately.
- Do not copy the secret into docs, evidence, chat, handoff, inbox, review, or
  logs.
- Rotate the secret outside this workflow if a real secret was exposed.
- Rerun secret safety after cleanup.

## 12. Self-use Workflow Acceptance Checklist

- Can complete one manual loop from status review to Codex handoff.
- Can complete one Codex result review.
- Can identify the current blocker.
- Can identify the recommended next step.
- Can verify evidence without real execution.
- Can stop the round cleanly.
- Does not trigger real Codex exec.
- Does not create worktrees.
- Does not connect workflow runner.
- Does not commit or push.
- Does not modify `legacy/`.
- Does not create `PROJECT_CONTEXT.md`.
- Does not change the default NVIDIA `/chat` mainline.
- Does not write plaintext API keys.

## 13. Phase 238A Boundary

This phase may update:

- `docs/PERSONAL_DAILY_WORKFLOW.md`.
- The preview-only Personal Operator Console section in `/ui`.
- `apps/ai-gateway-service/src/entrypoints/verifyPersonalDailyWorkflow.js`.
- Root and service package scripts for
  `verify:phase238a-personal-daily-workflow`.
- Phase 238A evidence generated by the verifier.

This phase must not:

- Modify `legacy/`.
- Create `PROJECT_CONTEXT.md`.
- Automatically commit or push.
- Do not call real `codex exec`.
- Create worktrees.
- Connect a workflow runner.
- Change the default NVIDIA `/chat` mainline.
- Introduce new dependencies.
- Do not promise unattended automatic development.
- Do not treat approval-preview as execution authorization.
- Do not write real API keys to docs, logs, evidence, UI, handoff, inbox,
  review, or run files.

## 14. Final Conclusion

Phase 238A freezes the daily self-use loop:

Today Start -> Next Codex Task -> Manual Codex Handoff -> Review Result ->
Verify Evidence -> Stop / Decide Next.

It makes the existing system more useful every day without expanding the
execution boundary.
