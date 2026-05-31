# Phase622R Isolated Runtime Candidate Wiring

## Isolated Endpoints

- `GET /runtime-candidate/codex-exec-crs/status`
- `POST /runtime-candidate/codex-exec-crs/dry-run-smoke`
- `POST /runtime-candidate/codex-exec-crs/guarded-one-shot`
- `POST /runtime-candidate/codex-exec-crs/reliability`

## Boundary

- These endpoints are not `/chat`.
- These endpoints are not `/chat-gateway/execute`.
- These endpoints do not call provider adapters.
- These endpoints do not execute `codex exec`.
- These endpoints do not read `~/.codex/auth.json`.
- These endpoints do not write Codex config.

## Runtime Candidate Behavior

The candidate returns local, sanitized marker responses to verify gate, budget, retry, stop, classification, cleanup, and evidence behavior before any future real runtime plan review.

