# Agent Workforce Next Task Queue

This queue defines the next small, controlled product tasks for
unified-ai-system after the fully automated controlled loop baseline.
It is a planning queue only. It does not enable real Agent execution,
does not invoke Codex, does not create a worktree, does not connect a
workflow run, does not commit or push, and does not change the default
NVIDIA `/chat` lane.

## Queue Boundary

- Do not modify `legacy/`.
- Do not create `PROJECT_CONTEXT.md`.
- Do not modify the default NVIDIA `/chat` main lane.
- Do not call Codex, oh-my-codex, OMX, team, or ralph.
- Do not create a worktree.
- Do not connect a workflow run.
- Do not automatically apply external patches.
- Do not automatically commit or push.
- Do not write plaintext API keys in UI, logs, docs, handoff files, or evidence.

## P1: Codex Bridge Status Panel

### Goal

Add a lightweight status panel that shows the current Codex bridge state:
latest handoff file, inbox result file, latest system review, latest feedback,
manual bridge readiness, dry-run readiness, and real one-shot disabled by
default.

### Allowed Files

- `apps/ai-gateway-service/src/ui/consolePage.js`
- `docs/USER_MANUAL.md`
- `README.md`
- `apps/ai-gateway-service/src/entrypoints/verifyAgentWorkforceCodexBridgeStatusPanel.js`
- `apps/ai-gateway-service/evidence/phase-next-p1-codex-bridge-status-panel.json`
- `apps/ai-gateway-service/evidence/phase-next-p1-codex-bridge-status-panel.md`
- `package.json`
- `apps/ai-gateway-service/package.json`

### Forbidden Actions

- Do not call Codex CLI from the web service.
- Do not add real external runner dispatch.
- Do not add file patch application.
- Do not create worktrees.
- Do not connect workflow runs.
- Do not change the default NVIDIA `/chat` lane.
- Do not modify `legacy/`.
- Do not create `PROJECT_CONTEXT.md`.

### Recommended Verification Commands

```powershell
cmd /c pnpm run verify:phase232a-fully-automated-controlled-loop-closure
cmd /c pnpm run verify:phase107a-secret-safety
cmd /c pnpm run verify:phase105a-user-journey
cmd /c pnpm run health:phase12a
cmd /c pnpm run doctor:phase13a
cmd /c pnpm -r --if-present check
```

### Evidence Requirements

- Record the UI status fields that were added.
- Record that real Codex execution remains disabled by default.
- Record that no worktree, workflow run, commit, push, or external runner
  dispatch was added.
- Store evidence in:
  `apps/ai-gateway-service/evidence/phase-next-p1-codex-bridge-status-panel.json`
  and `.md`.

### Codex Response Format

```markdown
A. Summary
B. Changed Files
C. UI Status Fields Added
D. Verification Commands Run
E. Evidence Paths
F. Boundary Check
G. Known Issues
H. Next Step
```

## P2: Next Task Queue UI

### Goal

Expose this queue in the Agent Workforce area so a user can see P1-P5,
understand the next recommended task, and copy a bounded handoff prompt for a
selected queue item.

### Allowed Files

- `apps/ai-gateway-service/src/ui/consolePage.js`
- `docs/AGENT_WORKFORCE_NEXT_TASK_QUEUE.md`
- `docs/USER_MANUAL.md`
- `apps/ai-gateway-service/src/entrypoints/verifyAgentWorkforceNextTaskQueueUi.js`
- `apps/ai-gateway-service/evidence/phase-next-p2-next-task-queue-ui.json`
- `apps/ai-gateway-service/evidence/phase-next-p2-next-task-queue-ui.md`
- `package.json`
- `apps/ai-gateway-service/package.json`

### Forbidden Actions

- Do not add a new execution endpoint.
- Do not automatically dispatch selected tasks to Codex.
- Do not run Codex, oh-my-codex, OMX, team, or ralph.
- Do not create worktrees.
- Do not connect workflow runs.
- Do not commit or push.
- Do not modify `legacy/`.
- Do not create `PROJECT_CONTEXT.md`.

