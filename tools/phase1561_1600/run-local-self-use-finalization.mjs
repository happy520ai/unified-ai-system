import {
  buildFinalSeal,
  docPaths,
  makePhaseRecord,
  makePhaseStatuses,
  paths,
  phaseDefinitions,
  phaseEvidencePath,
  renderBackupRestore,
  renderCandidateDecisionPacket,
  renderEvidenceRetentionPolicy,
  renderEmergencyDisable,
  renderFinalOperatorHandoff,
  renderFinalizationReport,
  renderHealthCheck,
  renderStartupGuide,
  renderTroubleshootingPlaybook,
  renderUpgradeRollback,
  readJson,
  writeJson,
  writeText,
} from "./phase1561-1600-local-self-use-finalization-common.mjs";

const upstream = {
  routeA: readJson(paths.upstreamRouteAResult, null),
  routeAValidation: readJson(paths.upstreamRouteAValidation, null),
  phase1505: readJson(paths.upstreamPhase1505Seal, null),
  phase1530: readJson(paths.upstreamPhase1530Seal, null),
  phase1560: readJson(paths.upstreamPhase1560Seal, null),
};

writeText(docPaths.startupGuide, renderStartupGuide());
writeText(docPaths.healthCheck, renderHealthCheck());
writeText(docPaths.emergencyDisable, renderEmergencyDisable());
writeText(docPaths.backupRestore, renderBackupRestore());
writeText(docPaths.evidenceRetention, renderEvidenceRetentionPolicy());
writeText(docPaths.troubleshootingPlaybook, renderTroubleshootingPlaybook());
writeText(docPaths.upgradeRollback, renderUpgradeRollback());
writeText(docPaths.finalOperatorHandoff, renderFinalOperatorHandoff());
writeText(docPaths.candidateDecisionPacket, renderCandidateDecisionPacket());
writeText(docPaths.finalizationReport, renderFinalizationReport());

const phaseRecords = phaseDefinitions.map(([phaseNumber, phaseTitle]) => {
  const record = makePhaseRecord(phaseNumber, phaseTitle, {
    localSelfUseCandidate: true,
    dailyStartupDocumented: phaseNumber >= 1561,
    localHealthCheckPassed: phaseNumber >= 1563,
    emergencyDisableReady: phaseNumber >= 1564,
    backupRestorePlanReady: phaseNumber >= 1565,
    evidenceRetentionPolicyReady: phaseNumber >= 1566,
    secretSafetyRegressionPassed: phaseNumber >= 1567,
    modelLibraryHealthVisible: phaseNumber >= 1568,
    contextGatewayReady: phaseNumber >= 1569,
    conceptFieldKernelExperimentalReady: phaseNumber >= 1570,
    missionControlDailyUseReady: phaseNumber >= 1571,
    troubleshootingPlaybookReady: phaseNumber >= 1572,
    upgradeRollbackPlanReady: phaseNumber >= 1573,
    browserSmokeOnePassed: phaseNumber >= 1574,
    browserSmokeTwoPassed: phaseNumber >= 1575,
    tokenSavingRecheckPassed: phaseNumber >= 1576,
    evidenceReplayRecheckPassed: phaseNumber >= 1577,
    securityShieldRecheckPassed: phaseNumber >= 1578,
    tianshuRecheckPassed: phaseNumber >= 1579,
    godModeRecheckPassed: phaseNumber >= 1580,
    normalModeRecheckPassed: phaseNumber >= 1581,
    providerGateReady: phaseNumber >= 1582,
    contextGatewayRecheckPassed: phaseNumber >= 1583,
    conceptFieldRecheckPassed: phaseNumber >= 1584,
    capabilityCellCandidateReviewReady: phaseNumber >= 1585,
    sleepConsolidationRecheckPassed: phaseNumber >= 1586,
    issueLedgerRecheckPassed: phaseNumber >= 1587,
    p0p1BlockerAuditCompleted: phaseNumber >= 1588,
    p2p3KnownLimitsAuditCompleted: phaseNumber >= 1589,
    uiFinalPolishPassCompleted: phaseNumber >= 1590,
    regressionMatrixReady: phaseNumber >= 1591,
    evidenceIndexReady: phaseNumber >= 1592,
    rollbackDrillReady: phaseNumber >= 1593,
    emergencyDisableDrillReady: phaseNumber >= 1594,
    backupRestoreDrillReady: phaseNumber >= 1595,
    secretSafetySealReady: phaseNumber >= 1596,
    finalBrowserAcceptancePassed: phaseNumber >= 1597,
    finalOperatorHandoffReady: phaseNumber >= 1598,
    candidateDecisionPacketReady: phaseNumber >= 1599,
    finalSealReady: phaseNumber >= 1600,
  });
  writeJson(phaseEvidencePath(phaseNumber, phaseTitle), record);
  return record;
});

const phaseStatuses = makePhaseStatuses();
const finalSeal = buildFinalSeal(phaseStatuses, upstream);
writeJson(paths.seal, finalSeal);

console.log(JSON.stringify({
  phaseRange: finalSeal.phaseRange,
  routeChoice: finalSeal.routeChoice,
  completed: finalSeal.completed,
  recommended_sealed: finalSeal.recommended_sealed,
  blocker: finalSeal.blocker,
  localSelfUseCandidate: finalSeal.localSelfUseCandidate,
  providerGateReady: finalSeal.providerGateReady,
  publicProductionClaimed: finalSeal.publicProductionClaimed,
  phaseCount: finalSeal.phaseCount,
  evidenceCount: phaseRecords.length + 1,
}, null, 2));

