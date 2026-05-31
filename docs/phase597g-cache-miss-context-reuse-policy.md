# Phase597G Cache Miss Context Reuse Policy

## Scope
- Phase597 is controlled Codex base_url integration design only.
- It documents config surfaces, relay architecture, authorization requirements, account pool policy, cache miss reuse, rate limits, credential boundaries, rollback, risk review, checklist, config preview, Mission Control preview, and authorization packet template.
- It does not modify real Codex config, does not write ~/.codex/config.toml, does not create a project .codex/config.toml, does not change base_url, does not start a relay, does not call providers, and does not read secrets/webhooks.

## Design Summary
- contextHash: 2fdfb567a22a9ef7523a28acef1d8e49bd26f7a9ee99598a88f71099bef185fa
- designOnly: true
- authorizationStatus: blocked_pending_specific_authorization
- configPreviewEnabled: false
- dryRunOnly: true
- relayStarted: false

## Safety
- providerCallsMade=false
- rawSecretAccessed=false
- secretValueExposed=false
- rawWebhookAccessed=false
- webhookValueExposed=false
- codexBaseUrlModified=false
- codexConfigModified=false
- realCodexConnectionMade=false
- relayStarted=false
- chatModified=false
- chatGatewayExecuteModified=false
- deployExecuted=false
- releaseExecuted=false
- tagCreated=false
- artifactUploaded=false
- workspaceCleanClaimed=false
