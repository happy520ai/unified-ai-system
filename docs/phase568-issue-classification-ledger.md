# Phase568 Issue Classification Ledger

## Current Ledger Status

This ledger is based on one real internal tester source:

- testerId: Codex-Internal-Trial-01
- role: 内部产品试用者 / UI理解性审查
- date: 2026-05-08
- method: local temporary service + Chromium screenshots

## Issue Counts

- P0 blocker: 0
- P1 high: 0
- P2 medium: 3
- P3 low: 4

## P0 Blocker

Count: 0

No blocker was reported for:

- secret exposure
- unauthorized provider call
- deploy / release / tag / artifact upload
- billing / invoice activation
- character module reappearance
- `/chat` or `/chat-gateway/execute` damage
- page open failure

## P1 High

Count: 0

No high-severity misunderstanding was reported for:

- real provider already connected
- billing / invoice already enabled
- total inability to understand Normal / God / Tianshu
- Security Shield mistaken as completed production audit
- Evidence Replay mistaken as external upload

## P2 Medium

Count: 3

### P2-1 `three_mode_density_and_repetition`

- Description: Three mode information density is too high, and Normal / God / Tianshu feel repetitive.
- Source: real tester feedback
- Impact: raises first-read understanding cost and weakens mode differentiation

### P2-2 `action_button_copy_execution_anxiety`

- Description: labels such as run mode, test connection, execute approved action, approve, and reject feel too close to real execution and make the tester hesitate.
- Source: real tester feedback
- Impact: creates caution friction and increases misclick anxiety even in dry-run mode

### P2-3 `security_shield_too_internal`

- Description: Security Shield reads like an internal rules checklist rather than a user-view explanation.
- Source: real tester feedback
- Impact: safety intent is visible, but user understanding is less smooth than it could be

## P3 Low

Count: 4

### P3-1 `add_one_line_mode_summary`

- Add one short product sentence for each mode.

### P3-2 `reduce_repeated_guarded_pending_telemetry_copy`

- Reduce repeated guarded / pending / telemetry copy across the three mode area.

### P3-3 `emphasize_tianshu_planner_value`

- Make the planning value of Tianshu easier to notice before the detailed status fields.

### P3-4 `keep_evidence_replay_stable`

- Preserve the current Evidence Replay clarity while tightening nearby copy.

## Boundary

This ledger is classification-only. It does not authorize UI changes, runtime changes, provider calls, secret handling, billing, invoice, deploy, release, tag, or artifact upload.

Required boundary:

- no-provider-call
- no-secret
- no-deploy
- no-billing
- no-invoice
- Yiyi / character remains hidden
