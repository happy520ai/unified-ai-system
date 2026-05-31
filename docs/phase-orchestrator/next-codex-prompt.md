【Generated Next Phase Prompt】
selectedNextPhase: Phase564
selectedNextPhaseTitle: Auto-run Value Audit + Deduplication + Registry Freeze
riskLevel: low
humanApprovalRequired: false
readyToExecute: false
promptGeneratedAt: 2026-05-30T00:56:03.342Z

# Generated Next Phase Prompt - Phase564

你现在在 unified-ai-system 仓库中工作。

当前基线：
- latestPhase: Phase1955P-Retry-Fail
- latestResultPath: apps/ai-gateway-service/evidence/phase1955p_retry_fail/nvidia-route-failure-closure-result.json
- completed: true
- recommended_sealed: true
- validationsPassed: true

允许范围：
- selectedNextPhase=Phase564
- title=Auto-run Value Audit + Deduplication + Registry Freeze
- riskLevel=low
- allowedExecutionMode=docs_evidence_registry_freeze_only
- 仅限低风险 docs / evidence / schema / dry-run / local validation。

禁止事项：
- 不修改 legacy/ / PROJECT_CONTEXT.md / provider runtime / chat 主链。
- 不调用 provider / 不读取 secret / 不 deploy / 不 release。
- 不伪造 approval / 不伪造 evidence / 不声称 workspace clean。

安全边界必须保持：
- providerCallsMade=false
- nonNvidiaProviderCallsMade=false
- secretValueExposed=false
- rawSecretAccessed=false
- deployExecuted=false
- releaseExecuted=false
- tagCreated=false
- artifactUploaded=false
- billingExecuted=false
- invoiceGenerated=false
- approvalForged=false
- workspaceCleanClaimed=false

本 prompt 仅在 low risk 且 meta/prompt 一致时可作为执行模板。
