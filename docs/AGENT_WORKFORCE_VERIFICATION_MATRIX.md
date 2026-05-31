# Agent Workforce Verification Matrix

This matrix covers the Agent Workforce Preview baseline from 142A through
170A and the product experience hardening line through 180A. Each command is a
preview/evidence check only. It does not execute real Agents, does not call
oh-my-codex, does not create worktrees, and does not dispatch an external
runner.

## Baseline Verification

- `cmd /c pnpm run verify:phase142a-omx-handoff-preview` validates `phase-142a-workforce-omx-handoff-preview`.
- `cmd /c pnpm run verify:phase143a-role-tier-event-ledger` validates `phase-143a-role-tier-event-ledger`.
- `cmd /c pnpm run verify:phase144a-execution-readiness-preflight` validates `phase-144a-execution-readiness-preflight`.
- `cmd /c pnpm run verify:phase145a-external-omx-runner-design` validates `phase-145a-external-omx-runner-design`.
- `cmd /c pnpm run verify:phase146a-runner-request-review-queue` validates `phase-146a-runner-request-review-queue`.
- `cmd /c pnpm run verify:phase147a-execution-approval-record` validates `phase-147a-execution-approval-record`.
- `cmd /c pnpm run verify:phase148a-external-runner-protocol-freeze` validates `phase-148a-external-runner-protocol-freeze`.
- `cmd /c pnpm run verify:phase149a-agent-workforce-preview-final-ux-seal` validates `phase-149a-agent-workforce-preview-final-ux-seal`.
- `cmd /c pnpm run verify:phase150a-agent-workforce-preview-acceptance-pack` validates `phase-150a-agent-workforce-preview-acceptance-pack`.
- `cmd /c pnpm run verify:phase151a-agent-workforce-stage-closure` validates `phase-151a-agent-workforce-stage-closure`.
- `cmd /c pnpm run verify:phase152a-agent-workforce-demo-manual` validates `phase-152a-agent-workforce-demo-manual`.
- `cmd /c pnpm run verify:phase153a-agent-workforce-product-template-pack` validates `phase-153a-agent-workforce-product-template-pack`.
- `cmd /c pnpm run verify:phase154a-template-acceptance-sample-plans` validates `phase-154a-template-acceptance-sample-plans`.
- `cmd /c pnpm run verify:phase155a-template-export-copy-ux` validates `phase-155a-template-export-copy-ux`.
- `cmd /c pnpm run verify:phase156a-guided-onboarding-demo-dataset` validates `phase-156a-guided-onboarding-demo-dataset`.
- `cmd /c pnpm run verify:phase157a-agent-workforce-evidence-index` validates `phase-157a-agent-workforce-evidence-index`.
- `cmd /c pnpm run verify:phase158a-product-readiness-known-limits` validates `phase-158a-product-readiness-known-limits`.
- `cmd /c pnpm run verify:phase159a-agent-workforce-preview-rc-seal` validates `phase-159a-agent-workforce-preview-rc-seal`.
- `cmd /c pnpm run verify:phase160a-agent-workforce-final-closure` validates `phase-160a-agent-workforce-final-closure`.

## Experience Hardening Verification

- `cmd /c pnpm run verify:phase161a-ui-information-architecture` checks UI information architecture and preview-only wording.
- `cmd /c pnpm run verify:phase162a-workforce-dashboard-summary-cards` checks read-only dashboard summary cards.
- `cmd /c pnpm run verify:phase163a-template-gallery-ux` checks the template gallery and disabled execution wording.
- `cmd /c pnpm run verify:phase164a-plan-output-readability` checks fixed plan output sections.
- `cmd /c pnpm run verify:phase165a-review-approval-handoff-clarity` checks review, approval, and OMX handoff clarity.
- `cmd /c pnpm run verify:phase166a-saved-plans-history-ux` checks saved plan / history metadata clarity.
- `cmd /c pnpm run verify:phase167a-export-handoff-package-manifest` checks export handoffPackageManifest.
- `cmd /c pnpm run verify:phase168a-guided-demo-mode-polish` checks demo goals and template associations.
- `cmd /c pnpm run verify:phase169a-user-manual-navigation` checks user manual navigation.
- `cmd /c pnpm run verify:phase170a-readme-agents-boundary-sync` checks README and AGENTS boundary sync.
- `cmd /c pnpm run verify:phase171a-verification-matrix` checks this matrix.
- `cmd /c pnpm run verify:agent-workforce-preview-baseline` is a read-only aggregate preview/evidence check. It does not execute real Agents and does not call oh-my-codex.

## Closure Verification

- `cmd /c pnpm run verify:phase172a-local-operator-runbook`
- `cmd /c pnpm run verify:phase173a-manual-qa-checklist`
- `cmd /c pnpm run verify:phase174a-evidence-manifest-final`
- `cmd /c pnpm run verify:phase175a-agent-workforce-preview-rc2-seal`
- `cmd /c pnpm run verify:phase176a-install-start-use-path`
- `cmd /c pnpm run verify:phase177a-documentation-crosslink-index`
- `cmd /c pnpm run verify:phase178a-user-handoff-package`
- `cmd /c pnpm run verify:phase179a-full-preview-regression-sweep`
- `cmd /c pnpm run verify:phase180a-final-product-decision-gate`

Execution remains disabled. External Runner remains disabled. Workflow run
handoff remains disabled.
