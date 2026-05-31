# Phase790 Selectable Candidate Gate

## Goal

只允许 smoke pass 结果进入 selectable_candidate，不自动进入 selectable。

## Verified facts

- selectableCandidateModelCount=0
- newSelectableModelsAdded=0

## Boundaries

- Phase821+ required for selectable admission
- selectableModelCountUnchanged=true

## Outputs

- provider-expansion/candidates/selectable-candidate-gate-result.json

## Non-claims

- This phase does not read or print API keys, secrets, webhooks, auth.json, or raw base_url values.
- This phase does not bypass CredentialRef.
- This phase does not automatically add selectable models.
- This phase does not change default /chat or /chat-gateway/execute behavior.
- This phase does not deploy, release, tag, upload artifacts, push, or commit.
