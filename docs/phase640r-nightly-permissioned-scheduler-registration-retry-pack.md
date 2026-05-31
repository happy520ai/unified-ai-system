# Phase640R-Nightly Permissioned Scheduler Registration Retry Pack

## Purpose

Prepare the manual retry path for an administrator or permissioned Windows session to register `PME-AI-Gateway-Nightly-Safe-Runner`.

## Contents

- Permissioned retry script
- Verification script
- Safe unregister script
- Admin checklist
- Result intake example
- Diagnosis evidence

## Boundaries

- No automatic elevation.
- No permission bypass.
- No actual registration by this phase.
- No nightly runner execution by this phase.
- No Provider call, secret access, Codex config write, `/chat` modification, `/chat-gateway/execute` modification, deploy, release, push, or commit.

## Status

- permissionedRetryPackReady=true
- scheduledTaskRegistered=false
- nightlyAutomationEnabled=false
- fallbackLauncherAvailable=true
- exampleNotCountedAsRealRegistration=true
