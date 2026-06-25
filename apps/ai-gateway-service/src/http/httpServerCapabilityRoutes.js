import { createErrorEnvelope, createOkEnvelope } from "@unified-ai-system/shared-utils";
import {
  writeJson,
  readJson,
  writeServiceLog,
  writeErrorResponse,
} from "./utils/responseUtils.js";
import {
  createHealth,
} from "./utils/healthUtils.js";
import {
  testPhase312AModel,
  sanitizeCredentialErrorDetails,
  setRuntimeProviderCredential,
} from "./utils/phaseUtils.js";
import {
  readCapabilityJson,
} from "./utils/enterpriseUtils.js";
import { detectRuntimeCredentialProviders } from "../providers/providerCredentialDetector.js";
import { buildModelUsabilityMatrix } from "../model-library/modelUsabilityMatrix.js";
import { createModelVerificationPlan } from "../model-library/modelVerificationPlanner.js";
import { createApprovalStore } from "../approval/approvalStore.js";
import { createFileContextStore } from "../file-context/fileContextStore.js";
import { getPluginRegistry } from "../plugin-registry/pluginRegistry.js";
import { createPhase319LocalOperationService } from "../local-operation/phase319LocalOperationService.js";
import { TASK_MATRIX } from "../chat-gateway/chatGatewayTaskMatrix.js";

