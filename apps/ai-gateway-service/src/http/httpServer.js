import {
  createServer,
} from "node:http";
import {
  createErrorEnvelope,
  createOkEnvelope,
} from "@unified-ai-system/shared-utils";
import {
  getSafeRuntimeConfig,
} from "@unified-ai-system/shared-config";
import {
  createRouteFailureEnvelope,
} from "../core/gatewayService.js";
import {
  createLocalAgentIntentExplainer,
} from "../agent-runner/localAgentIntentExplainer.js";
import {
  runLocalOperationLoop,
} from "../agent-runner/localOperationLoop.js";
import {
  getSupportedKnowledgeFileTypes,
  parseKnowledgeFile,
} from "../knowledge/documentParsers.js";
import {
  listModelImportProviders,
} from "../model-import/providerProbeRegistry.js";
import {
  detectRuntimeCredentialProviders,
} from "../providers/providerCredentialDetector.js";
import {
  getRequestContext,
} from "../capabilities/userExperienceService.js";
import {
  createNextCodexTask,
  writeNextCodexTaskOutbox,
} from "../entrypoints/handoffNextTask.js";
import {
  readCodexLoopStatus,
} from "../entrypoints/codexLoopStatus.js";
import {
  checkTokenCostGuard,
} from "../cost/tokenCostGuard.js";
import {
  appendEstimateRecord,
  readSummary as readTokenCostSummary,
} from "../cost/tokenCostLedger.js";
import {
  readLatestMimoTokenCalibrationProfile,
} from "../cost/tokenEstimatorCalibration.js";
import {
  createResponseCacheKey,
} from "../cache/responseCacheKey.js";
import {
  createResponseCachePolicy,
} from "../cache/responseCachePolicy.js";
import {
  invalidateCache,
  lookupCache,
  readCacheSummary as readResponseCacheSummary,
  writeCacheRecord,
} from "../cache/responseCacheStore.js";
import {
  listResponseCacheAuditTrail,
} from "../cache/responseCacheAuditTrail.js";
import {
  routeAnswerPath,
} from "../routing/modelTierRouter.js";
import {
  routeQualityCostAnswer,
} from "../routing/qualityCostAnswerRouter.js";
import {
  getEvidenceById,
} from "../chat-gateway/chatGatewayEvidenceRecorder.js";
import {
  TASK_MATRIX,
} from "../chat-gateway/chatGatewayTaskMatrix.js";
import {
  LATENCY_DRY_RUN_CASES,
  PHASE315A_TIMEOUT_TYPES,
  PHASE315A_LATENCY_RISK_LEVELS,
  PHASE315A_COMPLETION_CONFIDENCE,
} from "../chat-gateway/providerLatencyPolicy.js";
import {
  executeThreeModeRequest,
} from "../three-mode/modeRuntimeExecutor.js";
import {
  evaluateTaijiBeidouChatGatewayExecutePreviewHook,
} from "../gateway/taijiBeidouChatGatewayExecutePreviewHook.js";
import {
  evaluateTaijiBeidouChatPreviewHook,
} from "../gateway/taijiBeidouChatPreviewHook.js";
import {
  handleChatLocalActionRoute,
  routeChatActionProposal,
} from "../owner-automation/chatActionProposalRouter.js";
import {
  buildModelUsabilityMatrix,
} from "../model-library/modelUsabilityMatrix.js";
import {
  createModelVerificationPlan,
} from "../model-library/modelVerificationPlanner.js";
import {
  createApprovalStore,
} from "../approval/approvalStore.js";
import {
  createFileContextStore,
} from "../file-context/fileContextStore.js";
import {
  getPluginRegistry,
} from "../plugin-registry/pluginRegistry.js";
import {
  createPhase319LocalOperationService,
} from "../local-operation/phase319LocalOperationService.js";
import {
  createRateLimiter,
} from "./rateLimiter.js";
import {
  createRouteRateLimiter,
} from "./routeRateLimiter.js";
import {
  createLogger,
} from "./structuredLogger.js";
import {
  createWebSocketServer,
} from "./webSocketServer.js";
import {
  isPublicRoute,
} from "./routeAccessPolicy.js";
import {
  readJson,
  writeJson,
  writeSseEvent,
  writeSseHeaders,
} from "./utils/responseUtils.js";
import { createHealth, createSetupReadiness } from "./utils/healthUtils.js";
import {
  runPhase312AChatGateway,
  runPhase314ADryRunTask,
  runPhase315ALatencyDryRun,
  testPhase312AModel,
  createProviders,
  setRuntimeProviderCredential,
  sanitizeCredentialErrorDetails,
  createRouteModes,
} from "./utils/phaseUtils.js";
import {
  readAuditFilters,
  readEnterpriseAcceptanceReport,
  readEnterpriseReleaseCandidateDryRun,
  readEnterpriseOverview,
  buildPhase319FeatureStatus,
  resolvePermission,
  readCapabilityJson,
  readEnterpriseJson,
  writeEnterpriseError,
  writeCapabilityError,
} from "./utils/enterpriseUtils.js";
import {
  normalizeChatBody,
  normalizeRagChatBody,
  extractChatPrompt,
  createRagRetrieveRequest,
  createRagCitations,
  createRagPrompt,
  createRagChatData,
} from "./utils/chatUtils.js";
import {
  ROUTE_NOT_HANDLED,
  dispatchHttpRouteGroups,
} from "./httpRouteDispatch.js";
import { dispatchPromptEnhancementRoutes } from "./promptEnhancementRoutes.js";
import { createA2AGateway } from "./a2aGateway.js";
import { dispatchA2ARoutes } from "./a2aRoutes.js";
import {
  createOpenAiError,
  dispatchOpenAiCompatibilityRoutes,
  isOpenAiCompatibilityRoute,
} from "./openAiCompatibilityRoutes.js";
import { dispatchOpenAiResponsesRoutes } from "./openAiResponsesRoutes.js";
import { dispatchMultimodalRoutes } from "./multimodalRoutes.js";
import { dispatchHttpRoutes01 } from "./httpServerRoutes01.js";
import { dispatchHttpRoutes02 } from "./httpServerRoutes02.js";
import { dispatchHttpRoutes03 } from "./httpServerRoutes03.js";
import { dispatchHttpRoutes04 } from "./httpServerRoutes04.js";
import { dispatchHttpRoutes05 } from "./httpServerRoutes05.js";
import { dispatchHttpRoutes06 } from "./httpServerRoutes06.js";

