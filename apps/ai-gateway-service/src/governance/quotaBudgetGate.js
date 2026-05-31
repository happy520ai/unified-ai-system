import { MODE_POLICY_ERROR_CODES, ModePolicyError } from "./modePolicyErrors.js";

export function evaluateQuotaBudgetGate({ policy, request, usage, estimatedCost = 0 } = {}) {
  const mode = String(request?.mode || "normal");
  const participantCount = Array.isArray(request?.modelSelection?.participantModelIds) ? request.modelSelection.participantModelIds.length : 0;
  if (policy.requireAuditTrace && request?.audit?.traceEnabled !== true) {
    throw new ModePolicyError(MODE_POLICY_ERROR_CODES.AUDIT_TRACE_REQUIRED, "Audit trace is required for this user policy.");
  }
  if (policy.disabledModes.includes(mode) || !policy.allowedModes.includes(mode)) {
    throw new ModePolicyError(MODE_POLICY_ERROR_CODES.USER_MODE_NOT_ALLOWED, `Mode ${mode} is not allowed for this user.`, { mode });
  }
  if (mode === "god" && participantCount > Number(policy.maxGodParticipants || 0)) {
    throw new ModePolicyError(
      MODE_POLICY_ERROR_CODES.GOD_PARTICIPANT_LIMIT_EXCEEDED,
      `God Mode participant count exceeds limit ${policy.maxGodParticipants}.`,
      { participantCount, maxGodParticipants: policy.maxGodParticipants },
    );
  }
  if (mode === "tianshu" && request?.executionPolicy?.allowGodEscalation === true && policy.allowTianshuGodEscalation === false) {
    throw new ModePolicyError(
      MODE_POLICY_ERROR_CODES.TIANSHU_ESCALATION_NOT_ALLOWED,
      "Tianshu God escalation is not allowed for this user.",
      { mode },
    );
  }
  if (estimatedCost > Number(policy.maxSingleRequestEstimatedCost || 0)) {
    throw new ModePolicyError(
      MODE_POLICY_ERROR_CODES.REQUEST_COST_TOO_HIGH,
      "Estimated request cost exceeds single request limit.",
      { estimatedCost, maxSingleRequestEstimatedCost: policy.maxSingleRequestEstimatedCost },
    );
  }
  if (Number(usage.dailyRequestCount || 0) >= Number(policy.dailyRequestLimit || 0)) {
    throw new ModePolicyError(MODE_POLICY_ERROR_CODES.USER_QUOTA_EXCEEDED, "Daily request quota exceeded.", usage);
  }
  if (Number(usage.monthlyRequestCount || 0) >= Number(policy.monthlyRequestLimit || 0)) {
    throw new ModePolicyError(MODE_POLICY_ERROR_CODES.USER_QUOTA_EXCEEDED, "Monthly request quota exceeded.", usage);
  }
  if (Number(usage.dailyEstimatedCost || 0) + estimatedCost > Number(policy.dailyBudgetLimit || 0)) {
    throw new ModePolicyError(MODE_POLICY_ERROR_CODES.USER_BUDGET_EXCEEDED, "Daily estimated budget exceeded.", usage);
  }
  if (Number(usage.monthlyEstimatedCost || 0) + estimatedCost > Number(policy.monthlyBudgetLimit || 0)) {
    throw new ModePolicyError(MODE_POLICY_ERROR_CODES.USER_BUDGET_EXCEEDED, "Monthly estimated budget exceeded.", usage);
  }
  const remainingQuota = {
    dailyRequests: Math.max(0, Number(policy.dailyRequestLimit || 0) - Number(usage.dailyRequestCount || 0) - 1),
    monthlyRequests: Math.max(0, Number(policy.monthlyRequestLimit || 0) - Number(usage.monthlyRequestCount || 0) - 1),
  };
  const budgetStatus = {
    dailyRemaining: round(Number(policy.dailyBudgetLimit || 0) - Number(usage.dailyEstimatedCost || 0) - estimatedCost),
    monthlyRemaining: round(Number(policy.monthlyBudgetLimit || 0) - Number(usage.monthlyEstimatedCost || 0) - estimatedCost),
  };
  return {
    allowed: true,
    blocked: false,
    warning: remainingQuota.dailyRequests <= 5 || budgetStatus.dailyRemaining <= 1,
    reason: "allowed_with_mock_budget_tracking",
    remainingQuota,
    estimatedCost: round(estimatedCost),
    budgetStatus,
    policyStatus: "allowed",
  };
}

function round(value) {
  return Math.round(Number(value || 0) * 100000) / 100000;
}
