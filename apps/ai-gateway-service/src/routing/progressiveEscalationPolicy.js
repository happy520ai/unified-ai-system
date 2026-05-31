export const PROGRESSIVE_ESCALATION_POLICY_VERSION = "phase276a-progressive-escalation-v1";

const ESCALATION_CHAIN = [
  "rule_only",
  "cache_only",
  "rag_local",
  "cheap_model",
  "standard_model",
  "premium_model",
  "expert_model",
  "multi_model_review",
  "require_approval",
];

export function createProgressiveEscalation(input = {}) {
  const currentPath = input.currentPath ?? input.answerPath ?? "rule_only";
  const shouldBlock = Boolean(input.shouldBlock);
  const nextEscalationPath = shouldBlock ? null : resolveNextPath(currentPath);
  const approvalRequiredBeforeEscalation = ["premium_model", "expert_model", "multi_model_review", "require_approval"].includes(nextEscalationPath)
    || ["premium_model", "expert_model", "multi_model_review"].includes(currentPath);

  return {
    progressiveEscalationEnabled: true,
    progressiveEscalationPolicyVersion: PROGRESSIVE_ESCALATION_POLICY_VERSION,
    chain: ESCALATION_CHAIN,
    currentPath,
    nextEscalationPath,
    escalationReason: shouldBlock
      ? "blocked_requests_do_not_escalate"
      : input.escalationReason ?? createEscalationReason(currentPath, nextEscalationPath),
    stopAtPath: input.stopAtPath ?? (approvalRequiredBeforeEscalation ? "require_approval" : nextEscalationPath),
    approvalRequiredBeforeEscalation,
    paidApiCallCount: 0,
    externalApiCalled: false,
    modelActuallyCalled: false,
  };
}

function resolveNextPath(currentPath) {
  const index = ESCALATION_CHAIN.indexOf(currentPath);
  if (index < 0 || index >= ESCALATION_CHAIN.length - 1) return null;
  return ESCALATION_CHAIN[index + 1];
}

function createEscalationReason(currentPath, nextEscalationPath) {
  if (!nextEscalationPath) return "no_escalation_needed";
  return `try_${currentPath}_first_then_only_escalate_to_${nextEscalationPath}_when_quality_gate_or_user_need_requires_it`;
}
