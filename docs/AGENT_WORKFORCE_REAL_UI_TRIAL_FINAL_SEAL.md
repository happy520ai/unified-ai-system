# Agent Workforce Real UI Trial Final Seal

Phase: 200A
Status: sealed
Current blocker: none

## Phase 199A Root Cause

The Phase 199A blocker was runtime drift: the running service/UI was stale and
had not loaded the current Agent Workforce Preview baseline. The issue was not
a missing product baseline and did not require a business-code capability
expansion. Restarting the local service synchronized the runtime with the
current code.

## Real UI Trial Passed After Restart

After the runtime sync, the real browser UI trial passed with status
`passed-browser-ui-trial`. Edge headless opened the real local UI at
`http://127.0.0.1:3100/ui`, generated a real Agent Workforce Plan, saved it,
loaded history, and exported both JSON and Markdown.

## Verified UI Path

1. Open `/ui`.
2. Select a planning template.
3. Input the real trial goal.
4. Generate Plan.
5. Save Plan.
6. Refresh History.
7. Export JSON.
8. Export Markdown.

## Verified API Endpoints

- `GET /health/check`
- `GET /ui`
- `POST /workforce/plan`
- `POST /workforce/plans/save`
- `GET /workforce/plans`
- `GET /workforce/plans/{id}/export`
- `GET /workforce/plans/{id}/export?format=json`

The correct JSON export path is:

```text
/workforce/plans/{id}/export?format=json
```

## Boundaries Kept

- Real Agent execution remains disabled.
- Codex CLI was not called.
- oh-my-codex / OMX CLI / team / ralph were not called.
- Suggested commands were not executed.
- No worktree was created.
- No workflow run was connected.
- No real external runner dispatch was added.
- The default NVIDIA `/chat` lane was not changed.
- approval-preview remains review metadata only and is not execution approval.
- No plaintext API key was written to UI, logs, docs, or evidence.

## Conclusion

Phase 200A seals the Phase 199A real browser UI trial result as final trial
closure evidence. It adds no runtime execution capability.
