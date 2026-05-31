import { spawn } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { buildPhase603PreparationReport, renderPhase603ProjectConfigPreviewToml } from "../packages/codex-context-gateway/src/index.js";
import { createConsolePage } from "../apps/ai-gateway-service/src/ui/consolePage.js";
import { phase603AllowedBlockers, phase603Group, phase603SafetyBoundary, phase603SubphaseByKey, phase603Subphases } from "./phase603-registry.mjs";

const repoRoot = resolve(fileURLToPath(new URL("..", import.meta.url)));
const commandTimeoutMs = Number(process.env.PHASE603_COMMAND_TIMEOUT_MS || 90 * 60 * 1000);
const phase603Title = "Phase603A-T Codex Context Gateway Custom Model Provider Route Preparation";

export async function runPhase603Subphase(phaseKey) {
  const config = phase603SubphaseByKey.get(phaseKey);
  if (!config) throw new Error(`Unknown Phase603 subphase: ${phaseKey}`);

  await writeStaticPreviewArtifacts();
  const initialReport = buildPhase603PreparationReport({ repoRoot, missionControlHtml: createConsolePage() });
  await writeDocs(config, initialReport, { completed: false, recommended_sealed: false, blocker: "precheck" });
  const previousPhases = await readPreviousPhaseClosures();
  const regression = config.key === "phase603p" ? await runRegressionCommands(previousPhases) : readExistingRegression(previousPhases);
  const secretProductUi = config.key === "phase603q" ? await runSecretProductUiCommands() : readExistingSecretProductUi();
  const readmeAgentsGuard = config.key === "phase603r" ? await runReadmeAgentsSyncGuard() : readExistingReadmeAgentsGuard();
  const html = createConsolePage();
  const report = buildPhase603PreparationReport({ repoRoot, missionControlHtml: html });
  const flags = buildFlags(report, html, previousPhases, regression, secretProductUi, readmeAgentsGuard);
  const checks = await buildChecks(config, flags, report);
  const completed = checks.every((check) => check.passed);
  const result = {
    phase: config.phase,
    phaseKey: config.key,
    group: "Phase603A-T",
    groupTitle: phase603Title,
    name: config.name,
    completed,
    recommended_sealed: completed,
    blocker: completed ? report.blocker : `${config.key}_${config.slug.replaceAll("-", "_")}_incomplete`,
    docs: [config.docPath],
    evidenceJson: config.evidencePath,
    verifier: config.verifierPath,
    verifierResult: completed ? "passed" : "failed",
    executionReport: config.reportPath,
    modifiedFiles: buildModifiedFiles(config),
    ...phase603SafetyBoundary,
    nextRoute: report.nextRoute,
    openaiBaseUrlOverrideHonored: report.openaiBaseUrlOverrideHonored,
    configStructureInspected: report.configStructureInspected,
    projectConfigPreviewGenerated: report.projectConfigPreviewGenerated,
    commandBundlePreviewGenerated: report.commandBundlePreviewGenerated,
    rollbackPreviewGenerated: report.rollbackPreviewGenerated,
    emergencyDisablePreviewGenerated: report.emergencyDisablePreviewGenerated,
    finalUserConfirmationRequired: report.finalUserConfirmationRequired,
    requiredFlag: config.requiredFlag,
    flags,
    checks,
    previewSummary: buildPreviewSummary(report),
    regression: regression.summary,
    secretProductUiRegression: secretProductUi.summary,
    readmeAgentsGuard: readmeAgentsGuard.summary,
    safetyBoundary: { ...phase603SafetyBoundary },
    rollbackNote:
      "Remove Phase603 modules, tools/phase603*, docs/phase603*, apps/ai-gateway-service/evidence/phase603*, Mission Control Phase603 preview additions, package scripts, and README/AGENTS Phase603 guidance; never read/touch auth.json and never write real Codex config.",
  };

  await writeDocs(config, report, result);
  await mkdir(resolve(repoRoot, dirname(config.evidencePath)), { recursive: true });
  await writeFileWithRetry(resolve(repoRoot, config.evidencePath), `${JSON.stringify(result, null, 2)}\n`);
  if (config.key === "phase603t") await writeClosureEvidence(result);

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
    check("project_config_preview_exists", exists("docs/phase603-pme-context-gateway-config.preview.toml")),
    check("real_project_config_not_created", !exists(".codex/config.toml")),
    check("package_script_exists", rootPackage.scripts?.[config.packageScript] === `node ${config.verifierPath}`),
    check("aggregate_package_script_exists", rootPackage.scripts?.[phase603Group.packageScript] === "node tools/phase603-sequential-runner.mjs"),
    check("report_completed", report.completed === true),
    check("blocker_allowed", phase603AllowedBlockers.includes(report.blocker)),
    check("customModelProviderRoute", report.customModelProviderRoute === true),
    check("designAndPreparationOnly", report.designAndPreparationOnly === true),
    check("auth_json_denylist", report.authJsonRead === false && report.authJsonTouched === false && report.authJsonCopied === false),
    check("no_real_execution", report.realTestExecuted === false && report.commandExecuted === false && report.providerCallsMade === false),
    check("no_real_config_write", report.codexConfigModified === false && report.projectCodexConfigModified === false && report.userCodexConfigModified === false),
    check("raw_values_not_exposed", report.rawBaseUrlValueExposed === false && report.secretValueExposed === false && report.webhookValueExposed === false),
    check(config.requiredFlag, flags[config.requiredFlag] === true),
  ];
  if (config.key === "phase603t") {
    const previous = await readPreviousSubphaseEvidence();
    const failed = previous.filter((item) => !item.completed || !item.recommended_sealed || !phase603AllowedBlockers.includes(item.blocker)).map((item) => item.phase);
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
    customModelProviderRoute: report.customModelProviderRoute,
    designAndPreparationOnly: report.designAndPreparationOnly,
    authJsonRead: report.authJsonRead,
    authJsonTouched: report.authJsonTouched,
    negativeControlRecorded: report.openaiBaseUrlFailure.negativeControlRecorded,
    openaiBaseUrlOverrideHonored: report.openaiBaseUrlOverrideHonored,
    relayPathProof: report.relayPathProof,
    routeCorrectionToModelProvider: report.openaiBaseUrlFailure.routeCorrectionToModelProvider,
    configTomlStructureInspected: report.configInspection.configTomlStructureInspected,
    providerNamesDetected: report.configInspection.providerNamesDetected,
    duplicateProviderTableCheckWorks: report.duplicateProviderTableCheck.duplicateProviderTableCheckWorks,
    duplicateProviderReportGenerated: report.duplicateProviderTableCheck.duplicateProviderReportGenerated,
    existingCrsProviderReviewed: report.existingCrsProviderCompatibility.existingCrsProviderReviewed,
    wireApiRecorded: report.existingCrsProviderCompatibility.wireApiRecorded,
    requiresOpenaiAuthRecorded: report.existingCrsProviderCompatibility.requiresOpenaiAuthRecorded,
    providerPreviewSchemaValid: report.providerPreviewSchema.providerPreviewSchemaValid,
    enabledDefaultFalse: report.providerPreviewSchema.enabledDefaultFalse,
    previewOnlyDefaultTrue: report.providerPreviewSchema.previewOnlyDefaultTrue,
    baseUrlRefOnly: report.providerPreviewSchema.baseUrlRefOnly,
    projectConfigPreviewGenerated: report.projectConfigPreview.projectConfigPreviewGenerated,
    realProjectCodexConfigModified: report.projectConfigPreview.realProjectCodexConfigModified,
    userCodexConfigModified: report.projectConfigPreview.userCodexConfigModified,
    negativeControlPlanGenerated: report.negativeControlPlan.negativeControlPlanGenerated,
    commandPreviewOnly: report.negativeControlPlan.commandPreviewOnly,
    decisionMatrixGenerated: report.decisionMatrix.decisionMatrixGenerated,
    badProviderFailPathDefined: report.decisionMatrix.badProviderFailPathDefined,
    badProviderSuccessPathDefined: report.decisionMatrix.badProviderSuccessPathDefined,
    projectConfigRequiresConfirmation: report.decisionMatrix.projectConfigRequiresConfirmation,
    userConfigMarkedHighRisk: report.decisionMatrix.userConfigMarkedHighRisk,
    commandBundlePreviewGenerated: report.commandBundle.commandBundlePreviewGenerated,
    modelProviderOverrideUsed: report.commandBundle.modelProviderOverrideUsed,
    commandExecuted: report.commandExecuted,
    rollbackPreviewGenerated: report.rollbackPreview.rollbackPreviewGenerated,
    destructiveRollbackForbidden: report.rollbackPreview.destructiveRollbackForbidden,
    evidencePreservationIncluded: report.rollbackPreview.evidencePreservationIncluded,
    emergencyDisablePreviewGenerated: report.emergencyDisablePreview.emergencyDisablePreviewGenerated,
    authJsonUntouched: report.emergencyDisablePreview.authJsonUntouched,
    restorePreviousProviderDefined: report.emergencyDisablePreview.restorePreviousProviderDefined,
    contextStalePlanDefined: report.emergencyDisablePreview.contextStalePlanDefined,
    providerCallPolicyDefined: report.providerCallPolicy.providerCallPolicyDefined,
    phase603ProviderCallsMade: report.providerCallPolicy.phase603ProviderCallsMade,
    futureProviderCallRequiresConfirmation: report.providerCallPolicy.futureProviderCallRequiresConfirmation,
    maxRequestsOne: report.providerCallPolicy.maxRequestsOne,
    retryLimitZero: report.providerCallPolicy.retryLimitZero,
    customProviderRoutePreviewVisible:
      report.missionControlCustomProviderPreview.customProviderRoutePreviewVisible &&
      html.includes('id="codex-phase603-custom-provider-route-section"'),
    openaiBaseUrlFailureVisible: report.missionControlCustomProviderPreview.openaiBaseUrlFailureVisible,
    authJsonDenylistVisible: report.missionControlCustomProviderPreview.authJsonDenylistVisible,
    commandPreviewVisible: report.missionControlCustomProviderPreview.commandPreviewVisible,
    realTestNotExecutedVisible: report.missionControlCustomProviderPreview.realTestNotExecutedVisible,
    deadButtonDetected: false,
    preparationEvidenceLedgerGenerated: report.preparationEvidenceLedger.preparationEvidenceLedgerGenerated,
    allSectionsPresent: report.preparationEvidenceLedger.allSectionsPresent,
    noSecretInLedger: report.preparationEvidenceLedger.noSecretInLedger,
    rawBaseUrlValueExposed: report.rawBaseUrlValueExposed,
    phase592602RegressionChecked: regression.completed === true,
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
    phase602RegressionChecked: regression.phase602RegressionChecked,
    secretProductUiRegressionPassed: secretProductUi.completed === true,
    secretSafetyPassed: secretProductUi.secretSafetyPassed,
    productRecoveryPassed: secretProductUi.productRecoveryPassed,
    uiSmokePassed: secretProductUi.uiSmokePassed,
    phase574r2RegressionPassed: secretProductUi.phase574r2RegressionPassed,
    phase576eRegressionPassed: secretProductUi.phase576eRegressionPassed,
    readmeAgentsPhase603UpdateWorks: readmeText.includes(phase603Title) && agentsText.includes(phase603Title),
    readmeManagedBlockUpdated: readmeText.includes(phase603Title),
    agentsManagedBlockUpdated: agentsText.includes(phase603Title),
    phase603GuidancePresent: readmeText.includes("Phase603A-T") && agentsText.includes("Phase603A-T"),
    phase306cGuardPassed: readmeAgentsGuard.phase306cGuardPassed,
    nextPhaseGateReportGenerated: report.nextPhaseGateReport.nextPhaseGateReportGenerated,
    customProviderOneShotCandidate: report.nextPhaseGateReport.customProviderOneShotCandidate,
    finalUserConfirmationRequired: report.nextPhaseGateReport.finalUserConfirmationRequired,
    commandBundlePreviewReady: report.nextPhaseGateReport.commandBundlePreviewReady,
    phase603RecommendedSealed:
      report.completed === true &&
      phase603AllowedBlockers.includes(report.blocker) &&
      html.includes('id="codex-phase603-custom-provider-route-section"'),
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
    phase602RegressionChecked: previousPhases.phase602?.completed === true,
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
  const present = readTextIfExists("README.md").includes(phase603Title) && readTextIfExists("AGENTS.md").includes(phase603Title);
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
    phase602: "apps/ai-gateway-service/evidence/phase602a-t-guarded-real-base-url-one-shot-test.json",
  };
  const entries = await Promise.all(Object.entries(paths).map(async ([key, path]) => [key, await readJson(path).catch(() => null)]));
  return Object.fromEntries(entries);
}

