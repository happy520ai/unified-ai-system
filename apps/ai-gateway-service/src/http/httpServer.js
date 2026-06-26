import { createServer } from "node:http";
import { randomUUID } from "node:crypto";
import { readFile, stat } from "node:fs/promises";
import { dirname, resolve, join, extname } from "node:path";
import { fileURLToPath } from "node:url";
import { createErrorEnvelope, createOkEnvelope } from "@unified-ai-system/shared-utils";
import { matchForgeRoute } from "@unified-ai-system/forge-core/integration/forge-routes.js";
import { createConsolePage } from "../ui/consolePage.js";
import { createChatRagRoutes } from "./httpServerChatRagRoutes.js";
import { createHttpServerCapabilityRoutes } from "./httpServerCapabilityRoutes.js";
import { createChatRoutes as createChatStreamRoutes } from "./httpServerChatRoutes.js";
import {
  writeJson,
  writeHtml,
  readJson,
  writeServiceLog,
  writeErrorResponse,
} from "./utils/responseUtils.js";
import { readCapabilityJson, readEnterpriseJson } from "./utils/enterpriseUtils.js";
import { createStaticFileHandler, hasStaticAssets } from "./staticFileServer.js";
import { createRequestLogger } from "./requestLogger.js";
import { createHealthCheckHandler } from "./healthCheck.js";

import { resolvePermission, isPublicRoute } from "./utils/healthUtils.js";

import { createApprovalStore } from "../approval/approvalStore.js";
import { createFileContextStore } from "../file-context/fileContextStore.js";
import { createPhase319LocalOperationService } from "../local-operation/phase319LocalOperationService.js";
import { createRouteRateLimiter } from "./routeRateLimiter.js";
import { createPinoLogger } from "../logging/pinoLogger.js";
import { createWebSocketServer } from "./webSocketServer.js";
import { createDiagnosticsRoutes } from "./diagnosticsRoutes.js";
import { createCostCacheRoutes } from "./costCacheRoutes.js";
import { createKnowledgeRoutes } from "./knowledgeRoutes.js";
import { createWorkforceRoutes } from "./workforceRoutes.js";
import { createEnterpriseRoutes } from "./enterpriseRoutes.js";
import { createChatRoutes } from "./routes/chatRoutes.js";
import { createProviderRoutes } from "./routes/providerRoutes.js";
import { createModelRoutes } from "./routes/modelRoutes.js";
import { createLegacyRoutes } from "./routes/legacyRoutes.js";
import { createAgentRunnerRoutes } from "./routes/agentRunnerRoutes.js";
import { createAuthRoutes } from "./routes/authRoutes.js";
import { generateOpenApiSpec } from "./openApiGenerator.js";
import { createSwaggerUiPage } from "./swaggerUi.js";
import { createPrometheusExporter } from "../observability/prometheusExporter.js";
import { createPromClientExporter } from "../observability/promClientExporter.js";
import { createTracer } from "../observability/openTelemetry.js";
import { createSloTracker } from "../observability/sloTracker.js";
import { createConnectionPoolOptimizer } from "./connectionPoolOptimizer.js";
import { createAuthTokenService } from "../enterprise/authTokenService.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, "../../../..");
const logger = createPinoLogger({ app: "ai-gateway-service", level: "info" });

