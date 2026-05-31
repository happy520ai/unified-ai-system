import {
  docsPath,
  examplesPath,
  phase1202Boundary,
  readJsonIfExists,
  readTextIfExists,
  reportPath,
  resultEvidencePath,
  schemaModulePath,
  validationEvidencePath,
  writeJson,
} from "./phase1202-common.mjs";

const result = await readJsonIfExists(resultEvidencePath, null);
const moduleText = await readTextIfExists(schemaModulePath, "");
const docsText = await readTextIfExists(docsPath, "");
const examples = await readJsonIfExists(examplesPath, null);
const reportText = await readTextIfExists(reportPath, "");
const packageJson = JSON.parse(await readTextIfExists(new URL("../../package.json", import.meta.url), "{}"));
const scripts = packageJson.scripts || {};

const scenarioResults = Array.isArray(result?.scenarioResults) ? result.scenarioResults : [];
const scenarioById = new Map(scenarioResults.map((scenario) => [scenario.scenarioId, scenario]));

const checks = {
  schemaGenerated: result?.schemaGenerated === true,
  syntheticExamplesGenerated: result?.syntheticExamplesGenerated === true,
  scenarioCountAtLeastFive: Number(result?.scenarioCount) >= 5,
  positiveSourcesPresent: scenarioResults.every((scenario) => scenario.schema?.sources?.positiveSources?.length > 0),
  negativeSourcesPresent: scenarioResults.every((scenario) => scenario.schema?.sources?.negativeSources?.length > 0),
  constraintSourcesPresent: scenarioResults.every((scenario) => scenario.schema?.sources?.constraintSources?.length > 0),
  contextSourcesPresent: scenarioResults.every((scenario) => scenario.schema?.sources?.contextSources?.length > 0),
  readoutTargetsPresent: scenarioResults.every((scenario) => {
    const targets = scenario.schema?.readoutTargets || {};
    return Array.isArray(targets.capabilityCandidates)
      && Array.isArray(targets.phaseCandidates)
      && Array.isArray(targets.executionPathCandidates);
  }),
  providerCallsMadeFalse: result?.providerCallsMade === false,
  secretReadFalse: result?.secretRead === false,
  secretValueExposedFalse: result?.secretValueExposed === false,
  gloveDownloadedFalse: result?.gloveDownloaded === false,
  chatModifiedFalse: result?.chatModified === false,
  chatGatewayExecuteModifiedFalse: result?.chatGatewayExecuteModified === false,
  legacyModifiedFalse: result?.legacyModified === false,
  projectContextModifiedFalse: result?.projectContextModified === false,
  deployExecutedFalse: result?.deployExecuted === false,
  releaseExecutedFalse: result?.releaseExecuted === false,
  tagCreatedFalse: result?.tagCreated === false,
  artifactUploadedFalse: result?.artifactUploaded === false,
  workspaceCleanClaimedFalse: result?.workspaceCleanClaimed === false,
  realSemanticValidationClaimedFalse: result?.realSemanticValidationClaimed === false,
  syntheticOnlyTrue: result?.syntheticOnly === true,
  highRiskProviderScenarioBlocked: scenarioById.get("scenario-2-provider-block")?.schema?.safetyClassification?.blockedReasons?.includes("unauthorized_provider_call") === true,
  secretReadScenarioBlocked: scenarioById.get("scenario-3-secret-block")?.schema?.safetyClassification?.blockedReasons?.includes("secret_read_requested") === true,
  chatGatewayExecuteScenarioRequiresApproval: scenarioById.get("scenario-5-chat-gateway-approval")?.schema?.safetyClassification?.requiresHumanApproval === true
    && scenarioById.get("scenario-5-chat-gateway-approval")?.schema?.boundary?.chatGatewayExecuteIntegrationAllowed === false
    && scenarioById.get("scenario-5-chat-gateway-approval")?.schema?.safetyClassification?.blockedReasons?.includes("chat_gateway_execute_integration_requested") === true,
  scenario1LowRiskNoApproval: scenarioById.get("scenario-1-ui-preview")?.schema?.safetyClassification?.riskLevel === "low"
    && scenarioById.get("scenario-1-ui-preview")?.schema?.safetyClassification?.requiresHumanApproval === false,
  scenario4PhaseCandidate: scenarioById.get("scenario-4-phase-candidate")?.schema?.readoutTargets?.phaseCandidates?.includes("Phase1203") === true
    && scenarioById.get("scenario-4-phase-candidate")?.schema?.readoutTargets?.capabilityCandidates?.includes("capability_candidate_readout_schema") === true,
  moduleExportsRequiredApi: [
    "buildTaskConceptSourceSchema",
    "validateTaskConceptSourceSchema",
    "createSyntheticTaskConceptExamples",
    "classifyTaskConceptSourceBoundaries",
  ].every((name) => moduleText.includes(`export function ${name}`)),
  docsDescribeBoundaries: [
    "不调用 Provider",
    "不读 secret",
    "不改 /chat",
    "不改 /chat-gateway/execute",
    "不下载 GloVe",
    "不声明真实语义智能",
    "Phase1203",
    "Phase1204",
    "Phase1205",
  ].every((marker) => docsText.includes(marker)),
  examplesDocGenerated: Array.isArray(examples?.examples) && examples.examples.length >= 5,
  executionReportGenerated: [
    "A. 是否完成",
    "B. 是否推荐封板",
    "M. 下一步建议",
  ].every((marker) => reportText.includes(marker)),
  packageRunScriptExists: scripts["run:phase1202-taiji-beidou-task-concept-source-schema"] === "node tools/phase1202/run-task-concept-source-schema.mjs",
  packageVerifyScriptExists: scripts["verify:phase1202-taiji-beidou-task-concept-source-schema"] === "node tools/phase1202/validate-task-concept-source-schema.mjs",
  packageSmokeScriptExists: scripts["smoke:phase1202-taiji-beidou-task-concept-source-schema:dry-run"] === "node tools/phase1202/run-task-concept-source-schema.mjs && node tools/phase1202/validate-task-concept-source-schema.mjs",
  completedTrue: result?.completed === true,
  recommendedSealedTrue: result?.recommended_sealed === true,
  blockerNull: result?.blocker === null,
  boundaryMatches: matchesBoundary(result),
};

