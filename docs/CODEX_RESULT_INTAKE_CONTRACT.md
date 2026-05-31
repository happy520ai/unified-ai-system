# Codex Result Intake Contract

Phase 261A defines the result intake contract for a possible future one-shot
result. It does not execute Codex.

## 1. Required Codex Result Contents

A future result must include:

- summary
- modified files
- executed commands
- verification results
- evidence paths
- boundary review
- failures or blockers
- A-M summary

## 2. Modified Files Format

```text
modifiedFiles:
- path:
  reason:
  withinAllowedScope: true | false
```

## 3. Executed Commands Format

```text
executedCommands:
- command:
  result: passed | failed | skipped
  reason:
```

## 4. Verification Result Format

```text
verification:
- command:
  status:
  evidence:
```

## 5. Evidence Path Format

Evidence must list JSON and Markdown paths and must not be hand-edited from
failed to passed.

## 6. Boundary Review Format

Boundary review must explicitly answer:

- legacy changed: no
- PROJECT_CONTEXT.md created: no
- codexExecInvoked=false
- workflowRunEnabled=false
- worktreeCreated=false
- autoCommit=false
- autoPush=false

## 7. Failure / Blocked Format

Failed or blocked result must include reason, failed command, missing evidence,
boundary issue, and recommended manual next step.

## 8. A-M Summary Format

Use A-M final summary fields when reporting a future result to the operator.

## 9. Rejecting Incomplete Results

Reject incomplete results when modified files, commands, verification,
evidence, or boundary review are missing.

## 10. Entering Review & Evidence Loop

Accepted result intake must enter the existing Review & Evidence Loop before
any conclusion is treated as sealed.

## 11. UI Prompt

The `/ui` Personal Operator Console should show Result Intake Contract:

- required result fields
- modified files
- executed commands
- verification results
- evidence paths
- boundary review
- reject incomplete result

## 12. Required Verification

```powershell
cmd /c pnpm run verify:phase261a-codex-result-intake-contract
```

## 13. Boundary

This phase must not:

- Modify `legacy/`
- Create `PROJECT_CONTEXT.md`
- Do not add heavy dependencies
- Do not call real `codex exec`
- Do not execute codex command
- Do not create worktrees
- Do not connect workflow runner
- Do not automatically commit or push
- Do not change the default NVIDIA `/chat` mainline
- Do not promise unattended automatic development
- Do not treat approval-preview as execution authorization
- Do not write real API keys
- Do not describe dirty workspace as clean
- Do not describe readiness as execution completed

## 14. Final Conclusion

Phase 261A defines a strict intake contract for future results while keeping
the current system preview-only.
