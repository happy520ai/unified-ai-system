const letters = "abcdefghijklmnopqrst".split("");

export const phase592SafetyBoundary = Object.freeze({
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
  codexRunnerExecuted: false,
  codexConfigWritten: false,
  workspaceCleanClaimed: false,
});

export const phase592Group = Object.freeze(group(592, "Codex Context Gateway Token Budget Manager", [
  ["Codex Context Gateway Architecture", "architectureDefined"],
  ["Project State Reader", "projectStateReaderWorks"],
  ["Phase Evidence Indexer", "phaseEvidenceIndexerWorks"],
  ["Git Diff Dirty File Summarizer", "gitDiffSummarizerWorks"],
  ["Relevant File Selector", "relevantFileSelectorWorks"],
  ["Context Pack Schema", "contextPackSchemaWorks"],
  ["Token Budget Policy", "tokenBudgetPolicyWorks"],
  ["Long Context Compressor", "longContextCompressorWorks"],
  ["Codex Prompt Builder", "codexPromptBuilderWorks"],
  ["Cache Key Hash Snapshot Policy", "contextHashPolicyWorks"],
  ["Context Freshness Detector", "contextFreshnessDetectorWorks"],
  ["Failure Stale Context Guard", "staleContextGuardWorks"],
  ["Dry Run Context Pack Generator", "contextPackGeneratorWorks"],
  ["Codex Runner Integration Preview", "codexRunnerIntegrationPreviewWorks"],
  ["Gateway Base URL Compatibility Study", "gatewayBaseUrlCompatibilityStudyExists"],
  ["No Provider No Secret Safety Gate", "noProviderNoSecretSafetyGateWorks"],
  ["Context Pack Regression Tests", "contextPackRegressionTestsPassed"],
  ["Mission Control Workforce Context Pack Test", "missionControlWorkforceContextPackTestPassed"],
  ["Token Saving Estimate Report", "tokenSavingEstimateReportWorks"],
  ["Codex Context Gateway Closure", "phase592RecommendedSealed"],
]));

export const phase592Subphases = Object.freeze(phase592Group.subphases);
export const phase592SubphaseByKey = new Map(phase592Subphases.map((item, index) => [item.key, { ...item, index }]));

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
    sequenceEvidencePath: `apps/ai-gateway-service/evidence/${groupKey}a-t-codex-context-gateway.json`,
    packageScript: `verify:${groupKey}a-t-codex-context-gateway-token-budget-manager`,
  };
}

function slugify(value) {
  return value
    .replace(/\/|\+/g, " ")
    .replace(/Codex/g, "codex")
    .replace(/API/g, "api")
    .replace(/URL/g, "url")
    .replace(/JSON/g, "json")
    .replace(/[^A-Za-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase();
}
