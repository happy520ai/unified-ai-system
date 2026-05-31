# Personal Project Knowledge Pack / 自用项目知识包

Phase 239A defines a preview-only knowledge pack for using
`unified-ai-system` to read, organize, and query its own project materials.
It builds on Phase 237A Personal Operator Console and Phase 238A Personal
Daily Workflow.

This is a self-use documentation and verification layer. It does not add real
Agent execution, does not call real `codex exec`, does not create worktrees,
does not connect workflow runner, does not commit or push, and explicitly does
not claim production-grade vector RAG or GraphRAG.

## 1. Purpose

The Personal Project Knowledge Pack helps the operator answer daily project
questions with local project sources:

- What is the current project status?
- What is the current blocker?
- Which phases are sealed?
- Which capabilities are preview-only?
- Which commercial statements are historical advice rather than current
  priority?
- What is the next bounded Codex task?
- Which verification commands must run?
- What is the current Knowledge/RAG boundary?

It is not a production knowledge platform. It is a local keyword / SQLite /
citation preview posture for self-use project understanding.

## 2. Recommended Sources

Include these sources when building or refreshing the self-use knowledge pack:

- `README.md`
- `AGENTS.md`
- `docs/PERSONAL_OPERATOR_CONSOLE.md`
- `docs/PERSONAL_DAILY_WORKFLOW.md`
- `docs/PERSONAL_PROJECT_KNOWLEDGE_PACK.md`
- Current phase docs under `docs/`
- Current phase evidence under `apps/ai-gateway-service/evidence/`
- Selected `.codex-handoff` handoff, inbox, review, and feedback files when
  reviewing the latest Codex loop
- Selected source files only when asking implementation-specific questions

Do not include:

- `.env`
- plaintext API keys or credentials
- unrelated bulk `legacy/` content
- raw logs that may contain secrets
- old handoff drafts that are not relevant to the current review

## 3. Source Roles

`README.md`:

- Use for broad project overview, command discovery, and current user-facing
  descriptions.
- Ask: What can the system do locally? Which commands start and verify it?

`AGENTS.md`:

- Use for repository rules, ownership, hard boundaries, and phase constraints.
- Ask: What is forbidden in this phase? Which package owns this surface?

`docs/`:

- Use for sealed phase narratives, operator guidance, daily workflow, product
  boundaries, and roadmap context.
- Ask: What was sealed by a phase? What is preview-only? What is future
  roadmap?

`apps/ai-gateway-service/evidence/`:

- Use for machine-readable and Markdown proof that a phase verifier passed,
  failed, or skipped honestly.
- Ask: Which verification passed? What disabled states were recorded? Was real
  execution invoked?

`.codex-handoff`:

- Use for the latest handoff, Codex result, import review, feedback, and run
  summaries.
- Ask: What task was handed off? What did Codex claim? What review decision or
  feedback was generated?
- Treat it as working-loop material, not permanent source of truth unless the
  matching verifier/evidence later seals the result.

## 4. Fact Types

Distinguish these categories before answering:

Sealed facts:

- A phase verifier passed.
- Evidence `.json` and `.md` exist.
- The matching doc states the phase conclusion.
- Disabled states and safety flags are recorded.

Preview-only capabilities:

- Agent Workforce planning, review package, approval preview, handoff package,
  local plan history, and export.
- Codex bridge handoff/import/review/feedback surfaces.
- Knowledge/RAG local keyword / SQLite / citation preview.
- Daily workflow and Personal Operator Console guidance.

Commercial advice:

- Phase 236A business report is historical business packaging guidance.
- It is not the current priority after Phase 237A shifted toward personal
  operator value.
- Do not answer current self-use questions as if the commercial sales package
  is still the main task.

Future roadmap:

- Do not describe production-grade vector RAG or GraphRAG as current sealed
  capability.
- Do not describe multi-user SaaS or tenant isolation as current sealed
  capability.
