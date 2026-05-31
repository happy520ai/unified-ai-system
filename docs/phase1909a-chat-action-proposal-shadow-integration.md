# Phase1909A /chat Action Proposal Shadow Integration

Phase1909A lets `/chat` recognize local desktop spreadsheet intent in proposal mode only.

## Feature Flag

- `OWNER_AUTOMATION_CHAT_PROPOSAL_ENABLED=false` by default.

## Behavior

- When the flag is off, `/chat` preserves the existing default behavior.
- When the flag is on and local action intent is detected, `/chat` returns `localActionProposal`.
- It does not execute real desktop actions.
- It does not create files.
- It does not call Providers.
- `/chat-gateway/execute` remains unchanged by default.
