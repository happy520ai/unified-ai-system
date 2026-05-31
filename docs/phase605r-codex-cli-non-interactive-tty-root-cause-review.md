# Phase605R Codex CLI Non-Interactive TTY Root Cause Review

## Scope

Phase605R is a root cause review and next-execution preparation phase only.

No Phase605R Codex one-shot execution is allowed in this phase.

## Imported Phase604 First Attempt Facts

The original Phase604M evidence was overwritten by a later BOM-blocked verify run. The first
attempt facts are preserved through:

`apps/ai-gateway-service/evidence/phase604r/final-confirmation-bom-safe-loader-result.json`

Imported first-attempt facts:

- `negativeControlPassed=true`
- `modelProviderOverrideHonored=true`
- `oneShotExecuted=true`
- `requestAttemptCount=1`
- `retryAttemptCount=0`
- `testStatus=failed`
- `responseClassification=invalid_response`
- `blocker=custom_provider_one_shot_failed`
- `rootCause=stdin_is_not_a_terminal`

## Root Cause

The Phase604 custom model_provider one-shot reached the Codex CLI execution boundary, but the
process failed before producing the required one-line acknowledgement because stdin was not a
terminal.

Root cause classification:

`codex_cli_non_interactive_stdin_tty_requirement`

This means the failure is currently attributed to the way the Codex CLI was invoked from a
non-interactive verification process, not to proof that the custom model_provider route itself
failed at the provider/relay layer.

## Safety Boundary

- `authJsonRead=false`
- `authJsonTouched=false`
- `codexConfigModified=false`
- `userCodexConfigModified=false`
- `projectCodexConfigModified=false`
- `providerCallsMade=false`
- `chatModified=false`
- `chatGatewayExecuteModified=false`
- `deployExecuted=false`
- `releaseExecuted=false`
- `tagCreated=false`
- `pushExecuted=false`
- `commitCreated=false`
- `workspaceCleanClaimed=false`

## Current Conclusion

The model_provider override evidence remains preserved as a first-attempt observation, but the
next real one-shot should not be run from the same non-interactive stdin path. The next phase
should select a TTY-safe execution route before any additional request is allowed.

