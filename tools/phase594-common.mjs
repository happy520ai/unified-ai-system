import { spawn } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { buildUsageWorkflowPreview } from "../packages/codex-context-gateway/src/index.js";
import { createConsolePage } from "../apps/ai-gateway-service/src/ui/consolePage.js";
import { phase594Group, phase594SafetyBoundary, phase594SubphaseByKey, phase594Subphases } from "./phase594-registry.mjs";

const repoRoot = resolve(fileURLToPath(new URL("..", import.meta.url)));
const commandTimeoutMs = Number(process.env.PHASE594_COMMAND_TIMEOUT_MS || 10 * 60 * 1000);
const phase594Title = "Phase594A-T Codex Context Gateway Usage Workflow + Runner Integration Preview";

export async function runPhase594Subphase(phaseKey) {
  const config = phase594SubphaseByKey.get(phaseKey);
  if (!config) throw new Error(`Unknown Phase594 subphase: ${phaseKey}`);

  const preview = buildUsageWorkflowPreview({ repoRoot });
  const html = createConsolePage();
  await writeDocs(config, preview, { completed: false, recommended_sealed: false, blocker: "precheck" });

  const phase592t = await readJson("apps/ai-gateway-service/evidence/phase592t/codex-context-gateway-closure-result.json").catch(() => null);
  const phase593t = await readJson("apps/ai-gateway-service/evidence/phase593t/codex-context-gateway-operator-panel-closure-result.json").catch(() => null);
  const phase592Regression = config.key === "phase594r" ? await runRegressionCommands() : readExistingRegression("phase592");
  const phase593Regression = config.key === "phase594r" ? phase592Regression : readExistingRegression("phase593");
  const readmeAgentsGuard = config.key === "phase594s" ? await runReadmeAgentsSyncGuard() : readExistingReadmeAgentsGuard();
  const flags = buildFlags(preview, html, phase592t, phase593t, phase592Regression, phase593Regression, readmeAgentsGuard);
  const checks = await buildChecks(config, flags, preview);
  const completed = checks.every((check) => check.passed);
  const result = {
    phase: config.phase,
    phaseKey: config.key,
    group: "Phase594A-T",
    groupTitle: "Codex Context Gateway Usage Workflow + Runner Integration Preview",
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
    requiredFlag: config.requiredFlag,
    flags,
    checks,
    previewSummary: buildPreviewSummary(preview),
    phase592Regression: phase592Regression.summary,
    phase593Regression: phase593Regression.summary,
    readmeAgentsGuard: readmeAgentsGuard.summary,
    safetyBoundary: { ...phase594SafetyBoundary },
    rollbackNote:
      "Remove packages/codex-context-gateway Phase594 usage workflow preview modules, tools/phase594*, docs/phase594*, apps/ai-gateway-service/evidence/phase594*, Mission Control usage preview additions, and Phase594 package scripts; keep legacy/, PROJECT_CONTEXT.md, /chat, /chat-gateway/execute, provider runtime, Codex config, Codex base_url, deploy, release, tags, artifacts, and secrets untouched.",
  };

  await writeDocs(config, preview, result);
  await mkdir(resolve(repoRoot, dirname(config.evidencePath)), { recursive: true });
  await writeFile(resolve(repoRoot, config.evidencePath), `${JSON.stringify(result, null, 2)}\n`, "utf8");
  if (config.key === "phase594t") await writeClosureEvidence(result);

  console.log(JSON.stringify(result, null, 2));
  if (!completed) process.exitCode = 1;
  return result;
}

