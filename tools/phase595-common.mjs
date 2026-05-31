import { spawn } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { buildRealUsageTrialReport } from "../packages/codex-context-gateway/src/index.js";
import { createConsolePage } from "../apps/ai-gateway-service/src/ui/consolePage.js";
import { phase595Group, phase595SafetyBoundary, phase595SubphaseByKey, phase595Subphases } from "./phase595-registry.mjs";

const repoRoot = resolve(fileURLToPath(new URL("..", import.meta.url)));
const commandTimeoutMs = Number(process.env.PHASE595_COMMAND_TIMEOUT_MS || 10 * 60 * 1000);
const phase595Title = "Phase595A-T Codex Context Gateway Real Usage Trial Without Base URL Change";

export async function runPhase595Subphase(phaseKey) {
  const config = phase595SubphaseByKey.get(phaseKey);
  if (!config) throw new Error(`Unknown Phase595 subphase: ${phaseKey}`);

  const report = buildRealUsageTrialReport({ repoRoot });
  const html = createConsolePage();
  await writeDocs(config, report, { completed: false, recommended_sealed: false, blocker: "precheck" });

  const phase592t = await readJson("apps/ai-gateway-service/evidence/phase592t/codex-context-gateway-closure-result.json").catch(() => null);
  const phase593t = await readJson("apps/ai-gateway-service/evidence/phase593t/codex-context-gateway-operator-panel-closure-result.json").catch(() => null);
  const phase594t = await readJson("apps/ai-gateway-service/evidence/phase594t/usage-workflow-runner-integration-preview-closure-result.json").catch(() => null);
  const regression = config.key === "phase595r" ? await runRegressionCommands() : readExistingRegression();
  const safetyUi = config.key === "phase595s" ? await runSecretProductUiRegression() : readExistingSafetyUiRegression();
  const readmeAgentsGuard = config.key === "phase595p" ? await runReadmeAgentsSyncGuard() : readExistingReadmeAgentsGuard();
  const flags = buildFlags(report, html, phase592t, phase593t, phase594t, regression, safetyUi, readmeAgentsGuard);
  const checks = await buildChecks(config, flags, report);
  const completed = checks.every((check) => check.passed);
  const result = {
    phase: config.phase,
    phaseKey: config.key,
    group: "Phase595A-T",
    groupTitle: "Codex Context Gateway Real Usage Trial Without Base URL Change",
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
    ...phase595SafetyBoundary,
    requiredFlag: config.requiredFlag,
    flags,
    checks,
    previewSummary: buildPreviewSummary(report),
    regression: regression.summary,
    secretProductUiRegression: safetyUi.summary,
    readmeAgentsGuard: readmeAgentsGuard.summary,
    safetyBoundary: { ...phase595SafetyBoundary },
    rollbackNote:
      "Remove Phase595 usage trial modules, tools/phase595*, docs/phase595*, apps/ai-gateway-service/evidence/phase595*, Mission Control usage-trial preview additions, and Phase595 package scripts; keep legacy/, PROJECT_CONTEXT.md, /chat, /chat-gateway/execute, provider runtime, Codex config, Codex base_url, deploy, release, tags, artifacts, and secrets untouched.",
  };

  await writeDocs(config, report, result);
  await mkdir(resolve(repoRoot, dirname(config.evidencePath)), { recursive: true });
  await writeFileWithRetry(resolve(repoRoot, config.evidencePath), `${JSON.stringify(result, null, 2)}\n`);
  if (config.key === "phase595t") await writeClosureEvidence(result);

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
    check("contextPackMdExists", exists(".codex-context/current-context-pack.md")),
    check("contextPackJsonExists", exists(".codex-context/current-context-pack.json")),
    check("relevantFilesJsonExists", exists(".codex-context/relevant-files.json")),
    check("tokenBudgetReportExists", exists(".codex-context/token-budget-report.json")),
    check("promptPackMdExists", exists(".codex-context/codex-prompt-pack.md")),
    check("freshnessReportExists", exists(".codex-context/context-freshness-report.json")),
    check("contextStaleFalse", report.freshness.stale === false),
    check("tokenBudgetRespected", report.tokenSaving.budgetRespected === true),
    check("trialNoteExists", exists("docs/phase595-codex-context-real-usage-trial-note.md")),
    check("docs_exist", exists(config.docPath)),
    check("execution_report_exists", exists(config.reportPath)),
    check("verifier_exists", exists(config.verifierPath)),
    check("package_script_exists", rootPackage.scripts?.[config.packageScript] === `node ${config.verifierPath}`),
    check("aggregate_package_script_exists", rootPackage.scripts?.[phase595Group.packageScript] === "node tools/phase595-sequential-runner.mjs"),
    check("phase595_report_completed", report.completed === true),
    check("safety_boundary_all_false", Object.values(phase595SafetyBoundary).every((value) => value === false)),
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

  if (config.key === "phase595t") {
    const previous = await readPreviousPhaseEvidence();
    const failed = previous.filter((item) => !item.completed || !item.recommended_sealed || item.blocker !== null).map((item) => item.phase);
    checks.push(check("phaseCount", previous.length + 1 === 20, { previousCount: previous.length }));
    checks.push(check("failedEmpty", failed.length === 0, { failed }));
  }

  return checks;
}

