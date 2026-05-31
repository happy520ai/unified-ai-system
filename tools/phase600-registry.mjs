const letters = "abcdefghijklmnopqrst".split("");

export const phase600AllowedBlockers = Object.freeze([
  null,
  "authorization_packet_input_missing",
  "authorization_packet_input_incomplete",
  "human_approval_missing",
  "guarded_real_test_not_authorized_yet",
]);

export const phase600SafetyBoundary = Object.freeze({
  providerCallsMade: false,
  rawSecretAccessed: false,
  secretValueExposed: false,
  rawWebhookAccessed: false,
  webhookValueExposed: false,
  chatModified: false,
  chatGatewayExecuteModified: false,
  providerRuntimeModified: false,
  workforceRuntimeModified: false,
  deployExecuted: false,
  releaseExecuted: false,
  tagCreated: false,
  artifactUploaded: false,
  codexBaseUrlModified: false,
  codexConfigModified: false,
  realCodexConnectionMade: false,
  relayStarted: false,
  realConfigWriteAllowed: false,
  relayStartAllowed: false,
  realIntegrationAllowed: false,
  guardedRealTestAllowed: false,
  characterModuleRestored: false,
  workspaceCleanClaimed: false,
});

export const phase600Group = Object.freeze(group(600, "Codex Context Gateway Authorization Packet Input + Human Approval Record + Guarded Real Test Readiness Review", [
  ["Authorization Input Scope Lock", "scopeDefined"],
  ["Authorization Packet Input Schema", "authorizationPacketInputSchemaValid"],
  ["Human Approval Record Input Schema", "humanApprovalInputSchemaValid"],
  ["Example Input File Generation", "exampleInputFilesGenerated"],
  ["Authorization Packet Input Loader", "authorizationPacketInputLoaderWorks"],
  ["Human Approval Record Loader", "humanApprovalRecordLoaderWorks"],
  ["Authorization Completeness Review", "authorizationCompletenessReviewWorks"],
  ["Human Approval Consistency Review", "humanApprovalConsistencyReviewWorks"],
  ["Budget Request Duration Readiness", "budgetRequestDurationReadinessWorks"],
  ["Relay AccountPool CredentialRef Readiness", "relayAccountPoolCredentialRefReadinessWorks"],
  ["Rollback Emergency Disable Readiness", "rollbackEmergencyDisableReadinessWorks"],
  ["Risk Acceptance Readiness", "riskAcceptanceReadinessWorks"],
  ["Guarded Real Test Readiness Decision", "guardedRealTestReadinessDecisionWorks"],
  ["Mission Control Readiness Preview", "missionControlReadinessPreviewVisible"],
  ["Readiness Evidence Ledger", "readinessEvidenceLedgerGenerated"],
  ["Phase592 599 Regression", "phase592599RegressionPassed"],
  ["Secret Product UI Regression", "secretProductUiRegressionPassed"],
  ["README AGENTS Update", "readmeAgentsPhase600UpdateWorks"],
  ["Next Phase Gate Report", "nextPhaseGateReportGenerated"],
  ["Authorization Input Readiness Review Closure", "phase600RecommendedSealed"],
]));

export const phase600Subphases = Object.freeze(phase600Group.subphases);
export const phase600SubphaseByKey = new Map(phase600Subphases.map((item, index) => [item.key, { ...item, index }]));

function group(number, title, phaseRows) {
  const groupKey = `phase${number}`;
  const subphases = phaseRows.map((row, index) => {
    const [titleText, requiredFlag] = row;
    const letter = letters[index];
    const key = `${groupKey}${letter}`;
    const phase = `Phase${number}${letter.toUpperCase()}`;
    const phaseSlug = slugify(titleText);
    return {
      groupNumber: number,
      groupKey,
      groupTitle: title,
      key,
      phase,
      letter,
      name: titleText,
      slug: phaseSlug,
      requiredFlag,
      docPath: `docs/${key}-${phaseSlug}.md`,
      reportPath: `docs/${key}-execution-report.md`,
      evidencePath: `apps/ai-gateway-service/evidence/${key}/${phaseSlug}-result.json`,
      verifierPath: `tools/${key}/validate-${key}-${phaseSlug}.mjs`,
      packageScript: `verify:${key}-${phaseSlug}`,
    };
  });
  return {
    number,
    key: groupKey,
    title,
    subphases,
    sequenceEvidencePath: `apps/ai-gateway-service/evidence/${groupKey}a-t-authorization-input-readiness-review.json`,
    packageScript: `verify:${groupKey}a-t-authorization-input-readiness-review`,
  };
}

function slugify(value) {
  return value
    .replace(/\/|\+/g, " ")
    .replace(/Codex/g, "codex")
    .replace(/URL/g, "url")
    .replace(/README/g, "readme")
    .replace(/AGENTS/g, "agents")
    .replace(/Phase592 599/g, "phase592-599")
    .replace(/CredentialRef/g, "credentialref")
    .replace(/AccountPool/g, "account-pool")
    .replace(/UI/g, "ui")
    .replace(/[^A-Za-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase();
}
