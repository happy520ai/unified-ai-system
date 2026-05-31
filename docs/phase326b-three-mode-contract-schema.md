# Phase326B Three Mode Contract Schema

## Goal

Phase326B defines a unified contract draft for the three future product modes.

- Normal Mode uses `selectedModel`
- God Mode uses `participantModels` plus `supervisor`
- Tianshu Mode uses `taskIntent` plus `plannerDecision`

This phase is `design_only` and `contract_draft`.

- no runtime change
- no provider call
- no Chat Gateway change

## Unified Request Envelope

The request envelope should support all three modes with one baseline structure.

Required top-level fields:

- `requestId`
- `userId`
- `mode`
- `input`
- `modelSelection`
- `providerCredentialPolicy`
- `executionPolicy`
- `audit`
- `safety`

## Unified Response Envelope

The response envelope should preserve a shared shell while allowing mode-specific fields.

Core fields:

- `requestId`
- `mode`
- `status`
- `finalAnswer`
- `selectedModel`
- `participantModels`
- `plannerDecision`
- `supervisorDecision`
- `confidenceSummary`
- `uncertainty`
- `auditTrace`
- `error`
- `fallback`

## Mode Differences

### Normal Mode

- `userSelectedModel` is required
- `participantModels` is not required
- `plannerDecision` is not required

### God Mode

- `participantModels` is required or policy-selected
- `supervisorDecision` is required
- `selectedModel` may still appear for the Supervisor or final output owner

### Tianshu Mode

- `plannerDecision` is required
- `userSelectedModel` is optional or absent
- `selectedModel` may be a planner result instead of a direct user choice

## User-Owned API Key Boundary

The contract may only reference:

- `credentialRef`
- credential policy
- authorization policy

The contract must not contain:

- plaintext secret value
- plaintext API key
- provider token value

The platform must not default to calling an unauthorized Provider.

## Current Phase Boundary

Current status:

- `design_only`
- `contract_draft`
- no runtime change
- no provider call
- no non-NVIDIA provider runtime enablement