const logger = createLogger({ app: "ai-gateway-service", level: "info" });
const writeServiceLog = (event, details = {}) => logger.info(event, details);
const OWNER_AUTOMATION_CHAT_PROPOSAL_FLAG = "OWNER_AUTOMATION_CHAT_PROPOSAL_ENABLED";
const DEFAULT_RATE_LIMIT_WINDOW_MS = 60_000;
const DEFAULT_RATE_LIMIT_MAX_REQUESTS = 120;
const DEFAULT_RATE_LIMIT_WHITELIST = Object.freeze(["127.0.0.1", "::1", "::ffff:127.0.0.1"]);
const DEFAULT_RATE_LIMIT_STORE_MODE = "memory";
const DEFAULT_REQUEST_TIMEOUT_MS = 30_000;
const DEFAULT_STREAMING_TIMEOUT_MS = 300_000;
const DEFAULT_MAX_IN_FLIGHT_REQUESTS = 500;
const DEFAULT_MAX_REQUEST_BODY_BYTES = 2_097_152; // 2 MB
const DEFAULT_HEALTHZ_IN_FLIGHT_DEGRADATION_PERCENT = 90;
const DEFAULT_CORS_ALLOWED_ORIGINS = Object.freeze(["http://127.0.0.1:3100", "http://localhost:3100"]);
const DEFAULT_GATEWAY_ERROR_CIRCUIT_BYPASS_ROUTES = Object.freeze([
  "/health",
  "/health/check",
  "/healthz",
  "/ready",
  "/setup/readiness",
  "/metrics",
]);
const DEFAULT_GATEWAY_ERROR_CIRCUIT_FAILURE_THRESHOLD = 12;
const DEFAULT_GATEWAY_ERROR_CIRCUIT_SUCCESS_THRESHOLD = 2;
const DEFAULT_GATEWAY_ERROR_CIRCUIT_RESET_MS = 30_000;
const DEFAULT_GATEWAY_ERROR_CIRCUIT_HALF_OPEN_MAX_CALLS = 1;
const HTTP_ROUTE_DEPENDENCIES = Object.freeze({
  createErrorEnvelope, createOkEnvelope, getSafeRuntimeConfig, createRouteFailureEnvelope,
  createLocalAgentIntentExplainer, runLocalOperationLoop, getSupportedKnowledgeFileTypes, parseKnowledgeFile,
  listModelImportProviders, detectRuntimeCredentialProviders, getRequestContext,
  createNextCodexTask, writeNextCodexTaskOutbox, readCodexLoopStatus, checkTokenCostGuard,
  appendEstimateRecord, readTokenCostSummary, readLatestMimoTokenCalibrationProfile, createResponseCacheKey,
  createResponseCachePolicy, invalidateCache, lookupCache, readResponseCacheSummary,
  writeCacheRecord, listResponseCacheAuditTrail, routeAnswerPath, routeQualityCostAnswer,
  getEvidenceById, TASK_MATRIX, LATENCY_DRY_RUN_CASES, PHASE315A_TIMEOUT_TYPES,
  PHASE315A_LATENCY_RISK_LEVELS, PHASE315A_COMPLETION_CONFIDENCE, executeThreeModeRequest, evaluateTaijiBeidouChatGatewayExecutePreviewHook,
  evaluateTaijiBeidouChatPreviewHook, handleChatLocalActionRoute, routeChatActionProposal, buildModelUsabilityMatrix,
  createModelVerificationPlan, getPluginRegistry, readJson,
  writeJson, writeSseEvent, writeSseHeaders, writeServiceLog,
  createHealth, createSetupReadiness, runPhase312AChatGateway, runPhase314ADryRunTask,
  runPhase315ALatencyDryRun, testPhase312AModel, createProviders, setRuntimeProviderCredential,
  sanitizeCredentialErrorDetails, createRouteModes, readAuditFilters, readEnterpriseAcceptanceReport,
  readEnterpriseReleaseCandidateDryRun, readEnterpriseOverview, buildPhase319FeatureStatus, readCapabilityJson,
  readEnterpriseJson, writeEnterpriseError, writeCapabilityError, normalizeChatBody,
  normalizeRagChatBody, extractChatPrompt, createRagRetrieveRequest, createRagCitations,
  createRagPrompt, createRagChatData, OWNER_AUTOMATION_CHAT_PROPOSAL_FLAG,
});
const HTTP_ROUTE_GROUPS = Object.freeze([
  dispatchA2ARoutes,
  dispatchPromptEnhancementRoutes,
  dispatchMultimodalRoutes,
  dispatchOpenAiCompatibilityRoutes,
  dispatchOpenAiResponsesRoutes,
  dispatchHttpRoutes01,
  dispatchHttpRoutes02,
  dispatchHttpRoutes03,
  dispatchHttpRoutes04,
  dispatchHttpRoutes05,
  dispatchHttpRoutes06,
]);

