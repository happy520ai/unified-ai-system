# Phase646R External Tool Operator Routine

This routine keeps the external Codex tool useful for daily work without turning it into a Provider runtime or production traffic path.

## Morning Start

1. Run Phase632 preflight.
2. Read `docs/phase632-codex-token-saving-task-template.md`.
3. Read `.codex-context/current-context-pack.md`.
4. Use `.codex-context/relevant-files.json` as the default file scope.
5. Stop if freshness is stale.
6. Keep each manual batch to 6 tasks or fewer.

## Nightly Review

- Use low/medium-safe tasks only.
- Keep high-risk work approval-gate only.
- Keep nightly batch size to 8 tasks or fewer.
- Use fallback/manual launcher if Task Scheduler remains unavailable.

## Do Not Do

- Do not run `codex exec` from this daily routine.
- Do not call Providers.
- Do not read secrets, auth.json, webhooks, or raw base_url values.
- Do not modify Codex config.
- Do not modify `/chat`, `/chat-gateway/execute`, or provider runtime.
- Do not deploy, release, tag, push, or commit.
