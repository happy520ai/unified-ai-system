# Phase647R External Tool Task Queue State Ledger

Phase647R defines a task queue ledger for the external Codex tool so work is not duplicated, skipped, or run outside the approved safety boundary.

## States

- pending
- running
- completed
- blocked
- skipped
- needs_approval
- failed

## Required Task Fields

- taskId
- title
- riskTier
- status
- allowedFiles
- forbiddenFiles
- validationCommands
- evidencePath
- blocker
- rollbackNote
- providerCallsAllowed=false
- secretAccessAllowed=false
- chatModificationAllowed=false
- chatGatewayExecuteModificationAllowed=false
- deployAllowed=false
- pushAllowed=false
- commitAllowed=false

## Boundary

High-risk tasks are never auto-executed. They may only produce approval-gate records.
