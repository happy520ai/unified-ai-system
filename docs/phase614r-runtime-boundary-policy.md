# Phase614R-Fix Runtime Boundary Policy

## Request Limits

- maxRequestsDefault=1
- maxRequestsHardLimit=3
- retryLimit=0
- stopOnFirstFailure=true

## Emergency Disable Plan

- Keep preview route disabled for runtime by default.
- If any future runtime gate fails, disable the route before further attempts.
- Stop on failure, timeout, invalid response, secret exposure, auth.json access, Codex config write, `/chat` mutation, `/chat-gateway/execute` mutation, provider runtime mutation, deploy, release, tag, push, or commit.

## Rollback Plan

- This phase does not mutate runtime files.
- Future runtime phases must define file-level rollback before execution.
- Future runtime phases must preserve the last sealed preview evidence before making changes.

## Evidence Preservation Plan

- Preserve sanitized stdout/stderr summaries only.
- Preserve aggregate and ledger evidence.
- Do not preserve raw base_url, API key, secret, webhook, token, or auth.json values.

## Config Boundary

- no persistent Codex config write.
- userCodexConfigModified=false.
- projectCodexConfigModified=false.
