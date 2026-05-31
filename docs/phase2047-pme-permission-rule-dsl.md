# Phase2047 PME Permission Rule DSL

Phase2047 defines a PME-owned permission rule DSL inspired only by architecture patterns, not copied source. It models `allow`, `deny`, `approval_required`, and `forbidden` for file mutation, shell command, provider call, secret read, deploy, and chat route modification.

The implementation lives in `packages/gvc-permission-engine/src/permissionRuleEngine.js`. It is local and deterministic. It does not call Providers, read secrets, execute Claude Code, or modify `/chat` or `/chat-gateway/execute`.
