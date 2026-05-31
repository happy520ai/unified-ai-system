# Phase608R-Fix Response Classification

## Classification Rules

- `pass`: `exitCode=0`, `stdoutSanitized` contains `CONTEXT_GATEWAY_MODEL_PROVIDER_OK`, and `cleanupCompleted=true`.
- `failed_tty`: `stderrSanitized` contains `stdin is not a terminal`.
- `failed_provider_route`: `exitCode` is non-zero and the stderr is not the known TTY failure.
- `timeout`: the manual result records `timeout=true` or `timedOut=true`.
- `invalid_response`: the command exits successfully but the required acknowledgement is missing.
- `blocked_by_missing_manual_result`: `docs/phase607r-interactive-terminal-result.input.json` is absent.
- `blocked_by_invalid_manual_result`: the input cannot be parsed, fails required field validation, or records a forbidden safety boundary.

## Current Classification

- testStatus=blocked
- responseClassification=blocked_by_missing_manual_result
- blocker=manual_result_input_missing
- requestAttemptCount=0
- retryAttemptCount=0
- selectedProviderId=crs
- cleanupCompleted=false

## Pass Gate

passRequiresContextGatewayAck=true

The manual result cannot pass unless the sanitized stdout contains `CONTEXT_GATEWAY_MODEL_PROVIDER_OK` and the cleanup record is complete.
