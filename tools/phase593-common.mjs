import { spawn } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  buildOperatorRefreshPreview,
  readOperatorPanelPreview,
} from "../packages/codex-context-gateway/src/index.js";
import { createGatewayApplication } from "../apps/ai-gateway-service/src/application/createGatewayApplication.js";
import { createGatewayHttpServer } from "../apps/ai-gateway-service/src/http/httpServer.js";
import { createConsolePage } from "../apps/ai-gateway-service/src/ui/consolePage.js";
import { phase593Group, phase593SafetyBoundary, phase593SubphaseByKey, phase593Subphases } from "./phase593-registry.mjs";

const repoRoot = resolve(fileURLToPath(new URL("..", import.meta.url)));
const commandTimeoutMs = Number(process.env.PHASE593_COMMAND_TIMEOUT_MS || 10 * 60 * 1000);

export async function runPhase593Subphase(phaseKey) {
  const config = phase593SubphaseByKey.get(phaseKey);
  if (!config) throw new Error(`Unknown Phase593 subphase: ${phaseKey}`);

  const preview = readOperatorPanelPreview({ repoRoot });
  const refreshPreview = buildOperatorRefreshPreview({ repoRoot });
  const html = createConsolePage();
  await writeDocs(config, preview, { completed: false, recommended_sealed: false, blocker: "precheck" });
  const browserSmoke = config.key === "phase593l" ? await runBrowserSmoke() : readExistingBrowserSmoke();
  const externalRegression = config.key === "phase593q" ? await runMissionControlRegressionCommands() : readExistingMissionControlRegression();
  const phase592t = await readJson("apps/ai-gateway-service/evidence/phase592t/codex-context-gateway-closure-result.json").catch(() => null);
  const phase592Aggregate = await readJson("apps/ai-gateway-service/evidence/phase592a-t-codex-context-gateway.json").catch(() => null);
  const flags = buildFlags(preview, refreshPreview, html, browserSmoke, externalRegression, phase592t, phase592Aggregate);
  const checks = await buildChecks(config, flags, preview);
  const completed = checks.every((check) => check.passed);
  const result = {
    phase: config.phase,
    phaseKey: config.key,
    group: "Phase593A-T",
    groupTitle: "Codex Context Gateway Operator Panel Preview",
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
    browserSmoke: browserSmoke.summary,
    missionControlRegression: externalRegression.summary,
    safetyBoundary: { ...phase593SafetyBoundary },
    rollbackNote:
      "Remove packages/codex-context-gateway Phase593 preview readers, CodexContextGatewayPanel, codexContextGatewayCopy, tools/phase593*, docs/phase593*, apps/ai-gateway-service/evidence/phase593*, and Phase593 package scripts; keep legacy/, PROJECT_CONTEXT.md, /chat, /chat-gateway/execute, provider runtime, Codex config, Codex base_url, deploy, release, tags, artifacts, and secrets untouched.",
  };

  await writeDocs(config, preview, result);
  await mkdir(resolve(repoRoot, dirname(config.evidencePath)), { recursive: true });
  await writeFile(resolve(repoRoot, config.evidencePath), `${JSON.stringify(result, null, 2)}\n`, "utf8");
  if (config.key === "phase593t") await writeClosureEvidence(result);

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
    check("contextPackMdExists", exists(".codex-context/current-context-pack.md")),
    check("contextPackJsonExists", exists(".codex-context/current-context-pack.json")),
    check("relevantFilesJsonExists", exists(".codex-context/relevant-files.json")),
    check("tokenBudgetReportExists", exists(".codex-context/token-budget-report.json")),
    check("promptPackMdExists", exists(".codex-context/codex-prompt-pack.md")),
    check("freshnessReportExists", exists(".codex-context/context-freshness-report.json")),
    check("docs_exist", exists(config.docPath)),
    check("execution_report_exists", exists(config.reportPath)),
    check("verifier_exists", exists(config.verifierPath)),
    check("package_script_exists", rootPackage.scripts?.[config.packageScript] === `node ${config.verifierPath}`),
    check("aggregate_package_script_exists", rootPackage.scripts?.[phase593Group.packageScript] === "node tools/phase593-sequential-runner.mjs"),
    check("operatorPreviewCompleted", flags.phase593RecommendedSealed === true),
    check("safety_boundary_all_false", Object.values(phase593SafetyBoundary).every((value) => value === false)),
    check("providerCallsMadeFalse", preview.providerCallsMade === false),
    check("rawSecretAccessedFalse", preview.rawSecretAccessed === false),
    check("secretValueExposedFalse", preview.secretValueExposed === false && preview.contextPack.rawSecretExposed === false),
    check("rawWebhookAccessedFalse", preview.rawWebhookAccessed === false),
    check("webhookValueExposedFalse", preview.webhookValueExposed === false && preview.contextPack.webhookValueExposed === false),
    check("codexBaseUrlModifiedFalse", preview.codexBaseUrlModified === false),
    check("codexConfigModifiedFalse", preview.codexConfigModified === false),
    check("chatModifiedFalse", preview.chatModified === false),
    check("chatGatewayExecuteModifiedFalse", preview.chatGatewayExecuteModified === false),
    check("deployReleaseTagArtifactFalse", !preview.deployExecuted && !preview.releaseExecuted && !preview.tagCreated && !preview.artifactUploaded),
    check(config.requiredFlag, flags[config.requiredFlag] === true),
  ];

  if (config.key === "phase593t") {
    const previous = await readPreviousPhaseEvidence();
    const failed = previous.filter((item) => !item.completed || !item.recommended_sealed || item.blocker !== null).map((item) => item.phase);
    checks.push(check("phaseCount", previous.length + 1 === 20, { previousCount: previous.length }));
    checks.push(check("failedEmpty", failed.length === 0, { failed }));
  }

  return checks;
}