export function createHttpServerCapabilityRoutes(ctx) {
  const {
    application,
    approvalStore,
    capabilityRouterService,
    connectorFeishuDryRun,
    connectorWeComDryRun,
    fileContextStore,
    modelLibraryStore,
    phase319LocalOperation,
    providerConfigRoutes,
  } = ctx;
  const handlers = new Map();

  // ── Approvals ──
  handlers.set("GET /approvals", async (_request, response, { startedAt }) => {
    writeJson(response, 200, createOkEnvelope({
      route: "/approvals",
      approvals: approvalStore.list(),
    }, { startedAt }));
  });

  handlers.set("POST /approvals/create", async (request, response, { startedAt }) => {
    const body = await readCapabilityJson({ request, response, startedAt, code: "approval_create_invalid_json" });
    if (!body) return;
    const approval = approvalStore.create(body);
    writeJson(response, 200, createOkEnvelope({
      route: "/approvals/create",
      approval,
      localExecutionTriggered: false,
      providerCalled: false,
    }, { startedAt }));
  });

  // Dynamic approval decision routes are handled inline (regex pattern)

  // ── Local Operation ──
  handlers.set("POST /local-operation/apply-approved", async (request, response, { startedAt }) => {
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
  });

  // ── File Context ──
  handlers.set("POST /file-context/select", async (request, response, { startedAt }) => {
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
  });

  // ── Plugin Registry ──
  handlers.set("GET /plugin-registry", async (_request, response, { startedAt }) => {
    writeJson(response, 200, createOkEnvelope({
      route: "/plugin-registry",
      approvalRequired: true,
      providerCalled: false,
      localExecutionTriggered: false,
      ...getPluginRegistry(),
    }, { startedAt }));
  });

  // ── Provider Config ──
  handlers.set("GET /provider-config/status", async (_request, response, { startedAt }) => {
    writeJson(response, 200, createOkEnvelope(providerConfigRoutes.status(), { startedAt }));
  });

  handlers.set("POST /provider-config/save", async (request, response, { startedAt }) => {
    const body = await readCapabilityJson({ request, response, startedAt, code: "provider_config_save_invalid_json" });
    if (!body) return;
    writeJson(response, 200, createOkEnvelope(providerConfigRoutes.save(body), { startedAt }));
  });

  handlers.set("POST /provider-config/test", async (request, response, { startedAt }) => {
    const body = await readCapabilityJson({ request, response, startedAt, code: "provider_config_test_invalid_json" });
    if (!body) return;
    const result = await providerConfigRoutes.test(body);
    writeJson(response, 200, createOkEnvelope(result, { startedAt }));
  });

  // ── Model Library ──
  handlers.set("GET /model-library", async (_request, response, { startedAt }) => {
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
  });

  handlers.set("GET /model-library/usability-matrix", async (_request, response, { startedAt }) => {
    const registry = modelLibraryStore.getRegistry();
    writeJson(response, 200, createOkEnvelope({ matrix: buildModelUsabilityMatrix({ registry }) }, { startedAt }));
  });

  handlers.set("GET /model-library/verification-plan", async (request, response, { startedAt }) => {
    const registry = modelLibraryStore.getRegistry();
    const matrix = buildModelUsabilityMatrix({ registry });
    const url = new URL(request.url ?? "/", `http://${request.headers.host ?? "127.0.0.1"}`);
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
  });

  handlers.set("POST /model-library/verify-dry-run", async (request, response, { startedAt }) => {
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
  });

  handlers.set("POST /model-library/refresh", async (request, response, { startedAt }) => {
    const body = await readCapabilityJson({ request, response, startedAt, code: "model_library_refresh_invalid_json" });
    if (!body) return;
    const registry = await modelLibraryStore.refreshCatalog({ allowLiveDiscovery: body.allowLiveDiscovery === true });
    writeJson(response, 200, createOkEnvelope({ registry, usabilityMatrix: buildModelUsabilityMatrix({ registry }) }, { startedAt }));
  });

  handlers.set("POST /model-library/test-model", async (request, response, { startedAt }) => {
    const body = await readCapabilityJson({ request, response, startedAt, code: "model_library_test_invalid_json" });
    if (!body) return;
    const result = await testPhase312AModel({ application, body });
    writeJson(response, 200, createOkEnvelope(result, { startedAt }));
  });

  handlers.set("POST /model-library/task-default", async (request, response, { startedAt }) => {
    const body = await readCapabilityJson({ request, response, startedAt, code: "model_library_task_default_invalid_json" });
    if (!body) return;
    writeJson(response, 200, createOkEnvelope(modelLibraryStore.setTaskDefault(body), { startedAt }));
  });

  // ── Connectors ──
  handlers.set("GET /connectors", async (_request, response, { startedAt }) => {
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
  });

  handlers.set("POST /connectors/feishu/send", async (request, response, { startedAt }) => {
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
        writeErrorResponse({ response, error, startedAt, fallbackCode: "feishu_send_failed" });
      }
    }
  });

  handlers.set("POST /connectors/wecom/send", async (request, response, { startedAt }) => {
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
        writeErrorResponse({ response, error, startedAt, fallbackCode: "wecom_send_failed" });
      }
    }
  });

  // ── Provider Runtime Credential ──
  handlers.set("POST /providers/runtime-credential/detect", async (request, response, { startedAt }) => {
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
        path: request.url,
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
  });

  handlers.set("POST /providers/runtime-credential", async (request, response, { startedAt }) => {
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
        path: request.url,
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
  });

  // ── Capability Router ──
  handlers.set("POST /models/capability-router/preview", async (request, response, { startedAt }) => {
    const body = await readCapabilityJson({ request, response, startedAt, code: "capability_router_preview_invalid_json" });
    if (!body) return;

    try {
      const result = capabilityRouterService.preview(body);
      writeServiceLog("capability_router_preview_completed", {
        method: request.method,
        path: request.url,
        status: result.status,
        detectedTaskType: result.task?.detectedTaskType,
        requiredCapabilities: result.task?.requiredCapabilities,
        selectedProvider: result.recommendation?.selected?.providerId,
        selectedModel: result.recommendation?.selected?.modelId,
        durationMs: Date.now() - startedAt,
      });
      writeJson(response, 200, createOkEnvelope(result, { startedAt }));
    } catch (error) {
      writeErrorResponse({ response, error, startedAt, fallbackCode: "capability_router_preview_failed" });
    }
  });

  // ── Workbench Diagnostics ──
  handlers.set("GET /workbench/diagnostics/status", async (_request, response, { startedAt }) => {
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
  });

  return { handlers };
}
