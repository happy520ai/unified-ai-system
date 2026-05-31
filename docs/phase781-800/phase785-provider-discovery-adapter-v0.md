# Phase785 Provider Discovery Adapter v0

## Goal

执行 bounded discovery adapter v0；无合规 approval 时写 not_executed_no_approval。

## Verified facts

- status=not_executed_no_approval
- realDiscoveryExecuted=false
- discoveredModelCount=0

## Boundaries

- providerCallsMade=false when no approval
- secretRead=false
- selectable unchanged

## Outputs

- provider-expansion/discovery/provider-discovery-result.json

## Non-claims

- This phase does not read or print API keys, secrets, webhooks, auth.json, or raw base_url values.
- This phase does not bypass CredentialRef.
- This phase does not automatically add selectable models.
- This phase does not change default /chat or /chat-gateway/execute behavior.
- This phase does not deploy, release, tag, upload artifacts, push, or commit.
