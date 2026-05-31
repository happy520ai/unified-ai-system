# Phase614R-Fix Manual Approval Policy

## Approval Rules

- Without a separate Phase, `/chat` integration is not allowed.
- Without a separate Phase, `/chat-gateway/execute` integration is not allowed.
- Without a separate Phase, provider runtime modification is not allowed.
- Any future runtime gate requires a new explicit confirmation.
- repeated_pass must not be automatically upgraded to production ready.
- repeated_pass must not be automatically upgraded to release ready.

## Required Future Approval Packet

A future runtime approval packet must include:

- selectedProviderId.
- route contract.
- exact entrypoint.
- maxRequests policy.
- rollback policy.
- emergency disable policy.
- evidence preservation policy.
- secret and raw endpoint redaction policy.
- explicit confirmation that `/chat` remains unchanged unless a dedicated phase authorizes it.
