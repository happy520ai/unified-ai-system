import { listModelImportProviders } from "../../model-import/providerProbeRegistry.js";

export function createHealth(application) {
  const realProviderEnabled = application.config.aiGatewayService.realProviderEnabled === true;
  const agentGovernance = readAgentGovernanceHealth(application);
  const usageLedger = application.requestLogger?.getHealth?.() ?? {
    status: "disabled",
    persistence: "none",
    durableWritesRequired: false,
  };
  const usageLedgerReady = !realProviderEnabled || (
    usageLedger.status === "ready" && usageLedger.durableWritesRequired === true
  );
  const enterpriseHealth = application.enterpriseGovernanceService.getHealth();
  const enterpriseReady = enterpriseHealth.status === "ready";
  const localClientExecutionRequested = application.localClientExecutionReadiness?.requested === true;
  const feedbackOutbox = application.localClientExecutionFeedbackOutboxStatus ?? {
    available: false,
    durable: false,
  };
  const feedbackDispatcher = application.localClientExecutionFeedbackDispatcherStatus ?? {
    available: false,
    lifecycle: "disabled",
  };
  const receiptJournal = application.localClientExecutionReceiptJournalStatus ?? {
    enabled: false,
    available: false,
    durable: false,
    distributed: false,
    singleHost: true,
    bindingCount: 0,
    recoveryContextEncrypted: false,
    snapshotRollbackProtected: false,
    clientAtomicEffectReceiptVerified: false,
  };
  const receiptRecovery = application.localClientExecutionReceiptRecoveryStatus ?? {
    enabled: false,
    available: false,
    lifecycle: "disabled",
    executionRedispatchAllowed: false,
    runInFlight: false,
    runCount: 0,
    resolvedCount: 0,
    unresolvedCount: 0,
    failureCount: 0,
    consecutiveFailureCount: 0,
    lastErrorCode: null,
    lastRunSucceeded: null,
    lastSuccessAt: null,
    lastRunAt: null,
  };
  const receiptRecoveryActiveFailure = hasActiveLocalClientReceiptRecoveryFailure(
    receiptRecovery,
  );
  const localClientFeedbackReady = !receiptRecoveryActiveFailure
    && (!localClientExecutionRequested || (
      feedbackOutbox.available === true
      && feedbackOutbox.durable === true
      && feedbackDispatcher.available === true
      && feedbackDispatcher.lifecycle === "started"
      && receiptJournal.available === true
      && receiptJournal.durable === true
      && receiptJournal.recoveryContextEncrypted === true
      && receiptRecovery.available === true
      && receiptRecovery.lifecycle === "started"
      && receiptRecovery.executionRedispatchAllowed === false
    ));
  const managedProtocolDispatch = application.localClientManagedProtocolDispatchStatus ?? {
    enabled: false,
    ready: false,
    blockers: [],
  };
  const managedProtocolReady = managedProtocolDispatch.enabled !== true
    || managedProtocolDispatch.ready === true;
  return {
    app: "ai-gateway-service",
    status: usageLedgerReady
      && enterpriseReady
      && localClientFeedbackReady
      && managedProtocolReady
      && agentGovernance.ready === true
      ? "ready"
      : "degraded",
    phase: "phase-7a-1-service-entry",
    routes: [
    "GET /health/check",
    "GET /healthz",
    "GET /ready",
      "POST /agent-runner/intent-approval-preview",
      "POST /agent-runner/local-operation",
      "GET /setup/readiness",
      "GET /enterprise/health",
      "GET /enterprise/session",
      "GET /enterprise/roles",
      "GET /enterprise/users",
      "POST /enterprise/users",
      "POST /enterprise/users/revoke",
      "GET /enterprise/security/readiness",
      "GET /enterprise/audit",
      "GET /enterprise/audit/export",
      "GET /enterprise/acceptance/report",
      "GET /enterprise/release-candidate/dry-run",
      "GET /enterprise/overview",
      "GET /enterprise/deployment/readiness",
      "GET /enterprise/startup/readiness",
      "POST /enterprise/backup",
      "POST /enterprise/restore/validate",
      "GET /dashboard/status",
      "GET /auth/status",
      "GET /providers",
      "GET /provider-config/status",
      "POST /provider-config/save",
      "POST /provider-config/test",
      "GET /model-library",
      "POST /model-library/refresh",
      "POST /model-library/test-model",
      "POST /model-library/task-default",
      "GET /connectors",
      "GET /config/runtime",
      "POST /providers/runtime-credential/detect",
      "POST /providers/runtime-credential",
      "GET /models/import/providers",
      "POST /models/import/preview",
      "POST /models/import/confirm",
      "GET /models/capability-router/status",
      "POST /models/capability-router/preview",
      "GET /codex-handoff/next-task",
      "GET /codex-loop/status",
      "GET /cost/health",
      "POST /cost/estimate",
      "POST /cost/guard/check",
      "GET /cost/summary",
      "GET /usage/summary",
      "GET /usage/logs",
      "GET /cache/health",
      "POST /cache/lookup",
      "POST /cache/write",
      "POST /cache/invalidate",
      "GET /cache/summary",
      "GET /cache/audit",
      "POST /routing/answer-path/preview",
      "POST /routing/quality-cost/preview",
      "POST /codex-handoff/next-task",
      "GET /route/modes",
      "GET /knowledge/health",
      "GET /knowledge/infra/readiness",
      "GET /knowledge/sources",
      "GET /knowledge/file-types",
      "GET /workflow/health",
      "GET /workflow/actions",
      "GET /workforce/health",
      "GET /workforce/agents",
      "GET /workforce/plans",
      "GET /workforce/plans/:id",
      "GET /workforce/plans/:id/export",
      "POST /workforce/plans/:id/clarifications",
      "POST /workforce/plans/:id/lifecycle",
      "GET /workforce/plans/:id/review-package",
      "POST /workforce/plans/:id/approval-gate",
      "POST /prompts/enhance",
      "GET /v1/models",
      "POST /v1/chat/completions",
      "POST /v1/messages",
      "POST /chat",
      "POST /chat/stream",
      "POST /chat/rag",
      "POST /chat/rag/stream",
      "POST /connectors/import/text",
      "POST /evaluation/score",
      "POST /knowledge/load",
      "POST /knowledge/load/file",
      "POST /knowledge/graph/retrieve",
      "POST /knowledge/retrieve",
      "GET /memory/list",
      "POST /memory/save",
      "POST /memory/retrieve",
      "POST /workflow/plan",
      "POST /workflow/run",
      "POST /workforce/plan",
      "POST /workforce/run-local",
      "POST /workforce/execute",
      "POST /workforce/execute/approve",
      "POST /workforce/execute/revoke",
      "POST /workforce/execute/status",
      "POST /workforce/execute/cancel",
      "GET /real-capabilities/status",
      "POST /real-capabilities/activate-five",
      "POST /chat-gateway/execute",
      "POST /chat/gateway",
      "POST /three-mode/execute",
      "GET /chat-gateway/latency-policy",
      "POST /chat-gateway/latency-dry-run",
      "POST /workforce/plans/save",
      "DELETE /workforce/plans/:id",
      "POST /route",
    ],
    knowledge: application.knowledgeService.getHealth(),
    knowledgeInfra: application.knowledgeInfra.getReadiness(),
    workflow: application.workflowService.getHealth(),
    workforce: application.workforceService.getHealth(),
    enterprise: enterpriseHealth,
    agentGovernance,
    usageLedger: {
      ...usageLedger,
      requiredForRealProviders: realProviderEnabled,
    },
    localClientExecutionFeedback: {
      required: localClientExecutionRequested,
      ready: localClientFeedbackReady,
      activeRecoveryFailure: receiptRecoveryActiveFailure,
      outbox: feedbackOutbox,
      dispatcher: feedbackDispatcher,
      receiptJournal,
      receiptRecovery,
    },
    managedLocalClientProtocol: managedProtocolDispatch,
    localClientPopSnapshotRollbackProtection:
      application.localClientPopSnapshotRollbackProtectionStatus ?? null,
    providerMode: application.config.aiGatewayService.providerMode,
    realProviderEnabled,
    providers: application.gatewayService.getProviderDescriptors(),
  };
}

