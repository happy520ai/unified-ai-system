# Phase643R External Tool Nightly Safe Runner Reliability

## Goal

Recheck the nightly safe runner and fallback runner reliability for the external
tool product line without registering Windows Task Scheduler and without
starting a daemon or infinite loop.

## Checked Items

- fallback cmd exists
- fallback ps1 exists
- nightly runner script exists
- task queue exists
- high-risk tasks remain gate-only
- maxTasksPerNightDefault <= 8
- maxTasksPerNightHardLimit <= 12
- providerCallsAllowed=false
- deployAllowed=false
- pushAllowed=false

## Boundary

This phase performs safe validation only. It does not run the nightly runner as
an automation task, does not register Windows Task Scheduler, does not call
Providers, and does not modify `/chat` or `/chat-gateway/execute`.
