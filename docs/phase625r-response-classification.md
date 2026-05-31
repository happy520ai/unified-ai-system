# Phase625R Response Classification

- isolated_repeated_pass: 3/3 pass
- isolated_partial_pass: at least one pass, but fewer than 3/3
- failed_provider_route: any non-zero exit code that is not a TTY failure
- failed_tty: stderr contains `stdin is not a terminal`
- timeout: attempt timed out
- invalid_response: expected ACK missing
- blocked_by_missing_confirmation: confirmation input missing
