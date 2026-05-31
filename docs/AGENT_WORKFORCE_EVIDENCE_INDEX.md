# Agent Workforce Evidence Index

Phase 157A indexes the Agent Workforce Preview evidence from 142A through 156A.
This is an evidence and regression pack only. It does not enable execution.

## Product Capabilities

- 142A: `omxHandoffPreview`
- 143A: `roleTiers`, `eventLedgerPreview`, `workforceHudPreview`
- 144A: `executionReadinessPreflight`
- 145A: `externalOmxRunnerDesign`
- 146A: `runnerRequestQueuePreview`
- 147A: `executionApprovalRecordPreview`
- 148A: `externalRunnerProtocolFreeze`
- 149A: final UX seal
- 150A: acceptance pack
- 151A: stage closure decision
- 152A: demo script and user manual hardening
- 153A: product template pack
- 154A: template acceptance sample plans
- 155A: template export and copy UX
- 156A: guided onboarding and demo dataset

## Disabled Boundaries

- Execution remains disabled.
- External Runner remains disabled.
- Workflow run handoff remains disabled.
- oh-my-codex is not called.
- Worktrees are not created.
- approval-preview is not execution approval.
- Default NVIDIA `/chat` lane is unchanged.

## Evidence Index

- `apps/ai-gateway-service/evidence/phase-142a-workforce-omx-handoff-preview.json`
- `apps/ai-gateway-service/evidence/phase-143a-role-tier-event-ledger.json`
- `apps/ai-gateway-service/evidence/phase-144a-execution-readiness-preflight.json`
- `apps/ai-gateway-service/evidence/phase-145a-external-omx-runner-design.json`
- `apps/ai-gateway-service/evidence/phase-146a-runner-request-review-queue.json`
- `apps/ai-gateway-service/evidence/phase-147a-execution-approval-record.json`
- `apps/ai-gateway-service/evidence/phase-148a-external-runner-protocol-freeze.json`
- `apps/ai-gateway-service/evidence/phase-149a-agent-workforce-preview-final-ux-seal.json`
- `apps/ai-gateway-service/evidence/phase-150a-agent-workforce-preview-acceptance-pack.json`
- `apps/ai-gateway-service/evidence/phase-151a-agent-workforce-stage-closure.json`
- `apps/ai-gateway-service/evidence/phase-152a-agent-workforce-demo-manual.json`
- `apps/ai-gateway-service/evidence/phase-153a-agent-workforce-product-template-pack.json`
- `apps/ai-gateway-service/evidence/phase-154a-template-acceptance-sample-plans.json`
- `apps/ai-gateway-service/evidence/phase-155a-template-export-copy-ux.json`
- `apps/ai-gateway-service/evidence/phase-156a-guided-onboarding-demo-dataset.json`

## Default Verification Commands

```powershell
cmd /c pnpm verify:phase154a-template-acceptance-sample-plans
cmd /c pnpm verify:phase155a-template-export-copy-ux
cmd /c pnpm verify:phase156a-guided-onboarding-demo-dataset
cmd /c pnpm verify:phase157a-agent-workforce-evidence-index
cmd /c pnpm verify:phase153a-agent-workforce-product-template-pack
cmd /c pnpm verify:phase142a-omx-handoff-preview
cmd /c pnpm verify:phase107a-secret-safety
cmd /c pnpm verify:phase105a-user-journey
cmd /c pnpm health:phase12a
cmd /c pnpm doctor:phase13a
cmd /c pnpm -r --if-present check
```
