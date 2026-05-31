# Phase623R Isolated Runtime Candidate Dry-Run Smoke

This smoke exercises only the isolated runtime candidate path.

Checked:
- isolated route contract loadable
- guarded prompt loadable
- maxRequests policy applied
- rollback policy referenced
- emergency disable policy referenced
- no real codex exec
- no provider call
- no `/chat` modification
- no `/chat-gateway/execute` modification

This is dry-run only and does not touch auth.json or Codex config.
