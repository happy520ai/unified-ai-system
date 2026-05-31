import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createErrorEnvelope, createOkEnvelope } from "../../../../packages/shared-utils/src/index.js";
import { getSafeRuntimeConfig } from "../../../../packages/shared-config/src/index.js";
import { createRouteFailureEnvelope } from "../core/gatewayService.js";
import { createLocalAgentIntentExplainer } from "../agent-runner/localAgentIntentExplainer.js";
import { runLocalOperationLoop } from "../agent-runner/localOperationLoop.js";
import { getSupportedKnowledgeFileTypes, parseKnowledgeFile } from "../knowledge/documentParsers.js";
import { listModelImportProviders } from "../model-import/providerProbeRegistry.js";
import { detectRuntimeCredentialProviders, extractRuntimeCredentialEndpoint, extractRuntimeCredentialSecret } from "../providers/providerCredentialDetector.js";
import { createConsolePage } from "../ui/consolePage.js";
import { getRequestContext } from "../capabilities/userExperienceService.js";
import { createNextCodexTask, writeNextCodexTaskOutbox } from "../entrypoints/handoffNextTask.js";
import { readCodexLoopStatus } from "../entrypoints/codexLoopStatus.js";
import { checkTokenCostGuard } from "../cost/tokenCostGuard.js";
import { appendEstimateRecord, readSummary as readTokenCostSummary } from "../cost/tokenCostLedger.js";
import { readLatestMimoTokenCalibrationProfile } from "../cost/tokenEstimatorCalibration.js";
import { createResponseCacheKey } from "../cache/responseCacheKey.js";
import { createResponseCachePolicy } from "../cache/responseCachePolicy.js";
import { invalidateCache, lookupCache, readCacheSummary as readResponseCacheSummary, writeCacheRecord } from "../cache/responseCacheStore.js";
import { listResponseCacheAuditTrail } from "../cache/responseCacheAuditTrail.js";
import { routeAnswerPath } from "../routing/modelTierRouter.js";
import { routeQualityCostAnswer } from "../routing/qualityCostAnswerRouter.js";
import { classifyGatewayIntent } from "../chat-gateway/gatewayIntentClassifier.js";
import { planGatewayModel } from "../chat-gateway/gatewayModelPlanner.js";
import { executeCapabilitySafePlan } from "../chat-gateway/capabilitySafeExecutionRouter.js";
import { verifyResultCompletion } from "../chat-gateway/resultCompletionVerifier.js";
import { recordChatGatewayEvidence, generateEvidenceId, getEvidenceById } from "../chat-gateway/chatGatewayEvidenceRecorder.js";
import { TASK_MATRIX, taskForId, routeDecisionForTask, executionStatusForDryRun, completionVerifiedForDryRun, verificationReasonForDryRun, TASK_TO_INTENT_MAP } from "../chat-gateway/chatGatewayTaskMatrix.js";
import { LATENCY_DRY_RUN_CASES, buildProviderLatencyAccountability, PHASE315A_TIMEOUT_TYPES, PHASE315A_LATENCY_RISK_LEVELS, PHASE315A_COMPLETION_CONFIDENCE } from "../chat-gateway/providerLatencyPolicy.js";
import { buildProviderRetryFallbackAccountability } from "../chat-gateway/providerRetryFallbackPolicy.js";
import { createNvidiaUnifiedClient } from "../providers/nvidia/nvidiaUnifiedClient.js";
import { executeThreeModeRequest } from "../three-mode/modeRuntimeExecutor.js";
import { evaluateTaijiBeidouChatGatewayExecutePreviewHook } from "../gateway/taijiBeidouChatGatewayExecutePreviewHook.js";
import { evaluateTaijiBeidouChatPreviewHook } from "../gateway/taijiBeidouChatPreviewHook.js";
import { handleChatLocalActionRoute, routeChatActionProposal } from "../owner-automation/chatActionProposalRouter.js";
import { ENDPOINT_TYPES } from "../model-library/modelCapabilityRules.js";
import { findModel } from "../model-library/unifiedModelRegistry.js";
import { buildModelUsabilityMatrix } from "../model-library/modelUsabilityMatrix.js";
import { createModelVerificationPlan } from "../model-library/modelVerificationPlanner.js";
import { createApprovalStore } from "../approval/approvalStore.js";
import { createFileContextStore } from "../file-context/fileContextStore.js";
import { getPluginRegistry } from "../plugin-registry/pluginRegistry.js";
import { createPhase319LocalOperationService } from "../local-operation/phase319LocalOperationService.js";
import { createRateLimiter } from "./rateLimiter.js";
import { createLogger } from "./structuredLogger.js";
import { createWebSocketServer } from "./webSocketServer.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, "../../../..");
const logger = createLogger({ app: "ai-gateway-service", level: "info" });
const enterpriseAcceptanceReportPath = resolve(repoRoot, "docs/ENTERPRISE_ACCEPTANCE_REPORT.md");
const enterpriseAcceptanceEvidencePath = resolve(repoRoot, "apps/ai-gateway-service/evidence/phase-43a-enterprise-acceptance-report.json");
const enterpriseReleaseCandidateEvidencePath = resolve(
  repoRoot,
  "apps/ai-gateway-service/evidence/phase-45a-enterprise-release-candidate-dry-run.json",
);
const OWNER_AUTOMATION_CHAT_PROPOSAL_FLAG = "OWNER_AUTOMATION_CHAT_PROPOSAL_ENABLED";