export function hasActiveLocalClientReceiptRecoveryFailure(status) {
  return status?.lifecycle === "started"
    && status?.lastRunSucceeded === false
    && Number.isSafeInteger(status?.consecutiveFailureCount)
    && status.consecutiveFailureCount > 0;
}

export function createSetupReadiness(application) {
  const health = createHealth(application);
  const providerCatalog = listModelImportProviders();
  const providerDescriptors = application.gatewayService.getProviderDescriptors();
  const knowledgeHealth = application.knowledgeService.getHealth();
  const workforceHealth = application.workforceService.getHealth();
  const modelImportReady = providerCatalog.length > 0;
  const chatReady = providerDescriptors.length > 0 && health.status === "ready";
  const knowledgeReady = knowledgeHealth.status === "ready" || knowledgeHealth.ready === true;
  const workforceReady = workforceHealth.status === "ready" && workforceHealth.ready === true;
  const agentGovernanceBlocksSetup = health.agentGovernance.enabled === true
    && health.agentGovernance.ready !== true;

  return {
    phase: "phase-104a-first-run-setup",
    // Preserve the established first-run contract for optional/degraded
    // dependencies. Agent Governance is different when explicitly enabled:
    // its owner and integrity fences are mandatory execution prerequisites.
    status: agentGovernanceBlocksSetup ? "degraded" : "ready",
    userMessage: "首次使用只需要按步骤完成健康检查、模型检测，然后就可以开始聊天；知识库和 Agent Workforce 可以按需打开。",
    steps: [
      {
        stepId: "service-health",
        title: "系统健康检查",
        status: health.status === "ready" ? "ready" : "needs_attention",
        ready: health.status === "ready",
        nextAction: "如果不是 ready，先运行 health / doctor / logs 查看服务状态。",
      },
      {
        stepId: "agent-governance",
        title: "Agent Governance 控制面",
        status: health.agentGovernance.ready ? "ready" : "needs_attention",
        ready: health.agentGovernance.ready,
        nextAction: health.agentGovernance.enabled
          ? "检查 owner lease、启动恢复和治理审计完整性。"
          : "Agent Governance 未启用；启用后将自动纳入 readiness。",
      },
      {
        stepId: "model-import",
        title: "添加模型 / 检测 API Key",
        status: modelImportReady ? "ready" : "needs_attention",
        ready: modelImportReady,
        nextAction: "粘贴 API Key 后点击识别可用模型；识别不了时选择 provider 或填写 Base URL。",
      },
      {
        stepId: "chat",
        title: "开始聊天",
        status: chatReady ? "ready" : "needs_attention",
        ready: chatReady,
        nextAction: "模型检测通过后直接在聊天框输入问题，也可以先用服务端默认路由试聊。",
      },
      {
        stepId: "workforce",
        title: "Agent Workforce 计划预览",
        status: workforceReady ? "ready" : "needs_attention",
        ready: workforceReady,
        nextAction: "输入目标生成 AI 团队计划；当前只做计划预览，不执行代码、不修改文件。",
      },
      {
        stepId: "knowledge-rag",
        title: "Knowledge / RAG 可选",
        status: knowledgeReady ? "ready" : "needs_attention",
        ready: knowledgeReady,
        nextAction: "拖入文档或使用知识库接口装载资料；聊天会在需要时检索本地知识。",
      },
      {
        stepId: "release-boundary",
        title: "发布前限制说明",
        status: "preview",
        ready: true,
        nextAction: "当前不是全球发布完成态；多 provider 自动路由、真实 fallback、真实多 Agent 执行仍需后续明确主线。",
      },
    ],
    readiness: {
      health: {
        ready: health.status === "ready",
        status: health.status,
        service: health.app,
      },
      agentGovernance: health.agentGovernance,
      modelImport: {
        ready: modelImportReady,
        providerCatalogCount: providerCatalog.length,
        nextAction: "使用 /models/import/preview 真实调用 provider models/list，不靠 API Key 文本猜模型。",
      },
      chat: {
        ready: chatReady,
        providerCount: providerDescriptors.length,
        defaultLane: "NVIDIA single-provider / server-side configured route remains unchanged",
        nextAction: "普通用户直接从聊天框开始；失败时先按模型配置提示处理。",
      },
      knowledge: {
        ready: knowledgeReady,
        mode: knowledgeHealth.mode ?? "local-keyword",
        storage: knowledgeHealth.storage ?? "local",
        nextAction: "可选导入资料后再提问，默认仍是 local keyword retrieval。",
      },
      workforce: {
        ready: workforceReady,
        mode: workforceHealth.mode,
        roleCount: workforceHealth.roleCount,
        nextAction: "适合做需求拆解、角色分工、任务包导出；不会自动执行。",
      },
    },
    limitations: [
      "Agent Workforce is plan preview only; it does not run code or modify project files.",
      "Model import discovers models through provider models/list; it does not guess models from API key text.",
      "Default /chat main lane remains unchanged.",
      "This readiness check does not call real providers and does not expose API keys.",
      "This is not a claim that global release, SSO/IAM, real fallback execution, or production multi-agent execution is complete.",
    ],
    safety: {
      apiKeyExposed: false,
      providerProbeCalled: false,
      defaultChatMainLaneChanged: false,
      workforceExecution: false,
      projectFileWrites: false,
    },
  };
}

