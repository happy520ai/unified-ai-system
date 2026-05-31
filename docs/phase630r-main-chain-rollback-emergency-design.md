# Phase630R-Fix Main Chain Rollback / Emergency Design

## Rollback Design

- disable patch candidate flag
- restore preview-only mode
- preserve evidence
- no git reset --hard
- no git clean
- no evidence deletion
- no auth.json access

## Emergency Disable Design

Future implementation candidates must include an emergency disable control that can block candidate requests without deleting evidence or reading secrets.

## Phase630 State

No runtime patch is applied in Phase630, so rollback remains a design requirement for Phase631R-Fix and later.
