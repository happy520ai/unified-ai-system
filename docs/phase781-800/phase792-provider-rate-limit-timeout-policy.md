# Phase792 Provider Rate-limit / Timeout Policy

## Goal

建立 rate-limit / timeout policy。

## Verified facts

- maxDiscoveryRequests=3
- maxSmokeRequests=5
- timeoutMs=30000

## Boundaries

- maxRetries=0
- stopOnRateLimit=true

## Outputs

- rateLimitTimeoutPolicyReady=true

## Non-claims

- This phase does not read or print API keys, secrets, webhooks, auth.json, or raw base_url values.
- This phase does not bypass CredentialRef.
- This phase does not automatically add selectable models.
- This phase does not change default /chat or /chat-gateway/execute behavior.
- This phase does not deploy, release, tag, upload artifacts, push, or commit.
