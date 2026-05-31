# Phase611R-Fix Reliability Classification

## Future Intake Classifications

- `repeated_pass`: 3/3 real attempts pass.
- `partial_pass`: at least 1 real attempt passes, but fewer than 3/3 pass.
- `failed_provider_route`: any attempt has a non-zero exit and is not a known TTY failure.
- `failed_tty`: stderr contains `stdin is not a terminal`.
- `timeout`: any attempt times out before observing the pass marker.
- `invalid_response`: exitCode=0 but the required pass marker is missing.
- `blocked_by_missing_result_input`: no real Phase611R result input exists.
- `blocked_by_invalid_result_input`: result input cannot be parsed or violates safety gates.

## Current Phase Classification

- repeatedReliabilityProven=false
- realReliabilityAttemptsExecuted=false
- resultInputExampleGenerated=true
- exampleNotCountedAsRealResult=true

This phase must not classify as `repeated_pass` because it does not execute any new attempt.
