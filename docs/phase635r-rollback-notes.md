# Phase635R Rollback Notes

rollbackNotesGenerated=true

## Rollback Plan

- For the Phase632 template/checklist repair, restore the previous document body if a downstream doc snapshot requires it.
- For the package alias, remove only `verify:phase632a-g-token-saving-mandatory-gate-chain` if naming policy changes.

## Forbidden Rollback Methods

- no git reset --hard
- no git clean
- no evidence deletion
- no auth.json access
- no Codex config write
- keep `/chat` unchanged
- keep `/chat-gateway/execute` unchanged
