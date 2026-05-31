# Agent Workforce Manual Trial Script

## Purpose

Use this checklist to walk through Agent Workforce Preview from local startup to
handoff export. This is a real UI walkthrough checklist for the preview
console, not a real execution test.

## Install / Start Entry

1. Install dependencies if needed:

```powershell
cmd /c pnpm install
```

2. Start the local service:

```powershell
cmd /c pnpm dev:phase7b
```

3. Optional status and health checks:

```powershell
cmd /c pnpm status:phase10a
cmd /c pnpm run health:phase12a
```

## Phase 197A Agent Workforce Quickstart

1. Open `http://127.0.0.1:3100/ui` after starting the local service.
2. Choose a template in the Agent Workforce Preview panel.
3. Enter one short goal, then click Generate Plan.
4. Review the Plan, Review Package, Approval Preview, and OMX Handoff Preview.
5. Click Save Plan, then use History to reload or inspect the saved preview.
6. Confirm Execution Disabled and External Runner Disabled remain visible.
7. Export JSON or Markdown as a human handoff package.

## UI Walkthrough

1. Open `/ui` in the local browser.
2. Enter the Agent Workforce section.
3. Confirm the banner says Preview only, Execution Disabled, External Runner Disabled, No oh-my-codex call, and No worktree creation.
4. Choose a template, for example Bug Fix Template.
5. Enter a demo goal, for example: `Plan a safe fix for a broken Markdown export button in the web console.`
6. Generate the Plan.
7. Review clarification questions.
8. Review role tiers.
9. Review consensus preview.
10. Review the Review Package.
11. Review Approval Preview and confirm approval-preview is not execution approval.
12. Review OMX Handoff Preview and confirm suggested OMX commands are text only.
13. Review Execution Readiness and confirm it is blocked.
14. Review External Runner Disabled status.
15. Save the Plan.
16. Open history and confirm the saved plan shows plan id, selectedTemplate, createdAt, plan state, and Execution Disabled.
17. Export JSON.
18. Export Markdown.
19. Confirm no code was executed, no OMX CLI was called, and no worktree was created.

## Acceptance Notes

- The trial is accepted only as a preview/manual-trial walkthrough.
- It does not execute code.
- It does not call oh-my-codex or OMX.
- It does not create worktrees.
- It does not connect workflow run.
- It does not dispatch an external runner.
- It does not change the default NVIDIA `/chat` lane.
