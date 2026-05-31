# Phase797 Mission Control Provider Expansion Panel

## Goal

Record the read-only Mission Control surface for user-owned CredentialRef provider expansion.

## Verified facts

- missionControlProviderExpansionPanelReady=true
- realDiscoveryExecuted=false
- realSmokeExecuted=false
- selectable unchanged

## Boundaries

- read-only panel
- no provider execution button
- no selectable admission action
- no chat mutation action

## Outputs

- apps/ai-gateway-service/src/ui/components/UserOwnedProviderExpansionPanel.js

## Non-claims

- This phase does not read or print API keys, secrets, webhooks, auth.json, or raw base_url values.
- This phase does not bypass CredentialRef.
- This phase does not automatically add selectable models.
- This phase does not change default /chat or /chat-gateway/execute behavior.
- This phase does not deploy, release, tag, upload artifacts, push, or commit.
