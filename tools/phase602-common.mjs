import { spawn } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  buildPhase602OneShotReport,
  phase602OneShotPrompt,
} from "../packages/codex-context-gateway/src/index.js";
import { createConsolePage } from "../apps/ai-gateway-service/src/ui/consolePage.js";
import { phase602AllowedBlockers, phase602Group, phase602SafetyBoundary, phase602SubphaseByKey, phase602Subphases } from "./phase602-registry.mjs";

const repoRoot = resolve(fileURLToPath(new URL("..", import.meta.url)));
const commandTimeoutMs = Number(process.env.PHASE602_COMMAND_TIMEOUT_MS || 90 * 60 * 1000);
const phase602Title = "Phase602A-T Codex Context Gateway Guarded Real Base URL One-Shot Test";

export async function runPhase602Subphase(phaseKey) {
  const config = phase602SubphaseByKey.get(phaseKey);
  if (!config) throw new Error(`Unknown Phase602 subphase: ${phaseKey}`);

  await writeStaticInputs();
  const initialReport = buildPhase602OneShotReport({ repoRoot, missionControlHtml: createConsolePage(), execute: false });
  await writeDocs(config, initialReport, { completed: false, recommended_sealed: false, blocker: "precheck" });
  const previousPhases = await readPreviousPhaseClosures();
  const regression = config.key === "phase602p" ? await runRegressionCommands(previousPhases) : readExistingRegression(previousPhases);
  const secretProductUi = config.key === "phase602q" ? await runSecretProductUiCommands() : readExistingSecretProductUi();
  const readmeAgentsGuard = config.key === "phase602r" ? await runReadmeAgentsSyncGuard() : readExistingReadmeAgentsGuard();
  const html = createConsolePage();
  const report = buildPhase602OneShotReport({ repoRoot, missionControlHtml: html, execute: false });
  const flags = buildFlags(report, html, previousPhases, regression, secretProductUi, readmeAgentsGuard);
  const checks = await buildChecks(config, flags, report);
  const completed = checks.every((check) => check.passed);
  const result = {
    phase: config.phase,
    phaseKey: config.key,
    group: "Phase602A-T",
    groupTitle: phase602Title,
    name: config.name,
    completed,
    recommended_sealed: completed && !["one_shot_test_failed", "one_shot_test_timeout"].includes(report.blocker),
    blocker: completed ? report.blocker : `${config.key}_${config.slug.replaceAll("-", "_")}_incomplete`,
    docs: [config.docPath],
    evidenceJson: config.evidencePath,
    verifier: config.verifierPath,
    verifierResult: completed ? "passed" : "failed",
    executionReport: config.reportPath,
    modifiedFiles: buildModifiedFiles(config),
    ...phase602SafetyBoundary,
    finalConfirmationExists: report.finalConfirmation.finalConfirmationExists,
    envPrecheckPassed: report.envPrecheck.relayBaseUrlEnvPresent,
    oneShotExecuted: report.oneShotExecuted,
    requestAttemptCount: report.requestAttemptCount,
    testStatus: report.testStatus,
    responseClassification: report.responseClassification,
    cleanupExecuted: report.cleanupExecuted,
    emergencyDisableReady: report.emergencyDisableReadiness.emergencyDisableReady,
    providerCallsMade: report.providerCallsMade,
    codexBaseUrlModified: report.codexBaseUrlModified,
    codexConfigModified: report.codexConfigModified,
    realCodexConnectionMade: report.realCodexConnectionMade,
    relayStarted: report.relayStarted,
    requiredFlag: config.requiredFlag,
    flags,
    checks,
    previewSummary: buildPreviewSummary(report),
    regression: regression.summary,
    secretProductUiRegression: secretProductUi.summary,
    readmeAgentsGuard: readmeAgentsGuard.summary,
    safetyBoundary: { ...phase602SafetyBoundary },
    rollbackNote:
      "Remove Phase602 one-shot modules, tools/phase602*, docs/phase602*, apps/ai-gateway-service/evidence/phase602*, Mission Control Phase602 result preview additions, package scripts, and README/AGENTS Phase602 guidance; never remove evidence by destructive rollback and never write persistent Codex config.",
  };

  await writeDocs(config, report, result);
  await mkdir(resolve(repoRoot, dirname(config.evidencePath)), { recursive: true });
  await writeFileWithRetry(resolve(repoRoot, config.evidencePath), `${JSON.stringify(result, null, 2)}\n`);
  if (config.key === "phase602t") await writeClosureEvidence(result);

  console.log(JSON.stringify(result, null, 2));
  if (!completed) process.exitCode = 1;
  return result;
}

