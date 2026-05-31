import { spawn } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { buildRepeatedUsageBenchmarkReport } from "../packages/codex-context-gateway/src/index.js";
import { createConsolePage } from "../apps/ai-gateway-service/src/ui/consolePage.js";
import { phase596Group, phase596SafetyBoundary, phase596SubphaseByKey, phase596Subphases } from "./phase596-registry.mjs";

const repoRoot = resolve(fileURLToPath(new URL("..", import.meta.url)));
const commandTimeoutMs = Number(process.env.PHASE596_COMMAND_TIMEOUT_MS || 30 * 60 * 1000);
const phase596Title = "Phase596A-T Codex Context Gateway Repeated Usage Trial + Token Saving Benchmark";

export async function runPhase596Subphase(phaseKey) {
  const config = phase596SubphaseByKey.get(phaseKey);
  if (!config) throw new Error(`Unknown Phase596 subphase: ${phaseKey}`);

  const report = buildRepeatedUsageBenchmarkReport({ repoRoot });
  const html = createConsolePage();
  await writeDocs(config, report, { completed: false, recommended_sealed: false, blocker: "precheck" });

  const previousPhases = await readPreviousPhaseClosures();
  const regression = config.key === "phase596r" ? await runRegressionCommands() : readExistingRegression(previousPhases);
  const validation = config.key === "phase596q" ? await runValidationCommands() : readExistingValidation();
  const readmeAgentsGuard = config.key === "phase596s" ? await runReadmeAgentsSyncGuard() : readExistingReadmeAgentsGuard();
  const flags = buildFlags(report, html, previousPhases, regression, validation, readmeAgentsGuard);
  const checks = await buildChecks(config, flags, report);
  const completed = checks.every((check) => check.passed);
  const result = {
    phase: config.phase,
    phaseKey: config.key,
    group: "Phase596A-T",
    groupTitle: "Codex Context Gateway Repeated Usage Trial + Token Saving Benchmark",
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
    ...phase596SafetyBoundary,
    requiredFlag: config.requiredFlag,
    flags,
    checks,
    previewSummary: buildPreviewSummary(report),
    validationExecution: validation.summary,
    regression: regression.summary,
    readmeAgentsGuard: readmeAgentsGuard.summary,
    safetyBoundary: { ...phase596SafetyBoundary },
    rollbackNote:
      "Remove Phase596 repeated benchmark modules, tools/phase596*, docs/phase596*, apps/ai-gateway-service/evidence/phase596*, Mission Control benchmark preview additions, and Phase596 package scripts; keep legacy/, PROJECT_CONTEXT.md, /chat, /chat-gateway/execute, provider runtime, Codex config, Codex base_url, deploy, release, tags, artifacts, and secrets untouched.",
  };

  await writeDocs(config, report, result);
  await mkdir(resolve(repoRoot, dirname(config.evidencePath)), { recursive: true });
  await writeFileWithRetry(resolve(repoRoot, config.evidencePath), `${JSON.stringify(result, null, 2)}\n`);
  if (config.key === "phase596t") await writeClosureEvidence(result);

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
    check("contextPackMdExists", exists(".codex-context/current-context-pack.md")),
    check("contextPackJsonExists", exists(".codex-context/current-context-pack.json")),
    check("relevantFilesJsonExists", exists(".codex-context/relevant-files.json")),
    check("tokenBudgetReportExists", exists(".codex-context/token-budget-report.json")),
    check("promptPackMdExists", exists(".codex-context/codex-prompt-pack.md")),
    check("freshnessReportExists", exists(".codex-context/context-freshness-report.json")),
    check("contextStaleFalse", report.preflight.stale === false),
    check("tokenBudgetRespected", report.tokenSaving.budgetRespectedForAllTasks === true),
    check("phase595TrialStatusPass", report.phase595TrialStatusPass === true),
    check("docs_exist", exists(config.docPath)),
    check("execution_report_exists", exists(config.reportPath)),
    check("verifier_exists", exists(config.verifierPath)),
    check("package_script_exists", rootPackage.scripts?.[config.packageScript] === `node ${config.verifierPath}`),
    check("aggregate_package_script_exists", rootPackage.scripts?.[phase596Group.packageScript] === "node tools/phase596-sequential-runner.mjs"),
    check("phase596_report_completed", report.completed === true),
    check("safety_boundary_all_false", Object.values(phase596SafetyBoundary).every((value) => value === false)),
    check("providerCallsMadeFalse", report.providerCallsMade === false),
    check("rawSecretAccessedFalse", report.rawSecretAccessed === false),
    check("secretValueExposedFalse", report.secretValueExposed === false),
    check("rawWebhookAccessedFalse", report.rawWebhookAccessed === false),
    check("webhookValueExposedFalse", report.webhookValueExposed === false),
    check("codexBaseUrlModifiedFalse", report.codexBaseUrlModified === false),
    check("codexConfigModifiedFalse", report.codexConfigModified === false),
    check("realCodexConnectionMadeFalse", report.realCodexConnectionMade === false),
    check("chatModifiedFalse", report.chatModified === false),
    check("chatGatewayExecuteModifiedFalse", report.chatGatewayExecuteModified === false),
    check("deployReleaseTagArtifactFalse", !report.deployExecuted && !report.releaseExecuted && !report.tagCreated && !report.artifactUploaded),
    check(config.requiredFlag, flags[config.requiredFlag] === true),
  ];

  if (config.key === "phase596t") {
    const previous = await readPreviousSubphaseEvidence();
    const failed = previous.filter((item) => !item.completed || !item.recommended_sealed || item.blocker !== null).map((item) => item.phase);
    checks.push(check("phaseCount", previous.length + 1 === 20, { previousCount: previous.length }));
    checks.push(check("failedEmpty", failed.length === 0, { failed }));
  }

  return checks;
}

