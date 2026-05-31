const letters = "abcdefghijklmnopqrst".split("");

export const phase603AllowedBlockers = Object.freeze([null, "final_user_confirmation_required"]);

export const phase603SafetyBoundary = Object.freeze({
  designAndPreparationOnly: true,
  authJsonRead: false,
  authJsonTouched: false,
  authJsonCopied: false,
  authJsonWrittenToEvidence: false,
  authJsonWrittenToDocs: false,
  codexConfigModified: false,
  codexBaseUrlModified: false,
  projectCodexConfigModified: false,
  userCodexConfigModified: false,
  realProviderSwitchExecuted: false,
  providerCallsMade: false,
  realTestExecuted: false,
  commandExecuted: false,
  rawSecretAccessed: false,
  secretValueExposed: false,
  rawWebhookAccessed: false,
  webhookValueExposed: false,
  rawBaseUrlValueExposed: false,
  chatModified: false,
  chatGatewayExecuteModified: false,
  deployExecuted: false,
  releaseExecuted: false,
  tagCreated: false,
  artifactUploaded: false,
  characterModuleRestored: false,
  workspaceCleanClaimed: false,
});

export const phase603Group = Object.freeze(group(603, "Codex Context Gateway Custom Model Provider Route Preparation", [
  ["Custom Model Provider Route Scope Lock", "scopeDefined"],
  ["OpenAI Base URL Override Failure Record", "negativeControlRecorded"],
  ["Codex Config Sanitized Structure Inspection", "configTomlStructureInspected"],
  ["Duplicate Provider Table Check", "duplicateProviderTableCheckWorks"],
  ["Existing CRS Provider Compatibility Review", "existingCrsProviderReviewed"],
  ["PME Context Gateway Provider Preview Schema", "providerPreviewSchemaValid"],
  ["Project Config Preview Artifact", "projectConfigPreviewGenerated"],
  ["Model Provider Negative Control Plan", "negativeControlPlanGenerated"],
  ["Model Provider Route Decision Matrix", "decisionMatrixGenerated"],
  ["One Shot Custom Provider Command Bundle Preview", "commandBundlePreviewGenerated"],
  ["Rollback Preview for Config Route", "rollbackPreviewGenerated"],
  ["Emergency Disable Preview for Model Provider Route", "emergencyDisablePreviewGenerated"],
  ["Provider Call Policy for Custom Provider Route", "providerCallPolicyDefined"],
  ["Mission Control Custom Provider Route Preview", "customProviderRoutePreviewVisible"],
  ["Preparation Evidence Ledger", "preparationEvidenceLedgerGenerated"],
  ["Regression Against Phase592 602", "phase592602RegressionChecked"],
  ["Secret Product UI Regression", "secretProductUiRegressionPassed"],
  ["README AGENTS Custom Provider Guidance Update", "readmeAgentsPhase603UpdateWorks"],
  ["Next Phase Gate Report", "nextPhaseGateReportGenerated"],
  ["Custom Model Provider Route Preparation Closure", "phase603RecommendedSealed"],
]));

export const phase603Subphases = Object.freeze(phase603Group.subphases);
export const phase603SubphaseByKey = new Map(phase603Subphases.map((item, index) => [item.key, { ...item, index }]));

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
    sequenceEvidencePath: `apps/ai-gateway-service/evidence/${groupKey}a-t-custom-model-provider-route-preparation.json`,
    packageScript: `verify:${groupKey}a-t-custom-model-provider-route-preparation`,
  };
}

function slugify(value) {
  return value
    .replace(/\/|\+/g, " ")
    .replace(/URL/g, "url")
    .replace(/README/g, "readme")
    .replace(/AGENTS/g, "agents")
    .replace(/PME/g, "pme")
    .replace(/CRS/g, "crs")
    .replace(/OpenAI/g, "openai")
    .replace(/Phase592 602/g, "phase592-602")
    .replace(/UI/g, "ui")
    .replace(/[^A-Za-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase();
}
