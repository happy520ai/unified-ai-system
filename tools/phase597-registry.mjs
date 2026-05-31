const letters = "abcdefghijklmnopqrst".split("");

export const phase597SafetyBoundary = Object.freeze({
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
  mainGatewayRuntimeModified: false,
  realCodexConnectionMade: false,
  relayStarted: false,
  characterModuleRestored: false,
  workspaceCleanClaimed: false,
});

export const phase597Group = Object.freeze(group(597, "Codex Context Gateway Controlled Base URL Integration Design", [
  ["Controlled Base URL Integration Scope Lock", "scopeDefined"],
  ["Codex Config Surface Study", "configSurfaceDocumented"],
  ["Base URL Config Preview Schema", "baseUrlConfigPreviewSchemaValid"],
  ["Relay Architecture Design", "relayArchitectureDefined"],
  ["Authorization Requirements Schema", "authorizationSchemaValid"],
  ["Account Pool Policy Design", "accountPoolPolicyDefined"],
  ["Cache Miss Context Reuse Policy", "cacheMissPolicyDefined"],
  ["Rate Limit Budget Timeout Policy Design", "rateLimitPolicyDefined"],
  ["Secret Credential Boundary Design", "secretCredentialBoundaryDefined"],
  ["Main AI Gateway Isolation Design", "mainGatewayIsolationDefined"],
  ["Rollback Plan Builder", "rollbackPlanGenerated"],
  ["Failure Mode Risk Review", "riskReviewGenerated"],
  ["Controlled Integration Checklist", "checklistGenerated"],
  ["Config Preview Artifact", "configPreviewGenerated"],
  ["Mission Control Base URL Design Preview", "missionControlBaseUrlDesignPreviewWorks"],
  ["Regression Against Phase592 596", "phase592596RegressionPassed"],
  ["Secret Product UI Regression", "secretProductUiRegressionPassed"],
  ["README AGENTS Design Update", "readmeAgentsDesignUpdateWorks"],
  ["Authorization Packet Template", "authorizationPacketTemplateGenerated"],
  ["Controlled Base URL Integration Design Closure", "phase597RecommendedSealed"],
]));

export const phase597Subphases = Object.freeze(phase597Group.subphases);
export const phase597SubphaseByKey = new Map(phase597Subphases.map((item, index) => [item.key, { ...item, index }]));

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
    sequenceEvidencePath: `apps/ai-gateway-service/evidence/${groupKey}a-t-controlled-base-url-integration-design.json`,
    packageScript: `verify:${groupKey}a-t-controlled-base-url-integration-design`,
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
    .replace(/Phase592 596/g, "phase592-596")
    .replace(/AI/g, "ai")
    .replace(/[^A-Za-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase();
}
