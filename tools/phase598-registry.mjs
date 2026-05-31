const letters = "abcdefghijklmnopqrst".split("");

export const phase598SafetyBoundary = Object.freeze({
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
  characterModuleRestored: false,
  workspaceCleanClaimed: false,
});

export const phase598Group = Object.freeze(group(598, "Codex Context Gateway Authorization Evidence Intake + Dry-Run Config Simulation", [
  ["Authorization Evidence Intake Scope Lock", "scopeDefined"],
  ["Authorization Evidence Schema", "authorizationEvidenceSchemaValid"],
  ["Authorization Completeness Validator", "authorizationCompletenessValidatorWorks"],
  ["Authorization Evidence Intake Template", "authorizationTemplateGenerated"],
  ["Dry Run Config Simulation Schema", "dryRunConfigSimulationSchemaValid"],
  ["Redacted Config Preview Builder", "redactedConfigPreviewGenerated"],
  ["Relay Simulation Plan", "relaySimulationPlanGenerated"],
  ["Account Pool Simulation", "accountPoolSimulationWorks"],
  ["CredentialRef Simulation", "credentialRefSimulationWorks"],
  ["Base URL Dry Run Policy", "baseUrlDryRunPolicyWorks"],
  ["Rollback Simulation", "rollbackSimulationWorks"],
  ["Emergency Disable Simulation", "emergencyDisableSimulationWorks"],
  ["Authorization Evidence Builder", "authorizationEvidenceGenerated"],
  ["Mission Control Authorization Preview", "missionControlAuthorizationPreviewVisible"],
  ["Config Simulation Report", "configSimulationReportGenerated"],
  ["Regression Against Phase592 597", "phase592597RegressionPassed"],
  ["Secret Product UI Regression", "secretProductUiRegressionPassed"],
  ["README AGENTS Authorization Guidance Update", "readmeAgentsAuthorizationGuidanceUpdateWorks"],
  ["Next Authorization Packet Status", "authorizationStatusReportGenerated"],
  ["Authorization Evidence Dry Run Config Simulation Closure", "phase598RecommendedSealed"],
]));

export const phase598Subphases = Object.freeze(phase598Group.subphases);
export const phase598SubphaseByKey = new Map(phase598Subphases.map((item, index) => [item.key, { ...item, index }]));

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
    sequenceEvidencePath: `apps/ai-gateway-service/evidence/${groupKey}a-t-authorization-evidence-dry-run-config-simulation.json`,
    packageScript: `verify:${groupKey}a-t-authorization-evidence-dry-run-config-simulation`,
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
    .replace(/Phase592 597/g, "phase592-597")
    .replace(/Dry Run/g, "dry-run")
    .replace(/AI/g, "ai")
    .replace(/[^A-Za-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase();
}