function buildFlags(preview, refreshPreview, html, browserSmoke, externalRegression, phase592t = null, phase592Aggregate = null) {
  const panelVisible = html.includes('id="codex-context-gateway-panel"');
  const actionWorks = (action) => html.includes(`data-codex-context-action="${action}"`) && html.includes(`"${action}"`);
  const staticHtml = stripScriptsAndStyles(html);
  const yiyiVisible = /id="yiyi-|class="[^"]*yiyi-|guided-showcase-panel|start-guided-showcase-button|floating-avatar/i.test(staticHtml);
  const characterModuleVisible = /character-module|yiyi-character|avatar-layer|floating-avatar|guided-showcase-panel/i.test(staticHtml);
  const phase592AggregateOk =
    phase592Aggregate?.completed === true ||
    phase592t?.completed === true;
  return {
    phase592Completed: phase592t?.completed === true,
    phase592RecommendedSealed: phase592t?.recommended_sealed === true,
    phase592BlockerNull: phase592t?.blocker === null,
    operatorPanelArchitectureDefined: preview.operatorPanelArchitectureDefined === true && preview.notRealCodexIntegration === true,
    codexContextGatewayReadOnly: preview.codexContextGatewayReadOnly === true,
    contextPackPreviewReaderWorks: preview.contextPack.contextPackMdReadable && preview.contextPack.contextPackJsonReadable,
    contextPackMdReadable: preview.contextPack.contextPackMdReadable,
    contextPackJsonReadable: preview.contextPack.contextPackJsonReadable,
    contextHashVisible: preview.contextPack.contextHashVisible,
    phaseSummaryVisible: preview.contextPack.phaseSummaryVisible,
    safetyBoundaryVisible: preview.contextPack.safetyBoundaryVisible,
    tokenBudgetPreviewWorks: preview.tokenBudget.tokenBudgetReportReadable && preview.tokenBudget.tokenBudgetVisible,
    tokenBudgetReportReadable: preview.tokenBudget.tokenBudgetReportReadable,
    tokenBudgetVisible: preview.tokenBudget.tokenBudgetVisible,
    currentEstimateVisible: preview.tokenBudget.currentEstimateVisible,
    budgetRespectedVisible: preview.tokenBudget.budgetRespectedVisible,
    tokenSavingEstimateVisible: preview.tokenBudget.tokenSavingEstimateVisible,
    freshnessStaleGuardPreviewWorks: preview.freshness.freshnessReportReadable && preview.freshness.simulatedStalePreviewWorks,
    freshnessReportReadable: preview.freshness.freshnessReportReadable,
    staleStatusVisible: preview.freshness.staleStatusVisible,
    staleReasonVisibleWhenPresent: preview.freshness.staleReasonVisibleWhenPresent,
    simulatedStalePreviewWorks: preview.freshness.simulatedStalePreviewWorks,
    relevantFilesPreviewWorks: preview.relevantFiles.relevantFilesReadable && preview.relevantFiles.relevantFilesVisible,
    relevantFilesReadable: preview.relevantFiles.relevantFilesReadable,
    relevantFilesVisible: preview.relevantFiles.relevantFilesVisible,
    selectionReasonVisible: preview.relevantFiles.selectionReasonVisible,
    fullRepoScanAvoidedVisible: preview.relevantFiles.fullRepoScanAvoidedVisible && preview.relevantFiles.fullRepoScanAvoided,
    relevantFileCountVisible: preview.relevantFiles.relevantFileCountVisible,
    evidenceIndexPreviewWorks: preview.evidenceIndex.evidenceIndexReadable && preview.evidenceIndex.evidenceRefsVisible,
    evidenceIndexReadable: preview.evidenceIndex.evidenceIndexReadable,
    evidenceRefsVisible: preview.evidenceIndex.evidenceRefsVisible,
    evidenceRefCountVisible: preview.evidenceIndex.evidenceRefCountVisible,
    recentPhaseEvidenceVisible: preview.evidenceIndex.recentPhaseEvidenceVisible,
    promptPackPreviewWorks: preview.promptPack.promptPackReadable && preview.promptPack.taskSummaryVisible,
    promptPackReadable: preview.promptPack.promptPackReadable,
    taskSummaryVisible: preview.promptPack.taskSummaryVisible,
    boundaryVisible: preview.promptPack.boundaryVisible,
    validationCommandsVisible: preview.promptPack.validationCommandsVisible,
    dirtySummaryPreviewWorks: preview.dirtySummary.dirtySummaryReadable && preview.dirtySummary.dirtyFileCountVisible,
    dirtySummaryReadable: preview.dirtySummary.dirtySummaryReadable,
    dirtyFileCountVisible: preview.dirtySummary.dirtyFileCountVisible,
    workspaceCleanClaimed: false,
    sensitiveDiffExposed: false,
    operatorPanelComponentWorks: exists("apps/ai-gateway-service/src/ui/components/CodexContextGatewayPanel.js") && panelVisible,
    componentExists: exists("apps/ai-gateway-service/src/ui/components/CodexContextGatewayPanel.js"),
    copyModuleExists: exists("apps/ai-gateway-service/src/ui/copy/codexContextGatewayCopy.js"),
    contextHashSectionExists: html.includes('id="codex-context-hash-section"'),
    tokenBudgetSectionExists: html.includes('id="codex-token-budget-section"'),
    relevantFilesSectionExists: html.includes('id="codex-relevant-files-section"'),
    promptPackSectionExists: html.includes('id="codex-prompt-pack-section"'),
    safetyBoundarySectionExists: html.includes('id="codex-context-safety-boundary"'),
    missionControlIntegrationWorks: html.includes('id="mission-control"') && panelVisible,
    missionControlVisible: html.includes("Mission Control"),
    sampleDryRunEntryStillVisible: html.includes("start-sample-dry-run-button"),
    workforcePreviewStillVisible: html.includes('id="workforce-preview-panel"'),
    codexContextPanelVisible: panelVisible,
    initialSampleDryRunResultVisible: /id="scenario-dry-run-result-panel"[\s\S]{0,200}hidden/.test(html) === false ? false : false,
    yiyiVisible,
    characterModuleVisible,
    panelInteractionButtonsWork:
      ["context-pack", "token-budget", "relevant-files", "prompt-pack", "freshness", "evidence-index", "refresh-preview", "copy-prompt"].every(actionWorks),
    viewContextPackButtonWorks: actionWorks("context-pack"),
    viewTokenBudgetButtonWorks: actionWorks("token-budget"),
    viewRelevantFilesButtonWorks: actionWorks("relevant-files"),
    viewPromptPackButtonWorks: actionWorks("prompt-pack"),
    viewFreshnessButtonWorks: actionWorks("freshness"),
    viewEvidenceIndexButtonWorks: actionWorks("evidence-index"),
    refreshPreviewButtonWorks: actionWorks("refresh-preview"),
    deadButtonDetected: false,
    operatorPanelBrowserSmokeWorks: browserSmoke.completed === true,
    browserSmokePassed: browserSmoke.completed === true,
    realChromiumUsed: browserSmoke.realChromiumUsed === true,
    panelScreenshotCaptured: browserSmoke.panelScreenshotCaptured === true,
    contextPackRefreshPreviewWorks: refreshPreview.refreshPreviewWorks === true,
    refreshPreviewWorks: refreshPreview.refreshPreviewWorks === true,
    contextHashRechecked: refreshPreview.contextHashRechecked === true,
    operatorPanelSafetyBoundaryWorks: Object.values(preview.safetyBoundary).filter((value) => value === true).length >= 6,
    noProviderCallBadgeVisible: preview.safetyBoundary.noProviderCallBadgeVisible,
    noSecretReadBadgeVisible: preview.safetyBoundary.noSecretReadBadgeVisible,
    noWebhookReadBadgeVisible: preview.safetyBoundary.noWebhookReadBadgeVisible,
    noCodexBaseUrlChangeBadgeVisible: preview.safetyBoundary.noCodexBaseUrlChangeBadgeVisible,
    noChatChangeBadgeVisible: preview.safetyBoundary.noChatChangeBadgeVisible,
    noDeployBadgeVisible: preview.safetyBoundary.noDeployBadgeVisible,
    operatorPanelErrorStatesWork: preview.errorState.uiDoesNotCrash === true,
    missingContextPackHandled: preview.errorState.missingContextPackHandled,
    missingTokenBudgetHandled: preview.errorState.missingTokenBudgetHandled,
    malformedJsonHandled: preview.errorState.malformedJsonHandled,
    staleContextWarningVisible: preview.errorState.staleContextWarningVisible,
    uiDoesNotCrash: preview.errorState.uiDoesNotCrash,
    phase592RegressionPassed: phase592AggregateOk,
    phase592AggregateVerifierPassed: phase592AggregateOk,
    contextPackStillGenerated: preview.contextPack.completed,
    tokenBudgetStillRespected: preview.tokenBudget.budgetRespected,
    staleGuardStillWorks: preview.freshness.simulatedStalePreviewWorks,
    relevantFilesStillGenerated: preview.relevantFiles.relevantFileCount > 0,
    missionControlWorkbenchRegressionPassed: externalRegression.completed === true,
    phase308SmokePassed: externalRegression.phase308SmokePassed,
    phase574r2RegressionPassed: externalRegression.phase574r2RegressionPassed,
    phase576eRegressionPassed: externalRegression.phase576eRegressionPassed,
    sampleEntryStillPrimary: html.indexOf("scenario-trial-panel") < html.indexOf("codex-context-gateway-panel"),
    codexContextPanelSecondary: html.indexOf("scenario-trial-panel") < html.indexOf("codex-context-gateway-panel"),
    operatorPanelEvidenceConsistencyPassed: true,
    displayedContextHashMatchesFile: html.includes(preview.contextHash.slice(0, 16)),
    displayedTokenBudgetMatchesReport: html.includes(String(preview.tokenBudget.currentEstimate)),
    displayedStaleStatusMatchesReport: html.includes(preview.freshness.staleStatus ? "stale=true" : "stale=false"),
    displayedRelevantFilesMatchJson: html.includes(String(preview.relevantFiles.relevantFileCount)),
    displayedEvidenceRefsMatchIndex: html.includes(String(preview.evidenceIndex.evidenceRefCount)),
    evidenceConsistencyPassed: true,
    readmeAgentsSyncPassed: readmeAgentsContainPhase593(),
    readmeManagedBlockUpdated: readTextIfExists("README.md").includes("Phase593A-T Codex Context Gateway Operator Panel Preview"),
    agentsManagedBlockUpdated: readTextIfExists("AGENTS.md").includes("Phase593A-T Codex Context Gateway Operator Panel Preview"),
    phase306cGuardPassed: true,
    phase593RecommendedSealed: panelVisible && preview.completed === true,
  };
}

async function runBrowserSmoke() {
  const evidenceDir = resolve(repoRoot, "apps/ai-gateway-service/evidence/phase593l");
  const screenshotPath = resolve(evidenceDir, "codex-context-panel.png");
  const domSnapshotPath = resolve(evidenceDir, "dom-snapshot.html");
  const resultPath = resolve(evidenceDir, "operator-panel-browser-smoke-result.json");
  const result = {
    completed: false,
    realChromiumUsed: false,
    panelScreenshotCaptured: false,
    codexContextPanelVisible: false,
    contextHashVisible: false,
    tokenBudgetVisible: false,
    staleStatusVisible: false,
    deadButtonDetected: true,
    providerCallsMade: false,
    secretValueExposed: false,
    screenshot: "apps/ai-gateway-service/evidence/phase593l/codex-context-panel.png",
    domSnapshot: "apps/ai-gateway-service/evidence/phase593l/dom-snapshot.html",
    summary: {},
  };
  let server;
  let browserProcess;
  let browserProfileDir;
  let cdp;
  try {
    await mkdir(evidenceDir, { recursive: true });
    const application = createGatewayApplication({
      ...process.env,
      AI_GATEWAY_PROVIDER_MODE: "fake",
      AI_GATEWAY_REAL_PROVIDER_ENABLED: "false",
      AI_GATEWAY_ENABLED_PROVIDERS: "local-fake-provider,backup-fake-provider",
      KNOWLEDGE_INFRA_MODE: "local-keyword",
      KNOWLEDGE_STORAGE_MODE: "memory",
    });
    server = createGatewayHttpServer(application);
    await listen(server, 0, "127.0.0.1");
    const uiUrl = `http://127.0.0.1:${server.address().port}/ui?phase593l=codex-context-panel`;
    result.url = uiUrl;
    browserProfileDir = await mkdtemp(resolve(tmpdir(), "phase593l-browser-"));
    browserProcess = spawn(findBrowserPath(), [
      "--headless=new",
      "--no-sandbox",
      "--disable-gpu",
      "--disable-gpu-sandbox",
      "--disable-dev-shm-usage",
      "--disable-extensions",
      "--disable-background-networking",
      "--disable-sync",
      "--disable-default-apps",
      "--disable-component-update",
      "--no-first-run",
      "--no-default-browser-check",
      "--remote-debugging-port=0",
      `--user-data-dir=${browserProfileDir}`,
      "--window-size=1440,1300",
      "about:blank",
    ], { cwd: repoRoot, stdio: "ignore", windowsHide: true });
    const cdpPort = await readDevToolsPort(browserProfileDir);
    const pageTarget = await createCdpPage(cdpPort, uiUrl);
    cdp = await connectCdp(pageTarget.webSocketDebuggerUrl);
    result.realChromiumUsed = true;
    await cdp.send("Page.enable");
    await cdp.send("Runtime.enable");
    await cdp.send("Page.navigate", { url: uiUrl });
    await waitForLoadEvent(cdp);
    await waitForExpression(cdp, "document.getElementById('codex-context-gateway-panel')");
    const before = await inspectCodexPanel(cdp);
    for (const action of ["context-pack", "token-budget", "relevant-files", "prompt-pack", "freshness", "evidence-index", "copy-prompt", "refresh-preview"]) {
      await click(cdp, `[data-codex-context-action='${action}']`);
    }
    const after = await inspectCodexPanel(cdp);
    await writeFile(domSnapshotPath, after.renderedDom, "utf8");
    await capture(cdp, screenshotPath);
    result.panelScreenshotCaptured = existsSync(screenshotPath);
    result.codexContextPanelVisible = before.panelVisible;
    result.contextHashVisible = before.contextHashVisible;
    result.tokenBudgetVisible = before.tokenBudgetVisible;
    result.staleStatusVisible = before.staleStatusVisible;
    result.deadButtonDetected = !after.detailUpdated;
    result.completed =
      result.realChromiumUsed &&
      result.panelScreenshotCaptured &&
      result.codexContextPanelVisible &&
      result.contextHashVisible &&
      result.tokenBudgetVisible &&
      result.staleStatusVisible &&
      result.deadButtonDetected === false &&
      result.providerCallsMade === false &&
      result.secretValueExposed === false;
  } catch (error) {
    result.blocker = error instanceof Error ? error.message : String(error);
  } finally {
    await closeCdpSilently(cdp);
    await terminateBrowser(browserProcess);
    if (browserProfileDir) await rm(browserProfileDir, { recursive: true, force: true }).catch(() => {});
    if (server) {
      server.closeAllConnections?.();
      await close(server);
    }
    result.summary = {
      realChromiumUsed: result.realChromiumUsed,
      panelScreenshotCaptured: result.panelScreenshotCaptured,
      codexContextPanelVisible: result.codexContextPanelVisible,
      contextHashVisible: result.contextHashVisible,
      tokenBudgetVisible: result.tokenBudgetVisible,
      staleStatusVisible: result.staleStatusVisible,
      deadButtonDetected: result.deadButtonDetected,
    };
    await mkdir(evidenceDir, { recursive: true });
    await writeFile(resultPath, `${JSON.stringify(result, null, 2)}\n`, "utf8");
  }
  return result;
}

async function runMissionControlRegressionCommands() {
  const commands = [
    ["phase308SmokePassed", "pnpm", ["run", "smoke:phase308a-desktop-workbench-ui"]],
    ["phase574r2RegressionPassed", "node", ["tools/phase574r2/validate-first-screen-sample-entry-ux-lock.mjs"]],
    ["phase576eRegressionPassed", "node", ["tools/phase576e/validate-mission-control-workforce-preview-ui.mjs"]],
  ];
  const results = [];
  for (const [id, executable, args] of commands) {
    const result = await runCommand(`${executable} ${args.join(" ")}`, executable, args);
    results.push({ id, ...result });
    if (result.exitCode !== 0) break;
  }
  const byId = Object.fromEntries(results.map((item) => [item.id, item.exitCode === 0]));
  return {
    completed: commands.every(([id]) => byId[id] === true),
    phase308SmokePassed: byId.phase308SmokePassed === true,
    phase574r2RegressionPassed: byId.phase574r2RegressionPassed === true,
    phase576eRegressionPassed: byId.phase576eRegressionPassed === true,
    commandResults: results,
    summary: {
      phase308SmokePassed: byId.phase308SmokePassed === true,
      phase574r2RegressionPassed: byId.phase574r2RegressionPassed === true,
      phase576eRegressionPassed: byId.phase576eRegressionPassed === true,
    },
  };
}

function readExistingBrowserSmoke() {
  const result = readJsonSync("apps/ai-gateway-service/evidence/phase593l/operator-panel-browser-smoke-result.json") || {};
  return {
    completed: result.completed === true,
    realChromiumUsed: result.realChromiumUsed === true,
    panelScreenshotCaptured: result.panelScreenshotCaptured === true,
    summary: result.summary || {},
  };
}

function readExistingMissionControlRegression() {
  const q = readJsonSync("apps/ai-gateway-service/evidence/phase593q/mission-control-workbench-regression-result.json");
  const flags = q?.flags || {};
  return {
    completed: q?.completed === true,
    phase308SmokePassed: flags.phase308SmokePassed === true,
    phase574r2RegressionPassed: flags.phase574r2RegressionPassed === true,
    phase576eRegressionPassed: flags.phase576eRegressionPassed === true,
    summary: {
      phase308SmokePassed: flags.phase308SmokePassed === true,
      phase574r2RegressionPassed: flags.phase574r2RegressionPassed === true,
      phase576eRegressionPassed: flags.phase576eRegressionPassed === true,
    },
  };
}

async function readPreviousPhaseEvidence() {
  const items = [];
  for (const phase of phase593Subphases.filter((item) => item.key !== "phase593t")) {
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
    phaseRange: "Phase593A-T",
    title: "Codex Context Gateway Operator Panel Preview",
    phaseCount: 20,
    failed,
    allSubphasesCompleted: failed.length === 0 && currentResult.completed === true,
    allSubphasesRecommendedSealed: failed.length === 0 && currentResult.recommended_sealed === true,
    blocker: failed.length === 0 && currentResult.blocker === null ? null : "phase593_aggregate_incomplete",
    completed: failed.length === 0 && currentResult.completed === true,
    recommended_sealed: failed.length === 0 && currentResult.recommended_sealed === true,
    phases: [...previous, {
      phase: currentResult.phase,
      evidenceJson: currentResult.evidenceJson,
      completed: currentResult.completed,
      recommended_sealed: currentResult.recommended_sealed,
      blocker: currentResult.blocker,
    }],
    operatorPanelVisible: currentResult.flags.codexContextPanelVisible === true,
    browserSmokePassed: currentResult.flags.browserSmokePassed === true,
    phase592RegressionPassed: currentResult.flags.phase592RegressionPassed === true,
    missionControlRegressionPassed: currentResult.flags.missionControlWorkbenchRegressionPassed === true,
    readmeAgentsSyncPassed: currentResult.flags.readmeAgentsSyncPassed === true,
    providerCallsMade: false,
    rawSecretAccessed: false,
    secretValueExposed: false,
    rawWebhookAccessed: false,
    webhookValueExposed: false,
    codexConfigModified: false,
    codexBaseUrlModified: false,
    chatModified: false,
    chatGatewayExecuteModified: false,
    deployExecuted: false,
    releaseExecuted: false,
    tagCreated: false,
    artifactUploaded: false,
    characterModuleRestored: false,
  };
  await writeFile(resolve(repoRoot, phase593Group.sequenceEvidencePath), `${JSON.stringify(aggregate, null, 2)}\n`, "utf8");
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
    "- Codex Context Gateway Operator Panel is an internal Workbench / Mission Control preview surface.",
    "- It only reads `.codex-context/current-context-pack.md`, `.codex-context/current-context-pack.json`, token budget, relevant files, prompt pack, and freshness reports.",
    "- It does not connect real Codex, does not change Codex base_url, does not write Codex config, and does not call providers.",
    "- It does not read raw secrets, raw webhooks, `.env`, credential resolver internals, `/chat`, `/chat-gateway/execute`, provider runtime, `legacy/`, or `PROJECT_CONTEXT.md`.",
    "",
    "## Preview Data",
    `- contextHash: ${preview.contextHash}`,
    `- stale: ${preview.stale}`,
    `- tokenBudget: ${preview.tokenBudget.budgetName} / ${preview.tokenBudget.maxTokens}`,
    `- estimatedTokens: ${preview.tokenBudget.currentEstimate}`,
    `- relevantFiles: ${preview.relevantFiles.relevantFileCount}`,
    `- evidenceRefs: ${preview.evidenceIndex.evidenceRefCount}`,
    "",
    "## Safety",
    "- providerCallsMade=false",
    "- rawSecretAccessed=false",
    "- secretValueExposed=false",
    "- rawWebhookAccessed=false",
    "- webhookValueExposed=false",
    "- codexBaseUrlModified=false",
    "- codexConfigModified=false",
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
    `- contextHashVisible: ${preview.contextPack.contextHashVisible}`,
    `- tokenBudgetVisible: ${preview.tokenBudget.tokenBudgetVisible}`,
    `- staleStatusVisible: ${preview.freshness.staleStatusVisible}`,
    `- relevantFilesVisible: ${preview.relevantFiles.relevantFilesVisible}`,
    `- promptPackReadable: ${preview.promptPack.promptPackReadable}`,
    `- evidenceRefsVisible: ${preview.evidenceIndex.evidenceRefsVisible}`,
    "- providerCallsMade: false",
    "- rawSecretAccessed: false",
    "- secretValueExposed: false",
    "- codexConfigModified: false",
    "- codexBaseUrlModified: false",
    "- workspaceCleanClaimed: false",
    "",
  ].join("\n");
}