export function createGatewayHttpServer(application) {
  const { authRateLimiter, capabilityRouterService, circuitBreakerRegistry, enterpriseGovernanceService, forgeService, gatewayService, knowledgeService, metricsCollector, modelLibraryStore, providerConfigRoutes, workforceService } = application;
  const approvalStore = createApprovalStore();
  const fileContextStore = createFileContextStore();
  const phase319LocalOperation = createPhase319LocalOperationService();
  const rateLimiter = createRouteRateLimiter({});

  const connectorFeishuDryRun = !(application.runtimeEnv?.FEISHU_WEBHOOK_URL || process.env.FEISHU_WEBHOOK_URL);
  const connectorWeComDryRun = !(application.runtimeEnv?.WECOM_WEBHOOK_URL || process.env.WECOM_WEBHOOK_URL);

  // ── 路由模块初始化(渐进式迁移) ──
  const diagnosticsRoutes = createDiagnosticsRoutes(application);
  const costCacheRoutes = createCostCacheRoutes(application);

  // helpers 对象:传递给路由模块的工具函数
  const routeHelpers = {
    readJson,
    readCapabilityJson,
    readEnterpriseJson,
    writeJson,
    writeServiceLog,
    writeErrorResponse,
    createOkEnvelope,
    createErrorEnvelope,
  };
  const knowledgeRoutes = createKnowledgeRoutes(application, routeHelpers);
  const workforceRoutes = createWorkforceRoutes(application, routeHelpers);
  const enterpriseRoutes = createEnterpriseRoutes(application, routeHelpers);
  const chatRoutes = createChatRoutes(application, routeHelpers);
  const providerRoutes = createProviderRoutes(application, routeHelpers);
  const modelRoutes = createModelRoutes(application, routeHelpers);
  const legacyRoutes = createLegacyRoutes(application, routeHelpers);
  const agentRunnerRoutes = createAgentRunnerRoutes(application, routeHelpers);
  const prometheusExporter = createPrometheusExporter();
  const promClientExporter = createPromClientExporter();
  const tracer = createTracer({ serviceName: "ai-gateway", enabled: true });
  const sloTracker = createSloTracker({ windowSizeMs: 5 * 60 * 1000 });
  const connectionPool = createConnectionPoolOptimizer();
  const authTokenService = createAuthTokenService({
    secret: process.env.AUTH_TOKEN_SECRET,
    enterpriseGovernanceService,
  });
  const authRoutes = createAuthRoutes({ ...application, authTokenService }, routeHelpers);

  // ── WebSocket server (must be created before routes that reference it) ──
  const wsServer = createWebSocketServer({
    allowedOrigins: (application.runtimeEnv?.CORS_ALLOWED_ORIGINS ?? process.env.CORS_ALLOWED_ORIGINS ?? "http://127.0.0.1:3100,http://localhost:3100").split(",").map((s) => s.trim()).filter(Boolean),
  });

  // ── 提取的路由模块(渐进式迁移) ──
  const chatRagRoutes = createChatRagRoutes({ application, gatewayService, knowledgeService, circuitBreakerRegistry });
  const capabilityRoutes = createHttpServerCapabilityRoutes({
    application, approvalStore, capabilityRouterService, connectorFeishuDryRun, connectorWeComDryRun,
    fileContextStore, modelLibraryStore, phase319LocalOperation, providerConfigRoutes,
  });
  const chatStreamRoutes = createChatStreamRoutes({ application, gatewayService, circuitBreakerRegistry, metricsCollector, wsServer });

  const routeModules = [
    authRoutes.handlers,
    diagnosticsRoutes.handlers,
    costCacheRoutes.handlers,
    chatRoutes.handlers,
    providerRoutes.handlers,
    modelRoutes.handlers,
    knowledgeRoutes.handlers,
    workforceRoutes.handlers,
    enterpriseRoutes.handlers,
    legacyRoutes.handlers,
    agentRunnerRoutes.handlers,
    chatRagRoutes.handlers,
    capabilityRoutes.handlers,
    chatStreamRoutes.handlers,
  ];

  // Static file handler for production assets
  const staticHandler = createStaticFileHandler();
  const accessLogger = createRequestLogger();
  const healthCheck = createHealthCheckHandler(application);

  return createServer(async (request, response) => {
    const startedAt = Date.now();
    const url = new URL(request.url ?? "/", `http://${request.headers.host ?? "127.0.0.1"}`);
    if (metricsCollector) metricsCollector.incrementConnections();

    // ── Static files (production) ──
    if (staticHandler(request, response)) return;

    // ── Health check endpoints ──
    if (request.method === "GET" && url.pathname === "/health/ready") {
      healthCheck.handleReady(request, response);
      accessLogger(request, response, startedAt);
      return;
    }
    if (request.method === "GET" && url.pathname === "/health/live") {
      healthCheck.handleLive(request, response);
      accessLogger(request, response, startedAt);
      return;
    }

    // ── 分布式追踪 ──
    const parentContext = tracer.extractContext(request.headers);
    const span = tracer.startSpan(`${request.method} ${url.pathname}`, parentContext);
    span.setAttribute("http.method", request.method);
    span.setAttribute("http.url", url.pathname);

    // ── 连接池跟踪 ──
    const host = url.hostname;
    connectionPool.recordConnection(host);

    // ── 背压检查 ──
    const backpressure = connectionPool.shouldThrottle();
    if (backpressure.shouldThrottle) {
      await new Promise((r) => setTimeout(r, backpressure.delayMs));
    }

    try {
      // Route-aware rate limiting
      const rateLimitResult = rateLimiter.apply(request, response);
      if (rateLimitResult) {
        if (metricsCollector) metricsCollector.recordHttpRequest(request.method, url.pathname, 429, Date.now() - startedAt);
        return;
      }

      // --- Request ID for distributed tracing ---
      const requestId = request.headers["x-request-id"] || randomUUID();
      response.setHeader("x-request-id", requestId);

      // --- Security response headers (applied to every response) ---
      response.setHeader("x-content-type-options", "nosniff");
      response.setHeader("x-frame-options", "DENY");
      response.setHeader("x-xss-protection", "0");
      response.setHeader("referrer-policy", "strict-origin-when-cross-origin");
      response.setHeader("content-security-policy", "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; frame-ancestors 'none'");
      response.setHeader("permissions-policy", "camera=(), microphone=(), geolocation=()");
      response.setHeader("cache-control", "no-store");

      // --- CORS handling ---
      const corsAllowedOrigins = (application.runtimeEnv?.CORS_ALLOWED_ORIGINS ?? process.env.CORS_ALLOWED_ORIGINS ?? "http://127.0.0.1:3100,http://localhost:3100").split(",").map((s) => s.trim()).filter(Boolean);
      const requestOrigin = request.headers.origin;
      if (requestOrigin && corsAllowedOrigins.includes(requestOrigin)) {
        response.setHeader("access-control-allow-origin", requestOrigin);
        response.setHeader("access-control-allow-methods", "GET, POST, PUT, DELETE, OPTIONS");
        response.setHeader("access-control-allow-headers", "content-type, authorization, x-request-id, x-tenant-id, x-user-role");
        response.setHeader("access-control-max-age", "86400");
        response.setHeader("vary", "Origin");
      }
      // Handle CORS preflight
      if (request.method === "OPTIONS") {
        response.writeHead(204);
        response.end();
        return;
      }

      writeServiceLog("request_received", {
        method: request.method,
        path: url.pathname,
      });

      // Auth rate limiting — brute-force protection before enterprise auth
      if (authRateLimiter && !isPublicRoute(url.pathname)) {
        const clientIp = request.socket?.remoteAddress ?? "unknown";
        const authCheck = authRateLimiter.check(clientIp);
        if (!authCheck.allowed) {
          if (metricsCollector) {
            metricsCollector.recordAuthAttempt("rate_limited");
            metricsCollector.recordHttpRequest(request.method, url.pathname, 429, Date.now() - startedAt);
          }
          const retryAfterSec = Math.ceil(authCheck.retryAfterMs / 1000);
          response.setHeader("retry-after", String(retryAfterSec));
          writeJson(
            response,
            429,
            createErrorEnvelope("auth_rate_limited", `Too many failed auth attempts. Retry after ${retryAfterSec}s.`, {
              startedAt,
              category: "auth",
              retryAfterMs: authCheck.retryAfterMs,
            }),
          );
          return;
        }
      }

      const enterpriseDecision = enterpriseGovernanceService.authorize(request, resolvePermission(request.method, url.pathname));
      request.enterpriseIdentity = enterpriseDecision.identity;

      // Track auth outcomes for rate limiting and metrics
      if (authRateLimiter && !isPublicRoute(url.pathname)) {
        const clientIp = request.socket?.remoteAddress ?? "unknown";
        if (enterpriseDecision.allowed) {
          authRateLimiter.recordSuccess(clientIp);
          if (metricsCollector) metricsCollector.recordAuthAttempt("success");
        } else {
          authRateLimiter.recordFailure(clientIp);
          if (metricsCollector) metricsCollector.recordAuthAttempt("failure");
        }
      }

      if (!isPublicRoute(url.pathname) && !enterpriseDecision.allowed) {
        await enterpriseGovernanceService.recordAudit({
          outcome: "denied",
          method: request.method,
          path: url.pathname,
          permission: enterpriseDecision.permission,
          statusCode: enterpriseDecision.statusCode,
          code: enterpriseDecision.code,
          identity: enterpriseDecision.identity,
        });
        if (metricsCollector) metricsCollector.recordHttpRequest(request.method, url.pathname, enterpriseDecision.statusCode ?? 401, Date.now() - startedAt);
        writeJson(
          response,
          enterpriseDecision.statusCode ?? 401,
          createErrorEnvelope(enterpriseDecision.code ?? "enterprise_auth_required", enterpriseDecision.message ?? "Enterprise authorization failed.", {
            startedAt,
            category: "auth",
          }),
        );
        return;
      }

      if (!isPublicRoute(url.pathname)) {
        await enterpriseGovernanceService.recordAudit({
          outcome: "allowed",
          method: request.method,
          path: url.pathname,
          permission: enterpriseDecision.permission,
          statusCode: 200,
          identity: enterpriseDecision.identity,
        });
      }

      if (request.method === "GET" && (url.pathname === "/ui" || url.pathname === "/console")) {
        writeHtml(response, 200, createConsolePage());
        return;
      }

      // ── Static UI assets (HTML pages, CSS, JS, images) ──
      const STATIC_EXTS = new Set([".html", ".css", ".js", ".svg", ".png", ".ico"]);
      const STATIC_MIME = {
        ".html": "text/html; charset=utf-8",
        ".css": "text/css; charset=utf-8",
        ".js": "application/javascript; charset=utf-8",
        ".svg": "image/svg+xml",
        ".png": "image/png",
        ".ico": "image/x-icon",
      };
      {
        let reqPath = url.pathname;
        if (reqPath === "/") reqPath = "/index.html";
        const ext = extname(reqPath);
        if (STATIC_EXTS.has(ext)) {
          // Prevent path traversal
          const safe = reqPath.replace(/\.\./g, "");
          const filePath = join(repoRoot, safe);
          const realRoot = resolve(repoRoot);
          const realFile = resolve(filePath);
          if (realFile.startsWith(realRoot)) {
            try {
              const info = await stat(filePath);
              if (info.isFile()) {
                const content = await readFile(filePath);
                response.writeHead(200, {
                  "content-type": STATIC_MIME[ext] || "application/octet-stream",
                  "content-length": content.length,
                  "cache-control": "no-cache",
                });
                response.end(content);
                return;
              }
            } catch { /* file not found, fall through */ }
          }
        }
      }

      // ── API 文档 (自动生成) ──
      if (request.method === "GET" && url.pathname === "/api-docs") {
        const spec = generateOpenApiSpec(routeModules);
        const html = createSwaggerUiPage(spec);
        if (!response.writableEnded && !response.headersSent) {
          response.writeHead(200, { "content-type": "text/html; charset=utf-8" });
          response.end(html);
        }
        return;
      }

      // ── API 文档 JSON spec ──
      if (request.method === "GET" && url.pathname === "/api-docs/spec.json") {
        const spec = generateOpenApiSpec(routeModules);
        writeJson(response, 200, spec);
        return;
      }

      // ── SLO 状态 ──
      if (request.method === "GET" && url.pathname === "/slo") {
        const snapshot = sloTracker.getSnapshot();
        writeJson(response, 200, createOkEnvelope(snapshot, { startedAt }));
        return;
      }

      // ── 可观测性状态 ──
      if (request.method === "GET" && url.pathname === "/observability/status") {
        const obs = {
          tracer: {
            enabled: tracer.enabled,
            serviceName: tracer.serviceName,
            activeSpans: tracer.getActiveSpanCount(),
          },
          slo: sloTracker.getSnapshot(),
          connectionPool: connectionPool.getHealth(),
          prometheus: { enabled: true },
        };
        writeJson(response, 200, createOkEnvelope(obs, { startedAt }));
        return;
      }

      // ── 连接池状态 ──
      if (request.method === "GET" && url.pathname === "/connection-pool") {
        writeJson(response, 200, createOkEnvelope(connectionPool.getStats(), { startedAt }));
        return;
      }

      // ── 路由表查找(优先于 if/else 链,渐进式迁移) ──
      const routeKey = `${request.method} ${url.pathname}`;
      for (const moduleHandlers of routeModules) {
        const route = moduleHandlers.get(routeKey);
        if (route) {
          try {
            let body = null;
            if (request.method === "POST" || request.method === "PUT" || request.method === "DELETE") {
              body = await readJson(request);
            }
            await route.handler(request, response, { startedAt, body });
          } catch (routeError) {
            const statusCode = routeError.statusCode ?? 500;
            const code = routeError.code ?? "route_handler_error";
            writeJson(response, statusCode, createErrorEnvelope(
              code,
              routeError instanceof Error ? routeError.message : "Route handler error",
              { startedAt, category: statusCode < 500 ? "validation" : "internal" },
            ));
          }
          return;
        }
      }

      const approvalDecisionMatch = /^\/approvals\/([^/]+)\/(approve|reject)$/.exec(url.pathname);
      if (request.method === "POST" && approvalDecisionMatch) {
        const approvalId = decodeURIComponent(approvalDecisionMatch[1]);
        const action = approvalDecisionMatch[2];
        let body = {};
        try {
          body = await readJson(request);
        } catch {
          body = {};
        }
        try {
          const approval = action === "approve"
            ? approvalStore.approve(approvalId, body)
            : approvalStore.reject(approvalId, body);
          writeJson(response, 200, createOkEnvelope({
            route: `/approvals/${approvalId}/${action}`,
            approval,
            localExecutionTriggered: false,
            providerCalled: false,
          }, { startedAt }));
        } catch (error) {
          writeJson(response, 404, createErrorEnvelope(error.code || "approval_not_found", error.message, { startedAt }));
        }
        return;
      }
      // --- Forge route delegation ---
      if (forgeService && url.pathname.startsWith("/forge/")) {
        const matched = matchForgeRoute(forgeService.handlers, request.method, url.pathname);
        if (matched) {
          try {
            await matched.handler(request, response, readJson, matched.params);
          } catch (forgeError) {
            writeJson(response, 500, createErrorEnvelope(
              "forge_handler_error",
              forgeError instanceof Error ? forgeError.message : "Forge handler error",
              { startedAt, category: "forge" },
            ));
          }
          return;
        }
        writeJson(response, 404, createErrorEnvelope(
          "forge_route_not_found",
          `No Forge route for ${request.method} ${url.pathname}`,
          { startedAt, category: "routing" },
        ));
        return;
      }

      if (metricsCollector) metricsCollector.recordHttpRequest(request.method, url.pathname, 404, Date.now() - startedAt);
      writeJson(
        response,
        404,
        createErrorEnvelope("route_not_found", `No route for ${request.method} ${url.pathname}`, {
          startedAt,
          category: "routing",
        }),
      );
    } catch (error) {
      const statusCode = error?.statusCode ?? 500;
      if (metricsCollector) metricsCollector.recordHttpRequest(request.method, url.pathname, statusCode, Date.now() - startedAt);
      writeJson(
        response,
        statusCode,
        createErrorEnvelope(
          error?.code ?? "http_handler_error",
          error instanceof Error ? error.message : "Unknown HTTP error",
          {
            startedAt,
            category: statusCode === 413 ? "payload" : "internal",
          },
        ),
      );
    } finally {
      if (metricsCollector) metricsCollector.decrementConnections();

      // ── 追踪 span 结束 + SLO 记录 ──
      const durationMs = Date.now() - startedAt;
      span.setAttribute("http.status_code", response.statusCode);
      span.setAttribute("http.duration_ms", durationMs);
      if (response.statusCode >= 500) {
        span.setStatus("error", `HTTP ${response.statusCode}`);
      }
      span.end();

      sloTracker.record({
        latencyMs: durationMs,
        statusCode: response.statusCode,
        method: request.method,
        path: url.pathname,
      });

      // prom-client 指标记录
      promClientExporter.recordHttpRequest(request.method, url.pathname, response.statusCode, durationMs);

      connectionPool.recordDisconnection(host);

      // Structured access log
      accessLogger(request, response, startedAt);
    }
  });
}
