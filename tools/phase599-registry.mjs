const letters = "abcdefghijklmnopqrst".split("");

export const phase599AllowedBlockers = Object.freeze([null, "authorization_packet_incomplete", "human_approval_missing"]);

export const phase599SafetyBoundary = Object.freeze({
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

export const phase599Group = Object.freeze(group(599, "Codex Context Gateway Authorization Packet Completion + Human Approval Review", [
  ["Authorization Packet Completion Scope Lock", "scopeDefined"],
  ["Authorization Packet Schema Finalization", "authorizationPacketSchemaValid"],
  ["Authorization Packet Template Completion", "authorizationTemplateGenerated"],
  ["Authorization Packet Loader", "authorizationPacketLoaderWorks"],
  ["Authorization Completeness Review", "authorizationCompletenessReviewWorks"],
  ["Human Approval Record Schema", "humanApprovalSchemaValid"],
  ["Human Approval Review", "humanApprovalReviewWorks"],
  ["Config Scope Review", "configScopeReviewWorks"],
  ["Relay Account Pool Reference Review", "relayRefReviewWorks"],
  ["CredentialRef Review", "credentialRefReviewWorks"],
  ["Budget Rate Duration Review", "budgetReviewWorks"],
  ["Rollback Emergency Disable Review", "rollbackReviewWorks"],
  ["Risk Acceptance Review", "riskAcceptanceReviewWorks"],
  ["Authorization Evidence Ledger", "authorizationEvidenceLedgerGenerated"],
  ["Mission Control Human Approval Review Preview", "humanApprovalReviewPreviewVisible"],
  ["Guarded Real Test Readiness Review", "guardedRealTestReadinessWorks"],
  ["Regression Against Phase592 598", "phase592598RegressionPassed"],
  ["Secret Product UI Regression", "secretProductUiRegressionPassed"],
  ["README AGENTS Human Approval Guidance Update", "readmeAgentsHumanApprovalGuidanceUpdateWorks"],
  ["Authorization Packet Human Approval Review Closure", "phase599RecommendedSealed"],
]));

export const phase599Subphases = Object.freeze(phase599Group.subphases);
export const phase599SubphaseByKey = new Map(phase599Subphases.map((item, index) => [item.key, { ...item, index }]));

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
    sequenceEvidencePath: `apps/ai-gateway-service/evidence/${groupKey}a-t-authorization-packet-human-approval-review.json`,
    packageScript: `verify:${groupKey}a-t-authorization-packet-human-approval-review`,
  };
}

function slugify(value) {
  return value
    .replace(/\/|\+/g, " ")
    .replace(/Codex/g, "codex")
    .replace(/URL/g, "url")
    .replace(/README/g, "readme")
    .replace(/AGENTS/g, "agents")
    .replace(/UI/g, "ui")
    .replace(/Phase592 598/g, "phase592-598")
    .replace(/CredentialRef/g, "credentialref")
    .replace(/AI/g, "ai")
    .replace(/[^A-Za-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase();
}
