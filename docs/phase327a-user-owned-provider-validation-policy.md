# Phase327A User-Owned Provider Validation Policy

## Validation Stages

1. schema_validation
2. credential_reference_validation
3. secret_safety_scan
4. provider_enablement_policy_check
5. dry_run_without_provider_call
6. user_confirmed_availability_check
7. guarded_real_call_test
8. selectable_activation
9. monitoring
10. rollback

## Current Phase Limit

Phase327A may only define:

- schema_validation
- credential_reference_validation design
- dry_run_without_provider_call design

Phase327A must not enter:

- guarded_real_call_test
- selectable_activation
- production_enablement

