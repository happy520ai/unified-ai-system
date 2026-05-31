# Codex Rollback And Stop Rules

Phase 262A defines stop and rollback rules for a possible future one-shot
result. It does not perform rollback automatically.

## 1. Immediate Stop Conditions

Stop immediately when:

- verification fails
- evidence is missing
- `legacy/` changes
- `PROJECT_CONTEXT.md` is created
- real API key appears
- Codex CLI is called without explicit future authorization
- worktree or workflow runner appears
- commit/push happens

## 2. Result Rejection Conditions

Reject a result when scope, verification, evidence, or boundary review is
missing or inconsistent.

## 3. Rollback Conditions

Rollback may be considered only after human review when changes are unsafe,
outside scope, or unverifiable.

## 4. Dirty Workspace No-auto-rollback Rule

Dirty workspace must not be auto-rolled back. A human must separate user
changes from future task changes.

## 5. legacy/ Changed Rule

If `legacy/` is changed, stop, reject the result, record the path, and require
human recovery.

## 6. PROJECT_CONTEXT.md Created Rule

If `PROJECT_CONTEXT.md` is created, stop, reject the result, and require human
review.

## 7. Secret Exposure Rule

If a secret is exposed, stop immediately, avoid printing the secret, and require
manual secret rotation guidance outside evidence.

## 8. Verification Failure Rule

If verification fails, stop and keep evidence failed. Do not continue sealing.

## 9. Missing Evidence Rule

If evidence is missing, mark blocked and do not claim completion.

## 10. Human Recovery Flow

Human recovery flow:

1. Identify changed files.
2. Separate user changes from task changes.
3. Decide reject, repair, or manual rollback.
4. Re-run verification.
5. Record new evidence only through verifier.

## 11. UI Prompt

The `/ui` Personal Operator Console should show Rollback & Stop Rules:

- immediate stop
- reject result
- rollback requires human
- dirty workspace no auto rollback
- legacy stop
- secret stop
- missing evidence stop

## 12. Required Verification

```powershell
cmd /c pnpm run verify:phase262a-codex-rollback-stop-rules
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

Phase 262A documents stop and rollback rules without enabling automatic
rollback or execution.
