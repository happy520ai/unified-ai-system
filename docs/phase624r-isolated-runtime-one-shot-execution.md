# Phase624R Isolated Runtime One-Shot Execution

This phase runs one guarded isolated runtime candidate attempt only when a user confirmation input exists.

Rules:
- selectedProviderId must be `crs`
- maxRequestsPerAttempt=1
- retryLimit=0
- stopOnFirstFailure=true
- sanitize stdout/stderr
- do not expose raw base_url, secret, webhook, or auth.json content
- do not modify `/chat` or `/chat-gateway/execute`
