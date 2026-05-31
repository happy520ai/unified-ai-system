# Phase605R Next One-Shot Execution Options

## Non-Execution Policy

No Phase605R Codex one-shot execution is allowed in this phase.

This file defines candidate routes only. It does not authorize a new request, provider call,
Codex config write, project config write, relay start, deploy, release, tag, push, or commit.

## Candidate Routes

### interactive_terminal_manual_command

Recommended first route.

Use a real interactive terminal controlled by the operator so the Codex CLI has a TTY. The next
phase should provide a copyable command and require explicit confirmation before execution.

Why this is preferred:

- Directly addresses `stdin_is_not_a_terminal`.
- Avoids wrapper behavior that could hide CLI prompts or output.
- Keeps maxRequests and retryLimit easy to audit manually.

### codex_cli_non_interactive_flag_review

Review official/local Codex CLI help or docs for a supported non-interactive mode before trying
another automated one-shot.

This route is preparation-only until the correct non-interactive flag behavior is verified.

### pseudo_terminal_wrapper

Use a pseudo-terminal wrapper only if a manual TTY route is not acceptable.

Risk:

- The wrapper itself becomes part of the execution surface.
- It needs a separate dry-run verifier before any guarded real one-shot.

### prompt_file_or_stdin_safe_route

Prepare prompt-file or stdin-safe input only if Codex CLI supports it without requiring an
interactive stdin.

Risk:

- This may solve shell quoting while still failing if the CLI requires a terminal.

### project_config_preview_route

Keep project config route as preview-only unless a later phase explicitly authorizes temporary
project config handling.

Risk:

- It touches the highest-risk boundary for this line of work.
- It must remain separate from any auth.json access.

## Recommended Next Phase Gate

Recommended next phase:

`Phase606R: Codex CLI TTY-Safe One-Shot Execution Plan`

Minimum required gates:

- explicit user confirmation
- `maxRequests=1`
- `retryLimit=0`
- no auth.json access
- no persistent Codex config write
- selected execution route declared before execution
- evidence preservation rule defined before execution

