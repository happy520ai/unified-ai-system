const letters = "abcdefghijklmnopqrst".split("");

export const phase595SafetyBoundary = Object.freeze({
  providerCallsMade: false,
  rawSecretAccessed: false,
  secretValueExposed: false,
  rawWebhookAccessed: false,
  webhookValueExposed: false,
  chatModified: false,
  chatGatewayExecuteModified: false,
  deployExecuted: false,
  releaseExecuted: false,
  tagCreated: false,
  artifactUploaded: false,
  codexBaseUrlModified: false,
  codexConfigModified: false,
  mainGatewayRuntimeModified: false,
  realCodexConnectionMade: false,
  characterModuleRestored: false,
  workspaceCleanClaimed: false,
});

export const phase595Group = Object.freeze(group(595, "Codex Context Gateway Real Usage Trial Without Base URL Change", [
  ["Real Usage Trial Scope Lock", "realUsageTrialScopeDefined"],
  ["Context Pack Real Preflight", "contextPackRealPreflightWorks"],
  ["Freshness Real Gate", "freshnessRealGateWorks"],
  ["Relevant File Real Scope Plan", "relevantFileRealScopePlanWorks"],
  ["Prompt Pack Real Load", "promptPackRealLoadWorks"],
  ["Real Usage Task Plan", "realUsageTaskPlanGenerated"],
  ["Real Usage Trial Note Generation", "realUsageTrialNoteGenerationWorks"],
  ["Actual Read Audit Preview", "actualReadAuditPreviewWorks"],
  ["Context Pack Usage Tracker", "contextPackUsageTrackerWorks"],
  ["Validation Command Real Plan", "validationCommandRealPlanWorks"],
  ["Real Usage Validation Execution", "realUsageValidationExecutionWorks"],
  ["Usage Trial Result Classifier", "usageTrialResultClassifierWorks"],
  ["Token Saving Real Usage Estimate", "tokenSavingRealUsageEstimateWorks"],
  ["Operator Trial Checklist", "operatorTrialChecklistWorks"],
  ["Next Codex Task Instruction Builder", "nextCodexTaskInstructionBuilderWorks"],
  ["README AGENTS Usage Update", "readmeAgentsUsageUpdateWorks"],
  ["Mission Control Usage Trial Preview Update", "missionControlUsageTrialPreviewUpdateWorks"],
  ["Phase592 594 Regression", "phase592594RegressionPassed"],
  ["Secret Product UI Regression", "secretProductUiRegressionPassed"],
  ["Real Usage Trial Closure", "phase595RecommendedSealed"],
]));

export const phase595Subphases = Object.freeze(phase595Group.subphases);
export const phase595SubphaseByKey = new Map(phase595Subphases.map((item, index) => [item.key, { ...item, index }]));

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
    sequenceEvidencePath: `apps/ai-gateway-service/evidence/${groupKey}a-t-codex-context-real-usage-trial.json`,
    packageScript: `verify:${groupKey}a-t-codex-context-real-usage-trial`,
  };
}

function slugify(value) {
  return value
    .replace(/\/|\+/g, " ")
    .replace(/Codex/g, "codex")
    .replace(/README/g, "readme")
    .replace(/AGENTS/g, "agents")
    .replace(/UI/g, "ui")
    .replace(/Phase592 594/g, "phase592-594")
    .replace(/[^A-Za-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase();
}
