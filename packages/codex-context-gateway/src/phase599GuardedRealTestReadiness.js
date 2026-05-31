export function reviewPhase599GuardedRealTestReadiness(options = {}) {
  const authorizationComplete = options.authorizationComplete === true;
  const humanApprovalStatus = options.humanApprovalStatus || "missing";
  const budgetReady = options.budgetReady === true;
  const rollbackReady = options.rollbackReady === true;
  const riskAcceptanceComplete = options.riskAcceptanceComplete === true;
  const explicitUserApproval = options.userExplicitlyApprovedGuardedRealTest === true;
  const guardedRealTestAllowed =
    authorizationComplete &&
    humanApprovalStatus === "approved" &&
    budgetReady &&
    rollbackReady &&
    riskAcceptanceComplete &&
    explicitUserApproval;
  return {
    completed: true,
    guardedRealTestReadinessWorks: true,
    incompleteAuthorizationBlocks: authorizationComplete !== true,
    missingHumanApprovalBlocks: humanApprovalStatus !== "approved",
    missingExplicitUserApprovalBlocks: explicitUserApproval !== true,
    guardedRealTestAllowed,
    realConfigWriteAllowed: false,
    relayStartAllowed: false,
    realIntegrationAllowed: false,
    nextRequiredAction: guardedRealTestAllowed
      ? "Prepare a later guarded real test phase; do not execute it in Phase599."
      : "Complete authorization packet, human approval, budget, rollback, risk acceptance, and explicit user approval before any guarded real test.",
  };
}
