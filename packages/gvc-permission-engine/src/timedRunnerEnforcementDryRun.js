const decisionRank = {
  allow: 0,
  approval_required: 1,
  deny: 2,
  forbidden: 3,
};

export function buildTimedRunnerEnforcementDryRun({ permissionDecision, reconciliation } = {}) {
  const conservativeDecision = normalizeDecision(reconciliation?.finalDecision || permissionDecision?.decision);
  const conflictDetected = reconciliation?.conflict === true;
  const blockedReasons = buildBlockedReasons(permissionDecision, conservativeDecision, conflictDetected);
  const allowedReasons = conservativeDecision === "allow" ? buildAllowedReasons(permissionDecision) : [];
  return {
    phaseId: "Phase2057-GVC-Permission-Enforcement-DryRun",
    taskId: permissionDecision?.taskId || null,
    enforcementDryRunOnly: true,
    wouldEnforceDecision: conservativeDecision,
    realExecutionDecisionUnchanged: true,
    finalRealGateSource: "existing_gvc_risk_gate",
    conflictDetected,
    conservativeDecision,
    permissionDecision: normalizeDecision(permissionDecision?.decision),
    riskGateDecision: normalizeDecision(reconciliation?.riskGateDecision || permissionDecision?.riskGateDecision),
    blockedReasons,
    allowedReasons,
    matchedRules: Array.isArray(permissionDecision?.matchedRules) ? permissionDecision.matchedRules : [],
    targetFiles: Array.isArray(permissionDecision?.targetFiles) ? permissionDecision.targetFiles : [],
    commandCategory: permissionDecision?.commandCategory || "safe_read",
    providerRisk: permissionDecision?.providerRisk === true,
    secretRisk: permissionDecision?.secretRisk === true,
    deployRisk: permissionDecision?.deployRisk === true,
    chatRouteRisk: permissionDecision?.chatRouteRisk === true,
    providerCallsMade: false,
    secretRead: false,
    deployExecuted: false,
    chatModified: false,
    chatGatewayExecuteModified: false,
    realMutationBehaviorChanged: false,
  };
}

function buildBlockedReasons(permissionDecision, conservativeDecision, conflictDetected) {
  const reasons = [];
  if (conservativeDecision !== "allow") {
    reasons.push(`would_enforce_${conservativeDecision}`);
  }
  if (conflictDetected) reasons.push("permission_risk_gate_conflict_conservative_result");
  if (permissionDecision?.providerRisk === true) reasons.push("provider_risk_blocked_or_approval_required");
  if (permissionDecision?.secretRisk === true) reasons.push("secret_risk_forbidden");
  if (permissionDecision?.deployRisk === true) reasons.push("deploy_risk_forbidden");
  if (permissionDecision?.chatRouteRisk === true) reasons.push("chat_route_risk_forbidden");
  if (typeof permissionDecision?.reason === "string" && conservativeDecision !== "allow") {
    reasons.push(permissionDecision.reason);
  }
  return Array.from(new Set(reasons));
}

function buildAllowedReasons(permissionDecision) {
  const reasons = [];
  if (typeof permissionDecision?.reason === "string") reasons.push(permissionDecision.reason);
  for (const rule of permissionDecision?.matchedRules || []) {
    reasons.push(`matched_rule:${rule}`);
  }
  return Array.from(new Set(reasons));
}

function normalizeDecision(decision) {
  if (decision === "allowed") return "allow";
  if (decisionRank[String(decision)] !== undefined) return String(decision);
  return "deny";
}
