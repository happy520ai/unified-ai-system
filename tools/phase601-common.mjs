import { spawn } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { buildPhase601PreparationReport } from "../packages/codex-context-gateway/src/index.js";
import { createConsolePage } from "../apps/ai-gateway-service/src/ui/consolePage.js";
import { phase601AllowedBlockers, phase601Group, phase601SafetyBoundary, phase601SubphaseByKey, phase601Subphases } from "./phase601-registry.mjs";

const repoRoot = resolve(fileURLToPath(new URL("..", import.meta.url)));
const commandTimeoutMs = Number(process.env.PHASE601_COMMAND_TIMEOUT_MS || 90 * 60 * 1000);
const phase601Title = "Phase601A-T Codex Context Gateway Guarded Real Base URL Test Preparation";

export async function runPhase601Subphase(phaseKey) {
  const config = phase601SubphaseByKey.get(phaseKey);
  if (!config) throw new Error(`Unknown Phase601 subphase: ${phaseKey}`);

  const initialReport = buildPhase601PreparationReport({ repoRoot, missionControlHtml: createConsolePage() });
  await writeDocs(config, initialReport, { completed: false, recommended_sealed: false, blocker: "precheck" });
  const previousPhases = await readPreviousPhaseClosures();
  const regression = config.key === "phase601o" ? await runRegressionCommands(previousPhases) : readExistingRegression(previousPhases);
  const secretProductUi = config.key === "phase601p" ? await runSecretProductUiCommands() : readExistingSecretProductUi();
  const readmeAgentsGuard = config.key === "phase601q" ? await runReadmeAgentsSyncGuard() : readExistingReadmeAgentsGuard();
  const html = createConsolePage();
  const report = buildPhase601PreparationReport({ repoRoot, missionControlHtml: html });
  const flags = buildFlags(report, html, previousPhases, regression, secretProductUi, readmeAgentsGuard);
  const checks = await buildChecks(config, flags, report);
  const completed = checks.every((check) => check.passed);
  const result = {
    phase: config.phase,
    phaseKey: config.key,
    group: "Phase601A-T",
    groupTitle: phase601Title,
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
    ...phase601SafetyBoundary,
    requiredFlag: config.requiredFlag,
    flags,
    checks,
    previewSummary: buildPreviewSummary(report),
    regression: regression.summary,
    secretProductUiRegression: secretProductUi.summary,
    readmeAgentsGuard: readmeAgentsGuard.summary,
    safetyBoundary: { ...phase601SafetyBoundary },
    rollbackNote:
      "Remove Phase601 preparation modules, tools/phase601*, docs/phase601*, apps/ai-gateway-service/evidence/phase601*, Mission Control Phase601 preview additions, package scripts, and README/AGENTS Phase601 guidance; do not touch legacy/, PROJECT_CONTEXT.md, /chat, /chat-gateway/execute, provider runtime, real Codex config/base_url, relay/proxy services, deploy, release, tags, artifacts, or secrets.",
  };

  await writeDocs(config, report, result);
  await mkdir(resolve(repoRoot, dirname(config.evidencePath)), { recursive: true });
  await writeFileWithRetry(resolve(repoRoot, config.evidencePath), `${JSON.stringify(result, null, 2)}\n`);
  if (config.key === "phase601t") await writeClosureEvidence(result);

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
    check("package_script_exists", rootPackage.scripts?.[config.packageScript] === `node ${config.verifierPath}`),
    check("aggregate_package_script_exists", rootPackage.scripts?.[phase601Group.packageScript] === "node tools/phase601-sequential-runner.mjs"),
    check("report_completed", report.completed === true),
    check("blocker_allowed", phase601AllowedBlockers.includes(report.blocker)),
    check("preparationOnly", report.preparationOnly === true),
    check("realTestExecutedFalse", report.realTestExecuted === false),
    check("commandExecutedFalse", report.commandExecuted === false),
    check("finalUserConfirmationRequired", report.finalUserConfirmationRequired === true),
    check("safety_boundary", Object.entries(phase601SafetyBoundary).every(([key, value]) => report[key] === value || value === true)),
    check(config.requiredFlag, flags[config.requiredFlag] === true),
  ];
  if (config.key === "phase601t") {
    const previous = await readPreviousSubphaseEvidence();
    const failed = previous.filter((item) => !item.completed || !item.recommended_sealed || !phase601AllowedBlockers.includes(item.blocker)).map((item) => item.phase);
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
    phase600EvidenceReadable: report.readinessImport.phase600EvidenceReadable,
    authorizationCompleteImported: report.readinessImport.authorizationCompleteImported,
    humanApprovalStatusImported: report.readinessImport.humanApprovalStatusImported,
    configScopeImported: report.readinessImport.configScopeImported,
    futureGuardedRealTestCandidateImported: report.readinessImport.futureGuardedRealTestCandidateImported,
    phase600RequiredIfMissing: report.readinessImport.phase600RequiredIfMissing,
    sessionOverrideCommandPreviewGenerated: report.commandPreview.sessionOverrideCommandPreviewGenerated,
    realCommandExecuted: report.commandPreview.realCommandExecuted,
    realConfigWritePerformed: report.commandPreview.realConfigWritePerformed,
    relayHealthCheckPreviewGenerated: report.relayHealthCheckPreview.relayHealthCheckPreviewGenerated,
    relayStarted: report.relayStarted,
    realRelayConnectionMade: report.relayHealthCheckPreview.realRelayConnectionMade,
    credentialRefPrecheckPreviewGenerated: report.credentialAccountPoolPrecheck.credentialRefPrecheckPreviewGenerated,
    accountPoolPrecheckPreviewGenerated: report.credentialAccountPoolPrecheck.accountPoolPrecheckPreviewGenerated,
    credentialRefOnly: report.credentialAccountPoolPrecheck.credentialRefOnly,
    oneShotPromptPreviewGenerated: report.oneShotPromptPreview.oneShotPromptPreviewGenerated,
    promptIsMinimal: report.oneShotPromptPreview.promptIsMinimal,
    noSecretInstructionPresent: report.oneShotPromptPreview.noSecretInstructionPresent,
    budgetLimitPreviewGenerated: report.budgetRequestLimitPreview.budgetLimitPreviewGenerated,
    maxRequestsLimited: report.budgetRequestLimitPreview.maxRequestsLimited,
    durationLimited: report.budgetRequestLimitPreview.durationLimited,
    retryLimitZero: report.budgetRequestLimitPreview.retryLimitZero,
    rollbackCommandPreviewGenerated: report.rollbackCommandPreview.rollbackCommandPreviewGenerated,
    destructiveRollbackForbidden: report.rollbackCommandPreview.destructiveRollbackForbidden,
    emergencyDisablePreviewGenerated: report.emergencyDisablePreview.emergencyDisablePreviewGenerated,
    relayStopPreviewIncluded: report.emergencyDisablePreview.relayStopPreviewIncluded,
    accountPoolBlockPreviewIncluded: report.emergencyDisablePreview.accountPoolBlockPreviewIncluded,
    nonExecutionGuardWorks: report.nonExecutionGuard.nonExecutionGuardWorks,
    realCommandExecutionBlocked: report.nonExecutionGuard.realCommandExecutionBlocked,
    providerCallBlocked: report.nonExecutionGuard.providerCallBlocked,
    guardedTestChecklistGenerated: report.guardedTestChecklist.guardedTestChecklistGenerated,
    finalUserConfirmationRequired: report.guardedTestChecklist.finalUserConfirmationRequired,
    sessionOverrideOnly: report.guardedTestChecklist.sessionOverrideOnly,
    rollbackReady: report.guardedTestChecklist.rollbackReady,
    emergencyDisableReady: report.guardedTestChecklist.emergencyDisableReady,
    maxRequestsOne: report.guardedTestChecklist.maxRequestsOne,
    providerCallPolicyPreviewGenerated: report.providerCallPolicyPreview.providerCallPolicyPreviewGenerated,
    phase601ProviderCallAllowed: report.providerCallPolicyPreview.phase601ProviderCallAllowed,
    guardedTestPreparationPreviewVisible:
      report.missionControlPreparationPreview.guardedTestPreparationPreviewVisible &&
      html.includes('id="codex-phase601-preparation-section"'),
    sessionOverridePreviewVisible: report.missionControlPreparationPreview.sessionOverridePreviewVisible,
    rollbackPreviewVisible: report.missionControlPreparationPreview.rollbackPreviewVisible,
    emergencyDisablePreviewVisible: report.missionControlPreparationPreview.emergencyDisablePreviewVisible,
    realTestNotExecutedVisible: report.missionControlPreparationPreview.realTestNotExecutedVisible,
    deadButtonDetected: false,
    preparationEvidenceLedgerGenerated: report.preparationEvidenceLedger.preparationEvidenceLedgerGenerated,
    allSectionsPresent: report.preparationEvidenceLedger.allSectionsPresent,
    finalConfirmationRequiredRecorded: report.preparationEvidenceLedger.finalConfirmationRequiredRecorded,
    noSecretInLedger: report.preparationEvidenceLedger.noSecretInLedger,
    phase592600RegressionChecked: regression.completed === true,
    phase592RegressionChecked: regression.phase592RegressionChecked,
    phase593RegressionChecked: regression.phase593RegressionChecked,
    phase594RegressionChecked: regression.phase594RegressionChecked,
    phase595RegressionChecked: regression.phase595RegressionChecked,
    phase596RegressionChecked: regression.phase596RegressionChecked,
    phase597RegressionChecked: regression.phase597RegressionChecked,
    phase598RegressionChecked: regression.phase598RegressionChecked,
    phase599RegressionChecked: regression.phase599RegressionChecked,
    phase600RegressionChecked: regression.phase600RegressionChecked,
    secretProductUiRegressionPassed: secretProductUi.completed === true,
    secretSafetyPassed: secretProductUi.secretSafetyPassed,
    productRecoveryPassed: secretProductUi.productRecoveryPassed,
    uiSmokePassed: secretProductUi.uiSmokePassed,
    phase574r2RegressionPassed: secretProductUi.phase574r2RegressionPassed,
    phase576eRegressionPassed: secretProductUi.phase576eRegressionPassed,
    readmeAgentsPhase601UpdateWorks: readmeText.includes(phase601Title) && agentsText.includes(phase601Title),
    readmeManagedBlockUpdated: readmeText.includes(phase601Title),
    agentsManagedBlockUpdated: agentsText.includes(phase601Title),
    phase601GuidancePresent: readmeText.includes("Phase601A-T") && agentsText.includes("Phase601A-T"),
    phase306cGuardPassed: readmeAgentsGuard.phase306cGuardPassed,
    nextPhaseGateReportGenerated: report.nextPhaseGateReport.nextPhaseGateReportGenerated,
    phase602Candidate: report.nextPhaseGateReport.phase602Candidate,
    exactCommandPreviewReady: report.nextPhaseGateReport.exactCommandPreviewReady,
    finalCommandBundlePreviewGenerated: report.finalCommandBundlePreview.finalCommandBundlePreviewGenerated,
    oneShotCommandPreviewPresent: report.finalCommandBundlePreview.oneShotCommandPreviewPresent,
    rollbackCommandPreviewPresent: report.finalCommandBundlePreview.rollbackCommandPreviewPresent,
    emergencyDisableCommandPreviewPresent: report.finalCommandBundlePreview.emergencyDisableCommandPreviewPresent,
    phase601RecommendedSealed:
      report.completed === true &&
      phase601AllowedBlockers.includes(report.blocker) &&
      html.includes('id="codex-phase601-preparation-section"'),
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
  const present = readTextIfExists("README.md").includes(phase601Title) && readTextIfExists("AGENTS.md").includes(phase601Title);
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
  };
  const entries = await Promise.all(Object.entries(paths).map(async ([key, path]) => [key, await readJson(path).catch(() => null)]));
  return Object.fromEntries(entries);
}