export function createGatewayHttpServer(application) {
  const { capabilityRouterService, codexExecCrsRuntimeCandidate, enterpriseGovernanceService, enterpriseOpsService, fiveCapabilityActivationService, gatewayService, knowledgeService, modelImportService, modelLibraryStore, providerConfigRoutes, runtimeCredentialStore, userExperienceService, workforceService, workflowService } = application;
  const approvalStore = createApprovalStore();
  const fileContextStore = createFileContextStore();
  const phase319LocalOperation = createPhase319LocalOperationService();
  const rateLimiter = createRateLimiter({ windowMs: 60_000, maxRequests: 120 });

  const connectorFeishuDryRun = !(application.runtimeEnv?.FEISHU_WEBHOOK_URL || process.env.FEISHU_WEBHOOK_URL);
  const connectorWeComDryRun = !(application.runtimeEnv?.WECOM_WEBHOOK_URL || process.env.WECOM_WEBHOOK_URL);

  const wsServer = createWebSocketServer({
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
        ws.send(JSON.stringify({ type: "error", message: e.message }));
      }
    },
    onClose(ws) {
      logger.info("ws_disconnected", { connectionCount: wsServer.getConnectionCount() });
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

      if (request.method === "GET" && (url.pathname === "/ui" || url.pathname === "/console")) {
        writeHtml(response, 200, createConsolePage());
        return;
      }

      if (request.method === "POST" && url.pathname === "/agent-runner/intent-approval-preview") {
        let body;
        try {
          body = await readJson(request);
        } catch {
          const parseError = new Error("Intent approval preview body must be valid JSON.");
          parseError.code = "VALIDATION_ERROR";
          parseError.type = "validation";
          parseError.category = "validation";
          parseError.retryable = false;
          writeJson(response, 400, createRouteFailureEnvelope(parseError, { startedAt }));
          return;
        }

        const result = createLocalAgentIntentExplainer(body?.input, {
          allowedFiles: Array.isArray(body?.allowedFiles) ? body.allowedFiles : [],
        });
        writeJson(
          response,
          200,
          createOkEnvelope(
            {
              route: "/agent-runner/intent-approval-preview",
              routeAdded: true,
              uiReady: true,
              intentExplanation: result,
              approvalPreview: result.approvalPreview,
              executionPreview: result.executionPreview,
              classification: result.classification,
              permissionPreview: result.permissionPreview,
              fileBoundaryPreview: result.fileBoundaryPreview,
              commandPreview: result.commandPreview,
              nextStepAdvice: result.nextStepAdvice,
            },
            { startedAt },
          ),
        );
        return;
      }

      if (request.method === "POST" && url.pathname === "/agent-runner/local-operation") {
        let body;
        try {
          body = await readJson(request);
        } catch {
          const parseError = new Error("Local operation body must be valid JSON.");
          parseError.code = "VALIDATION_ERROR";
          parseError.type = "validation";
          parseError.category = "validation";
          parseError.retryable = false;
          writeJson(response, 400, createRouteFailureEnvelope(parseError, { startedAt }));
          return;
        }

        const result = await runLocalOperationLoop(body ?? {});
        writeJson(
          response,
          200,
          createOkEnvelope(
            {
              route: "/agent-runner/local-operation",
              routeAdded: true,
              uiReady: true,
              action: body?.action ?? "preview",
              ...result,
            },
            { startedAt },
          ),
        );
        return;
      }

      if (request.method === "GET" && url.pathname === "/workbench/feature-status") {
        writeJson(response, 200, createOkEnvelope(buildPhase319FeatureStatus(), { startedAt }));
        return;
      }

      if (request.method === "POST" && url.pathname === "/local-agent/intent-preview") {
        const body = await readCapabilityJson({ request, response, startedAt, code: "local_agent_intent_preview_invalid_json" });
        if (!body) return;
        writeJson(response, 200, createOkEnvelope({
          route: "/local-agent/intent-preview",
          status: "approval_required",
          ...(await phase319LocalOperation.createIntentPreview(body)),
        }, { startedAt }));
        return;
      }

      if (request.method === "POST" && url.pathname === "/local-agent/operation-plan") {
        const body = await readCapabilityJson({ request, response, startedAt, code: "local_agent_operation_plan_invalid_json" });
        if (!body) return;
        writeJson(response, 200, createOkEnvelope({
          route: "/local-agent/operation-plan",
          status: "approval_required",
          ...(await phase319LocalOperation.createOperationPlan(body)),
        }, { startedAt }));
        return;
      }

      if (request.method === "POST" && url.pathname === "/local-agent/patch-proposal") {
        const body = await readCapabilityJson({ request, response, startedAt, code: "local_agent_patch_proposal_invalid_json" });
        if (!body) return;
        writeJson(response, 200, createOkEnvelope({
          route: "/local-agent/patch-proposal",
          status: "approval_required",
          ...(await phase319LocalOperation.createPatchProposal(body)),
        }, { startedAt }));
        return;
      }

      if (request.method === "GET" && url.pathname === "/approvals") {
        writeJson(response, 200, createOkEnvelope({
          route: "/approvals",
          approvals: approvalStore.list(),
        }, { startedAt }));
        return;
      }

      if (request.method === "POST" && url.pathname === "/approvals/create") {
        const body = await readCapabilityJson({ request, response, startedAt, code: "approval_create_invalid_json" });
        if (!body) return;
        const approval = approvalStore.create(body);
        writeJson(response, 200, createOkEnvelope({
          route: "/approvals/create",
          approval,
          localExecutionTriggered: false,
          providerCalled: false,
        }, { startedAt }));
        return;
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

      if (request.method === "POST" && url.pathname === "/local-operation/apply-approved") {
        const body = await readCapabilityJson({ request, response, startedAt, code: "apply_approved_invalid_json" });
        if (!body) return;
        const approval = approvalStore.get(body.approvalId);
        if (!approval) {
          writeJson(response, 404, createErrorEnvelope("approval_not_found", "approvalId is required and must reference an existing approval record.", { startedAt }));
          return;
        }
        const result = await phase319LocalOperation.applyApproved({
          ...body,
          approval,
          patchProposal: body.patchProposal ?? approval.patchProposal,
          dryRun: body.dryRun === false ? false : true,
        });
        writeJson(response, 200, createOkEnvelope({
          route: "/local-operation/apply-approved",
          approvalId: body.approvalId,
          providerCalled: false,
          localExecutionTriggered: result?.applyResult?.applied === true,
          unauthorizedFileWriteAttempted: Array.isArray(result?.applyResult?.blockedFiles) && result.applyResult.blockedFiles.length > 0,
          ...result,
        }, { startedAt }));
        return;
      }

      if (request.method === "POST" && url.pathname === "/file-context/select") {
        const body = await readCapabilityJson({ request, response, startedAt, code: "file_context_select_invalid_json" });
        if (!body) return;
        writeJson(response, 200, createOkEnvelope({
          route: "/file-context/select",
          approvalRequired: true,
          providerCalled: false,
          localExecutionTriggered: false,
          secretContentStored: false,
          ...fileContextStore.select(body),
        }, { startedAt }));
        return;
      }

      if (request.method === "GET" && url.pathname === "/plugin-registry") {
        writeJson(response, 200, createOkEnvelope({
          route: "/plugin-registry",
          approvalRequired: true,
          providerCalled: false,
          localExecutionTriggered: false,
          ...getPluginRegistry(),
        }, { startedAt }));
        return;
      }

      if (request.method === "GET" && url.pathname === "/enterprise/health") {
        writeJson(response, 200, createOkEnvelope(enterpriseGovernanceService.getHealth(), { startedAt }));
        return;
      }

      if (request.method === "GET" && url.pathname === "/enterprise/session") {
        writeJson(
          response,
          200,
          createOkEnvelope(
            {
              authenticated: true,
              identity: request.enterpriseIdentity,
            },
            { startedAt },
          ),
        );
        return;
      }

      if (request.method === "GET" && url.pathname === "/enterprise/roles") {
        writeJson(response, 200, createOkEnvelope(enterpriseGovernanceService.listRoles(), { startedAt }));
        return;
      }

      if (request.method === "GET" && url.pathname === "/enterprise/users") {
        writeJson(response, 200, createOkEnvelope(enterpriseGovernanceService.listUsers(), { startedAt }));
        return;
      }

      if (request.method === "POST" && url.pathname === "/enterprise/users") {
        const body = await readEnterpriseJson({ request, response, startedAt, code: "enterprise_user_invalid_json" });
        if (!body) return;

        try {
          const result = enterpriseGovernanceService.upsertUser(body, request.enterpriseIdentity);
          await enterpriseGovernanceService.recordAudit({
            outcome: "allowed",
            method: request.method,
            path: url.pathname,
            permission: "user:admin",
            statusCode: 200,
            code: "enterprise_user_upserted",
            identity: request.enterpriseIdentity,
            details: {
              userId: result.user?.userId,
              tenantId: result.user?.tenantId,
              role: result.user?.role,
              tokenFingerprint: result.user?.tokenFingerprint,
            },
          });
          writeJson(response, 200, createOkEnvelope(result, { startedAt }));
        } catch (error) {
          writeEnterpriseError({ response, error, startedAt, fallbackCode: "enterprise_user_upsert_failed" });
        }
        return;
      }

      if (request.method === "POST" && url.pathname === "/enterprise/users/revoke") {
        const body = await readEnterpriseJson({ request, response, startedAt, code: "enterprise_user_invalid_json" });
        if (!body) return;

        try {
          const result = enterpriseGovernanceService.revokeUser(body, request.enterpriseIdentity);
          await enterpriseGovernanceService.recordAudit({
            outcome: "allowed",
            method: request.method,
            path: url.pathname,
            permission: "user:admin",
            statusCode: 200,
            code: "enterprise_user_revoked",
            identity: request.enterpriseIdentity,
            details: {
              userId: result.user?.userId,
              tenantId: result.user?.tenantId,
              role: result.user?.role,
              tokenFingerprint: result.user?.tokenFingerprint,
            },
          });
          writeJson(response, 200, createOkEnvelope(result, { startedAt }));
        } catch (error) {
          writeEnterpriseError({ response, error, startedAt, fallbackCode: "enterprise_user_revoke_failed" });
        }
        return;
      }

      if (request.method === "GET" && url.pathname === "/enterprise/security/readiness") {
        writeJson(response, 200, createOkEnvelope(enterpriseGovernanceService.getSecurityReadiness(), { startedAt }));
        return;
      }

      if (request.method === "GET" && url.pathname === "/enterprise/audit") {
        const limit = url.searchParams.get("limit") ?? 50;
        writeJson(response, 200, createOkEnvelope(await enterpriseGovernanceService.listAudit({ limit, filters: readAuditFilters(url) }), { startedAt }));
        return;
      }

      if (request.method === "GET" && url.pathname === "/enterprise/audit/export") {
        const limit = url.searchParams.get("limit") ?? 200;
        const format = url.searchParams.get("format") ?? "jsonl";
        writeJson(response, 200, createOkEnvelope(await enterpriseGovernanceService.exportAudit({ limit, format, filters: readAuditFilters(url) }), { startedAt }));
        return;
      }

      if (request.method === "GET" && url.pathname === "/enterprise/acceptance/report") {
        writeJson(response, 200, createOkEnvelope(await readEnterpriseAcceptanceReport(), { startedAt }));
        return;
      }

      if (request.method === "GET" && url.pathname === "/enterprise/release-candidate/dry-run") {
        writeJson(response, 200, createOkEnvelope(await readEnterpriseReleaseCandidateDryRun(), { startedAt }));
        return;
      }

      if (request.method === "GET" && url.pathname === "/enterprise/overview") {
        writeJson(response, 200, createOkEnvelope(await readEnterpriseOverview(application), { startedAt }));
        return;
      }

      if (request.method === "GET" && url.pathname === "/enterprise/deployment/readiness") {
        writeJson(response, 200, createOkEnvelope(enterpriseOpsService.getReadiness(), { startedAt }));
        return;
      }

      if (request.method === "GET" && url.pathname === "/enterprise/startup/readiness") {
        writeJson(response, 200, createOkEnvelope(enterpriseOpsService.getStartupReadiness(), { startedAt }));
        return;
      }

      if (request.method === "POST" && url.pathname === "/enterprise/backup") {
        const body = await readEnterpriseJson({ request, response, startedAt, code: "enterprise_backup_invalid_json" });
        if (!body) return;

        try {
          const result = await enterpriseOpsService.createBackup(body, request.enterpriseIdentity);
          await enterpriseGovernanceService.recordAudit({
            outcome: "allowed",
            method: request.method,
            path: url.pathname,
            permission: "user:admin",
            statusCode: 200,
            code: "enterprise_backup_created",
            identity: request.enterpriseIdentity,
            details: {
              backupId: result.backupId,
              backupFileName: result.backupFileName,
              byteSize: result.byteSize,
            },
          });
          writeJson(response, 200, createOkEnvelope(result, { startedAt }));
        } catch (error) {
          writeEnterpriseError({ response, error, startedAt, fallbackCode: "enterprise_backup_failed" });
        }
        return;
      }

      if (request.method === "POST" && url.pathname === "/enterprise/restore/validate") {
        const body = await readEnterpriseJson({ request, response, startedAt, code: "enterprise_restore_invalid_json" });
        if (!body) return;

        try {
          const result = await enterpriseOpsService.validateRestore(body);
          await enterpriseGovernanceService.recordAudit({
            outcome: result.valid ? "allowed" : "denied",
            method: request.method,
            path: url.pathname,
            permission: "user:admin",
            statusCode: 200,
            code: result.valid ? "enterprise_restore_validate_ready" : "enterprise_restore_validate_blocked",
            identity: request.enterpriseIdentity,
            details: {
              backupId: result.backupId,
              blockers: result.blockers,
              warnings: result.warnings,
            },
          });
          writeJson(response, 200, createOkEnvelope(result, { startedAt }));
        } catch (error) {
          writeEnterpriseError({ response, error, startedAt, fallbackCode: "enterprise_restore_validate_failed" });
        }
        return;
      }

      if (request.method === "GET" && url.pathname === "/dashboard/status") {
        writeJson(response, 200, createOkEnvelope(userExperienceService.getDashboard(), { startedAt }));
        return;
      }

      if (request.method === "GET" && url.pathname === "/auth/status") {
        writeJson(
          response,
          200,
          createOkEnvelope(
            {
              ...userExperienceService.getAuthStatus(),
              enterprise: enterpriseGovernanceService.getHealth(),
            },
            { startedAt },
          ),
        );
        return;
      }

      if (request.method === "GET" && (url.pathname === "/health" || url.pathname === "/health/check")) {
        writeJson(response, 200, createOkEnvelope(createHealth(application), { startedAt }));
        return;
      }

      if (request.method === "GET" && url.pathname === "/setup/readiness") {
        writeJson(response, 200, createOkEnvelope(createSetupReadiness(application), { startedAt }));
        return;
      }

      if (request.method === "GET" && url.pathname === "/providers") {
        writeJson(response, 200, createOkEnvelope(createProviders(application), { startedAt }));
        return;
      }

      if (request.method === "GET" && url.pathname === "/models/capability-router/status") {
        writeJson(response, 200, createOkEnvelope(capabilityRouterService.getStatus(), { startedAt }));
        return;
      }

      if (request.method === "GET" && url.pathname === "/provider-config/status") {
        writeJson(response, 200, createOkEnvelope(providerConfigRoutes.status(), { startedAt }));
        return;
      }

      if (request.method === "POST" && url.pathname === "/provider-config/save") {
        const body = await readCapabilityJson({ request, response, startedAt, code: "provider_config_save_invalid_json" });
        if (!body) return;
        writeJson(response, 200, createOkEnvelope(providerConfigRoutes.save(body), { startedAt }));
        return;
      }

      if (request.method === "POST" && url.pathname === "/provider-config/test") {
        const body = await readCapabilityJson({ request, response, startedAt, code: "provider_config_test_invalid_json" });
        if (!body) return;
        const result = await providerConfigRoutes.test(body);
        writeJson(response, 200, createOkEnvelope(result, { startedAt }));
        return;
      }

      if (request.method === "GET" && url.pathname === "/model-library") {
        const registry = modelLibraryStore.getRegistry();
        const usabilityMatrix = buildModelUsabilityMatrix({ registry });
        writeJson(
          response,
          200,
          createOkEnvelope(
            {
              registry,
              usabilityMatrix,
              providerConfig: providerConfigRoutes.status(),
              routesAvailable: {
                saveProviderConfig: true,
                testProviderKey: true,
                refreshModelLibrary: true,
                testSelectedModel: true,
                setTaskDefault: true,
                chatGateway: true,
                usabilityMatrix: true,
                verificationPlan: true,
                verifyDryRun: true,
              },
            },
            { startedAt },
          ),
        );
        return;
      }

      if (request.method === "GET" && url.pathname === "/model-library/usability-matrix") {
        const registry = modelLibraryStore.getRegistry();
        writeJson(response, 200, createOkEnvelope({ matrix: buildModelUsabilityMatrix({ registry }) }, { startedAt }));
        return;
      }

      if (request.method === "GET" && url.pathname === "/model-library/verification-plan") {
        const registry = modelLibraryStore.getRegistry();
        const matrix = buildModelUsabilityMatrix({ registry });
        const plan = createModelVerificationPlan({
          registry,
          matrix,
          maxModels: url.searchParams.get("maxModels") ?? undefined,
          bucket: url.searchParams.get("bucket") ?? "",
          includeUnverified: url.searchParams.get("includeUnverified") !== "false",
          includeFailedRetry: url.searchParams.get("includeFailedRetry") === "true",
          realSmokeEnabled: url.searchParams.get("realSmokeEnabled") === "true",
          rpmLimit: url.searchParams.get("rpmLimit") ?? undefined,
          providerId: url.searchParams.get("providerId") ?? "nvidia",
          env: application.runtimeEnv ?? process.env,
        });
        writeJson(response, 200, createOkEnvelope({ plan }, { startedAt }));
        return;
      }

      if (request.method === "POST" && url.pathname === "/model-library/verify-dry-run") {
        const body = await readCapabilityJson({ request, response, startedAt, code: "model_library_verify_dry_run_invalid_json" });
        if (!body) return;
        const registry = modelLibraryStore.getRegistry();
        const matrix = buildModelUsabilityMatrix({ registry });
        const plan = createModelVerificationPlan({
          registry,
          matrix,
          ...body,
          realSmokeEnabled: false,
          env: application.runtimeEnv ?? process.env,
        });
        writeJson(response, 200, createOkEnvelope({ plan, providerCalled: false }, { startedAt }));
        return;
      }

      if (request.method === "POST" && url.pathname === "/model-library/refresh") {
        const body = await readCapabilityJson({ request, response, startedAt, code: "model_library_refresh_invalid_json" });
        if (!body) return;
        const registry = await modelLibraryStore.refreshCatalog({ allowLiveDiscovery: body.allowLiveDiscovery === true });
        writeJson(response, 200, createOkEnvelope({ registry, usabilityMatrix: buildModelUsabilityMatrix({ registry }) }, { startedAt }));
        return;
      }

      if (request.method === "POST" && url.pathname === "/model-library/test-model") {
        const body = await readCapabilityJson({ request, response, startedAt, code: "model_library_test_invalid_json" });
        if (!body) return;
        const result = await testPhase312AModel({ application, body });
        writeJson(response, 200, createOkEnvelope(result, { startedAt }));
        return;
      }

      if (request.method === "POST" && url.pathname === "/model-library/task-default") {
        const body = await readCapabilityJson({ request, response, startedAt, code: "model_library_task_default_invalid_json" });
        if (!body) return;
        writeJson(response, 200, createOkEnvelope(modelLibraryStore.setTaskDefault(body), { startedAt }));
        return;
      }

      if (request.method === "POST" && (url.pathname === "/chat-gateway/execute" || url.pathname === "/chat/gateway")) {
        const body = await readCapabilityJson({ request, response, startedAt, code: "chat_gateway_execute_invalid_json" });
        if (!body) return;
        const taijiBeidouExecuteHook = evaluateTaijiBeidouChatGatewayExecutePreviewHook({ body, route: url.pathname });
        if (taijiBeidouExecuteHook.action === "respond") {
          writeJson(response, taijiBeidouExecuteHook.responseStatus ?? 200, createOkEnvelope(taijiBeidouExecuteHook.result, { startedAt }));
          return;
        }
        const result = await runPhase312AChatGateway({ application, body, startedAt });
        writeJson(response, 200, createOkEnvelope(result, { startedAt }));
        return;
      }

      if (request.method === "POST" && url.pathname === "/three-mode/execute") {
        const body = await readCapabilityJson({ request, response, startedAt, code: "three_mode_execute_invalid_json" });
        if (!body) return;
        const result = await executeThreeModeRequest({ request: body, application });
        writeJson(response, result.success ? 200 : 422, result);
        return;
      }

      if (request.method === "GET" && url.pathname === "/real-capabilities/status") {
        writeJson(response, 200, createOkEnvelope(await fiveCapabilityActivationService.getStatus(), { startedAt }));
        return;
      }

      if (request.method === "POST" && url.pathname === "/real-capabilities/activate-five") {
        const body = await readCapabilityJson({ request, response, startedAt, code: "real_capabilities_activate_five_invalid_json" });
        if (!body) return;
        const result = await fiveCapabilityActivationService.activateFive(body);
        writeServiceLog("five_real_capability_activation_completed", {
          method: request.method,
          path: url.pathname,
          runId: result.runId,
          executionStatus: result.executionStatus,
          providerNetworkAttempted: result.providerNetworkAttempted,
          durationMs: Date.now() - startedAt,
        });
        writeJson(response, result.completionVerified ? 200 : 422, createOkEnvelope(result, { startedAt }));
        return;
      }

      if (request.method === "GET" && url.pathname === "/chat-gateway/task-matrix") {
        writeJson(response, 200, createOkEnvelope({ taskId: "task_matrix", taskMatrix: TASK_MATRIX }, { startedAt }));
        return;
      }

      if (request.method === "GET" && url.pathname.startsWith("/chat-gateway/evidence/")) {
        const evidenceId = url.pathname.split("/chat-gateway/evidence/")[1];
        const record = await getEvidenceById(evidenceId);
        if (record) {
          writeJson(response, 200, createOkEnvelope(record, { startedAt }));
        } else {
          writeJson(response, 404, createErrorEnvelope("evidence_not_found", `Evidence ${evidenceId} not found.`, { startedAt }));
        }
        return;
      }

      if (request.method === "POST" && url.pathname === "/chat-gateway/dry-run-task") {
        const body = await readCapabilityJson({ request, response, startedAt, code: "dry_run_task_invalid_json" });
        if (!body) return;
        const dryRunResult = await runPhase314ADryRunTask({ application, body, startedAt });
        writeJson(response, 200, createOkEnvelope(dryRunResult, { startedAt }));
        return;
      }

      if (request.method === "GET" && url.pathname === "/chat-gateway/latency-policy") {
        writeJson(response, 200, createOkEnvelope({
          phase: "Phase315A",
          timeoutTypes: PHASE315A_TIMEOUT_TYPES,
          latencyRiskLevels: PHASE315A_LATENCY_RISK_LEVELS,
          completionConfidenceValues: PHASE315A_COMPLETION_CONFIDENCE,
          dryRunCases: LATENCY_DRY_RUN_CASES.map((item) => item.caseId),
          realFallbackDefaultEnabled: false,
          browserRealSmokeRouteAdded: false,
        }, { startedAt }));
        return;
      }

      if (request.method === "POST" && url.pathname === "/chat-gateway/latency-dry-run") {
        const body = await readCapabilityJson({ request, response, startedAt, code: "latency_dry_run_invalid_json" });
        if (!body) return;
        writeJson(response, 200, createOkEnvelope(runPhase315ALatencyDryRun(body), { startedAt }));
        return;
      }

      if (request.method === "GET" && url.pathname === "/workbench/diagnostics/status") {
        const registry = modelLibraryStore.getRegistry();
        const matrix = buildModelUsabilityMatrix({ registry });
        const records = Array.isArray(matrix.records) ? matrix.records : [];
        const selectableChatModels = records.filter((item) => {
          const bucket = String(item?.capabilityBucket ?? "").toLowerCase();
          return item?.verificationStatus === "smoke_passed"
            && item?.selectable === true
            && item?.directChatAllowed === true
            && (bucket === "chat" || bucket === "reasoning_chat" || bucket === "code");
        }).map((item) => item.modelId);

        writeJson(response, 200, createOkEnvelope({
          phase: "Phase318A",
          health: createHealth(application),
          doctor: {
            command: "cmd /c pnpm doctor:phase13a",
            executed: false,
            status: "not_run",
            note: "UI 只读显示 doctor 命令边界，不自动执行。",
          },
          modelLibrary: {
            totalRecords: records.length,
            smokePassedRecords: records.filter((item) => item?.verificationStatus === "smoke_passed").length,
            selectableChatModels,
            failedRecords: records.filter((item) => item?.verificationStatus === "smoke_failed").map((item) => item.modelId),
          },
          chatGateway: {
            executeRoute: true,
            dryRunRoute: true,
            taskMatrixCount: TASK_MATRIX.length,
            defaultChatChanged: false,
            blockedActionsProviderCalled: false,
          },
          providerStatus: providerConfigRoutes.status(),
        }, { startedAt }));
        return;
      }

      if (request.method === "GET" && url.pathname === "/codex-handoff/next-task") {
        writeJson(response, 200, createOkEnvelope(createNextCodexTask(), { startedAt }));
        return;
      }

      if (request.method === "GET" && url.pathname === "/codex-loop/status") {
        writeJson(response, 200, createOkEnvelope(await readCodexLoopStatus(), { startedAt }));
        return;
      }

      if (request.method === "GET" && url.pathname === "/cost/health") {
        writeJson(
          response,
          200,
          createOkEnvelope(
            {
              success: true,
              enabled: true,
              mode: "preview-only",
              externalApiCalled: false,
              paidApiCalled: false,
              apiKeyRead: false,
              defaultNvidiaChatLaneChanged: false,
            },
            { startedAt },
          ),
        );
        return;
      }

      if (request.method === "POST" && url.pathname === "/cost/estimate") {
        const body = await readCapabilityJson({ request, response, startedAt, code: "token_cost_estimate_invalid_json" });
        if (!body) return;

        try {
          const result = checkTokenCostGuard({
            ...body,
            requestType: body.requestType ?? "cost-estimate-preview",
          });
          writeJson(
            response,
            200,
            createOkEnvelope(
              {
                mode: "preview-only",
                estimate: result.estimate,
                savings: result.savings,
                cache: result.cache,
                safety: result.safety,
              },
              { startedAt },
            ),
          );
        } catch (error) {
          writeCapabilityError({ response, error, startedAt, fallbackCode: "token_cost_estimate_failed" });
        }
        return;
      }

      if (request.method === "POST" && url.pathname === "/cost/guard/check") {
        const body = await readCapabilityJson({ request, response, startedAt, code: "token_cost_guard_invalid_json" });
        if (!body) return;

        try {
          const result = checkTokenCostGuard({
            ...body,
            requestType: body.requestType ?? "cost-guard-check-preview",
          });
          await appendEstimateRecord({
            requestType: body.requestType ?? "cost-guard-check-preview",
            provider: body.provider ?? "preview-provider",
            model: body.model ?? "preview-model",
            modelTier: result.estimate.modelTier,
            estimate: result.estimate,
            savings: result.savings,
            cache: result.cache,
            decision: result.decision,
          });
          writeJson(response, 200, createOkEnvelope(result, { startedAt }));
        } catch (error) {
          writeCapabilityError({ response, error, startedAt, fallbackCode: "token_cost_guard_failed" });
        }
        return;
      }

      if (request.method === "GET" && url.pathname === "/cost/summary") {
        const summary = await readTokenCostSummary();
        writeJson(response, 200, createOkEnvelope({
          ...summary,
          calibrationPreview: readLatestMimoTokenCalibrationProfile({
            provider: "mimo",
            model: "mimo-v2.5-pro",
          }),
          cachePersistencePreview: {
            cachePersistenceAvailable: true,
            cachePolicyVersion: createResponseCachePolicy().cacheVersion,
            mode: createResponseCachePolicy().mode,
            summary: await readResponseCacheSummary(),
          },
          cacheHardeningPreview: {
            cachePersistenceAvailable: true,
            cachePolicyVersion: createResponseCachePolicy().cachePolicyVersion,
            mode: createResponseCachePolicy().mode,
            semanticModelEnabled: false,
            semanticDecisionUsedAsFinalAuthority: false,
            allowIntentSoftHit: createResponseCachePolicy().allowIntentSoftHit,
            allowMultilingualIntentSoftHit: createResponseCachePolicy().allowMultilingualIntentSoftHit,
            summary: await readResponseCacheSummary(),
          },
        }, { startedAt }));
        return;
      }

      if (request.method === "GET" && url.pathname === "/cache/health") {
        const policy = createResponseCachePolicy();
        writeJson(response, 200, createOkEnvelope({
          success: true,
          enabled: policy.enabled,
          mode: policy.mode,
          cacheVersion: policy.cacheVersion,
          cachePolicyVersion: policy.cachePolicyVersion,
          semanticModelEnabled: policy.semanticModelEnabled,
          semanticJudgeAvailable: policy.semanticJudgeAvailable,
          semanticDecisionUsedAsFinalAuthority: policy.semanticDecisionUsedAsFinalAuthority,
          allowIntentSoftHit: policy.allowIntentSoftHit,
          allowMultilingualIntentSoftHit: policy.allowMultilingualIntentSoftHit,
          externalApiCalled: false,
          paidApiCalled: false,
          apiKeyRead: false,
          defaultNvidiaChatLaneChanged: false,
        }, { startedAt }));
        return;
      }

      if (request.method === "POST" && url.pathname === "/cache/lookup") {
        const body = await readCapabilityJson({ request, response, startedAt, code: "response_cache_lookup_invalid_json" });
        if (!body) return;

        try {
          const key = body.cacheKey ? { cacheKey: body.cacheKey } : createResponseCacheKey(body);
          const result = await lookupCache({ cacheKey: key.cacheKey });
          writeJson(response, 200, createOkEnvelope({
            mode: createResponseCachePolicy().mode,
            cacheKey: key.cacheKey,
            cacheDecision: result.cacheDecision,
            cacheHitType: result.cacheHitType,
            duplicateReason: result.duplicateReason,
            finalDecisionBy: result.finalDecisionBy,
            semanticDecisionUsedAsFinalAuthority: false,
            ...result,
            intentSignature: result.intentSignature ?? key.intentSignature,
            paraphraseGroupId: result.paraphraseGroupId ?? key.paraphraseGroupId,
            queryLanguage: result.queryLanguage ?? key.queryLanguage,
            externalApiCalled: false,
            paidApiCalled: false,
            apiKeyRead: false,
          }, { startedAt }));
        } catch (error) {
          writeCapabilityError({ response, error, startedAt, fallbackCode: "response_cache_lookup_failed" });
        }
        return;
      }

      if (request.method === "POST" && url.pathname === "/cache/write") {
        const body = await readCapabilityJson({ request, response, startedAt, code: "response_cache_write_invalid_json" });
        if (!body) return;

        try {
          const key = body.cacheKey ? {
            cacheKey: body.cacheKey,
            queryHash: body.queryHash,
            selectedSourcesHash: body.selectedSourcesHash,
          } : createResponseCacheKey(body);
          const result = await writeCacheRecord({
            ...body,
            cacheKey: key.cacheKey,
            rawQueryHash: key.rawQueryHash ?? body.rawQueryHash,
            normalizedQueryHash: key.normalizedQueryHash ?? body.normalizedQueryHash ?? key.queryHash,
            queryHash: key.queryHash ?? body.queryHash,
            queryLanguage: key.queryLanguage ?? body.queryLanguage,
            intentSignature: key.intentSignature ?? body.intentSignature,
            paraphraseGroupId: key.paraphraseGroupId ?? body.paraphraseGroupId,
            selectedSourcesHash: key.selectedSourcesHash ?? body.selectedSourcesHash,
            latestEvidenceHash: key.latestEvidenceHash ?? body.latestEvidenceHash,
            answerContractHash: key.answerContractHash ?? body.answerContractHash,
          });
          writeJson(response, 200, createOkEnvelope({
            mode: createResponseCachePolicy().mode,
            ...result,
            externalApiCalled: false,
            paidApiCalled: false,
            apiKeyRead: false,
          }, { startedAt }));
        } catch (error) {
          writeCapabilityError({ response, error, startedAt, fallbackCode: "response_cache_write_failed" });
        }
        return;
      }

      if (request.method === "POST" && url.pathname === "/cache/invalidate") {
        const body = await readCapabilityJson({ request, response, startedAt, code: "response_cache_invalidate_invalid_json" });
        if (!body) return;

        try {
          const result = await invalidateCache({
            cacheKey: body.cacheKey,
            reason: body.reason ?? "preview-http-invalidate",
          });
          writeJson(response, 200, createOkEnvelope({
            mode: createResponseCachePolicy().mode,
            ...result,
            externalApiCalled: false,
            paidApiCalled: false,
            apiKeyRead: false,
          }, { startedAt }));
        } catch (error) {
          writeCapabilityError({ response, error, startedAt, fallbackCode: "response_cache_invalidate_failed" });
        }
        return;
      }

      if (request.method === "GET" && url.pathname === "/cache/summary") {
        writeJson(response, 200, createOkEnvelope({
          mode: createResponseCachePolicy().mode,
          ...(await readResponseCacheSummary()),
          allowIntentSoftHit: createResponseCachePolicy().allowIntentSoftHit,
          allowMultilingualIntentSoftHit: createResponseCachePolicy().allowMultilingualIntentSoftHit,
          semanticModelEnabled: false,
          semanticDecisionUsedAsFinalAuthority: false,
          cacheHardeningPreview: true,
          externalApiCalled: false,
          paidApiCalled: false,
          apiKeyRead: false,
        }, { startedAt }));
        return;
      }

      if (request.method === "GET" && url.pathname === "/cache/audit") {
        const limit = Number(url.searchParams.get("limit") ?? 100);
        writeJson(response, 200, createOkEnvelope({
          mode: createResponseCachePolicy().mode,
          events: await listResponseCacheAuditTrail({ limit }),
          externalApiCalled: false,
          paidApiCalled: false,
          apiKeyRead: false,
        }, { startedAt }));
        return;
      }

      if (request.method === "POST" && url.pathname === "/routing/answer-path/preview") {
        const body = await readCapabilityJson({ request, response, startedAt, code: "answer_path_routing_preview_invalid_json" });
        if (!body) return;

        try {
          const result = routeAnswerPath({
            ...body,
            requestType: body.requestType ?? "answer-path-routing-preview",
          });
          writeJson(response, 200, createOkEnvelope({
            success: true,
            mode: "local-routing-preview-only",
            answerPath: result.answerPath,
            modelTier: result.modelTier,
            providerRecommendation: result.providerRecommendation,
            modelRecommendation: result.modelRecommendation,
            requiresPaidApi: result.requiresPaidApi,
            requiresApproval: result.requiresApproval,
            shouldBlock: result.shouldBlock,
            blockReason: result.blockReason,
            routingReason: result.routingReason,
            cacheDecision: result.cacheDecision,
            cacheHitType: result.cacheHitType,
            tokenGuardDecision: result.tokenGuard?.decision,
            paidApiCallCount: 0,
            externalApiCalled: false,
            mimoApiCalled: false,
            defaultNvidiaChatLaneChanged: false,
            mimoSetAsDefault: false,
            audit: result.audit,
          }, { startedAt }));
        } catch (error) {
          writeCapabilityError({ response, error, startedAt, fallbackCode: "answer_path_routing_preview_failed" });
        }
        return;
      }

      if (request.method === "POST" && url.pathname === "/routing/quality-cost/preview") {
        const body = await readCapabilityJson({ request, response, startedAt, code: "quality_cost_routing_preview_invalid_json" });
        if (!body) return;

        try {
          const result = routeQualityCostAnswer({
            ...body,
            requestType: body.requestType ?? "quality-cost-routing-preview",
            requestedQualityLevel: body.requestedQualityLevel ?? "normal",
            budgetPreference: body.budgetPreference ?? "balanced",
          });
          writeJson(response, 200, createOkEnvelope({
            success: true,
            mode: "local-quality-cost-routing-preview-only",
            providerAgnostic: true,
            singleProviderLocked: false,
            answerPath: result.answerPath,
            modelTier: result.modelTier,
            providerRecommendation: result.providerRecommendation,
            modelRecommendation: result.modelRecommendation,
            premiumCandidates: result.premiumCandidates,
            defaultPremiumProvider: result.defaultPremiumProvider,
            requiresPaidApi: result.requiresPaidApi,
            requiresApproval: result.requiresApproval,
            shouldBlock: result.shouldBlock,
            blockReason: result.blockReason,
            routingReason: result.routingReason,
            qualityGateRequired: result.answerQualityGate?.qualityGateRequired === true,
            qualityTarget: result.answerQualityGate?.qualityTarget,
            progressiveEscalationEnabled: result.progressiveEscalation?.progressiveEscalationEnabled === true,
            cacheDecision: result.cacheDecision,
            cacheHitType: result.cacheHitType,
            tokenGuardDecision: result.tokenGuard?.decision,
            paidApiCallCount: 0,
            externalApiCalled: false,
            mimoApiCalled: false,
            modelActuallyCalled: false,
            defaultNvidiaChatLaneChanged: false,
            mimoSetAsDefault: false,
            audit: result.audit,
          }, { startedAt }));
        } catch (error) {
          writeCapabilityError({ response, error, startedAt, fallbackCode: "quality_cost_routing_preview_failed" });
        }
        return;
      }

      if (request.method === "POST" && url.pathname === "/codex-handoff/next-task") {
        try {
          const result = await writeNextCodexTaskOutbox();
          writeServiceLog("codex_next_task_handoff_generated", {
            taskId: result.taskId,
            mode: result.mode,
            executionEnabled: result.executionEnabled,
            codexExecInvoked: result.codexExecInvoked,
          });
          writeJson(response, 200, createOkEnvelope(result, { startedAt }));
        } catch (error) {
          writeCapabilityError({ response, error, startedAt, fallbackCode: "codex_next_task_handoff_failed" });
        }
        return;
      }

      if (request.method === "POST" && url.pathname === "/models/capability-router/preview") {
        const body = await readCapabilityJson({ request, response, startedAt, code: "capability_router_preview_invalid_json" });
        if (!body) return;

        try {
          const result = capabilityRouterService.preview(body);
          writeServiceLog("capability_router_preview_completed", {
            method: request.method,
            path: url.pathname,
            status: result.status,
            detectedTaskType: result.task?.detectedTaskType,
            requiredCapabilities: result.task?.requiredCapabilities,
            selectedProvider: result.recommendation?.selected?.providerId,
            selectedModel: result.recommendation?.selected?.modelId,
            durationMs: Date.now() - startedAt,
          });
          writeJson(response, 200, createOkEnvelope(result, { startedAt }));
        } catch (error) {
          writeCapabilityError({ response, error, startedAt, fallbackCode: "capability_router_preview_failed" });
        }
        return;
      }

      if (request.method === "GET" && url.pathname === "/connectors") {
        writeJson(
          response,
          200,
          createOkEnvelope(
            {
              connectors: [
                {
                  connectorId: "explicit-text",
                  title: "Explicit Text Connector",
                  mode: "manual-input",
                  safety: "No crawling, no broad file scan, no background sync.",
                },
                {
                  connectorId: "feishu",
                  title: "Feishu / Lark",
                  mode: "webhook",
                  status: connectorFeishuDryRun ? "dry-run" : "ready",
                  webhookConfigured: !connectorFeishuDryRun,
                  dryRun: connectorFeishuDryRun,
                },
                {
                  connectorId: "wecom",
                  title: "WeCom / Enterprise WeChat",
                  mode: "webhook",
                  status: connectorWeComDryRun ? "dry-run" : "ready",
                  webhookConfigured: !connectorWeComDryRun,
                  dryRun: connectorWeComDryRun,
                },
              ],
            },
            { startedAt },
          ),
        );
        return;
      }

      if (request.method === "POST" && url.pathname === "/connectors/feishu/send") {
        const body = await readCapabilityJson({ request, response, startedAt, code: "feishu_send_invalid_json" });
        if (!body) return;
        const webhookUrl = application.runtimeEnv?.FEISHU_WEBHOOK_URL || process.env.FEISHU_WEBHOOK_URL || "";
        const dryRun = !webhookUrl;
        if (dryRun) {
          writeJson(response, 200, createOkEnvelope({
            route: "/connectors/feishu/send", delivered: false, dryRun: true,
            metadata: { connectorId: "feishu", messagePreview: (body.body || body.text || "").slice(0, 100) },
          }, { startedAt }));
        } else {
          try {
            const payload = { msg_type: "text", content: { text: `[${body.title || "AI Gateway"}]\n${body.body || body.text || ""}` } };
            const resp = await fetch(webhookUrl, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(payload) });
            const result = await resp.json().catch(() => ({}));
            writeJson(response, 200, createOkEnvelope({
              route: "/connectors/feishu/send", delivered: resp.ok && result.code === 0, dryRun: false,
              externalMessageId: result.message_id || null,
            }, { startedAt }));
          } catch (error) {
            writeCapabilityError({ response, error, startedAt, fallbackCode: "feishu_send_failed" });
          }
        }
        return;
      }

      if (request.method === "POST" && url.pathname === "/connectors/wecom/send") {
        const body = await readCapabilityJson({ request, response, startedAt, code: "wecom_send_invalid_json" });
        if (!body) return;
        const webhookUrl = application.runtimeEnv?.WECOM_WEBHOOK_URL || process.env.WECOM_WEBHOOK_URL || "";
        const dryRun = !webhookUrl;
        if (dryRun) {
          writeJson(response, 200, createOkEnvelope({
            route: "/connectors/wecom/send", delivered: false, dryRun: true,
            metadata: { connectorId: "wecom", messagePreview: (body.body || body.text || "").slice(0, 100) },
          }, { startedAt }));
        } else {
          try {
            const payload = { msgtype: "text", text: { content: `[${body.title || "AI Gateway"}]\n${body.body || body.text || ""}` } };
            const resp = await fetch(webhookUrl, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(payload) });
            const result = await resp.json().catch(() => ({}));
            writeJson(response, 200, createOkEnvelope({
              route: "/connectors/wecom/send", delivered: resp.ok && result.errcode === 0, dryRun: false,
              externalMessageId: result.msgid || null,
            }, { startedAt }));
          } catch (error) {
            writeCapabilityError({ response, error, startedAt, fallbackCode: "wecom_send_failed" });
          }
        }
        return;
      }

      if (request.method === "GET" && url.pathname === "/config/runtime") {
        writeJson(response, 200, createOkEnvelope(getSafeRuntimeConfig(application.config), { startedAt }));
        return;
      }

      if (request.method === "POST" && url.pathname === "/providers/runtime-credential/detect") {
        let body;
        try {
          body = await readJson(request);
        } catch {
          writeJson(
            response,
            400,
            createErrorEnvelope("provider_runtime_credential_detect_invalid_json", "Runtime credential detection body must be valid JSON.", {
              startedAt,
              category: "validation",
            }),
          );
          return;
        }

        try {
          const result = await detectRuntimeCredentialProviders(application, body);
          writeServiceLog("provider_runtime_credential_detected", {
            method: request.method,
            path: url.pathname,
            apiKeyPresent: result.apiKeyPresent,
            detectedCount: result.detected?.length ?? 0,
            recommendedProviderId: result.recommended?.providerId,
            durationMs: Date.now() - startedAt,
          });
          writeJson(response, 200, createOkEnvelope(result, { startedAt }));
        } catch (error) {
          writeJson(
            response,
            error?.category === "validation" ? 400 : 422,
            createErrorEnvelope(error?.code ?? "provider_runtime_credential_detect_failed", error instanceof Error ? error.message : "Runtime credential detection failed.", {
              startedAt,
              category: error?.category ?? "provider",
              retryable: false,
              details: sanitizeCredentialErrorDetails(error?.details),
            }),
          );
        }
        return;
      }

      if (request.method === "POST" && url.pathname === "/providers/runtime-credential") {
        let body;
        try {
          body = await readJson(request);
        } catch {
          writeJson(
            response,
            400,
            createErrorEnvelope("provider_runtime_credential_invalid_json", "Runtime credential body must be valid JSON.", {
              startedAt,
              category: "validation",
            }),
          );
          return;
        }

        try {
          const result = setRuntimeProviderCredential(application, body);
          writeServiceLog("provider_runtime_credential_set", {
            method: request.method,
            path: url.pathname,
            providerId: result.providerId,
            apiKeyPresent: result.apiKeyPresent,
            secretStorage: result.secretStorage,
            durationMs: Date.now() - startedAt,
          });
          writeJson(response, 200, createOkEnvelope(result, { startedAt }));
        } catch (error) {
          writeJson(
            response,
            error?.category === "validation" ? 400 : 422,
            createErrorEnvelope(error?.code ?? "provider_runtime_credential_failed", error instanceof Error ? error.message : "Runtime credential update failed.", {
              startedAt,
              category: error?.category ?? "provider",
              retryable: false,
              details: sanitizeCredentialErrorDetails(error?.details),
            }),
          );
        }
        return;
      }

      if (request.method === "GET" && url.pathname === "/models/import/providers") {
        writeJson(response, 200, createOkEnvelope({
          providers: listModelImportProviders(),
        }, { startedAt }));
        return;
      }

      if (request.method === "POST" && url.pathname === "/models/import/preview") {
        let body;
        try {
          body = await readJson(request);
        } catch {
          writeJson(
            response,
            400,
            createErrorEnvelope("model_import_preview_invalid_json", "Model import preview body must be valid JSON.", {
              startedAt,
              category: "validation",
            }),
          );
          return;
        }

        try {
          const result = await modelImportService.preview(body);
          writeServiceLog("model_import_preview_completed", {
            method: request.method,
            path: url.pathname,
            status: result.status,
            providerId: result.providerId,
            modelCount: result.models?.length ?? 0,
            durationMs: Date.now() - startedAt,
          });
          writeJson(response, 200, createOkEnvelope(result, { startedAt }));
        } catch (error) {
          writeJson(
            response,
            error?.category === "validation" ? 400 : 422,
            createErrorEnvelope(error?.code ?? "model_import_preview_failed", error instanceof Error ? error.message : "Model import preview failed.", {
              startedAt,
              category: error?.category ?? "provider",
              retryable: false,
              details: sanitizeCredentialErrorDetails(error?.details),
            }),
          );
        }
        return;
      }

      if (request.method === "POST" && url.pathname === "/models/import/confirm") {
        let body;
        try {
          body = await readJson(request);
        } catch {
          writeJson(
            response,
            400,
            createErrorEnvelope("model_import_confirm_invalid_json", "Model import confirm body must be valid JSON.", {
              startedAt,
              category: "validation",
            }),
          );
          return;
        }

        try {
          const result = modelImportService.confirm(body);
          writeServiceLog("model_import_confirm_completed", {
            method: request.method,
            path: url.pathname,
            status: result.status,
            providerId: result.providerId,
            modelId: result.modelId,
            runtimeChatUsable: result.runtimeChatUsable,
            durationMs: Date.now() - startedAt,
          });
          writeJson(response, 200, createOkEnvelope(result, { startedAt }));
        } catch (error) {
          writeJson(
            response,
            error?.category === "validation" ? 400 : 422,
            createErrorEnvelope(error?.code ?? "model_import_confirm_failed", error instanceof Error ? error.message : "Model import confirm failed.", {
              startedAt,
              category: error?.category ?? "provider",
              retryable: false,
              details: sanitizeCredentialErrorDetails(error?.details),
            }),
          );
        }
        return;
      }

      if (request.method === "GET" && url.pathname === "/route/modes") {
        writeJson(response, 200, createOkEnvelope(createRouteModes(), { startedAt }));
        return;
      }

      if (request.method === "GET" && url.pathname === "/runtime-candidate/codex-exec-crs/status") {
        writeJson(response, 200, createOkEnvelope(codexExecCrsRuntimeCandidate.getStatus(), { startedAt }));
        return;
      }

      if (request.method === "POST" && url.pathname === "/runtime-candidate/codex-exec-crs/dry-run-smoke") {
        const body = await readCapabilityJson({ request, response, startedAt, code: "runtime_candidate_dry_run_smoke_invalid_json" });
        if (!body) return;
        writeJson(response, 200, createOkEnvelope(codexExecCrsRuntimeCandidate.runDryRunSmoke(body), { startedAt }));
        return;
      }

      if (request.method === "POST" && url.pathname === "/runtime-candidate/codex-exec-crs/guarded-one-shot") {
        const body = await readCapabilityJson({ request, response, startedAt, code: "runtime_candidate_guarded_one_shot_invalid_json" });
        if (!body) return;
        writeJson(response, 200, createOkEnvelope(codexExecCrsRuntimeCandidate.runGuardedOneShot(body), { startedAt }));
        return;
      }

      if (request.method === "POST" && url.pathname === "/runtime-candidate/codex-exec-crs/reliability") {
        const body = await readCapabilityJson({ request, response, startedAt, code: "runtime_candidate_reliability_invalid_json" });
        if (!body) return;
        writeJson(response, 200, createOkEnvelope(codexExecCrsRuntimeCandidate.runRepeatedReliability(body), { startedAt }));
        return;
      }

      if (request.method === "GET" && url.pathname === "/knowledge/health") {
        writeJson(response, 200, createOkEnvelope(knowledgeService.getHealth(), { startedAt }));
        return;
      }

      if (request.method === "GET" && url.pathname === "/knowledge/infra/readiness") {
        writeJson(response, 200, createOkEnvelope(application.knowledgeInfra.getReadiness(), { startedAt }));
        return;
      }

      if (request.method === "GET" && url.pathname === "/knowledge/sources") {
        writeJson(response, 200, createOkEnvelope(knowledgeService.listSources(), { startedAt }));
        return;
      }

      if (request.method === "GET" && url.pathname === "/knowledge/file-types") {
        writeJson(response, 200, createOkEnvelope({ supported: getSupportedKnowledgeFileTypes() }, { startedAt }));
        return;
      }

      if (request.method === "GET" && url.pathname === "/workflow/health") {
        writeJson(response, 200, createOkEnvelope(workflowService.getHealth(), { startedAt }));
        return;
      }

      if (request.method === "GET" && url.pathname === "/workflow/actions") {
        writeJson(response, 200, createOkEnvelope(workflowService.listActions(), { startedAt }));
        return;
      }

      if (request.method === "GET" && url.pathname === "/workforce/health") {
        writeJson(response, 200, createOkEnvelope(workforceService.getHealth(), { startedAt }));
        return;
      }

      if (request.method === "GET" && url.pathname === "/workforce/agents") {
        writeJson(response, 200, createOkEnvelope(workforceService.listAgents(), { startedAt }));
        return;
      }

      if (request.method === "POST" && url.pathname === "/workforce/plan") {
        const body = await readCapabilityJson({ request, response, startedAt, code: "workforce_plan_invalid_json" });
        if (!body) return;

          try {
            const result = workforceService.plan(body);
            const autoSaveResult = await workforceService.savePlan({ plan: result });
            const responseData = {
              ...result,
              autoSaved: true,
              planId: autoSaveResult.planId,
              autoSave: {
                phase: "phase-225a-agent-workforce-auto-save-latest-plan",
                status: autoSaveResult.status,
                planId: autoSaveResult.planId,
                savedAt: autoSaveResult.savedAt,
                historyVisible: true,
                handoffCodexReady: true,
                manualSaveStillAvailable: true,
                executionEnabled: false,
                codexExecInvoked: false,
                workflowRun: false,
                worktreeCreated: false,
              },
            };
            writeServiceLog("workforce_plan_completed", {
              method: request.method,
              path: url.pathname,
              workforceId: responseData.workforceId,
              roleCount: responseData.selectedRoles?.length ?? 0,
              autoSaved: true,
              planId: autoSaveResult.planId,
              durationMs: Date.now() - startedAt,
            });
            writeJson(response, 200, createOkEnvelope(responseData, { startedAt, traceId: body?.context?.traceId }));
          } catch (error) {
          writeServiceLog("workforce_plan_failed", {
            method: request.method,
            path: url.pathname,
            code: error?.code,
            durationMs: Date.now() - startedAt,
          });
          writeCapabilityError({ response, error, startedAt, fallbackCode: "workforce_plan_failed" });
        }
        return;
      }

      if (request.method === "POST" && url.pathname === "/workforce/run-local") {
        const body = await readCapabilityJson({ request, response, startedAt, code: "workforce_run_local_invalid_json" });
        if (!body) return;

        try {
          const result = await workforceService.runLocal(body);
          writeServiceLog("workforce_real_local_run_completed", {
            method: request.method,
            path: url.pathname,
            runId: result.runId,
            planId: result.planId,
            workforceId: result.workforceId,
            taskCount: result.taskQueue?.length ?? 0,
            providerCallsMade: false,
            durationMs: Date.now() - startedAt,
          });
          writeJson(response, 200, createOkEnvelope(result, { startedAt, traceId: body?.context?.traceId }));
        } catch (error) {
          writeServiceLog("workforce_real_local_run_failed", {
            method: request.method,
            path: url.pathname,
            code: error?.code,
            durationMs: Date.now() - startedAt,
          });
          writeCapabilityError({ response, error, startedAt, fallbackCode: "workforce_real_local_run_failed" });
        }
        return;
      }

      if (request.method === "POST" && url.pathname === "/workforce/plans/save") {
        const body = await readCapabilityJson({ request, response, startedAt, code: "workforce_plan_save_invalid_json" });
        if (!body) return;

        try {
          const result = await workforceService.savePlan(body);
          writeServiceLog("workforce_plan_saved", {
            method: request.method,
            path: url.pathname,
            planId: result.planId,
            workforceId: result.taskPackage?.workforceId,
            durationMs: Date.now() - startedAt,
          });
          writeJson(response, 200, createOkEnvelope(result, { startedAt, traceId: body?.context?.traceId }));
        } catch (error) {
          writeServiceLog("workforce_plan_save_failed", {
            method: request.method,
            path: url.pathname,
            code: error?.code,
            durationMs: Date.now() - startedAt,
          });
          writeCapabilityError({ response, error, startedAt, fallbackCode: "workforce_plan_save_failed" });
        }
        return;
      }

      if (request.method === "GET" && url.pathname === "/workforce/plans") {
        try {
          const result = await workforceService.listPlans();
          writeJson(response, 200, createOkEnvelope(result, { startedAt }));
        } catch (error) {
          writeCapabilityError({ response, error, startedAt, fallbackCode: "workforce_plan_list_failed" });
        }
        return;
      }

      const workforceClarificationMatch = url.pathname.match(/^\/workforce\/plans\/([^/]+)\/clarifications$/);
      if (workforceClarificationMatch && request.method === "POST") {
        const body = await readCapabilityJson({ request, response, startedAt, code: "workforce_clarifications_invalid_json" });
        if (!body) return;

        try {
          const planId = decodeURIComponent(workforceClarificationMatch[1]);
          const result = await workforceService.answerClarifications(planId, body);
          writeServiceLog("workforce_clarifications_saved", {
            method: request.method,
            path: url.pathname,
            planId: result.planId,
            answeredCount: result.answeredCount,
            durationMs: Date.now() - startedAt,
          });
          writeJson(response, 200, createOkEnvelope(result, { startedAt, traceId: body?.context?.traceId }));
        } catch (error) {
          writeCapabilityError({ response, error, startedAt, fallbackCode: "workforce_clarifications_failed" });
        }
        return;
      }

      const workforceLifecycleMatch = url.pathname.match(/^\/workforce\/plans\/([^/]+)\/lifecycle$/);
      if (workforceLifecycleMatch && request.method === "POST") {
        const body = await readCapabilityJson({ request, response, startedAt, code: "workforce_lifecycle_invalid_json" });
        if (!body) return;

        try {
          const planId = decodeURIComponent(workforceLifecycleMatch[1]);
          const result = await workforceService.updatePlanLifecycle(planId, body);
          writeServiceLog("workforce_lifecycle_saved", {
            method: request.method,
            path: url.pathname,
            planId: result.planId,
            lifecycleState: result.lifecycle?.current,
            durationMs: Date.now() - startedAt,
          });
          writeJson(response, 200, createOkEnvelope(result, { startedAt, traceId: body?.context?.traceId }));
        } catch (error) {
          writeCapabilityError({ response, error, startedAt, fallbackCode: "workforce_lifecycle_failed" });
        }
        return;
      }

      const workforceReviewPackageMatch = url.pathname.match(/^\/workforce\/plans\/([^/]+)\/review-package$/);
      if (workforceReviewPackageMatch && request.method === "GET") {
        try {
          const planId = decodeURIComponent(workforceReviewPackageMatch[1]);
          const result = await workforceService.getPlanReviewPackage(planId);
          writeJson(response, 200, createOkEnvelope(result, { startedAt }));
        } catch (error) {
          writeCapabilityError({ response, error, startedAt, fallbackCode: "workforce_review_package_failed" });
        }
        return;
      }

      const workforceApprovalGateMatch = url.pathname.match(/^\/workforce\/plans\/([^/]+)\/approval-gate$/);
      if (workforceApprovalGateMatch && request.method === "POST") {
        const body = await readCapabilityJson({ request, response, startedAt, code: "workforce_approval_gate_invalid_json" });
        if (!body) return;

        try {
          const planId = decodeURIComponent(workforceApprovalGateMatch[1]);
          const result = await workforceService.recordPlanApprovalGate(planId, body);
          writeServiceLog("workforce_approval_gate_recorded", {
            method: request.method,
            path: url.pathname,
            planId: result.planId,
            decision: result.decision,
            durationMs: Date.now() - startedAt,
          });
          writeJson(response, 200, createOkEnvelope(result, { startedAt, traceId: body?.context?.traceId }));
        } catch (error) {
          writeCapabilityError({ response, error, startedAt, fallbackCode: "workforce_approval_gate_failed" });
        }
        return;
      }

      const workforcePlanMatch = url.pathname.match(/^\/workforce\/plans\/([^/]+)(\/export)?$/);
      if (workforcePlanMatch && request.method === "GET") {
        try {
          const planId = decodeURIComponent(workforcePlanMatch[1]);
          const result = workforcePlanMatch[2]
            ? await workforceService.exportPlan(planId)
            : await workforceService.getPlan(planId);
          writeJson(response, 200, createOkEnvelope(result, { startedAt }));
        } catch (error) {
          writeCapabilityError({ response, error, startedAt, fallbackCode: "workforce_plan_read_failed" });
        }
        return;
      }

      if (workforcePlanMatch && request.method === "DELETE" && !workforcePlanMatch[2]) {
        try {
          const planId = decodeURIComponent(workforcePlanMatch[1]);
          const result = await workforceService.deletePlan(planId);
          writeServiceLog("workforce_plan_deleted", {
            method: request.method,
            path: url.pathname,
            planId: result.planId,
            durationMs: Date.now() - startedAt,
          });
          writeJson(response, 200, createOkEnvelope(result, { startedAt }));
        } catch (error) {
          writeCapabilityError({ response, error, startedAt, fallbackCode: "workforce_plan_delete_failed" });
        }
        return;
      }

      if (request.method === "POST" && (url.pathname === "/workflow/plan" || url.pathname === "/workflow/run")) {
        let body;
        try {
          body = await readJson(request);
        } catch {
          writeJson(
            response,
            400,
            createErrorEnvelope("workflow_invalid_json", "Workflow request body must be valid JSON.", {
              startedAt,
              category: "validation",
            }),
          );
          return;
        }

        try {
          const result = url.pathname === "/workflow/plan" ? workflowService.plan(body) : await workflowService.run(body);
          writeServiceLog(url.pathname === "/workflow/plan" ? "workflow_plan_completed" : "workflow_run_completed", {
            method: request.method,
            path: url.pathname,
            workflowId: result.workflowId,
            durationMs: Date.now() - startedAt,
          });
          writeJson(response, 200, createOkEnvelope(result, { startedAt, traceId: body?.context?.traceId }));
        } catch (error) {
          writeServiceLog("workflow_request_failed", {
            method: request.method,
            path: url.pathname,
            code: error?.code,
            durationMs: Date.now() - startedAt,
          });
          writeJson(
            response,
            error?.category === "validation" ? 400 : 422,
            createErrorEnvelope(error?.code ?? "workflow_request_failed", error instanceof Error ? error.message : "Workflow request failed.", {
              startedAt,
              category: error?.category ?? "workflow",
              retryable: false,
              details: error?.details,
            }),
          );
        }
        return;
      }

      if (request.method === "POST" && url.pathname === "/memory/save") {
        const body = await readCapabilityJson({ request, response, startedAt, code: "memory_invalid_json" });
        if (!body) return;

        try {
          writeJson(response, 200, createOkEnvelope(userExperienceService.saveMemory(body, getRequestContext(request)), { startedAt }));
        } catch (error) {
          writeCapabilityError({ response, error, startedAt, fallbackCode: "memory_save_failed" });
        }
        return;
      }

      if (request.method === "GET" && url.pathname === "/memory/list") {
        writeJson(response, 200, createOkEnvelope(userExperienceService.listMemory(getRequestContext(request)), { startedAt }));
        return;
      }

      if (request.method === "POST" && url.pathname === "/memory/retrieve") {
        const body = await readCapabilityJson({ request, response, startedAt, code: "memory_invalid_json" });
        if (!body) return;

        try {
          writeJson(response, 200, createOkEnvelope(userExperienceService.retrieveMemory(body, getRequestContext(request)), { startedAt }));
        } catch (error) {
          writeCapabilityError({ response, error, startedAt, fallbackCode: "memory_retrieve_failed" });
        }
        return;
      }

      if (request.method === "POST" && url.pathname === "/connectors/import/text") {
        const body = await readCapabilityJson({ request, response, startedAt, code: "connector_invalid_json" });
        if (!body) return;

        try {
          writeJson(response, 200, createOkEnvelope(userExperienceService.importTextConnector(body, getRequestContext(request)), { startedAt }));
        } catch (error) {
          writeCapabilityError({ response, error, startedAt, fallbackCode: "connector_import_failed" });
        }
        return;
      }

      if (request.method === "POST" && url.pathname === "/evaluation/score") {
        const body = await readCapabilityJson({ request, response, startedAt, code: "evaluation_invalid_json" });
        if (!body) return;

        try {
          writeJson(response, 200, createOkEnvelope(userExperienceService.scoreEvaluation(body), { startedAt }));
        } catch (error) {
          writeCapabilityError({ response, error, startedAt, fallbackCode: "evaluation_score_failed" });
        }
        return;
      }

      if (request.method === "POST" && url.pathname === "/knowledge/graph/retrieve") {
        const body = await readCapabilityJson({ request, response, startedAt, code: "graph_invalid_json" });
        if (!body) return;

        try {
          writeJson(response, 200, createOkEnvelope(userExperienceService.retrieveGraph(body), { startedAt }));
        } catch (error) {
          writeCapabilityError({ response, error, startedAt, fallbackCode: "graph_retrieve_failed" });
        }
        return;
      }

      if (request.method === "POST" && url.pathname === "/knowledge/load") {
        let body;
        try {
          body = await readJson(request);
        } catch {
          writeJson(
            response,
            400,
            createErrorEnvelope("knowledge_invalid_json", "Knowledge load body must be valid JSON.", {
              startedAt,
              category: "validation",
            }),
          );
          return;
        }

        try {
          const result = knowledgeService.loadDocuments(body);
          writeServiceLog("knowledge_load_completed", {
            method: request.method,
            path: url.pathname,
            sourceId: result.sourceId,
            loadedCount: result.loadedCount,
            durationMs: Date.now() - startedAt,
          });
          writeJson(response, 200, createOkEnvelope(result, { startedAt }));
        } catch (error) {
          writeServiceLog("knowledge_load_failed", {
            method: request.method,
            path: url.pathname,
            code: error?.code,
            durationMs: Date.now() - startedAt,
          });
          writeJson(
            response,
            error?.category === "validation" ? 400 : 422,
            createErrorEnvelope(error?.code ?? "knowledge_load_failed", error instanceof Error ? error.message : "Knowledge load failed.", {
              startedAt,
              category: error?.category ?? "knowledge",
              retryable: false,
              details: error?.details,
            }),
          );
        }
        return;
      }

      if (request.method === "POST" && url.pathname === "/knowledge/load/file") {
        let body;
        try {
          body = await readJson(request);
        } catch {
          writeJson(
            response,
            400,
            createErrorEnvelope("knowledge_invalid_json", "Knowledge file load body must be valid JSON.", {
              startedAt,
              category: "validation",
            }),
          );
          return;
        }

        try {
          const files = Array.isArray(body?.files) ? body.files : [];

          if (files.length === 0) {
            const error = new Error("Knowledge file load requires at least one file.");
            error.code = "KNOWLEDGE_FILE_LOAD_FILES_REQUIRED";
            error.category = "validation";
            throw error;
          }

          const documents = [];
          const skipped = [];

          for (const file of files) {
            try {
              documents.push(await parseKnowledgeFile(file));
            } catch (error) {
              skipped.push({
                fileName: file?.fileName ?? file?.name ?? "unknown",
                code: error?.code ?? "KNOWLEDGE_FILE_PARSE_FAILED",
                message: error instanceof Error ? error.message : "File parse failed.",
                details: error?.details,
              });
            }
          }

          if (documents.length === 0) {
            const error = new Error("No uploaded file produced loadable text.");
            error.code = "KNOWLEDGE_FILE_LOAD_NO_DOCUMENTS";
            error.category = "validation";
            error.details = { skipped };
            throw error;
          }

          const result = knowledgeService.loadDocuments({
            sourceId: body.sourceId ?? "ui-file-import-source",
            sourceTitle: body.sourceTitle ?? "UI File Import Source",
            metadata: {
              parserEntry: "knowledge-load-file",
              ...(body.metadata ?? {}),
            },
            documents,
          });

          writeServiceLog("knowledge_file_load_completed", {
            method: request.method,
            path: url.pathname,
            sourceId: result.sourceId,
            loadedCount: result.loadedCount,
            skippedCount: skipped.length,
            durationMs: Date.now() - startedAt,
          });
          writeJson(
            response,
            200,
            createOkEnvelope(
              {
                ...result,
                skipped,
                supported: getSupportedKnowledgeFileTypes(),
              },
              { startedAt },
            ),
          );
        } catch (error) {
          writeServiceLog("knowledge_file_load_failed", {
            method: request.method,
            path: url.pathname,
            code: error?.code,
            durationMs: Date.now() - startedAt,
          });
          writeJson(
            response,
            error?.category === "validation" ? 400 : 422,
            createErrorEnvelope(error?.code ?? "knowledge_file_load_failed", error instanceof Error ? error.message : "Knowledge file load failed.", {
              startedAt,
              category: error?.category ?? "knowledge",
              retryable: false,
              details: error?.details,
            }),
          );
        }
        return;
      }

      if (request.method === "POST" && url.pathname === "/knowledge/retrieve") {
        let body;
        try {
          body = await readJson(request);
        } catch {
          writeJson(
            response,
            400,
            createErrorEnvelope("knowledge_invalid_json", "Knowledge retrieve body must be valid JSON.", {
              startedAt,
              category: "validation",
            }),
          );
          return;
        }

        try {
          const result = knowledgeService.retrieve(body);
          writeServiceLog("knowledge_retrieve_completed", {
            method: request.method,
            path: url.pathname,
            chunkCount: result.chunks.length,
            durationMs: Date.now() - startedAt,
          });
          writeJson(response, 200, createOkEnvelope(result, { startedAt, traceId: body?.context?.traceId }));
        } catch (error) {
          writeServiceLog("knowledge_retrieve_failed", {
            method: request.method,
            path: url.pathname,
            code: error?.code,
            durationMs: Date.now() - startedAt,
          });
          writeJson(
            response,
            error?.category === "validation" ? 400 : 422,
            createErrorEnvelope(error?.code ?? "knowledge_retrieve_failed", error instanceof Error ? error.message : "Knowledge retrieve failed.", {
              startedAt,
              category: error?.category ?? "knowledge",
              retryable: false,
              details: error?.details,
            }),
          );
        }
        return;
      }

      if (request.method === "POST" && url.pathname === "/chat/rag/stream") {
        let body;
        try {
          body = await readJson(request);
        } catch {
          const parseError = new Error("RAG stream request body must be valid JSON.");
          parseError.code = "VALIDATION_ERROR";
          parseError.type = "validation";
          parseError.category = "validation";
          parseError.retryable = false;
          writeJson(response, 400, createRouteFailureEnvelope(parseError, { startedAt }));
          return;
        }

        try {
          const prompt = extractChatPrompt(body);
          if (!prompt) {
            const validationError = new Error("RAG stream request requires a prompt, query, or user message.");
            validationError.code = "VALIDATION_ERROR";
            validationError.category = "validation";
            validationError.retryable = false;
            throw validationError;
          }

          const retrieveRequest = createRagRetrieveRequest(body, prompt);
          const retrieveResult = knowledgeService.retrieve(retrieveRequest);
          const citations = createRagCitations(retrieveResult.chunks);
          const augmentedPrompt = createRagPrompt(prompt, citations);
          const chatInput = normalizeRagChatBody(
            {
              ...body,
              prompt: augmentedPrompt,
              metadata: {
                ...(body.metadata ?? {}),
                phase: "phase-31a-rag-stream-chat",
                ragEnabled: true,
                ragMode: "service-side-stream",
                knowledgeInjected: citations.length > 0,
                knowledgeCitationCount: citations.length,
              },
            },
            application.config,
          );

          writeSseHeaders(response);
          writeSseEvent(response, "knowledge", {
            type: "knowledge",
            prompt,
            query: retrieveRequest.query,
            citations,
            retrieved: citations.length > 0,
            chunkCount: retrieveResult.chunks?.length ?? 0,
          });

          let failed = false;
          for await (const event of gatewayService.executeStream(chatInput)) {
            if (event.type === "error") {
              failed = true;
              writeSseEvent(response, "error", event.envelope);
              break;
            }

            writeSseEvent(response, event.type, {
              ...event,
              rag: {
                enabled: true,
                mode: "service-side-stream",
                citationCount: citations.length,
              },
            });
          }

          writeServiceLog(failed ? "rag_stream_failed" : "rag_stream_completed", {
            method: request.method,
            path: url.pathname,
            citationCount: citations.length,
            durationMs: Date.now() - startedAt,
          });
          response.end();
        } catch (error) {
          writeServiceLog("rag_stream_failed", {
            method: request.method,
            path: url.pathname,
            code: error?.code,
            durationMs: Date.now() - startedAt,
          });
          writeJson(
            response,
            error?.category === "validation" ? 400 : 422,
            createErrorEnvelope(error?.code ?? "rag_stream_failed", error instanceof Error ? error.message : "RAG stream failed.", {
              startedAt,
              category: error?.category ?? "rag",
              retryable: error?.retryable ?? false,
              details: error?.details,
            }),
          );
        }
        return;
      }

      if (request.method === "POST" && url.pathname === "/chat/rag") {
        let body;
        try {
          body = await readJson(request);
        } catch {
          const parseError = new Error("RAG chat request body must be valid JSON.");
          parseError.code = "VALIDATION_ERROR";
          parseError.type = "validation";
          parseError.category = "validation";
          parseError.retryable = false;
          writeJson(response, 400, createRouteFailureEnvelope(parseError, { startedAt }));
          return;
        }

        try {
          const prompt = extractChatPrompt(body);
          if (!prompt) {
            const validationError = new Error("RAG chat request requires a prompt, query, or user message.");
            validationError.code = "VALIDATION_ERROR";
            validationError.category = "validation";
            validationError.retryable = false;
            throw validationError;
          }

          const retrieveRequest = createRagRetrieveRequest(body, prompt);
          const retrieveResult = knowledgeService.retrieve(retrieveRequest);
          const citations = createRagCitations(retrieveResult.chunks);
          const augmentedPrompt = createRagPrompt(prompt, citations);
          const chatInput = normalizeRagChatBody(
            {
              ...body,
              prompt: augmentedPrompt,
              metadata: {
                ...(body.metadata ?? {}),
                phase: "phase-29a-service-rag-chat",
                ragEnabled: true,
                ragMode: "service-side",
                knowledgeInjected: citations.length > 0,
                knowledgeCitationCount: citations.length,
              },
            },
            application.config,
          );
          const chatResult = await gatewayService.execute(chatInput);
          const ragData = createRagChatData({
            prompt,
            retrieveRequest,
            retrieveResult,
            citations,
            chatResult,
          });

          writeServiceLog(chatResult.success ? "rag_chat_completed" : "rag_chat_failed", {
            method: request.method,
            path: url.pathname,
            code: chatResult.code,
            requestId: chatResult.meta?.requestId,
            provider: chatResult.data?.selectedProvider ?? chatResult.error?.provider,
            citationCount: citations.length,
            durationMs: Date.now() - startedAt,
          });

          if (!chatResult.success) {
            writeJson(response, 400, {
              ...chatResult,
              data: {
                ...(chatResult.data ?? {}),
                rag: ragData.rag,
                knowledge: ragData.knowledge,
              },
            });
            return;
          }

          writeJson(response, 200, createOkEnvelope(ragData, { startedAt, traceId: body?.context?.traceId }));
        } catch (error) {
          writeServiceLog("rag_chat_failed", {
            method: request.method,
            path: url.pathname,
            code: error?.code,
            durationMs: Date.now() - startedAt,
          });
          writeJson(
            response,
            error?.category === "validation" ? 400 : 422,
            createErrorEnvelope(error?.code ?? "rag_chat_failed", error instanceof Error ? error.message : "RAG chat failed.", {
              startedAt,
              category: error?.category ?? "rag",
              retryable: error?.retryable ?? false,
              details: error?.details,
            }),
          );
        }
        return;
      }

      if (
        request.method === "POST" &&
        (url.pathname === "/chat/stream" ||
          url.pathname === "/chat" ||
          url.pathname === "/gateway/route" ||
          url.pathname === "/gateway/mock" ||
          url.pathname === "/route")
      ) {
        let body;
        try {
          body = await readJson(request);
        } catch {
          const parseError = new Error("Route request body must be valid JSON.");
          parseError.code = "VALIDATION_ERROR";
          parseError.type = "validation";
          parseError.category = "validation";
          parseError.retryable = false;
          writeJson(response, 400, createRouteFailureEnvelope(parseError, { startedAt }));
          return;
        }

        if (url.pathname === "/chat") {
          const taijiBeidouChatHook = evaluateTaijiBeidouChatPreviewHook({ body, route: url.pathname });
          if (taijiBeidouChatHook.action === "respond") {
            writeJson(response, taijiBeidouChatHook.responseStatus ?? 200, createOkEnvelope(taijiBeidouChatHook.result, { startedAt }));
            return;
          }

          const prompt = extractChatPrompt(body);
          const localActionProposal = routeChatActionProposal({ prompt, env: application.runtimeEnv ?? process.env });
          if (localActionProposal.action === "respond") {
            const localActionResult = await handleChatLocalActionRoute({
              prompt,
              env: application.runtimeEnv ?? process.env,
              approval: body?.ownerAutomationApproval ?? null,
              evidencePhase: "phase1911a",
            });
            writeJson(response, 200, createOkEnvelope({
              route: "/chat",
              actionType: "local_action_preview",
              approvalRequired: true,
              handoffActionId: localActionResult.localActionProposal?.actionId ?? null,
              localActionExecuted: localActionResult.chatTriggeredLocalAction === true,
              completionVerified: false,
              verificationReason: "本地桌面动作请求需要通过 action preview 链路处理，不能由普通聊天直接标记完成。",
              providerCalled: false,
              providerCallsMade: false,
              currentPageModelSelectionWarning: null,
              localActionProposal: localActionResult.localActionProposal,
              approvalGate: localActionResult.approvalGate ?? null,
              chatTriggeredLocalAction: localActionResult.chatTriggeredLocalAction === true,
              desktopFileCreated: localActionResult.desktopFileCreated === true,
              desktopFileCreatedCount: localActionResult.desktopFileCreatedCount ?? 0,
              chatGatewayExecuteProviderChainCalled: false,
              ownerAutomationChatProposalFlag: OWNER_AUTOMATION_CHAT_PROPOSAL_FLAG,
              chatDefaultBehaviorPreserved: true,
              chatGatewayExecuteDefaultBehaviorPreserved: true,
              userVisibleSummary: localActionResult.localActionProposal?.userVisibleSummary ?? "已识别本地桌面动作；默认只生成 action proposal，不执行真实桌面动作。",
              statusLabel: "preview",
              statusDescription: "此请求已识别为本地桌面动作预览，需要审批后才能真实执行。仅生成说明文本不等于真实完成。",
              safety: {
                overwriteDetected: false,
                desktopScanPerformed: false,
                desktopOtherFilesRead: false,
                secretValueExposed: false,
              },
            }, { startedAt }));
            return;
          }
        }

        if (url.pathname === "/chat/stream") {
          writeSseHeaders(response);

          let failed = false;
          for await (const event of gatewayService.executeStream(normalizeChatBody(body, application.config))) {
            if (event.type === "error") {
              failed = true;
              writeSseEvent(response, "error", event.envelope);
              break;
            }

            writeSseEvent(response, event.type, event);
          }

          writeServiceLog(failed ? "request_stream_failed" : "request_stream_completed", {
            method: request.method,
            path: url.pathname,
            durationMs: Date.now() - startedAt,
          });
          response.end();
          return;
        }

        const result = await gatewayService.execute(url.pathname === "/chat" ? normalizeChatBody(body, application.config) : body);
        writeServiceLog(result.success ? "request_completed" : "request_failed", {
          method: request.method,
          path: url.pathname,
          code: result.code,
          requestId: result.meta?.requestId,
          provider: result.data?.selectedProvider ?? result.error?.provider,
          durationMs: Date.now() - startedAt,
        });
        writeJson(response, result.success ? 200 : 400, result);
        return;
      }

      if (request.method === "GET" && url.pathname === "/ws/info") {
        writeJson(response, 200, createOkEnvelope({
          route: "/ws/info",
          websocket: true,
          endpoint: "/ws",
          connectionCount: wsServer.getConnectionCount(),
          protocols: ["json"],
          description: "Real-time bidirectional chat via WebSocket",
        }, { startedAt }));
        return;
      }

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

function writeServiceLog(event, details = {}) {
  logger.info(event, details);
}

function createHealth(application) {
  return {
    app: "ai-gateway-service",
    status: "ready",
    phase: "phase-7a-1-service-entry",
    routes: [
      "GET /health/check",
      "GET /ui",
      "GET /console",
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
    enterprise: application.enterpriseGovernanceService.getHealth(),
    providerMode: application.config.aiGatewayService.providerMode,
    realProviderEnabled: application.config.aiGatewayService.realProviderEnabled,
    providers: application.gatewayService.getProviderDescriptors(),
  };
}

function createSetupReadiness(application) {
  const health = createHealth(application);
  const providerCatalog = listModelImportProviders();
  const providerDescriptors = application.gatewayService.getProviderDescriptors();
  const knowledgeHealth = application.knowledgeService.getHealth();
  const workforceHealth = application.workforceService.getHealth();
  const modelImportReady = providerCatalog.length > 0;
  const chatReady = providerDescriptors.length > 0 && health.status === "ready";
  const knowledgeReady = knowledgeHealth.status === "ready" || knowledgeHealth.ready === true;
  const workforceReady = workforceHealth.status === "ready" && workforceHealth.ready === true;

  return {
    phase: "phase-104a-first-run-setup",
    status: "ready",
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

async function runPhase312AChatGateway({ application, body, startedAt }) {
  const input = String(body?.input ?? body?.message ?? body?.messages?.at?.(-1)?.content ?? "").trim();
  const requestedMode = normalizeGatewayMode(body?.mode);
  const messages = Array.isArray(body?.messages) && body.messages.length
    ? body.messages
    : [{ role: "user", content: input }];
  const registry = application.modelLibraryStore.getRegistry();
  const intent = classifyGatewayIntent(input);
  const selectedModel = normalizeModelSelection(body?.selectedModel ?? body?.modelSelection ?? body);
  const taskToolPreference = normalizeModelSelection(body?.taskToolPreference);
  const mode = selectedModel.providerId && selectedModel.modelId && requestedMode === "automatic_gateway"
    ? "manual_model"
    : requestedMode;
  const plan = planGatewayModel({
    registry,
    intent,
    mode,
    selectedModel: mode === "manual_model" ? selectedModel : null,
    taskToolPreference,
  });
  const env = application.runtimeEnv ?? process.env;
  const realProviderEnabled = application?.config?.aiGatewayService?.realProviderEnabled !== false;
  const execution = !realProviderEnabled
    ? createPhase312ARealCallDisabledExecution(
        plan,
        "real_provider_disabled",
        "Chat Gateway real provider execution is disabled by runtime configuration.",
      )
    : await executeCapabilitySafePlan({
        plan,
        input,
        messages,
        nvidiaClient: createNvidiaUnifiedClient({
          env,
          runtimeCredentialStore: application.runtimeCredentialStore,
          modelLibraryStore: application.modelLibraryStore,
        }),
      });
  const evidenceId = generateEvidenceId();
  execution.meta.evidenceId = evidenceId;
  const verification = verifyResultCompletion({
    intent,
    plan,
    execution,
  });
  const latencyFields = responseLatencyFields(execution, verification);
  const evidence = await recordChatGatewayEvidence({
    route: "/chat-gateway/execute",
    mode,
    intent,
    plan,
    evidenceId,
    execution: {
      success: execution.success,
      code: execution.code,
      message: execution.message,
      finalAnswerPreview: String(execution.finalAnswer ?? "").slice(0, 240),
      meta: execution.meta,
      blocker: execution.blocker,
      warnings: execution.warnings,
    },
    latencyAccountability: latencyFields,
    verification,
  });

  return {
    success: verification.verifiedCompleted,
    code: verification.verifiedCompleted ? "chat_gateway_completed" : "chat_gateway_not_completed",
    message: verification.verifiedCompleted
      ? "Chat Gateway completed with verified provider execution."
      : "Chat Gateway route executed, but completion verification did not pass.",
    finalAnswer: execution.finalAnswer,
    providerId: execution.meta?.providerId ?? plan.selected?.providerId ?? "nvidia",
    modelId: execution.meta?.modelId ?? plan.selected?.modelId ?? null,
    intentType: intent.intentType,
    taskId: plan.taskId ?? "unknown_intent",
    intentConfidence: intent.confidence ?? 0.55,
    selectedModel: plan.selected?.modelId ?? null,
    selectedModelBucket: plan.selected?.capability ?? null,
    selectionReason: plan.selected?.manual ? "manual_model_selection" : "automatic_model_selection",
    routeDecision: plan.routeDecision ?? "execute_with_verified_chat_model",
    safetyDecision: plan.safetyDecision ?? "safe",
    providerCalled: execution.meta?.providerCalled === true,
    providerName: execution.meta?.providerId ?? "nvidia",
    endpointUsed: execution.meta?.endpointType ?? plan.selected?.endpointType ?? null,
    executionStatus: verification.completionStatus,
    failureCode: execution.code ?? null,
    failureMessage: execution.message ?? "",
    completionVerified: verification.verifiedCompleted,
    verificationReason: verification.verificationReason ?? "",
    resultQualitySignal: verification.resultQualitySignal,
    ...latencyFields,
    evidenceId: evidence.evidenceId ?? "",
    warnings: Array.from(new Set([...(execution.warnings ?? []), ...(verification.warnings ?? [])])),
    blockers: Array.from(new Set([...(verification.blockers ?? []), execution.blocker?.code].filter(Boolean))),
    userVisibleSummary: buildUserVisibleSummary({ verification, execution, plan }),
    realExternalCall: execution.meta?.realExternalCall === true,
    verifiedCompleted: verification.verifiedCompleted,
    completionStatus: verification.completionStatus,
    fallbackUsed: execution.meta?.fallbackUsed === true,
    fallbackAttempted: execution.meta?.fallbackAttempted === true,
    fallbackEligible: execution.meta?.fallbackEligible === true,
    fallbackReason: execution.meta?.fallbackReason ?? "",
    stages: {
      intent,
      plan,
      executionStatus: {
        success: execution.success,
        code: execution.code,
        providerCalled: execution.meta?.providerCalled === true,
        modelCalled: execution.meta?.modelCalled ?? null,
      },
      verification,
    },
    evidence: {
      evidenceId: evidence.evidenceId,
      jsonlPath: evidence.jsonlPath,
      latestPath: evidence.latestPath,
    },
    meta: {
      startedAt,
      durationMs: Date.now() - startedAt,
      defaultChatChanged: false,
      defaultChatProviderChanged: false,
      paidApiCalled: false,
      mimoCalled: false,
      openaiCalled: false,
      claudeCalled: false,
      openrouterCalled: false,
      embeddingBatchTrainingCalled: false,
      secretExposed: false,
    },
  };
}

function createPhase312ARealCallDisabledExecution(
  plan,
  code = "real_provider_disabled",
  message = "Chat Gateway real provider execution is disabled by runtime configuration.",
) {
  return {
    success: false,
    code,
    message,
    finalAnswer: "",
    data: null,
    error: { code, message },
    providerResult: null,
    warnings: ["real NVIDIA provider execution is disabled by runtime configuration"],
    blocker: { code, message },
    meta: {
      providerId: plan.selected?.providerId ?? "nvidia",
      modelId: plan.selected?.modelId ?? null,
      endpointType: plan.selected?.endpointType ?? null,
      providerCalled: false,
      modelCalled: null,
      requestId: null,
      startedAt: new Date().toISOString(),
      completedAt: new Date().toISOString(),
      durationMs: 0,
      providerTimeoutMs: 0,
      timeoutHit: false,
      timeoutType: "none",
      lateResponseReceived: false,
      httpStatus: null,
      retryable: false,
      retryRecommended: false,
      retryAttempted: false,
      retryCount: 0,
      fallbackEligible: false,
      fallbackAttempted: false,
      fallbackModel: null,
      realExternalCall: false,
      fallbackUsed: false,
      fallbackReason: "",
      latencyRiskLevel: "normal",
      completionConfidence: "low",
      userVisibleLatencySummary: "未调用 provider。",
      evidenceId: generateEvidenceId(),
      executionSteps: [
        { step: "intent_classified", status: "done", intentType: plan.intentType },
        { step: "model_planned", status: "done", modelId: plan.selected?.modelId ?? null },
        { step: "provider_called", status: "blocked", providerId: "nvidia", providerCalled: false },
      ],
    },
  };
}

async function runPhase314ADryRunTask({ application, body, startedAt }) {
  const input = String(body?.input ?? body?.message ?? body?.messages?.at?.(-1)?.content ?? "").trim();
  const mode = normalizeGatewayMode(body?.mode);
  const messages = Array.isArray(body?.messages) && body.messages.length
    ? body.messages
    : [{ role: "user", content: input }];
  const registry = application.modelLibraryStore.getRegistry();
  const intent = classifyGatewayIntent(input);
  const selectedModel = normalizeModelSelection(body?.selectedModel ?? body?.modelSelection ?? body);
  const taskToolPreference = normalizeModelSelection(body?.taskToolPreference);
  const plan = planGatewayModel({
    registry,
    intent,
    mode,
    selectedModel: mode === "manual_model" ? selectedModel : null,
    taskToolPreference,
  });

  const evidenceId = generateEvidenceId();
  const execution = createPhase314ADryRunExecution(plan, evidenceId);
  const verification = verifyResultCompletion({ intent, plan, execution });
  const latencyFields = responseLatencyFields(execution, verification);
  const evidence = await recordChatGatewayEvidence({
    route: "/chat-gateway/dry-run-task",
    mode,
    intent,
    plan,
    execution: {
      success: execution.success,
      code: execution.code,
      message: execution.message,
      meta: execution.meta,
      blocker: execution.blocker,
      warnings: execution.warnings,
    },
    latencyAccountability: latencyFields,
    verification,
    evidenceId,
  });

  return {
    success: true,
    code: "dry_run_task_completed",
    message: "Dry-run task completed. Provider was NOT called.",
    taskId: plan.taskId ?? "unknown_intent",
    intentType: intent.intentType,
    intentConfidence: intent.confidence ?? 0.55,
    selectedModel: plan.selected?.modelId ?? null,
    routeDecision: plan.routeDecision ?? "require_clarification",
    safetyDecision: plan.safetyDecision ?? "unknown",
    providerCalled: false,
    providerName: null,
    endpointUsed: null,
    executionStatus: verification.completionStatus,
    completionVerified: verification.verifiedCompleted,
    verificationReason: verification.verificationReason ?? "",
    resultQualitySignal: verification.resultQualitySignal,
    ...latencyFields,
    evidenceId: evidence.evidenceId,
    warnings: verification.warnings,
    blockers: verification.blockers,
    userVisibleSummary: buildUserVisibleSummary({ verification, execution, plan }),
    meta: {
      startedAt,
      durationMs: Date.now() - startedAt,
      defaultChatChanged: false,
      defaultChatProviderChanged: false,
      dryRun: true,
      providerCalled: false,
      paidApiCalled: false,
      mimoCalled: false,
    },
  };
}

function createPhase314ADryRunExecution(plan, evidenceId) {
  const isBlocked = plan.blocked === true;
  return {
    success: false,
    code: isBlocked ? "dry_run_blocked" : "dry_run_only",
    message: isBlocked
      ? `Plan blocked: ${plan.blocker?.code ?? "unknown"}. Provider was NOT called.`
      : "Dry-run mode: provider was NOT called.",
    finalAnswer: "",
    data: null,
    error: null,
    providerResult: null,
    warnings: ["dry-run execution: no real provider call made"],
    blocker: plan.blocker ?? null,
    meta: {
      providerId: plan.selected?.providerId ?? null,
      modelId: plan.selected?.modelId ?? null,
      endpointType: plan.selected?.endpointType ?? null,
      providerCalled: false,
      modelCalled: null,
      requestId: null,
      startedAt: new Date().toISOString(),
      completedAt: new Date().toISOString(),
      durationMs: 0,
      providerTimeoutMs: 0,
      timeoutHit: false,
      timeoutType: "none",
      lateResponseReceived: false,
      httpStatus: null,
      retryable: false,
      retryRecommended: false,
      retryAttempted: false,
      retryCount: 0,
      fallbackEligible: false,
      fallbackAttempted: false,
      fallbackModel: null,
      realExternalCall: false,
      fallbackUsed: false,
      fallbackReason: "",
      latencyRiskLevel: "normal",
      completionConfidence: "low",
      userVisibleLatencySummary: "Dry-run：未调用 provider。",
      evidenceId,
    },
  };
}

function runPhase315ALatencyDryRun(body = {}) {
  const requestedCaseId = String(body.caseId ?? "").trim();
  const cases = requestedCaseId
    ? LATENCY_DRY_RUN_CASES.filter((item) => item.caseId === requestedCaseId)
    : LATENCY_DRY_RUN_CASES;
  const results = cases.map((testCase) => buildPhase315ALatencyDryRunResult(testCase));
  return {
    phase: "Phase315A",
    providerCalled: false,
    providerCalledInDryRun: false,
    totalCases: results.length,
    passedCases: results.filter((item) => item.pass).length,
    failedCases: results.filter((item) => !item.pass).length,
    results,
  };
}

function buildPhase315ALatencyDryRunResult(testCase) {
  const simulated = testCase.simulatedExecution ?? {};
  const latency = buildProviderLatencyAccountability(simulated);
  const retryFallback = buildProviderRetryFallbackAccountability({
    ...simulated,
    httpStatus: latency.httpStatus,
    timeoutType: latency.timeoutType,
    latencyRiskLevel: latency.latencyRiskLevel,
    fallbackModel: "nvidia/llama-3.3-nemotron-super-49b-v1",
    realFallbackEnabled: false,
  });
  const completionVerified = simulated.success === true &&
    simulated.responseShapeOk === true &&
    simulated.nonEmptyOutput === true &&
    latency.completionConfidence !== "failed" &&
    !["timeout_failed", "provider_unavailable"].includes(latency.latencyRiskLevel);
  const actual = {
    latencyRiskLevel: latency.latencyRiskLevel,
    completionConfidence: latency.completionConfidence,
    retryable: retryFallback.retryable,
    retryRecommended: retryFallback.retryRecommended,
    fallbackEligible: retryFallback.fallbackEligible,
    fallbackAttempted: retryFallback.fallbackAttempted,
    completionVerified,
  };
  const expected = testCase.expected ?? {};
  const pass = Object.entries(expected).every(([key, value]) => actual[key] === value) &&
    retryFallback.fallbackAttempted === false;
  return {
    caseId: testCase.caseId,
    providerCalled: false,
    simulatedProviderCalled: simulated.providerCalled === true,
    evidenceId: generateEvidenceId(),
    ...latency,
    ...retryFallback,
    completionVerified,
    expected,
    pass,
  };
}

function responseLatencyFields(execution, verification) {
  const quality = verification?.resultQualitySignal ?? {};
  const meta = execution?.meta ?? {};
  return {
    startedAt: meta.startedAt ?? quality.startedAt ?? null,
    completedAt: meta.completedAt ?? quality.completedAt ?? null,
    durationMs: Number(meta.durationMs ?? quality.durationMs ?? 0),
    providerTimeoutMs: Number(meta.providerTimeoutMs ?? quality.providerTimeoutMs ?? 0),
    timeoutHit: meta.timeoutHit === true || quality.timeoutHit === true,
    timeoutType: meta.timeoutType ?? quality.timeoutType ?? "none",
    lateResponseReceived: meta.lateResponseReceived === true || quality.lateResponseReceived === true,
    httpStatus: meta.httpStatus ?? quality.httpStatus ?? null,
    retryable: meta.retryable === true || quality.retryable === true,
    retryRecommended: meta.retryRecommended === true || quality.retryRecommended === true,
    retryAttempted: meta.retryAttempted === true || quality.retryAttempted === true,
    retryCount: Number(meta.retryCount ?? quality.retryCount ?? 0),
    fallbackEligible: meta.fallbackEligible === true || quality.fallbackEligible === true,
    fallbackAttempted: meta.fallbackAttempted === true || quality.fallbackAttempted === true,
    fallbackModel: meta.fallbackModel ?? quality.fallbackModel ?? null,
    fallbackReason: meta.fallbackReason ?? quality.fallbackReason ?? "",
    latencyRiskLevel: meta.latencyRiskLevel ?? quality.latencyRiskLevel ?? "normal",
    completionConfidence: meta.completionConfidence ?? quality.completionConfidence ?? "low",
    userVisibleLatencySummary: meta.userVisibleLatencySummary ?? quality.userVisibleLatencySummary ?? "",
  };
}

function buildUserVisibleSummary({ verification, execution, plan }) {
  const taskId = plan?.taskId ?? "unknown_intent";
  const routeDecision = plan?.routeDecision ?? "require_clarification";
  const latencySummary = execution?.meta?.userVisibleLatencySummary ?? "";

  if (taskId === "unsafe_secret_request") {
    return "系统拒绝了危险请求：不会泄露 API Key 或密钥信息。未调用模型。";
  }
  if (taskId === "unsafe_release_request") {
    return "系统拒绝了发布/部署请求：不会执行 commit / push / deploy / release。未调用模型。";
  }
  if (taskId === "unsupported_non_chat_model_request") {
    return "系统拦截了非聊天模型请求：该模型不能用于直接聊天。未调用模型。";
  }
  if (taskId === "unknown_intent") {
    return "系统无法确定您的意图，请重新描述您的需求。未调用模型。";
  }
  if (routeDecision === "model_not_selectable") {
    return "所选模型不可用，无法执行。";
  }
  if (verification?.verifiedCompleted) {
    return `任务完成：${taskId}。已验证 provider 调用成功且输出有效。${latencySummary ? ` ${latencySummary}` : ""}`;
  }
  if (verification?.completionStatus === "failed") {
    return `任务失败：${verification.verificationReason ?? "provider 调用失败或输出不满足要求。"}${latencySummary ? ` ${latencySummary}` : ""}`;
  }
  if (verification?.completionStatus === "dry_run") {
    return `Dry-run 模式：未真实调用模型。任务类型：${taskId}。`;
  }
  return `任务状态：${verification?.completionStatus ?? "unknown"}。${verification?.verificationReason ?? ""}`;
}

async function testPhase312AModel({ application, body }) {
  const env = application.runtimeEnv ?? process.env;
  const realSmokeEnabled = env.PHASE312A_NVIDIA_REAL_SMOKE === "1";
  const providerId = String(body?.providerId ?? "nvidia").trim().toLowerCase();
  const modelId = String(body?.modelId ?? body?.model ?? "").trim();
  const registry = application.modelLibraryStore.getRegistry();
  const model = findModel(registry, providerId, modelId);

  if (providerId !== "nvidia") {
    return {
      success: false,
      code: "provider_not_allowed_phase312a",
      message: "Phase312A model tests only allow NVIDIA.",
      status: "blocked",
      realExternalCall: false,
    };
  }

  if (!model) {
    return {
      success: false,
      code: "model_not_in_library",
      message: "Blocked before provider call: model is not present in the unified model library.",
      status: "blocked",
      realExternalCall: false,
      meta: { providerCalled: false, invalidProviderCalled: false },
    };
  }

  if (!realSmokeEnabled) {
    return {
      success: false,
      code: "real_smoke_not_enabled",
      message: "Model test route is wired, but real NVIDIA calls require PHASE312A_NVIDIA_REAL_SMOKE=1.",
      status: "blocked",
      providerId,
      modelId,
      endpointType: model.endpointType,
      realExternalCall: false,
      meta: { providerCalled: false, invalidProviderCalled: false },
    };
  }

  const nvidiaClient = createNvidiaUnifiedClient({
    env,
    runtimeCredentialStore: application.runtimeCredentialStore,
    modelLibraryStore: application.modelLibraryStore,
  });
  const result = await callModelSmoke({ client: nvidiaClient, model });
  application.modelLibraryStore.recordSmokeResult({
    providerId,
    modelId,
    result,
  });
  return {
    ...result,
    status: classifySmokeStatus(result),
    model: {
      providerId,
      modelId,
      endpointType: model.endpointType,
      primaryCapability: model.primaryCapability,
    },
  };
}

async function callModelSmoke({ client, model }) {
  if (model.endpointType === ENDPOINT_TYPES.chat) {
    return client.chatCompletion({
      modelId: model.modelId,
      messages: [{ role: "user", content: "Reply with exactly: phase312a-model-smoke-ok" }],
      maxTokens: 24,
      capability: model.primaryCapability,
    });
  }
  if (model.endpointType === ENDPOINT_TYPES.embeddings) {
    return client.embeddings({ modelId: model.modelId, input: "phase312a embedding smoke" });
  }
  if (model.endpointType === ENDPOINT_TYPES.rerank) {
    return client.rerank({
      modelId: model.modelId,
      query: "Phase312A smoke",
      passages: ["Phase312A smoke validates rerank.", "Unrelated text."],
    });
  }
  if (model.endpointType === ENDPOINT_TYPES.safety) {
    return client.safety({ modelId: model.modelId, text: "This is a harmless safety review smoke test." });
  }
  if (model.endpointType === ENDPOINT_TYPES.pii) {
    return client.piiDetection({ modelId: model.modelId, text: "Contact Jane Doe at jane@example.com for a harmless test." });
  }
  if (model.endpointType === ENDPOINT_TYPES.translation) {
    return client.translation({ modelId: model.modelId, text: "Hello world.", targetLanguage: "Chinese" });
  }

  return {
    success: false,
    code: "endpoint_not_smoke_enabled",
    message: `Endpoint ${model.endpointType} is catalog-known but not enabled for Phase312A real smoke.`,
    data: null,
    error: { code: "endpoint_not_smoke_enabled" },
    meta: {
      providerId: model.providerId,
      modelId: model.modelId,
      endpointType: model.endpointType,
      providerCalled: false,
      modelCalled: null,
      requestId: null,
      durationMs: 0,
      realExternalCall: false,
      fallbackUsed: false,
      invalidProviderCalled: false,
    },
  };
}

function classifySmokeStatus(result) {
  if (result?.success === true) return "usable";
  if (result?.code === "endpoint_type_mismatch" || result?.code === "endpoint_not_smoke_enabled") return "wrong_endpoint";
  if (result?.code === "nvidia_rate_limited") return "rate_limited";
  return "blocked";
}

function normalizeGatewayMode(mode) {
  const normalized = String(mode ?? "automatic_gateway").trim();
  if (normalized === "automatic" || normalized === "auto") return "automatic_gateway";
  if (normalized === "manual" || normalized === "manual-model") return "manual_model";
  if (["automatic_gateway", "manual_model", "knowledge", "programming", "safety_review", "translation"].includes(normalized)) {
    return normalized;
  }
  return "automatic_gateway";
}

function normalizeModelSelection(value) {
  if (!value) return {};
  if (typeof value === "string") {
    const [providerId, ...modelParts] = value.includes("::") ? value.split("::") : ["nvidia", value];
    return {
      providerId: String(providerId ?? "nvidia").trim(),
      modelId: modelParts.join("::").trim(),
    };
  }
  const raw = value.selectedModel ?? value.modelSelection ?? value.modelValue;
  if (typeof raw === "string") return normalizeModelSelection(raw);
  return {
    providerId: String(value.providerId ?? value.provider ?? "nvidia").trim(),
    modelId: String(value.modelId ?? value.model ?? "").trim(),
  };
}

function createProviders(application) {
  return application.gatewayService.getProviderDescriptors().map((provider) => {
    const credential = application.runtimeCredentialStore?.describe?.(provider.id);
    return {
      ...provider,
      metadata: {
        ...(provider.metadata ?? {}),
        runtimeCredentialPresent: Boolean(application.runtimeCredentialStore?.has(provider.id)),
        runtimeCredentialPersisted: credential?.persisted === true,
        runtimeCredentialStorage: credential?.secretStorage ?? "memory-only",
      },
    };
  });
}

function setRuntimeProviderCredential(application, body) {
  const providerId = String(body?.providerId ?? "").trim();
  if (!providerId) {
    const error = new Error("providerId is required.");
    error.code = "provider_runtime_credential_provider_required";
    error.category = "validation";
    error.details = { providerIdPresent: false };
    throw error;
  }

  try {
    application.providerRegistry.get(providerId);
  } catch {
    const error = new Error(`Provider is not available in the current runtime: ${providerId}`);
    error.code = "provider_runtime_credential_provider_unavailable";
    error.category = "validation";
    error.details = { providerId };
    throw error;
  }

  const runtimeModels = normalizeRuntimeCredentialModels(body, providerId);
  const result = application.runtimeCredentialStore.set({
    providerId,
    apiKey: extractRuntimeCredentialSecret(providerId, body?.apiKey),
    endpoint: body?.endpoint ?? body?.baseUrl ?? extractRuntimeCredentialEndpoint(providerId, body?.apiKey),
    source: body?.source ?? "web-chat-model-wizard",
    models: runtimeModels,
  });

  const registeredRuntimeModels = runtimeModels.length && typeof application.providerRegistry?.addRuntimeModels === "function"
    ? application.providerRegistry.addRuntimeModels(providerId, runtimeModels)
    : [];

  if (typeof application.providerRegistry?.enableProvider === "function") {
    application.providerRegistry.enableProvider(providerId);
  }

  return {
    ...result,
    runtimeModelCount: registeredRuntimeModels.length,
    runtimeProviderEnabled: true,
  };
}

function normalizeRuntimeCredentialModels(body, providerId) {
  const selectedModelId = String(body?.modelId ?? body?.model ?? "").trim();
  const models = Array.isArray(body?.models) ? body.models : [];
  const normalized = models
    .filter((model) => String(model?.providerId ?? providerId).trim() === providerId)
    .map((model) => ({
      id: model?.id ?? model?.modelId,
      displayName: model?.displayName ?? model?.modelDisplayName,
      capabilities: model?.capabilities,
      source: model?.source ?? "runtime-credential",
      metadata: model?.metadata,
    }))
    .filter((model) => String(model.id ?? "").trim());

  if (selectedModelId && !normalized.some((model) => model.id === selectedModelId)) {
    normalized.push({
      id: selectedModelId,
      displayName: selectedModelId,
      capabilities: ["chat", "summary"],
      source: "runtime-credential-selected",
    });
  }

  return normalized;
}

function sanitizeCredentialErrorDetails(details) {
  if (!details || typeof details !== "object") {
    return {};
  }

  const sanitized = { ...details };
  delete sanitized.apiKey;
  delete sanitized.authorization;
  delete sanitized.headers;
  return sanitized;
}

function createRouteModes() {
  return {
    modes: ["fake", "real", "auto"],
    routeModes: ["fixed", "registry-default"],
  };
}

function readAuditFilters(url) {
  return {
    outcome: url.searchParams.get("outcome"),
    code: url.searchParams.get("code"),
    path: url.searchParams.get("path"),
    userId: url.searchParams.get("userId"),
    tenantId: url.searchParams.get("tenantId"),
    since: url.searchParams.get("since"),
    until: url.searchParams.get("until"),
  };
}

async function readEnterpriseAcceptanceReport() {
  const [reportMarkdown, evidenceText] = await Promise.all([
    readFile(enterpriseAcceptanceReportPath, "utf8"),
    readFile(enterpriseAcceptanceEvidencePath, "utf8"),
  ]);
  const evidence = JSON.parse(evidenceText);

  return {
    phase: "phase-44a-enterprise-acceptance-ui",
    mode: "read-only-existing-artifacts",
    reportPath: "docs/ENTERPRISE_ACCEPTANCE_REPORT.md",
    evidencePath: "apps/ai-gateway-service/evidence/phase-43a-enterprise-acceptance-report.json",
    reportMarkdown,
    evidence: {
      phase: evidence.phase,
      status: evidence.status,
      generatedAt: evidence.generatedAt,
      conclusion: evidence.conclusion,
      requiredCount: evidence.evidence?.requiredCount ?? 0,
      passedCount: evidence.evidence?.passedCount ?? 0,
      missingCount: evidence.evidence?.missingCount ?? 0,
      failedCount: evidence.evidence?.failedCount ?? 0,
      commandStatus: evidence.commands?.status ?? "unknown",
      boundaryStatus: evidence.boundaries?.status ?? "unknown",
      docsPresent: evidence.docs?.present ?? [],
      safety: {
        readOnlySummary: Boolean(evidence.safety?.readOnlySummary),
        providerCalls: Boolean(evidence.safety?.providerCalls),
        releaseAutomation: Boolean(evidence.safety?.releaseAutomation),
        infrastructureProvisioning: Boolean(evidence.safety?.infrastructureProvisioning),
        secretValuesRecorded: Boolean(evidence.safety?.secretValuesRecorded),
      },
    },
  };
}

async function readEnterpriseReleaseCandidateDryRun() {
  const evidence = JSON.parse(await readFile(enterpriseReleaseCandidateEvidencePath, "utf8"));
  return {
    phase: "phase-46a-enterprise-release-candidate-ui",
    mode: "read-only-existing-artifacts",
    evidencePath: "apps/ai-gateway-service/evidence/phase-45a-enterprise-release-candidate-dry-run.json",
    releaseCandidate: {
      sourcePhase: evidence.phase,
      status: evidence.status,
      generatedAt: evidence.generatedAt,
      conclusion: evidence.conclusion,
      mode: evidence.releaseCandidate?.mode ?? null,
      packageCreated: Boolean(evidence.releaseCandidate?.packageCreated),
      releaseCreated: Boolean(evidence.releaseCandidate?.releaseCreated),
      artifactPublished: Boolean(evidence.releaseCandidate?.artifactPublished),
    },
    checks: {
      docsStatus: evidence.result?.docs?.status ?? "unknown",
      docsPresent: evidence.result?.docs?.present ?? [],
      scriptsStatus: evidence.result?.scripts?.status ?? "unknown",
      evidenceStatus: evidence.result?.evidence?.status ?? "unknown",
      evidenceRequiredCount: evidence.result?.evidence?.requiredCount ?? 0,
      evidencePassedCount: evidence.result?.evidence?.passedCount ?? 0,
      evidenceMissingCount: evidence.result?.evidence?.missing?.length ?? 0,
      evidenceFailedCount: evidence.result?.evidence?.failed?.length ?? 0,
      uiStatus: evidence.result?.ui?.status ?? "unknown",
      boundaryStatus: evidence.result?.boundaries?.status ?? "unknown",
      envTemplateStatus: evidence.result?.envTemplate?.status ?? "unknown",
      secretScanStatus: evidence.result?.secretScan?.status ?? "unknown",
    },
    safety: {
      readOnlyDryRun: Boolean(evidence.safety?.readOnlyDryRun),
      providerCalls: Boolean(evidence.safety?.providerCalls),
      runtimeMutation: Boolean(evidence.safety?.runtimeMutation),
      releaseAutomation: Boolean(evidence.safety?.releaseAutomation),
      infrastructureProvisioning: Boolean(evidence.safety?.infrastructureProvisioning),
      secretValuesRecorded: Boolean(evidence.safety?.secretValuesRecorded),
    },
  };
}

async function readEnterpriseOverview(application) {
  const [acceptanceReport, releaseCandidate] = await Promise.all([
    readEnterpriseAcceptanceReport(),
    readEnterpriseReleaseCandidateDryRun(),
  ]);
  const deploymentReadiness = application.enterpriseOpsService.getReadiness();
  const startupReadiness = application.enterpriseOpsService.getStartupReadiness();
  const securityReadiness = application.enterpriseGovernanceService.getSecurityReadiness();
  const vectorReadiness = application.knowledgeInfra.getReadiness();
  const governanceHealth = application.enterpriseGovernanceService.getHealth();

  const checks = [
    {
      id: "deployment_readiness",
      status: deploymentReadiness.status ?? "unknown",
      blockers: deploymentReadiness.blockers ?? [],
      warnings: deploymentReadiness.warnings ?? [],
    },
    {
      id: "startup_readiness",
      status: startupReadiness.status ?? "unknown",
      blockers: startupReadiness.blockers ?? [],
      warnings: startupReadiness.warnings ?? [],
    },
    {
      id: "security_readiness",
      status: securityReadiness.status ?? "unknown",
      blockers: securityReadiness.blockers ?? [],
      warnings: securityReadiness.warnings ?? [],
    },
    {
      id: "vector_readiness",
      status: vectorReadiness.status ?? "unknown",
      blockers: vectorReadiness.blockers ?? [],
      warnings: vectorReadiness.warnings ?? [],
      mode: vectorReadiness.mode ?? "unknown",
    },
    {
      id: "acceptance_report",
      status: acceptanceReport.evidence?.status ?? "unknown",
      blockers: acceptanceReport.evidence?.failedCount ? ["acceptance evidence failed"] : [],
      warnings: [],
      requiredCount: acceptanceReport.evidence?.requiredCount ?? 0,
      passedCount: acceptanceReport.evidence?.passedCount ?? 0,
    },
    {
      id: "release_candidate_dry_run",
      status: releaseCandidate.releaseCandidate?.status ?? "unknown",
      blockers: releaseCandidate.checks?.evidenceFailedCount ? ["release-candidate evidence failed"] : [],
      warnings: [],
      evidenceRequiredCount: releaseCandidate.checks?.evidenceRequiredCount ?? 0,
      evidencePassedCount: releaseCandidate.checks?.evidencePassedCount ?? 0,
    },
  ];

  const blockers = checks
    .filter((check) => check.status === "blocked")
    .flatMap((check) => (check.blockers ?? []).map((blocker) => `${check.id}: ${blocker}`));
  const warnings = checks
    .filter((check) => check.status === "warning" || check.status === "not-ready")
    .flatMap((check) => (check.warnings ?? []).map((warning) => `${check.id}: ${warning}`));

  return {
    phase: "phase-47a-enterprise-overview-ui",
    mode: "read-only-enterprise-overview",
    status: blockers.length ? "blocked" : "ready",
    blockers,
    warnings,
    governance: {
      authEnabled: Boolean(governanceHealth.authEnabled),
      roleCount: governanceHealth.roles?.length ?? 0,
      auditEnabled: Boolean(governanceHealth.audit),
    },
    readiness: {
      deployment: deploymentReadiness,
      startup: startupReadiness,
      security: securityReadiness,
      vector: vectorReadiness,
    },
    acceptance: {
      phase: acceptanceReport.evidence?.phase ?? null,
      status: acceptanceReport.evidence?.status ?? null,
      conclusion: acceptanceReport.evidence?.conclusion ?? null,
      requiredCount: acceptanceReport.evidence?.requiredCount ?? 0,
      passedCount: acceptanceReport.evidence?.passedCount ?? 0,
      missingCount: acceptanceReport.evidence?.missingCount ?? 0,
      failedCount: acceptanceReport.evidence?.failedCount ?? 0,
      reportPath: acceptanceReport.reportPath,
      evidencePath: acceptanceReport.evidencePath,
    },
    releaseCandidate: {
      phase: releaseCandidate.releaseCandidate?.sourcePhase ?? null,
      status: releaseCandidate.releaseCandidate?.status ?? null,
      conclusion: releaseCandidate.releaseCandidate?.conclusion ?? null,
      mode: releaseCandidate.releaseCandidate?.mode ?? null,
      evidencePath: releaseCandidate.evidencePath,
      packageCreated: Boolean(releaseCandidate.releaseCandidate?.packageCreated),
      releaseCreated: Boolean(releaseCandidate.releaseCandidate?.releaseCreated),
      artifactPublished: Boolean(releaseCandidate.releaseCandidate?.artifactPublished),
      evidenceRequiredCount: releaseCandidate.checks?.evidenceRequiredCount ?? 0,
      evidencePassedCount: releaseCandidate.checks?.evidencePassedCount ?? 0,
      evidenceMissingCount: releaseCandidate.checks?.evidenceMissingCount ?? 0,
      evidenceFailedCount: releaseCandidate.checks?.evidenceFailedCount ?? 0,
    },
    safety: {
      readOnlyRoute: true,
      providerCalls: false,
      runtimeMutation: false,
      releaseAutomation: false,
      infrastructureProvisioning: false,
      secretValuesRecorded: false,
    },
    checks,
  };
}

function isPublicRoute(pathname) {
  return (
    pathname === "/ui" ||
    pathname === "/console" ||
    pathname === "/workbench/feature-status" ||
    pathname === "/local-agent/intent-preview" ||
    pathname === "/local-agent/operation-plan" ||
    pathname === "/local-agent/patch-proposal" ||
    pathname === "/approvals" ||
    pathname === "/approvals/create" ||
    /^\/approvals\/[^/]+\/(approve|reject)$/.test(pathname) ||
    pathname === "/local-operation/apply-approved" ||
    pathname === "/file-context/select" ||
    pathname === "/plugin-registry" ||
    pathname === "/agent-runner/intent-approval-preview" ||
    pathname === "/agent-runner/local-operation" ||
    pathname === "/provider-config/status" ||
    pathname === "/provider-config/save" ||
    pathname === "/provider-config/test" ||
    pathname === "/model-library" ||
    pathname === "/model-library/usability-matrix" ||
    pathname === "/model-library/verification-plan" ||
    pathname === "/model-library/verify-dry-run" ||
    pathname === "/model-library/refresh" ||
    pathname === "/model-library/test-model" ||
    pathname === "/model-library/task-default" ||
    pathname === "/real-capabilities/status" ||
    pathname === "/real-capabilities/activate-five" ||
    pathname === "/chat-gateway/execute" ||
    pathname === "/chat/gateway" ||
    pathname === "/three-mode/execute" ||
    pathname === "/chat-gateway/task-matrix" ||
    pathname.startsWith("/chat-gateway/evidence/") ||
    pathname === "/chat-gateway/dry-run-task" ||
    pathname === "/chat-gateway/latency-policy" ||
    pathname === "/chat-gateway/latency-dry-run" ||
    pathname === "/runtime-candidate/codex-exec-crs/status" ||
    pathname === "/runtime-candidate/codex-exec-crs/dry-run-smoke" ||
    pathname === "/runtime-candidate/codex-exec-crs/guarded-one-shot" ||
    pathname === "/runtime-candidate/codex-exec-crs/reliability" ||
    pathname === "/workbench/diagnostics/status" ||
    pathname === "/health" ||
    pathname === "/health/check" ||
    pathname === "/setup/readiness" ||
    pathname === "/auth/status" ||
    pathname === "/enterprise/health"
  );
}

function buildPhase319FeatureStatus() {
  const features = [
    { id: "new-chat", status: "real_enabled", reason: "清空当前消息、任务和 evidence 状态，不清空模型配置。" },
    { id: "model-config", status: "real_enabled", reason: "读取 Provider 状态和模型库，页面模型选择保存到 localStorage。" },
    { id: "chat-send", status: "real_enabled", reason: "调用 Chat Gateway dry-run/execute 既有链路并显示 evidenceId。" },
    { id: "quick-search", status: "real_enabled", reason: "本地搜索 Workbench 页面、功能入口和帮助文本。" },
    { id: "help", status: "real_enabled", reason: "展示真实使用说明和功能状态边界。" },
    { id: "diagnostics", status: "real_enabled", reason: "只读读取 health、doctor、模型库、Provider、Chat Gateway 状态。" },
    { id: "settings", status: "real_enabled", reason: "语言、主题、安全边界等本地 UI 状态保存到 localStorage。" },
    { id: "provider-config", status: "real_enabled", reason: "保存/测试接真实 route，不显示 API Key 明文。" },
    { id: "local-agent", status: "approval_required", reason: "生成 intent preview、operation plan、approval record 后才允许 approved apply。" },
    { id: "safe-repair", status: "approval_required", reason: "生成 dry-run patch proposal，审批后只允许 allowedFiles 内 apply。" },
    { id: "approvals", status: "approval_required", reason: "审批队列支持 create、approve、reject，rejected 不可执行。" },
    { id: "add-file", status: "approval_required", reason: "只记录用户明确选择的文件名和大小，不存敏感内容。" },
    { id: "plugins", status: "approval_required", reason: "插件注册表真实显示，默认 disabled，执行必须审批。" },
    { id: "full-open", status: "blocked_by_policy", reason: "当前阶段禁止 full-open 和无审批本地命令。" },
    { id: "read-env-secret", status: "blocked_by_policy", reason: "禁止读取 .env 明文、打印 API Key 或泄露 secret/token。" },
    { id: "commit-push-deploy-release", status: "blocked_by_policy", reason: "当前阶段禁止 commit、push、deploy、release。" },
    { id: "git-reset-clean", status: "blocked_by_policy", reason: "禁止破坏性 git reset / git clean。" },
    { id: "paid-api", status: "blocked_by_policy", reason: "禁止自动调用 paid API、MiMo、OpenAI、Claude、OpenRouter。" },
    { id: "embedding-batch-training", status: "blocked_by_policy", reason: "禁止 embedding batch training。" },
  ];
  const counts = features.reduce((acc, item) => {
    acc[item.status] = (acc[item.status] || 0) + 1;
    return acc;
  }, {});
  return {
    phase: "Phase319A",
    status: "functional_landing",
    totalFeaturesScanned: features.length,
    realEnabledFeatures: counts.real_enabled || 0,
    approvalRequiredFeatures: counts.approval_required || 0,
    blockedByPolicyFeatures: counts.blocked_by_policy || 0,
    previewOnlyRemaining: 0,
    notImplementedRemaining: 0,
    features,
    providerCalledForBlockedAction: false,
    localExecutionTriggeredWithoutApproval: false,
    unauthorizedFileWriteAttempted: false,
    secretExposed: false,
    defaultChatChanged: false,
    paidApiCalled: false,
    embeddingBatchTrainingCalled: false,
  };
}

function resolvePermission(method, pathname) {
  if (isPublicRoute(pathname)) {
    return "public:read";
  }

  if (pathname === "/enterprise/session") {
    return "session:read";
  }

  if (pathname === "/enterprise/roles") {
    return "audit:read";
  }

  if (pathname === "/enterprise/users" || pathname === "/enterprise/users/revoke") {
    return "user:admin";
  }

  if (pathname === "/enterprise/security/readiness") {
    return "audit:read";
  }

  if (pathname === "/enterprise/audit" || pathname === "/enterprise/audit/export") {
    return "audit:read";
  }

  if (pathname === "/enterprise/acceptance/report" || pathname === "/enterprise/release-candidate/dry-run" || pathname === "/enterprise/overview") {
    return "audit:read";
  }

  if (pathname === "/enterprise/deployment/readiness" || pathname === "/enterprise/startup/readiness") {
    return "audit:read";
  }

  if (pathname === "/enterprise/backup" || pathname === "/enterprise/restore/validate") {
    return "user:admin";
  }

  if (
    pathname === "/dashboard/status" ||
    pathname === "/workflow/health" ||
    pathname === "/workflow/actions" ||
    pathname === "/workforce/health" ||
    pathname === "/workforce/agents" ||
    (method === "GET" && (pathname === "/workforce/plans" || /^\/workforce\/plans\/[^/]+(\/export|\/review-package)?$/.test(pathname)))
  ) {
    return "dashboard:read";
  }

  if (
    pathname === "/providers" ||
    pathname === "/providers/runtime-credential/detect" ||
    pathname === "/config/runtime" ||
    pathname === "/route/modes" ||
    pathname === "/models/import/providers" ||
    pathname === "/models/capability-router/status" ||
    pathname === "/models/capability-router/preview" ||
    pathname === "/cost/health" ||
    pathname === "/cost/estimate" ||
    pathname === "/cost/guard/check" ||
    pathname === "/cost/summary" ||
    pathname === "/cache/health" ||
    pathname === "/cache/lookup" ||
    pathname === "/cache/write" ||
    pathname === "/cache/invalidate" ||
    pathname === "/cache/summary" ||
    pathname === "/cache/audit" ||
    pathname === "/routing/answer-path/preview" ||
    pathname === "/routing/quality-cost/preview" ||
    (method === "GET" && (pathname === "/codex-handoff/next-task" || pathname === "/codex-loop/status"))
  ) {
    return "provider:read";
  }

  if (pathname === "/providers/runtime-credential" || pathname === "/models/import/preview" || pathname === "/models/import/confirm") {
    return "provider:write";
  }

  if (pathname.startsWith("/knowledge/") && method === "GET") {
    return "knowledge:read";
  }

  if (pathname === "/knowledge/load" || pathname === "/knowledge/load/file") {
    return "knowledge:write";
  }

  if (pathname === "/knowledge/retrieve" || pathname === "/knowledge/graph/retrieve") {
    return "knowledge:read";
  }

  if (pathname === "/memory/save") {
    return "memory:write";
  }

  if (pathname === "/memory/list" || pathname === "/memory/retrieve") {
    return "knowledge:read";
  }

  if (pathname === "/connectors" || pathname === "/connectors/import/text") {
    return pathname === "/connectors" ? "provider:read" : "connector:write";
  }

  if (pathname === "/evaluation/score") {
    return "evaluation:run";
  }

  if (pathname === "/workflow/plan" || pathname === "/workflow/run") {
    return "workflow:run";
  }

  if (method === "POST" && pathname === "/codex-handoff/next-task") {
    return "workflow:run";
  }

  if (
    pathname === "/workforce/plan" ||
    pathname === "/workforce/run-local" ||
    pathname === "/real-capabilities/activate-five" ||
    pathname === "/workforce/plans/save" ||
    (method === "POST" && /^\/workforce\/plans\/[^/]+\/(clarifications|lifecycle|approval-gate)$/.test(pathname)) ||
    (method === "DELETE" && /^\/workforce\/plans\/[^/]+$/.test(pathname))
  ) {
    return "workflow:run";
  }

  if (pathname === "/chat" || pathname === "/chat/stream" || pathname === "/chat/rag" || pathname === "/chat/rag/stream" || pathname === "/route" || pathname === "/gateway/route" || pathname === "/gateway/mock") {
    return "chat:use";
  }

  return "route:unknown";
}

async function readCapabilityJson({ request, response, startedAt, code }) {
  try {
    return await readJson(request);
  } catch {
    writeJson(
      response,
      400,
      createErrorEnvelope(code, "Request body must be valid JSON.", {
        startedAt,
        category: "validation",
      }),
    );
    return null;
  }
}

async function readEnterpriseJson({ request, response, startedAt, code }) {
  try {
    return await readJson(request);
  } catch {
    writeJson(
      response,
      400,
      createErrorEnvelope(code, "Enterprise request body must be valid JSON.", {
        startedAt,
        category: "validation",
      }),
    );
    return null;
  }
}

function writeEnterpriseError({ response, error, startedAt, fallbackCode }) {
  writeJson(
    response,
    error?.category === "validation" ? 400 : 422,
    createErrorEnvelope(error?.code ?? fallbackCode, error instanceof Error ? error.message : "Enterprise request failed.", {
      startedAt,
      category: error?.category ?? "enterprise",
      retryable: false,
      details: error?.details,
    }),
  );
}

function writeCapabilityError({ response, error, startedAt, fallbackCode }) {
  writeJson(
    response,
    error?.category === "validation" ? 400 : 422,
    createErrorEnvelope(error?.code ?? fallbackCode, error instanceof Error ? error.message : "Capability request failed.", {
      startedAt,
      category: error?.category ?? "capability",
      retryable: false,
      details: error?.details,
    }),
  );
}

async function readJson(request) {
  const chunks = [];

  for await (const chunk of request) {
    chunks.push(chunk);
  }

  const text = Buffer.concat(chunks).toString("utf8");
  return text ? JSON.parse(text) : {};
}

function normalizeChatBody(body, config) {
  const defaultTarget = resolveDefaultChatTarget(config);
  const currentPageSelection = normalizeCurrentPageModelSelection(body?.currentPageModelSelection);
  const fallbackTarget = defaultTarget.providerId
    ? defaultTarget
    : {
        providerId: "nvidia",
        modelId: resolveNvidiaModel(config),
      };
  const providerId = currentPageSelection?.warning
    ? fallbackTarget.providerId
    : currentPageSelection?.providerId ?? body?.providerId ?? defaultTarget.providerId;
  const modelId = currentPageSelection?.warning
    ? fallbackTarget.modelId
    : currentPageSelection?.modelId ?? body?.model ?? defaultTarget.modelId;
  const metadata = {
    ...(body?.metadata ?? {}),
  };

  if (currentPageSelection?.warning) {
    metadata.currentPageModelSelectionWarning = currentPageSelection.warning;
  }

  if (currentPageSelection?.providerId && currentPageSelection?.modelId) {
    metadata.currentPageModelSelectionApplied = {
      providerId: currentPageSelection.providerId,
      modelId: currentPageSelection.modelId,
      baseUrl: currentPageSelection.baseUrl ?? "",
      scope: "per-request",
    };
  }

  if (Array.isArray(body?.messages)) {
    return {
      ...body,
      taskType: "chat",
      providerId,
      model: modelId,
      metadata,
    };
  }

  const prompt = body?.prompt ?? body?.query;

  if (typeof prompt !== "string" || prompt.length === 0) {
    return body;
  }

  return {
    context: body.context,
    taskType: "chat",
    providerId,
    model: modelId,
    messages: [
      {
        role: "user",
        content: prompt,
      },
    ],
    options: body.options,
    metadata,
  };
}

function normalizeCurrentPageModelSelection(selection) {
  if (!selection || typeof selection !== "object") {
    return null;
  }

  const providerId = typeof selection.providerId === "string" ? selection.providerId.trim() : "";
  const modelId = typeof selection.modelId === "string" ? selection.modelId.trim() : "";
  const baseUrl = typeof selection.baseUrl === "string" ? selection.baseUrl.trim() : "";

  if (!providerId || !modelId) {
    return {
      warning: {
        code: "current_page_model_selection_ignored",
        message: "Ignored invalid currentPageModelSelection and used the default /chat route.",
      },
    };
  }

  return {
    providerId,
    modelId,
    baseUrl,
  };
}

function normalizeRagChatBody(body, config) {
  const prompt = body?.prompt ?? body?.query;

  if (typeof prompt !== "string" || prompt.length === 0) {
    return normalizeChatBody(body, config);
  }

  if (body?.providerId || body?.model) {
    return {
      context: body.context,
      taskType: "chat",
      providerId: body.providerId,
      model: body.model,
      messages: [
        {
          role: "user",
          content: prompt,
        },
      ],
      options: body.options,
      metadata: body.metadata,
    };
  }

  return normalizeChatBody(body, config);
}

function extractChatPrompt(body) {
  const direct = body?.prompt ?? body?.query;
  if (typeof direct === "string" && direct.trim().length > 0) {
    return direct.trim();
  }

  if (!Array.isArray(body?.messages)) {
    return "";
  }

  const message = [...body.messages].reverse().find((item) => item?.role !== "assistant" && typeof item?.content === "string");
  return message?.content?.trim() ?? "";
}

function createRagRetrieveRequest(body, prompt) {
  const knowledge = body?.knowledge ?? {};
  return {
    context: body?.context,
    query: knowledge.query ?? prompt,
    mode: "keyword",
    sourceIds: Array.isArray(knowledge.sourceIds) ? knowledge.sourceIds : body?.sourceIds,
    topK: readBoundedInteger(knowledge.topK ?? body?.topK, 3, 1, 5),
    minScore: knowledge.minScore ?? body?.minScore,
    filters: knowledge.filters ?? body?.filters,
    metadata: {
      ...(knowledge.metadata ?? {}),
      phase: "phase-29a-service-rag-chat",
      caller: "chat-rag",
    },
  };
}

function createRagCitations(chunks = []) {
  return chunks.slice(0, 5).map((chunk, index) => {
    const document = chunk.document ?? {};
    return {
      index: index + 1,
      label: `[${index + 1}]`,
      sourceId: document.sourceId ?? null,
      documentId: document.documentId ?? null,
      title: document.title ?? document.documentId ?? "Untitled",
      uri: document.uri,
      snippet: chunk.snippet ?? chunk.text ?? "",
      matchedTerms: Array.isArray(chunk.matchedTerms) ? chunk.matchedTerms : [],
      highlights: Array.isArray(chunk.highlights) ? chunk.highlights : [],
      score: chunk.score ?? null,
      scoreBreakdown: chunk.scoreBreakdown ?? null,
      metadata: document.metadata ?? {},
    };
  });
}

function createRagPrompt(prompt, citations) {
  if (!citations.length) {
    return [
      "你是 PME 移动地球的服务端 RAG 聊天入口。",
      "本次没有检索到本地知识库片段。请直接回答用户问题；如果资料不足，请明确说明不足，不要编造。",
      "",
      "用户问题：",
      prompt,
    ].join("\n");
  }

  const context = citations
    .map((citation) =>
      [
        `${citation.label} ${citation.title}`,
        `sourceId: ${citation.sourceId ?? "unknown-source"}`,
        `documentId: ${citation.documentId ?? "unknown-document"}`,
        `matchedTerms: ${citation.matchedTerms.join(", ") || "n/a"}`,
        `snippet: ${citation.snippet}`,
      ].join("\n"),
    )
    .join("\n\n");

  return [
    "你是 PME 移动地球的服务端 RAG 聊天入口。",
    "请优先依据下面的本地知识库检索结果回答用户问题，并在答案中自然引用资料编号，例如 [1]。",
    "如果资料不足，请明确说明不足，不要编造。",
    "",
    "本地知识库检索结果：",
    context,
    "",
    "用户问题：",
    prompt,
  ].join("\n");
}

function createRagChatData({ prompt, retrieveRequest, retrieveResult, citations, chatResult }) {
  const chatData = chatResult.data ?? {};
  return {
    answer: chatData.outputText ?? chatData.text ?? "",
    text: chatData.text ?? chatData.outputText ?? "",
    outputText: chatData.outputText ?? chatData.text ?? "",
    chat: chatData,
    rag: {
      enabled: true,
      mode: "service-side",
      phase: "phase-29a-service-rag-chat",
      prompt,
      knowledgeInjected: citations.length > 0,
      citationCount: citations.length,
    },
    knowledge: {
      query: retrieveRequest.query,
      mode: retrieveResult.mode,
      retrieved: citations.length > 0,
      chunkCount: retrieveResult.chunks?.length ?? 0,
      topHit: retrieveResult.topHit ?? null,
      topChunk: retrieveResult.topChunk ?? null,
      topDocument: retrieveResult.topDocument ?? null,
      citations,
      metadata: retrieveResult.metadata ?? {},
    },
    metadata: {
      selectedProvider: chatData.selectedProvider ?? null,
      selectedModel: chatData.selectedModel ?? null,
      executionMode: chatData.executionMode ?? null,
      executionStatus: chatData.executionStatus ?? null,
    },
  };
}

function readBoundedInteger(value, fallback, min, max) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed)) {
    return fallback;
  }

  return Math.min(max, Math.max(min, parsed));
}

function resolveDefaultChatTarget(config) {
  const providerSelection = config.aiGatewayService.providerSelection;

  if (providerSelection.mode !== "fixed") {
    return {};
  }

  const configuredProviderId = providerSelection.defaultProviderId;
  const configuredModelId = providerSelection.defaultModelId;
  const nvidiaModel = resolveNvidiaModel(config);

  return {
    providerId: configuredProviderId ?? "nvidia",
    modelId: configuredModelId ?? nvidiaModel,
  };
}

function resolveNvidiaModel(config) {
  return (
    config.aiGatewayService.providerModels.find((provider) => provider.providerId === "nvidia")?.modelId ??
    config.aiGatewayService.providerSelection.defaultModelId
  );
}

function writeJson(response, statusCode, body) {
  response.writeHead(statusCode, {
    "content-type": "application/json; charset=utf-8",
  });
  response.end(JSON.stringify(body, null, 2));
}

function writeHtml(response, statusCode, body) {
  response.writeHead(statusCode, {
    "content-type": "text/html; charset=utf-8",
  });
  response.end(body);
}

function writeSseHeaders(response) {
  response.writeHead(200, {
    "cache-control": "no-cache",
    connection: "keep-alive",
    "content-type": "text/event-stream; charset=utf-8",
  });

  if (typeof response.flushHeaders === "function") {
    response.flushHeaders();
  }
}

function writeSseEvent(response, event, data) {
  response.write(`event: ${event}\n`);
  response.write(`data: ${JSON.stringify(data)}\n\n`);
}
