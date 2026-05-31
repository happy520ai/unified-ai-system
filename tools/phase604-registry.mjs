const letters = "abcdefghijklmnopqrst".split("");

export const phase604AllowedBlockers = Object.freeze([
  null,
  "final_user_confirmation_missing",
  "final_confirmation_invalid",
  "provider_call_not_authorized_for_one_shot",
  "model_provider_override_not_honored",
  "negative_control_timeout",
  "custom_provider_missing",
  "blocked_by_stale_context",
  "blocked_by_budget",
  "custom_provider_one_shot_failed",
  "custom_provider_one_shot_timeout",
]);

export const phase604SafetyBoundary = Object.freeze({
  oneShotOnly: true,
  customModelProviderRoute: true,
  maxRequests: 1,
  retryAttemptCount: 0,
  authJsonRead: false,
  authJsonTouched: false,
  authJsonCopied: false,
  authJsonWrittenToEvidence: false,
  rawSecretAccessed: false,
  secretValueExposed: false,
  rawWebhookAccessed: false,
  webhookValueExposed: false,
  rawBaseUrlValueExposed: false,
  codexConfigModified: false,
  codexBaseUrlModified: false,
  userCodexConfigModified: false,
  projectCodexConfigModified: false,
  persistentConfigWritePerformed: false,
  realConfigWritePerformed: false,
  chatModified: false,
  chatGatewayExecuteModified: false,
  deployExecuted: false,
  releaseExecuted: false,
  tagCreated: false,
  artifactUploaded: false,
  characterModuleRestored: false,
  workspaceCleanClaimed: false,
});

export const phase604Group = Object.freeze(group(604, "Codex Context Gateway Custom model_provider Negative-Control + Guarded One-Shot Test", [
  ["Custom Provider One Shot Scope Lock", "scopeDefined"],
  ["Phase603 Evidence Import", "phase603EvidenceImported"],
  ["Final Confirmation Loader", "finalConfirmationLoaderWorks"],
  ["Sanitized Config Structure Readiness", "configStructureReadinessChecked"],
  ["Existing Provider Route Selection", "existingProviderRouteSelectionWorks"],
  ["Bad Model Provider Negative Control Command Assembly", "negativeControlCommandAssembled"],
  ["Execute Bad Model Provider Negative Control", "negativeControlExecutionHandled"],
  ["Negative Control Result Classifier", "negativeControlResultClassified"],
  ["Context Pack Preflight Before One Shot", "contextPackMdExists"],
  ["Custom Provider One Shot Prompt Finalization", "oneShotPromptGenerated"],
  ["Custom Provider Command Assembly", "customProviderCommandAssembled"],
  ["Pre Execution Safety Gate", "preExecutionSafetyGateEvaluated"],
  ["Execute Custom Provider One Shot", "customProviderExecutionHandled"],
  ["Response Classification", "responseClassified"],
  ["Cleanup Rollback Verification", "cleanupRollbackVerified"],
  ["Mission Control Custom Provider Result Preview", "customProviderResultPreviewVisible"],
  ["Regression Against Phase592 603", "phase592603RegressionChecked"],
  ["Secret Product UI Regression", "secretProductUiRegressionPassed"],
  ["README AGENTS Custom Provider Result Update", "readmeAgentsPhase604UpdateWorks"],
  ["Custom Model Provider Guarded One Shot Closure", "phase604RecommendedSealed"],
]));

export const phase604Subphases = Object.freeze(phase604Group.subphases);
export const phase604SubphaseByKey = new Map(phase604Subphases.map((item, index) => [item.key, { ...item, index }]));

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
    sequenceEvidencePath: `apps/ai-gateway-service/evidence/${groupKey}a-t-custom-model-provider-guarded-one-shot-test.json`,
    packageScript: `verify:${groupKey}a-t-custom-model-provider-guarded-one-shot-test`,
  };
}

function slugify(value) {
  return value
    .replace(/\/|\+/g, " ")
    .replace(/README/g, "readme")
    .replace(/AGENTS/g, "agents")
    .replace(/Phase592 603/g, "phase592-603")
    .replace(/One Shot/g, "one-shot")
    .replace(/UI/g, "ui")
    .replace(/[^A-Za-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase();
}