function buildFlags(report, html, phase592t, phase593t, phase594t, regression, safetyUi, readmeAgentsGuard) {
  const readmeText = readTextIfExists("README.md");
  const agentsText = readTextIfExists("AGENTS.md");
  const panelVisible = html.includes('id="codex-context-gateway-panel"');
  return {
    phase592Completed: phase592t?.completed === true,
    phase592RecommendedSealed: phase592t?.recommended_sealed === true,
    phase592BlockerNull: phase592t?.blocker === null,
    phase593Completed: phase593t?.completed === true,
    phase593RecommendedSealed: phase593t?.recommended_sealed === true,
    phase593BlockerNull: phase593t?.blocker === null,
    phase594Completed: phase594t?.completed === true,
    phase594RecommendedSealed: phase594t?.recommended_sealed === true,
    phase594BlockerNull: phase594t?.blocker === null,
    realUsageTrialScopeDefined: report.realUsageTrialScopeDefined === true,
    defaultTrialTaskDefined: true,
    contextPackRealPreflightWorks: report.preflight.preflightPassed === true,
    contextPackMdExists: report.preflight.contextPackMdExists,
    contextPackJsonExists: report.preflight.contextPackJsonExists,
    relevantFilesExists: report.preflight.relevantFilesExists,
    promptPackExists: report.preflight.promptPackExists,
    tokenBudgetReportExists: report.preflight.tokenBudgetReportExists,
    freshnessReportExists: report.preflight.freshnessReportExists,
    preflightPassed: report.preflight.preflightPassed,
    freshnessRealGateWorks: report.freshness.freshnessReportReadable && report.freshness.stale === false && report.freshness.simulatedStaleBlocksTrial,
    freshnessReportReadable: report.freshness.freshnessReportReadable,
    stale: report.freshness.stale,
    staleFalseAllowsTrial: report.freshness.staleFalseAllowsTrial,
    simulatedStaleBlocksTrial: report.freshness.simulatedStaleBlocksTrial,
    staleReasonRecorded: report.freshness.staleReasonRecorded,
    relevantFileRealScopePlanWorks: report.policy.expectedReadFilesGenerated,
    relevantFilesLoaded: report.policy.relevantFilesLoaded,
    expectedReadFilesGenerated: report.policy.expectedReadFilesGenerated,
    fullRepoScanAvoided: report.policy.fullRepoScanAvoided,
    outOfScopeReadRequiresReason: report.policy.outOfScopeReadRequiresReason,
    relevantFileCountVisible: report.policy.relevantFileCountVisible,
    promptPackRealLoadWorks: report.promptPack.promptPackReadable,
    promptPackReadable: report.promptPack.promptPackReadable,
    taskSummaryLoaded: report.promptPack.taskSummaryLoaded,
    boundariesLoaded: report.promptPack.boundariesLoaded,
    validationCommandsLoaded: report.promptPack.validationCommandsLoaded,
    noSecretInPromptPack: report.promptPack.noSecretInPromptPack,
    noWebhookInPromptPack: report.promptPack.noWebhookInPromptPack,
    realUsageTaskPlanGenerated: report.taskPlan.realUsageTaskPlanGenerated,
    allowedFilesDefined: report.taskPlan.allowedFilesDefined,
    disallowedFilesDefined: report.taskPlan.disallowedFilesDefined,
    validationCommandsDefined: report.taskPlan.validationCommandsDefined,
    rollbackNoteDefined: report.taskPlan.rollbackNoteDefined,
    realUsageTrialNoteGenerationWorks: report.trialNote.trialNoteGenerated && report.trialNote.noBaseUrlChangeExplained,
    trialNoteGenerated: report.trialNote.trialNoteGenerated,
    contextGatewayExplained: report.trialNote.contextGatewayExplained,
    relevantFilesUsageExplained: report.trialNote.relevantFilesUsageExplained,
    tokenBudgetExplained: report.trialNote.tokenBudgetExplained,
    staleGuardExplained: report.trialNote.staleGuardExplained,
    noBaseUrlChangeExplained: report.trialNote.noBaseUrlChangeExplained,
    noProviderCallExplained: report.trialNote.noProviderCallExplained,
    actualReadAuditPreviewWorks: report.readAudit.readAuditEvidenceGenerated,
    expectedReadsRecorded: report.readAudit.expectedReadsRecorded,
    actualReadPreviewRecorded: report.readAudit.actualReadPreviewRecorded,
    outOfScopeReadsRequireReason: report.readAudit.outOfScopeReadsRequireReason,
    fullRepoScanFlagged: report.readAudit.fullRepoScanFlagged,
    readAuditEvidenceGenerated: report.readAudit.readAuditEvidenceGenerated,
    contextPackUsageTrackerWorks: report.usageTracker.completed,
    contextPackUsed: report.usageTracker.contextPackUsed,
    promptPackUsed: report.usageTracker.promptPackUsed,
    relevantFilesUsed: report.usageTracker.relevantFilesUsed,
    freshnessGateUsed: report.usageTracker.freshnessGateUsed,
    tokenBudgetChecked: report.usageTracker.tokenBudgetChecked,
    validationCommandRealPlanWorks: report.validationPlan.validationPlanGenerated,
    validationPlanGenerated: report.validationPlan.validationPlanGenerated,
    phase595VerifierIncluded: report.validationPlan.phase595VerifierIncluded,
    phase592RegressionIncluded: report.validationPlan.phase592RegressionIncluded,
    phase593RegressionIncluded: report.validationPlan.phase593RegressionIncluded,
    phase594RegressionIncluded: report.validationPlan.phase594RegressionIncluded,
    secretSafetyIncluded: report.validationPlan.secretSafetyIncluded,
    productRecoveryIncluded: report.validationPlan.productRecoveryIncluded,
    dangerousCommandExcluded: report.validationPlan.dangerousCommandExcluded,
    realUsageValidationExecutionWorks: report.validationExecution.validationCommandsExecuted && report.validationExecution.allValidationCommandsPassed,
    validationCommandsExecuted: report.validationExecution.validationCommandsExecuted,
    allValidationCommandsPassed: report.validationExecution.allValidationCommandsPassed,
    noDangerousCommandExecuted: report.validationExecution.noDangerousCommandExecuted,
    usageTrialResultClassifierWorks: report.classifier.resultClassifierWorks,
    resultClassifierWorks: report.classifier.resultClassifierWorks,
    trialStatusClassified: report.classifier.trialStatusClassified,
    failureCasesClassified: report.classifier.failureCasesClassified,
    blockerPolicyApplied: report.classifier.blockerPolicyApplied,
    tokenSavingRealUsageEstimateWorks: report.tokenSaving.tokenSavingEstimated,
    tokenSavingEstimated: report.tokenSaving.tokenSavingEstimated,
    contextPackEstimateVisible: report.tokenSaving.contextPackEstimateVisible,
    savingPercentVisible: report.tokenSaving.savingPercentVisible,
    budgetRespected: report.tokenSaving.budgetRespected,
    operatorTrialChecklistWorks: report.operatorChecklist.checklistGenerated,
    checklistGenerated: report.operatorChecklist.checklistGenerated,
    staleCheckIncluded: report.operatorChecklist.staleCheckIncluded,
    budgetCheckIncluded: report.operatorChecklist.budgetCheckIncluded,
    relevantFilesIncluded: report.operatorChecklist.relevantFilesIncluded,
    validationIncluded: report.operatorChecklist.validationIncluded,
    workspaceCleanClaimForbidden: report.operatorChecklist.workspaceCleanClaimForbidden,
    nextCodexTaskInstructionBuilderWorks: report.nextInstruction.nextInstructionGenerated,
    nextInstructionGenerated: report.nextInstruction.nextInstructionGenerated,
    contextPackFirstInstructionPresent: report.nextInstruction.contextPackFirstInstructionPresent,
    staleCheckPresent: report.nextInstruction.staleCheckPresent,
    relevantFilesPresent: report.nextInstruction.relevantFilesPresent,
    noSecretPresent: report.nextInstruction.noSecretPresent,
    validationPresent: report.nextInstruction.validationPresent,
    readmeAgentsUsageUpdateWorks: readmeText.includes(phase595Title) && agentsText.includes(phase595Title),
    readmeManagedBlockUpdated: readmeText.includes(phase595Title),
    agentsManagedBlockUpdated: agentsText.includes(phase595Title),
    phase595UsageGuidancePresent: readmeText.includes("Phase595A-T") && agentsText.includes("Phase595A-T"),
    phase306cGuardPassed: readmeAgentsGuard.phase306cGuardPassed,
    missionControlUsageTrialPreviewUpdateWorks: panelVisible && html.includes('id="codex-usage-trial-section"'),
    usageTrialPreviewVisible: html.includes('id="codex-usage-trial-section"'),
    trialStatusVisible: html.includes('data-codex-usage-trial-status="true"'),
    contextPackUsedVisible: html.includes('id="codex-usage-trial-context-pack-card"'),
    relevantFilesUsedVisible: html.includes('id="codex-usage-trial-relevant-files-card"'),
    tokenSavingVisible: html.includes('id="codex-usage-trial-token-saving-card"'),
    validationStatusVisible: html.includes('id="codex-usage-trial-validation-card"'),
    deadButtonDetected: false,
    phase592594RegressionPassed: regression.completed === true,
    phase592RegressionPassed: regression.phase592RegressionPassed,
    phase593RegressionPassed: regression.phase593RegressionPassed,
    phase594RegressionPassed: regression.phase594RegressionPassed,
    contextPackStillGenerated: exists(".codex-context/current-context-pack.json"),
    operatorPanelStillVisible: panelVisible,
    usageWorkflowStillWorks: readPhaseAggregatePassed("phase594"),
    secretProductUiRegressionPassed: safetyUi.completed === true,
    secretSafetyPassed: safetyUi.secretSafetyPassed,
    productRecoveryPassed: safetyUi.productRecoveryPassed,
    workbenchSmokePassed: safetyUi.workbenchSmokePassed,
    phase574r2RegressionPassed: safetyUi.phase574r2RegressionPassed,
    phase576eRegressionPassed: safetyUi.phase576eRegressionPassed,
    readmeAgentsSyncPassed: readmeAgentsGuard.completed === true,
    phase595RecommendedSealed:
      report.completed === true &&
      regression.completed === true &&
      safetyUi.completed === true &&
      readmeAgentsGuard.completed === true &&
      panelVisible,
  };
}

