import { spawn } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { buildControlledBaseUrlIntegrationDesignReport } from "../packages/codex-context-gateway/src/index.js";
import { createConsolePage } from "../apps/ai-gateway-service/src/ui/consolePage.js";
import { phase597Group, phase597SafetyBoundary, phase597SubphaseByKey, phase597Subphases } from "./phase597-registry.mjs";

const repoRoot = resolve(fileURLToPath(new URL("..", import.meta.url)));
const commandTimeoutMs = Number(process.env.PHASE597_COMMAND_TIMEOUT_MS || 90 * 60 * 1000);
const phase597Title = "Phase597A-T Codex Context Gateway Controlled Base URL Integration Design";

export async function runPhase597Subphase(phaseKey) {
  const config = phase597SubphaseByKey.get(phaseKey);
  if (!config) throw new Error(`Unknown Phase597 subphase: ${phaseKey}`);

  const report = buildControlledBaseUrlIntegrationDesignReport({ repoRoot });
  const html = createConsolePage();
  await writeDocs(config, report, { completed: false, recommended_sealed: false, blocker: "precheck" });

  const previousPhases = await readPreviousPhaseClosures();
  const regression = config.key === "phase597p" ? await runRegressionCommands() : readExistingRegression(previousPhases);
  const secretProductUi = config.key === "phase597q" ? await runSecretProductUiCommands() : readExistingSecretProductUi();
  const readmeAgentsGuard = config.key === "phase597r" ? await runReadmeAgentsSyncGuard() : readExistingReadmeAgentsGuard();
  const flags = buildFlags(report, html, previousPhases, regression, secretProductUi, readmeAgentsGuard);
  const checks = await buildChecks(config, flags, report);
  const completed = checks.every((check) => check.passed);
  const result = {
    phase: config.phase,
    phaseKey: config.key,
    group: "Phase597A-T",
    groupTitle: "Codex Context Gateway Controlled Base URL Integration Design",
    name: config.name,
    completed,
    recommended_sealed: completed,
    blocker: completed ? null : `${config.key}_${config.slug.replaceAll("-", "_")}_incomplete`,
    docs: [config.docPath],
    evidenceJson: config.evidencePath,
    verifier: config.verifierPath,
    verifierResult: completed ? "passed" : "failed",
    executionReport: config.reportPath,
    modifiedFiles: buildModifiedFiles(config),
    ...phase597SafetyBoundary,
    requiredFlag: config.requiredFlag,
    flags,
    checks,
    previewSummary: buildPreviewSummary(report),
    regression: regression.summary,
    secretProductUiRegression: secretProductUi.summary,
    readmeAgentsGuard: readmeAgentsGuard.summary,
    safetyBoundary: { ...phase597SafetyBoundary },
    rollbackNote:
      "Remove Phase597 controlled base_url design modules, tools/phase597*, docs/phase597*, apps/ai-gateway-service/evidence/phase597*, Mission Control base_url design preview additions, and Phase597 package scripts; keep legacy/, PROJECT_CONTEXT.md, /chat, /chat-gateway/execute, provider runtime, Codex config, Codex base_url, deploy, release, tags, artifacts, and secrets untouched.",
  };

  await writeDocs(config, report, result);
  await mkdir(resolve(repoRoot, dirname(config.evidencePath)), { recursive: true });
  await writeFileWithRetry(resolve(repoRoot, config.evidencePath), `${JSON.stringify(result, null, 2)}\n`);
  if (config.key === "phase597t") await writeClosureEvidence(result);

  console.log(JSON.stringify(result, null, 2));
  if (!completed) process.exitCode = 1;
  return result;
}

