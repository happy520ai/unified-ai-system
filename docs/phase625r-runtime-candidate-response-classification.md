# Phase625R Runtime Candidate Response Classification

## Classification Rules

- dry_run_pass: dry-run gate checks pass with zero request attempt.
- pass: isolated guarded one-shot returns `CONTEXT_GATEWAY_MODEL_PROVIDER_OK`.
- isolated_repeated_pass: three isolated attempts pass with retry count zero.
- blocked_by_candidate_gate: baseline or gate checks fail before candidate execution.
- invalid_response: the isolated one-shot does not include the required marker.
- timeout: a future candidate call exceeds its bounded timeout.

## Non-Claims

`pass` and `isolated_repeated_pass` in this phase describe local isolated candidate behavior only. They do not mean production ready, release ready, default `/chat` ready, provider runtime ready, or real Provider reliability proven.

