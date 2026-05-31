import { createModeGovernanceGate } from "./modeGovernanceGate.js";
import { executeGodMode } from "./godModeExecutor.js";
import { executeNormalMode } from "./normalModeExecutor.js";
import { executeTianshuMode } from "./tianshuModeExecutor.js";
import { completeAuditTrace, createThreeModeAuditTrace, addAuditStep } from "./threeModeAuditTrace.js";
import { createThreeModeErrorEnvelope, createThreeModeSuccessEnvelope } from "./threeModeResponseEnvelope.js";
import { THREE_MODE_ERROR_CODES, ThreeModeRuntimeError } from "./threeModeErrors.js";
import { createDefaultPerUserModePolicy } from "../governance/perUserModePolicy.js";
import { evaluateQuotaBudgetGate } from "../governance/quotaBudgetGate.js";

export async function executeThreeModeRequest({ request, application } = {}) {
  const startedAt = Date.now();
  const mode = normalizeMode(request?.mode);
  const requestId = String(request?.requestId || `phase328a-${Date.now()}`);
  const auditTrace = createThreeModeAuditTrace({ requestId, mode });
  try {
    const gate = createModeGovernanceGate({ application });
    gate.assertNoSecretValue(request);
    gate.assertModeEnabled(mode);
    validateRequest(request, mode);
    const policyDecision = evaluateModePolicy(request);
    addAuditStep(auditTrace, { step: "mode_policy_checked", status: policyDecision.allowed ? "allowed" : "blocked" });
    addAuditStep(auditTrace, { step: "request_validated", status: "done" });
    let result;
    if (mode === "normal") result = await executeNormalMode({ request, application, gate, auditTrace });
    if (mode === "god") result = await executeGodMode({ request, application, gate, auditTrace });
    if (mode === "tianshu") result = await executeTianshuMode({ request, application, gate, auditTrace });
    if (result?.success !== true && result?.partialSuccess !== true) {
      throw new ThreeModeRuntimeError(
        THREE_MODE_ERROR_CODES.THREE_MODE_RUNTIME_ERROR,
        "Three Mode executor did not produce a verified final answer.",
        {
          mode,
          providerCallsMade: result?.auditTrace?.providerCallsMade === true,
          providerResultCode: result?.providerResult?.code ?? null,
        },
      );
    }
    const finalTrace = completeAuditTrace({
      ...result.auditTrace,
      policyDecision,
      estimatedCost: policyDecision.estimatedCost,
      budgetStatus: policyDecision.budgetStatus,
      quotaStatus: policyDecision.remainingQuota,
    }, startedAt);
    return createThreeModeSuccessEnvelope({
      startedAt,
      code: result.partialSuccess ? "PARTIAL_SUCCESS" : "OK",
      message: result.partialSuccess ? "Three Mode runtime completed with explicit fallback." : "Three Mode runtime completed.",
      data: {
        requestId,
        mode,
        finalAnswer: result.finalAnswer,
        selectedModel: slimModel(result.selectedModel),
        participantModels: (result.participantModels ?? []).map(slimModel),
        modelContributions: result.modelContributions ?? [],
        disagreements: result.disagreements ?? [],
        plannerDecision: result.plannerDecision,
        supervisorDecision: result.supervisorDecision,
        confidenceSummary: result.confidenceSummary,
        uncertainty: result.uncertainty,
        fallbackUsed: finalTrace.fallbackUsed === true,
        auditTrace: finalTrace,
      },
    });
  } catch (error) {
    return createThreeModeErrorEnvelope({ error, startedAt });
  }
}

function evaluateModePolicy(request) {
  const policy = createDefaultPerUserModePolicy({ userId: String(request?.userId || "anonymous") });
  const estimatedCost = estimateRequestCost(request);
  return evaluateQuotaBudgetGate({
    policy,
    request: {
      ...request,
      audit: {
        traceEnabled: true,
        ...(request?.audit || {}),
      },
    },
    usage: {
      dailyRequestCount: 0,
      monthlyRequestCount: 0,
      dailyEstimatedCost: 0,
      monthlyEstimatedCost: 0,
    },
    estimatedCost,
  });
}

function estimateRequestCost(request) {
  const mode = normalizeMode(request?.mode);
  const participantCount = Array.isArray(request?.modelSelection?.participantModelIds) ? request.modelSelection.participantModelIds.length : 0;
  if (mode === "god") return Math.max(2, participantCount || 2) * 0.01 + 0.01;
  if (mode === "tianshu") return request?.executionPolicy?.allowGodEscalation ? 0.03 : 0.01;
  return 0.01;
}

function normalizeMode(mode) {
  const normalized = String(mode ?? "normal").trim().toLowerCase();
  if (normalized === "god_mode") return "god";
  if (normalized === "tianshu_mode") return "tianshu";
  return normalized;
}

function validateRequest(request, mode) {
  const input = String(request?.input?.content ?? request?.input ?? "").trim();
  if (!input) {
    throw new ThreeModeRuntimeError(THREE_MODE_ERROR_CODES.VALIDATION_ERROR, "input.content is required.");
  }
  if (mode === "normal") {
    const selectedModelId = String(request?.modelSelection?.selectedModelId ?? request?.selectedModelId ?? "").trim();
    if (!selectedModelId) throw new ThreeModeRuntimeError(THREE_MODE_ERROR_CODES.VALIDATION_ERROR, "Normal Mode requires selectedModelId.");
  }
}

function slimModel(model) {
  if (!model) return null;
  return {
    providerId: model.providerId,
    modelId: model.modelId,
    verificationStatus: model.verificationStatus,
    selectable: model.selectable === true,
    evidenceId: model.evidenceId ?? null,
    capabilityBucket: model.capabilityBucket ?? null,
  };
}