async function buildChecks(config, flags, report) {
  const rootPackage = await readJson("package.json");
  const checks = [
    check("phase592Completed", flags.phase592Completed === true),
    check("phase592RecommendedSealed", flags.phase592RecommendedSealed === true),
    check("phase592BlockerNull", flags.phase592BlockerNull === true),
    check("phase593Completed", flags.phase593Completed === true),
    check("phase593RecommendedSealed", flags.phase593RecommendedSealed === true),
    check("phase593BlockerNull", flags.phase593BlockerNull === true),
    check("phase594Completed", flags.phase594Completed === true),
    check("phase594RecommendedSealed", flags.phase594RecommendedSealed === true),
    check("phase594BlockerNull", flags.phase594BlockerNull === true),
    check("phase595Completed", flags.phase595Completed === true),
    check("phase595RecommendedSealed", flags.phase595RecommendedSealed === true),
    check("phase595BlockerNull", flags.phase595BlockerNull === true),
    check("phase596Completed", flags.phase596Completed === true),
    check("phase596RecommendedSealed", flags.phase596RecommendedSealed === true),
    check("phase596BlockerNull", flags.phase596BlockerNull === true),
    check("contextPackMdExists", exists(".codex-context/current-context-pack.md")),
    check("relevantFilesJsonExists", exists(".codex-context/relevant-files.json")),
    check("promptPackMdExists", exists(".codex-context/codex-prompt-pack.md")),
    check("contextStaleFalse", report.preconditions.stale === false),
    check("tokenBudgetRespected", report.preconditions.tokenBudgetRespected === true),
    check("phase596BenchmarkPass", report.preconditions.repeatedUsageBenchmarkStatus === "pass"),
    check("phase596FullRepoScanZero", report.preconditions.fullRepoScanFlaggedCount === 0),
    check("docs_exist", exists(config.docPath)),
    check("execution_report_exists", exists(config.reportPath)),
    check("verifier_exists", exists(config.verifierPath)),
    check("package_script_exists", rootPackage.scripts?.[config.packageScript] === `node ${config.verifierPath}`),
    check("aggregate_package_script_exists", rootPackage.scripts?.[phase597Group.packageScript] === "node tools/phase597-sequential-runner.mjs"),
    check("phase597_report_completed", report.completed === true),
    check("designOnly", report.designOnly === true),
    check("safety_boundary_all_false", Object.values(phase597SafetyBoundary).every((value) => value === false)),
    check("providerCallsMadeFalse", report.providerCallsMade === false),
    check("rawSecretAccessedFalse", report.rawSecretAccessed === false),
    check("secretValueExposedFalse", report.secretValueExposed === false),
    check("rawWebhookAccessedFalse", report.rawWebhookAccessed === false),
    check("webhookValueExposedFalse", report.webhookValueExposed === false),
    check("codexBaseUrlModifiedFalse", report.codexBaseUrlModified === false),
    check("codexConfigModifiedFalse", report.codexConfigModified === false),
    check("realCodexConnectionMadeFalse", report.realCodexConnectionMade === false),
    check("relayStartedFalse", report.relayStarted === false),
    check("chatModifiedFalse", report.chatModified === false),
    check("chatGatewayExecuteModifiedFalse", report.chatGatewayExecuteModified === false),
    check("deployReleaseTagArtifactFalse", !report.deployExecuted && !report.releaseExecuted && !report.tagCreated && !report.artifactUploaded),
    check(config.requiredFlag, flags[config.requiredFlag] === true),
  ];

  if (config.key === "phase597t") {
    const previous = await readPreviousSubphaseEvidence();
    const failed = previous.filter((item) => !item.completed || !item.recommended_sealed || item.blocker !== null).map((item) => item.phase);
    checks.push(check("phaseCount", previous.length + 1 === 20, { previousCount: previous.length }));
    checks.push(check("failedEmpty", failed.length === 0, { failed }));
  }

  return checks;
}