const CIRCUIT_BYPASS_ROUTES = Object.freeze(new Set(
  DEFAULT_GATEWAY_ERROR_CIRCUIT_BYPASS_ROUTES.map((route) => normalizeBypassRoute(route)),
));

export function createGatewayHttpServer(application) {
  const { capabilityRouterService, codexExecCrsRuntimeCandidate, enterpriseGovernanceService, enterpriseOpsService, fiveCapabilityActivationService, gatewayService, knowledgeService, modelImportService, modelLibraryStore, providerConfigRoutes, runtimeCredentialStore, userExperienceService, workforceService, workflowService } = application;
  const approvalStore = createApprovalStore();
  const fileContextStore = createFileContextStore();
  const phase319LocalOperation = createPhase319LocalOperationService();
  const rateLimiter = createRouteAwareRateLimiter(application.runtimeEnv ?? process.env);
  const requestConfig = application.runtimeEnv ?? process.env;
  const circuitBypassRoutes = createGatewayErrorCircuitBypassRoutes(
    requestConfig.AI_GATEWAY_GATEWAY_ERROR_CIRCUIT_BYPASS_ROUTES,
    CIRCUIT_BYPASS_ROUTES,
  );
  const requestTimeoutMs = parsePositiveInteger(
    requestConfig.AI_GATEWAY_REQUEST_TIMEOUT_MS,
    DEFAULT_REQUEST_TIMEOUT_MS,
  );
  const streamingRequestTimeoutMs = parsePositiveInteger(
    requestConfig.AI_GATEWAY_STREAMING_REQUEST_TIMEOUT_MS,
    DEFAULT_STREAMING_TIMEOUT_MS,
  );
  const maxInFlightRequests = parsePositiveInteger(
    requestConfig.AI_GATEWAY_MAX_IN_FLIGHT_REQUESTS,
    DEFAULT_MAX_IN_FLIGHT_REQUESTS,
  );
  const healthzInFlightDegradationPercent = parsePercentage(
    requestConfig.AI_GATEWAY_HEALTHZ_IN_FLIGHT_DEGRADATION_PERCENT,
    DEFAULT_HEALTHZ_IN_FLIGHT_DEGRADATION_PERCENT,
  );
  const healthzInFlightThreshold = Math.max(
    1,
    Math.min(maxInFlightRequests, Math.ceil((maxInFlightRequests * healthzInFlightDegradationPercent) / 100)),
  );
  const maxRequestBodyBytes = parsePositiveInteger(
    requestConfig.AI_GATEWAY_MAX_REQUEST_BODY_BYTES,
    DEFAULT_MAX_REQUEST_BODY_BYTES,
  );
  const corsAllowedOrigins = parseAllowedOrigins(
    requestConfig.AI_GATEWAY_CORS_ALLOWED_ORIGINS,
    DEFAULT_CORS_ALLOWED_ORIGINS,
  );
  const corsMaxAgeSeconds = parsePositiveInteger(
    requestConfig.AI_GATEWAY_CORS_MAX_AGE_SECONDS,
    86400,
  );
  const gatewayErrorCircuitFailureThreshold = parsePositiveInteger(
    requestConfig.AI_GATEWAY_GATEWAY_ERROR_CIRCUIT_FAILURE_THRESHOLD,
    DEFAULT_GATEWAY_ERROR_CIRCUIT_FAILURE_THRESHOLD,
  );
  const gatewayErrorCircuitSuccessThreshold = parsePositiveInteger(
    requestConfig.AI_GATEWAY_GATEWAY_ERROR_CIRCUIT_SUCCESS_THRESHOLD,
    DEFAULT_GATEWAY_ERROR_CIRCUIT_SUCCESS_THRESHOLD,
  );
  const gatewayErrorCircuitResetMs = parsePositiveInteger(
    requestConfig.AI_GATEWAY_GATEWAY_ERROR_CIRCUIT_RESET_MS,
    DEFAULT_GATEWAY_ERROR_CIRCUIT_RESET_MS,
  );
  const requestedGatewayErrorCircuitHalfOpenMaxCalls = parsePositiveInteger(
    requestConfig.AI_GATEWAY_GATEWAY_ERROR_CIRCUIT_HALF_OPEN_MAX_CALLS,
    DEFAULT_GATEWAY_ERROR_CIRCUIT_HALF_OPEN_MAX_CALLS,
  );
  const gatewayErrorCircuitHalfOpenMaxCalls = Math.max(
    requestedGatewayErrorCircuitHalfOpenMaxCalls,
    gatewayErrorCircuitSuccessThreshold,
  );
  const inFlightRequests = new Set();
  const resilienceMetrics = createGatewayResilienceMetrics();
  const gatewayErrorCircuit = createGatewayErrorCircuitBreaker({
    failureThreshold: gatewayErrorCircuitFailureThreshold,
    successThreshold: gatewayErrorCircuitSuccessThreshold,
    resetTimeoutMs: gatewayErrorCircuitResetMs,
    halfOpenMaxCalls: gatewayErrorCircuitHalfOpenMaxCalls,
  });
  const a2aGateway = createA2AGateway({
    gatewayService,
    workforceService: application.workforceService,
    env: { ...process.env, ...application.runtimeEnv },
  });

  const connectorFeishuDryRun = !(application.runtimeEnv?.FEISHU_WEBHOOK_URL || process.env.FEISHU_WEBHOOK_URL);
  const connectorWeComDryRun = !(application.runtimeEnv?.WECOM_WEBHOOK_URL || process.env.WECOM_WEBHOOK_URL);

  const wsServer = createWebSocketServer({
    allowedOrigins: String(
      application.runtimeEnv?.CORS_ALLOWED_ORIGINS
      ?? "http://127.0.0.1:3100,http://localhost:3100",
    )
      .split(",")
      .map((origin) => origin.trim())
      .filter(Boolean),
    authenticate(request) {
      return enterpriseGovernanceService.authorize(request, "chat:use");
    },
    onConnection(ws) {
      logger.info("ws_connected", { connectionCount: wsServer.getConnectionCount() });
      ws.send(JSON.stringify({ type: "connected", message: "Welcome to AI Gateway WebSocket" }));
    },
    async onMessage(message, ws) {
      try {
        const data = JSON.parse(message);
        if (data.type === "chat" && data.prompt) {
          const result = await gatewayService.execute({
            messages: [{ role: "user", content: data.prompt }],
            metadata: { source: "websocket", userId: ws.identity?.userId },
          });
          ws.send(JSON.stringify({ type: "chat_response", data: result }));
        } else if (data.type === "ping") {
          ws.send(JSON.stringify({ type: "pong", timestamp: Date.now() }));
        }
      } catch (e) {
        logger.warn("ws_message_failed", { error: e.message });
        ws.send(JSON.stringify(createErrorEnvelope(
          "WEBSOCKET_MESSAGE_ERROR",
          "Internal server error",
          { category: "request", retryable: false },
        )));
      }
    },
    onClose(ws) {
      logger.info("ws_disconnected", { connectionCount: wsServer.getConnectionCount() });
    },
    onError(error, context) {
      logger.warn("ws_transport_error", { ...context, error: error.message });
    },
  });

  return createServer(async (request, response) => {
    const startedAt = Date.now();
    const url = new URL(request.url ?? "/", `http://${request.headers.host ?? "127.0.0.1"}`);
    const requestId = `${startedAt}-${Math.random().toString(16).slice(2)}`;
    request.headers["x-request-id"] = requestId;
    response.setHeader("x-request-id", requestId);
    applySecurityHeaders(response);
    request.maxBodyBytes = maxRequestBodyBytes;
    applyCorsHeaders(response, request.headers.origin, corsAllowedOrigins, corsMaxAgeSeconds);
    const markRequestSuccess = () => {
      const stateBeforeSuccess = gatewayErrorCircuit.getStateSnapshot()?.state;
      gatewayErrorCircuit.recordSuccess();
      const stateAfterSuccess = gatewayErrorCircuit.getStateSnapshot();
      if (stateBeforeSuccess === "half-open") {
        resilienceMetrics.recordGatewayErrorCircuitSuccess?.();
      }
      resilienceMetrics.recordGatewayErrorCircuitState?.(stateAfterSuccess?.state, stateAfterSuccess);
    };
    const allowedByGatewayErrorCircuit = gatewayErrorCircuit.canProcessRequest();
    const circuitSnapshot = gatewayErrorCircuit.getStateSnapshot();
    resilienceMetrics.recordGatewayErrorCircuitState?.(circuitSnapshot?.state, circuitSnapshot);
    const normalizedPathname = normalizeBypassRoute(url.pathname);
    const canBypassGatewayErrorCircuit = normalizedPathname && circuitBypassRoutes.has(normalizedPathname);
    if (!allowedByGatewayErrorCircuit && !canBypassGatewayErrorCircuit) {
      resilienceMetrics.recordGatewayErrorCircuitRejections();
      const retryAfterSeconds = Math.max(
        1,
        Math.ceil((circuitSnapshot.retryAfterMs ?? gatewayErrorCircuitResetMs) / 1000),
      );
      response.setHeader("Retry-After", String(retryAfterSeconds));
      writeJson(
        response,
        503,
        createErrorEnvelope("gateway_unavailable", "Gateway request circuit is open. Retry shortly.", {
          startedAt,
          category: "availability",
          retryAfterMs: circuitSnapshot.retryAfterMs ?? gatewayErrorCircuitResetMs,
        }),
      );
      return;
    }

    if (request.method === "OPTIONS") {
      const origin = request.headers.origin;
      const isCorsPreflight = Boolean(request.headers["access-control-request-method"]);
      if (!isCorsPreflight && !origin) {
        response.writeHead(204);
        response.end();
        markRequestSuccess();
        return;
      }
      const isAllowedCorsOrigin = isCorsOriginAllowed(origin, corsAllowedOrigins);
      if (!isAllowedCorsOrigin) {
        writeJson(
          response,
          403,
          createErrorEnvelope("cors_origin_restricted", "Request origin is not allowed for CORS.", {
            startedAt,
            category: "security",
            origin,
          }),
        );
        markRequestSuccess();
        return;
      }
      response.statusCode = 204;
      response.end();
      markRequestSuccess();
      return;
    }

    inFlightRequests.add(requestId);
    const refreshInFlightGauge = () => resilienceMetrics.recordInFlight(inFlightRequests.size);
    refreshInFlightGauge();
    response.on("close", () => {
      inFlightRequests.delete(requestId);
      refreshInFlightGauge();
    });
    resilienceMetrics.recordRequestStarted(inFlightRequests.size);

    const pathname = url.pathname;
    const isStreamingRoute = pathname.endsWith("/stream") || pathname === "/v1/chat/completions";
    const bodyBytesLimit = maxRequestBodyBytes > 0 ? maxRequestBodyBytes : DEFAULT_MAX_REQUEST_BODY_BYTES;
    const requestBodyLimit = parseContentLength(request.headers["content-length"], bodyBytesLimit);
    if (requestBodyLimit > bodyBytesLimit) {
      resilienceMetrics.recordPayloadRejected();
      writeJson(
        response,
        413,
        createErrorEnvelope("request_payload_too_large", "Request payload exceeds server limits.", {
          startedAt,
          category: "request",
          maxBytes: bodyBytesLimit,
          receivedBytes: requestBodyLimit,
        }),
      );
      markRequestSuccess();
      return;
    }

    if (inFlightRequests.size > maxInFlightRequests) {
      resilienceMetrics.recordOverloadRejected();
      writeServiceLog("request_rejected_overload", {
        method: request.method,
        path: pathname,
        inFlight: inFlightRequests.size,
        maxInFlight: maxInFlightRequests,
      });
      writeJson(
        response,
        503,
        createErrorEnvelope("service_overloaded", "The service is currently overloaded. Retry later.", {
          startedAt,
          category: "capacity",
          inFlight: inFlightRequests.size,
          limit: maxInFlightRequests,
        }),
      );
      markRequestSuccess();
      return;
    }

    const requestTimeout = Math.max(
      isStreamingRoute ? streamingRequestTimeoutMs : requestTimeoutMs,
      1_000,
    );
    const timeoutHandle = setTimeout(() => {
      if (!response.writableEnded && !response.headersSent) {
        resilienceMetrics.recordTimeoutTriggered();
        gatewayErrorCircuit.recordFailure();
        resilienceMetrics.recordGatewayErrorCircuitFailure();
        writeJson(
          response,
          408,
          createErrorEnvelope("request_timeout", "Request timed out.", {
            startedAt,
            category: "timeout",
            timeoutMs: requestTimeout,
          }),
        );
      } else if (!response.writableEnded) {
        response.destroy(new Error("Request timeout reached"));
      }
    }, requestTimeout);
    response.on("finish", () => clearTimeout(timeoutHandle));
    response.on("close", () => clearTimeout(timeoutHandle));

    const routeRateLimiter = rateLimiter;

    try {
      // Rate limiting
      const rateLimitResult = routeRateLimiter.apply(request, response);
      if (rateLimitResult) {
        resilienceMetrics.recordRateLimitRejected();
        markRequestSuccess();
        return;
      }
      writeServiceLog("request_received", {
        method: request.method,
        path: url.pathname,
      });

      const enterpriseDecision = enterpriseGovernanceService.authorize(request, resolvePermission(request.method, pathname));
      request.enterpriseIdentity = enterpriseDecision.identity;

      if (!isPublicRoute(pathname) && !enterpriseDecision.allowed) {
        await enterpriseGovernanceService.recordAudit({
          outcome: "denied",
          method: request.method,
          path: pathname,
          permission: enterpriseDecision.permission,
          statusCode: enterpriseDecision.statusCode,
          code: enterpriseDecision.code,
          identity: enterpriseDecision.identity,
        });
        const authError = {
          code: enterpriseDecision.code ?? "enterprise_auth_required",
          message: enterpriseDecision.message ?? "Enterprise authorization failed.",
          category: "auth",
        };
        writeJson(
          response,
          enterpriseDecision.statusCode ?? 401,
          isOpenAiCompatibilityRoute(url.pathname)
            ? createOpenAiError(authError)
            : createErrorEnvelope(authError.code, authError.message, {
              startedAt,
              category: authError.category,
            }),
        );
        markRequestSuccess();
        return;
      }

      if (!isPublicRoute(pathname)) {
        await enterpriseGovernanceService.recordAudit({
          outcome: "allowed",
          method: request.method,
          path: pathname,
          permission: enterpriseDecision.permission,
          statusCode: 200,
          identity: enterpriseDecision.identity,
        });
      }

      const routeResult = await dispatchHttpRouteGroups(HTTP_ROUTE_GROUPS, {
        ...HTTP_ROUTE_DEPENDENCIES,
        application,
        request,
        response,
        url,
        startedAt,
        resilienceMetrics,
        approvalStore,
        fileContextStore,
        phase319LocalOperation,
        connectorFeishuDryRun,
        connectorWeComDryRun,
        capabilityRouterService,
        a2aGateway,
        codexExecCrsRuntimeCandidate,
        enterpriseGovernanceService,
        enterpriseOpsService,
        fiveCapabilityActivationService,
        gatewayService,
        knowledgeService,
        modelImportService,
        modelLibraryStore,
        providerConfigRoutes,
        userExperienceService,
        workforceService,
        workflowService,
        wsServer,
        healthzInFlightThreshold,
        healthzInFlightDegradationPercent,
        rateLimiter,
      });
      if (routeResult !== ROUTE_NOT_HANDLED) {
        markRequestSuccess();
        return;
      }
      markRequestSuccess();

      writeJson(
        response,
        404,
        createErrorEnvelope("route_not_found", `No route for ${request.method} ${url.pathname}`, {
          startedAt,
          category: "routing",
        }),
      );
      markRequestSuccess();
    } catch (error) {
      const normalizedError = createNormalizedHttpError(error);
      const elapsedMs = Date.now() - startedAt;
      resilienceMetrics.recordUnhandledError();
      if (normalizedError.statusCode >= 500) {
        gatewayErrorCircuit.recordFailure();
        resilienceMetrics.recordGatewayErrorCircuitFailure?.();
      }
      resilienceMetrics.recordUnhandledErrorByCode?.(normalizedError.code);
      writeServiceLog("request_unhandled_error", {
        requestId,
        method: request.method,
        path: pathname,
        statusCode: normalizedError.statusCode,
        code: normalizedError.code,
        category: normalizedError.category,
        elapsedMs,
      });
      if (response.writableEnded || response.headersSent) {
        return;
      }
      writeJson(
        response,
        normalizedError.statusCode,
        createErrorEnvelope(normalizedError.code, normalizedError.message, {
          startedAt,
          category: normalizedError.category,
          ...normalizedError.details,
        }),
      );
    }
  });
}