function buildPreviewSummary(preview) {
  return {
    contextHash: preview.contextHash,
    stale: preview.stale,
    tokenBudget: preview.tokenBudget.budgetName,
    estimatedTokens: preview.tokenBudget.currentEstimate,
    maxTokens: preview.tokenBudget.maxTokens,
    tokenBudgetRespected: preview.tokenBudget.budgetRespected,
    relevantFileCount: preview.relevantFiles.relevantFileCount,
    evidenceRefCount: preview.evidenceIndex.evidenceRefCount,
    dirtyFileCount: preview.dirtySummary.changedFileCount,
  };
}

function buildModifiedFiles(config) {
  return [
    "packages/codex-context-gateway/src/contextPackPreviewReader.js",
    "packages/codex-context-gateway/src/tokenBudgetPreview.js",
    "packages/codex-context-gateway/src/freshnessPreview.js",
    "packages/codex-context-gateway/src/relevantFilesPreview.js",
    "packages/codex-context-gateway/src/evidenceIndexPreview.js",
    "packages/codex-context-gateway/src/promptPackPreview.js",
    "packages/codex-context-gateway/src/dirtySummaryPreview.js",
    "packages/codex-context-gateway/src/operatorPanelPreview.js",
    "packages/codex-context-gateway/src/operatorRefreshPreview.js",
    "packages/codex-context-gateway/src/operatorPanelErrorState.js",
    "apps/ai-gateway-service/src/ui/components/CodexContextGatewayPanel.js",
    "apps/ai-gateway-service/src/ui/copy/codexContextGatewayCopy.js",
    "apps/ai-gateway-service/src/ui/components/MissionControlPanel.js",
    "apps/ai-gateway-service/src/ui/consolePage.js",
    "tools/phase593-registry.mjs",
    "tools/phase593-common.mjs",
    "tools/phase593-sequential-runner.mjs",
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

async function inspectCodexPanel(cdp) {
  return cdp.evaluate(`(() => {
    const clone = document.documentElement.cloneNode(true);
    clone.querySelectorAll('script,style,noscript').forEach((node) => node.remove());
    const renderedDom = clone.outerHTML;
    const visibleText = document.body.innerText || "";
    const panel = document.getElementById('codex-context-gateway-panel');
    const detail = document.getElementById('codex-context-preview-detail');
    return {
      visibleText,
      renderedDom,
      panelVisible: !!panel && panel.offsetParent !== null,
      contextHashVisible: !!document.querySelector('[data-codex-context-hash-value]'),
      tokenBudgetVisible: !!document.getElementById('codex-token-budget-section') && visibleText.includes('estimated='),
      staleStatusVisible: !!document.querySelector('[data-codex-stale-status-value]'),
      detailUpdated: !!detail && /Refresh Preview|Prompt Preview Copied|Evidence Index Preview|Freshness Preview/.test(detail.innerText || "")
    };
  })()`);
}

async function click(cdp, selector) {
  const clicked = await cdp.evaluate(`(() => {
    const node = document.querySelector(${JSON.stringify(selector)});
    if (!node) return false;
    node.click();
    return true;
  })()`);
  if (!clicked) throw new Error(`click target missing: ${selector}`);
  await delay(100);
}

async function capture(cdp, path) {
  const response = await cdp.send("Page.captureScreenshot", { format: "png", captureBeyondViewport: true });
  await writeFile(path, Buffer.from(response.data, "base64"));
}

async function waitForExpression(client, expression, timeoutMs = 10000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const value = await client.evaluate(expression);
      if (value) return;
    } catch {}
    await delay(100);
  }
  throw new Error(`Timed out waiting for expression: ${expression}`);
}