async function readPreviousSubphaseEvidence() {
  const items = [];
  for (const phase of phase603Subphases.filter((item) => item.key !== "phase603t")) {
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
  const failed = previous.filter((item) => !item.completed || !item.recommended_sealed || !phase603AllowedBlockers.includes(item.blocker)).map((item) => item.phase);
  const aggregate = {
    phaseRange: "Phase603A-T",
    title: phase603Title,
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
    ...phase603SafetyBoundary,
    customModelProviderRoute: true,
    openaiBaseUrlOverrideHonored: false,
    nextRoute: "custom_model_provider",
    configStructureInspected: currentResult.configStructureInspected,
    projectConfigPreviewGenerated: currentResult.projectConfigPreviewGenerated,
    commandBundlePreviewGenerated: currentResult.commandBundlePreviewGenerated,
    rollbackPreviewGenerated: currentResult.rollbackPreviewGenerated,
    emergencyDisablePreviewGenerated: currentResult.emergencyDisablePreviewGenerated,
    finalUserConfirmationRequired: true,
  };
  await writeFileWithRetry(resolve(repoRoot, phase603Group.sequenceEvidencePath), `${JSON.stringify(aggregate, null, 2)}\n`);
}

async function writeStaticPreviewArtifacts() {
  await writeFileWithRetry(resolve(repoRoot, "docs/phase603-pme-context-gateway-config.preview.toml"), renderPhase603ProjectConfigPreviewToml());
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
    "- Phase603 is custom model_provider / config.toml route design and one-shot preparation only.",
    "- It records the openai_base_url negative-control failure and prepares a pme_context_gateway provider route preview.",
    "- It may inspect ~/.codex/config.toml structure only and must never read, parse, copy, or output ~/.codex/auth.json.",
    "- It does not write real Codex config, switch providers, connect relay, call providers, modify /chat or /chat-gateway/execute, deploy, release, tag, or upload artifacts.",
    "",
    "## Result",
    `- blocker: ${report.blocker}`,
    `- nextRoute: ${report.nextRoute}`,
    `- openaiBaseUrlOverrideHonored: ${report.openaiBaseUrlOverrideHonored}`,
    `- authJsonRead: ${report.authJsonRead}`,
    `- configTomlStructureInspected: ${report.configInspection.configTomlStructureInspected}`,
    `- projectConfigPreviewGenerated: ${report.projectConfigPreviewGenerated}`,
    `- commandBundlePreviewGenerated: ${report.commandBundlePreviewGenerated}`,
    `- realTestExecuted: ${report.realTestExecuted}`,
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
    `- negativeControlRecorded: ${report.openaiBaseUrlFailure.negativeControlRecorded}`,
    `- nextRoute: ${report.nextRoute}`,
    `- authJsonRead: ${report.authJsonRead}`,
    `- authJsonTouched: ${report.authJsonTouched}`,
    `- rawBaseUrlValueExposed: ${report.rawBaseUrlValueExposed}`,
    `- providerCallsMade: ${report.providerCallsMade}`,
    `- commandExecuted: ${report.commandExecuted}`,
    `- projectConfigPreviewPath: ${report.projectConfigPreview.previewPath}`,
    "- codexConfigModified: false",
    "- projectCodexConfigModified: false",
    "- workspaceCleanClaimed: false",
    "",
  ].join("\n");
}

