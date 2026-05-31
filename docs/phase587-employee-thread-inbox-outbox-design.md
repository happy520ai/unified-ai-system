# Phase587 Employee Thread / Inbox / Outbox Design

## Thread

`EmployeeThread` keeps task communication context:

- task reference
- owner employee
- participants
- status
- risk level
- evidence timeline

Thread statuses are `open`, `waiting_for_reply`, `under_review`, `blocked`,
`completed`, and `rejected`.

## Inbox / Outbox

The internal inbox validates and records received dry-run employee messages.
The internal outbox validates and records outbound dry-run employee messages.

Neither inbox nor outbox sends external IM messages or calls Provider APIs.

## Room

`EmployeeRoom` groups employees into bounded dry-run collaboration rooms. Room
fanout follows Phase576 limits:

- `maxCandidateEmployees=5`
- `maxActiveEmployees=3`
- `maxBrainCalls=0`
- `requireEvidence=true`
- `requireApprovalForProviderCall=true`

