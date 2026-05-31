const letters = "abcdefghijklmnopqrst".split("");

export const phase593SafetyBoundary = Object.freeze({
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

export const phase593Group = Object.freeze(group(593, "Codex Context Gateway Operator Panel Preview", [
  ["Operator Panel Architecture", "operatorPanelArchitectureDefined"],
  ["Context Pack Preview Reader", "contextPackPreviewReaderWorks"],
  ["Token Budget Preview", "tokenBudgetPreviewWorks"],
  ["Freshness Stale Guard Preview", "freshnessStaleGuardPreviewWorks"],
  ["Relevant Files Preview", "relevantFilesPreviewWorks"],
  ["Evidence Index Preview", "evidenceIndexPreviewWorks"],
  ["Prompt Pack Preview", "promptPackPreviewWorks"],
  ["Dirty File Summary Preview", "dirtySummaryPreviewWorks"],
  ["Operator Panel Component", "operatorPanelComponentWorks"],
  ["Mission Control Integration", "missionControlIntegrationWorks"],
  ["Panel Interaction Buttons", "panelInteractionButtonsWork"],
  ["Operator Panel Browser Smoke", "operatorPanelBrowserSmokeWorks"],
  ["Context Pack Refresh Preview", "contextPackRefreshPreviewWorks"],
  ["Operator Panel Safety Boundary", "operatorPanelSafetyBoundaryWorks"],
  ["Operator Panel Error Missing File States", "operatorPanelErrorStatesWork"],
  ["Regression Against Phase592", "phase592RegressionPassed"],
  ["Mission Control Workbench Regression", "missionControlWorkbenchRegressionPassed"],
  ["Operator Panel Evidence Consistency", "operatorPanelEvidenceConsistencyPassed"],
  ["README AGENTS Sync", "readmeAgentsSyncPassed"],
  ["Codex Context Gateway Operator Panel Closure", "phase593RecommendedSealed"],
]));

export const phase593Subphases = Object.freeze(phase593Group.subphases);
export const phase593SubphaseByKey = new Map(phase593Subphases.map((item, index) => [item.key, { ...item, index }]));

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
    sequenceEvidencePath: `apps/ai-gateway-service/evidence/${groupKey}a-t-codex-context-gateway-operator-panel.json`,
    packageScript: `verify:${groupKey}a-t-codex-context-gateway-operator-panel`,
  };
}

function slugify(value) {
  return value
    .replace(/\/|\+/g, " ")
    .replace(/Codex/g, "codex")
    .replace(/README/g, "readme")
    .replace(/AGENTS/g, "agents")
    .replace(/UI/g, "ui")
    .replace(/JSON/g, "json")
    .replace(/[^A-Za-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase();
}
