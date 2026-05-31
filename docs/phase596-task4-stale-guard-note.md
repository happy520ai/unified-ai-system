# Phase596 Task 4 Stale Guard Note

Before each repeated task, the workflow checks `.codex-context/context-freshness-report.json`. A task may continue only when `stale=false`.

The benchmark also records a simulated stale scenario. That scenario must block execution and preserve a stale reason so an operator can rebuild the context pack before asking Codex to continue.

This is still a usage workflow guard. It does not connect a real Codex relay and does not modify Codex base_url.
