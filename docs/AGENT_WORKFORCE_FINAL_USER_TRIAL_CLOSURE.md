# Agent Workforce Final User Trial Closure

## Trial Scope

Phase 191A-194A closes a manual trial path for Agent Workforce Preview. The
scope is documentation, a real UI walkthrough checklist, user feedback capture,
small UX wording fixes, validation entrypoints, and evidence.

## Walkthrough Path

The manual trial path is documented in `docs/AGENT_WORKFORCE_MANUAL_TRIAL_SCRIPT.md`.
It covers local startup, `/ui`, Agent Workforce entry, preview-only banner,
template selection, demo goal, Plan generation, clarification questions, role
tiers, consensus preview, Review Package, Approval Preview, OMX Handoff
Preview, Execution Readiness blocked, External Runner Disabled, save, history,
JSON export, Markdown export, and final no-execution confirmation.

## Feedback Template

The feedback capture template is documented in
`docs/AGENT_WORKFORCE_USER_FEEDBACK_TEMPLATE.md`. It records trial person,
date, scenario, template, goal, preview-only understanding, Execution Disabled
understanding, approval-preview boundary, OMX handoff package boundary, UI
issues, export issues, acceptance conclusion, and follow-up suggestions.

## Small UX Fix Result

The UI now includes a Phase193A manual trial quick path helper. It guides users
through choosing a template, using a demo goal, generating a Plan, saving,
checking history, exporting JSON / Markdown, and confirming no code execution,
no OMX call, no worktree creation, no workflow run, and no external runner
dispatch.

## Current Acceptable Conclusion

Agent Workforce Preview is acceptable as a preview-only manual trial baseline.
It is suitable for planning, role review, handoff package review, saved-plan
history, and export walkthroughs. It is not a production release and not a real execution release.

## Phase 199A Real UI Trial Runtime Sync

Phase 199A resolved the live trial blocker as runtime drift from an old managed
service process. After stopping the old process and restarting the current code,
the real browser UI trial passed against `http://127.0.0.1:3100/ui`.

The real browser trial used Edge headless automation and completed template
selection, goal entry, Plan generation, Save Plan, History refresh, current JSON
export, history JSON export, and history Markdown export. The refreshed evidence
records `status=passed-browser-ui-trial`, `planId=wfp_03252c967de0`, and
`workforceId=wf_fb1b7f002829`.

This is a runtime sync and evidence update only. It does not add execution
capability, call oh-my-codex or OMX CLI, create worktrees, connect workflow run,
dispatch an external runner, or change the default NVIDIA `/chat` lane.

## Current Blocker

none

## No Real Execution Boundary

- No real Agent execution.
- No oh-my-codex call.
- No OMX CLI call.
- No worktree creation.
- No workflow run connection.
- No real external runner dispatch.
- No default NVIDIA `/chat` lane change.
- Approval-preview is not execution approval.

## Next Options

- Option A: Pause Agent Workforce and switch to another mainline.
- Option B: Continue lightweight UI / documentation iteration.
- Option C: Plan real External Runner Enablement, but still do not execute.
- Option D: Enter pre-real-execution security review, not by default.

## Recommended Default Route

Keep the preview-only baseline. Do not enter real External Runner or
oh-my-codex execution implementation unless the user explicitly approves a new
mainline.