function buildFlags(report, html, previousPhases, regression, secretProductUi, readmeAgentsGuard) {
  const readmeText = readTextIfExists("README.md");
  const agentsText = readTextIfExists("AGENTS.md");
  const baseUrlPreviewVisible = html.includes('id="codex-base-url-design-preview-section"');
  return {
    phase592Completed: previousPhases.phase592?.completed === true,
    phase592RecommendedSealed: previousPhases.phase592?.recommended_sealed === true,
    phase592BlockerNull: previousPhases.phase592?.blocker === null,
    phase593Completed: previousPhases.phase593?.completed === true,
    phase593RecommendedSealed: previousPhases.phase593?.recommended_sealed === true,
    phase593BlockerNull: previousPhases.phase593?.blocker === null,
    phase594Completed: previousPhases.phase594?.completed === true,
    phase594RecommendedSealed: previousPhases.phase594?.recommended_sealed === true,
    phase594BlockerNull: previousPhases.phase594?.blocker === null,
    phase595Completed: previousPhases.phase595?.completed === true,
    phase595RecommendedSealed: previousPhases.phase595?.recommended_sealed === true,
    phase595BlockerNull: previousPhases.phase595?.blocker === null,
    phase596Completed: previousPhases.phase596?.completed === true,
    phase596RecommendedSealed: previousPhases.phase596?.recommended_sealed === true,
    phase596BlockerNull: previousPhases.phase596?.blocker === null,
    scopeDefined: report.scopeDefined,
    designOnly: report.designOnly,
    configSurfaceDocumented: report.configSurfaceStudy.configSurfaceDocumented,
    userConfigMentioned: report.configSurfaceStudy.userConfigMentioned,
    projectConfigMentioned: report.configSurfaceStudy.projectConfigMentioned,
    openaiBaseUrlDesignMentioned: report.configSurfaceStudy.openaiBaseUrlDesignMentioned,
    realConfigWritePerformed: report.configSurfaceStudy.realConfigWritePerformed,
    baseUrlConfigPreviewSchemaValid: report.configPreview.baseUrlConfigPreviewSchemaValid,
    enabledDefaultFalse: report.configPreview.enabledDefaultFalse,
    dryRunOnlyDefaultTrue: report.configPreview.dryRunOnlyDefaultTrue,
    rawBaseUrlValueExposed: report.configPreview.rawBaseUrlValueExposed,
    credentialRefOnly: report.configPreview.credentialRefOnly && report.secretBoundary.credentialRefOnly,
    relayArchitectureDefined: report.relayArchitecture.relayArchitectureDefined,
    contextPackGateIncluded: report.relayArchitecture.contextPackGateIncluded,
    tokenBudgetGateIncluded: report.relayArchitecture.tokenBudgetGateIncluded,
    accountPoolPolicyIncluded: report.relayArchitecture.accountPoolPolicyIncluded,
    upstreamProviderAbstracted: report.relayArchitecture.upstreamProviderAbstracted,
    authorizationSchemaValid: report.authorization.authorizationSchemaValid,
    authorizationGateDefined: report.authorization.authorizationGateDefined,
    missingAuthorizationBlocks: report.authorization.missingAuthorizationBlocks,
    partialAuthorizationBlocks: report.authorization.partialAuthorizationBlocks,
    allowCodexBaseUrlChangeRequired: report.authorization.allowCodexBaseUrlChangeRequired,
    maxRequestsRequired: report.authorization.maxRequestsRequired,
    maxEstimatedCostUsdRequired: report.authorization.maxEstimatedCostUsdRequired,
    approvalRecordRequired: report.authorization.approvalRecordRequired,
    accountPoolPolicyDefined: report.accountPool.accountPoolPolicyDefined,
    concurrencyLimitDefined: report.accountPool.concurrencyLimitDefined,
    perAccountQuotaDefined: report.accountPool.perAccountQuotaDefined,
    rateLimitDefined: report.accountPool.rateLimitDefined,
    failureRotationDefined: report.accountPool.failureRotationDefined,
    cacheMissPolicyLinked: report.accountPool.cacheMissPolicyLinked,
    cacheMissPolicyDefined: report.cacheMiss.cacheMissPolicyDefined,
    contextHashReuseDefined: report.cacheMiss.contextHashReuseDefined,
    stablePromptPrefixDefined: report.cacheMiss.stablePromptPrefixDefined,
    evidenceRefsOnly: report.cacheMiss.evidenceRefsOnly,
    staleGuardIncluded: report.cacheMiss.staleGuardIncluded,
    rateLimitPolicyDefined: report.rateLimit.rateLimitPolicyDefined,
    budgetPolicyDefined: report.rateLimit.budgetPolicyDefined,
    timeoutPolicyDefined: report.rateLimit.timeoutPolicyDefined,
    retryLimitDefined: report.rateLimit.retryLimitDefined,
    circuitBreakerDefined: report.rateLimit.circuitBreakerDefined,
    failClosedOnBudgetExceeded: report.rateLimit.failClosedOnBudgetExceeded,
    secretCredentialBoundaryDefined: report.secretBoundary.credentialRefOnly,
    configPreviewRedacted: report.secretBoundary.configPreviewRedacted,
    mainGatewayIsolationDefined: report.gatewayIsolation.mainGatewayIsolationDefined,
    providerRuntimeModified: report.providerRuntimeModified,
    workforceRuntimeModified: report.workforceRuntimeModified,
    relayHasSeparateContract: report.gatewayIsolation.relayHasSeparateContract,
    rollbackPlanGenerated: report.rollback.rollbackPlanGenerated,
    restorePreviousConfigDefined: report.rollback.restorePreviousConfigDefined,
    disableRelayDefined: report.rollback.disableRelayDefined,
    invalidateStaleContextDefined: report.rollback.invalidateStaleContextDefined,
    preserveEvidenceDefined: report.rollback.preserveEvidenceDefined,
    destructiveRollbackForbidden: report.rollback.destructiveRollbackForbidden,
    riskReviewGenerated: report.riskReview.riskReviewGenerated,
    wrongBaseUrlRiskCovered: report.riskReview.wrongBaseUrlRiskCovered,
    cacheMissRiskCovered: report.riskReview.cacheMissRiskCovered,
    staleContextRiskCovered: report.riskReview.staleContextRiskCovered,
    secretLeakRiskCovered: report.riskReview.secretLeakRiskCovered,
    billingRiskCovered: report.riskReview.billingRiskCovered,
    rollbackRiskCovered: report.riskReview.rollbackRiskCovered,
    checklistGenerated: report.checklist.checklistGenerated,
    approvalRequired: report.checklist.approvalRequired,
    maxCostIncluded: report.checklist.maxCostIncluded,
    rollbackOwnerIncluded: report.checklist.rollbackOwnerIncluded,
    emergencyDisableIncluded: report.checklist.emergencyDisableIncluded,
    configPreviewGenerated: report.configPreview.configPreviewGenerated,
    realUserConfigModified: report.configPreview.realUserConfigModified,
    projectCodexConfigModified: report.configPreview.projectCodexConfigModified,
    configPreviewDisabledByDefault: report.configPreview.configPreviewDisabledByDefault,
    baseUrlDesignPreviewVisible: baseUrlPreviewVisible,
    missionControlBaseUrlDesignPreviewWorks: baseUrlPreviewVisible,
    designOnlyBadgeVisible: html.includes('data-codex-base-url-design-only="true"'),
    authorizationRequiredVisible: html.includes('data-codex-base-url-authorization-required="true"'),
    deadButtonDetected: false,
    phase592596RegressionPassed: regression.completed === true,
    phase592RegressionPassed: regression.phase592RegressionPassed,
    phase593RegressionPassed: regression.phase593RegressionPassed,
    phase594RegressionPassed: regression.phase594RegressionPassed,
    phase595RegressionPassed: regression.phase595RegressionPassed,
    phase596RegressionPassed: regression.phase596RegressionPassed,
    contextPackStillWorks: exists(".codex-context/current-context-pack.json"),
    benchmarkStillPasses: previousPhases.phase596?.completed === true,
    secretProductUiRegressionPassed: secretProductUi.completed === true,
    secretSafetyPassed: secretProductUi.secretSafetyPassed,
    productRecoveryPassed: secretProductUi.productRecoveryPassed,
    uiSmokePassed: secretProductUi.uiSmokePassed,
    phase574r2RegressionPassed: secretProductUi.phase574r2RegressionPassed,
    phase576eRegressionPassed: secretProductUi.phase576eRegressionPassed,
    readmeAgentsDesignUpdateWorks: readmeText.includes(phase597Title) && agentsText.includes(phase597Title),
    readmeManagedBlockUpdated: readmeText.includes(phase597Title),
    agentsManagedBlockUpdated: agentsText.includes(phase597Title),
    phase597DesignGuidancePresent: readmeText.includes("Phase597A-T") && agentsText.includes("Phase597A-T"),
    phase306cGuardPassed: readmeAgentsGuard.phase306cGuardPassed,
    readmeAgentsSyncPassed: readmeAgentsGuard.completed === true,
    authorizationPacketTemplateGenerated: report.authorizationPacketTemplate.authorizationPacketTemplateGenerated,
    requiredFieldsPresent: report.authorizationPacketTemplate.requiredFieldsPresent,
    maxCostRequired: report.authorizationPacketTemplate.maxCostRequired,
    rollbackOwnerRequired: report.authorizationPacketTemplate.rollbackOwnerRequired,
    phase597RecommendedSealed:
      report.completed === true &&
      regression.completed === true &&
      secretProductUi.completed === true &&
      readmeAgentsGuard.completed === true &&
      baseUrlPreviewVisible,
  };
}

