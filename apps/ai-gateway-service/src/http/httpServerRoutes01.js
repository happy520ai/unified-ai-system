import { ROUTE_NOT_HANDLED } from "./httpRouteDispatch.js";

export async function dispatchHttpRoutes01(context) {
  const {
    createErrorEnvelope, createOkEnvelope, getSafeRuntimeConfig, createRouteFailureEnvelope,
    createLocalAgentIntentExplainer, runLocalOperationLoop, getSupportedKnowledgeFileTypes, parseKnowledgeFile,
    listModelImportProviders, detectRuntimeCredentialProviders, createConsolePage, getRequestContext,
    createNextCodexTask, writeNextCodexTaskOutbox, readCodexLoopStatus, checkTokenCostGuard,
    appendEstimateRecord, readTokenCostSummary, readLatestMimoTokenCalibrationProfile, createResponseCacheKey,
    createResponseCachePolicy, invalidateCache, lookupCache, readResponseCacheSummary,
    writeCacheRecord, listResponseCacheAuditTrail, routeAnswerPath, routeQualityCostAnswer,
    getEvidenceById, TASK_MATRIX, LATENCY_DRY_RUN_CASES, PHASE315A_TIMEOUT_TYPES,
    PHASE315A_LATENCY_RISK_LEVELS, PHASE315A_COMPLETION_CONFIDENCE, executeThreeModeRequest, evaluateTaijiBeidouChatGatewayExecutePreviewHook,
    evaluateTaijiBeidouChatPreviewHook, handleChatLocalActionRoute, routeChatActionProposal, buildModelUsabilityMatrix,
    createModelVerificationPlan, getPluginRegistry, readJson, writeHtml,
    writeJson, writeSseEvent, writeSseHeaders, writeServiceLog,
    createHealth, createSetupReadiness, runPhase312AChatGateway, runPhase314ADryRunTask,
    runPhase315ALatencyDryRun, testPhase312AModel, createProviders, setRuntimeProviderCredential,
    sanitizeCredentialErrorDetails, createRouteModes, readAuditFilters, readEnterpriseAcceptanceReport,
    readEnterpriseReleaseCandidateDryRun, readEnterpriseOverview, buildPhase319FeatureStatus, readCapabilityJson,
    readEnterpriseJson, writeEnterpriseError, writeCapabilityError, normalizeChatBody,
    normalizeRagChatBody, extractChatPrompt, createRagRetrieveRequest, createRagCitations,
    createRagPrompt, createRagChatData, OWNER_AUTOMATION_CHAT_PROPOSAL_FLAG, application,
    request, response, url, startedAt,
    approvalStore, fileContextStore, phase319LocalOperation, connectorFeishuDryRun,
    connectorWeComDryRun, capabilityRouterService, codexExecCrsRuntimeCandidate, enterpriseGovernanceService,
    enterpriseOpsService, fiveCapabilityActivationService, gatewayService, knowledgeService,
    modelImportService, modelLibraryStore, providerConfigRoutes, userExperienceService,
    workforceService, workflowService, wsServer,
  } = context;

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


  return ROUTE_NOT_HANDLED;
}