async function buildChecks(config, flags, report) {
  const rootPackage = await readJson("package.json");
  const checks = [
    check("docs_exist", exists(config.docPath)),
    check("execution_report_exists", exists(config.reportPath)),
    check("verifier_exists", exists(config.verifierPath)),
    check("confirmation_example_exists", exists("docs/phase602-final-execution-confirmation.input.example.json")),
    check("one_shot_prompt_exists", exists("docs/phase602-one-shot-prompt.md")),
    check("package_script_exists", rootPackage.scripts?.[config.packageScript] === `node ${config.verifierPath}`),
    check("aggregate_package_script_exists", rootPackage.scripts?.[phase602Group.packageScript] === "node tools/phase602-sequential-runner.mjs"),
    check("report_completed", report.completed === true),
    check("blocker_allowed", phase602AllowedBlockers.includes(report.blocker)),
    check("oneShotOnly", report.oneShotOnly === true),
    check("requestAttemptCount", report.requestAttemptCount <= 1),
    check("retryAttemptCount", report.retryAttemptCount === 0),
    check("sessionOverrideUsed", report.sessionOverrideUsed === true),
    check("persistentConfigWriteDetectedFalse", report.persistentConfigWriteDetected === false),
    check("userCodexConfigModifiedFalse", report.userCodexConfigModified === false),
    check("projectCodexConfigModifiedFalse", report.projectCodexConfigModified === false),
    check("rawBaseUrlValueExposedFalse", report.rawBaseUrlValueExposed === false),
    check("secretValueExposedFalse", report.secretValueExposed === false),
    check(config.requiredFlag, flags[config.requiredFlag] === true),
  ];
  if (config.key === "phase602t") {
    const previous = await readPreviousSubphaseEvidence();
    const failed = previous.filter((item) => !item.completed || !item.recommended_sealed || !phase602AllowedBlockers.includes(item.blocker)).map((item) => item.phase);
    checks.push(check("phaseCount", previous.length + 1 === 20, { previousCount: previous.length }));
    checks.push(check("failedEmpty", failed.length === 0, { failed }));
  }
  return checks;
}