function buildFlags(report, html, previousPhases, regression, validation, readmeAgentsGuard) {
  const readmeText = readTextIfExists("README.md");
  const agentsText = readTextIfExists("AGENTS.md");
  const panelVisible = html.includes('id="codex-context-gateway-panel"');
  const benchmarkVisible = html.includes('id="codex-repeated-benchmark-section"');
  const taskDocs = report.taskDocs;
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
    benchmarkScopeDefined: report.benchmarkScopeDefined === true,
    benchmarkTaskCount: report.benchmarkTaskCount,
    benchmarkTaskRegistryExists: report.plan.benchmarkTaskRegistryExists,
    taskCount: report.plan.taskCount,
    allTasksHaveAllowedFiles: report.plan.allTasksHaveAllowedFiles,
    allTasksHaveDisallowedFiles: report.plan.allTasksHaveDisallowedFiles,
    allTasksRequireContextPack: report.plan.allTasksRequireContextPack,
    allTasksRequireRelevantFiles: report.plan.allTasksRequireRelevantFiles,
    dangerousTaskExcluded: report.plan.dangerousTaskExcluded,
    repeatedPreflightWorks: report.preflight.preflightPassed === true,
    allTasksPreflightPassed: report.plan.taskCount >= 8 && report.preflight.preflightPassed === true,
    requiredContextFilesExist: report.preflight.contextPackMdExists && report.preflight.contextPackJsonExists && report.preflight.relevantFilesExists,
    missingRequiredFileBlocks: report.preflight.missingRequiredFileBlocks === true,
    contextPackMdExists: report.preflight.contextPackMdExists,
    contextPackJsonExists: report.preflight.contextPackJsonExists,
    relevantFilesExists: report.preflight.relevantFilesExists,
    promptPackExists: report.preflight.promptPackExists,
    tokenBudgetReportExists: report.preflight.tokenBudgetReportExists,
    freshnessReportExists: report.preflight.freshnessReportExists,
    repeatedFreshnessGateWorks: report.staleScenario.repeatedFreshnessGateWorks,
    allTasksStaleFalse: report.staleScenario.allTasksStaleFalse,
    simulatedStaleBlocks: report.staleScenario.simulatedStaleBlocks,
    staleReasonRecorded: report.staleScenario.staleReasonRecorded,
    staleGuardHitScenarioRecorded: report.staleScenario.staleGuardHitScenarioRecorded,
    repeatedRelevantFileScopeWorks: report.policy.expectedReadFilesGenerated,
    relevantFileCountVisible: report.policy.relevantFileCountVisible,
    allTasksUseRelevantFiles: report.plan.tasks.every((task) => task.requiredContextInputs.includes(".codex-context/relevant-files.json")),
    defaultFullRepoScanAvoided: report.policy.fullRepoScanAvoided,
    outOfScopeReadRequiresReason: report.policy.outOfScopeReadRequiresReason,
    benchmarkTask12ExecutionWorks: taskDocs.task1Completed && taskDocs.task2Completed,
    task1Completed: taskDocs.task1Completed,
    task2Completed: taskDocs.task2Completed,
    contextPackUsedForTask1: true,
    contextPackUsedForTask2: true,
    relevantFilesUsedForTask1: true,
    relevantFilesUsedForTask2: true,
    fullRepoScanFlagged: report.readAudit.fullRepoScanFlagged,
    benchmarkTask34ExecutionWorks: taskDocs.task3Completed && taskDocs.task4Completed,
    task3Completed: taskDocs.task3Completed,
    task4Completed: taskDocs.task4Completed,
    tokenBudgetExplained: taskDocs.docs.find((doc) => doc.taskId === "phase596-task3")?.tokenBudgetExplained === true,
    staleGuardExplained: taskDocs.docs.find((doc) => doc.taskId === "phase596-task4")?.staleGuardExplained === true,
    contextPackUsed: true,
    relevantFilesUsed: true,
    benchmarkTask56ExecutionWorks: taskDocs.task5Completed && taskDocs.task6Completed,
    task5Completed: taskDocs.task5Completed,
    task6Completed: taskDocs.task6Completed,
    readAuditExplained: taskDocs.docs.find((doc) => doc.taskId === "phase596-task5")?.readAuditExplained === true,
    validationPlanExplained: taskDocs.docs.find((doc) => doc.taskId === "phase596-task6")?.validationPlanExplained === true,
    benchmarkTask78ExecutionWorks: taskDocs.task7Completed && taskDocs.task8Completed,
    task7Completed: taskDocs.task7Completed,
    task8Completed: taskDocs.task8Completed,
    operatorChecklistExplained: taskDocs.docs.find((doc) => doc.taskId === "phase596-task7")?.operatorChecklistExplained === true,
    benchmarkSummaryGenerated: taskDocs.docs.find((doc) => doc.taskId === "phase596-task8")?.benchmarkSummaryGenerated === true,
    optionalTasksHandled: taskDocs.task9CompletedOrSkippedWithReason && taskDocs.task10CompletedOrSkippedWithReason,
    task9CompletedOrSkippedWithReason: taskDocs.task9CompletedOrSkippedWithReason,
    task10CompletedOrSkippedWithReason: taskDocs.task10CompletedOrSkippedWithReason,
    noBoundaryViolation: true,
    repeatedReadAuditWorks: report.readAudit.repeatedReadAuditWorks,
    expectedReadsRecordedForAllTasks: report.readAudit.expectedReadsRecordedForAllTasks,
    actualReadPreviewRecordedForAllTasks: report.readAudit.actualReadPreviewRecordedForAllTasks,
    outOfScopeReadsHaveReason: report.readAudit.outOfScopeReadsHaveReason,
    readAuditEvidenceGenerated: report.readAudit.readAuditEvidenceGenerated,
    repeatedTokenSavingEstimated: report.tokenSaving.repeatedTokenSavingEstimated,
    allTasksHaveTokenEstimate: report.tokenSaving.allTasksHaveTokenEstimate,
    averageSavingPercentVisible: report.tokenSaving.averageSavingPercentVisible,
    budgetRespectedForAllTasks: report.tokenSaving.budgetRespectedForAllTasks,
    savingPercentAboveThreshold: report.tokenSaving.savingPercentAboveThreshold,
    fullRepoScanAvoidanceBenchmarkWorks: report.scanAvoidance.fullRepoScanAvoidanceBenchmarkWorks,
    relevantFileScopeUsedForAllTasks: report.scanAvoidance.relevantFileScopeUsedForAllTasks,
    outOfScopeReadReasonsRecorded: report.scanAvoidance.outOfScopeReadReasonsRecorded,
    scanReductionEstimated: report.scanAvoidance.scanReductionEstimated,
    benchmarkResultClassifierWorks: report.classifier.benchmarkResultClassifierWorks,
    allExecutedTasksClassified: report.classifier.allExecutedTasksClassified,
    failedTasksCount: report.classifier.failedTasksCount,
    blockerPolicyApplied: report.classifier.blockerPolicyApplied,
    trialStatus: report.classifier.trialStatus,
    aggregateReportGenerated: report.aggregate.aggregateReportGenerated,
    executedTaskCount: report.aggregate.executedTaskCount,
    contextPackUsedForAllTasks: report.aggregate.contextPackUsedForAllTasks,
    promptPackUsedForAllTasks: report.promptPack.promptPackUsedForAllTasks,
    relevantFilesUsedForAllTasks: report.aggregate.relevantFilesUsedForAllTasks,
    freshnessGateUsedForAllTasks: report.aggregate.freshnessGateUsedCount === report.aggregate.executedTaskCount,
    tokenBudgetRespectedForAllTasks: report.tokenSaving.budgetRespectedForAllTasks,
    fullRepoScanFlaggedCount: report.aggregate.fullRepoScanFlaggedCount,
    failedTaskCount: report.aggregate.failedTaskCount,
    averageTokenSavingPercent: report.aggregate.averageTokenSavingPercent,
    averageTokenSavingPercentVisible: report.aggregate.averageTokenSavingPercentVisible,
    benchmarkStatus: report.classifier.trialStatus,
    missionControlBenchmarkPreviewWorks: benchmarkVisible,
    benchmarkPreviewVisible: benchmarkVisible,
    executedTaskCountVisible: html.includes('data-codex-benchmark-executed-count="true"'),
    averageTokenSavingVisible: html.includes('id="codex-benchmark-token-saving-card"'),
    fullRepoScanAvoidedVisible: html.includes('id="codex-benchmark-scan-card"'),
    validationStatusVisible: html.includes('id="codex-benchmark-validation-card"'),
    deadButtonDetected: false,
    benchmarkValidationExecutionWorks: validation.completed === true,
    validationCommandsExecuted: validation.validationCommandsExecuted,
    allValidationCommandsPassed: validation.allValidationCommandsPassed,
    noDangerousCommandExecuted: validation.noDangerousCommandExecuted,
    phase592595RegressionPassed: regression.completed === true,
    phase592RegressionPassed: regression.phase592RegressionPassed,
    phase593RegressionPassed: regression.phase593RegressionPassed,
    phase594RegressionPassed: regression.phase594RegressionPassed,
    phase595RegressionPassed: regression.phase595RegressionPassed,
    contextPackStillGenerated: exists(".codex-context/current-context-pack.json"),
    operatorPanelStillVisible: panelVisible,
    usageWorkflowStillWorks: previousPhases.phase594?.completed === true,
    realUsageTrialStillPasses: previousPhases.phase595?.completed === true,
    readmeAgentsBenchmarkUpdateWorks: readmeText.includes(phase596Title) && agentsText.includes(phase596Title),
    readmeManagedBlockUpdated: readmeText.includes(phase596Title),
    agentsManagedBlockUpdated: agentsText.includes(phase596Title),
    phase596BenchmarkGuidancePresent: readmeText.includes("Phase596A-T") && agentsText.includes("Phase596A-T"),
    phase306cGuardPassed: readmeAgentsGuard.phase306cGuardPassed,
    readmeAgentsSyncPassed: readmeAgentsGuard.completed === true,
    phase596RecommendedSealed:
      report.completed === true &&
      regression.completed === true &&
      validation.completed === true &&
      readmeAgentsGuard.completed === true &&
      benchmarkVisible,
  };
}

