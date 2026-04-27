import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createErrorEnvelope, createOkEnvelope } from "../../../../packages/shared-utils/src/index.js";
import { getSafeRuntimeConfig } from "../../../../packages/shared-config/src/index.js";
import { createRouteFailureEnvelope } from "../core/gatewayService.js";
import { getSupportedKnowledgeFileTypes, parseKnowledgeFile } from "../knowledge/documentParsers.js";
import { listModelImportProviders } from "../model-import/providerProbeRegistry.js";
import { detectRuntimeCredentialProviders, extractRuntimeCredentialEndpoint, extractRuntimeCredentialSecret } from "../providers/providerCredentialDetector.js";
import { createConsolePage } from "../ui/consolePage.js";
import { getRequestContext } from "../capabilities/userExperienceService.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, "../../../..");
const enterpriseAcceptanceReportPath = resolve(repoRoot, "docs/ENTERPRISE_ACCEPTANCE_REPORT.md");
const enterpriseAcceptanceEvidencePath = resolve(repoRoot, "apps/ai-gateway-service/evidence/phase-43a-enterprise-acceptance-report.json");
const enterpriseReleaseCandidateEvidencePath = resolve(
  repoRoot,
  "apps/ai-gateway-service/evidence/phase-45a-enterprise-release-candidate-dry-run.json",
);

export function createGatewayHttpServer(application) {
  const { enterpriseGovernanceService, enterpriseOpsService, gatewayService, knowledgeService, modelImportService, userExperienceService, workforceService, workflowService } = application;

  return createServer(async (request, response) => {
    const startedAt = Date.now();
    const url = new URL(request.url ?? "/", `http://${request.headers.host ?? "127.0.0.1"}`);

    try {
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
              ],
            },
            { startedAt },
          ),
        );
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
          writeServiceLog("workforce_plan_completed", {
            method: request.method,
            path: url.pathname,
            workforceId: result.workforceId,
            roleCount: result.selectedRoles?.length ?? 0,
            durationMs: Date.now() - startedAt,
          });
          writeJson(response, 200, createOkEnvelope(result, { startedAt, traceId: body?.context?.traceId }));
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
  console.error(
    JSON.stringify({
      app: "ai-gateway-service",
      event,
      ...details,
    }),
  );
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
      "GET /connectors",
      "GET /config/runtime",
      "POST /providers/runtime-credential/detect",
      "POST /providers/runtime-credential",
      "GET /models/import/providers",
      "POST /models/import/preview",
      "POST /models/import/confirm",
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
    pathname === "/health" ||
    pathname === "/health/check" ||
    pathname === "/setup/readiness" ||
    pathname === "/auth/status" ||
    pathname === "/enterprise/health"
  );
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
    (method === "GET" && (pathname === "/workforce/plans" || /^\/workforce\/plans\/[^/]+(\/export)?$/.test(pathname)))
  ) {
    return "dashboard:read";
  }

  if (
    pathname === "/providers" ||
    pathname === "/providers/runtime-credential/detect" ||
    pathname === "/config/runtime" ||
    pathname === "/route/modes" ||
    pathname === "/models/import/providers"
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

  if (pathname === "/workforce/plan" || pathname === "/workforce/plans/save" || (method === "DELETE" && /^\/workforce\/plans\/[^/]+$/.test(pathname))) {
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

  if (Array.isArray(body?.messages)) {
    return {
      ...body,
      taskType: "chat",
      providerId: body.providerId ?? defaultTarget.providerId,
      model: body.model ?? defaultTarget.modelId,
    };
  }

  const prompt = body?.prompt ?? body?.query;

  if (typeof prompt !== "string" || prompt.length === 0) {
    return body;
  }

  return {
    context: body.context,
    taskType: "chat",
    providerId: body.providerId ?? defaultTarget.providerId,
    model: body.model ?? defaultTarget.modelId,
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
