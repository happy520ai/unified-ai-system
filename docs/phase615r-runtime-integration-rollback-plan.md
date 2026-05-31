# Phase615R-Fix Runtime Integration Rollback Plan

## Rules

- no git reset --hard.
- no git clean.
- preserve evidence.
- disable route contract.
- restore preview-only mode.
- remove runtime candidate flag if added in future.
- keep `/chat` unchanged.
- keep `/chat-gateway/execute` unchanged.

## Future Candidate Rollback Checklist

- Confirm route contract id.
- Confirm runtime candidate flag location.
- Disable candidate route before more requests.
- Preserve aggregate and attempt evidence.
- Preserve operator approval record.
- Verify no secret values were written.