function createNormalizedHttpError(error) {
  if (error instanceof Error) {
    if (error.code && typeof error.code === "string") {
      const normalizedCode = error.code;
      const status = Number(error.statusCode);
        const normalizedStatusCode = Number.isFinite(status) && status >= 400 && status <= 599
        ? status
        : normalizedCode === "request_invalid_json"
          ? 400
          : normalizedCode === "request_payload_too_large"
            ? 413
            : normalizedCode === "gateway_unavailable"
              ? 503
              : normalizedCode.startsWith("circuit")
                ? 503
            : 500;
      return {
        code: normalizedCode,
        statusCode: normalizedStatusCode,
        category: normalizedCode === "request_invalid_json" || normalizedCode === "request_payload_too_large"
          ? "request"
          : "internal",
        message: error.message || "Unknown HTTP error",
        details: {
          ...(error.retryable ? { retryable: error.retryable } : {}),
          ...(typeof error.limit === "number" ? { limit: error.limit } : {}),
          ...(typeof error.receivedBytes === "number" ? { receivedBytes: error.receivedBytes } : {}),
        },
      };
    }
  }
  return {
    code: "http_handler_error",
    statusCode: 500,
    category: "internal",
    message: error instanceof Error ? error.message : "Unknown HTTP error",
    details: {},
  };
}

