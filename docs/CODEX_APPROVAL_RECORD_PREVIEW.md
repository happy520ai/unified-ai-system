# Codex Approval Record Preview

Phase 259A defines the approval-preview record format. It is review metadata
only and not execution permission.

## 1. approval-preview Definition

approval-preview is a structured record that shows what a human would need to
review before a future one-shot run is considered.

## 2. Why It Is Not Execution Authorization

approval-preview does not enable execution. It must keep executionEnabled=false
and codexExecInvoked=false. It does not call Codex CLI, create worktrees,
connect workflow runner, or permit commit/push.

## 3. Approval Record Fields

```json
{
  "approvalId": "approval-preview-001",
  "requestedTask": "bounded future task",
  "allowedScope": [],
  "blockedScope": ["legacy/", "PROJECT_CONTEXT.md"],
  "allowedFiles": [],
  "blockedFiles": ["legacy/", "PROJECT_CONTEXT.md", ".env"],
  "requiredVerification": [],
  "expectedEvidence": [],
  "stopCondition": "stop on verifier failure or boundary drift",
  "expiresAt": "preview-only",
  "approvedByHuman": false,
  "executionEnabled": false
}
```

## 4. Approval Revocation Rule

Revoke approval-preview when scope changes, evidence fails, dirty workspace
overlaps the task, or the human withdraws review.

## 5. Approval Expiry Rule

approval-preview expires when evidence becomes stale, files change, or the
task boundary changes.

## 6. Preflight Still Required

Even after approval-preview exists, preflight must run again. approval-preview
is not execution authorization. approval-preview is not execution authorization.

## 7. UI Prompt

The `/ui` Personal Operator Console should show Approval Record Preview:

- approval-preview only
- not execution permission
- approval fields
- expiresAt
- executionEnabled=false
- preflight still required

## 8. Required Verification

```powershell
cmd /c pnpm run verify:phase259a-codex-approval-record-preview
```

## 9. Boundary

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

## 10. Final Conclusion

Phase 259A gives the operator a preview-only approval record format while
keeping execution disabled.