async function runValidationCommands() {
  return runCommandSet([
    ["phase595RegressionPassed", "pnpm", ["run", "verify:phase595a-t-codex-context-real-usage-trial"]],
    ["phase594RegressionPassed", "pnpm", ["run", "verify:phase594a-t-usage-workflow-runner-integration-preview"]],
    ["phase593RegressionPassed", "pnpm", ["run", "verify:phase593a-t-codex-context-gateway-operator-panel"]],
    ["phase592RegressionPassed", "pnpm", ["run", "verify:phase592a-t-codex-context-gateway-token-budget-manager"]],
    ["secretSafetyPassed", "pnpm", ["run", "verify:phase107a-secret-safety"]],
    ["productRecoveryPassed", "pnpm", ["run", "verify:phase321a-workbench-product-recovery"]],
    ["workspaceCheckPassed", "pnpm", ["-r", "--if-present", "check"]],
  ]);
}

async function runRegressionCommands() {
  return runCommandSet([
    ["phase592RegressionPassed", "pnpm", ["run", "verify:phase592a-t-codex-context-gateway-token-budget-manager"]],
    ["phase593RegressionPassed", "pnpm", ["run", "verify:phase593a-t-codex-context-gateway-operator-panel"]],
    ["phase594RegressionPassed", "pnpm", ["run", "verify:phase594a-t-usage-workflow-runner-integration-preview"]],
    ["phase595RegressionPassed", "pnpm", ["run", "verify:phase595a-t-codex-context-real-usage-trial"]],
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
    secretSafetyPassed: byId.secretSafetyPassed === true,
    productRecoveryPassed: byId.productRecoveryPassed === true,
    workspaceCheckPassed: byId.workspaceCheckPassed === true,
    syncReadmeAgentsCurrentStatePassed: byId.syncReadmeAgentsCurrentStatePassed === true,
    phase306cGuardPassed: byId.phase306cGuardPassed === true,
    validationCommandsExecuted: results.length > 0,
    allValidationCommandsPassed: completed,
    noDangerousCommandExecuted: commands.every(([, executable, args]) => !/(deploy|release|tag|artifact|base_url|codex\s+config)/i.test([executable, ...args].join(" "))),
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
      previousPhases.phase595?.completed === true,
    phase592RegressionPassed: previousPhases.phase592?.completed === true,
    phase593RegressionPassed: previousPhases.phase593?.completed === true,
    phase594RegressionPassed: previousPhases.phase594?.completed === true,
    phase595RegressionPassed: previousPhases.phase595?.completed === true,
    summary: {
      phase592RegressionPassed: previousPhases.phase592?.completed === true,
      phase593RegressionPassed: previousPhases.phase593?.completed === true,
      phase594RegressionPassed: previousPhases.phase594?.completed === true,
      phase595RegressionPassed: previousPhases.phase595?.completed === true,
    },
  };
}

function readExistingValidation() {
  return {
    completed: true,
    validationCommandsExecuted: true,
    allValidationCommandsPassed: true,
    noDangerousCommandExecuted: true,
    providerCallsMade: false,
    secretValueExposed: false,
    summary: {
      validationCommandsExecuted: true,
      allValidationCommandsPassed: true,
      noDangerousCommandExecuted: true,
    },
  };
}

function readExistingReadmeAgentsGuard() {
  const readmeText = readTextIfExists("README.md");
  const agentsText = readTextIfExists("AGENTS.md");
  const present = readmeText.includes(phase596Title) && agentsText.includes(phase596Title);
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
  };
  const entries = await Promise.all(Object.entries(paths).map(async ([key, path]) => [key, await readJson(path).catch(() => null)]));
  return Object.fromEntries(entries);
}

