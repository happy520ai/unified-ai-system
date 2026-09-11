import { listModelImportProviders } from "../../model-import/providerProbeRegistry.js";
import { getRuntimeBuildIdentity } from "../../application/runtimeBuildIdentity.ts";

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
    buildIdentity: getRuntimeBuildIdentity(),
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
    enterprise: toPathSafeEnterpriseHealth(enterpriseHealth),
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

// createHealth feeds the unauthenticated /healthz, /ready, and /health/check
// surfaces, so host storage paths must stay out of the payload (mirrors
// getPublicHealth's pathExposed:false contract). Full-detail enterprise health
// remains available through enterpriseGovernanceService.getHealth() directly.
function toPathSafeEnterpriseHealth(enterpriseHealth) {
  const userStore = { ...(enterpriseHealth?.userStore ?? {}) };
  const apiKeys = { ...(enterpriseHealth?.apiKeys ?? {}) };
  const audit = { ...(enterpriseHealth?.audit ?? {}) };
  userStore.pathConfigured = Boolean(userStore.path);
  apiKeys.storePathConfigured = Boolean(apiKeys.storePath);
  audit.pathConfigured = Boolean(audit.path);
  delete userStore.path;
  delete apiKeys.storePath;
  delete audit.path;
  return {
    ...enterpriseHealth,
    userStore: { ...userStore, pathExposed: false },
    apiKeys: { ...apiKeys, pathExposed: false },
    audit: { ...audit, pathExposed: false },
  };
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
  const providerMode = ["fake", "auto", "real"].includes(health.providerMode)
    ? health.providerMode
    : "unknown";
  const providerSelection = application.config.aiGatewayService.providerSelection;
  const configuredDefault = providerSelection?.defaultProviderId;
  const registeredDefault = providerDescriptors.find((provider) => provider.id === configuredDefault)?.id;
  const fixedDefaultUnavailable = providerSelection?.mode === "fixed"
    && Boolean(configuredDefault) && !registeredDefault;
  const routeDescription = providerSelection?.mode !== "fixed"
    ? "由已注册 Provider 按服务端路由策略选择"
    : registeredDefault
      ? `固定路由配置默认 Provider：${registeredDefault}；模型匹配仍需验证`
      : fixedDefaultUnavailable
        ? "固定默认 Provider 未注册或未启用，请检查路由配置"
        : "固定路由未指定默认 Provider，请核对默认模型配置";
  const modeLabel = {
    fake: "本地模拟模式（fake）",
    auto: "自动选择模式（auto）",
    real: "真实供应方模式（real）",
    unknown: "运行模式未知",
  }[providerMode];
  const defaultLane = [
    modeLabel,
    health.realProviderEnabled ? "真实调用开关已开启，仍受执行策略约束" : "真实调用已禁用",
    routeDescription,
  ].join("；");
  const chatNextAction = fixedDefaultUnavailable
    ? "先检查固定路由配置：默认 Provider 必须已注册并启用，默认模型需匹配；使用 pnpm gateway status --json 查看当前实例。"
    : !chatReady
    ? "先运行 pnpm gateway status --json 查看失败条件，再运行 pnpm gateway doctor --json 检查本地环境。"
    : providerMode !== "unknown" && providerMode !== "real" && !health.realProviderEnabled
      ? '使用 pnpm gateway chat "你好" --json 验证本地调用；本就绪检查尚未执行该请求。'
      : "先核对 pnpm gateway status --json 的模式与策略；只有明确允许本次真实调用时，才为 pnpm gateway chat 添加 --allow-real-provider。";

  return {
    phase: "phase-104a-first-run-setup",
    // Preserve the established first-run contract for optional/degraded
    // dependencies. Agent Governance is different when explicitly enabled:
    // its owner and integrity fences are mandatory execution prerequisites.
    status: agentGovernanceBlocksSetup ? "degraded" : "ready",
    userMessage: "按步骤检查当前实例的装配条件；这些检查不会调用模型。聊天、知识和受治理执行应分别验证。",
    steps: [
      {
        stepId: "service-health",
        title: "系统健康检查",
        status: health.status === "ready" ? "ready" : "needs_attention",
        ready: health.status === "ready",
        nextAction: "运行 pnpm gateway status --json 查看实例状态，使用 pnpm gateway doctor --json 检查本地环境；部署流量就绪状态以 GET /ready 为准。",
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
        title: "模型导入（可选）",
        status: modelImportReady ? "ready" : "needs_attention",
        ready: modelImportReady,
        nextAction: "这是可选的真实 Provider 导入步骤；目录可用只代表存在导入适配器。本地 fake 体验无需密钥，真实模型验证通过已授权的 /models/import/preview 接口进行。",
      },
      {
        stepId: "chat",
        title: "开始聊天",
        status: chatReady ? "ready" : "needs_attention",
        ready: chatReady,
        nextAction: chatNextAction,
      },
      {
        stepId: "workforce",
        title: "Agent Workforce 计划预览",
        status: workforceReady ? "ready" : "needs_attention",
        ready: workforceReady,
        nextAction: "使用计划与导出接口拆解目标；实际任务执行须走独立的受治理执行路径。本检查不会执行任务或修改文件。",
      },
      {
        stepId: "knowledge-rag",
        title: "Knowledge / RAG 可选",
        status: knowledgeReady ? "ready" : "needs_attention",
        ready: knowledgeReady,
        nextAction: "按知识库接口文档装载资料并验证检索；需要 RAG 的聊天请求须显式启用相应选项，不会自动读取所有资料。",
      },
      {
        stepId: "release-boundary",
        title: "发布前限制说明",
        status: "preview",
        ready: true,
        nextAction: "本次检查未验证真实 Provider、客户端操作、备份恢复或持续运行。上线前需用同一候选版本分别完成这些验证。",
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
        nextAction: "目录数量表示可用的导入适配器，不代表已验证模型。经明确授权后使用 /models/import/preview 查询真实 Provider 的模型列表。",
      },
      chat: {
        ready: chatReady,
        providerCount: providerDescriptors.length,
        defaultLane,
        nextAction: chatNextAction,
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
        nextAction: "计划与交付包用于审阅；实际动作须走受治理执行接口，并另行检查审批、权限和执行回执。",
      },
    },
    limitations: [
      "Workforce planning and delivery packages remain previews; governed execution uses separate approval-gated routes.",
      "Model import discovers models through provider models/list; it does not guess models from API key text.",
      "Default /chat main lane remains unchanged.",
      "This readiness check does not call real providers and does not expose API keys.",
      "Readiness does not replace real-provider, client, failover, recovery, or production verification.",
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