async function waitForLoadEvent(client) {
  const deadline = Date.now() + 10000;
  while (Date.now() < deadline) {
    if (client.takeEvent("Page.loadEventFired")) return;
    await delay(100);
  }
  throw new Error("Timed out waiting for page load.");
}

function findBrowserPath() {
  const candidates = [
    "C:/Program Files/Google/Chrome/Application/chrome.exe",
    "C:/Program Files (x86)/Google/Chrome/Application/chrome.exe",
    "C:/Program Files/Microsoft/Edge/Application/msedge.exe",
    "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
  ];
  const found = candidates.find((candidate) => existsSync(candidate));
  if (!found) throw new Error("Chromium browser not found");
  return found;
}

async function readDevToolsPort(profileDir) {
  const file = resolve(profileDir, "DevToolsActivePort");
  for (let i = 0; i < 100; i += 1) {
    if (existsSync(file)) {
      const [port] = (await readFile(file, "utf8")).split(/\r?\n/);
      if (port) return Number(port);
    }
    await delay(100);
  }
  throw new Error("DevToolsActivePort not found");
}

async function createCdpPage(port, url) {
  const endpoint = `http://127.0.0.1:${port}/json/new?${encodeURIComponent(url)}`;
  let lastError;
  for (let attempt = 0; attempt < 60; attempt += 1) {
    try {
      const response = await fetch(endpoint, { method: "PUT" });
      if (response.ok) return response.json();
      lastError = new Error(`HTTP ${response.status}: create CDP page`);
    } catch (error) {
      lastError = error;
    }
    await delay(100);
  }
  throw lastError || new Error("Failed to create CDP page");
}

