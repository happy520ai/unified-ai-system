# Phase609R-Fix Codex Exec Non-Interactive One-Shot Preparation

## Scope

This phase prepares the next non-interactive guarded one-shot package using official `codex exec`.

This phase does not execute the one-shot.

## Why This Route

Phase604 preserved the first real one-shot attempt and recorded:

- firstOneShotStatus=failed
- firstOneShotRootCause=stdin_is_not_a_terminal

The preserved error was `stdin is not a terminal`. The previous non-interactive shell invocation hit a TTY boundary. The next route should use `codex exec`, which is designed for non-interactive execution.

## Manual Result Boundary

`docs/phase607r-interactive-terminal-result.input.json` must not be fabricated by Codex.

If a result input is needed later, it must be produced only from a real execution result and must contain sanitized stdout/stderr only.

## Execution Policy

- maxRequests=1
- retryLimit=0
- codexOneShotExecutedByThisPhase=false
- providerCallsMadeByThisPhase=false
- authJsonRead=false
- codexConfigModified=false
- projectCodexConfigModified=false
- secretValueExposed=false
- rawBaseUrlValueExposed=false
- chatModified=false
- chatGatewayExecuteModified=false
- deployExecuted=false
- releaseExecuted=false
- tagCreated=false
- pushExecuted=false
- commitCreated=false
- workspaceCleanClaimed=false

## Next Step

Use `docs/phase609r-codex-exec-command-preview.md` only after an explicit future confirmation phase authorizes the real `codex exec` one-shot.