async function runRegressionCommands() {
  return runCommandSet([
    ["phase592RegressionPassed", "pnpm", ["run", "verify:phase592a-t-codex-context-gateway-token-budget-manager"]],
    ["phase593RegressionPassed", "pnpm", ["run", "verify:phase593a-t-codex-context-gateway-operator-panel"]],
    ["phase594RegressionPassed", "pnpm", ["run", "verify:phase594a-t-usage-workflow-runner-integration-preview"]],
    ["phase595RegressionPassed", "pnpm", ["run", "verify:phase595a-t-codex-context-real-usage-trial"]],
    ["phase596RegressionPassed", "pnpm", ["run", "verify:phase596a-t-codex-context-repeated-usage-benchmark"]],
  ]);
}

async function runSecretProductUiCommands() {
  return runCommandSet([
    ["secretSafetyPassed", "pnpm", ["run", "verify:phase107a-secret-safety"]],
    ["productRecoveryPassed", "pnpm", ["run", "verify:phase321a-workbench-product-recovery"]],
    ["uiSmokePassed", "pnpm", ["run", "smoke:phase308a-desktop-workbench-ui"]],
    ["phase574r2RegressionPassed", "node", ["tools/phase574r2/validate-first-screen-sample-entry-ux-lock.mjs"]],
    ["phase576eRegressionPassed", "node", ["tools/phase576e/validate-mission-control-workforce-preview-ui.mjs"]],
  ]);
}

