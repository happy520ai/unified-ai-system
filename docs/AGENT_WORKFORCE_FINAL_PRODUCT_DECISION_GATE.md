# Agent Workforce Final Product Decision Gate

Phase 180A is the final product decision gate for the current Agent Workforce
Preview hardening batch.

## Current final state

Agent Workforce Preview remains a preview product baseline. It is a planning,
clarification, role, review, approval-preview, OMX handoff preview, template,
export, documentation, and evidence console.

## Completed capabilities

- UI information architecture polish.
- Dashboard summary cards.
- Template gallery UX.
- Plan output readability.
- Review / approval / handoff clarity.
- Saved plan and history UX.
- Export handoff package manifest.
- Guided demo mode.
- User manual navigation.
- README / AGENTS boundary sync.
- Verification matrix.
- Local operator runbook.
- Manual QA checklist.
- Evidence manifest final pack.
- RC2 seal.
- Install / start / use path final check.
- Documentation cross-link index.
- User handoff package.
- Full preview regression sweep.

## Completed documentation

- `docs/USER_MANUAL.md`
- `docs/AGENT_WORKFORCE_DEMO_SCRIPT.md`
- `docs/AGENT_WORKFORCE_PREVIEW_ACCEPTANCE_PACK.md`
- `docs/AGENT_WORKFORCE_PREVIEW_STAGE_CLOSURE_DECISION.md`
- `docs/AGENT_WORKFORCE_EVIDENCE_INDEX.md`
- `docs/AGENT_WORKFORCE_VERIFICATION_MATRIX.md`
- `docs/AGENT_WORKFORCE_LOCAL_OPERATOR_RUNBOOK.md`
- `docs/AGENT_WORKFORCE_MANUAL_QA_CHECKLIST.md`
- `docs/AGENT_WORKFORCE_EVIDENCE_MANIFEST_FINAL.md`
- `docs/AGENT_WORKFORCE_PREVIEW_RC_SEAL.md`
- `docs/AGENT_WORKFORCE_PREVIEW_RC2_SEAL.md`
- `docs/AGENT_WORKFORCE_DOC_INDEX.md`
- `docs/AGENT_WORKFORCE_USER_HANDOFF_PACKAGE.md`
- `docs/AGENT_WORKFORCE_FINAL_CLOSURE_SNAPSHOT.md`

## Completed evidence

Evidence is recorded under `apps/ai-gateway-service/evidence/` for phases
142A through 180A after the verification sweep completes.

## Current blocker

none.

## No real execution boundary

No real Agent execution, no oh-my-codex call, no worktree creation, no workflow
run handoff, no real external runner dispatch, no approval-preview as execution
approval, and no default NVIDIA `/chat` lane change.

## Next-stage options

- Option A: pause Agent Workforce and switch to another mainline.
- Option B: continue UI/experience micro-polish.
- Option C: real External Runner Enablement Planning, still without execution.
- Option D: security review before real execution implementation; do not enter
  by default.

Recommended default route: do not automatically enter real execution. Keep the
preview-only baseline unless the user explicitly approves a new real execution
planning line.
