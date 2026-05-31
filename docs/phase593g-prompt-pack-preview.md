# Phase593G Prompt Pack Preview

## Scope
- Codex Context Gateway Operator Panel is an internal Workbench / Mission Control preview surface.
- It only reads `.codex-context/current-context-pack.md`, `.codex-context/current-context-pack.json`, token budget, relevant files, prompt pack, and freshness reports.
- It does not connect real Codex, does not change Codex base_url, does not write Codex config, and does not call providers.
- It does not read raw secrets, raw webhooks, `.env`, credential resolver internals, `/chat`, `/chat-gateway/execute`, provider runtime, `legacy/`, or `PROJECT_CONTEXT.md`.

## Preview Data
- contextHash: 2fdfb567a22a9ef7523a28acef1d8e49bd26f7a9ee99598a88f71099bef185fa
- stale: false
- tokenBudget: 16k / 16000
- estimatedTokens: 6208
- relevantFiles: 19
- evidenceRefs: 700

## Safety
- providerCallsMade=false
- rawSecretAccessed=false
- secretValueExposed=false
- rawWebhookAccessed=false
- webhookValueExposed=false
- codexBaseUrlModified=false
- codexConfigModified=false
- chatModified=false
- chatGatewayExecuteModified=false
- deployExecuted=false
- releaseExecuted=false
- tagCreated=false
- artifactUploaded=false
- workspaceCleanClaimed=false
