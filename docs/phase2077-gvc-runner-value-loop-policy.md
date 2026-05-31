# Phase2077-GVC-Runner-Value-Loop-Policy

## Runner Start Policy

- If `next-actions` are all completed, refresh the high-value planner before starting the runner.
- If high-value candidates are fewer than 3, do not start the runner.
- If `duplicateRiskScore > 3`, do not write that task into `next-actions`.
- If no-op loops reach 2 consecutively, the next run must refresh the planner first.
- Provider candidates remain `approval_required`; secret, deploy, and chat-route tasks remain forbidden.

## Current Decision

- Current blocker: daily_loop_limit_reached.
- Consecutive no-op loops: 0.
- Next formal runner worth starting: true.

## Safety Boundary

- Provider calls made: false.
- Secret read: false.
- Deploy executed: false.
- Chat gateway execute modified: false.
- Legacy modified: false.
- PROJECT_CONTEXT.md modified: false.
- Workspace clean claimed: false.
