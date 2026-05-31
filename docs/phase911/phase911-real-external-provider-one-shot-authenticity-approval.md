# Phase911 Real External Provider One-shot Authenticity Approval

## Goal

Record a non-secret approval packet for exactly one NVIDIA external Provider authenticity call.

## Facts

- providerId=nvidia
- credentialRef=credentialRef:nvidia:default
- maxRequests=1
- maxRetries=0

## Boundaries

- No API key or raw endpoint value is written.
- No default /chat or /chat-gateway/execute mutation is allowed.
- No deploy, release, tag, commit, or push is allowed.

## Outputs

- model-routing/approvals/phase911-real-external-provider-one-shot-authenticity.input.json

## Non-claims

- This is one bounded external Provider authenticity check, not production traffic.
- A failed Provider call is recorded as failed and is not promoted to pass.
- The evidence stores credentialRef names only; it does not store API keys or raw endpoint values.
- Default /chat and /chat-gateway/execute behavior is unchanged.
