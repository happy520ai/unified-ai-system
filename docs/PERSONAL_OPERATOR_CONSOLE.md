# Personal Operator Console / Self-use Project Console

Phase 237A changes the product priority from commercial packaging to daily
personal value: make `unified-ai-system` easier to use as the operator's own
project cockpit.

This is preview-only. It adds guidance, UI copy, a Codex task template, and a
review checklist. It does not add real Codex execution, real Agent execution,
workflow-run dispatch, worktree creation, automatic patch application,
automatic commit/push, or production-grade RAG.

## 1. Purpose

The Personal Operator Console is a daily self-use surface for:

- Reading the current project status.
- Seeing the current blocker.
- Choosing the recommended next step.
- Copying common verification commands.
- Seeing Agent Workforce, Codex Bridge, and Knowledge Base status.
- Creating the next bounded Codex task prompt.
- Reviewing Codex results before accepting them.
- Using project docs and evidence as local knowledge.

The target user is the project owner/operator. The console is not a sales page,
not a customer-facing promise, and not an unattended development system.

## 2. Current Project Status

Current practical state:

- Local AI Gateway service and `/ui` are the daily entry point.
- Agent Workforce Preview can generate plans, review packages, approval
  preview metadata, and exportable handoff packages.
- Codex Bridge is a local file bridge around handoff, inbox, review, feedback,
  dry-run loop, and explicit-gated one-shot paths.
- Knowledge Base/RAG is useful for local source lookup and cited answers.

Current blocker:

- The workspace is dirty, so real Codex execution should remain blocked until
  the user intentionally resolves or accepts that state and the safety gate
  passes.
- Real `codex exec` remains disabled by default.
- Approval-preview is still review metadata only, not execution permission.
- Do not describe production-grade vector RAG, multi-user SaaS, workflow-run execution, or unattended development as completed or promised.

Recommended next step:

- Use the Personal Operator Console to generate the next bounded Codex task
  for self-use value first.
- Prefer small improvements that help daily project operation: bridge status,
  result review, verification visibility, knowledge lookup, and next-task
  clarity.

## 3. Common Verification Commands

Run these when sealing Phase 237A:

```powershell
cmd /c pnpm run verify:phase237a-personal-operator-console
cmd /c pnpm run verify:phase236a-commercial-business-report
cmd /c pnpm run verify:phase199a-real-ui-trial-runtime-sync
cmd /c pnpm run verify:phase107a-secret-safety
cmd /c pnpm run verify:phase105a-user-journey
cmd /c pnpm run health:phase12a
cmd /c pnpm run doctor:phase13a
cmd /c pnpm -r --if-present check
```

## 4. System Status Cards

Agent Workforce:

- Status: preview planning ready.
- Useful for: template-driven plans, role breakdown, clarification, consensus,
  review package, approval preview metadata, save/history/export.
- Boundary: execution disabled; approval-preview is not execution approval.

Codex Bridge:

- Status: manual/local file bridge ready.
- Useful for: handoff file generation, result inbox import, system review,
  feedback outbox, dry-run loops, explicit-gated one-shot review.
- Boundary: default no real Codex exec, no worktree, no workflow run, no
  automatic commit/push, no automatic patch application.

Knowledge Base:

- Status: local keyword / SQLite / citation preview.
- Useful for: asking project status, phase conclusions, blocker summaries,
  verification command lookup, and next-plan questions.
- Boundary: do not call it production-grade vector RAG. Current value is local
  keyword retrieval, SQLite persistence, snippets, highlights, and citations.

## 5. Next Codex Task Template

Use this structure when creating the next Codex instruction from the console.