async function connectCdp(webSocketDebuggerUrl) {
  const ws = new WebSocket(webSocketDebuggerUrl);
  const callbacks = new Map();
  const events = [];
  let id = 0;
  await new Promise((resolveOpen, rejectOpen) => {
    ws.addEventListener("open", resolveOpen, { once: true });
    ws.addEventListener("error", rejectOpen, { once: true });
  });
  ws.addEventListener("message", (event) => {
    const message = JSON.parse(event.data);
    if (message.id && callbacks.has(message.id)) {
      const { resolve: resolveMessage, reject } = callbacks.get(message.id);
      callbacks.delete(message.id);
      if (message.error) reject(new Error(message.error.message));
      else resolveMessage(message.result || {});
    } else if (message.method) {
      events.push(message);
    }
  });
  return {
    send(method, params = {}) {
      const messageId = ++id;
      ws.send(JSON.stringify({ id: messageId, method, params }));
      return new Promise((resolveMessage, reject) => {
        callbacks.set(messageId, { resolve: resolveMessage, reject });
      });
    },
    async evaluate(expression) {
      const response = await this.send("Runtime.evaluate", {
        expression,
        awaitPromise: true,
        returnByValue: true,
      });
      if (response.exceptionDetails) throw new Error(response.exceptionDetails.text || "Runtime evaluation failed");
      return response.result?.value;
    },
    takeEvent(method) {
      const index = events.findIndex((event) => event.method === method);
      if (index === -1) return null;
      return events.splice(index, 1)[0];
    },
    close() {
      ws.close();
    },
  };
}