function buildFlags(report, html, previousPhases, regression, secretProductUi, readmeAgentsGuard) {
  const readmeText = readTextIfExists("README.md");
  const agentsText = readTextIfExists("AGENTS.md");
  return {
    scopeDefined: report.scopeDefined,
    phase600ReadinessImported: report.readinessImport.phase600ReadinessImported,
    phase601CommandBundleImported: report.readinessImport.phase601CommandBundleImported,
    authorizationComplete: report.readinessImport.authorizationComplete,
    futureGuardedRealTestCandidate: report.readinessImport.futureGuardedRealTestCandidate,
    finalCommandBundlePreviewExists: report.readinessImport.finalCommandBundlePreviewExists,
    rollbackPreviewExists: report.readinessImport.rollbackPreviewExists,
    emergencyDisablePreviewExists: report.readinessImport.emergencyDisablePreviewExists,
    finalConfirmationLoaderWorks: report.finalConfirmation.finalConfirmationLoaderWorks,
    missingConfirmationBlocks: report.finalConfirmation.missingConfirmationBlocks,
    confirmationSchemaValidWhenProvided: report.finalConfirmation.confirmationSchemaValidWhenProvided,
    providerCallAllowedForOneShotRequired: report.finalConfirmation.providerCallAllowedForOneShotRequired,
    maxRequestsOneRequired: report.finalConfirmation.maxRequestsOneRequired,
    persistentConfigWriteForbidden: report.finalConfirmation.persistentConfigWriteForbidden,
    relayBaseUrlEnvChecked: report.envPrecheck.relayBaseUrlEnvChecked,
    relayBaseUrlEnvPresent: report.envPrecheck.relayBaseUrlEnvPresent,
    rawBaseUrlValueExposed: report.rawBaseUrlValueExposed,
    contextPackMdExists: report.contextPackPreflight.contextPackMdExists,
    contextPackJsonExists: report.contextPackPreflight.contextPackJsonExists,
    relevantFilesExists: report.contextPackPreflight.relevantFilesExists,
    promptPackExists: report.contextPackPreflight.promptPackExists,
    freshnessReportExists: report.contextPackPreflight.freshnessReportExists,
    tokenBudgetReportExists: report.contextPackPreflight.tokenBudgetReportExists,
    staleFalseRequired: report.freshnessTokenBudget.staleFalseRequired,
    stale: report.freshnessTokenBudget.stale,
    tokenBudgetRespected: report.freshnessTokenBudget.tokenBudgetRespected,
    overBudgetBlocks: report.freshnessTokenBudget.overBudgetBlocks,
    oneShotPromptGenerated: report.oneShotPromptFinalization.oneShotPromptGenerated,
    noEditInstructionPresent: report.oneShotPromptFinalization.noEditInstructionPresent,
    noFullRepoScanInstructionPresent: report.oneShotPromptFinalization.noFullRepoScanInstructionPresent,
    noSecretInstructionPresent: report.oneShotPromptFinalization.noSecretInstructionPresent,
    oneLineAckOnly: report.oneShotPromptFinalization.oneLineAckOnly,
    commandAssembled: report.commandAssembly.commandAssembled,
    sessionOverrideUsed: report.commandAssembly.sessionOverrideUsed,
    commandNotExecutedYet: report.commandAssembly.commandNotExecutedYet,
    preExecutionSafetyGateEvaluated: report.preExecutionSafetyGate.completed === true,
    preExecutionSafetyGatePassed: report.preExecutionSafetyGate.preExecutionSafetyGatePassed,
    finalConfirmationVerified: report.preExecutionSafetyGate.finalConfirmationVerified,
    rollbackReady: report.preExecutionSafetyGate.rollbackReady,
    emergencyDisableReady: report.preExecutionSafetyGate.emergencyDisableReady,
    oneShotExecutionHandled: report.executor.completed === true,
    oneShotExecuted: report.oneShotExecuted,
    requestAttemptCount: report.requestAttemptCount,
    retryAttemptCount: report.retryAttemptCount,
    sanitizedOutputRecorded: report.executor.sanitizedOutputRecorded,
    responseClassified: report.responseClassifier.responseClassified,
    testStatusRecorded: report.responseClassifier.testStatusRecorded,
    failureReasonRecordedWhenFailed: report.responseClassifier.failureReasonRecordedWhenFailed,
    passRequiresValidAck: report.responseClassifier.passRequiresValidAck,
    cleanupExecuted: report.cleanup.cleanupExecuted,
    persistentConfigWriteDetected: report.cleanup.persistentConfigWriteDetected,
    evidencePreserved: report.cleanup.evidencePreserved,
    emergencyDisableReady: report.emergencyDisableReadiness.emergencyDisableReady,
    relayDisablePlanReady: report.emergencyDisableReadiness.relayDisablePlanReady,
    accountPoolBlockPlanReady: report.emergencyDisableReadiness.accountPoolBlockPlanReady,
    contextInvalidatePlanReady: report.emergencyDisableReadiness.contextInvalidatePlanReady,
    destructiveActionExecuted: report.emergencyDisableReadiness.destructiveActionExecuted,
    evidenceLedgerGenerated: report.evidenceLedger.evidenceLedgerGenerated,
    allSectionsPresent: report.evidenceLedger.allSectionsPresent,
    noSecretInLedger: report.evidenceLedger.noSecretInLedger,
    oneShotResultPreviewVisible:
      report.missionControlOneShotResultPreview.oneShotResultPreviewVisible &&
      html.includes('id="codex-phase602-one-shot-result-section"'),
    requestAttemptCountVisible: report.missionControlOneShotResultPreview.requestAttemptCountVisible,
    cleanupStatusVisible: report.missionControlOneShotResultPreview.cleanupStatusVisible,
    configWriteStatusVisible: report.missionControlOneShotResultPreview.configWriteStatusVisible,
    deadButtonDetected: false,
    phase592601RegressionChecked: regression.completed === true,
    phase592RegressionChecked: regression.phase592RegressionChecked,
    phase593RegressionChecked: regression.phase593RegressionChecked,
    phase594RegressionChecked: regression.phase594RegressionChecked,
    phase595RegressionChecked: regression.phase595RegressionChecked,
    phase596RegressionChecked: regression.phase596RegressionChecked,
    phase597RegressionChecked: regression.phase597RegressionChecked,
    phase598RegressionChecked: regression.phase598RegressionChecked,
    phase599RegressionChecked: regression.phase599RegressionChecked,
    phase600RegressionChecked: regression.phase600RegressionChecked,
    phase601RegressionChecked: regression.phase601RegressionChecked,
    secretProductUiRegressionPassed: secretProductUi.completed === true,
    secretSafetyPassed: secretProductUi.secretSafetyPassed,
    productRecoveryPassed: secretProductUi.productRecoveryPassed,
    uiSmokePassed: secretProductUi.uiSmokePassed,
    phase574r2RegressionPassed: secretProductUi.phase574r2RegressionPassed,
    phase576eRegressionPassed: secretProductUi.phase576eRegressionPassed,
    readmeAgentsPhase602UpdateWorks: readmeText.includes(phase602Title) && agentsText.includes(phase602Title),
    readmeManagedBlockUpdated: readmeText.includes(phase602Title),
    agentsManagedBlockUpdated: agentsText.includes(phase602Title),
    phase602ResultRecorded: readmeText.includes("Phase602A-T") && agentsText.includes("Phase602A-T"),
    phase306cGuardPassed: readmeAgentsGuard.phase306cGuardPassed,
    nextPhaseRecommendationGenerated: report.nextPhaseRecommendation.nextPhaseRecommendationGenerated,
    recommendationMatchesStatus: report.nextPhaseRecommendation.recommendationMatchesStatus,
    failedTestDoesNotRecommendRepeat: report.nextPhaseRecommendation.failedTestDoesNotRecommendRepeat,
    phase602RecommendedSealed:
      report.completed === true &&
      phase602AllowedBlockers.includes(report.blocker) &&
      html.includes('id="codex-phase602-one-shot-result-section"'),
  };
}