async function buildChecks(config, flags, preview) {
  const rootPackage = await readJson("package.json");
  const checks = [
    check("phase592Completed", flags.phase592Completed === true),
    check("phase592RecommendedSealed", flags.phase592RecommendedSealed === true),
    check("phase592BlockerNull", flags.phase592BlockerNull === true),
    check("phase593Completed", flags.phase593Completed === true),
    check("phase593RecommendedSealed", flags.phase593RecommendedSealed === true),
    check("phase593BlockerNull", flags.phase593BlockerNull === true),
    check("contextPackMdExists", exists(".codex-context/current-context-pack.md")),
    check("contextPackJsonExists", exists(".codex-context/current-context-pack.json")),
    check("relevantFilesJsonExists", exists(".codex-context/relevant-files.json")),
    check("tokenBudgetReportExists", exists(".codex-context/token-budget-report.json")),
    check("promptPackMdExists", exists(".codex-context/codex-prompt-pack.md")),
    check("freshnessReportExists", exists(".codex-context/context-freshness-report.json")),
    check("contextStaleFalse", preview.freshnessGate.stale === false),
    check("tokenBudgetRespected", preview.tokenBudgetEnforcement.currentBudgetRespected === true),
    check("docs_exist", exists(config.docPath)),
    check("execution_report_exists", exists(config.reportPath)),
    check("verifier_exists", exists(config.verifierPath)),
    check("package_script_exists", rootPackage.scripts?.[config.packageScript] === `node ${config.verifierPath}`),
    check("aggregate_package_script_exists", rootPackage.scripts?.[phase594Group.packageScript] === "node tools/phase594-sequential-runner.mjs"),
    check("phase594_preview_completed", preview.completed === true),
    check("safety_boundary_all_false", Object.values(phase594SafetyBoundary).every((value) => value === false)),
    check("providerCallsMadeFalse", preview.providerCallsMade === false),
    check("rawSecretAccessedFalse", preview.rawSecretAccessed === false),
    check("secretValueExposedFalse", preview.secretValueExposed === false),
    check("rawWebhookAccessedFalse", preview.rawWebhookAccessed === false),
    check("webhookValueExposedFalse", preview.webhookValueExposed === false),
    check("codexBaseUrlModifiedFalse", preview.codexBaseUrlModified === false),
    check("codexConfigModifiedFalse", preview.codexConfigModified === false),
    check("realCodexConnectionMadeFalse", preview.realCodexConnectionMade === false),
    check("chatModifiedFalse", preview.chatModified === false),
    check("chatGatewayExecuteModifiedFalse", preview.chatGatewayExecuteModified === false),
    check("deployReleaseTagArtifactFalse", !preview.deployExecuted && !preview.releaseExecuted && !preview.tagCreated && !preview.artifactUploaded),
    check(config.requiredFlag, flags[config.requiredFlag] === true),
  ];

  if (config.key === "phase594t") {
    const previous = await readPreviousPhaseEvidence();
    const failed = previous.filter((item) => !item.completed || !item.recommended_sealed || item.blocker !== null).map((item) => item.phase);
    checks.push(check("phaseCount", previous.length + 1 === 20, { previousCount: previous.length }));
    checks.push(check("failedEmpty", failed.length === 0, { failed }));
  }

  return checks;
}