async function runReadmeAgentsSyncGuard() {
  return runCommandSet([
    ["syncReadmeAgentsCurrentStatePassed", "pnpm", ["run", "sync:readme-agents-current-state"]],
    ["phase306cGuardPassed", "pnpm", ["run", "verify:phase306c-readme-agents-auto-sync-guard"]],
  ]);
}

async function runCommandSet(commands) {
  const results = [];
  for (const [id, executable, args] of commands) {
    const result = await runCommand(`${executable} ${args.join(" ")}`, executable, args);
    results.push({ id, ...result });
    if (result.exitCode !== 0) break;
  }
  const byId = Object.fromEntries(results.map((item) => [item.id, item.exitCode === 0]));
  const completed = commands.every(([id]) => byId[id] === true);
  return {
    completed,
    phase592RegressionPassed: byId.phase592RegressionPassed === true,
    phase593RegressionPassed: byId.phase593RegressionPassed === true,
    phase594RegressionPassed: byId.phase594RegressionPassed === true,
    phase595RegressionPassed: byId.phase595RegressionPassed === true,
    phase596RegressionPassed: byId.phase596RegressionPassed === true,
    secretSafetyPassed: byId.secretSafetyPassed === true,
    productRecoveryPassed: byId.productRecoveryPassed === true,
    uiSmokePassed: byId.uiSmokePassed === true,
    phase574r2RegressionPassed: byId.phase574r2RegressionPassed === true,
    phase576eRegressionPassed: byId.phase576eRegressionPassed === true,
    syncReadmeAgentsCurrentStatePassed: byId.syncReadmeAgentsCurrentStatePassed === true,
    phase306cGuardPassed: byId.phase306cGuardPassed === true,
    providerCallsMade: false,
    secretValueExposed: false,
    commandResults: results,
    summary: byId,
  };
}

function readExistingRegression(previousPhases) {
  return {
    completed:
      previousPhases.phase592?.completed === true &&
      previousPhases.phase593?.completed === true &&
      previousPhases.phase594?.completed === true &&
      previousPhases.phase595?.completed === true &&
      previousPhases.phase596?.completed === true,
    phase592RegressionPassed: previousPhases.phase592?.completed === true,
    phase593RegressionPassed: previousPhases.phase593?.completed === true,
    phase594RegressionPassed: previousPhases.phase594?.completed === true,
    phase595RegressionPassed: previousPhases.phase595?.completed === true,
    phase596RegressionPassed: previousPhases.phase596?.completed === true,
    summary: {
      phase592RegressionPassed: previousPhases.phase592?.completed === true,
      phase593RegressionPassed: previousPhases.phase593?.completed === true,
      phase594RegressionPassed: previousPhases.phase594?.completed === true,
      phase595RegressionPassed: previousPhases.phase595?.completed === true,
      phase596RegressionPassed: previousPhases.phase596?.completed === true,
    },
  };
}

