# Phase327A User-Owned API Key Configuration Loop Design

## Goal

Phase327A designs the closed loop for users to configure their own Provider API keys in Model Library.

This phase is design-only.

- no real key is stored
- no real key is read
- no non-NVIDIA provider is called
- no provider runtime is enabled

## Configuration Loop

1. User enters Model Library.
2. User selects Provider.
3. User enters or references an API Key.
4. System stores only credentialRef, encrypted reference, or vault reference.
5. System forbids plaintext secret storage.
6. System performs dry-run validation.
7. System performs provider availability check in a later authorized stage.
8. User selects available models.
9. Models enter the user's own selectableModels after validation.
10. User configures fallback chain.
11. User configures mode policy.
12. User can revoke credentialRef.
13. User can disable provider.
14. System records audit trail.
15. System supports rollback, revoke, and key rotation.

## Product Boundary

- platform does not provide production Provider keys by default
- user may only call providers they authorize
- platform must not bypass user configuration
- each user has independent selectableModels
- each user has independent fallback chain
- each user has independent mode policy
- God Mode and Tianshu Mode must use user-authorized models only