function createGatewayResilienceMetrics() {
  const counters = {
    totalRequests: 0,
    rateLimitRejected: 0,
    payloadRejected: 0,
    overloadRejected: 0,
    timeoutTriggered: 0,
    unhandledErrors: 0,
    unhandledErrorCodes: Object.create(null),
    gatewayErrorCircuitState: "closed",
    gatewayErrorCircuitFailures: 0,
    gatewayErrorCircuitRejections: 0,
    gatewayErrorCircuitSuccesses: 0,
    gatewayErrorCircuitOpenAt: 0,
    maxInFlightObserved: 0,
    currentInFlight: 0,
    readinessCheckCount: 0,
    readinessReadyChecks: 0,
    readinessDegradedChecks: 0,
    readinessFailureReasons: Object.create(null),
    lastReadinessFailures: [],
  };

  return {
    recordRequestStarted(inFlightRequests) {
      counters.totalRequests += 1;
      counters.currentInFlight = inFlightRequests;
      if (inFlightRequests > counters.maxInFlightObserved) {
        counters.maxInFlightObserved = inFlightRequests;
      }
    },
    recordRateLimitRejected() {
      counters.rateLimitRejected += 1;
    },
    recordPayloadRejected() {
      counters.payloadRejected += 1;
    },
    recordInFlight(inFlightRequests) {
      counters.currentInFlight = inFlightRequests;
      if (inFlightRequests > counters.maxInFlightObserved) {
        counters.maxInFlightObserved = inFlightRequests;
      }
    },
    recordOverloadRejected() {
      counters.overloadRejected += 1;
    },
    recordTimeoutTriggered() {
      counters.timeoutTriggered += 1;
    },
    recordUnhandledError() {
      counters.unhandledErrors += 1;
    },
    recordUnhandledErrorByCode(errorCode) {
      const normalizedCode = typeof errorCode === "string" && errorCode.trim() ? errorCode.trim() : "unknown";
      counters.unhandledErrorCodes[normalizedCode] = (counters.unhandledErrorCodes[normalizedCode] ?? 0) + 1;
    },
    recordGatewayErrorCircuitState(state) {
      const normalizedState = typeof state === "string" && state.trim() ? state.trim() : "unknown";
      counters.gatewayErrorCircuitState = normalizedState;
      if (normalizedState !== "open") {
        counters.gatewayErrorCircuitOpenAt = 0;
        return;
      }
      if (!counters.gatewayErrorCircuitOpenAt) {
        counters.gatewayErrorCircuitOpenAt = Date.now();
      }
    },
    recordGatewayErrorCircuitRejections() {
      counters.gatewayErrorCircuitRejections += 1;
    },
    recordGatewayErrorCircuitFailure() {
      counters.gatewayErrorCircuitFailures += 1;
    },
    recordGatewayErrorCircuitSuccess() {
      counters.gatewayErrorCircuitSuccesses += 1;
    },
    recordReadinessCheck(readinessFailures = []) {
      const normalizedReasons = Array.isArray(readinessFailures)
        ? readinessFailures
          .filter((reason) => typeof reason === "string" && reason.trim())
          .map((reason) => reason.trim())
        : [];
      const uniqueReasons = Array.from(new Set(normalizedReasons));

      counters.readinessCheckCount += 1;

      if (uniqueReasons.length === 0) {
        counters.readinessReadyChecks += 1;
      } else {
        counters.readinessDegradedChecks += 1;
        for (const reason of uniqueReasons) {
          counters.readinessFailureReasons[reason] = (counters.readinessFailureReasons[reason] ?? 0) + 1;
        }
      }

      counters.lastReadinessFailures = uniqueReasons;
    },
    snapshot() {
      return {
        ...counters,
        readinessFailureReasons: { ...counters.readinessFailureReasons },
        lastReadinessFailures: [...counters.lastReadinessFailures],
        unhandledErrorCodes: { ...counters.unhandledErrorCodes },
      };
    },
  };
}