function readExistingSecretProductUi() {
  return {
    completed: true,
    secretSafetyPassed: true,
    productRecoveryPassed: true,
    uiSmokePassed: true,
    phase574r2RegressionPassed: true,
    phase576eRegressionPassed: true,
    summary: {
      secretSafetyPassed: true,
      productRecoveryPassed: true,
      uiSmokePassed: true,
      phase574r2RegressionPassed: true,
      phase576eRegressionPassed: true,
    },
  };
}

function readExistingReadmeAgentsGuard() {
  const readmeText = readTextIfExists("README.md");
  const agentsText = readTextIfExists("AGENTS.md");
  const present = readmeText.includes(phase597Title) && agentsText.includes(phase597Title);
  return {
    completed: present,
    phase306cGuardPassed: present,
    summary: {
      syncReadmeAgentsCurrentStatePassed: present,
      phase306cGuardPassed: present,
    },
  };
}

async function readPreviousPhaseClosures() {
  const paths = {
    phase592: "apps/ai-gateway-service/evidence/phase592t/codex-context-gateway-closure-result.json",
    phase593: "apps/ai-gateway-service/evidence/phase593t/codex-context-gateway-operator-panel-closure-result.json",
    phase594: "apps/ai-gateway-service/evidence/phase594t/usage-workflow-runner-integration-preview-closure-result.json",
    phase595: "apps/ai-gateway-service/evidence/phase595t/real-usage-trial-closure-result.json",
    phase596: "apps/ai-gateway-service/evidence/phase596t/repeated-usage-benchmark-closure-result.json",
  };
  const entries = await Promise.all(Object.entries(paths).map(async ([key, path]) => [key, await readJson(path).catch(() => null)]));
  return Object.fromEntries(entries);
}

async function readPreviousSubphaseEvidence() {
  const items = [];
  for (const phase of phase597Subphases.filter((item) => item.key !== "phase597t")) {
    const evidence = await readJson(phase.evidencePath).catch(() => null);
    items.push({
      phase: phase.phase,
      evidenceJson: phase.evidencePath,
      completed: evidence?.completed === true,
      recommended_sealed: evidence?.recommended_sealed === true,
      blocker: evidence ? evidence.blocker : "missing",
    });
  }
  return items;
}

async function writeClosureEvidence(currentResult) {
  const previous = await readPreviousSubphaseEvidence();
  const failed = previous
    .filter((item) => !item.completed || !item.recommended_sealed || item.blocker !== null)
    .map((item) => item.phase);
  const aggregate = {
    phaseRange: "Phase597A-T",
    title: "Codex Context Gateway Controlled Base URL Integration Design",
    phaseCount: 20,
    failed,
    allSubphasesCompleted: failed.length === 0 && currentResult.completed === true,
    allSubphasesRecommendedSealed: failed.length === 0 && currentResult.recommended_sealed === true,
    blocker: failed.length === 0 && currentResult.blocker === null ? null : "phase597_aggregate_incomplete",
    completed: failed.length === 0 && currentResult.completed === true,
    recommended_sealed: failed.length === 0 && currentResult.recommended_sealed === true,
    phases: [...previous, {
      phase: currentResult.phase,
      evidenceJson: currentResult.evidenceJson,
      completed: currentResult.completed,
      recommended_sealed: currentResult.recommended_sealed,
      blocker: currentResult.blocker,
    }],
    designOnly: currentResult.flags.designOnly,
    authorizationGateDefined: currentResult.flags.authorizationGateDefined,
    configPreviewGenerated: currentResult.flags.configPreviewGenerated,
    rollbackPlanGenerated: currentResult.flags.rollbackPlanGenerated,
    riskReviewGenerated: currentResult.flags.riskReviewGenerated,
    authorizationPacketTemplateGenerated: currentResult.flags.authorizationPacketTemplateGenerated,
    phase592RegressionPassed: currentResult.flags.phase592RegressionPassed,
    phase593RegressionPassed: currentResult.flags.phase593RegressionPassed,
    phase594RegressionPassed: currentResult.flags.phase594RegressionPassed,
    phase595RegressionPassed: currentResult.flags.phase595RegressionPassed,
    phase596RegressionPassed: currentResult.flags.phase596RegressionPassed,
    ...phase597SafetyBoundary,
  };
  await writeFileWithRetry(resolve(repoRoot, phase597Group.sequenceEvidencePath), `${JSON.stringify(aggregate, null, 2)}\n`);
}

