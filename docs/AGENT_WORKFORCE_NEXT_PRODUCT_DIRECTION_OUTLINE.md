# Agent Workforce Next Product Direction Outline

Phase: 222A

## A. Product Goal

Continue shaping `unified-ai-system` into a local AI workbench:

- The user opens `/ui` and enters a goal.
- Agent Workforce breaks the goal into a reviewable plan.
- The system generates a Codex handoff.
- Codex can perform code work only when explicitly and safely invoked outside
  the default web path.
- The system reads Codex results from a local inbox.
- The system reviews the result and creates feedback for Codex.
- The product becomes a controlled human-AI development loop, not an
  unattended production execution system.

## B. Next Priority Directions

### 1. Codex Handoff Automation

Goal: reduce manual copy/paste for handoff packages.

Status: available and can continue to be polished through local file and
clipboard helpers.

### 2. Codex Result Inbox / Feedback Outbox

Goal: let the system read Codex results and generate feedback.

Status: next priority for productization and UI visibility.

### 3. Controlled Codex Loop

Goal: support controlled one-shot `codex exec`, not unattended execution.

Status: requires safety gates, explicit user enablement, clean-git checks, and
failure-stop behavior.

### 4. UI Operation Experience

Goal: show handoff, feedback, review, and loop status inside `/ui`.

Status: lightweight enhancement candidate.

### 5. Safety And Boundary

Goal: continuously preserve clean git, no commit/push, no secrets, no legacy,
no `PROJECT_CONTEXT.md`, no worktree by default, no workflow run, and no
default NVIDIA `/chat` lane change.

Status: must remain active across every future phase.

## C. Directions Not Entered

- No public internet production deployment.
- No real unattended Agent execution.
- No automatic commit / push.
- No workflow run hookup.
- No default worktree creation.
- No legacy rewrite.
- No default NVIDIA `/chat` main lane change.
- No plaintext API keys in logs or evidence.

## D. Recommended Next Step

Recommended path:

- Phase 209A-214A: Codex Result Inbox / Feedback Outbox Bridge.
- If Phase 209A-220A is already prepared or complete, keep the manual file
  bridge and controlled `codex exec` dry-run as the next operating baseline.
- The next product-facing iteration should expose handoff / inbox / review /
  feedback / dry-run status in `/ui` without enabling unattended execution.