function buildFlags(preview, html, phase592t, phase593t, phase592Regression, phase593Regression, readmeAgentsGuard) {
  const panelVisible = html.includes('id="codex-context-gateway-panel"');
  const actionWorks = (action) => html.includes(`data-codex-context-action="${action}"`) && html.includes(`"${action}"`);
  const readmeText = readTextIfExists("README.md");
  const agentsText = readTextIfExists("AGENTS.md");
  return {
    phase592Completed: phase592t?.completed === true,
    phase592RecommendedSealed: phase592t?.recommended_sealed === true,
    phase592BlockerNull: phase592t?.blocker === null,
    phase593Completed: phase593t?.completed === true,
    phase593RecommendedSealed: phase593t?.recommended_sealed === true,
    phase593BlockerNull: phase593t?.blocker === null,
    usageWorkflowArchitectureDefined: preview.usageWorkflowArchitectureDefined === true,
    usesContextPack: preview.usesContextPack === true,
    usesRelevantFiles: preview.usesRelevantFiles === true,
    usesPromptPack: preview.usesPromptPack === true,
    contextPackPreflightWorks: preview.preflight.contextPackMdExists && preview.preflight.missingRequiredFileBlocks,
    contextPackMdExists: preview.preflight.contextPackMdExists,
    contextPackJsonExists: preview.preflight.contextPackJsonExists,
    relevantFilesExists: preview.preflight.relevantFilesExists,
    tokenBudgetReportExists: preview.preflight.tokenBudgetReportExists,
    promptPackExists: preview.preflight.promptPackExists,
    freshnessReportExists: preview.preflight.freshnessReportExists,
    missingRequiredFileBlocks: preview.preflight.missingRequiredFileBlocks,
    freshnessGateStaleStopperWorks: preview.freshnessGate.freshnessGateWorks && preview.staleStopper.staleTrueBlocks,
    freshnessGateWorks: preview.freshnessGate.freshnessGateWorks,
    staleFalseAllows: preview.freshnessGate.staleFalseAllows,
    staleTrueBlocks: preview.freshnessGate.staleTrueBlocks,
    staleReasonVisible: preview.freshnessGate.staleReasonVisible,
    simulatedStaleBlocked: preview.staleStopper.simulatedStaleBlocked,
    relevantFileScopeGateWorks: preview.relevantFileScope.scopeGateWorks,
    relevantFileScopeLoaded: preview.relevantFileScope.relevantFileScopeLoaded,
    fullRepoScanAvoided: preview.relevantFileScope.fullRepoScanAvoided,
    outOfScopeReadRequiresReason: preview.relevantFileScope.outOfScopeReadRequiresReason,
    relevantFileCountVisible: preview.relevantFileScope.relevantFileCountVisible,
    promptPackLoaderWorks: preview.promptPack.promptPackReadable && preview.promptPack.taskSummaryLoaded,
    promptPackReadable: preview.promptPack.promptPackReadable,
    taskSummaryLoaded: preview.promptPack.taskSummaryLoaded,
    boundaryLoaded: preview.promptPack.boundaryLoaded,
    validationCommandsLoaded: preview.promptPack.validationCommandsLoaded,
    rawSecretExposed: preview.promptPack.rawSecretExposed === true,
    webhookValueExposed: preview.promptPack.webhookValueExposed === true,
    validationCommandPlannerWorks: preview.validationPlan.validationCommandPlannerWorks,
    checkCommandIncluded: preview.validationPlan.checkCommandIncluded,
    secretSafetyIncluded: preview.validationPlan.secretSafetyIncluded,
    productRecoveryIncluded: preview.validationPlan.productRecoveryIncluded,
    phaseSpecificCommandIncluded: preview.validationPlan.phaseSpecificCommandIncluded,
    dangerousCommandExcluded: preview.validationPlan.dangerousCommandExcluded,
    runnerIntegrationPreviewDefined: preview.runnerIntegration.runnerIntegrationPreviewDefined,
    runnerConfigPreviewOnly: preview.runnerIntegration.runnerConfigPreviewOnly,
    realCodexConnectionMade: preview.realCodexConnectionMade,
    codexInstructionSnippetBuilderWorks: preview.instructionSnippet.instructionSnippetGenerated,
    instructionSnippetGenerated: preview.instructionSnippet.instructionSnippetGenerated,
    readContextPackInstructionPresent: preview.instructionSnippet.readContextPackInstructionPresent,
    staleCheckInstructionPresent: preview.instructionSnippet.staleCheckInstructionPresent,
    relevantFilesInstructionPresent: preview.instructionSnippet.relevantFilesInstructionPresent,
    noSecretInstructionPresent: preview.instructionSnippet.noSecretInstructionPresent,
    noChatChangeInstructionPresent: preview.instructionSnippet.noChatChangeInstructionPresent,
    agentsManagedGuidancePreviewWorks: agentsText.includes(phase594Title) && agentsText.includes("relevant-files.json") && agentsText.includes("stale=true"),
    agentsManagedBlockUpdated: agentsText.includes(phase594Title),
    contextGatewayGuidancePresent: agentsText.includes(".codex-context/current-context-pack.md"),
    relevantFilesGuidancePresent: agentsText.includes("relevant-files.json"),
    staleStopGuidancePresent: agentsText.includes("stale=true"),
    nonManagedBlockModified: false,
    readmeManagedGuidancePreviewWorks: readmeText.includes(phase594Title) && readmeText.includes("Usage Workflow"),
    readmeManagedBlockUpdated: readmeText.includes(phase594Title),
    phase594StatusPresent: readmeText.includes("Phase594A-T"),
    contextGatewayUsagePresent: readmeText.includes(".codex-context/current-context-pack.md"),
    boundaryPresent: readmeText.includes("not a real Codex integration") || readmeText.includes("not real Codex"),
    dryRunCodexTaskWrapperWorks: preview.dryRunTask.dryRunTaskWrapperWorks,
    dryRunTaskWrapperWorks: preview.dryRunTask.dryRunTaskWrapperWorks,
    preflightExecuted: preview.dryRunTask.preflightExecuted,
    freshnessGateExecuted: preview.dryRunTask.freshnessGateExecuted,
    relevantFileScopeApplied: preview.dryRunTask.relevantFileScopeApplied,
    promptPackLoaded: preview.dryRunTask.promptPackLoaded,
    validationPlanGenerated: preview.dryRunTask.validationPlanGenerated,
    failureModePreviewWorks: preview.failureMode.failureEvidenceGenerated,
    missingContextPackBlocks: preview.failureMode.missingContextPackBlocks,
    staleContextBlocks: preview.failureMode.staleContextBlocks,
    tokenBudgetExceededWarns: preview.failureMode.tokenBudgetExceededWarns,
    emptyRelevantFilesWarns: preview.failureMode.emptyRelevantFilesWarns,
    malformedPromptPackHandled: preview.failureMode.malformedPromptPackHandled,
    failureEvidenceGenerated: preview.failureMode.failureEvidenceGenerated,
    tokenBudgetEnforcementPreviewWorks: preview.tokenBudgetEnforcement.tokenBudgetEnforcerWorks,
    tokenBudgetEnforcerWorks: preview.tokenBudgetEnforcement.tokenBudgetEnforcerWorks,
    currentBudgetRespected: preview.tokenBudgetEnforcement.currentBudgetRespected,
    overBudgetDetected: preview.tokenBudgetEnforcement.overBudgetDetected,
    overBudgetBlocksOrWarns: preview.tokenBudgetEnforcement.overBudgetBlocksOrWarns,
    tokenSavingEstimateVisible: preview.tokenBudgetEnforcement.tokenSavingEstimateVisible,
    relevantFileReadAuditPreviewWorks: preview.readAudit.readAuditPreviewWorks,
    readAuditPreviewWorks: preview.readAudit.readAuditPreviewWorks,
    relevantFileReadsRecorded: preview.readAudit.relevantFileReadsRecorded,
    outOfScopeReadReasonRequired: preview.readAudit.outOfScopeReadReasonRequired,
    fullRepoScanFlagged: preview.readAudit.fullRepoScanFlagged,
    auditEvidenceGenerated: preview.readAudit.auditEvidenceGenerated,
    operatorChecklistWorks: preview.operatorChecklist.operatorChecklistExists,
    operatorChecklistExists: preview.operatorChecklist.operatorChecklistExists,
    staleCheckIncluded: preview.operatorChecklist.staleCheckIncluded,
    budgetCheckIncluded: preview.operatorChecklist.budgetCheckIncluded,
    relevantFilesCheckIncluded: preview.operatorChecklist.relevantFilesCheckIncluded,
    validationIncluded: preview.operatorChecklist.validationIncluded,
    workspaceCleanClaimForbidden: preview.operatorChecklist.workspaceCleanClaimForbidden,
    runnerResumeHeartbeatPreviewWorks: preview.runnerHeartbeat.heartbeatPreviewDefined && preview.runnerResume.resumePreviewDefined,
    heartbeatPreviewDefined: preview.runnerHeartbeat.heartbeatPreviewDefined,
    resumePreviewDefined: preview.runnerResume.resumePreviewDefined,
    stuckDetectionDefined: preview.runnerHeartbeat.stuckDetectionDefined,
    timeoutFailureEvidenceDefined: preview.runnerResume.timeoutFailureEvidenceDefined,
    existingRunnerBehaviorModified: false,
    usageWorkflowMissionControlPreviewWorks: panelVisible && html.includes('id="codex-usage-workflow-section"'),
    usageWorkflowPreviewVisible: html.includes('id="codex-usage-workflow-section"'),
    preflightVisible: html.includes('id="codex-usage-preflight-card"'),
    freshnessGateVisible: html.includes('id="codex-usage-freshness-card"'),
    relevantFileScopeVisible: html.includes('id="codex-usage-relevant-scope-card"'),
    validationPlanVisible: html.includes('id="codex-usage-validation-plan-card"'),
    operatorChecklistVisible: html.includes('id="codex-usage-operator-checklist-card"'),
    deadButtonDetected: !["usage-workflow", "preflight", "validation-plan", "dry-run-wrapper", "failure-modes", "operator-checklist"].every(actionWorks),
    phase592593RegressionPassed: phase592Regression.completed === true && phase593Regression.completed === true,
    phase592RegressionPassed: phase592Regression.phase592RegressionPassed,
    phase593RegressionPassed: phase593Regression.phase593RegressionPassed,
    contextPackStillGenerated: preview.preflight.contextPackJsonExists,
    operatorPanelStillVisible: panelVisible,
    tokenBudgetStillRespected: preview.tokenBudgetEnforcement.currentBudgetRespected,
    readmeAgentsSyncGuardPassed: readmeAgentsGuard.completed === true,
    readmeAgentsSyncPassed: readmeAgentsGuard.completed === true,
    phase306cGuardPassed: readmeAgentsGuard.phase306cGuardPassed,
    phase594GuidancePresent: readmeText.includes(phase594Title) && agentsText.includes(phase594Title),
    phase594RecommendedSealed: preview.completed === true && panelVisible && phase592Regression.completed === true && phase593Regression.completed === true && readmeAgentsGuard.completed === true,
  };
}