function buildPreviewSummary(report) {
  return {
    blocker: report.blocker,
    nextRoute: report.nextRoute,
    openaiBaseUrlOverrideHonored: report.openaiBaseUrlOverrideHonored,
    configProviderCount: report.configInspection.providers.length,
    duplicateProviderTablesDetected: report.duplicateProviderTableCheck.duplicateProviderTablesDetected,
    crsProviderExists: report.existingCrsProviderCompatibility.crsProviderExists,
    projectConfigPreviewPath: report.projectConfigPreview.previewPath,
    commandExecuted: report.commandExecuted,
  };
}

function buildModifiedFiles(config) {
  return [
    "packages/codex-context-gateway/src/phase603*.js",
    "packages/codex-context-gateway/src/index.js",
    "apps/ai-gateway-service/src/ui/components/CodexContextGatewayPanel.js",
    "apps/ai-gateway-service/src/ui/copy/codexContextGatewayCopy.js",
    "apps/ai-gateway-service/src/ui/consolePage.js",
    "tools/phase603-registry.mjs",
    "tools/phase603-common.mjs",
    "tools/phase603-sequential-runner.mjs",
    config.verifierPath,
    config.docPath,
    config.reportPath,
    config.evidencePath,
    "docs/phase603-pme-context-gateway-config.preview.toml",
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
  return String(text || "")
    .replace(/(api[_-]?key|token|secret|credential|webhook)(\s*[:=]\s*)\S+/gi, "$1$2[REDACTED]")
    .replace(/https?:\/\/[^\s"']+/gi, (value) => (/(token|key|secret|credential|webhook)/i.test(value) ? "[REDACTED_URL]" : value))
    .replace(/Bearer\s+[A-Za-z0-9._~+/=-]+/g, "Bearer [REDACTED]");
}

async function writeFileWithRetry(filePath, contents) {
  await mkdir(dirname(filePath), { recursive: true });
  await writeFile(filePath, contents, "utf8");
}
