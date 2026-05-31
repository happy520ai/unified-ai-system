# Agent Workforce Preview RC Seal

Phase 159A seals the current Agent Workforce Preview as a release-candidate
preview baseline. This is not production execution readiness and not a runner
implementation.

## RC Baseline Coverage

- Goal clarification
- Role planning and role tiers
- Consensus review
- Review package
- Approval preview
- OMX handoff preview
- Execution readiness preflight
- External runner design preview
- Request queue preview
- Approval record preview
- Protocol freeze
- Product template pack
- Template sample plans and acceptance samples
- Export and copy handoff UX
- Guided onboarding and demo goals
- Evidence index and regression pack

## Verification Matrix

- `cmd /c pnpm verify:phase159a-agent-workforce-preview-rc-seal`
- `cmd /c pnpm verify:phase158a-product-readiness-known-limits`
- `cmd /c pnpm verify:phase157a-agent-workforce-evidence-index`
- `cmd /c pnpm verify:phase156a-guided-onboarding-demo-dataset`
- `cmd /c pnpm verify:phase155a-template-export-copy-ux`
- `cmd /c pnpm verify:phase154a-template-acceptance-sample-plans`
- `cmd /c pnpm verify:phase153a-agent-workforce-product-template-pack`

## Blocked Execution Matrix

- real Agent execution: disabled
- oh-my-codex calls: disabled
- worktree creation: disabled
- workflow run handoff: disabled
- external runner dispatch: disabled
- approval-preview as execution approval: disabled
- default NVIDIA `/chat` lane changes: disabled

## No-Go Conditions

- Do not describe this RC as production-ready execution.
- Do not describe the external runner as implemented.
- Do not call oh-my-codex, `$deep-interview`, `$ralplan`, `$team`, or `ralph`.
- Do not create worktrees.
- Do not run suggested OMX commands.
- Do not write plaintext API keys to UI, logs, docs, or evidence.

## RC Conclusion

Agent Workforce Preview can be treated as a preview product release-candidate
baseline only. It remains a planning, handoff, export, and evidence surface.
