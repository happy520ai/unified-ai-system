// =============================================================================
// healthUtils.js — 健康检查工具函数
// 从 httpServer.js 提取的健康检查相关工具
// =============================================================================

/**
 * 创建健康检查响应
 */
export function createHealth(application) {
  const {
    gatewayService,
    knowledgeService,
    knowledgeInfra,
    workflowService,
    workforceService,
    enterpriseGovernanceService,
    metricsCollector,
    circuitBreakerRegistry,
    auditHashChain,
    authRateLimiter,
    revocationStore,
    config,
  } = application;

  return {
    app: "ai-gateway-service",
    status: "ready",
    phase: "phase-7a-1-service-entry",
    routes: [
      "GET /health/check",
      "GET /ui",
      "GET /console",
      "POST /chat",
      "POST /chat/stream",
      "POST /chat/rag",
      "GET /providers",
      "GET /config/runtime",
      "GET /knowledge/health",
      "GET /knowledge/infra/readiness",
      "GET /knowledge/sources",
      "POST /knowledge/load",
      "POST /knowledge/retrieve",
      "GET /workforce/health",
      "GET /enterprise/health",
      "GET /setup/readiness",
      "GET /api-docs",
      "GET /slo",
      "GET /observability/status",
      "GET /metrics",
    ],
    knowledge: knowledgeService.getHealth(),
    knowledgeInfra: knowledgeInfra.getReadiness(),
    workflow: workflowService.getHealth(),
    workforce: workforceService.getHealth(),
    enterprise: enterpriseGovernanceService.getHealth(),
    providerMode: config.aiGatewayService.providerMode,
    realProviderEnabled: config.aiGatewayService.realProviderEnabled,
    providers: gatewayService.getProviderDescriptors(),
    securityInfra: {
      auditHashChain: auditHashChain ? { enabled: true, entryCount: auditHashChain.getEntryCount() } : { enabled: false },
      revocationStore: revocationStore ? { enabled: true, ...revocationStore.getStats() } : { enabled: false },
      authRateLimiter: authRateLimiter ? { enabled: true, ...authRateLimiter.getStats() } : { enabled: false },
      metricsCollector: metricsCollector ? { enabled: true } : { enabled: false },
      circuitBreakerRegistry: circuitBreakerRegistry ? { enabled: true, breakers: circuitBreakerRegistry.getStats() } : { enabled: false },
    },
    memory: process.memoryUsage(),
  };
}

/**
 * 创建设置就绪响应
 */
export function createSetupReadiness(application) {
  const health = createHealth(application);
  const providerDescriptors = application.gatewayService.getProviderDescriptors();
  const knowledgeHealth = application.knowledgeService.getHealth();
  const workforceHealth = application.workforceService.getHealth();
  const chatReady = providerDescriptors.length > 0 && health.status === "ready";
  const knowledgeReady = knowledgeHealth.status === "ready" || knowledgeHealth.ready === true;
  const workforceReady = workforceHealth.status === "ready" && workforceHealth.ready === true;

  return {
    phase: "phase-104a-first-run-setup",
    status: "ready",
    readiness: {
      health: { ready: health.status === "ready", status: health.status },
      chat: { ready: chatReady, providerCount: providerDescriptors.length },
      knowledge: { ready: knowledgeReady, mode: knowledgeHealth.mode ?? "local-keyword" },
      workforce: { ready: workforceReady, mode: workforceHealth.mode, roleCount: workforceHealth.roleCount },
    },
    safety: {
      apiKeyExposed: false,
      providerProbeCalled: false,
      defaultChatMainLaneChanged: false,
      workforceExecution: false,
      projectFileWrites: false,
    },
    memory: process.memoryUsage(),
  };
}

/**
 * 解析权限
 */
export function resolvePermission(method, pathname) {
  // 公开路由
  if (isPublicRoute(pathname)) return "public";

  // 企业路由
  if (pathname.startsWith("/enterprise/")) return "enterprise:admin";

  // 知识库路由
  if (pathname.startsWith("/knowledge/")) return "knowledge:read";

  // Workforce 路由
  if (pathname.startsWith("/workforce/")) return "workflow:run";

  // 默认需要认证
  return "authenticated";
}

/**
 * 判断是否为公开路由
 */
export function isPublicRoute(pathname) {
  return (
    pathname === "/" ||
    pathname === "/ui" ||
    pathname === "/console" ||
    pathname === "/api-docs" ||
    pathname === "/api-docs/spec.json" ||
    pathname === "/slo" ||
    pathname === "/observability/status" ||
    pathname === "/connection-pool" ||
    pathname === "/health" ||
    pathname === "/health/check" ||
    pathname === "/metrics" ||
    pathname === "/auth/login" ||
    pathname === "/auth/status" ||
    pathname === "/auth/token" ||
    pathname === "/auth/refresh" ||
    pathname === "/auth/revoke" ||
    pathname === "/setup/readiness" ||
    pathname === "/ws/info" ||
    pathname === "/providers" ||
    pathname === "/config/runtime" ||
    pathname === "/route/modes" ||
    pathname === "/knowledge/health" ||
    pathname === "/knowledge/infra/readiness" ||
    pathname === "/knowledge/sources" ||
    pathname === "/knowledge/file-types" ||
    pathname === "/forge/health" ||
    pathname === "/workforce/health" ||
    pathname === "/enterprise/health" ||
    pathname === "/enterprise/session" ||
    pathname === "/enterprise/roles" ||
    pathname === "/enterprise/security/readiness" ||
    pathname === "/enterprise/overview" ||
    pathname === "/cost/health" ||
    pathname === "/cache/health" ||
    pathname === "/dashboard/status" ||
    pathname === "/models/capability-router/status" ||
    pathname === "/models/library" ||
    pathname.endsWith(".html") ||
    pathname.endsWith(".css") ||
    pathname.endsWith(".js") ||
    pathname.endsWith(".svg") ||
    pathname.endsWith(".png") ||
    pathname.endsWith(".ico")
  );
}

/**
 * 读取审计过滤器
 */
export function readAuditFilters(url) {
  const filters = {};
  if (url.searchParams.has("userId")) filters.userId = url.searchParams.get("userId");
  if (url.searchParams.has("action")) filters.action = url.searchParams.get("action");
  if (url.searchParams.has("outcome")) filters.outcome = url.searchParams.get("outcome");
  if (url.searchParams.has("method")) filters.method = url.searchParams.get("method");
  if (url.searchParams.has("path")) filters.path = url.searchParams.get("path");
  if (url.searchParams.has("limit")) filters.limit = readBoundedInteger(url.searchParams.get("limit"), 200, 1, 2000);
  return filters;
}

/**
 * 读取有界整数
 */
function readBoundedInteger(value, fallback, min, max) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(min, Math.min(max, Math.round(parsed)));
}
