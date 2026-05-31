# Phase383R Orchestrator Registry / Prompt Mismatch Remediation

Phase383R fixes the governance mismatch found by Auto Phase Runner after Phase382.

## Remediation

- Phase383 remains reserved for `Phase Orchestrator + Safety Brake`.
- The guarded real provider test is moved to Phase384:
  `Yiyi Guarded Real Provider Test Authorization Gate`.
- Phase384 is high risk, requires human approval, and cannot auto-continue.
- Phase382 closure evidence is not rewritten. The stale next phase is corrected through
  `docs/phase-orchestrator/phase-next-resolution-overrides.json`.
- The safety brake applies the overlay before selecting the next phase.
- The next prompt builder rewrites the prompt on every run, records a content hash, and
  marks high-risk phases as `readyToExecute=false`.
- Auto-next dry-run defaults `maxAutoPhases` to 2 and does not execute Phase384.

## Safety Boundary

- providerCallsMade=false
- nonNvidiaProviderCallsMade=false
- secretValueExposed=false
- rawSecretAccessed=false
- deployExecuted=false
- releaseExecuted=false
- tagCreated=false
- artifactUploaded=false
- billingExecuted=false
- invoiceGenerated=false
- approvalForged=false
- productionGaClaimed=false
- workspaceCleanClaimed=false