- Do not describe real Agent execution, workflow runner, real `codex exec`,
  automatic commit/push, or PR automation as current sealed capability unless
  a later explicit phase seals them.

## 5. Querying Project Status

Use Knowledge/RAG for cited project lookup like this:

1. Ask one narrow question.
2. Prefer current personal docs and latest evidence over old phase notes.
3. Require citations from `docs/` or evidence files.
4. Check whether the cited evidence status is `passed`, `failed`, or
   `skipped-not-enabled`.
5. If sources conflict, prefer the newest sealed personal/operator phase and
   the latest matching evidence.

Good questions:

- What is the current project status?
- What is the current blocker?
- Which phases are completed and sealed?
- What capabilities cannot currently be promised?
- What is the next Codex task?
- Which verification commands must run?
- What is the Knowledge/RAG boundary?
- Why is commercial packaging paused?

## 6. Avoiding Stale Status Mistakes

Do not treat old evidence as current status by default.

Before answering a status question:

- Check the phase number and generated timestamp.
- Check whether newer phases supersede the older framing.
- Separate read-only reports from runtime capability.
- Separate commercial suggestions from current self-use priority.
- Separate preview-only docs from production-ready features.
- Confirm whether a real run was skipped, dry-run, passed, or merely designed.

Examples:

- Phase 236A commercial report is useful context, but Phase 237A and Phase
  238A changed the current priority to self-use operation.
- A dry-run loop proves the bridge shape, not real unattended development.
- Approval-preview records review metadata only; it is not execution
  authorization.
- Local keyword / SQLite / citation preview is not production-grade vector
  RAG or GraphRAG.

## 7. Updating After A Codex Round

After Codex completes one manual round:

1. Save the result to `.codex-handoff/inbox/latest-codex-result.md`.
2. Run `cmd /c pnpm run codex:result:import`.
3. Review the generated review and feedback files.
4. If the result is accepted, run the matching phase verifier.
5. Refresh evidence only after verification passes.
6. Update the knowledge-pack posture by pointing to the new sealed doc and
   evidence, not to unverified handoff text.
7. If the result is rejected or blocked, keep the blocker visible and do not
   describe the result as sealed.

Never update the knowledge pack with:

- plaintext API keys
- unreviewed Codex output
- failed verifier claims
- production-ready wording for preview-only behavior
- real execution claims from dry-run evidence

## 8. Self-use Knowledge Query Checklist

Use this checklist when asking or answering project questions:

- Current project status
- Current blocker
- Completed phase
- Current cannot-promised capability
- Next Codex task
- Required verification commands
- Knowledge/RAG current boundary
- Commercialization paused reason
- Latest sealed evidence path
- Whether the answer relies on sealed fact, preview-only capability,
  commercial advice, or future roadmap

## 9. UI Project Knowledge Pack Prompt

The `/ui` Personal Operator Console should show these prompt areas:

- Project docs
- Evidence
- Codex handoff/review
- Knowledge/RAG usage
- Current-state caution
- Self-use knowledge query checklist

These prompts are read-only guidance. They do not import files automatically
and do not enable production vector retrieval.

Required verification commands for this phase:

```powershell
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

## 10. Phase 239A Boundary

This phase may update:

- `docs/PERSONAL_PROJECT_KNOWLEDGE_PACK.md`
- The preview-only Personal Operator Console section in `/ui`
- `apps/ai-gateway-service/src/entrypoints/verifyPersonalProjectKnowledgePack.js`
- Root and service package scripts for
  `verify:phase239a-personal-project-knowledge-pack`
- Phase 239A evidence generated by the verifier

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
- Do not write real API keys to docs, logs, evidence, UI, handoff, inbox, review, or
  run files

## 11. Final Conclusion

Phase 239A makes the system better at understanding itself. It defines what
belongs in the self-use project knowledge pack, how each source should be
interpreted, which questions it should answer, and how to keep current status
from being confused with older evidence, commercial advice, or future roadmap.

It remains preview-only local knowledge guidance, not a production RAG system.
