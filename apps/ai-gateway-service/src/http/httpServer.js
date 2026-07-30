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
import { dispatchHttpRoutes01 } from "./httpServerRoutes01.js";
import { dispatchHttpRoutes02 } from "./httpServerRoutes02.js";
import { dispatchHttpRoutes03 } from "./httpServerRoutes03.js";
import { dispatchHttpRoutes04 } from "./httpServerRoutes04.js";
import { dispatchHttpRoutes05 } from "./httpServerRoutes05.js";
import { dispatchHttpRoutes06 } from "./httpServerRoutes06.js";

const logger = createLogger({ app: "ai-gateway-service", level: "info" });
const writeServiceLog = (event, details = {}) => logger.info(event, details);
const OWNER_AUTOMATION_CHAT_PROPOSAL_FLAG = "OWNER_AUTOMATION_CHAT_PROPOSAL_ENABLED";
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
  dispatchHttpRoutes01,
  dispatchHttpRoutes02,
  dispatchHttpRoutes03,
  dispatchHttpRoutes04,
  dispatchHttpRoutes05,
  dispatchHttpRoutes06,
]);

export function createGatewayHttpServer(application) {
  const { capabilityRouterService, codexExecCrsRuntimeCandidate, enterpriseGovernanceService, enterpriseOpsService, fiveCapabilityActivationService, gatewayService, knowledgeService, modelImportService, modelLibraryStore, providerConfigRoutes, runtimeCredentialStore, userExperienceService, workforceService, workflowService } = application;
  const approvalStore = createApprovalStore();
  const fileContextStore = createFileContextStore();
  const phase319LocalOperation = createPhase319LocalOperationService();
  const rateLimiter = createRateLimiter({ windowMs: 60_000, maxRequests: 120 });

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
      return enterpriseGovernanceService.authorize(request, "chat:use").allowed;
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
            metadata: { source: "websocket" },
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

    try {
      // Rate limiting
      const rateLimitResult = rateLimiter.apply(request, response);
      if (rateLimitResult) return;
      writeServiceLog("request_received", {
        method: request.method,
        path: url.pathname,
      });

      const enterpriseDecision = enterpriseGovernanceService.authorize(request, resolvePermission(request.method, url.pathname));
      request.enterpriseIdentity = enterpriseDecision.identity;

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

      const routeResult = await dispatchHttpRouteGroups(HTTP_ROUTE_GROUPS, {
        ...HTTP_ROUTE_DEPENDENCIES,
        application,
        request,
        response,
        url,
        startedAt,
        approvalStore,
        fileContextStore,
        phase319LocalOperation,
        connectorFeishuDryRun,
        connectorWeComDryRun,
        capabilityRouterService,
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
      });
      if (routeResult !== ROUTE_NOT_HANDLED) return;

      writeJson(
        response,
        404,
        createErrorEnvelope("route_not_found", `No route for ${request.method} ${url.pathname}`, {
          startedAt,
          category: "routing",
        }),
      );
    } catch (error) {
      writeJson(
        response,
        500,
        createErrorEnvelope("http_handler_error", error instanceof Error ? error.message : "Unknown HTTP error", {
          startedAt,
          category: "internal",
        }),
      );
    }
  });
}