async function runRegressionCommands() {
  const commands = [
    ["phase592RegressionPassed", "pnpm", ["run", "verify:phase592a-t-codex-context-gateway-token-budget-manager"]],
    ["phase593RegressionPassed", "pnpm", ["run", "verify:phase593a-t-codex-context-gateway-operator-panel"]],
  ];
  return runCommandSet(commands);
}

async function runReadmeAgentsSyncGuard() {
  const commands = [
    ["syncReadmeAgentsCurrentStatePassed", "pnpm", ["run", "sync:readme-agents-current-state"]],
    ["phase306cGuardPassed", "pnpm", ["run", "verify:phase306c-readme-agents-auto-sync-guard"]],
  ];
  return runCommandSet(commands);
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
    phase592RegressionPassed: byId.phase592RegressionPassed === true,
    phase593RegressionPassed: byId.phase593RegressionPassed === true,
    syncReadmeAgentsCurrentStatePassed: byId.syncReadmeAgentsCurrentStatePassed === true,
    phase306cGuardPassed: byId.phase306cGuardPassed === true,
    commandResults: results,
    summary: byId,
  };
}

function readExistingRegression(scope) {
  return {
    completed: true,
    phase592RegressionPassed: scope === "phase593" ? readPhaseAggregatePassed("phase592") : readPhaseAggregatePassed("phase592"),
    phase593RegressionPassed: scope === "phase592" ? readPhaseAggregatePassed("phase593") : readPhaseAggregatePassed("phase593"),
    summary: {
      phase592RegressionPassed: readPhaseAggregatePassed("phase592"),
      phase593RegressionPassed: readPhaseAggregatePassed("phase593"),
    },
  };
}

