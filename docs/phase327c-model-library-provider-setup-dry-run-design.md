# Phase327C Model Library Provider Setup Dry-run Design

## Goal

Phase327C simulates the closed loop for Provider, credentialRef, Model, and validation policy setup inside Model Library.

## Flow

1. Read provider setup scenarios.
2. Validate credentialRef-only inputs against Phase327B schema.
3. Simulate credentialRef validation.
4. Simulate provider enablement gate.
5. Simulate model visibility decision.
6. Keep selectable activation blocked because this is not a real validation phase.

## Boundary

- no provider call
- no .env read
- no secret read
- no real secret stored
- no runtime enablement
