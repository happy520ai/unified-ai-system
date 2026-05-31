# Unified AI System Full Readthrough Report

Generated for Phase 235A: Unified AI System Full Readthrough Report.

Scope: read current repository state, runtime commands, service/UI code, shared packages, Agent Workforce tools, docs, and evidence. This report does not add product capability and does not enable execution.

## 1. Executive Summary

The current `unified-ai-system` is a local development workbench made of three main pieces: a local AI Gateway service, an Agent Workforce Preview planning surface, and a Codex handoff / feedback file bridge.

It can:

- Start the local service and Web UI at `http://127.0.0.1:3100/ui`.
- Serve `/health/check`, setup readiness, provider/runtime config, chat, knowledge/RAG, workflow, and Agent Workforce preview endpoints.
- Use the default real NVIDIA `/chat` lane when the real provider runtime is configured.
- Generate Agent Workforce preview plans from a goal, including roles, tiers, clarification questions, consensus, review package, approval preview, and exportable handoff packages.
- Save local dev-only plan history and export JSON/Markdown packages.
- Produce a Codex Desktop handoff package for a human to paste manually.
- Import a human-provided Codex result from `.codex-handoff/inbox`, review it, and generate feedback back to `.codex-handoff/outbox`.
- Run dry-run or explicitly gated controlled loop scripts that write evidence without default real execution.

It cannot currently be claimed as:

- A production multi-user system.
- An unattended autonomous execution system.
- A real Agent Workforce execution runtime.
- An oh-my-codex / OMX / team / ralph runner.
- A workflow-run connected execution system.
- Does not apply, merge, commit, or push external changes automatically.

The core value today is controlled local planning and handoff: it turns a product goal into a reviewable plan package, gives the user enough UI and evidence to inspect it, and provides a safe bridge for manual Codex collaboration.

Current blocker summary:

- Baseline runtime blocker: none found in this readthrough. `status:phase10a`, `health:phase12a`, `doctor:phase13a`, and workspace checks passed.
- Workspace cleanliness: not clean. `git status --short` showed many pre-existing modified and untracked files before this Phase 235A report work.
- Real Codex one-shot blocker: real execution remains blocked unless the explicit approval command is used and the safety gate passes. Phase 218A records `skipped-not-enabled`.

## 2. Current Verified Baseline

Baseline commands executed for this readthrough:

- `git status --short`: succeeded and showed a dirty workspace with existing modified and untracked files.
- `cmd /c pnpm run status:phase10a`: succeeded. Phase 9C managed service was running.
- `cmd /c pnpm run health:phase12a`: succeeded. `/health/check` returned HTTP 200 and service status `ready`.
- `cmd /c pnpm run doctor:phase13a`: succeeded and ran workspace checks.
- `cmd /c pnpm -r --if-present check`: succeeded for shared packages, `apps/ai-gateway-service`, and `apps/agent-console`.

Observed runtime baseline:

- Service URL: `http://127.0.0.1:3100`.
- Web UI: `http://127.0.0.1:3100/ui`.
- Health endpoint: `http://127.0.0.1:3100/health/check`.
- Provider mode from health: real provider mode, selected default provider lane is NVIDIA.
- Fallback mode: not verified as active; runtime config showed fallback disabled.
- Current startup state: service can start and was already running under Phase 9C management.

Verified phase and evidence baseline, based on files under `apps/ai-gateway-service/evidence` and the matching docs:

- Phase 142A-160A: Agent Workforce preview foundations are evidenced as passed through phase evidence files such as OMX handoff preview, role tier/event ledger, execution readiness preflight, external runner design, runner queue preview, approval record preview, protocol freeze, UX seal, acceptance pack, stage closure, template pack, evidence index, known limits, RC seal, and final closure.
- Phase 161A-180A: productization and final product decision evidence exists and is marked passed through the final product decision gate.
- Phase 191A-200A: Real UI trial path is evidenced by Phase 199A runtime sync and Phase 200A final seal. Phase 199A status is `passed-browser-ui-trial`, and Phase 200A is `passed`.
- Phase 201A-204A: Codex Desktop handoff pack, manual Codex execution loop, result import review, and safe desktop runner design are documented/evidenced as manual/design-only surfaces.
- Phase 205A-208A: Clipboard handoff trial evidence exists and is passed. It proves local handoff generation and clipboard/outbox behavior, not automatic Codex execution.
- Phase 209A-220A: Codex result inbox, import, feedback outbox, dry-run loop, safety gate, skipped real one-shot when not enabled, policy freeze, and continuous loop closure evidence exists and is passed/skipped honestly as appropriate.
- Phase 221A-224A: system context, next direction, seed prompts, and task queue planning documents/evidence exist as documentation/planning baselines.
- Phase 225A-231A: matching evidence exists under descriptive filenames: auto-save latest plan, goal-to-handoff automation, auto result waiter/importer, one-click manual bridge loop, controlled Codex exec auto loop, desktop fully automated control BAT, and auto-loop documentation.
- Phase 232A: fully automated controlled loop closure evidence exists and is passed. It records the one-click local bridge loop boundary, not unattended autonomous execution.
- Phase 233A: no `phase-233a-*` evidence file was found. The task queue evidence exists as `agent-workforce-next-task-queue.json` and is passed.
- Phase 234A: Codex exec auto-send bridge evidence exists and is passed for dry-run / explicit-gated behavior. It records that Codex was not invoked by default.
- Existing Phase 235A GUI bridge evidence: `phase-235a-codex-desktop-gui-send-bridge.json` exists and is passed for the desktop GUI-send bridge design/dry-run. A separate real attempt file records `blocked-by-environment-review`, not a real GUI send.
- Phase 236A: continuous controlled loop supervisor evidence exists and is passed, using controlled/sample/manual bridge behavior and stop controls.

Agent Workforce Preview status:

- Preview-only planning surface is active.
- Seven deterministic roles are exposed by `/workforce/agents`.
- `/workforce/health` reports deterministic plan preview mode, local dev-only plan store, and disabled project file writes.
- Plan exports include execution-disabled and external-runner-disabled metadata.

Real UI Trial status:

- Phase 199A records a real browser UI trial after restarting stale runtime state.
- It visited `/ui`, generated a plan, saved it, refreshed history, exported JSON and Markdown, and checked disabled execution indicators.
- Phase 200A seals that result and explicitly adds no runtime capability.

Codex bridge status:

- Manual handoff, result inbox, import review, and feedback outbox are implemented as local file bridge scripts.
- Dry-run and explicit-gated paths exist.
- Phase 218A records `skipped-not-enabled` when real `codex exec` permission was absent.
- `where codex` found a Codex executable path on the machine, but this readthrough did not execute Codex.

Controlled loop / auto loop status:

- Local scripts exist for dry-run, one-shot gated Codex exec, desktop GUI send, manual bridge loop, and continuous controlled loop.
- Default mode remains dry-run / manual / disabled.
- Real execution requires explicit user confirmation and safety-gate success.

## 3. High-level Architecture

```text
unified-ai-system
  - apps/ai-gateway-service
  - apps/agent-console
  - packages/shared-contracts
  - packages/shared-sdk
  - packages/shared-config
  - packages/shared-utils
  - tools/phase9c
  - tools/agent-workforce
  - docs
  - apps/ai-gateway-service/evidence
```

`apps/ai-gateway-service` owns the local HTTP service. It contains provider registration, chat execution, health/setup routes, knowledge/RAG services, workflow planning/run endpoints, Agent Workforce preview services, the Web UI, verification entrypoints, and evidence files.

`apps/agent-console` owns the upper-level console package. Its package scripts check the console package and run console-side verification around service chain, error mapping, streaming, and knowledge behavior.

`packages/shared-contracts` owns TypeScript contract surfaces. The Agent Workforce contract includes preview fields such as roles, tiers, clarification, consensus, review package, approval gate, OMX handoff preview, execution readiness, external runner design, queue/approval/protocol preview fields, and disabled-state metadata.

`packages/shared-sdk` owns shared client helpers for calling the service, including Agent Workforce endpoints and export behavior.

`packages/shared-config` owns runtime config loading and safe runtime config projection. It defines default provider selection behavior and the current fixed NVIDIA real-provider lane when the environment enables real provider mode.

`packages/shared-utils` owns implementation-neutral helpers such as envelopes, IDs, and timeout helpers.

`tools/phase9c` owns the managed local dev service lifecycle: start, stop, status, and logs.

`tools/agent-workforce` owns local automation helpers for goal-to-handoff, pull handoff, import result, dry-run/one-shot controlled Codex loop, desktop GUI send, continuous loop, wait/import, and stop controls.

