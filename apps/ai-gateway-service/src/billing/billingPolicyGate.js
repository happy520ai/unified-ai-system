import { BILLING_ERROR_CODES } from "./billingErrors.js";

export function evaluateBillingPolicyGate({ estimate, policy }) {
  if (estimate.estimatedCost > Number(policy.maxSingleRequestEstimatedCost || 0)) {
    return { allowed: false, code: BILLING_ERROR_CODES.REQUEST_COST_ABOVE_CONFIRMATION_THRESHOLD };
  }
  if (estimate.mode === "god" && estimate.estimatedCost > Number(policy.godModeMaxEstimatedCost || 0)) {
    return { allowed: false, code: BILLING_ERROR_CODES.REQUEST_COST_ABOVE_CONFIRMATION_THRESHOLD };
  }
  if (estimate.mode === "tianshu" && estimate.estimatedCost > Number(policy.tianshuMaxEstimatedCost || 0)) {
    return { allowed: false, code: BILLING_ERROR_CODES.REQUEST_COST_ABOVE_CONFIRMATION_THRESHOLD };
  }
  return {
    allowed: true,
    code: "BILLING_POLICY_ALLOWED",
    nonNvidiaProviderCostWarning: estimate.providerId !== "nvidia",
    requireUserConfirmationAboveThreshold: estimate.estimatedCost >= Number(policy.confirmationThreshold || 0.05),
  };
}
