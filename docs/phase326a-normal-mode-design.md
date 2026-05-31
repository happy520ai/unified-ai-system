# Phase326A Normal Mode Design

## Definition

Normal Mode is direct model conversation.

- the user explicitly specifies `modelId`
- `modelId` must come from the user's configured, authorized, and availability-checked model library
- the system calls only that selected model
- the system does not perform multi-model adjudication
- the system does not perform agentic model selection

Normal Mode is the simplest product mode and the closest future shape to the current Chat experience.

## Future Flow

1. User selects provider/model from Model Library.
2. System validates the user's credential reference.
3. System checks model availability.
4. System routes the request to the selected model.
5. System returns the answer.
6. System records telemetry, evidence, and errors.

## Required Gates

Before a model can be used in Normal Mode:

- provider must be configured by the user
- credential reference must be present and redacted
- model must pass availability or smoke checks
- model must be allowed by the user's mode policy
- model must be allowed by provider governance
- route policy must allow direct chat use
- fallback must be explicit, never implicit paid fallback

## Current Status

The current Chat main chain remains the NVIDIA internal test baseline.

Phase326A does not:

- modify the Chat main chain
- connect user-owned API keys to runtime
- open non-NVIDIA provider calls
- create a new Normal Mode runtime switch
- change selectable metadata

## Output Expectations

Future Normal Mode output should include:

- selected provider
- selected model
- providerCalled
- execution status
- completion verification
- evidence id
- user-visible failure reason when the selected model cannot be used