```markdown
Goal:
- Describe one concrete self-use improvement.

Context:
- Current phase:
- Current blocker:
- Why this helps daily operation:

Boundary:
- Do not modify legacy/.
- Do not create PROJECT_CONTEXT.md.
- Do not change the default NVIDIA /chat lane.
- Default no commit/push.
- Default no real Codex exec.
- Do not create worktrees.
- Do not connect workflow run.
- Do not automatically apply external patches.
- Do not write plaintext API keys.
- Do not describe preview/design-only surfaces as production execution.

Allowed modification range:
- List exact files or folders allowed for this task.

Expected deliverables:
- UI/doc/script/evidence changes expected.
- Any evidence files that should be refreshed.

Verification commands:
- cmd /c pnpm run verify:<phase-script>
- cmd /c pnpm run verify:phase107a-secret-safety
- cmd /c pnpm run health:phase12a
- cmd /c pnpm -r --if-present check

Output format:
A. Summary
B. Changed Files
C. Verification Commands Run
D. Evidence Paths
E. Boundary Check
F. Known Issues
G. Recommended Next Step
```

## 6. Codex Result Review Checklist

Use this checklist before trusting or importing a Codex result:

- Scope: did the result stay inside the requested goal and allowed files?
- Legacy: Check whether `legacy/` changed.
- Project context: Check whether `PROJECT_CONTEXT.md` was created.
- Evidence: Check whether evidence was refreshed only after the matching
  verification passed.
- Verification: Check whether verification commands passed and are named in
  the result.
- Secrets: did it avoid plaintext API keys, tokens, credentials, and unsafe
  environment dumps?
- Execution: did it avoid real Codex exec, workflow run, worktree creation,
  automatic patch apply, commit, push, and PR creation unless separately
  approved?
- NVIDIA lane: did it preserve the default NVIDIA `/chat` mainline?
- Claims: Check whether conclusions are overstated, especially preview-only,
  design-only, local keyword RAG, approval-preview, approval claims, or dry-run
  behavior.
- Output format: did it include summary, changed files, verification commands,
  evidence paths, boundary check, known issues, and next step?

Recommended review decision labels:

- `accepted-preview`: safe to keep as preview/doc/UI work.
- `changes-requested`: useful but needs correction.
- `rejected-boundary`: crossed hard boundaries.
- `blocked-unverified`: missing required verification.

## 7. Knowledge/RAG Self-use Guide

Recommended project knowledge sources:

- `README.md`
- `AGENTS.md`
- `docs/*.md`
- `apps/ai-gateway-service/evidence/*.md`
- `apps/ai-gateway-service/evidence/*.json`
- Selected package and entrypoint files when asking implementation questions.

Do not import:

- `.env`
- private API keys or credentials
- raw terminal logs containing secrets
- large unrelated legacy folders

Suggested questions:

- What is the current verified project status?
- What is the current blocker?
- Which phase evidence proves Agent Workforce is preview-only?
- What verification commands must run before accepting this task?
- Did this Codex result cross the legacy, worktree, workflow, commit, push, or
  real-exec boundary?
- What is the safest next self-use improvement?

Knowledge boundary:

- Current Knowledge/RAG remains local keyword / SQLite / citation preview.
- It can support daily project lookup and cited summaries.
- It must not be described as production-grade vector RAG, GraphRAG, enterprise
  knowledge governance, tenant-aware retrieval, or long-term memory.

## 8. Phase 237A Boundary

This phase may update:

- `/ui` copy and preview-only operator sections.
- `docs/PERSONAL_OPERATOR_CONSOLE.md`.
- `apps/ai-gateway-service/src/entrypoints/verifyPersonalOperatorConsole.js`.
- Root and service package scripts for
  `verify:phase237a-personal-operator-console`.
- Phase 237A evidence generated by the verifier.

This phase must not:

- Modify `legacy/`.
- Create `PROJECT_CONTEXT.md`.
- Automatically commit or push.
- Call real `codex exec`.
- Create worktrees.
- Connect a workflow runner.
- Change the default NVIDIA `/chat` mainline.
- Introduce heavy dependencies.
- Do not promise unattended automatic development.
- Do not treat approval-preview as execution authorization.
- Do not write real API keys to docs, logs, evidence, UI, handoff, inbox,
  review, or run files.

## 9. Final Conclusion

Phase 237A turns the existing preview system inward: it helps the operator run
the project every day, shape the next Codex instruction, review results with a
clear safety checklist, and ask project-knowledge questions with citations.

It is a personal workbench layer, not a new execution engine.