const blocker = findBlocker(checks);
const validation = {
  phase: "Phase1202",
  title: "Taiji / Beidou Task Concept Source Schema",
  completed: blocker === null,
  recommended_sealed: blocker === null,
  blocker,
  checks: {
    schemaGenerated: checks.schemaGenerated,
    syntheticExamplesGenerated: checks.syntheticExamplesGenerated,
    scenarioCount: result?.scenarioCount ?? 0,
    positiveSourcesPresent: checks.positiveSourcesPresent,
    negativeSourcesPresent: checks.negativeSourcesPresent,
    constraintSourcesPresent: checks.constraintSourcesPresent,
    contextSourcesPresent: checks.contextSourcesPresent,
    readoutTargetsPresent: checks.readoutTargetsPresent,
    providerCallsMade: result?.providerCallsMade ?? null,
    secretRead: result?.secretRead ?? null,
    secretValueExposed: result?.secretValueExposed ?? null,
    gloveDownloaded: result?.gloveDownloaded ?? null,
    chatModified: result?.chatModified ?? null,
    chatGatewayExecuteModified: result?.chatGatewayExecuteModified ?? null,
    legacyModified: result?.legacyModified ?? null,
    projectContextModified: result?.projectContextModified ?? null,
    deployExecuted: result?.deployExecuted ?? null,
    releaseExecuted: result?.releaseExecuted ?? null,
    tagCreated: result?.tagCreated ?? null,
    artifactUploaded: result?.artifactUploaded ?? null,
    workspaceCleanClaimed: result?.workspaceCleanClaimed ?? null,
    realSemanticValidationClaimed: result?.realSemanticValidationClaimed ?? null,
    syntheticOnly: result?.syntheticOnly ?? null,
    highRiskProviderScenarioBlocked: checks.highRiskProviderScenarioBlocked,
    secretReadScenarioBlocked: checks.secretReadScenarioBlocked,
    chatGatewayExecuteScenarioRequiresApproval: checks.chatGatewayExecuteScenarioRequiresApproval,
  },
  allChecks: checks,
};

await writeJson(validationEvidencePath, validation);
console.log(JSON.stringify({
  phase: validation.phase,
  completed: validation.completed,
  recommended_sealed: validation.recommended_sealed,
  blocker: validation.blocker,
  scenarioCount: validation.checks.scenarioCount,
}, null, 2));

if (blocker) {
  process.exitCode = 1;
}

function matchesBoundary(evidence) {
  if (!evidence) return false;
  const boundary = phase1202Boundary();
  return Object.entries(boundary).every(([key, expected]) => evidence[key] === expected);
}

function findBlocker(checks) {
  for (const [key, value] of Object.entries(checks)) {
    if (value !== true) return key;
  }
  return null;
}
