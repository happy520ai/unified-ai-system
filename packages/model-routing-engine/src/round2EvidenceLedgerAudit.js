export function auditRound2EvidenceLedger({ finalEvidence = {}, modeResults = [] } = {}) {
  const allRoutes = modeResults.flatMap((item) => item.routeResults || []);
  const realRoutes = allRoutes.filter((route) => route.dryRunOnly !== true);
  return {
    phase: "Phase958",
    completed: true,
    recommended_sealed: realRoutes.length === finalEvidence.realProviderRequestCount,
    blocker: realRoutes.length === finalEvidence.realProviderRequestCount ? null : "round2_evidence_ledger_count_mismatch",
    evidenceLedgerAuditReady: true,
    routeEvidenceCount: allRoutes.length,
    realRouteEvidenceCount: realRoutes.length,
    eachRealRequestHasEvidence: realRoutes.every((route) => route.routeId && route.responseSource === "external_provider"),
    requestCountWithinLimit: finalEvidence.maxTotalProviderRequestsRespected === true,
    noSecret: finalEvidence.rawSecretRead === false && finalEvidence.secretValueExposed === false,
    noDeploy: finalEvidence.deployExecuted === false,
    noDefaultRouteBehaviorChange: finalEvidence.chatBehaviorChangedByDefault === false
      && finalEvidence.chatGatewayExecuteBehaviorChangedByDefault === false,
  };
}
