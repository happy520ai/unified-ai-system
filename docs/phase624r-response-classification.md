# Phase624R Response Classification

- pass: exitCode=0 and stdoutSanitized contains `CONTEXT_GATEWAY_MODEL_PROVIDER_OK`
- failed_provider_route: non-zero exit code and not a terminal TTY issue
- failed_tty: stderr contains `stdin is not a terminal`
- timeout: attempt timed out
- invalid_response: no expected ack marker
- blocked_by_missing_confirmation: confirmation input missing