`docs` owns the human-readable project state, user manual, phase closure documents, decision gates, seed prompts, task queue, and this readthrough report.

`apps/ai-gateway-service/evidence` owns machine-readable and Markdown evidence for phase verification.

## 4. Runtime / Startup Model

Default local commands:

- Start service: `cmd /c pnpm run dev:phase7b`.
- Stop service: `cmd /c pnpm run stop:phase9c`.
- Service status: `cmd /c pnpm run status:phase10a`.
- Health check: `cmd /c pnpm run health:phase12a`.
- Doctor check: `cmd /c pnpm run doctor:phase13a`.
- Help: `cmd /c pnpm run help:phase14a`.
- Workspace checks: `cmd /c pnpm -r --if-present check`.

Phase 9C managed startup uses `tools/phase9c/managed-dev.mjs`. It records process state under the user temp directory, starts `apps/ai-gateway-service` and the agent console when needed, waits for `/health/check`, and exposes status/log helpers.

Current service address:

- Base URL: `http://127.0.0.1:3100`.
- UI: `/ui`.
- Health: `/health/check`.

Current service state from this readthrough:

- `status:phase10a`: running.
- `health:phase12a`: ready.
- `doctor:phase13a`: passed.
- `pnpm -r --if-present check`: passed.

The system is currently startable/runnable in the local Phase 9C path. The current blocker is none for ordinary local startup and health. The workspace is not clean, so real controlled Codex execution should remain blocked until explicitly approved and safety-gated.

## 5. AI Gateway Mainline

The default `/chat` mainline remains the NVIDIA fixed lane.

Evidence and code basis:

- `tools/phase9c/managed-dev.mjs` sets the local managed service environment toward real provider mode, fixed route mode, default provider `nvidia`, enabled providers `nvidia`, and service URL `http://127.0.0.1:3100`.
- `packages/shared-config/src/index.js` loads runtime config and preserves fixed provider selection unless fallback is explicitly enabled.
- `apps/ai-gateway-service/src/application/createGatewayApplication.js` registers providers from safe runtime config and runtime credential state.
- `apps/ai-gateway-service/src/core/gatewayService.js` uses fallback only when runtime config enables fallback.
- Live `/config/runtime` during this readthrough showed fixed selection with default provider `nvidia`, default model `nvidia/llama-3.3-nemotron-super-49b-v1`, enabled provider list containing `nvidia`, provider mode `real`, and fallback disabled.

Provider status:

- NVIDIA is the verified default mainline.
- The code has provider abstractions for fake, OpenAI, NVIDIA, and OpenAI-compatible providers.
- A runtime credential provider can appear in `/providers`; during this readthrough a `qianfan` runtime provider was visible in the registry, but default route selection still remained fixed NVIDIA and fallback was disabled.
- Multi-provider code surfaces exist, but a real fallback lane was not verified as active.

Agent Workforce impact:

- Agent Workforce does not modify the default NVIDIA `/chat` lane.
- Agent Workforce preview planning is deterministic metadata generation and is separate from `/chat` provider selection.

## 6. Agent Workforce Product Surface

The Agent Workforce surface starts from a user goal. The UI and API accept a goal and optional template/clarification context, then return a deterministic preview plan.

Core product elements:

- Goal input: free-form product/task goal entered in the Web UI or passed through automation scripts.
- Templates: feature development, bug fix, documentation, code review, release checklist, and research/design study.
- Roles: CEO, PM, Architect, Frontend Engineer, Backend Engineer, QA, Reviewer.
- Role tiers: Strategy, Architecture, Implementation Planning, and Quality.
- Clarification: five required clarification questions around goal, scope, stack, acceptance, and constraints.
- Consensus: Planner, Architect, and Critic previews that summarize tradeoffs and recommendations.
- Review package: preview-only review metadata for human review, risks, checklist, and package readiness.
- Approval preview: records human review/decision metadata only; it is not execution approval.
- Saved plans/history: dev-only local plan store supports save, list, retrieve, delete, and export.
- Export: JSON and Markdown handoff packages are available from the UI/history and `/workforce/plans/:id/export`.
- OMX handoff preview: documents a future-compatible handoff shape and suggested commands as text only.
- Execution readiness preflight: lists future prerequisites, but keeps execution disabled.
- External runner preview: design-only external runner fields with runner disabled.
- Runner queue / approval record / protocol freeze: preview metadata only, no dispatch.
- HUD/state: summarizes plan state, disabled workflow handoff, review package state, approval gate state, and execution-disabled posture.