function readAgentGovernanceHealth(application) {
  const snapshot = application?.agentGovernanceHealth?.snapshot?.();
  if (snapshot && typeof snapshot === "object") {
    return {
      enabled: snapshot.enabled === true,
      ready: snapshot.ready === true,
      status: normalizeGovernanceHealthValue(snapshot.status, ["disabled", "initializing", "ready", "degraded"], "degraded"),
      ownerLease: normalizeGovernanceHealthValue(snapshot.ownerLease, ["not_required", "held", "lost"], "lost"),
      startupRecovery: normalizeGovernanceHealthValue(snapshot.startupRecovery, ["not_required", "pending", "ready", "failed"], "failed"),
      stateIntegrity: normalizeGovernanceHealthValue(snapshot.stateIntegrity, ["not_required", "pending", "verified", "failed"], "failed"),
      auditIntegrity: normalizeGovernanceHealthValue(snapshot.auditIntegrity, ["not_required", "pending", "verified", "failed"], "failed"),
      failureCode: normalizeGovernanceHealthValue(snapshot.failureCode, [
        "owner_lease_lost",
        "startup_recovery_failed",
        "state_integrity_failed",
        "audit_integrity_failed",
        "governance_health_unavailable",
      ], null),
      checkedAt: normalizeGovernanceCheckedAt(snapshot.checkedAt),
    };
  }
  if (!application?.agentGovernance) {
    return {
      enabled: false,
      ready: true,
      status: "disabled",
      ownerLease: "not_required",
      startupRecovery: "not_required",
      stateIntegrity: "not_required",
      auditIntegrity: "not_required",
      failureCode: null,
      checkedAt: null,
    };
  }
  return {
    enabled: true,
    ready: false,
    status: "initializing",
    ownerLease: "lost",
    startupRecovery: "pending",
    stateIntegrity: "pending",
    auditIntegrity: "pending",
    failureCode: "governance_health_unavailable",
    checkedAt: null,
  };
}

function normalizeGovernanceHealthValue(value, allowed, fallback) {
  return allowed.includes(value) ? value : fallback;
}

function normalizeGovernanceCheckedAt(value) {
  if (typeof value !== "string" || !Number.isFinite(Date.parse(value))) return null;
  return new Date(value).toISOString();
}