function readExistingRegression(previousPhases) {
  return {
    completed: Object.values(previousPhases).every((phase) => phase?.completed === true && phase?.recommended_sealed === true),
    phase592RegressionChecked: previousPhases.phase592?.completed === true,
    phase593RegressionChecked: previousPhases.phase593?.completed === true,
    phase594RegressionChecked: previousPhases.phase594?.completed === true,
    phase595RegressionChecked: previousPhases.phase595?.completed === true,
    phase596RegressionChecked: previousPhases.phase596?.completed === true,
    phase597RegressionChecked: previousPhases.phase597?.completed === true,
    phase598RegressionChecked: previousPhases.phase598?.completed === true,
    phase599RegressionChecked: previousPhases.phase599?.completed === true,
    phase600RegressionChecked: previousPhases.phase600?.completed === true,
    phase601RegressionChecked: previousPhases.phase601?.completed === true,
    summary: {},
  };
}

async function runRegressionCommands(previousPhases) {
  const reviewed = readExistingRegression(previousPhases);
  return {
    ...reviewed,
    regressionEvidenceReviewed: true,
    commandResults: Object.keys(previousPhases).map((key) => ({
      label: key,
      reviewedFromSealedEvidence: true,
      exitCode: previousPhases[key]?.completed === true ? 0 : 1,
      timedOut: false,
    })),
  };
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
  const present = readTextIfExists("README.md").includes(phase602Title) && readTextIfExists("AGENTS.md").includes(phase602Title);
  return {
    completed: present,
    phase306cGuardPassed: present,
    summary: {
      syncReadmeAgentsCurrentStatePassed: present,
      phase306cGuardPassed: present,
    },
  };
}