UI state:

- `apps/ai-gateway-service/src/ui/consolePage.js` includes Agent Workforce controls for template selection, quick path guidance, goal input, plan generation, save/history, exports, review/approval, handoff preview, external runner disabled state, and Codex bridge sections.
- The UI text repeatedly indicates execution disabled, external runner disabled, suggested commands are text only, and approval-preview is not execution approval.

Manual trial state:

- Phase 199A real UI trial generated and saved a plan, refreshed history, exported JSON/Markdown, and verified disabled execution signals.
- Phase 200A sealed the real UI trial without adding runtime execution capability.

## 7. Codex Bridge / Handoff / Feedback Loop

The Codex bridge is a local file bridge around `.codex-handoff`.

Handoff generation:

- `cmd /c pnpm run handoff:codex` calls the local service, reads the latest saved Agent Workforce export, writes `.codex-handoff/latest-codex-handoff.md`, `.codex-handoff/latest-codex-handoff.json`, `.codex-handoff/latest-metadata.json`, and `.codex-handoff/outbox/latest-codex-handoff.md`.
- `cmd /c pnpm run agent:auto:handoff -- -Goal "<goal>"` can generate a plan and produce a handoff package from a goal.

Result inbox:

- `.codex-handoff/inbox/latest-codex-result.md` is the expected human-provided result file.
- `cmd /c pnpm run codex:result:import` imports and reviews that file.
- The importer checks required sections, boundary markers, and secret patterns, then writes review/summary/feedback files.

Feedback outbox:

- `cmd /c pnpm run feedback:codex` exists as the feedback generator path.
- Imported result review can write feedback to `.codex-handoff/outbox/latest-codex-feedback.md`.

Loop scripts:

- `cmd /c pnpm run codex:loop:dry-run` runs the controlled loop in dry-run mode.
- `cmd /c pnpm run codex:loop:once` is the explicit one-shot real Codex exec path, gated by the safety script and explicit permission.
- `cmd /c pnpm run codex:send:dry-run` records a dry-run send summary.
- `cmd /c pnpm run codex:send:once` is an explicit gated Codex exec send path.
- `cmd /c pnpm run codex:desktop:send:dry-run` records a dry-run desktop GUI send.
- `cmd /c pnpm run codex:desktop:send:once` can focus Codex Desktop and send once only when explicitly approved through the script/menu path.
- `cmd /c pnpm run agent:auto:manual-loop` runs a human-in-the-loop bridge.
- `cmd /c pnpm run agent:auto:dry-run` runs the controlled automation in dry-run mode.
- `cmd /c pnpm run agent:auto:codex-once` is a real one-shot path that requires explicit approval and safety-gate success.
- `cmd /c pnpm run agent:auto:continuous` runs the continuous controlled local loop until stopped, but defaults away from real Codex CLI or GUI send.

Verified vs design-only:

- Verified: handoff files, clipboard handoff, result import/review, feedback generation, dry-run loop summaries, skipped real one-shot when not enabled, desktop GUI dry-run, continuous loop supervisor sample/manual behavior.
- Design-only / preview-only: external runner protocol, OMX handoff, runner queue, approval record as execution permission, workflow-run handoff, real multi-agent execution.
- Requires explicit approval: real `codex exec` one-shot, real desktop GUI send, and any path that would dispatch a prompt to Codex instead of writing dry-run evidence.

No evidence in this readthrough shows default real Codex execution. Phase 218A explicitly records `codexExecInvoked: false`.

## 8. Desktop BAT / One-click Automation

Confirmed desktop BAT file:

- `%USERPROFILE%\Desktop\unified-ai-system-全自动闭环.bat`

Readthrough confirmed menu items:

1. Start service and open UI.
2. Enter goal and generate handoff.
3. One-click manual bridge loop.
4. Wait and import Codex result.
5. Controlled dry-run.
6. Real codex one-shot, requires YES.
7. Open `.codex-handoff` folder.
8. Show status.
9. Stop service.
10. Exit.
11. Auto-send handoff to Codex Desktop GUI once.
12. Continuous controlled loop until stopped.
13. Stop continuous loop.

Safer/default items:

- Start/open UI, goal-to-handoff, manual bridge loop, wait/import result, controlled dry-run, open handoff folder, show status, stop service, stop continuous loop.

