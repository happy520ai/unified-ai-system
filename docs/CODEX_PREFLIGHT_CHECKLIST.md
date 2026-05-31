# Codex Preflight Checklist

Phase 258A defines the preflight checklist required before any future
single-run Codex readiness decision. It does not execute Codex.

## 1. Workspace State Check

Record workspace root, active service state, and current phase evidence. Do not
describe dirty workspace as clean. Do not describe dirty workspace as clean.

## 2. Git Dirty State Check

Record whether the workspace is dirty. If dirty changes overlap the task, mark
go/no-go as blocked until a human decides.

## 3. legacy/ Change Check

Confirm `legacy/` is not in allowed files and has no intended modifications.

## 4. PROJECT_CONTEXT.md Check

Confirm `PROJECT_CONTEXT.md` is not created, required, or allowed.

## 5. Secret Scan Check

Run or require secret safety validation. Do not write real API keys.

## 6. Allowed Files Check

List exact files that a future task may touch. Broad directories are not enough.

## 7. Blocked Files Check

List blocked files and paths:

- `legacy/`
- `PROJECT_CONTEXT.md`
- real `.env` files
- provider secret files
- release or deployment surfaces unless explicitly requested

## 8. Required Verification Check

List all required verification commands before any future run is considered.

## 9. Expected Evidence Check

List exact evidence paths expected from the future result.

## 10. Rollback / Stop Plan Check

Define when to stop, when to reject the result, and when human rollback review
is required.

## 11. Human Approval Check

approval-preview must be present only as review metadata. It is not execution
authorization.

## 12. Final Go / No-go Output Format

```text
goNoGo: go-preview-only | blocked | forbidden
reason:
allowedFiles:
blockedFiles:
requiredVerification:
expectedEvidence:
stopCondition:
humanApprovalRequired:
executionEnabled=false
codexExecInvoked=false
```

## 13. UI Prompt

The `/ui` Personal Operator Console should show Preflight Checklist:

- workspace status
- git dirty status
- allowed files
- blocked files
- required verification
- expected evidence
- rollback/stop plan
- go/no-go

## 14. Required Verification

```powershell
cmd /c pnpm run verify:phase258a-codex-preflight-checklist
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

Phase 258A defines a preview-only preflight checklist for future one-shot
readiness.