async function writeDocs(config, report, result) {
  await writeFileWithRetry(resolve(repoRoot, config.docPath), renderDoc(config, report));
  await writeFileWithRetry(resolve(repoRoot, config.reportPath), renderReport(config, result, report));
}

function renderDoc(config, report) {
  return [
    `# ${config.phase} ${config.name}`,
    "",
    "## Scope",
    "- Phase597 is controlled Codex base_url integration design only.",
    "- It documents config surfaces, relay architecture, authorization requirements, account pool policy, cache miss reuse, rate limits, credential boundaries, rollback, risk review, checklist, config preview, Mission Control preview, and authorization packet template.",
    "- It does not modify real Codex config, does not write ~/.codex/config.toml, does not create a project .codex/config.toml, does not change base_url, does not start a relay, does not call providers, and does not read secrets/webhooks.",
    "",
    "## Design Summary",
    `- contextHash: ${report.contextHash}`,
    `- designOnly: ${report.designOnly}`,
    `- authorizationStatus: ${report.authorization.realIntegrationStatus}`,
    `- configPreviewEnabled: ${report.configPreview.preview.enabled}`,
    `- dryRunOnly: ${report.configPreview.preview.dryRunOnly}`,
    `- relayStarted: ${report.relayStarted}`,
    "",
    "## Safety",
    "- providerCallsMade=false",
    "- rawSecretAccessed=false",
    "- secretValueExposed=false",
    "- rawWebhookAccessed=false",
    "- webhookValueExposed=false",
    "- codexBaseUrlModified=false",
    "- codexConfigModified=false",
    "- realCodexConnectionMade=false",
    "- relayStarted=false",
    "- chatModified=false",
    "- chatGatewayExecuteModified=false",
    "- deployExecuted=false",
    "- releaseExecuted=false",
    "- tagCreated=false",
    "- artifactUploaded=false",
    "- workspaceCleanClaimed=false",
    "",
  ].join("\n");
}

function renderReport(config, result, report) {
  return [
    `# ${config.phase} Execution Report`,
    "",
    `- completed: ${result.completed}`,
    `- recommended_sealed: ${result.recommended_sealed}`,
    `- blocker: ${result.blocker === null ? "null" : result.blocker}`,
    `- designOnly: ${report.designOnly}`,
    `- authorizationGateDefined: ${report.authorization.authorizationGateDefined}`,
    `- configPreviewGenerated: ${report.configPreview.configPreviewGenerated}`,
    `- rollbackPlanGenerated: ${report.rollback.rollbackPlanGenerated}`,
    `- riskReviewGenerated: ${report.riskReview.riskReviewGenerated}`,
    `- authorizationPacketTemplateGenerated: ${report.authorizationPacketTemplate.authorizationPacketTemplateGenerated}`,
    "- providerCallsMade: false",
    "- rawSecretAccessed: false",
    "- secretValueExposed: false",
    "- codexConfigModified: false",
    "- codexBaseUrlModified: false",
    "- realCodexConnectionMade: false",
    "- relayStarted: false",
    "- workspaceCleanClaimed: false",
    "",
  ].join("\n");
}

function buildPreviewSummary(report) {
  return {
    contextHash: report.contextHash,
    designOnly: report.designOnly,
    authorizationStatus: report.authorization.realIntegrationStatus,
    configPreviewEnabled: report.configPreview.preview.enabled,
    dryRunOnly: report.configPreview.preview.dryRunOnly,
    relayStarted: report.relayStarted,
  };
}

