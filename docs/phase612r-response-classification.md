# Phase612R-Fix Response Classification

## Aggregate Classification

- repeatedReliabilityClassification=repeated_pass
- allAttemptsPassed=true
- stoppedReason=null

## Rules Applied

- repeated_pass: 3/3 executed attempts pass with ACK=CONTEXT_GATEWAY_MODEL_PROVIDER_OK
- failed_tty: stderr contains "stdin is not a terminal"
- timeout: an attempt times out
- invalid_response: exitCode=0 without the required ACK
- failed_provider_route: non-zero exit that is not TTY
- skipped_due_to_stop: remaining attempts after stopOnFirstFailure

## Attempt Classification

- attempt-1: pass
- attempt-2: pass
- attempt-3: pass
