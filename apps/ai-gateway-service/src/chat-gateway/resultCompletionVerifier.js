import { ENDPOINT_TYPES } from "../model-library/modelCapabilityRules.js";
import { taskForId, isSafetyRejectTask, isBlockedTask, requiresClarification, isLocalActionTask, isLocalActionClarificationTask } from "./chatGatewayTaskMatrix.js";
import { completionVerifiedForLatency, latencyVerificationReasonSuffix } from "./providerLatencyPolicy.js";

export function verifyResultCompletion({ intent, plan, execution } = {}) {
  const checks = [];
  const blockers = [];
  const warnings = [];
  const intentType = intent?.intentType ?? plan?.intentType ?? "unknown";
  const taskId = plan?.taskId ?? "unknown_intent";
  const routeDecision = plan?.routeDecision ?? "require_clarification";
  const expectedModel = plan?.selected?.modelId ?? null;
  const providerCalled = execution?.meta?.providerCalled === true;
  const modelCalled = execution?.meta?.modelCalled ?? null;
  const endpointType = execution?.meta?.endpointType ?? plan?.selected?.endpointType ?? null;
  const responseText = extractResponseText(execution);
  const evidenceId = execution?.meta?.evidenceId ?? execution?.evidenceId ?? "";
  const latencySignal = latencySignalFromExecution(execution);

  addCheck(checks, "provider_called", providerCalled, "Provider was called for executable plans.");
  if (!providerCalled && !plan?.blocked) blockers.push("provider_not_called");

  const modelMatches = !expectedModel || modelCalled === expectedModel;
  addCheck(checks, "model_matches_plan", modelMatches, "Provider response model must match the planned model.");
  if (!modelMatches) blockers.push("model_called_mismatch");

  const responseNonEmpty = responseText.length > 0;
  addCheck(checks, "response_non_empty", responseNonEmpty, "Gateway result must contain non-empty usable output.");
  if (!responseNonEmpty && execution?.success) warnings.push("provider_success_without_usable_output");

  const notErrorWrapper = !looksLikeErrorWrapper(execution, responseText);
  addCheck(checks, "not_error_wrapper", notErrorWrapper, "Gateway output must not be an error payload presented as an answer.");
  if (!notErrorWrapper) blockers.push("error_wrapper_returned");

  const endpointMatchesIntent = endpointAllowedForIntent(intentType, endpointType);
  addCheck(checks, "endpoint_matches_intent", endpointMatchesIntent, "Tool-style tasks must use the matching endpoint type.");
  if (!endpointMatchesIntent) blockers.push("endpoint_intent_mismatch");

  const intentBasicallyMatches = responseBasicallyMatchesIntent(intentType, responseText, endpointType);
  addCheck(checks, "intent_basic_match", intentBasicallyMatches, "Response shape must minimally match the intent.");
  if (!intentBasicallyMatches && execution?.success) warnings.push("intent_basic_match_weak");

  if (execution?.meta?.fallbackUsed === true && !execution.meta.fallbackReason) {
    blockers.push("fallback_reason_missing");
    addCheck(checks, "fallback_reason_recorded", false, "Fallback use must include a fallbackReason.");
  } else {
    addCheck(checks, "fallback_reason_recorded", true, "Fallback use includes a fallbackReason, or no fallback was used.");
  }

  let completionStatus = "completed";
  let completionVerified = false;
  let verificationReason = "";
  let resultQualitySignal = null;

  if (isSafetyRejectTask(taskId) || isBlockedTask(taskId)) {
    completionStatus = plan?.blocked ? "rejected" : "blocked";
    completionVerified = true;
    verificationReason = "拒绝动作已正确完成，系统没有浪费模型请求。";
    if (!providerCalled) {
      addCheck(checks, "safety_reject_no_provider_called", true, "Safety reject correctly did NOT call provider.");
    } else {
      addCheck(checks, "safety_reject_no_provider_called", false, "ERROR: Safety reject should NOT have called provider!");
      blockers.push("safety_reject_should_not_call_provider");
      completionVerified = false;
      verificationReason = "安全拒绝不应调用 provider，但实际调用了。";
    }
  } else if (isLocalActionTask(taskId)) {
    completionStatus = "preview";
    completionVerified = false;
    verificationReason = "本地桌面动作请求需要通过 action preview 链路处理，不能由普通聊天直接标记完成。仅生成说明文本不等于真实执行。";
    addCheck(checks, "local_action_not_completed_by_chat", true, "Local action request correctly NOT marked as completed by generic chat.");
    if (providerCalled) {
      warnings.push("local_action_should_not_call_provider");
    }
  } else if (isLocalActionClarificationTask(taskId)) {
    completionStatus = "clarification";
    completionVerified = false;
    verificationReason = "请求类型不明确，需要澄清后才能处理。不能由普通聊天直接标记完成。";
    addCheck(checks, "local_action_clarification_not_completed", true, "Vague local action request correctly requires clarification.");
  } else if (requiresClarification(taskId)) {
    completionStatus = "skipped";
    completionVerified = false;
    verificationReason = "需要澄清，未完成任务。";
    addCheck(checks, "clarification_required_no_provider", true, "Unknown intent correctly requires clarification.");
  } else if (plan?.blocked) {
    completionStatus = "failed";
    completionVerified = false;
    verificationReason = "计划被阻止，未执行 provider 调用。";
  } else if (execution?.success !== true) {
    completionStatus = "failed";
    completionVerified = false;
    verificationReason = "Provider 调用失败。";
  } else if (blockers.length > 0) {
    completionStatus = "failed";
    completionVerified = false;
    verificationReason = `阻断点: ${blockers.join(", ")}`;
  } else if (!providerCalled) {
    completionStatus = "dry_run";
    completionVerified = false;
    verificationReason = "Dry-run 模式，未真实调用 provider，不能标记为完成。";
  } else if (!responseNonEmpty) {
    completionStatus = "failed";
    completionVerified = false;
    verificationReason = "Provider 调用成功但返回为空。";
  } else {
    resultQualitySignal = buildResultQualitySignal({
      responseShapeOk: true,
      responseNonEmpty,
      intentBasicallyMatches,
      notErrorWrapper,
      latencySignal,
    });
    const latencyAllowsCompletion = completionVerifiedForLatency({
      baseCompletionVerified: intentBasicallyMatches && responseNonEmpty && notErrorWrapper,
      latency: latencySignal,
      responseShapeOk: true,
      nonEmptyOutput: responseNonEmpty,
      success: execution?.success === true,
    });
    if (latencyAllowsCompletion) {
      completionStatus = "completed";
      completionVerified = true;
      verificationReason = `任务完成，provider 调用成功，输出非空且匹配任务意图。${latencyVerificationReasonSuffix(latencySignal)}`;
    } else {
      completionStatus = "failed";
      completionVerified = false;
      verificationReason = `响应质量或延迟责任链不满足验证要求。${latencyVerificationReasonSuffix(latencySignal)}`;
    }
  }

  if (!resultQualitySignal) {
    resultQualitySignal = buildResultQualitySignal({
      responseShapeOk: responseNonEmpty && notErrorWrapper,
      responseNonEmpty,
      intentBasicallyMatches,
      notErrorWrapper,
      latencySignal,
    });
  }

  if (completionVerified && !evidenceId && providerCalled) {
    completionVerified = false;
    verificationReason = "缺少 evidenceId，不能确认验证。";
    addCheck(checks, "evidenceId_present", false, "EvidenceId must be present for verified completion.");
  }

  if (!completionVerified && !evidenceId) {
    addCheck(checks, "evidenceId_present", !plan?.blocked, "EvidenceId required for non-blocked executions.");
  } else {
    addCheck(checks, "evidenceId_present", true, "EvidenceId is present.");
  }

  return {
    verifiedCompleted: completionVerified,
    completionStatus,
    verificationReason,
    resultQualitySignal,
    intentType,
    taskId,
    routeDecision,
    expectedModel,
    modelCalled,
    providerCalled,
    endpointType,
    responseNonEmpty,
    evidenceId,
    fallbackUsed: execution?.meta?.fallbackUsed === true,
    fallbackReason: execution?.meta?.fallbackReason ?? "",
    checks,
    warnings,
    blockers,
  };
}

