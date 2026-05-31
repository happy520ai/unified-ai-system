# Phase629R-Fix Main Chain Emergency Disable Plan

## Emergency Disable Requirements

- disable main-chain candidate flag
- block new candidate requests
- preserve logs/evidence
- mark route disabled
- no auth.json access
- no secret exposure
- no evidence deletion

## Phase629 State

No main-chain route is enabled by this phase. The emergency-disable plan is therefore a future-phase prerequisite, not a runtime action taken now.

## Operator Rule

If future evidence indicates unintended `/chat` routing, `/chat-gateway/execute` execution, provider runtime mutation, or uncontrolled Provider calls, stop the phase, preserve evidence, and do not retry without a new root-cause review.