Cautious items:

- Real codex one-shot: warns and requires typing `YES`; should only be used with explicit user intent and safety-gate success.
- Desktop GUI send once: warns and requires typing `YES`; it can focus Codex Desktop, paste the latest handoff, and press Enter once.
- Continuous controlled loop: does not call Codex CLI by default and does not enable real Desktop GUI sending from the menu, but it should still be supervised.

The BAT file also prints safety defaults: no default codex exec, no commit/push, no worktree, no workflow run.

## 9. Evidence Inventory

Key evidence and what each proves:

- `phase-105a-user-journey.json`: verifies the ordinary user journey, including UI/setup/chat/workforce save/export/delete documentation path and no real provider smoke call.
- `phase-107a-secret-safety.json`: verifies secret-safety posture, masking, repo scan boundaries, docs boundary, and no plaintext key findings in the scanned surfaces.
- `phase-142a-workforce-omx-handoff-preview.json`: proves OMX handoff is preview-only and not an actual OMX call.
- `phase-143a-role-tier-event-ledger.json`: proves role tiers and disabled event ledger preview exist.
- `phase-144a-execution-readiness-preflight.json`: proves execution readiness is a blocked future preflight, not permission to execute.
- `phase-145a-external-omx-runner-design.json`: proves external runner is design-only and disabled.
- `phase-146a-runner-request-review-queue.json`: proves runner request queue is preview-only and disabled.
- `phase-147a-execution-approval-record.json`: proves approval record preview is disabled and approval-preview is not execution approval.
- `phase-148a-external-runner-protocol-freeze.json`: proves external runner protocol freeze with runner/execution disabled.
- `phase-149a` through `phase-160a` evidence: proves final UX seal, acceptance pack, stage closure, templates, export/copy UX, onboarding dataset, evidence index, known limits, RC seal, and Agent Workforce final closure as preview.
- `phase-180a-final-product-decision-gate.json`: proves the product decision gate for the preview baseline and records no real execution.
- `phase-199a-real-ui-trial-runtime-sync.json`: proves a real browser UI trial passed after runtime sync; it generated/saved/exported a plan and checked disabled execution signals.
- `manual-real-ui-trial-current.json`: preserves the current manual real UI trial snapshot and artifact links.
- `phase-200a-real-ui-trial-final-seal.json`: seals the Phase 199A result and explicitly adds no new runtime capability.
- `phase-208a-clipboard-handoff-real-trial.json`: proves real local handoff file generation and clipboard behavior, not automatic Codex execution.
- `phase-214a-codex-feedback-loop-closure.json`: proves Codex result import/review/feedback loop closure with no auto execution/apply/commit/push.
- `phase-218a-codex-loop-one-shot-real-trial.json`: proves the one-shot real Codex exec trial was honestly skipped when explicit enablement was absent.
- `phase-220a-codex-continuous-loop-closure.json`: proves continuous loop closure as controlled/dry-run/manual bridge, with default real execution disabled.
- `phase-225a-agent-workforce-auto-save-latest-plan.json` through `phase-231a-auto-loop-documentation.json`: prove auto-save latest plan, goal-to-handoff generation, result waiting/import, one-click manual bridge, controlled auto-loop, desktop BAT control, and operator documentation surfaces.
- `phase-232a-fully-automated-controlled-loop-closure.json`: proves the one-click controlled loop operator experience, default safety boundaries, desktop BAT/script presence, and blocker-none closure for that local bridge phase.
- `agent-workforce-next-task-queue.json`: proves the P1-P5 next task queue exists with goals, scopes, forbidden actions, verification commands, evidence requirements, and response format. No `phase-233a-*` evidence file was found.
- `phase-234a-codex-exec-auto-send-bridge.json`: proves Codex exec auto-send bridge dry-run and explicit gated path. It records no Codex invocation in dry-run.
- `phase-235a-codex-desktop-gui-send-bridge.json`: proves the desktop GUI send bridge dry-run/explicit-gated design. It is separate from this readthrough report.
- `phase-235a-codex-desktop-gui-send-real-attempt.json`: proves a real GUI send attempt was blocked by environment/review and was not executed by this agent.
- `phase-236a-continuous-controlled-loop-supervisor.json`: proves continuous controlled loop supervisor readiness with stop controls and no default Codex CLI/GUI execution.
- `phase-235a-full-system-readthrough-report.json` and `.md`: generated by this Phase 235A verifier to prove the report exists, includes the required sections and boundaries, and avoids unsafe claims.