### Recommended Verification Commands

```powershell
cmd /c pnpm run verify:agent-workforce-next-task-queue
cmd /c pnpm run verify:phase232a-fully-automated-controlled-loop-closure
cmd /c pnpm run verify:phase107a-secret-safety
cmd /c pnpm run verify:phase105a-user-journey
cmd /c pnpm run health:phase12a
cmd /c pnpm run doctor:phase13a
cmd /c pnpm -r --if-present check
```

### Evidence Requirements

- Record visible P1-P5 task labels.
- Record selected task copy behavior if implemented.
- Record that queue UI is planning/handoff only.
- Store evidence in:
  `apps/ai-gateway-service/evidence/phase-next-p2-next-task-queue-ui.json`
  and `.md`.

### Codex Response Format

```markdown
A. Summary
B. Changed Files
C. Queue Items Displayed
D. Verification Commands Run
E. Evidence Paths
F. Boundary Check
G. Known Issues
H. Next Step
```

## P3: Auto Loop Run History

### Goal

Show recent controlled loop run summaries from `.codex-handoff/runs` so users
can see dry-run status, manual bridge status, generated handoff IDs, review
decisions, and safety gate results without opening files manually.

### Allowed Files

- `apps/ai-gateway-service/src/ui/consolePage.js`
- `tools/agent-workforce/run-manual-bridge-loop.ps1`
- `tools/agent-workforce/run-controlled-codex-auto-loop.ps1`
- `docs/USER_MANUAL.md`
- `apps/ai-gateway-service/src/entrypoints/verifyAgentWorkforceAutoLoopRunHistory.js`
- `apps/ai-gateway-service/evidence/phase-next-p3-auto-loop-run-history.json`
- `apps/ai-gateway-service/evidence/phase-next-p3-auto-loop-run-history.md`
- `package.json`
- `apps/ai-gateway-service/package.json`

### Forbidden Actions

- Do not read arbitrary file system paths.
- Do not auto-apply Codex output.
- Do not auto-merge, commit, or push.
- Do not run Codex by default.
- Do not create worktrees.
- Do not connect workflow runs.
- Do not modify `legacy/`.
- Do not create `PROJECT_CONTEXT.md`.

### Recommended Verification Commands

```powershell
cmd /c pnpm run verify:phase229a-controlled-codex-exec-auto-loop
cmd /c pnpm run verify:phase228a-one-click-manual-bridge-loop
cmd /c pnpm run verify:phase107a-secret-safety
cmd /c pnpm run health:phase12a
cmd /c pnpm run doctor:phase13a
cmd /c pnpm -r --if-present check
```

### Evidence Requirements

- Record which run summary files are read.
- Record displayed fields and empty-state behavior.
- Record that real execution remains disabled unless explicitly approved.
- Store evidence in:
  `apps/ai-gateway-service/evidence/phase-next-p3-auto-loop-run-history.json`
  and `.md`.

### Codex Response Format

```markdown
A. Summary
B. Changed Files
C. Run History Fields
D. Verification Commands Run
E. Evidence Paths
F. Boundary Check
G. Known Issues
H. Next Step
```

## P4: Safety Gate Dashboard

### Goal

Add a readable dashboard for safety gate results: clean git requirement,
prompt existence, no plaintext secrets, forbidden actions present in the
prompt, max rounds cap, no commit, no push, no worktree, no workflow run, and
default NVIDIA `/chat` lane protection.

### Allowed Files

- `apps/ai-gateway-service/src/ui/consolePage.js`
- `tools/agent-workforce/run-codex-exec-loop.ps1`
- `tools/agent-workforce/run-controlled-codex-auto-loop.ps1`
- `docs/USER_MANUAL.md`
- `apps/ai-gateway-service/src/entrypoints/verifyAgentWorkforceSafetyGateDashboard.js`
- `apps/ai-gateway-service/evidence/phase-next-p4-safety-gate-dashboard.json`
- `apps/ai-gateway-service/evidence/phase-next-p4-safety-gate-dashboard.md`
- `package.json`
- `apps/ai-gateway-service/package.json`