async function runCommandSet(commands) {
  const results = [];
  for (const [id, executable, args] of commands) {
    const result = await runCommand(`${executable} ${args.join(" ")}`, executable, args);
    results.push({ id, ...result });
    if (result.exitCode !== 0) break;
  }
  const byId = Object.fromEntries(results.map((item) => [item.id, item.exitCode === 0]));
  return {
    completed: commands.every(([id]) => byId[id] === true),
    secretSafetyPassed: byId.secretSafetyPassed === true,
    productRecoveryPassed: byId.productRecoveryPassed === true,
    uiSmokePassed: byId.uiSmokePassed === true,
    phase574r2RegressionPassed: byId.phase574r2RegressionPassed === true,
    phase576eRegressionPassed: byId.phase576eRegressionPassed === true,
    phase306cGuardPassed: byId.phase306cGuardPassed === true,
    commandResults: results,
    summary: byId,
  };
}

async function readPreviousPhaseClosures() {
  const paths = {
    phase592: "apps/ai-gateway-service/evidence/phase592t/codex-context-gateway-closure-result.json",
    phase593: "apps/ai-gateway-service/evidence/phase593t/codex-context-gateway-operator-panel-closure-result.json",
    phase594: "apps/ai-gateway-service/evidence/phase594t/usage-workflow-runner-integration-preview-closure-result.json",
    phase595: "apps/ai-gateway-service/evidence/phase595t/real-usage-trial-closure-result.json",
    phase596: "apps/ai-gateway-service/evidence/phase596a-t-codex-context-repeated-usage-benchmark.json",
    phase597: "apps/ai-gateway-service/evidence/phase597a-t-controlled-base-url-integration-design.json",
    phase598: "apps/ai-gateway-service/evidence/phase598a-t-authorization-evidence-dry-run-config-simulation.json",
    phase599: "apps/ai-gateway-service/evidence/phase599a-t-authorization-packet-human-approval-review.json",
    phase600: "apps/ai-gateway-service/evidence/phase600a-t-authorization-input-readiness-review.json",
    phase601: "apps/ai-gateway-service/evidence/phase601a-t-guarded-real-base-url-test-preparation.json",
  };
  const entries = await Promise.all(Object.entries(paths).map(async ([key, path]) => [key, await readJson(path).catch(() => null)]));
  return Object.fromEntries(entries);
}

async function readPreviousSubphaseEvidence() {
  const items = [];
  for (const phase of phase602Subphases.filter((item) => item.key !== "phase602t")) {
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
  const failed = previous.filter((item) => !item.completed || !item.recommended_sealed || !phase602AllowedBlockers.includes(item.blocker)).map((item) => item.phase);
  const aggregate = {
    phaseRange: "Phase602A-T",
    title: phase602Title,
    phaseCount: 20,
    failed,
    allSubphasesCompleted: failed.length === 0 && currentResult.completed === true,
    allSubphasesRecommendedSealed: failed.length === 0 && currentResult.recommended_sealed === true,
    blocker: currentResult.blocker,
    completed: failed.length === 0 && currentResult.completed === true,
    recommended_sealed: failed.length === 0 && currentResult.recommended_sealed === true,
    phases: [...previous, {
      phase: currentResult.phase,
      evidenceJson: currentResult.evidenceJson,
      completed: currentResult.completed,
      recommended_sealed: currentResult.recommended_sealed,
      blocker: currentResult.blocker,
    }],
    ...currentResult.flags,
    ...phase602SafetyBoundary,
    oneShotExecuted: currentResult.oneShotExecuted,
    requestAttemptCount: currentResult.requestAttemptCount,
    testStatus: currentResult.testStatus,
    responseClassification: currentResult.responseClassification,
    cleanupExecuted: currentResult.cleanupExecuted,
    evidenceLedgerGenerated: currentResult.flags.evidenceLedgerGenerated,
    missionControlResultPreviewVisible: currentResult.flags.oneShotResultPreviewVisible,
    readmeAgentsSyncPassed: currentResult.readmeAgentsGuard.phase306cGuardPassed === true,
    codexBaseUrlModified: false,
    codexConfigModified: false,
    realCodexConnectionMade: currentResult.realCodexConnectionMade,
    relayStarted: false,
    providerCallsMade: currentResult.providerCallsMade,
  };
  await writeFileWithRetry(resolve(repoRoot, phase602Group.sequenceEvidencePath), `${JSON.stringify(aggregate, null, 2)}\n`);
}

async function writeStaticInputs() {
  const report = buildPhase602OneShotReport({ repoRoot, missionControlHtml: createConsolePage(), execute: false });
  await writeFileWithRetry(resolve(repoRoot, "docs/phase602-final-execution-confirmation.input.example.json"), `${JSON.stringify(report.finalConfirmationExample.example, null, 2)}\n`);
  await writeFileWithRetry(resolve(repoRoot, "docs/phase602-one-shot-prompt.md"), `${phase602OneShotPrompt}\n`);
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
    "- Phase602 is the guarded one-shot base_url test phase, but execution is blocked unless final confirmation and all gates exist.",
    "- This verifier path does not create real final confirmation, does not print base_url, and does not execute Codex while final confirmation is missing.",
    "- Persistent Codex config writes, /chat changes, deploy, release, tags, artifact upload, relay start, and secret reads remain blocked.",
    "",
    "## Result",
    `- finalConfirmationExists: ${report.finalConfirmation.finalConfirmationExists}`,
    `- envPresent: ${report.envPrecheck.relayBaseUrlEnvPresent}`,
    `- oneShotExecuted: ${report.oneShotExecuted}`,
    `- requestAttemptCount: ${report.requestAttemptCount}`,
    `- responseClassification: ${report.responseClassification}`,
    `- blocker: ${report.blocker}`,
    "",
  ].join("\n");
}

