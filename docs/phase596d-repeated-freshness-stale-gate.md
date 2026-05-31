# Phase596D Repeated Freshness Stale Gate

## Scope
- Phase596 is a repeated `.codex-context` usage benchmark, not a Codex base_url integration.
- It benchmarks 10 small docs tasks for context pack usage, freshness guard, relevant file scope, prompt pack loading, token saving, read audit, validation, and full repo scan avoidance.
- It does not connect a real Codex relay, call providers, read secrets/webhooks, modify `/chat`, modify `/chat-gateway/execute`, modify provider runtime, deploy, release, tag, or upload artifacts.

## Benchmark Summary
- contextHash: 2fdfb567a22a9ef7523a28acef1d8e49bd26f7a9ee99598a88f71099bef185fa
- executedTaskCount: 10
- averageTokenSavingPercent: 97
- fullRepoScanFlaggedCount: 0
- failedTaskCount: 0
- benchmarkStatus: pass

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
