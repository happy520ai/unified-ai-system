# Phase613R-Fix Controlled Next-Gate Design

## Purpose

Design the next controlled integration gate after Phase612R-Fix repeated_pass without modifying `/chat`, `/chat-gateway/execute`, or provider runtime in this phase.

## Gate Requirements

- manual approval required.
- maxRequests policy required before any future real request.
- rollback policy required.
- emergency disable policy required.
- UI read-only preview first.
- no `/chat` integration without a separate Phase.
- no `/chat-gateway/execute` integration without a separate Phase.
- no provider runtime modification without a separate Phase.
- no production readiness claim.
- no release readiness claim.

## Proposed Future Gate

Phase614R-Fix should be a design-only controlled integration preview:

- Import Phase612R repeated_pass and Phase613R boundary closure.
- Generate route contract preview for a separate, non-default integration lane.
- Require explicit user approval for any future runtime change.
- Keep default `/chat` unchanged.
- Keep `/chat-gateway/execute` unchanged.
- Keep provider runtime unchanged.
- Add rollback and emergency disable checklist.
- Add Mission Control read-only preview of readiness, not an execution button.

## Max Requests Policy

- Future preview phases: maxRequests=0.
- Future guarded execution phases: maxRequests must be explicitly approved.
- Any future provider-backed test must specify per-attempt and total request caps.

## Rollback Policy

- No rollback is required for this phase because no runtime integration is performed.
- Future integration phases must include file-level rollback notes and emergency disable paths before execution.

## Emergency Disable Policy

- Any future integration preview must include a visible disabled state.
- Any future execution must stop on first failure, timeout, invalid response, config write, secret exposure, or unauthorized route mutation.

## Safety Boundary

- codexExecExecutedByThisPhase=false
- providerCallsMadeByThisPhase=false
- authJsonRead=false
- codexConfigModified=false
- projectCodexConfigModified=false
- chatModified=false
- chatGatewayExecuteModified=false
- providerRuntimeModified=false
- deployExecuted=false
- releaseExecuted=false
- tagCreated=false
- pushExecuted=false
- commitCreated=false
