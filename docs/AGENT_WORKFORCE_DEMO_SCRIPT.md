# Agent Workforce Demo Script

## What This Demo Shows

Agent Workforce Preview is an AI team planning console. It helps you break down a goal, assign preview roles, review the plan, and export a task package for humans to inspect.

It does not automatically execute code. It does not call oh-my-codex. It does not create a worktree. It does not change your project files. OMX-related sections are only a future handoff package preview.

## Demo Setup

1. Open PowerShell at the repository root.
2. Start the local system:

```powershell
cmd /c pnpm start:pme
```

3. When startup reports ready, open:

```text
http://127.0.0.1:3100/ui
```

4. Keep this safety line visible during the demo:

```text
Execution disabled. External Runner disabled. OMX handoff is preview-only.
```

## Demo Walkthrough

### 1. Check Setup / Readiness

Open `/ui` and review the setup/readiness area. Confirm the local service, chat, knowledge, and Agent Workforce preview are visible as ready for the local run.

Say this in the demo:

```text
This page confirms the local console is reachable. It is not a production deployment check and it does not call real Agents.
```

### 2. Enter Agent Workforce

Scroll to the Agent Workforce area. Explain it in plain language:

```text
This is an AI team planning control panel. It turns a goal into a reviewable plan with roles, questions, consensus notes, and exportable task packages.
```

### 3. Input A Sample Goal

Use this sample goal:

```text
Improve the onboarding experience for a local AI gateway user so they can start the service, open the UI, generate a Workforce plan, save it, and export review artifacts without enabling execution.
```

### 4. Generate The Plan

Click the generate plan control. Wait for the plan to appear.

Point out:

- The plan is a preview.
- No code was executed.
- No project files were changed.
- No external runner was dispatched.

### 5. Review The 7 Roles And Role Tiers

Show the seven preview roles:

- CEO
- PM
- Architect
- Frontend Engineer
- Backend Engineer
- QA
- Reviewer

Show the role tiers:

- Strategy: CEO, PM
- Architecture: Architect
- Implementation Planning: Frontend Engineer, Backend Engineer
- Quality: QA, Reviewer

Say this in the demo:

```text
These are planning roles only. They are not real workers and they do not execute tasks.
```

### 6. Review Clarification Questions

Show the clarification questions. Explain that they help refine the goal before a human accepts the plan.

Example explanation:

```text
The system asks clarifying questions so the plan is less vague. Answering them changes the preview plan, not the project files.
```

### 7. Review Consensus Preview

Show Planner / Architect / Critic readiness. Explain:

```text
Consensus preview is a planning review. It helps a human see whether the plan is coherent before anything could ever move toward execution.
```

### 8. Review The Review Package

Open or inspect the review package preview. Point out the goal, acceptance criteria, risks, lifecycle state, and review notes.

Say:

```text
This package is for human review. It is not an approval to execute.
```

### 9. Review Approval Gate Preview

Show the approval gate preview. If recording a preview decision, use `approved-preview`, `changes-requested`, or `rejected-preview`.

Say:

```text
Approval-preview is metadata only. It is not real execution approval.
```

### 10. Review OMX Handoff Preview

Show the OMX handoff preview. Explain:

```text
OMX handoff is a future task package preview. It does not call oh-my-codex, team, ralph, or any OMX CLI command.
```

### 11. Review Execution Readiness

Show execution readiness preflight. Confirm it is blocked.

Say:

```text
Execution readiness is blocked by design because real execution would require explicit approval, worktree isolation, task claim tokens, log redaction, cancellation, evidence, and security review.
```

### 12. Review External Runner Sections

Show:

- External runner design preview.
- Runner request review queue preview.
- Execution approval record preview.
- External runner protocol freeze.

Say:

```text
These sections describe future runner rules. The runner is disabled, dispatch is disabled, and no external execution endpoint is active.
```

### 13. Save The Plan

Click Save. Confirm a saved plan appears in history.

Say:

```text
Saving stores the preview plan package for local review. It does not execute the plan.
```

### 14. View History

Open the history area and select the saved item. Confirm the lifecycle and preview fields remain visible.

### 15. Export JSON / Markdown

Export JSON and Markdown. Explain:

```text
Exports are review artifacts. They are meant for people to inspect, share, or archive. They are not scripts and they do not run commands.
```

## Closing Explanation

End with:

```text
Agent Workforce is currently sealed as a preview/design product baseline. It can plan, clarify, assign roles, preview consensus, record approval-preview metadata, prepare OMX handoff preview packages, and show external runner protocol previews. Execution remains disabled, External Runner remains disabled, workflow run remains disabled, worktrees are not created, oh-my-codex is not called, and the default NVIDIA /chat lane is unchanged.
```

## Developer Verification Path

Run:

```powershell
cmd /c pnpm verify:phase152a-agent-workforce-demo-manual
cmd /c pnpm verify:phase151a-agent-workforce-stage-closure
cmd /c pnpm verify:phase150a-agent-workforce-preview-acceptance-pack
cmd /c pnpm verify:phase149a-agent-workforce-preview-final-ux-seal
cmd /c pnpm verify:phase148a-external-runner-protocol-freeze
cmd /c pnpm verify:phase147a-execution-approval-record
cmd /c pnpm verify:phase146a-runner-request-review-queue
cmd /c pnpm verify:phase145a-external-omx-runner-design
cmd /c pnpm verify:phase144a-execution-readiness-preflight
cmd /c pnpm verify:phase143a-role-tier-event-ledger
cmd /c pnpm verify:phase142a-omx-handoff-preview
cmd /c pnpm verify:phase107a-secret-safety
cmd /c pnpm verify:phase105a-user-journey
cmd /c pnpm health:phase12a
cmd /c pnpm doctor:phase13a
cmd /c pnpm -r --if-present check
```
