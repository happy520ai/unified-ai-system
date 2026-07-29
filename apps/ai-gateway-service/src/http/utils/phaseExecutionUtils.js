import { classifyGatewayIntent } from "../../chat-gateway/gatewayIntentClassifier.js";
import { planGatewayModel } from "../../chat-gateway/gatewayModelPlanner.js";
import { executeCapabilitySafePlan } from "../../chat-gateway/capabilitySafeExecutionRouter.js";
import { verifyResultCompletion } from "../../chat-gateway/resultCompletionVerifier.js";
import { recordChatGatewayEvidence, generateEvidenceId } from "../../chat-gateway/chatGatewayEvidenceRecorder.js";
import { LATENCY_DRY_RUN_CASES, buildProviderLatencyAccountability } from "../../chat-gateway/providerLatencyPolicy.js";
import { buildProviderRetryFallbackAccountability } from "../../chat-gateway/providerRetryFallbackPolicy.js";
import { createNvidiaUnifiedClient } from "../../providers/nvidia/nvidiaUnifiedClient.js";
import { normalizeGatewayMode, normalizeModelSelection } from "./phaseModelUtils.js";

export async function runPhase312AChatGateway({ application, body, startedAt }) {
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

export function createPhase312ARealCallDisabledExecution(
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

export async function runPhase314ADryRunTask({ application, body, startedAt }) {
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

export function createPhase314ADryRunExecution(plan, evidenceId) {
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

export function runPhase315ALatencyDryRun(body = {}) {
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

export function buildPhase315ALatencyDryRunResult(testCase) {
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

export function responseLatencyFields(execution, verification) {
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

export function buildUserVisibleSummary({ verification, execution, plan }) {
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