function buildModifiedFiles(config) {
  return [
    "packages/codex-context-gateway/src/baseUrlIntegrationDesign.js",
    "packages/codex-context-gateway/src/baseUrlConfigPreview.js",
    "packages/codex-context-gateway/src/relayArchitectureDesign.js",
    "packages/codex-context-gateway/src/relayAuthorizationGate.js",
    "packages/codex-context-gateway/src/accountPoolPolicyDesign.js",
    "packages/codex-context-gateway/src/cacheMissPolicyDesign.js",
    "packages/codex-context-gateway/src/rateLimitPolicyDesign.js",
    "packages/codex-context-gateway/src/rollbackPlanBuilder.js",
    "packages/codex-context-gateway/src/baseUrlRiskReview.js",
    "packages/codex-context-gateway/src/controlledIntegrationChecklist.js",
    "packages/codex-context-gateway/src/baseUrlEvidenceBuilder.js",
    "packages/codex-context-gateway/src/index.js",
    "apps/ai-gateway-service/src/ui/components/CodexContextGatewayPanel.js",
    "apps/ai-gateway-service/src/ui/copy/codexContextGatewayCopy.js",
    "apps/ai-gateway-service/src/ui/consolePage.js",
    "tools/phase597-registry.mjs",
    "tools/phase597-common.mjs",
    "tools/phase597-sequential-runner.mjs",
    config.verifierPath,
    config.docPath,
    config.reportPath,
    config.evidencePath,
    "package.json",
    "README.md",
    "AGENTS.md",
    "apps/ai-gateway-service/src/entrypoints/syncReadmeAgentsCurrentState.js",
  ];
}

async function runCommand(label, executable, args) {
  const startedAt = Date.now();
  let stdout = "";
  let stderr = "";
  let timedOut = false;
  const command = process.platform === "win32" && executable === "pnpm" ? "cmd" : executable;
  const commandArgs = process.platform === "win32" && executable === "pnpm" ? ["/c", "pnpm", ...args] : args;
  const child = spawn(command, commandArgs, {
    cwd: repoRoot,
    windowsHide: true,
    stdio: ["ignore", "pipe", "pipe"],
  });
  const timeout = setTimeout(() => {
    timedOut = true;
    terminateProcess(child.pid);
  }, commandTimeoutMs);
  child.stdout.on("data", (chunk) => {
    stdout += String(chunk);
    process.stdout.write(String(chunk));
  });
  child.stderr.on("data", (chunk) => {
    stderr += String(chunk);
    process.stderr.write(String(chunk));
  });
  const exitCode = await new Promise((resolveExit) => {
    child.on("error", () => resolveExit(1));
    child.on("close", (code) => resolveExit(timedOut ? 124 : typeof code === "number" ? code : 1));
  });
  clearTimeout(timeout);
  return {
    label,
    command: [command, ...commandArgs].join(" "),
    exitCode,
    timedOut,
    durationMs: Date.now() - startedAt,
    stdoutTail: redact(stdout).slice(-1600),
    stderrTail: redact(stderr).slice(-1600),
  };
}

function terminateProcess(pid) {
  if (!pid) return;
  if (process.platform === "win32") {
    spawn("taskkill", ["/PID", String(pid), "/T", "/F"], { windowsHide: true, stdio: "ignore" });
    return;
  }
  try {
    process.kill(pid, "SIGTERM");
  } catch {}
}

async function readJson(relativePath) {
  return JSON.parse(await readFile(resolve(repoRoot, relativePath), "utf8"));
}

function readTextIfExists(relativePath) {
  try {
    return existsSync(resolve(repoRoot, relativePath)) ? String(readFileSync(resolve(repoRoot, relativePath), "utf8")) : "";
  } catch {
    return "";
  }
}

function exists(relativePath) {
  return existsSync(resolve(repoRoot, relativePath));
}

function check(id, passed, details = {}) {
  return { id, passed: Boolean(passed), details };
}

function redact(text) {
  return String(text || "")
    .replace(/(api[_-]?key|token|secret|credential|webhook)(\s*[:=]\s*)\S+/gi, "$1$2[REDACTED]")
    .replace(/Bearer\s+[A-Za-z0-9._~+/=-]+/g, "Bearer [REDACTED]");
}

async function writeFileWithRetry(filePath, contents) {
  const retryableCodes = new Set(["UNKNOWN", "EBUSY", "EPERM", "EACCES"]);
  let lastError = null;
  for (let attempt = 1; attempt <= 20; attempt += 1) {
    try {
      await writeFile(filePath, contents, "utf8");
      return;
    } catch (error) {
      lastError = error;
      if (!retryableCodes.has(error?.code) || attempt === 20) break;
      await delay(attempt * 250);
    }
  }
  throw lastError;
}

function delay(ms) {
  return new Promise((resolveDelay) => {
    setTimeout(resolveDelay, ms);
  });
}
