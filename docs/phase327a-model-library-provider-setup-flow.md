# Phase327A Model Library Provider Setup Flow

## Flow

1. Open Model Library.
2. Choose Provider.
3. Choose credential reference type.
4. Enter credential reference or create encrypted reference.
5. Run schema validation.
6. Run credential reference validation.
7. Run dry-run-without-provider-call validation.
8. Later, after explicit authorization, run guarded availability check.
9. Select available models.
10. Configure fallback chain and mode policy.
11. Save user-scoped provider profile.
12. Record audit trail.

## Current Boundary

Phase327A stops at design and dry-run validation design. It does not perform guarded real call tests or selectable activation.

