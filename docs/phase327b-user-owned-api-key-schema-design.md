# Phase327B User-owned API Key Schema Design

## Goal

Phase327B hardens the schema and shadow_config boundary for user-owned provider credentials.

## Key Rules

- only credentialRef / encryptedReference / vaultReference / envKeyName abstractions are allowed
- secretValue is not a storable field
- realCallsAllowed=false
- governanceStage=shadow_config
- nonNvidiaProviderCallsAllowed=false
- no real secret vault is implemented in this phase