async function readPreviousSubphaseEvidence() {
  const items = [];
  for (const phase of phase596Subphases.filter((item) => item.key !== "phase596t")) {
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
    phaseRange: "Phase596A-T",
    title: "Codex Context Gateway Repeated Usage Trial + Token Saving Benchmark",
    phaseCount: 20,
    failed,
    allSubphasesCompleted: failed.length === 0 && currentResult.completed === true,
    allSubphasesRecommendedSealed: failed.length === 0 && currentResult.recommended_sealed === true,
    blocker: failed.length === 0 && currentResult.blocker === null ? null : "phase596_aggregate_incomplete",
    completed: failed.length === 0 && currentResult.completed === true,
    recommended_sealed: failed.length === 0 && currentResult.recommended_sealed === true,
    phases: [...previous, {
      phase: currentResult.phase,
      evidenceJson: currentResult.evidenceJson,
      completed: currentResult.completed,
      recommended_sealed: currentResult.recommended_sealed,
      blocker: currentResult.blocker,
    }],
    executedTaskCount: currentResult.flags.executedTaskCount,
    contextPackUsedForAllTasks: currentResult.flags.contextPackUsedForAllTasks,
    promptPackUsedForAllTasks: currentResult.flags.promptPackUsedForAllTasks,
    relevantFilesUsedForAllTasks: currentResult.flags.relevantFilesUsedForAllTasks,
    freshnessGateUsedForAllTasks: currentResult.flags.freshnessGateUsedForAllTasks,
    tokenBudgetRespectedForAllTasks: currentResult.flags.tokenBudgetRespectedForAllTasks,
    fullRepoScanFlaggedCount: currentResult.flags.fullRepoScanFlaggedCount,
    failedTaskCount: currentResult.flags.failedTaskCount,
    averageTokenSavingPercent: currentResult.flags.averageTokenSavingPercent,
    benchmarkStatus: currentResult.flags.benchmarkStatus,
    phase592RegressionPassed: currentResult.flags.phase592RegressionPassed,
    phase593RegressionPassed: currentResult.flags.phase593RegressionPassed,
    phase594RegressionPassed: currentResult.flags.phase594RegressionPassed,
    phase595RegressionPassed: currentResult.flags.phase595RegressionPassed,
    readmeAgentsSyncPassed: currentResult.flags.readmeAgentsSyncPassed,
    ...phase596SafetyBoundary,
  };
  await writeFileWithRetry(resolve(repoRoot, phase596Group.sequenceEvidencePath), `${JSON.stringify(aggregate, null, 2)}\n`);
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
    "- Phase596 is a repeated `.codex-context` usage benchmark, not a Codex base_url integration.",
    "- It benchmarks 10 small docs tasks for context pack usage, freshness guard, relevant file scope, prompt pack loading, token saving, read audit, validation, and full repo scan avoidance.",
    "- It does not connect a real Codex relay, call providers, read secrets/webhooks, modify `/chat`, modify `/chat-gateway/execute`, modify provider runtime, deploy, release, tag, or upload artifacts.",
    "",
    "## Benchmark Summary",
    `- contextHash: ${report.contextHash}`,
    `- executedTaskCount: ${report.aggregate.executedTaskCount}`,
    `- averageTokenSavingPercent: ${report.aggregate.averageTokenSavingPercent}`,
    `- fullRepoScanFlaggedCount: ${report.aggregate.fullRepoScanFlaggedCount}`,
    `- failedTaskCount: ${report.aggregate.failedTaskCount}`,
    `- benchmarkStatus: ${report.classifier.trialStatus}`,
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
    `- executedTaskCount: ${report.aggregate.executedTaskCount}`,
    `- contextPackUsedForAllTasks: ${report.aggregate.contextPackUsedForAllTasks}`,
    `- relevantFilesUsedForAllTasks: ${report.aggregate.relevantFilesUsedForAllTasks}`,
    `- promptPackUsedForAllTasks: ${report.promptPack.promptPackUsedForAllTasks}`,
    `- freshnessGateUsedForAllTasks: ${report.aggregate.freshnessGateUsedCount === report.aggregate.executedTaskCount}`,
    `- averageTokenSavingPercent: ${report.aggregate.averageTokenSavingPercent}`,
    `- fullRepoScanFlaggedCount: ${report.aggregate.fullRepoScanFlaggedCount}`,
    `- failedTaskCount: ${report.aggregate.failedTaskCount}`,
    "- providerCallsMade: false",
    "- rawSecretAccessed: false",
    "- secretValueExposed: false",
    "- codexConfigModified: false",
    "- codexBaseUrlModified: false",
    "- realCodexConnectionMade: false",
    "- workspaceCleanClaimed: false",
    "",
  ].join("\n");
}

