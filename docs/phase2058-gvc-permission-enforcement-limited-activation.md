# Phase2058-GVC-Permission-Enforcement-Limited-Activation

## Goal

Phase2058 promotes the Phase2057 permission enforcement dry-run into limited activation before real low-risk mutation.

The permission engine now participates as an additional hard gate before the timed runner calls the low-risk autonomous executor. It cannot grant new authority. It can only block or require approval.

## Real Execution Rule

Real mutation may proceed only when all gates return `allow`:

- existing GVC risk gate
- low-risk executor whitelist validation
- owner approval scope
- permission engine decision

If any gate returns `approval_required`, `deny`, or `forbidden`, the runner blocks before mutation. `forbidden` is the most conservative result.

## Allowed Limited Activation Scope

- docs mutation
- evidence mutation
- verifier mutation
- `tools/gvc` low-risk mutation
- task capsule, ledger, and summary files that already pass the low-risk executor whitelist

## Blocked Scope

- Provider calls
- raw secret, `.env`, `auth.json`, token, or API key reads
- deploy, release, tag, artifact upload, push, or commit
- `/chat` runtime modification
- `/chat-gateway/execute` modification
- credential resolver or provider runtime core modification
- billing or payment surfaces
- `legacy/**`
- `PROJECT_CONTEXT.md`

## Evidence

Each selected runner task writes:

- `apps/ai-gateway-service/evidence/phase2058-gvc-permission-enforcement-limited-activation/gate-<date>-<loop>.json`

The loop evidence records:

- `permissionEnforcementLimitedActivation=true`
- `finalPermissionGate`
- `finalPermissionGateEvidenceRef`
- `realMutationBehaviorChangedByPermissionEngine=false`

## Verification Coverage

The Phase2058 verifier proves:

- docs mutation can pass all gates
- verifier mutation can pass all gates
- permission-engine denial blocks before mutation
- provider task is approval-required
- secret read is forbidden
- deploy command is forbidden
- chat-gateway modification is forbidden
- package script mutation is denied or approval-required unless it is explicitly low-risk allowlisted
- permission allow cannot override existing GVC deny
- existing GVC allow cannot override permission deny

## Non-goals

- No new real mutation path.
- No Provider call.
- No secret read.
- No deploy, release, tag, upload, push, or commit.
- No `/chat` or `/chat-gateway/execute` modification.
- No `legacy/` or `PROJECT_CONTEXT.md` modification.
