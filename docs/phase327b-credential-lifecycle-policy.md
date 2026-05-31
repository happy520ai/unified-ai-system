# Phase327B Credential Lifecycle Policy

## Credential Lifecycle

1. draft
2. reference_created
3. pending_validation
4. dry_run_validated
5. guarded_real_call_pending
6. active
7. rotation_required
8. revoked
9. disabled
10. deleted

## Phase327B Coverage

Phase327B only covers:

- draft
- reference_created shadow_config
- pending_validation design
- dry_run_validated design

Phase327B does not enter:

- guarded_real_call_pending runtime
- active runtime
- production provider enablement