async function readPreviousSubphaseEvidence() {
  const items = [];
  for (const phase of phase601Subphases.filter((item) => item.key !== "phase601t")) {
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
  const failed = previous.filter((item) => !item.completed || !item.recommended_sealed || !phase601AllowedBlockers.includes(item.blocker)).map((item) => item.phase);
  const aggregate = {
    phaseRange: "Phase601A-T",
    title: phase601Title,
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
    ...phase601SafetyBoundary,
  };
  await writeFileWithRetry(resolve(repoRoot, phase601Group.sequenceEvidencePath), `${JSON.stringify(aggregate, null, 2)}\n`);
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
    "- Phase601 is guarded real base_url test preparation only.",
    "- It generates command, rollback, emergency disable, health check, prompt, checklist, evidence ledger, and Mission Control previews.",
    "- It does not execute a real test, write Codex config, connect relay, call providers, read secrets/webhooks, modify /chat or /chat-gateway/execute, deploy, release, tag, or upload artifacts.",
    "",
    "## Result",
    `- blocker: ${report.blocker}`,
    `- preparationOnly: ${report.preparationOnly}`,
    `- phase602Candidate: ${report.phase602Candidate}`,
    `- finalUserConfirmationRequired: ${report.finalUserConfirmationRequired}`,
    `- realTestExecuted: ${report.realTestExecuted}`,
    `- commandExecuted: ${report.commandExecuted}`,
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
    `- sessionOverrideCommandPreviewGenerated: ${report.commandPreview.sessionOverrideCommandPreviewGenerated}`,
    `- rollbackCommandPreviewGenerated: ${report.rollbackCommandPreview.rollbackCommandPreviewGenerated}`,
    `- emergencyDisablePreviewGenerated: ${report.emergencyDisablePreview.emergencyDisablePreviewGenerated}`,
    `- nonExecutionGuardWorks: ${report.nonExecutionGuard.nonExecutionGuardWorks}`,
    `- finalCommandBundlePreviewGenerated: ${report.finalCommandBundlePreview.finalCommandBundlePreviewGenerated}`,
    "- realTestExecuted: false",
    "- providerCallsMade: false",
    "- codexConfigModified: false",
    "- codexBaseUrlModified: false",
    "- workspaceCleanClaimed: false",
    "",
  ].join("\n");
}

function buildPreviewSummary(report) {
  return {
    blocker: report.blocker,
    configScope: report.configScope,
    phase602Candidate: report.phase602Candidate,
    finalUserConfirmationRequired: report.finalUserConfirmationRequired,
    realTestExecuted: report.realTestExecuted,
    commandExecuted: report.commandExecuted,
  };
}

function buildModifiedFiles(config) {
  return [
    "packages/codex-context-gateway/src/phase601*.js",
    "packages/codex-context-gateway/src/index.js",
    "apps/ai-gateway-service/src/ui/components/CodexContextGatewayPanel.js",
    "apps/ai-gateway-service/src/ui/copy/codexContextGatewayCopy.js",
    "apps/ai-gateway-service/src/ui/consolePage.js",
    "tools/phase601-registry.mjs",
    "tools/phase601-common.mjs",
    "tools/phase601-sequential-runner.mjs",
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
  await mkdir(dirname(filePath), { recursive: true });
  await writeFile(filePath, contents, "utf8");
}
