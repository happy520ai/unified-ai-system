const letters = "abcdefghijklmnopqrst".split("");

export const phase596SafetyBoundary = Object.freeze({
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

export const phase596Group = Object.freeze(group(596, "Codex Context Gateway Repeated Usage Trial + Token Saving Benchmark", [
  ["Repeated Usage Benchmark Scope Lock", "benchmarkScopeDefined"],
  ["Benchmark Task Registry", "benchmarkTaskRegistryExists"],
  ["Repeated Context Pack Preflight", "repeatedPreflightWorks"],
  ["Repeated Freshness Stale Gate", "repeatedFreshnessGateWorks"],
  ["Repeated Relevant File Scope Enforcement", "repeatedRelevantFileScopeWorks"],
  ["Benchmark Task 1 2 Execution", "benchmarkTask12ExecutionWorks"],
  ["Benchmark Task 3 4 Execution", "benchmarkTask34ExecutionWorks"],
  ["Benchmark Task 5 6 Execution", "benchmarkTask56ExecutionWorks"],
  ["Benchmark Task 7 8 Execution", "benchmarkTask78ExecutionWorks"],
  ["Optional Task 9 10 Execution Preview", "optionalTasksHandled"],
  ["Repeated Actual Read Audit", "repeatedReadAuditWorks"],
  ["Repeated Token Saving Benchmark", "repeatedTokenSavingEstimated"],
  ["Full Repo Scan Avoidance Benchmark", "fullRepoScanAvoidanceBenchmarkWorks"],
  ["Benchmark Result Classifier", "benchmarkResultClassifierWorks"],
  ["Benchmark Aggregate Report", "aggregateReportGenerated"],
  ["Mission Control Benchmark Preview", "missionControlBenchmarkPreviewWorks"],
  ["Benchmark Validation Execution", "benchmarkValidationExecutionWorks"],
  ["Phase592 595 Regression", "phase592595RegressionPassed"],
  ["README AGENTS Benchmark Update", "readmeAgentsBenchmarkUpdateWorks"],
  ["Repeated Usage Benchmark Closure", "phase596RecommendedSealed"],
]));

export const phase596Subphases = Object.freeze(phase596Group.subphases);
export const phase596SubphaseByKey = new Map(phase596Subphases.map((item, index) => [item.key, { ...item, index }]));

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
    sequenceEvidencePath: `apps/ai-gateway-service/evidence/${groupKey}a-t-codex-context-repeated-usage-benchmark.json`,
    packageScript: `verify:${groupKey}a-t-codex-context-repeated-usage-benchmark`,
  };
}

function slugify(value) {
  return value
    .replace(/\/|\+/g, " ")
    .replace(/Codex/g, "codex")
    .replace(/README/g, "readme")
    .replace(/AGENTS/g, "agents")
    .replace(/UI/g, "ui")
    .replace(/Phase592 595/g, "phase592-595")
    .replace(/1 2/g, "1-2")
    .replace(/3 4/g, "3-4")
    .replace(/5 6/g, "5-6")
    .replace(/7 8/g, "7-8")
    .replace(/9 10/g, "9-10")
    .replace(/[^A-Za-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase();
}