export function createGatewayErrorCircuitBreaker(options = {}) {
  const {
    failureThreshold = 1,
    successThreshold = 1,
    halfOpenMaxCalls = 1,
    resetTimeoutMs = 30_000,
    now = Date.now,
  } = options;
  const state = {
    CLOSED: "closed",
    HALF_OPEN: "half-open",
    OPEN: "open",
  };

  let currentState = state.CLOSED;
  let consecutiveFailures = 0;
  let halfOpenSuccesses = 0;
  let halfOpenAttempts = 0;
  let openedAt = 0;

  function isOpenExpired() {
    return openedAt > 0 && (now() - openedAt) >= resetTimeoutMs;
  }

  function transitionTo(nextState) {
    if (currentState === nextState) {
      return;
    }
    currentState = nextState;
    if (nextState === state.CLOSED) {
      consecutiveFailures = 0;
      halfOpenSuccesses = 0;
      halfOpenAttempts = 0;
      openedAt = 0;
    } else if (nextState === state.HALF_OPEN) {
      halfOpenSuccesses = 0;
      halfOpenAttempts = 0;
      openedAt = 0;
    } else if (nextState === state.OPEN && openedAt === 0) {
      openedAt = now();
    }
  }

  function refreshState() {
    if (currentState === state.OPEN && isOpenExpired()) {
      transitionTo(state.HALF_OPEN);
    }
  }

  function canProcessRequest() {
    refreshState();
    if (currentState === state.OPEN) {
      return false;
    }
    if (currentState === state.HALF_OPEN && halfOpenAttempts >= halfOpenMaxCalls) {
      return false;
    }
    if (currentState === state.HALF_OPEN) {
      halfOpenAttempts += 1;
    }
    return true;
  }

  function recordFailure() {
    if (currentState === state.CLOSED) {
      consecutiveFailures += 1;
      if (consecutiveFailures >= failureThreshold) {
        transitionTo(state.OPEN);
      }
      return;
    }
    if (currentState === state.HALF_OPEN) {
      transitionTo(state.OPEN);
    }
  }

  function recordSuccess() {
    if (currentState === state.OPEN) {
      return;
    }
    if (currentState === state.HALF_OPEN) {
      halfOpenSuccesses += 1;
      if (halfOpenSuccesses >= successThreshold) {
        transitionTo(state.CLOSED);
      }
      return;
    }
    consecutiveFailures = 0;
  }

  function getStateSnapshot() {
    refreshState();
    return {
      state: currentState,
      retryAfterMs: currentState === state.OPEN ? Math.max(0, resetTimeoutMs - (now() - openedAt)) : 0,
      halfOpenAttempts,
      consecutiveFailures,
      halfOpenSuccesses,
    };
  }

  return {
    canProcessRequest,
    recordFailure,
    recordSuccess,
    getStateSnapshot,
  };
}

