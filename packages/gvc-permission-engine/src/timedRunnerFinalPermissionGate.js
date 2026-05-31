const decisionRank = {
  allow: 0,
  approval_required: 1,
  deny: 2,
  forbidden: 3,
};

export function buildTimedRunnerFinalPermissionGate({
  existingRiskGateDecision = "deny",
  lowRiskExecutorDecision = "deny",
  ownerApprovalDecision = "deny",
  permissionDecision,
  reconciliation,
} = {}) {
  const gates = {
    existingRiskGateDecision: normalizeDecision(existingRiskGateDecision),
    lowRiskExecutorDecision: normalizeDecision(lowRiskExecutorDecision),
    ownerApprovalDecision: normalizeDecision(ownerApprovalDecision),
    permissionEngineDecision: normalizeDecision(permissionDecision?.decision),
  };
  const finalDecision = mostConservativeDecision(Object.values(gates));
  const conflictDetected = new Set(Object.values(gates)).size > 1 || reconciliation?.conflict === true;
  return {
    phaseId: "Phase2058-GVC-Permission-Enforcement-Limited-Activation",
    taskId: permissionDecision?.taskId || null,
    permissionEnforcementLimitedActivation: true,
    ...gates,
    finalDecision,
    conservativeReason: buildConservativeReason(gates, finalDecision, permissionDecision, conflictDetected),
    executionAllowed: finalDecision === "allow",
    conflictDetected,
    permissionEngineCanIndependentlyAllow: false,
    realMutationPermissionExpanded: false,
    providerRisk: permissionDecision?.providerRisk === true,
    secretRisk: permissionDecision?.secretRisk === true,
    deployRisk: permissionDecision?.deployRisk === true,
    chatRouteRisk: permissionDecision?.chatRouteRisk === true,
    targetFiles: Array.isArray(permissionDecision?.targetFiles) ? permissionDecision.targetFiles : [],
    matchedRules: Array.isArray(permissionDecision?.matchedRules) ? permissionDecision.matchedRules : [],
    providerCallsMade: false,
    secretRead: false,
    deployExecuted: false,
    chatModified: false,
    chatGatewayExecuteModified: false,
  };
}

function mostConservativeDecision(decisions) {
  return decisions.reduce((selected, decision) => (
    decisionRank[decision] > decisionRank[selected] ? decision : selected
  ), "allow");
}

function buildConservativeReason(gates, finalDecision, permissionDecision, conflictDetected) {
  if (finalDecision === "allow") return "all_gates_allow";
  const blockers = Object.entries(gates)
    .filter(([, decision]) => decision !== "allow")
    .map(([gate, decision]) => `${gate}:${decision}`);
  const reasons = [`final_decision_${finalDecision}`, ...blockers];
  if (conflictDetected) reasons.push("conflict_detected_more_conservative_decision_selected");
  if (permissionDecision?.providerRisk === true) reasons.push("provider_risk_blocked_or_approval_required");
  if (permissionDecision?.secretRisk === true) reasons.push("secret_risk_forbidden");
  if (permissionDecision?.deployRisk === true) reasons.push("deploy_risk_forbidden");
  if (permissionDecision?.chatRouteRisk === true) reasons.push("chat_route_risk_forbidden");
  return Array.from(new Set(reasons)).join("; ");
}

function normalizeDecision(decision) {
  if (decision === "allowed") return "allow";
  if (decisionRank[String(decision)] !== undefined) return String(decision);
  return "deny";
}
