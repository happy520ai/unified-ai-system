# Phase596 Task 1 Context Pack Usage Note

Codex Context Gateway uses `.codex-context/current-context-pack.md` as the first task context document. The pack is a generated sub-gateway artifact, not a model response and not a Provider execution result.

The repeated usage flow is: read the context pack, check `.codex-context/context-freshness-report.json`, load `.codex-context/relevant-files.json`, load `.codex-context/codex-prompt-pack.md`, then plan edits inside the scoped Phase596 files.

Boundary: no Codex config change, no Codex base_url change, no Provider call, no secret read, no `/chat` or `/chat-gateway/execute` change.