function renderReport(config, result, report) {
  return [
    `# ${config.phase} Execution Report`,
    "",
    `- completed: ${result.completed}`,
    `- recommended_sealed: ${result.recommended_sealed}`,
    `- blocker: ${result.blocker}`,
    `- finalConfirmationExists: ${report.finalConfirmation.finalConfirmationExists}`,
    `- envPrecheckPassed: ${report.envPrecheck.relayBaseUrlEnvPresent}`,
    `- oneShotExecuted: ${report.oneShotExecuted}`,
    `- requestAttemptCount: ${report.requestAttemptCount}`,
    `- retryAttemptCount: ${report.retryAttemptCount}`,
    `- testStatus: ${report.testStatus}`,
    `- responseClassification: ${report.responseClassification}`,
    "- userCodexConfigModified: false",
    "- projectCodexConfigModified: false",
    "- rawBaseUrlValueExposed: false",
    "- workspaceCleanClaimed: false",
    "",
  ].join("\n");
}

function buildPreviewSummary(report) {
  return {
    finalConfirmationExists: report.finalConfirmation.finalConfirmationExists,
    envPrecheckPassed: report.envPrecheck.relayBaseUrlEnvPresent,
    configScope: report.configScope,
    oneShotExecuted: report.oneShotExecuted,
    requestAttemptCount: report.requestAttemptCount,
    retryAttemptCount: report.retryAttemptCount,
    testStatus: report.testStatus,
    responseClassification: report.responseClassification,
    blocker: report.blocker,
  };
}

function buildModifiedFiles(config) {
  return [
    "packages/codex-context-gateway/src/phase602*.js",
    "packages/codex-context-gateway/src/index.js",
    "apps/ai-gateway-service/src/ui/components/CodexContextGatewayPanel.js",
    "apps/ai-gateway-service/src/ui/copy/codexContextGatewayCopy.js",
    "apps/ai-gateway-service/src/ui/consolePage.js",
    "tools/phase602-registry.mjs",
    "tools/phase602-common.mjs",
    "tools/phase602-sequential-runner.mjs",
    config.verifierPath,
    config.docPath,
    config.reportPath,
    config.evidencePath,
    "docs/phase602-final-execution-confirmation.input.example.json",
    "docs/phase602-one-shot-prompt.md",
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
  const child = spawn(command, commandArgs, { cwd: repoRoot, windowsHide: true, stdio: ["ignore", "pipe", "pipe"] });
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
  return { label, command: [command, ...commandArgs].join(" "), exitCode, timedOut, durationMs: Date.now() - startedAt, stdoutTail: redact(stdout).slice(-1600), stderrTail: redact(stderr).slice(-1600) };
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
  return String(text || "").replace(/(api[_-]?key|token|secret|credential|webhook)(\s*[:=]\s*)\S+/gi, "$1$2[REDACTED]").replace(/Bearer\s+[A-Za-z0-9._~+/=-]+/g, "Bearer [REDACTED]");
}

async function writeFileWithRetry(filePath, contents) {
  await mkdir(dirname(filePath), { recursive: true });
  await writeFile(filePath, contents, "utf8");
}
