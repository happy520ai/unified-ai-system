# Agent Workforce User Handoff Package

This package is for handing the Agent Workforce Preview console to a user or a
team.

## What it can do

- Clarify a goal.
- Select a product template.
- Generate a seven-role Agent Workforce plan.
- Show role tiers, consensus preview, review package, and approval preview.
- Generate an OMX handoff preview as a future task package.
- Export JSON and Markdown handoff artifacts.
- Show execution readiness as blocked and External Runner disabled.

## What it cannot do

- It cannot execute code.
- It cannot call oh-my-codex.
- It cannot create worktrees.
- It cannot dispatch workflow runs.
- It cannot dispatch an external runner.
- It cannot treat approval-preview as execution approval.

## How to start

Run `cmd /c pnpm install`, then `cmd /c pnpm dev:phase7b`, then open `/ui`.

## How to demo

Open Agent Workforce, choose a template, select a demo goal, generate a plan,
review the plan sections, save the plan, view history, and export JSON or
Markdown.

## How to accept

Use `docs/AGENT_WORKFORCE_MANUAL_QA_CHECKLIST.md` and the verification matrix.
Acceptance is for the preview console only.

## How to export plans

Use the JSON export or Markdown copy buttons. Export is handoff only and not
execution.

## How to understand OMX handoff preview

OMX Handoff Preview is a compatible task package preview for a later explicitly
approved external runner line. It does not call OMX CLI, `$team`, or `ralph`.

## Next-stage decision

Choose whether to pause Agent Workforce, continue UI polish, plan real External
Runner Enablement without execution, or run a security review before any real
execution implementation. Execution disabled. External Runner disabled.
