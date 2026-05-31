# Phase327C Provider Setup Dry-run Report

## Setup Flow

1. Load provider setup dry-run scenarios.
2. Validate schema and credentialRef-only shadow_config rules.
3. Simulate credentialRef validation and provider enablement decisions.
4. Simulate model library visibility decisions.
5. Keep selectable activation blocked because this is not a real validation phase.

## Provider Enablement Gate

- provider runtime remains disabled
- real provider calls remain blocked
- provider entries may exist only as shadow_config candidates

## CredentialRef Validation

- credentialRef is required
- secret value input is rejected
- revoked credentialRef is rejected

## Secret Value Rejection

Any scenario with `secretValueProvided=true` is rejected before provider enablement. The dry-run never reads or stores the secret.

## Why Selectable Activation Is Blocked

- Phase327C is `dry_run_without_provider_call`
- there is no guarded real call authorization
- there is no validated runtime provider setup

## Preconditions For Guarded Real Call Test

- explicit user approval
- secret storage implementation with redaction
- provider validation runtime
- audit and rollback chain

## Rollback

- remove Phase327C docs and tool files
- no runtime rollback is needed because no provider call or secret storage happened

