// =============================================================================
// diagnosticsRoutes.js — 诊断/健康/监控路由模块
// 从 httpServer.js 抽取的第一批路由,作为渐进式重构的示范
// =============================================================================

import { writeJson } from "./utils/responseUtils.js";
import { createOkEnvelope } from "@unified-ai-system/shared-utils";

/**
 * 创建诊断相关路由的 handler 集合
 * @param {Object} application - Gateway application context
 * @returns {Object} { handlers: Map<string, Function>, createHealth, createSetupReadiness }
 */
export function createDiagnosticsRoutes(application) {
  const {
    auditHashChain,
    authRateLimiter,
    circuitBreakerRegistry,
    enterpriseGovernanceService,
    gatewayService,
    knowledgeInfra,
    knowledgeService,
    metricsCollector,
    promClientExporter,
    revocationStore,
    workforceService,
    workflowService,
  } = application;

  /**
   * GET /health — 系统健康检查
   */
  async function handleHealth(_req, res, { startedAt }) {
    const health = createHealth();
    writeJson(res, 200, createOkEnvelope(health, { startedAt }));
  }

  /**
   * GET /health/check — 完整健康检查（与 /health 一致）
   */
  async function handleHealthCheck(_req, res, { startedAt }) {
    const health = createHealth();
    writeJson(res, 200, createOkEnvelope(health, { startedAt }));
  }

  /**
   * GET /metrics — 指标收集（使用 prom-client）
   */
  async function handleMetrics(req, res, { startedAt }) {
    // 记录请求到 prom-client
    if (promClientExporter) {
      promClientExporter.recordHttpRequest(req.method, "/metrics", 200, Date.now() - startedAt);
    }

    const accept = req.headers?.accept ?? "";
    if (accept.includes("text/plain") || req.url?.includes("format=prometheus") || !accept.includes("application/json")) {
      // Prometheus text 格式（默认）
      try {
        const metrics = promClientExporter ? await promClientExporter.getMetrics() : "# No metrics configured\n";
        if (!res.writableEnded && !res.headersSent) {
          res.writeHead(200, { "content-type": promClientExporter?.getContentType() ?? "text/plain; version=0.0.4; charset=utf-8" });
          res.end(metrics);
        }
      } catch (err) {
        if (!res.writableEnded && !res.headersSent) {
          res.writeHead(500, { "content-type": "text/plain" });
          res.end("# Error collecting metrics\n");
        }
      }
    } else {
      // JSON 格式（向后兼容）
      const metrics = metricsCollector ? metricsCollector.getSnapshot() : { enabled: false };
      writeJson(res, 200, createOkEnvelope({ route: "/metrics", metrics, promClient: promClientExporter?.getHealth() }, { startedAt }));
    }
  }

  /**
   * GET /dashboard/status — 总控台状态
   */
  async function handleDashboardStatus(_req, res, { startedAt }) {
    const health = createHealth();
    writeJson(res, 200, createOkEnvelope({
      route: "/dashboard/status",
      status: health.status,
      providerMode: health.providerMode,
      realProviderEnabled: health.realProviderEnabled,
      providerCount: health.providers?.length ?? 0,
      knowledge: health.knowledge,
      workforce: health.workforce,
      enterprise: health.enterprise,
      memory: health.memory,
    }, { startedAt }));
  }

  /**
   * GET /auth/status — 认证状态
   */
  async function handleAuthStatus(req, res, { startedAt }) {
    const identity = req.enterpriseIdentity ?? null;
    writeJson(res, 200, createOkEnvelope({
      route: "/auth/status",
      authenticated: !!identity,
      identity,
    }, { startedAt }));
  }

  /**
   * GET /setup/readiness — 首次运行就绪检查
   */
  async function handleSetupReadiness(_req, res, { startedAt }) {
    const readiness = createSetupReadiness();
    writeJson(res, 200, createOkEnvelope(readiness, { startedAt }));
  }

  /**
   * GET /ws/info — WebSocket 信息
   */
  async function handleWsInfo(_req, res, { startedAt }) {
    const wsServer = application.wsServer;
    writeJson(res, 200, createOkEnvelope({
      route: "/ws/info",
      websocket: true,
      endpoint: "/ws",
      connectionCount: wsServer?.getConnectionCount?.() ?? 0,
      protocols: ["json"],
      description: "Real-time bidirectional chat via WebSocket",
    }, { startedAt }));
  }

  // ── 内部辅助函数 ──

  function createHealth() {
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
      ],
      knowledge: knowledgeService.getHealth(),
      knowledgeInfra: knowledgeInfra.getReadiness(),
      workflow: workflowService.getHealth(),
      workforce: workforceService.getHealth(),
      enterprise: enterpriseGovernanceService.getHealth(),
      providerMode: application.config.aiGatewayService.providerMode,
      realProviderEnabled: application.config.aiGatewayService.realProviderEnabled,
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

  function createSetupReadiness() {
    const health = createHealth();
    const providerDescriptors = gatewayService.getProviderDescriptors();
    const knowledgeHealth = knowledgeService.getHealth();
    const workforceHealth = workforceService.getHealth();
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

  // ── 导出 ──

  const handlers = new Map([
    ["GET /health", { handler: handleHealth, public: true, description: "系统健康检查" }],
    ["GET /health/check", { handler: handleHealthCheck, public: true, description: "存活检查" }],
    ["GET /metrics", { handler: handleMetrics, public: false, permission: "dashboard:read", description: "指标收集" }],
    ["GET /dashboard/status", { handler: handleDashboardStatus, public: false, permission: "dashboard:read", description: "总控台状态" }],
    ["GET /auth/status", { handler: handleAuthStatus, public: true, description: "认证状态" }],
    ["GET /setup/readiness", { handler: handleSetupReadiness, public: true, description: "首次运行就绪" }],
    ["GET /ws/info", { handler: handleWsInfo, public: false, permission: "dashboard:read", description: "WebSocket 信息" }],
  ]);

  return { handlers, createHealth, createSetupReadiness };
}

// ── 辅助:JSON 响应写入(从 httpServer.js 提取,保持兼容) ──
// writeJson, createOkEnvelope 已统一从 ./utils/responseUtils.js 导入（剃刀律）
