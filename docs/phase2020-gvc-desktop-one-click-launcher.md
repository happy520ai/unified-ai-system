# Phase2020-GVC-Desktop-One-Click-Launcher

## Goal

Create repo-local Windows launcher scripts for the Phase2019 GVC timed local runner.

## Launch Command

```powershell
pnpm run gvc:timed-runner -- --intervalMs=30000 --dailyLoopLimit=500 --maxTasksPerLoop=1 --dryRunOnly=true
```

## Generated Scripts

- `tools/gvc/start-timed-local-runner.cmd`
- `tools/gvc/start-timed-local-runner.ps1`

These scripts stay inside the repository. They do not write to the Windows Desktop.

## Safety Boundary

- No Provider call.
- No raw secret, `.env`, `auth.json`, API key, or Authorization header read.
- No deploy, release, tag, artifact upload, push, or commit.
- No `/chat` or `/chat-gateway/execute` change.
- No `legacy/` or `PROJECT_CONTEXT.md` change.
- No Windows Task Scheduler registration.
- No startup auto-run.
- No background service installation.

## Stop

Press `Ctrl+C` in the terminal window running the launcher.

## Evidence

`apps/ai-gateway-service/evidence/phase2020-gvc-desktop-one-click-launcher/desktop-one-click-launcher-result.json`
