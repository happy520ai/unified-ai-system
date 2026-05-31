# Codex Dry-run Execution Plan

Phase 260A defines a dry-run execution plan format. It describes what a future
run would need, but does not execute anything.

## 1. Dry-run Execution Plan Definition

A dry-run execution plan is a non-executing plan that lists future steps,
verification, evidence, stop conditions, and blocked actions.

## 2. Inputs

Inputs:

- task classification
- preflight result
- approval-preview record
- allowed files
- blocked files
- required verification
- expected evidence

## 3. Outputs

Outputs:

- ordered plan steps
- verification command list
- expected evidence list
- stop condition
- go/no-go recommendation
- executionEnabled=false

## 4. What It Will Not Execute

The dry-run plan will not execute Codex, shell commands, code changes,
workflow runner calls, worktree creation, commit, push, or PR.

## 5. What Files It Will Not Modify

The dry-run plan will not modify any project files as part of planning. It may
only be documented and verified as preview-only readiness.

## 6. Commit / Push

Do not automatically commit or push. Dry-run planning does not create commits.

## 7. Codex CLI

Do not execute codex command. Do not call real `codex exec`.

## 8. Plan Step Format

```text
stepId:
purpose:
manualAction:
allowedFiles:
blockedFiles:
verification:
expectedEvidence:
stopCondition:
```

## 9. Verification Command Format

```text
cmd /c pnpm run verify:<phase>
cmd /c pnpm -r --if-present check
```

## 10. Evidence Expected Format

```text
disabled safety values:
evidenceJson:
evidenceMd:
status: passed | failed
safety: executionEnabled=false, codexExecInvoked=false
```

## 11. Stop Condition

Stop on failed verification, missing evidence, boundary drift, dirty workspace
overlap, or unclear human approval.

## 12. Dry-run Failure Handling

If dry-run planning fails, do not continue to execution. Record the blocker and
return to preflight.

## 13. UI Prompt

The `/ui` Personal Operator Console should show Dry-run Execution Plan:

- dry-run only
- inputs
- outputs
- no Codex CLI
- verification format
- expected evidence
- stop condition

## 14. Required Verification

```powershell
cmd /c pnpm run verify:phase260a-codex-dry-run-execution-plan
```

## 15. Boundary

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

## 16. Final Conclusion

Phase 260A provides a preview-only dry-run plan format and keeps real execution
disabled.