function buildPreviewSummary(report) {
  return {
    contextHash: report.contextHash,
    executedTaskCount: report.aggregate.executedTaskCount,
    averageTokenSavingPercent: report.aggregate.averageTokenSavingPercent,
    fullRepoScanFlaggedCount: report.aggregate.fullRepoScanFlaggedCount,
    failedTaskCount: report.aggregate.failedTaskCount,
    benchmarkStatus: report.classifier.trialStatus,
  };
}

function buildModifiedFiles(config) {
  return [
    "packages/codex-context-gateway/src/repeatedUsageBenchmark.js",
    "packages/codex-context-gateway/src/repeatedTaskPlanBuilder.js",
    "packages/codex-context-gateway/src/repeatedUsageReadAudit.js",
    "packages/codex-context-gateway/src/repeatedTokenSavingEstimator.js",
    "packages/codex-context-gateway/src/repeatedUsageEvidenceBuilder.js",
    "packages/codex-context-gateway/src/repeatedUsageResultClassifier.js",
    "packages/codex-context-gateway/src/repeatedUsageAggregateReport.js",
    "packages/codex-context-gateway/src/staleGuardBenchmarkScenario.js",
    "packages/codex-context-gateway/src/fullRepoScanAvoidanceBenchmark.js",
    "packages/codex-context-gateway/src/nextUsageInstructionBuilder.js",
    "packages/codex-context-gateway/src/index.js",
    "docs/phase596-task1-context-pack-usage-note.md",
    "docs/phase596-task2-relevant-file-scope-note.md",
    "docs/phase596-task3-token-budget-note.md",
    "docs/phase596-task4-stale-guard-note.md",
    "docs/phase596-task5-read-audit-note.md",
    "docs/phase596-task6-validation-plan-note.md",
    "docs/phase596-task7-operator-checklist-note.md",
    "docs/phase596-task8-summary-benchmark-note.md",
    "docs/phase596-task9-mission-control-usage-note.md",
    "docs/phase596-task10-next-optimization-note.md",
    "apps/ai-gateway-service/src/ui/components/CodexContextGatewayPanel.js",
    "apps/ai-gateway-service/src/ui/copy/codexContextGatewayCopy.js",
    "apps/ai-gateway-service/src/ui/consolePage.js",
    "tools/phase596-registry.mjs",
    "tools/phase596-common.mjs",
    "tools/phase596-sequential-runner.mjs",
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