function addCheck(checks, name, passed, message) {
  checks.push({
    name,
    passed: Boolean(passed),
    message,
  });
}

function latencySignalFromExecution(execution) {
  const meta = execution?.meta ?? {};
  return {
    startedAt: meta.startedAt ?? null,
    completedAt: meta.completedAt ?? null,
    durationMs: Number(meta.durationMs ?? 0),
    providerTimeoutMs: Number(meta.providerTimeoutMs ?? 0),
    timeoutHit: meta.timeoutHit === true,
    timeoutType: meta.timeoutType ?? "none",
    lateResponseReceived: meta.lateResponseReceived === true,
    httpStatus: meta.httpStatus ?? execution?.providerResult?.data?.httpStatus ?? null,
    retryable: meta.retryable === true,
    retryRecommended: meta.retryRecommended === true,
    retryAttempted: meta.retryAttempted === true,
    retryCount: Number(meta.retryCount ?? 0),
    fallbackEligible: meta.fallbackEligible === true,
    fallbackAttempted: meta.fallbackAttempted === true,
    fallbackModel: meta.fallbackModel ?? null,
    fallbackReason: meta.fallbackReason ?? "",
    latencyRiskLevel: meta.latencyRiskLevel ?? "normal",
    completionConfidence: meta.completionConfidence ?? "low",
    userVisibleLatencySummary: meta.userVisibleLatencySummary ?? "",
  };
}

