# Phase607R-Fix Response Classification

## Input

The classifier reads only the sanitized manual result input from:

- `docs/phase607r-interactive-terminal-result.input.json`

It strips a UTF-8 BOM before JSON parsing. If the file is missing, it returns `blocked_by_missing_manual_result`.

## Classification Rules

- `pass`: `exitCode=0` and `stdoutSanitized` contains `CONTEXT_GATEWAY_MODEL_PROVIDER_OK`.
- `pass_with_notes`: `exitCode=0`, the required ack is present, and sanitized output contains a non-fatal warning.
- `failed_provider_route`: `exitCode` is non-zero and the failure is not the known TTY failure.
- `failed_tty`: `stderrSanitized` contains `stdin is not a terminal`.
- `timeout`: manual result explicitly records timeout.
- `invalid_response`: the target ack is missing or a safety boundary is violated.
- `blocked_by_missing_manual_result`: the real input file does not exist.
- `blocked_by_invalid_manual_result`: the real input file exists but cannot be parsed.

## Pass Gate

Passing requires all of the following:

- `passRequiresContextGatewayAck=true`
- `CONTEXT_GATEWAY_MODEL_PROVIDER_OK` appears in sanitized stdout.
- `cleanupCompleted=true`
- `rollbackNeeded=false`
- `authJsonAccessed=false`
- `codexConfigModified=false`
- `projectCodexConfigModified=false`
- no raw base URL, secret, or webhook value is included.

## Current Classification

Current state is expected to classify as:

- `blocker=manual_result_input_missing`
- `testStatus=blocked`
- `responseClassification=blocked_by_missing_manual_result`
- `codexOneShotExecutedByThisPhase=false`
