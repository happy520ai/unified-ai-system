# Phase594C Freshness Gate Stale Stopper

## Scope
- Codex Context Gateway Usage Workflow is a preview-only workflow for reading `.codex-context` before future Codex task execution.
- It uses context pack preflight, freshness gate, relevant-file scope, prompt pack loading, validation planning, dry-run runner wrapper, operator checklist, and evidence writing.
- It does not modify real Codex config, does not change Codex base_url, does not connect Codex, and does not call providers.
- It does not read raw secrets, raw webhooks, `.env`, credential resolver internals, `/chat`, `/chat-gateway/execute`, provider runtime, `legacy/`, or `PROJECT_CONTEXT.md`.

## Preview Data
- contextHash: 2fdfb567a22a9ef7523a28acef1d8e49bd26f7a9ee99598a88f71099bef185fa
- stale: false
- tokenBudgetRespected: true
- relevantFiles: 19
- validationCommands: 8
- dryRunTaskReady: true

## Safety
- providerCallsMade=false
- rawSecretAccessed=false
- secretValueExposed=false
- rawWebhookAccessed=false
- webhookValueExposed=false
- codexBaseUrlModified=false
- codexConfigModified=false
- realCodexConnectionMade=false
- chatModified=false
- chatGatewayExecuteModified=false
- deployExecuted=false
- releaseExecuted=false
- tagCreated=false
- artifactUploaded=false
- workspaceCleanClaimed=false