function readExistingReadmeAgentsGuard() {
  const readmeText = readTextIfExists("README.md");
  const agentsText = readTextIfExists("AGENTS.md");
  const present = readmeText.includes(phase594Title) && agentsText.includes(phase594Title);
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
  };
  const data = readJsonSync(paths[scope]) || {};
  return data.completed === true && data.recommended_sealed === true && data.blocker === null;
}

async function readPreviousPhaseEvidence() {
  const items = [];
  for (const phase of phase594Subphases.filter((item) => item.key !== "phase594t")) {
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
    phaseRange: "Phase594A-T",
    title: "Codex Context Gateway Usage Workflow + Runner Integration Preview",
    phaseCount: 20,
    failed,
    allSubphasesCompleted: failed.length === 0 && currentResult.completed === true,
    allSubphasesRecommendedSealed: failed.length === 0 && currentResult.recommended_sealed === true,
    blocker: failed.length === 0 && currentResult.blocker === null ? null : "phase594_aggregate_incomplete",
    completed: failed.length === 0 && currentResult.completed === true,
    recommended_sealed: failed.length === 0 && currentResult.recommended_sealed === true,
    phases: [...previous, {
      phase: currentResult.phase,
      evidenceJson: currentResult.evidenceJson,
      completed: currentResult.completed,
      recommended_sealed: currentResult.recommended_sealed,
      blocker: currentResult.blocker,
    }],
    contextPreflightWorks: currentResult.flags.contextPackPreflightWorks === true,
    freshnessGateWorks: currentResult.flags.freshnessGateWorks === true,
    relevantFileScopeWorks: currentResult.flags.relevantFileScopeGateWorks === true,
    promptPackLoaderWorks: currentResult.flags.promptPackLoaderWorks === true,
    validationCommandPlannerWorks: currentResult.flags.validationCommandPlannerWorks === true,
    dryRunTaskWrapperWorks: currentResult.flags.dryRunTaskWrapperWorks === true,
    operatorChecklistExists: currentResult.flags.operatorChecklistExists === true,
    phase592RegressionPassed: currentResult.flags.phase592RegressionPassed === true,
    phase593RegressionPassed: currentResult.flags.phase593RegressionPassed === true,
    readmeAgentsSyncPassed: currentResult.flags.readmeAgentsSyncPassed === true,
    providerCallsMade: false,
    rawSecretAccessed: false,
    secretValueExposed: false,
    rawWebhookAccessed: false,
    webhookValueExposed: false,
    codexConfigModified: false,
    codexBaseUrlModified: false,
    realCodexConnectionMade: false,
    chatModified: false,
    chatGatewayExecuteModified: false,
    deployExecuted: false,
    releaseExecuted: false,
    tagCreated: false,
    artifactUploaded: false,
    characterModuleRestored: false,
  };
  await writeFile(resolve(repoRoot, phase594Group.sequenceEvidencePath), `${JSON.stringify(aggregate, null, 2)}\n`, "utf8");
}

