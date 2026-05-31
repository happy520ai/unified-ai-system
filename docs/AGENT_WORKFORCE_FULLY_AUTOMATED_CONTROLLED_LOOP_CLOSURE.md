# Agent Workforce Fully Automated Controlled Loop Closure

Phase: 232A

## Current Capability

Agent Workforce now supports a controlled one-key automation path:

Goal -> plan -> auto-save -> Codex handoff -> wait for result -> import -> system review -> feedback.

The default path is a manual bridge loop. It automates the local system side, copies the handoff and feedback to the Windows clipboard, and waits for a human-managed Codex result file.

## Desktop BAT

Desktop entry:

```powershell
%USERPROFILE%\Desktop\unified-ai-system-全自动闭环.bat
```

Menu:

- Start service and open UI
- Enter a goal and generate handoff
- Run one-click manual bridge loop
- Wait for and import Codex result
- Run controlled dry-run
- Run real Codex one-shot only after typing `YES`
- Open `.codex-handoff`
- Show status
- Stop service

## PowerShell Scripts

- `tools/agent-workforce/goal-to-codex-handoff.ps1`
- `tools/agent-workforce/wait-and-import-codex-result.ps1`
- `tools/agent-workforce/run-manual-bridge-loop.ps1`
- `tools/agent-workforce/run-controlled-codex-auto-loop.ps1`
- Existing bridge scripts remain available:
  - `tools/agent-workforce/pull-codex-handoff.ps1`
  - `tools/agent-workforce/import-codex-result.ps1`
  - `tools/agent-workforce/run-codex-exec-loop.ps1`

## Package Scripts

- `pnpm run agent:auto:handoff`
- `pnpm run agent:auto:import`
- `pnpm run agent:auto:manual-loop`
- `pnpm run agent:auto:dry-run`
- `pnpm run agent:auto:codex-once`

## Manual Bridge Loop

Recommended daily path:

```powershell
cmd /c pnpm run agent:auto:manual-loop -- -Goal "Implement a small reviewed UI improvement"
```

This path:

- Generates an Agent Workforce plan.
- Auto-saves the latest plan.
- Generates `.codex-handoff/outbox/latest-codex-handoff.md`.
- Copies the handoff to the clipboard.
- Waits for `.codex-handoff/inbox/latest-codex-result.md`.
- Imports the result.
- Generates `.codex-handoff/review/latest-system-review.md`.
- Generates `.codex-handoff/review/latest-feedback-to-codex.md`.
- Copies feedback to the clipboard.
- Does not invoke Codex CLI.

## Dry-run Path

```powershell
cmd /c pnpm run agent:auto:dry-run -- -Goal "Check the controlled loop"
```

This path validates the controlled loop, handoff files, and safety gate without running `codex exec`.

## Real Codex One-shot Path

```powershell
cmd /c pnpm run agent:auto:codex-once -- -Goal "One small approved task"
```

This path is only for explicit, cautious one-shot use. The script still enforces:

- `EnableCodexExec=true`
- `DryRun=false`
- `IExplicitlyApproveCodexExec=true`
- `MaxRounds <= 3`
- clean git workspace by default
- `NoCommit=true`
- `NoPush=true`
- `NoWorktree=true`

## Safety Boundary

- No default real Codex execution.
- No infinite unattended loop.
- No automatic patch apply.
- No automatic merge.
- No automatic commit or push.
- No default worktree creation.
- No workflow run hookup.
- No `oh-my-codex`, OMX, team, or ralph call.
- No default NVIDIA `/chat` lane change.
- No `legacy/` modification.
- No `PROJECT_CONTEXT.md` creation.
- No plaintext API key in logs, evidence, handoff files, or docs.

## Current Blocker

none

## Next Recommendation

Use the manual bridge loop as the default daily workflow. Use controlled dry-run when checking safety. Use real Codex one-shot only after explicit human approval and a clean workspace.
