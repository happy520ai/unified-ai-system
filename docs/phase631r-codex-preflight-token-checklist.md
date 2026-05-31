# Phase631R-Fix Codex Preflight Token Checklist

Before any future Codex task execution, verify:

- .codex-context/current-context-pack.md exists
- .codex-context/relevant-files.json exists
- .codex-context/context-freshness-report.json exists
- stale=false
- relevantFiles count <= hard limit
- task scope explicit
- forbidden full repo scan instruction present
- output budget defined
- allowedFiles listed for any edit task
- secret, auth.json, webhook, and raw base_url reads forbidden

If any required check fails, stop before execution and write a blocker instead of expanding scope.
