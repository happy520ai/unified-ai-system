const letters = "abcdefghijklmnopqrst".split("");

export const phase602AllowedBlockers = Object.freeze([
  null,
  "final_user_confirmation_missing",
  "provider_call_not_authorized_for_one_shot",
  "phase601_required",
  "base_url_env_missing",
  "blocked_by_stale_context",
  "blocked_by_budget",
  "one_shot_test_failed",
  "one_shot_test_timeout",
]);

export const phase602SafetyBoundary = Object.freeze({
  oneShotOnly: true,
  maxRequests: 1,
  retryAttemptCount: 0,
  sessionOverrideUsed: true,
  persistentConfigWriteDetected: false,
  userCodexConfigModified: false,
  projectCodexConfigModified: false,
  realConfigWritePerformed: false,
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

export const phase602Group = Object.freeze(group(602, "Codex Context Gateway Guarded Real Base URL One-Shot Test", [
  ["One Shot Execution Scope Lock", "scopeDefined"],
  ["Phase600 Phase601 Readiness Import", "phase600ReadinessImported"],
  ["Final User Confirmation Loader", "finalConfirmationLoaderWorks"],
  ["Environment Relay Base URL Precheck", "relayBaseUrlEnvChecked"],
  ["Context Pack Preflight Before Real Test", "contextPackMdExists"],
  ["Freshness Token Budget Precheck", "staleFalseRequired"],
  ["One Shot Prompt Finalization", "oneShotPromptGenerated"],
  ["One Shot Command Assembly", "commandAssembled"],
  ["Pre Execution Safety Gate", "preExecutionSafetyGateEvaluated"],
  ["Execute One Shot Guarded Test", "oneShotExecutionHandled"],
  ["Response Classification", "responseClassified"],
  ["Immediate Rollback Cleanup", "cleanupExecuted"],
  ["Emergency Disable Readiness Verification", "emergencyDisableReady"],
  ["Evidence Ledger", "evidenceLedgerGenerated"],
  ["Mission Control One Shot Result Preview", "oneShotResultPreviewVisible"],
  ["Regression Against Phase592 601", "phase592601RegressionChecked"],
  ["Secret Product UI Regression", "secretProductUiRegressionPassed"],
  ["README AGENTS One Shot Result Update", "readmeAgentsPhase602UpdateWorks"],
  ["Next Phase Recommendation", "nextPhaseRecommendationGenerated"],
  ["Guarded Real Base URL One Shot Test Closure", "phase602RecommendedSealed"],
]));

export const phase602Subphases = Object.freeze(phase602Group.subphases);
export const phase602SubphaseByKey = new Map(phase602Subphases.map((item, index) => [item.key, { ...item, index }]));

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
    sequenceEvidencePath: `apps/ai-gateway-service/evidence/${groupKey}a-t-guarded-real-base-url-one-shot-test.json`,
    packageScript: `verify:${groupKey}a-t-guarded-real-base-url-one-shot-test`,
  };
}

function slugify(value) {
  return value
    .replace(/\/|\+/g, " ")
    .replace(/URL/g, "url")
    .replace(/README/g, "readme")
    .replace(/AGENTS/g, "agents")
    .replace(/Phase600 Phase601/g, "phase600-phase601")
    .replace(/Phase592 601/g, "phase592-601")
    .replace(/UI/g, "ui")
    .replace(/[^A-Za-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase();
}
