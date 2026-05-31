# Phase 138A Agent Workforce OMX Benchmark

Phase 138A is a read-only benchmark and design reference for the next Agent
Workforce direction. It compares the current Agent Workforce preview with
`oh-my-codex` (OMX), then converts the useful ideas into bounded product
requirements for this repository.

This phase does not install OMX, run OMX, start external agents, mutate user
projects, enable real multi-agent execution, or publish a release.

## Source Snapshot

Snapshot date: 2026-04-28.

Primary sources:

- Official site: https://oh-my-codex.dev/
- Official documentation: https://oh-my-codex.dev/docs.html
- GitHub repository: https://github.com/Yeachan-Heo/oh-my-codex

Observed public positioning:

- OMX is a workflow and orchestration layer around OpenAI Codex CLI.
- Current public site presents v0.14.2, 33 prompts, 36 skills, Team Mode, and
  5 MCP servers.
- Recommended flow is clarification first, then consensus planning, then
  persistent or team execution.
- Team execution emphasizes isolated git worktrees, durable team state,
  incremental merge tracking, hooks, notifications, and verification.
- The README states macOS/Linux with Codex CLI is the recommended default path;
  native Windows and Codex App are not the default experience.

## Useful Ideas To Borrow

1. Intent-first clarification.
   Agent Workforce should not jump directly from a vague goal to a task pack.
   It should ask or simulate clarification around scope, constraints,
   deliverables, risks, and non-goals before generating the plan.

2. Consensus planning before execution.
   A planner, architect, and critic lane can produce a stronger plan than a
   single generic generator. For our product, this can remain deterministic
   and preview-only at first.

3. Role catalog with clear tiers.
   OMX separates core development, review, domain, and product roles. Our
   current seven roles are enough for preview, but the next step should group
   them by purpose and make role responsibilities easier to inspect.

4. Durable state and resumability.
   OMX uses durable project state for plans, logs, memory, and runtime state.
   Our current saved plan store is a good start; the next step is a visible
   plan lifecycle with statuses, decisions, and version history.

5. Worktree-first safety for real execution.
   If this product later enters real Agent Workforce execution, each worker
   should operate in an isolated git worktree or equivalent sandbox. The leader
   workspace should stay clean, and integration should be explicit and
   reviewable.

6. Hooks and operator visibility.
   OMX uses hooks, HUD/status surfaces, and notifications to keep users aware
   of agent activity. Our Web UI should adopt the idea as a status board first,
   not as background automation.

7. Verification as a product primitive.
   OMX treats verification as part of the workflow. Agent Workforce task packs
   should include explicit verification commands, evidence expectations, and
   stop conditions before any future execution lane exists.

## Core Capability Comparison

| Capability | oh-my-codex pattern | Current Agent Workforce | Suggested direction |
| --- | --- | --- | --- |
| Multi-agent roles | Broad role catalog across build, review, product, domain, and coordination lanes. | Seven preview roles for deterministic planning. | Keep seven roles for ordinary users, add role tiers and role-readable responsibilities before adding more roles. |
| Hooks | Lifecycle hooks around tool use, stop, notification, and runtime events. | No Agent Workforce hook runtime. | Add a design-only hook contract first: `plan.created`, `plan.saved`, `plan.exported`, `plan.needs_input`, `plan.ready_for_review`. |
| State records | Durable project state for plans, logs, memory, runtime status, and team coordination. | Saved plans, history, read/delete, JSON export, task-package export. | Add explicit plan lifecycle state, decision log, version history, and verification status. |
| HUD | Operator HUD/status surfaces for live visibility. | Web UI preview panel and history, but no live team runtime. | Add a preview HUD/status board showing plan state, assumptions, blockers, and future execution readiness. |
| Workflow run | Team/persistent flows can move from plan to execution and verification. | Separate safe workflow automation exists, but Agent Workforce is not connected to workflow run. | Keep disconnected for now. Add only an exportable handoff section that explains what a future workflow run would require. |

## Feature Extraction For Unified AI System

Feature set to borrow now:

- Multi Agent role system: add clearer role tiers and role responsibilities,
  not more workers.
- Hooks: define read-only lifecycle event names and payloads, with no handler
  execution.
- State recording: save clarification answers, assumptions, task graph,
  decisions, and verification expectations.
- HUD: show a status board for plan readiness, blocked items, open questions,
  and export readiness.
- Workflow run: keep as future handoff only; do not connect Agent Workforce to
  `POST /workflow/run` in this phase.

Feature set to defer:

- Real worker spawning.
- Worktree creation.
- Command execution.
- Automatic file mutation.
- Merge/cherry-pick/rebase integration.
- Notifications that trigger agent turns.
- 144-worker execution.

## Current Gap Map

Current Agent Workforce preview already has:

- AI-team task plan generation.
- Role division.
- Deliverables, acceptance criteria, risks, and next actions.
- Markdown copy, JSON export, save, history, read/delete, and task-package
  export.
- Clear preview-only user wording.

Missing compared with OMX-style orchestration:

- Clarification step before plan generation.
- Planner/architect/critic consensus lane.
- Task DAG with claim-safe task statuses.
- Worker identity and role state.
- Execution sandbox or worktree isolation.
- Integration report and conflict tracking.
- Hook/status stream for long-running teams.
- Runtime resume/cancel semantics.
- Verification evidence model per task.

## Recommended Next Mainline

Recommended next mainline: Phase 139A Agent Workforce Clarify And Consensus
Preview.

Bounded scope:

- Add a preview-only clarification and consensus design layer.
- Keep deterministic generation.
- Keep saved plans and exports.
- Do not start real workers.
- Do not run commands.
- Do not create worktrees.
- Do not modify user project files.
- Do not call real providers specifically for Workforce.

Suggested product flow:

1. User enters goal.
2. System produces clarification questions and assumptions.
3. User may accept assumptions or edit answers.
4. Planner lane drafts tasks.
5. Architect lane checks structure and dependencies.
6. Critic lane lists risks, missing context, and verification gaps.
7. Final preview package is saved/exported with status `planned`.

Suggested data additions:

- `clarificationQuestions`
- `assumptions`
- `nonGoals`
- `hookEvents`
- `taskGraph`
- `roleAssignments`
- `consensusReview`
- `statusHud`
- `verificationPlan`
- `executionReadiness`
- `workflowRunHandoff`

Suggested UI additions:

- A compact "Clarify" step before "Generate Plan".
- A consensus summary section with Planner / Architect / Critic notes.
- A lifecycle badge: `preview`, `planned`, `needs input`, `blocked`.
- A read-only HUD panel for assumptions, blockers, next decision, and export
  readiness.
- A disabled future workflow-run handoff section that explains required
  approvals and guardrails.
- A future-execution warning that remains visible near exports.

## Future Execution Guardrails

Do not move into real execution until a later explicit mainline adds and
verifies all of these:

- Clean git workspace preflight.
- Isolated worktree or sandbox per worker.
- Worker task claim tokens.
- Explicit user approval before any file mutation.
- Per-task evidence files.
- Integration report.
- Cancel/resume/retry controls.
- Secret redaction in logs and evidence.
- No default change to the NVIDIA `/chat` lane.
- No 144-worker mode until the smaller execution lane is proven.

## Phase 138A Decision

Phase 138A should be treated as design input only. The useful OMX lesson is
not "add many agents"; it is "make the team lifecycle explicit, observable,
resumable, and verifiable before allowing execution."