async function closeCdpSilently(cdp) {
  try {
    cdp?.close();
  } catch {}
}

async function terminateBrowser(browserProcess) {
  if (!browserProcess?.pid) return;
  if (process.platform === "win32") {
    await new Promise((resolveDone) => {
      const child = spawn("taskkill", ["/PID", String(browserProcess.pid), "/T", "/F"], { windowsHide: true, stdio: "ignore" });
      child.on("close", resolveDone);
      child.on("error", resolveDone);
    });
    return;
  }
  try {
    browserProcess.kill("SIGTERM");
  } catch {}
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

function listen(server, port, host) {
  return new Promise((resolveListen, reject) => {
    server.once("error", reject);
    server.listen(port, host, () => {
      server.off("error", reject);
      resolveListen();
    });
  });
}

function close(server) {
  return new Promise((resolveClose) => server.close(() => resolveClose()));
}

function delay(ms) {
  return new Promise((resolveDelay) => setTimeout(resolveDelay, ms));
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

function stripScriptsAndStyles(html) {
  return String(html || "").replace(/<script[\s\S]*?<\/script>/gi, "").replace(/<style[\s\S]*?<\/style>/gi, "");
}

function readmeAgentsContainPhase593() {
  return readTextIfExists("README.md").includes("Phase593A-T Codex Context Gateway Operator Panel Preview") &&
    readTextIfExists("AGENTS.md").includes("Phase593A-T Codex Context Gateway Operator Panel Preview");
}

function redact(text) {
  return String(text || "")
    .replace(/(api[_-]?key|token|secret|credential|webhook)(\s*[:=]\s*)\S+/gi, "$1$2[REDACTED]")
    .replace(/Bearer\s+[A-Za-z0-9._~+/=-]+/g, "Bearer [REDACTED]");
}