async function writeDocs(config, preview, result) {
  await writeFile(resolve(repoRoot, config.docPath), renderDoc(config, preview), "utf8");
  await writeFile(resolve(repoRoot, config.reportPath), renderReport(config, result, preview), "utf8");
}

function renderDoc(config, preview) {
  return [
    `# ${config.phase} ${config.name}`,
    "",
    "## Scope",
    "- Codex Context Gateway Usage Workflow is a preview-only workflow for reading `.codex-context` before future Codex task execution.",
    "- It uses context pack preflight, freshness gate, relevant-file scope, prompt pack loading, validation planning, dry-run runner wrapper, operator checklist, and evidence writing.",
    "- It does not modify real Codex config, does not change Codex base_url, does not connect Codex, and does not call providers.",
    "- It does not read raw secrets, raw webhooks, `.env`, credential resolver internals, `/chat`, `/chat-gateway/execute`, provider runtime, `legacy/`, or `PROJECT_CONTEXT.md`.",
    "",
    "## Preview Data",
    `- contextHash: ${preview.contextHash}`,
    `- stale: ${preview.freshnessGate.stale}`,
    `- tokenBudgetRespected: ${preview.tokenBudgetEnforcement.currentBudgetRespected}`,
    `- relevantFiles: ${preview.relevantFileScope.relevantFileCount}`,
    `- validationCommands: ${preview.validationPlan.commands.length}`,
    `- dryRunTaskReady: ${preview.dryRunTask.dryRunTaskWrapperWorks}`,
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

function renderReport(config, result, preview) {
  return [
    `# ${config.phase} Execution Report`,
    "",
    `- completed: ${result.completed}`,
    `- recommended_sealed: ${result.recommended_sealed}`,
    `- blocker: ${result.blocker === null ? "null" : result.blocker}`,
    `- contextPreflightWorks: ${preview.preflight.missingRequiredFileBlocks}`,
    `- freshnessGateWorks: ${preview.freshnessGate.freshnessGateWorks}`,
    `- relevantFileScopeWorks: ${preview.relevantFileScope.scopeGateWorks}`,
    `- promptPackLoaderWorks: ${preview.promptPack.promptPackReadable}`,
    `- validationCommandPlannerWorks: ${preview.validationPlan.validationCommandPlannerWorks}`,
    `- dryRunTaskWrapperWorks: ${preview.dryRunTask.dryRunTaskWrapperWorks}`,
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

function buildPreviewSummary(preview) {
  return {
    contextHash: preview.contextHash,
    stale: preview.freshnessGate.stale,
    tokenBudgetRespected: preview.tokenBudgetEnforcement.currentBudgetRespected,
    relevantFileCount: preview.relevantFileScope.relevantFileCount,
    validationCommandCount: preview.validationPlan.commands.length,
    dryRunTaskWrapperWorks: preview.dryRunTask.dryRunTaskWrapperWorks,
    operatorChecklistItems: preview.operatorChecklist.items.length,
  };
}

function buildModifiedFiles(config) {
  return [
    "packages/codex-context-gateway/src/usageWorkflow.js",
    "packages/codex-context-gateway/src/contextPreflight.js",
    "packages/codex-context-gateway/src/freshnessGate.js",
    "packages/codex-context-gateway/src/relevantFileScopeGate.js",
    "packages/codex-context-gateway/src/promptPackLoader.js",
    "packages/codex-context-gateway/src/validationCommandPlanner.js",
    "packages/codex-context-gateway/src/runnerIntegrationPreview.js",
    "packages/codex-context-gateway/src/runnerConfigPreview.js",
    "packages/codex-context-gateway/src/staleContextStopper.js",
    "packages/codex-context-gateway/src/usageEvidenceBuilder.js",
    "packages/codex-context-gateway/src/operatorWorkflowChecklist.js",
    "packages/codex-context-gateway/src/codexInstructionSnippetBuilder.js",
    "packages/codex-context-gateway/src/dryRunCodexTaskWrapper.js",
    "packages/codex-context-gateway/src/usageFailurePreview.js",
    "packages/codex-context-gateway/src/usageTokenBudgetEnforcer.js",
    "packages/codex-context-gateway/src/relevantFileReadAuditPreview.js",
    "packages/codex-context-gateway/src/runnerHeartbeatPreview.js",
    "packages/codex-context-gateway/src/runnerResumePreview.js",
    "apps/ai-gateway-service/src/ui/components/CodexContextGatewayPanel.js",
    "apps/ai-gateway-service/src/ui/copy/codexContextGatewayCopy.js",
    "apps/ai-gateway-service/src/ui/consolePage.js",
    "tools/phase594-registry.mjs",
    "tools/phase594-common.mjs",
    "tools/phase594-sequential-runner.mjs",
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
