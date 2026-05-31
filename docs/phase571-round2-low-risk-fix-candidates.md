# Phase571 Round 2 Low-Risk Fix Candidates

## Candidate Status

Round 2 does not justify immediate UI changes in this phase. It identifies follow-up candidates for a later copy-only phase after more human feedback is collected.

## Candidates

### 1. Reduce status density in Three Mode

Possible later repair:

- collapse secondary pending / telemetry fields behind a details affordance
- keep the one-line summaries visible
- preserve dry-run and credentialRef boundaries

### 2. Run a focused approval-item copy check

Possible later trial:

- create a dry-run approval item
- confirm `批准此 dry-run 候选`
- confirm `拒绝此 dry-run 候选`
- confirm `预览已批准动作说明`
- ensure no real action is implied

### 3. Group Security Shield by user outcome

Possible later repair:

- protect prompts
- protect secrets
- block provider bypass
- block dangerous actions
- control quota / budget risk

### 4. Collect more human trial responses

Before any larger copy/layout change, collect feedback from at least two non-Codex internal users.

## Not Allowed Here

- provider call
- secret entry or storage
- billing / invoice
- deploy / release / tag / artifact upload
- character restoration
- `/chat` or `/chat-gateway/execute` changes
- provider runtime changes
- selectable gate changes

Boundary remains:

- no-provider-call
- no-secret
- no-deploy
- no-billing
- no-invoice
- Yiyi / character remains hidden