function buildResultQualitySignal({ responseShapeOk, responseNonEmpty, intentBasicallyMatches, notErrorWrapper, latencySignal }) {
  return {
    responseShapeOk: responseShapeOk === true,
    nonEmptyOutput: responseNonEmpty === true,
    taskMatched: intentBasicallyMatches === true,
    noSecretLeak: notErrorWrapper === true,
    startedAt: latencySignal.startedAt,
    completedAt: latencySignal.completedAt,
    durationMs: latencySignal.durationMs,
    providerTimeoutMs: latencySignal.providerTimeoutMs,
    timeoutHit: latencySignal.timeoutHit,
    timeoutType: latencySignal.timeoutType,
    lateResponseReceived: latencySignal.lateResponseReceived,
    httpStatus: latencySignal.httpStatus,
    retryable: latencySignal.retryable,
    retryRecommended: latencySignal.retryRecommended,
    retryAttempted: latencySignal.retryAttempted,
    retryCount: latencySignal.retryCount,
    fallbackEligible: latencySignal.fallbackEligible,
    fallbackAttempted: latencySignal.fallbackAttempted,
    fallbackModel: latencySignal.fallbackModel,
    fallbackReason: latencySignal.fallbackReason,
    latencyRiskLevel: latencySignal.latencyRiskLevel,
    completionConfidence: latencySignal.completionConfidence,
    userVisibleLatencySummary: latencySignal.userVisibleLatencySummary,
  };
}

function extractResponseText(execution) {
  if (typeof execution?.finalAnswer === "string" && execution.finalAnswer.trim()) return execution.finalAnswer.trim();
  if (typeof execution?.data?.outputText === "string" && execution.data.outputText.trim()) return execution.data.outputText.trim();
  if (typeof execution?.providerResult?.data?.text === "string" && execution.providerResult.data.text.trim()) return execution.providerResult.data.text.trim();
  if (typeof execution?.providerResult?.data?.outputText === "string" && execution.providerResult.data.outputText.trim()) return execution.providerResult.data.outputText.trim();
  return "";
}

function looksLikeErrorWrapper(execution, responseText) {
  if (execution?.error) return true;
  if (String(execution?.code ?? "").toLowerCase().includes("error")) return true;
  return /^\s*\{?\s*"?error"?\s*:/i.test(responseText) || /^(failed|error|exception):/i.test(responseText);
}

function endpointAllowedForIntent(intentType, endpointType) {
  if (!endpointType) return false;
  if (intentType === "translation") return endpointType === ENDPOINT_TYPES.translation;
  if (intentType === "safety_review") return endpointType === ENDPOINT_TYPES.safety;
  if (intentType === "pii_scan") return endpointType === ENDPOINT_TYPES.pii;
  if (intentType === "knowledge_query") {
    return [ENDPOINT_TYPES.chat, ENDPOINT_TYPES.embeddings, ENDPOINT_TYPES.rerank].includes(endpointType);
  }
  if (intentType === "image_understanding") return endpointType === ENDPOINT_TYPES.multimodal;
  if (intentType === "voice_task") return endpointType === ENDPOINT_TYPES.voice;
  return endpointType === ENDPOINT_TYPES.chat;
}

function responseBasicallyMatchesIntent(intentType, responseText, endpointType) {
  if (!responseText) return false;
  if (intentType === "translation") return endpointType === ENDPOINT_TYPES.translation;
  if (intentType === "safety_review") return endpointType === ENDPOINT_TYPES.safety;
  if (intentType === "pii_scan") return endpointType === ENDPOINT_TYPES.pii;
  if (intentType === "knowledge_query") return [ENDPOINT_TYPES.chat, ENDPOINT_TYPES.embeddings, ENDPOINT_TYPES.rerank].includes(endpointType);
  if (intentType === "coding" || intentType === "debug_fix" || intentType === "code_assist") return /code|function|文件|修复|bug|```|步骤|原因/i.test(responseText) || responseText.length > 8;
  return responseText.length > 1;
}