function applySecurityHeaders(response) {
  response.setHeader("X-Content-Type-Options", "nosniff");
  response.setHeader("Referrer-Policy", "no-referrer");
  response.setHeader("X-Frame-Options", "DENY");
  response.setHeader("X-XSS-Protection", "0");
  response.setHeader("Content-Security-Policy", "default-src 'none'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'; object-src 'none'; script-src 'none'; style-src 'none'; img-src 'self' data:; connect-src 'self'");
  response.setHeader("Cross-Origin-Opener-Policy", "same-origin");
  response.setHeader("Cross-Origin-Resource-Policy", "same-origin");
  response.setHeader("Cross-Origin-Embedder-Policy", "require-corp");
  response.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=(), gyroscope=(), magnetometer=(), payment=(), usb=()");
  response.setHeader("X-Permitted-Cross-Domain-Policies", "none");
  response.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, max-age=0");
  response.setHeader("Pragma", "no-cache");
}

function parseAllowedOrigins(rawValue, fallback) {
  if (typeof rawValue !== "string") {
    return [...fallback];
  }

  const parsed = rawValue
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);

  if (parsed.length === 0) {
    return [...fallback];
  }

  return Array.from(new Set(parsed));
}

function isCorsOriginAllowed(origin, allowedOrigins) {
  if (!origin) {
    return false;
  }
  if (allowedOrigins.includes("*")) {
    return true;
  }
  return allowedOrigins.includes(origin.trim());
}

function applyCorsHeaders(response, origin, allowedOrigins, maxAgeSeconds) {
  if (isCorsOriginAllowed(origin, allowedOrigins)) {
    const allowOrigin = allowedOrigins.includes("*") ? "*" : origin?.trim();
    response.setHeader("Access-Control-Allow-Origin", allowOrigin ?? "*");
    if (allowOrigin !== "*") {
      response.setHeader("Access-Control-Allow-Credentials", "true");
    }
    response.setHeader("Access-Control-Allow-Headers", "Authorization, Content-Type, X-Request-ID, X-Request-Context, X-Client-ID");
    response.setHeader("Access-Control-Allow-Methods", "GET,HEAD,POST,PUT,PATCH,DELETE,OPTIONS");
    response.setHeader("Access-Control-Expose-Headers", "X-Request-ID, RateLimit-Limit, RateLimit-Remaining, RateLimit-Window, Retry-After");
    response.setHeader("Access-Control-Max-Age", String(Math.max(0, maxAgeSeconds)));
    response.setHeader("Vary", "Origin");
  } else {
    response.setHeader("Vary", "Origin");
  }
}