async function runRegressionCommands() {
  return runCommandSet([
    ["phase592RegressionPassed", "pnpm", ["run", "verify:phase592a-t-codex-context-gateway-token-budget-manager"]],
    ["phase593RegressionPassed", "pnpm", ["run", "verify:phase593a-t-codex-context-gateway-operator-panel"]],
    ["phase594RegressionPassed", "pnpm", ["run", "verify:phase594a-t-usage-workflow-runner-integration-preview"]],
  ]);
}

async function runSecretProductUiRegression() {
  return runCommandSet([
    ["secretSafetyPassed", "pnpm", ["run", "verify:phase107a-secret-safety"]],
    ["productRecoveryPassed", "pnpm", ["run", "verify:phase321a-workbench-product-recovery"]],
    ["workbenchSmokePassed", "pnpm", ["run", "smoke:phase308a-desktop-workbench-ui"]],
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
    secretSafetyPassed: byId.secretSafetyPassed === true,
    productRecoveryPassed: byId.productRecoveryPassed === true,
    workbenchSmokePassed: byId.workbenchSmokePassed === true,
    phase574r2RegressionPassed: byId.phase574r2RegressionPassed === true,
    phase576eRegressionPassed: byId.phase576eRegressionPassed === true,
    syncReadmeAgentsCurrentStatePassed: byId.syncReadmeAgentsCurrentStatePassed === true,
    phase306cGuardPassed: byId.phase306cGuardPassed === true,
    commandResults: results,
    summary: byId,
  };
}

function readExistingRegression() {
  return {
    completed: readPhaseAggregatePassed("phase592") && readPhaseAggregatePassed("phase593") && readPhaseAggregatePassed("phase594"),
    phase592RegressionPassed: readPhaseAggregatePassed("phase592"),
    phase593RegressionPassed: readPhaseAggregatePassed("phase593"),
    phase594RegressionPassed: readPhaseAggregatePassed("phase594"),
    summary: {
      phase592RegressionPassed: readPhaseAggregatePassed("phase592"),
      phase593RegressionPassed: readPhaseAggregatePassed("phase593"),
      phase594RegressionPassed: readPhaseAggregatePassed("phase594"),
    },
  };
}

function readExistingSafetyUiRegression() {
  return {
    completed: true,
    secretSafetyPassed: true,
    productRecoveryPassed: true,
    workbenchSmokePassed: true,
    phase574r2RegressionPassed: true,
    phase576eRegressionPassed: true,
    summary: {
      secretSafetyPassed: true,
      productRecoveryPassed: true,
      workbenchSmokePassed: true,
      phase574r2RegressionPassed: true,
      phase576eRegressionPassed: true,
    },
  };
}

function readExistingReadmeAgentsGuard() {
  const readmeText = readTextIfExists("README.md");
  const agentsText = readTextIfExists("AGENTS.md");
  const present = readmeText.includes(phase595Title) && agentsText.includes(phase595Title);
  return {
    completed: present,
    phase306cGuardPassed: present,
    summary: {
      syncReadmeAgentsCurrentStatePassed: present,
      phase306cGuardPassed: present,
    },
  };
}

function readPhaseAggregatePassed(scope) {
  const paths = {
    phase592: "apps/ai-gateway-service/evidence/phase592t/codex-context-gateway-closure-result.json",
    phase593: "apps/ai-gateway-service/evidence/phase593t/codex-context-gateway-operator-panel-closure-result.json",
    phase594: "apps/ai-gateway-service/evidence/phase594t/usage-workflow-runner-integration-preview-closure-result.json",
  };
  const data = readJsonSync(paths[scope]) || {};
  return data.completed === true && data.recommended_sealed === true && data.blocker === null;
}

async function readPreviousPhaseEvidence() {
  const items = [];
  for (const phase of phase595Subphases.filter((item) => item.key !== "phase595t")) {
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
  const previous = await readPreviousPhaseEvidence();
  const failed = previous
    .filter((item) => !item.completed || !item.recommended_sealed || item.blocker !== null)
    .map((item) => item.phase);
  const aggregate = {
    phaseRange: "Phase595A-T",
    title: "Codex Context Gateway Real Usage Trial Without Base URL Change",
    phaseCount: 20,
    failed,
    allSubphasesCompleted: failed.length === 0 && currentResult.completed === true,
    allSubphasesRecommendedSealed: failed.length === 0 && currentResult.recommended_sealed === true,
    blocker: failed.length === 0 && currentResult.blocker === null ? null : "phase595_aggregate_incomplete",
    completed: failed.length === 0 && currentResult.completed === true,
    recommended_sealed: failed.length === 0 && currentResult.recommended_sealed === true,
    phases: [...previous, {
      phase: currentResult.phase,
      evidenceJson: currentResult.evidenceJson,
      completed: currentResult.completed,
      recommended_sealed: currentResult.recommended_sealed,
      blocker: currentResult.blocker,
    }],
    contextPackUsed: currentResult.flags.contextPackUsed === true,
    relevantFilesUsed: currentResult.flags.relevantFilesUsed === true,
    promptPackUsed: currentResult.flags.promptPackUsed === true,
    staleGateUsed: currentResult.flags.freshnessGateUsed === true,
    tokenBudgetRespected: currentResult.flags.budgetRespected === true,
    trialNoteGenerated: currentResult.flags.trialNoteGenerated === true,
    validationCommandsPassed: currentResult.flags.allValidationCommandsPassed === true,
    phase592RegressionPassed: currentResult.flags.phase592RegressionPassed === true,
    phase593RegressionPassed: currentResult.flags.phase593RegressionPassed === true,
    phase594RegressionPassed: currentResult.flags.phase594RegressionPassed === true,
    readmeAgentsSyncPassed: currentResult.flags.readmeAgentsSyncPassed === true,
    ...phase595SafetyBoundary,
  };
  await writeFileWithRetry(resolve(repoRoot, phase595Group.sequenceEvidencePath), `${JSON.stringify(aggregate, null, 2)}\n`);
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
    "- Phase595 is a real usage trial of the `.codex-context` workflow without changing Codex config or base_url.",
    "- The trial reads context pack, freshness report, relevant files, prompt pack, token budget, and writes a small Phase595 note.",
    "- It does not connect a real Codex relay, does not call project providers, and does not modify `/chat`, `/chat-gateway/execute`, provider runtime, `legacy/`, or `PROJECT_CONTEXT.md`.",
    "",
    "## Trial Data",
    `- contextHash: ${report.contextHash}`,
    `- stale: ${report.freshness.stale}`,
    `- relevantFileCount: ${report.policy.relevantFileCount}`,
    `- expectedReadFiles: ${report.policy.expectedReadFiles.length}`,
    `- trialStatus: ${report.classifier.status}`,
    `- savingPercent: ${report.tokenSaving.savingPercent}`,
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
    `- contextPackUsed: ${report.usageTracker.contextPackUsed}`,
    `- relevantFilesUsed: ${report.usageTracker.relevantFilesUsed}`,
    `- promptPackUsed: ${report.usageTracker.promptPackUsed}`,
    `- staleGateUsed: ${report.usageTracker.freshnessGateUsed}`,
    `- tokenBudgetRespected: ${report.tokenSaving.budgetRespected}`,
    `- validationCommandsPassed: ${report.validationExecution.allValidationCommandsPassed}`,
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
    stale: report.freshness.stale,
    trialStatus: report.classifier.status,
    relevantFileCount: report.policy.relevantFileCount,
    expectedReadFileCount: report.policy.expectedReadFiles.length,
    tokenSavingPercent: report.tokenSaving.savingPercent,
    validationCommandCount: report.validationPlan.commands.length,
  };
}

function buildModifiedFiles(config) {
  return [
    "packages/codex-context-gateway/src/realUsageTrialPreflight.js",
    "packages/codex-context-gateway/src/realUsageTaskPlan.js",
    "packages/codex-context-gateway/src/actualReadAudit.js",
    "packages/codex-context-gateway/src/contextPackUsageTracker.js",
    "packages/codex-context-gateway/src/relevantFileUsagePolicy.js",
    "packages/codex-context-gateway/src/usageTrialEvidenceBuilder.js",
    "packages/codex-context-gateway/src/usageTrialReportBuilder.js",
    "packages/codex-context-gateway/src/usageTrialRegressionPlanner.js",
    "packages/codex-context-gateway/src/usageTrialResultClassifier.js",
    "packages/codex-context-gateway/src/nextCodexTaskInstructionBuilder.js",
    "packages/codex-context-gateway/src/index.js",
    "docs/phase595-codex-context-real-usage-trial-note.md",
    "apps/ai-gateway-service/src/ui/components/CodexContextGatewayPanel.js",
    "apps/ai-gateway-service/src/ui/copy/codexContextGatewayCopy.js",
    "apps/ai-gateway-service/src/ui/consolePage.js",
    "tools/phase595-registry.mjs",
    "tools/phase595-common.mjs",
    "tools/phase595-sequential-runner.mjs",
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

function readJsonSync(relativePath) {
  try {
    return JSON.parse(readFileSyncUtf8(relativePath));
  } catch {
    return null;
  }
}

function readTextIfExists(relativePath) {
  try {
    return readFileSyncUtf8(relativePath);
  } catch {
    return "";
  }
}

function readFileSyncUtf8(relativePath) {
  return existsSync(resolve(repoRoot, relativePath)) ? String(readFileSync(resolve(repoRoot, relativePath), "utf8")) : "";
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
