# Phase1910A /chat Approval-bound Local Action Execution Gate

Phase1910A defines the local action execution gate for `/chat`.

## Feature Flags

- `OWNER_AUTOMATION_CHAT_PROPOSAL_ENABLED=false` by default.
- `OWNER_AUTOMATION_CHAT_REAL_RUN_ENABLED=false` by default.
- `OWNER_AUTOMATION_CHAT_BATCH_ENABLED=false` by default.

## Gate Requirements

Real local execution requires:

- feature flag enabled
- valid owner approval input
- whitelisted action id
- dry-run preview exists
- max count not exceeded
- no overwrite
- no scan
- no reading other files

`/chat` must not execute real desktop actions from a single sentence without this gate.
