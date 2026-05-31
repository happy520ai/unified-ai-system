# Phase596 Task 2 Relevant File Scope Note

`relevant-files.json` is the default read boundary for repeated Codex usage. It lets the runner inspect the files selected by the context gateway instead of starting with a full repository scan.

Out-of-scope reads are not forbidden forever, but they require a written reason. That keeps context consumption auditable and prevents accidental reads of runtime, secret, or unrelated product areas.

This benchmark records `fullRepoScanFlagged=false` for every task and keeps `/chat`, `/chat-gateway/execute`, provider runtime, `legacy/`, and `PROJECT_CONTEXT.md` outside the task scope.
