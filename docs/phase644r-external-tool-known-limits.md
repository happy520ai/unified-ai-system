# Phase644R External Tool Known Limits

- This is not a production traffic path.
- This is not a release-ready package.
- It does not connect `/chat`.
- It does not connect `/chat-gateway/execute`.
- It does not modify provider runtime.
- It does not write Codex config.
- It does not read auth.json.
- It does not execute `codex exec` by default.
- Token saving is estimated from context-pack size, not a real billing claim.
- Task Scheduler registration is separate and remains manual/permissioned.
