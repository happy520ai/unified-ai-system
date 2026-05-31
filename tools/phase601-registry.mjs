const letters = "abcdefghijklmnopqrst".split("");

export const phase601AllowedBlockers = Object.freeze([null, "phase600_required", "final_user_confirmation_required"]);

export const phase601SafetyBoundary = Object.freeze({
  preparationOnly: true,
  realTestExecuted: false,
  commandExecuted: false,
  providerCallsMade: false,
  rawSecretAccessed: false,
  secretValueExposed: false,
  rawWebhookAccessed: false,
  webhookValueExposed: false,
  rawBaseUrlValueExposed: false,
  chatModified: false,
  chatGatewayExecuteModified: false,
  providerRuntimeModified: false,
  deployExecuted: false,
  releaseExecuted: false,
  tagCreated: false,
  artifactUploaded: false,
  codexBaseUrlModified: false,
  codexConfigModified: false,
  realCodexConnectionMade: false,
  relayStarted: false,
  characterModuleRestored: false,
  workspaceCleanClaimed: false,
});

export const phase601Group = Object.freeze(group(601, "Codex Context Gateway Guarded Real Base URL Test Preparation", [
  ["Guarded Test Preparation Scope Lock", "scopeDefined"],
  ["Phase600 Readiness Import", "phase600EvidenceReadable"],
  ["Session Override Config Command Preview", "sessionOverrideCommandPreviewGenerated"],
  ["Relay Health Check Preview", "relayHealthCheckPreviewGenerated"],
  ["Credential AccountPool Precheck Preview", "credentialRefPrecheckPreviewGenerated"],
  ["One Shot Test Prompt Preview", "oneShotPromptPreviewGenerated"],
  ["Budget Request Limit Final Preview", "budgetLimitPreviewGenerated"],
  ["Rollback Command Preview", "rollbackCommandPreviewGenerated"],
  ["Emergency Disable Command Preview", "emergencyDisablePreviewGenerated"],
  ["Real Test Non Execution Guard", "nonExecutionGuardWorks"],
  ["Guarded Test Checklist", "guardedTestChecklistGenerated"],
  ["Provider Call Policy Preview", "providerCallPolicyPreviewGenerated"],
  ["Mission Control Guarded Test Preparation Preview", "guardedTestPreparationPreviewVisible"],
  ["Preparation Evidence Ledger", "preparationEvidenceLedgerGenerated"],
  ["Phase592 600 Regression", "phase592600RegressionChecked"],
  ["Secret Product UI Regression", "secretProductUiRegressionPassed"],
  ["README AGENTS Preparation Guidance Update", "readmeAgentsPhase601UpdateWorks"],
  ["Next Phase Execution Gate Report", "nextPhaseGateReportGenerated"],
  ["Final Command Bundle Preview", "finalCommandBundlePreviewGenerated"],
  ["Guarded Real Base URL Test Preparation Closure", "phase601RecommendedSealed"],
]));

export const phase601Subphases = Object.freeze(phase601Group.subphases);
export const phase601SubphaseByKey = new Map(phase601Subphases.map((item, index) => [item.key, { ...item, index }]));

function group(number, title, phaseRows) {
  const groupKey = `phase${number}`;
  const subphases = phaseRows.map((row, index) => {
    const [titleText, requiredFlag] = row;
    const letter = letters[index];
    const key = `${groupKey}${letter}`;
    const slug = slugify(titleText);
    return {
      groupNumber: number,
      groupKey,
      groupTitle: title,
      key,
      phase: `Phase${number}${letter.toUpperCase()}`,
      letter,
      name: titleText,
      slug,
      requiredFlag,
      docPath: `docs/${key}-${slug}.md`,
      reportPath: `docs/${key}-execution-report.md`,
      evidencePath: `apps/ai-gateway-service/evidence/${key}/${slug}-result.json`,
      verifierPath: `tools/${key}/validate-${key}-${slug}.mjs`,
      packageScript: `verify:${key}-${slug}`,
    };
  });
  return {
    number,
    key: groupKey,
    title,
    subphases,
    sequenceEvidencePath: `apps/ai-gateway-service/evidence/${groupKey}a-t-guarded-real-base-url-test-preparation.json`,
    packageScript: `verify:${groupKey}a-t-guarded-real-base-url-test-preparation`,
  };
}

function slugify(value) {
  return value
    .replace(/\/|\+/g, " ")
    .replace(/URL/g, "url")
    .replace(/README/g, "readme")
    .replace(/AGENTS/g, "agents")
    .replace(/Phase592 600/g, "phase592-600")
    .replace(/AccountPool/g, "accountpool")
    .replace(/UI/g, "ui")
    .replace(/[^A-Za-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase();
}