### Forbidden Actions

- Do not weaken any safety gate.
- Do not make real Codex execution the default.
- Do not bypass clean git checks for real one-shot mode.
- Do not add commit, push, worktree, or workflow automation.
- Do not call oh-my-codex or OMX.
- Do not modify `legacy/`.
- Do not create `PROJECT_CONTEXT.md`.

### Recommended Verification Commands

```powershell
cmd /c pnpm run verify:phase216a-codex-loop-safety-gate
cmd /c pnpm run verify:phase229a-controlled-codex-exec-auto-loop
cmd /c pnpm run verify:phase107a-secret-safety
cmd /c pnpm run health:phase12a
cmd /c pnpm run doctor:phase13a
cmd /c pnpm -r --if-present check
```

### Evidence Requirements

- Record each safety gate field and whether it passes/fails.
- Record disabled/default-safe state for real Codex execution.
- Record no worktree, no workflow run, no commit, and no push.
- Store evidence in:
  `apps/ai-gateway-service/evidence/phase-next-p4-safety-gate-dashboard.json`
  and `.md`.

### Codex Response Format

```markdown
A. Summary
B. Changed Files
C. Safety Gate Fields
D. Verification Commands Run
E. Evidence Paths
F. Boundary Check
G. Known Issues
H. Next Step
```

## P5: Controlled Codex One-shot Readiness

### Goal

Prepare a final readiness review for real one-shot Codex execution. This task
must confirm that one-shot remains opt-in, max rounds are capped, clean git is
required by default, and no commit, push, worktree, workflow run, or external
runner dispatch can occur automatically.

### Allowed Files

- `tools/agent-workforce/run-controlled-codex-auto-loop.ps1`
- `tools/agent-workforce/run-codex-exec-loop.ps1`
- `docs/USER_MANUAL.md`
- `docs/AGENT_WORKFORCE_FULLY_AUTOMATED_CONTROLLED_LOOP_CLOSURE.md`
- `apps/ai-gateway-service/src/entrypoints/verifyAgentWorkforceControlledCodexOneShotReadiness.js`
- `apps/ai-gateway-service/evidence/phase-next-p5-controlled-codex-one-shot-readiness.json`
- `apps/ai-gateway-service/evidence/phase-next-p5-controlled-codex-one-shot-readiness.md`
- `package.json`
- `apps/ai-gateway-service/package.json`

### Forbidden Actions

- Do not run real `codex exec` during readiness review unless the user gives a
  separate explicit approval phrase.
- Do not turn dry-run into real execution.
- Do not allow more than three rounds.
- Do not commit, push, apply patches automatically, create a worktree, or
  connect a workflow run.
- Do not call oh-my-codex, OMX, team, or ralph.
- Do not modify `legacy/`.
- Do not create `PROJECT_CONTEXT.md`.

### Recommended Verification Commands

```powershell
cmd /c pnpm run verify:phase229a-controlled-codex-exec-auto-loop
cmd /c pnpm run verify:phase218a-codex-loop-one-shot-real-trial
cmd /c pnpm run verify:phase107a-secret-safety
cmd /c pnpm run health:phase12a
cmd /c pnpm run doctor:phase13a
cmd /c pnpm -r --if-present check
```

### Evidence Requirements

- Record readiness decision: ready-for-explicit-user-approved-one-shot,
  skipped-not-enabled, or blocked.
- Record whether Codex CLI is installed only if checked locally.
- Record that real one-shot was not run unless separately approved.
- Store evidence in:
  `apps/ai-gateway-service/evidence/phase-next-p5-controlled-codex-one-shot-readiness.json`
  and `.md`.

### Codex Response Format

```markdown
A. Summary
B. Changed Files
C. One-shot Readiness Decision
D. Verification Commands Run
E. Evidence Paths
F. Boundary Check
G. Known Issues
H. Next Step
```

## Current Recommended Next Task

Start with P1: Codex Bridge Status Panel. It gives users the quickest
visibility into the handoff/result/review/feedback files that already exist,
without adding any new execution capability.
