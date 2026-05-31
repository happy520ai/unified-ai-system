const letters = "abcdefghijklmnopqrst".split("");

export const phase594SafetyBoundary = Object.freeze({
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

export const phase594Group = Object.freeze(group(594, "Codex Context Gateway Usage Workflow + Runner Integration Preview", [
  ["Usage Workflow Architecture", "usageWorkflowArchitectureDefined"],
  ["Context Pack Preflight Gate", "contextPackPreflightWorks"],
  ["Freshness Gate Stale Stopper", "freshnessGateStaleStopperWorks"],
  ["Relevant File Scope Gate", "relevantFileScopeGateWorks"],
  ["Prompt Pack Loader", "promptPackLoaderWorks"],
  ["Validation Command Planner", "validationCommandPlannerWorks"],
  ["Runner Integration Preview Contract", "runnerIntegrationPreviewDefined"],
  ["Codex Instruction Snippet Builder", "codexInstructionSnippetBuilderWorks"],
  ["AGENTS Managed Guidance Preview", "agentsManagedGuidancePreviewWorks"],
  ["README Managed Guidance Preview", "readmeManagedGuidancePreviewWorks"],
  ["Dry Run Codex Task Wrapper", "dryRunCodexTaskWrapperWorks"],
  ["Failure Mode Preview", "failureModePreviewWorks"],
  ["Token Budget Enforcement Preview", "tokenBudgetEnforcementPreviewWorks"],
  ["Relevant File Read Audit Preview", "relevantFileReadAuditPreviewWorks"],
  ["Operator Checklist", "operatorChecklistWorks"],
  ["Runner Resume Heartbeat Preview", "runnerResumeHeartbeatPreviewWorks"],
  ["Usage Workflow Mission Control Preview", "usageWorkflowMissionControlPreviewWorks"],
  ["Regression Against Phase592 593", "phase592593RegressionPassed"],
  ["README AGENTS Sync Guard", "readmeAgentsSyncGuardPassed"],
  ["Usage Workflow Runner Integration Preview Closure", "phase594RecommendedSealed"],
]));

export const phase594Subphases = Object.freeze(phase594Group.subphases);
export const phase594SubphaseByKey = new Map(phase594Subphases.map((item, index) => [item.key, { ...item, index }]));

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
    sequenceEvidencePath: `apps/ai-gateway-service/evidence/${groupKey}a-t-usage-workflow-runner-integration-preview.json`,
    packageScript: `verify:${groupKey}a-t-usage-workflow-runner-integration-preview`,
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
    .replace(/Phase592 593/g, "phase592-593")
    .replace(/[^A-Za-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase();
}
