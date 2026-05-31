# Agent Workforce Preview Acceptance Pack

## Product Summary

Agent Workforce Preview is an AI team planning, clarification, role assignment, consensus review, approval preview, OMX handoff task package, and external runner protocol preview console; it does not execute code, call oh-my-codex, create worktrees, or dispatch real Agents.

## Ordinary User Path

1. Start the local service with `cmd /c pnpm start:pme`.
2. Open `/ui`.
3. Enter a goal in the Agent Workforce panel.
4. Generate an Agent Workforce plan.
5. Review clarification questions and consensus preview.
6. Review the seven roles and role tiers.
7. Save the plan and inspect history.
8. Open the review package and approval gate preview.
9. Inspect the OMX handoff preview.
10. Confirm execution readiness remains blocked.
11. Confirm external runner design, queue, approval, and protocol freeze remain disabled previews.
12. Export JSON / Markdown for human review.

## Administrator / Developer Verification Path

```powershell
cmd /c pnpm verify:phase150a-agent-workforce-preview-acceptance-pack
cmd /c pnpm verify:phase149a-agent-workforce-preview-final-ux-seal
cmd /c pnpm verify:phase148a-external-runner-protocol-freeze
cmd /c pnpm verify:phase147a-execution-approval-record
cmd /c pnpm verify:phase146a-runner-request-review-queue
cmd /c pnpm verify:phase145a-external-omx-runner-design
cmd /c pnpm verify:phase144a-execution-readiness-preflight
cmd /c pnpm verify:phase143a-role-tier-event-ledger
cmd /c pnpm verify:phase142a-omx-handoff-preview
cmd /c pnpm verify:phase107a-secret-safety
cmd /c pnpm verify:phase105a-user-journey
cmd /c pnpm health:phase12a
cmd /c pnpm doctor:phase13a
cmd /c pnpm -r --if-present check
```

## Completed Capabilities

- `omxHandoffPreview`
- `roleTiers`
- `eventLedgerPreview`
- `hudPreview`
- `executionReadinessPreflight`
- `externalOmxRunnerDesign`
- `runnerRequestQueuePreview`
- `executionApprovalRecordPreview`
- `externalRunnerProtocolFreeze`
- Goal clarification questions.
- Seven-role Agent Workforce plan.
- Role tiers: Strategy, Architecture, Implementation Planning, Quality.
- Planner / Architect / Critic consensus preview.
- Review package preview.
- Human approval gate preview.
- Event ledger preview and HUD preview.
- OMX-compatible handoff preview.
- Execution readiness preflight, blocked by design.
- External OMX runner design, disabled by design.
- Runner request review queue preview, disabled by design.
- Execution approval record preview, disabled by design.
- External runner protocol freeze, preview-only.
- Final UX seal for the preview console.

## Evidence Index

- `apps/ai-gateway-service/evidence/phase-142a-workforce-omx-handoff-preview.json`
- `apps/ai-gateway-service/evidence/phase-143a-role-tier-event-ledger.json`
- `apps/ai-gateway-service/evidence/phase-144a-execution-readiness-preflight.json`
- `apps/ai-gateway-service/evidence/phase-145a-external-omx-runner-design.json`
- `apps/ai-gateway-service/evidence/phase-146a-runner-request-review-queue.json`
- `apps/ai-gateway-service/evidence/phase-147a-execution-approval-record.json`
- `apps/ai-gateway-service/evidence/phase-148a-external-runner-protocol-freeze.json`
- `apps/ai-gateway-service/evidence/phase-149a-agent-workforce-preview-final-ux-seal.json`
- `apps/ai-gateway-service/evidence/phase-107a-secret-safety.json`
- `apps/ai-gateway-service/evidence/phase-105a-user-journey.json`

## User Acceptance Checklist

- [ ] Can open /ui.
- [ ] Can enter a goal and generate an Agent Workforce plan.
- [ ] Can see the 7 preview roles and role tiers.
- [ ] Can see clarification, consensus, and review package previews.
- [ ] Can see approval gate preview.
- [ ] Can see OMX handoff preview.
- [ ] Can see execution readiness preflight blocked.
- [ ] Can see external runner design, queue, approval, and protocol freeze previews.
- [ ] Can save a plan.
- [ ] Can view history.
- [ ] Can export JSON and Markdown.
- [ ] UI clearly shows Execution disabled.
- [ ] UI clearly shows External Runner disabled.

## Boundaries / Non-Goals

- No real Agent execution.
- No oh-my-codex dependency, installation, or CLI call.
- No oh-my-codex runtime call.
- No OMX CLI, `$team`, or `ralph` call.
- No worktree creation.
- No workflow run handoff.
- No real external runner dispatch.
- No default NVIDIA `/chat` main-lane change.
- No default NVIDIA /chat lane change.
- Approval-preview is not execution approval.
- No plaintext API keys in UI, logs, docs, or evidence.

## Known Blockers

- Real execution approval is not implemented.
- Worktree isolation is not implemented.
- Task claim tokens are not implemented.
- External runner dispatch is not implemented.
- Cancellable/resumable execution lifecycle is not implemented.
- Security review is required before any future real execution line.

## Next Decision Point

Decide whether to keep Agent Workforce as a preview console, or start a new explicitly approved real-execution design mainline. Design external runner implementation only with separate security, worktree isolation, task-claim, logging, cancellation, and evidence requirements.