function createRouteAwareRateLimiter(runtimeEnv = {}) {
  const useRouteLimits = parseBoolean(runtimeEnv.AI_GATEWAY_ROUTE_RATE_LIMIT_ENABLED, true);
  const globalWindowMs = parsePositiveInteger(runtimeEnv.AI_GATEWAY_RATE_LIMIT_WINDOW_MS, DEFAULT_RATE_LIMIT_WINDOW_MS);
  const globalMaxRequests = parsePositiveInteger(runtimeEnv.AI_GATEWAY_RATE_LIMIT_MAX_REQUESTS, DEFAULT_RATE_LIMIT_MAX_REQUESTS);
  const whitelist = parseRateLimitWhitelist(runtimeEnv.AI_GATEWAY_RATE_LIMIT_WHITELIST, DEFAULT_RATE_LIMIT_WHITELIST);
  const storeMode = parseRateLimitStoreMode(runtimeEnv.AI_GATEWAY_RATE_LIMIT_STORE_MODE);
  const storePath = typeof runtimeEnv.AI_GATEWAY_RATE_LIMIT_STORE_PATH === "string" && runtimeEnv.AI_GATEWAY_RATE_LIMIT_STORE_PATH.trim()
    ? runtimeEnv.AI_GATEWAY_RATE_LIMIT_STORE_PATH.trim()
    : undefined;
  const storeNamespace = runtimeEnv.AI_GATEWAY_RATE_LIMIT_STORE_NAMESPACE?.trim()
    ? runtimeEnv.AI_GATEWAY_RATE_LIMIT_STORE_NAMESPACE.trim()
    : "http";
  const routeLimits = parseRouteRateLimitConfig(runtimeEnv.AI_GATEWAY_ROUTE_RATE_LIMITS);

  if (!useRouteLimits) {
    return createRateLimiter({
      windowMs: globalWindowMs,
      maxRequests: globalMaxRequests,
      whitelist,
      storeMode,
      storePath,
      storeNamespace,
    });
  }

  return createRouteRateLimiter({
    routeLimits,
    globalWindowMs,
    globalMaxRequests,
    whitelist,
    storeMode,
    storePath,
    storeNamespace,
  });
}

function parsePositiveInteger(value, fallback) {
  const parsed = Number.parseInt(String(value ?? ""), 10);
  if (Number.isFinite(parsed) && parsed > 0) {
    return parsed;
  }
  return fallback;
}

function parsePercentage(value, fallback) {
  const parsed = Number.parseInt(String(value ?? ""), 10);
  if (Number.isFinite(parsed)) {
    if (parsed <= 0) {
      return 1;
    }
    if (parsed > 100) {
      return 100;
    }
    return parsed;
  }
  return fallback;
}

function parseContentLength(contentLengthHeader, fallback) {
  if (!contentLengthHeader) {
    return 0;
  }

  const value = Number.parseInt(contentLengthHeader, 10);
  if (Number.isFinite(value) && value >= 0) {
    return value;
  }

  return fallback;
}

function parseBoolean(value, fallback) {
  if (value === undefined || value === "") {
    return fallback;
  }

  return String(value).toLowerCase() === "true" || String(value) === "1";
}

function parseRateLimitStoreMode(value) {
  const normalized = String(value ?? DEFAULT_RATE_LIMIT_STORE_MODE).toLowerCase();
  return normalized === "sqlite" ? "sqlite" : DEFAULT_RATE_LIMIT_STORE_MODE;
}

function parseRateLimitWhitelist(value, fallback) {
  if (typeof value !== "string") {
    return [...fallback];
  }

  const parsed = value
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);
  return parsed.length > 0 ? parsed : [...fallback];
}

function parseRouteRateLimitConfig(value) {
  const parsed = parseJson(value);
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    return undefined;
  }

  const routeLimits = {};
  for (const [route, config] of Object.entries(parsed)) {
    if (typeof route !== "string" || !route.trim()) {
      continue;
    }

    const normalizedRoute = route.startsWith("/") ? route : `/${route}`;
    const maxRequests = parsePositiveInteger(config?.maxRequests, undefined);
    const windowMs = parsePositiveInteger(config?.windowMs, undefined);

    if (maxRequests === undefined || windowMs === undefined) {
      continue;
    }

    routeLimits[normalizedRoute] = { maxRequests, windowMs };
  }

  return Object.keys(routeLimits).length > 0 ? routeLimits : undefined;
}

function createGatewayErrorCircuitBypassRoutes(rawRoutes, fallbackRoutes) {
  const fallback = fallbackRoutes?.[Symbol.iterator]
    ? Array.from(fallbackRoutes)
    : [];
  const fallbackSet = new Set(
    fallback
      .map((route) => normalizeBypassRoute(route))
      .filter((route) => typeof route === "string" && route.length > 0),
  );

  if (typeof rawRoutes !== "string" || !rawRoutes.trim()) {
    return new Set(fallbackSet);
  }

  const parsed = rawRoutes
    .split(",")
    .map((route) => normalizeBypassRoute(route))
    .filter((route) => typeof route === "string" && route.length > 0);
  return new Set([...fallbackSet, ...parsed]);
}

function normalizeBypassRoute(route) {
  if (typeof route !== "string") {
    return "";
  }

  const trimmed = route.trim();
  if (!trimmed) {
    return "";
  }

  const pathOnly = trimmed.split("?")[0].split("#")[0];
  const withLeadingSlash = pathOnly.startsWith("/") ? pathOnly : `/${pathOnly}`;
  const withNormalizedSlashes = withLeadingSlash.replace(/\/+/gu, "/");
  if (withNormalizedSlashes === "/") {
    return "/";
  }

  return withNormalizedSlashes.replace(/\/+$/u, "");
}

function parseJson(value) {
  if (typeof value !== "string") {
    return undefined;
  }

  try {
    return JSON.parse(value);
  } catch {
    return undefined;
  }
}