Other evidence files exist across earlier AI Gateway, setup, model import, knowledge, user journey, Docker/GitHub/release, and Agent Workforce phases. They were not all revalidated individually in this readthrough unless named above or covered by the final verification commands.

## 10. Current Safety Boundaries

Current hard boundaries:

- No changes under `legacy/`.
- No `PROJECT_CONTEXT.md`.
- No default NVIDIA `/chat` lane change.
- No automatic commit or push.
- No worktree by default.
- No workflow run connection.
- No real external runner dispatch unless explicitly enabled in a later verified phase.
- No approval-preview as execution approval.
- No plaintext secrets in logs, evidence, handoff, inbox, review, run files, UI, or docs.
- No oh-my-codex, OMX, team, or ralph calls.
- No automatic application of external Codex patches.
- No claim of production execution from preview/design-only surfaces.

This Phase 235A readthrough follows the same boundaries and only adds report/evidence/verifier files.

## 11. Current Gaps / Risks / Unknowns

Gaps and risks found:

- Git workspace is not clean. Many modified/untracked files existed before this Phase 235A work, so real one-shot execution should remain blocked until the user intentionally resolves or accepts that state.
- Codex executable is visible through `where codex`, but this readthrough did not verify login, model availability, or ability to execute a real task. Phase 218A records real Codex exec as skipped when explicit enablement was absent.
- Controlled real `codex exec` has not been verified as successfully run in the evidence reviewed here. The honest evidence state is skipped/not-enabled or dry-run/blocked, depending on phase.
- Desktop GUI send real path is not verified as executed. Existing evidence records the bridge as ready/dry-run and the real attempt as blocked by environment/review.
- Phase 225A-231A evidence uses descriptive filenames rather than a single closure filename, so operators should use the exact evidence names when linking or verifying these phases.
- Phase 233A exact evidence filename was not found. The next task queue is verified under `agent-workforce-next-task-queue`.
- Some scripts depend on local environment state: running service, Windows clipboard, Desktop BAT path, Codex Desktop window focus, Codex executable availability, and clean git state.
- More real human UI trials would be useful for plan history, export, inbox import, and feedback generation across several goal templates.
- Provider fallback is implemented behind config, but a real fallback path was not verified as active in this readthrough.
- Public multi-user production readiness remains incomplete: auth, tenant isolation, encrypted secret vault, rate limits, audit retention, and dedicated security review remain outside this baseline.
- Docker/GitHub/release phases exist, but this readthrough did not rerun Docker or remote GitHub Actions.

Unknown / not verified:

- Whether Codex Desktop is currently open and focusable.
- Whether a real `codex exec` run would pass the safety gate after the dirty workspace is resolved.
- Whether all old evidence files still match the current code after the large dirty workspace changes.
- Whether every desktop menu option works on every Windows locale/user profile.

## 12. Recommended Next Roadmap

P1: Codex Bridge Status Panel

- Goal: show `.codex-handoff` status in the Web UI, including latest handoff, inbox result, review summary, feedback, dry-run summaries, and safety-gate state.
- Why: users need one visible bridge dashboard instead of hunting through files.
- Allowed modification range: `apps/ai-gateway-service/src/ui/consolePage.js`, read-only status endpoints under `apps/ai-gateway-service/src/http/httpServer.js`, shared contracts/SDK as needed, docs/evidence/verifier.
- Forbidden: do not call Codex, do not apply results, do not commit/push, do not create worktrees, do not connect workflow run, do not change NVIDIA `/chat`.
- Recommended verification: `cmd /c pnpm run verify:phase235a-full-system-readthrough-report`, a new P1 verifier, `cmd /c pnpm run verify:phase107a-secret-safety`, `cmd /c pnpm run health:phase12a`, `cmd /c pnpm run doctor:phase13a`, `cmd /c pnpm -r --if-present check`.

P2: Next Task Queue UI

- Goal: render P1-P5 queue items in the UI with status, allowed files, forbidden actions, recommended commands, and evidence requirements.
- Why: the next work should be operator-readable and phase-driven, not buried in docs.
- Allowed modification range: UI/contract/SDK additions, docs, evidence, and a verifier for queue display.
- Forbidden: do not turn queue items into execution jobs; do not dispatch agents; do not call Codex/OMX/team/ralph.
- Recommended verification: `cmd /c pnpm run verify:agent-workforce-next-task-queue`, new P2 verifier, secret safety, health, doctor, and workspace check.

