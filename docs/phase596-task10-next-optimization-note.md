# Phase596 Task 10 Next Optimization Note

The next optimization is Phase597 controlled base URL integration design. That phase should remain design-only until an explicit authorization gate exists for any real Codex base_url or relay configuration.

Before any real integration, the design must answer isolation from the main AI Gateway runtime, token budget enforcement, rate limits, account pool policy, cache miss behavior, stale context rebuild flow, audit evidence, and rollback.

Phase596 does not perform that integration. It only proves repeated `.codex-context` usage can reduce context and avoid default full repository scans.