P3: Auto Loop Run History

- Goal: expose `.codex-handoff/runs` summaries in the UI and evidence index.
- Why: dry-run/manual/controlled loop attempts need traceability without reading raw files.
- Allowed modification range: read-only run-history parser, UI panel, shared contract/SDK fields, docs/evidence/verifier.
- Forbidden: do not rerun loops from the history panel; do not enable real execution from history; do not auto-apply results.
- Recommended verification: `cmd /c pnpm run verify:phase232a-fully-automated-controlled-loop-closure`, `cmd /c pnpm run verify:phase236a-continuous-controlled-loop-supervisor`, new P3 verifier, secret safety, health, doctor, workspace check.

P4: Safety Gate Dashboard

- Goal: show safety gates such as dirty git state, explicit approval requirement, no commit/push flags, secret scan status, Codex executable presence, and stop-file state.
- Why: real one-shot readiness must be visible before any operator considers enabling it.
- Allowed modification range: read-only status endpoint, UI status cards, docs/evidence/verifier.
- Forbidden: do not make the dashboard an approval button; do not treat approval-preview as execution approval; do not bypass the existing safety gate scripts.
- Recommended verification: `cmd /c pnpm run verify:phase216a-codex-loop-safety-gate`, `cmd /c pnpm run verify:phase234a-codex-exec-auto-send-bridge`, new P4 verifier, secret safety, health, doctor, workspace check.

P5: Controlled Codex One-shot Readiness

- Goal: create a read-only readiness checklist for the explicit real one-shot path, including required command, clean workspace, secret scan, no commit/push, and expected evidence files.
- Why: the system should make the difference between dry-run, GUI-send, and real `codex exec` unmistakable.
- Allowed modification range: docs, UI read-only checklist, verifier, evidence, and possibly read-only helper scripts.
- Forbidden: do not run real Codex by default; do not add unattended execution; do not create worktrees; do not connect workflow run; do not auto-commit/push.
- Recommended verification: `cmd /c pnpm run verify:phase218a-codex-loop-one-shot-real-trial`, `cmd /c pnpm run verify:phase234a-codex-exec-auto-send-bridge`, new P5 verifier, secret safety, health, doctor, workspace check.

## 13. Daily Operating Guide

Start the system:

```powershell
cmd /c pnpm run dev:phase7b
cmd /c pnpm run health:phase12a
```

Open the UI:

```text
http://127.0.0.1:3100/ui
```

Generate a task package:

1. Open `/ui`.
2. Go to Agent Workforce.
3. Pick a template.
4. Enter a goal.
5. Generate the preview plan.
6. Save it.
7. Export JSON or Markdown when needed.

Handoff to Codex manually:

```powershell
cmd /c pnpm run handoff:codex
```

Then paste the generated `.codex-handoff/outbox/latest-codex-handoff.md` into Codex Desktop by hand, unless using an explicitly approved send path.

Import a Codex result:

1. Save the human-provided Codex result to `.codex-handoff/inbox/latest-codex-result.md`.
2. Run:

```powershell
cmd /c pnpm run codex:result:import
```

Generate feedback:

```powershell
cmd /c pnpm run feedback:codex
```

Use dry-run when:

- Testing handoff shape.
- Checking safety-gate summaries.
- Testing desktop menu flow.
- Validating evidence generation without dispatching prompts.

Do not use real execution when:

- The workspace is dirty and the safety gate requires clean git.
- The user has not explicitly approved the exact one-shot command.
- You only need a report, plan, review, or evidence update.
- You are not prepared to inspect the result manually before any further action.

Stop the system:

```powershell
cmd /c pnpm run stop:phase9c
```

## 14. Final Conclusion

当前 unified-ai-system 是一个本地 AI Gateway + Agent Workforce Preview + Codex handoff/feedback bridge 的受控开发工作台。

它可以规划、交接、审查、反馈，但默认不是无人值守自动执行系统。

This Phase 235A readthrough added no business capability, enabled no real Agent execution, called no Codex CLI, created no worktree, connected no workflow run, made no automatic commit/push, and did not change the default NVIDIA `/chat` mainline.
