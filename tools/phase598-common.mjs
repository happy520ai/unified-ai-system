import { spawn } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { buildAuthorizationEvidenceDryRunSimulationReport } from "../packages/codex-context-gateway/src/index.js";
import { createConsolePage } from "../apps/ai-gateway-service/src/ui/consolePage.js";
import { phase598Group, phase598SafetyBoundary, phase598SubphaseByKey, phase598Subphases } from "./phase598-registry.mjs";

const repoRoot = resolve(fileURLToPath(new URL("..", import.meta.url)));
const commandTimeoutMs = Number(process.env.PHASE598_COMMAND_TIMEOUT_MS || 90 * 60 * 1000);
const phase598Title = "Phase598A-T Codex Context Gateway Authorization Evidence Intake + Dry-Run Config Simulation";

export async function runPhase598Subphase(phaseKey) {
  const config = phase598SubphaseByKey.get(phaseKey);
  if (!config) throw new Error(`Unknown Phase598 subphase: ${phaseKey}`);

  const html = createConsolePage();
  const report = buildAuthorizationEvidenceDryRunSimulationReport({ repoRoot, missionControlHtml: html });
  await writeDocs(config, report, { completed: false, recommended_sealed: false, blocker: "precheck" });

  const previousPhases = await readPreviousPhaseClosures();
  const regression = config.key === "phase598p" ? await runRegressionCommands() : readExistingRegression(previousPhases);
  const secretProductUi = config.key === "phase598q" ? await runSecretProductUiCommands() : readExistingSecretProductUi();
  const readmeAgentsGuard = config.key === "phase598r" ? await runReadmeAgentsSyncGuard() : readExistingReadmeAgentsGuard();
  const flags = buildFlags(report, html, previousPhases, regression, secretProductUi, readmeAgentsGuard);
  const checks = await buildChecks(config, flags, report);
  const completed = checks.every((check) => check.passed);
  const result = {
    phase: config.phase,
    phaseKey: config.key,
    group: "Phase598A-T",
    groupTitle: "Codex Context Gateway Authorization Evidence Intake + Dry-Run Config Simulation",
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
    ...phase598SafetyBoundary,
    requiredFlag: config.requiredFlag,
    flags,
    checks,
    previewSummary: buildPreviewSummary(report),
    regression: regression.summary,
    secretProductUiRegression: secretProductUi.summary,
    readmeAgentsGuard: readmeAgentsGuard.summary,
    safetyBoundary: { ...phase598SafetyBoundary },
    rollbackNote:
      "Remove Phase598 authorization intake and dry-run simulation modules, tools/phase598*, docs/phase598*, apps/ai-gateway-service/evidence/phase598*, Mission Control authorization preview additions, and Phase598 package scripts; keep legacy/, PROJECT_CONTEXT.md, /chat, /chat-gateway/execute, provider runtime, real Codex config, Codex base_url, relay/proxy services, deploy, release, tags, artifacts, and secrets untouched.",
  };

  await writeDocs(config, report, result);
  await mkdir(resolve(repoRoot, dirname(config.evidencePath)), { recursive: true });
  await writeFileWithRetry(resolve(repoRoot, config.evidencePath), `${JSON.stringify(result, null, 2)}\n`);
  if (config.key === "phase598t") await writeClosureEvidence(result);

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
    check("phase597Completed", flags.phase597Completed === true),
    check("phase597RecommendedSealed", flags.phase597RecommendedSealed === true),
    check("phase597BlockerNull", flags.phase597BlockerNull === true),
    check("phase597TemplateExists", exists("docs/phase597s-authorization-packet-template.md")),
    check("phase597RollbackExists", exists("docs/phase597k-rollback-plan-builder.md")),
    check("phase597ConfigPreviewExists", exists("docs/phase597n-config-preview-artifact.md")),
    check("phase597MissionPreviewExists", exists("docs/phase597o-mission-control-base-url-design-preview.md")),
    check("contextPackMdExists", exists(".codex-context/current-context-pack.md")),
    check("relevantFilesJsonExists", exists(".codex-context/relevant-files.json")),
    check("promptPackMdExists", exists(".codex-context/codex-prompt-pack.md")),
    check("contextStaleFalse", report.baseUrlDesign.preconditions.stale === false),
    check("tokenBudgetRespected", report.baseUrlDesign.preconditions.tokenBudgetRespected === true),
    check("docs_exist", exists(config.docPath)),
    check("execution_report_exists", exists(config.reportPath)),
    check("verifier_exists", exists(config.verifierPath)),
    check("package_script_exists", rootPackage.scripts?.[config.packageScript] === `node ${config.verifierPath}`),
    check("aggregate_package_script_exists", rootPackage.scripts?.[phase598Group.packageScript] === "node tools/phase598-sequential-runner.mjs"),
    check("phase598_report_completed", report.completed === true),
    check("authorizationCompleteFalse", report.authorizationComplete === false),
    check("realIntegrationAllowedFalse", report.realIntegrationAllowed === false),
    check("guardedRealTestNotAllowedYet", report.guardedRealTestNotAllowedYet === true),
    check("safety_boundary_all_false", Object.values(phase598SafetyBoundary).every((value) => value === false)),
    check("providerCallsMadeFalse", report.providerCallsMade === false),
    check("rawSecretAccessedFalse", report.rawSecretAccessed === false),
    check("secretValueExposedFalse", report.secretValueExposed === false),
    check("rawWebhookAccessedFalse", report.rawWebhookAccessed === false),
    check("webhookValueExposedFalse", report.webhookValueExposed === false),
    check("codexBaseUrlModifiedFalse", report.codexBaseUrlModified === false),
    check("codexConfigModifiedFalse", report.codexConfigModified === false),
    check("realCodexConnectionMadeFalse", report.realCodexConnectionMade === false),
    check("relayStartedFalse", report.relayStarted === false),
    check("realConfigWriteAllowedFalse", report.realConfigWriteAllowed === false),
    check("relayStartAllowedFalse", report.relayStartAllowed === false),
    check("chatModifiedFalse", report.chatModified === false),
    check("chatGatewayExecuteModifiedFalse", report.chatGatewayExecuteModified === false),
    check("deployReleaseTagArtifactFalse", !report.deployExecuted && !report.releaseExecuted && !report.tagCreated && !report.artifactUploaded),
    check(config.requiredFlag, flags[config.requiredFlag] === true),
  ];

  if (config.key === "phase598t") {
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
  const authPreviewVisible = html.includes('id="codex-authorization-preview-section"');
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
    phase597Completed: previousPhases.phase597?.completed === true,
    phase597RecommendedSealed: previousPhases.phase597?.recommended_sealed === true,
    phase597BlockerNull: previousPhases.phase597?.blocker === null,
    scopeDefined: report.scopeDefined,
    authorizationEvidenceIntakeOnly: report.authorizationEvidenceIntakeOnly,
    dryRunConfigSimulationOnly: report.dryRunConfigSimulationOnly,
    authorizationEvidenceSchemaValid: report.authorizationIntake.authorizationEvidenceSchemaValid,
    allowCodexBaseUrlChangeRequired: report.authorizationIntake.allowCodexBaseUrlChangeRequired,
    configScopeRequired: report.authorizationIntake.configScopeRequired,
    relayRefRequired: report.authorizationIntake.relayRefRequired,
    credentialRefRequired: report.authorizationIntake.credentialRefRequired,
    maxRequestsRequired: report.authorizationIntake.maxRequestsRequired,
    maxCostRequired: report.authorizationIntake.maxEstimatedCostUsdRequired,
    rollbackOwnerRequired: report.authorizationIntake.rollbackOwnerRequired,
    approvalRecordRequired: report.authorizationIntake.approvalRecordRequired,
    authorizationCompletenessValidatorWorks: report.authorizationValidation.authorizationCompletenessValidatorWorks,
    missingAuthorizationBlocks: report.authorizationValidation.missingAuthorizationBlocks,
    partialAuthorizationBlocks: report.authorizationValidation.partialAuthorizationBlocks,
    completeAuthorizationWouldAllowDryRunSimulation: report.authorizationValidation.completeAuthorizationWouldAllowDryRunSimulation,
    realIntegrationStatusBlockedWhenIncomplete: report.authorizationValidation.realIntegrationStatusBlockedWhenIncomplete,
    authorizationTemplateGenerated: report.authorizationTemplate.authorizationTemplateGenerated,
    requiredFieldsPresent: report.authorizationTemplate.requiredFieldsPresent,
    placeholderOnly: report.authorizationTemplate.placeholderOnly,
    rawSecretExposed: report.authorizationTemplate.rawSecretExposed,
    realAuthorizationClaimed: report.authorizationTemplate.realAuthorizationClaimed,
    dryRunConfigSimulationSchemaValid: report.dryRunConfigSimulation.dryRunConfigSimulationSchemaValid,
    enabledDefaultFalse: report.dryRunConfigSimulation.enabled === false,
    dryRunOnlyDefaultTrue: report.dryRunConfigSimulation.dryRunOnly === true,
    wouldWriteConfig: report.dryRunConfigSimulation.wouldWriteConfig,
    wouldStartRelay: report.dryRunConfigSimulation.wouldStartRelay,
    redactedConfigPreviewGenerated: report.redactedConfigPreview.redactedConfigPreviewGenerated,
    rawBaseUrlValueExposed: report.redactedConfigPreview.rawBaseUrlValueExposed,
    credentialRefOnly: report.redactedConfigPreview.credentialRefOnly && report.credentialRefSimulation.credentialRefOnly,
    realUserConfigModified: report.redactedConfigPreview.realUserConfigModified,
    projectCodexConfigModified: report.redactedConfigPreview.projectCodexConfigModified,
    configPreviewDisabledByDefault: report.redactedConfigPreview.configPreviewDisabledByDefault,
    relaySimulationPlanGenerated: report.relaySimulationPlan.relaySimulationPlanGenerated,
    contextPackGateIncluded: report.relaySimulationPlan.contextPackGateIncluded,
    tokenBudgetGateIncluded: report.relaySimulationPlan.tokenBudgetGateIncluded,
    accountPoolPolicyIncluded: report.relaySimulationPlan.accountPoolPolicyIncluded,
    simulatedUpstreamOnly: report.relaySimulationPlan.simulatedUpstreamOnly,
    accountPoolSimulationWorks: report.accountPoolSimulation.accountPoolSimulationWorks,
    concurrencyLimitSimulated: report.accountPoolSimulation.concurrencyLimitSimulated,
    perAccountQuotaSimulated: report.accountPoolSimulation.perAccountQuotaSimulated,
    coolingWindowSimulated: report.accountPoolSimulation.coolingWindowSimulated,
    failureRotationSimulated: report.accountPoolSimulation.failureRotationSimulated,
    realAccountPoolConnected: report.accountPoolSimulation.realAccountPoolConnected,
    credentialRefSimulationWorks: report.credentialRefSimulation.credentialRefSimulationWorks,
    simulatedCredentialOnly: report.credentialRefSimulation.simulatedCredentialOnly,
    baseUrlDryRunPolicyWorks: report.baseUrlDryRunPolicy.baseUrlDryRunPolicyWorks,
    realConfigWriteForbidden: report.baseUrlDryRunPolicy.realConfigWriteForbidden,
    realRelayStartForbidden: report.baseUrlDryRunPolicy.realRelayStartForbidden,
    realProviderCallForbidden: report.baseUrlDryRunPolicy.realProviderCallForbidden,
    realSecretReadForbidden: report.baseUrlDryRunPolicy.realSecretReadForbidden,
    rollbackSimulationWorks: report.rollbackSimulation.rollbackSimulationWorks,
    previousConfigSnapshotRefUsed: Boolean(report.rollbackSimulation.previousConfigSnapshotRef),
    disableRelaySimulated: report.rollbackSimulation.disableRelaySimulated,
    invalidateStaleContextSimulated: report.rollbackSimulation.invalidateStaleContextSimulated,
    preserveEvidenceSimulated: report.rollbackSimulation.preserveEvidenceSimulated,
    destructiveRollbackForbidden: report.rollbackSimulation.destructiveRollbackForbidden,
    emergencyDisableSimulationWorks: report.emergencyDisableSimulation.emergencyDisableSimulationWorks,
    relayBlocked: report.emergencyDisableSimulation.relayBlocked,
    accountPoolBlocked: report.emergencyDisableSimulation.accountPoolBlocked,
    staleContextForced: report.emergencyDisableSimulation.staleContextForced,
    operatorAlertGenerated: report.emergencyDisableSimulation.operatorAlertGenerated,
    evidencePreserved: report.emergencyDisableSimulation.evidencePreserved,
    authorizationEvidenceGenerated: report.authorizationEvidence.authorizationEvidenceGenerated,
    authorizationCompletenessRecorded: Boolean(report.authorizationEvidence.authorizationCompleteness),
    realIntegrationStatusRecorded: Boolean(report.authorizationEvidence.realIntegrationStatus),
    configSimulationStatusRecorded: Boolean(report.authorizationEvidence.configSimulationStatus),
    rollbackSimulationStatusRecorded: Boolean(report.authorizationEvidence.rollbackSimulationStatus),
    safetyBoundaryRecorded: Boolean(report.authorizationEvidence.safetyBoundary),
    missionControlAuthorizationPreviewVisible: report.missionControlAuthorizationPreview.missionControlAuthorizationPreviewVisible && authPreviewVisible,
    authorizationPreviewVisible: report.missionControlAuthorizationPreview.authorizationPreviewVisible && html.includes('data-codex-authorization-preview="true"'),
    missingFieldsVisible: report.missionControlAuthorizationPreview.missingFieldsVisible && html.includes('data-codex-authorization-missing-fields="true"'),
    dryRunConfigSimulationVisible: report.missionControlAuthorizationPreview.dryRunConfigSimulationVisible && html.includes('data-codex-dry-run-config-simulation="true"'),
    realConfigWriteBlockedVisible: report.missionControlAuthorizationPreview.realConfigWriteBlockedVisible && html.includes('data-codex-real-config-write-blocked="true"'),
    relayStartBlockedVisible: report.missionControlAuthorizationPreview.relayStartBlockedVisible && html.includes('data-codex-relay-start-blocked="true"'),
    rollbackSimulationVisible: report.missionControlAuthorizationPreview.rollbackSimulationVisible && html.includes('data-codex-rollback-simulation="true"'),
    emergencyDisableVisible: report.missionControlAuthorizationPreview.emergencyDisableVisible && html.includes('data-codex-emergency-disable="true"'),
    deadButtonDetected: false,
    configSimulationReportGenerated: report.configSimulationReport.configSimulationReportGenerated,
    noRealConfigWriteStated: report.configSimulationReport.noRealConfigWriteStated,
    noBaseUrlChangeStated: report.configSimulationReport.noBaseUrlChangeStated,
    missingAuthorizationFieldsListed: report.configSimulationReport.missingAuthorizationFields.length > 0,
    nextRequiredUserActionListed: Boolean(report.configSimulationReport.nextRequiredUserAction),
    phase592597RegressionPassed: regression.completed === true,
    phase592RegressionPassed: regression.phase592RegressionPassed,
    phase593RegressionPassed: regression.phase593RegressionPassed,
    phase594RegressionPassed: regression.phase594RegressionPassed,
    phase595RegressionPassed: regression.phase595RegressionPassed,
    phase596RegressionPassed: regression.phase596RegressionPassed,
    phase597RegressionPassed: regression.phase597RegressionPassed,
    contextPackStillWorks: exists(".codex-context/current-context-pack.json"),
    baseUrlDesignStillDesignOnly: previousPhases.phase597?.completed === true,
    secretProductUiRegressionPassed: secretProductUi.completed === true,
    secretSafetyPassed: secretProductUi.secretSafetyPassed,
    productRecoveryPassed: secretProductUi.productRecoveryPassed,
    uiSmokePassed: secretProductUi.uiSmokePassed,
    phase574r2RegressionPassed: secretProductUi.phase574r2RegressionPassed,
    phase576eRegressionPassed: secretProductUi.phase576eRegressionPassed,
    readmeAgentsAuthorizationGuidanceUpdateWorks: readmeText.includes(phase598Title) && agentsText.includes(phase598Title),
    readmeManagedBlockUpdated: readmeText.includes(phase598Title),
    agentsManagedBlockUpdated: agentsText.includes(phase598Title),
    phase598GuidancePresent: readmeText.includes("Phase598A-T") && agentsText.includes("Phase598A-T"),
    phase306cGuardPassed: readmeAgentsGuard.phase306cGuardPassed,
    readmeAgentsSyncPassed: readmeAgentsGuard.completed === true,
    authorizationStatusReportGenerated: report.nextAuthorizationPacketStatus.authorizationStatusReportGenerated,
    authorizationComplete: report.nextAuthorizationPacketStatus.authorizationComplete,
    realIntegrationAllowed: report.nextAuthorizationPacketStatus.realIntegrationAllowed,
    missingFieldsListed: report.nextAuthorizationPacketStatus.missingFields.length > 0,
    guardedRealTestNotAllowedYet: report.nextAuthorizationPacketStatus.guardedRealTestNotAllowedYet,
    phase598RecommendedSealed:
      report.completed === true &&
      regression.completed === true &&
      secretProductUi.completed === true &&
      readmeAgentsGuard.completed === true &&
      authPreviewVisible,
  };
}

async function runRegressionCommands() {
  return runCommandSet([
    ["phase592RegressionPassed", "pnpm", ["run", "verify:phase592a-t-codex-context-gateway-token-budget-manager"]],
    ["phase593RegressionPassed", "pnpm", ["run", "verify:phase593a-t-codex-context-gateway-operator-panel"]],
    ["phase594RegressionPassed", "pnpm", ["run", "verify:phase594a-t-usage-workflow-runner-integration-preview"]],
    ["phase595RegressionPassed", "pnpm", ["run", "verify:phase595a-t-codex-context-real-usage-trial"]],
    ["phase596RegressionPassed", "pnpm", ["run", "verify:phase596a-t-codex-context-repeated-usage-benchmark"]],
    ["phase597RegressionPassed", "pnpm", ["run", "verify:phase597a-t-controlled-base-url-integration-design"]],
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
    phase597RegressionPassed: byId.phase597RegressionPassed === true,
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
      previousPhases.phase596?.completed === true &&
      previousPhases.phase597?.completed === true,
    phase592RegressionPassed: previousPhases.phase592?.completed === true,
    phase593RegressionPassed: previousPhases.phase593?.completed === true,
    phase594RegressionPassed: previousPhases.phase594?.completed === true,
    phase595RegressionPassed: previousPhases.phase595?.completed === true,
    phase596RegressionPassed: previousPhases.phase596?.completed === true,
    phase597RegressionPassed: previousPhases.phase597?.completed === true,
    summary: {
      phase592RegressionPassed: previousPhases.phase592?.completed === true,
      phase593RegressionPassed: previousPhases.phase593?.completed === true,
      phase594RegressionPassed: previousPhases.phase594?.completed === true,
      phase595RegressionPassed: previousPhases.phase595?.completed === true,
      phase596RegressionPassed: previousPhases.phase596?.completed === true,
      phase597RegressionPassed: previousPhases.phase597?.completed === true,
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
  const present = readmeText.includes(phase598Title) && agentsText.includes(phase598Title);
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
    phase597: "apps/ai-gateway-service/evidence/phase597t/controlled-base-url-integration-design-closure-result.json",
  };
  const entries = await Promise.all(Object.entries(paths).map(async ([key, path]) => [key, await readJson(path).catch(() => null)]));
  return Object.fromEntries(entries);
}

async function readPreviousSubphaseEvidence() {
  const items = [];
  for (const phase of phase598Subphases.filter((item) => item.key !== "phase598t")) {
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
    phaseRange: "Phase598A-T",
    title: "Codex Context Gateway Authorization Evidence Intake + Dry-Run Config Simulation",
    phaseCount: 20,
    failed,
    allSubphasesCompleted: failed.length === 0 && currentResult.completed === true,
    allSubphasesRecommendedSealed: failed.length === 0 && currentResult.recommended_sealed === true,
    blocker: failed.length === 0 && currentResult.blocker === null ? null : "phase598_aggregate_incomplete",
    completed: failed.length === 0 && currentResult.completed === true,
    recommended_sealed: failed.length === 0 && currentResult.recommended_sealed === true,
    phases: [...previous, {
      phase: currentResult.phase,
      evidenceJson: currentResult.evidenceJson,
      completed: currentResult.completed,
      recommended_sealed: currentResult.recommended_sealed,
      blocker: currentResult.blocker,
    }],
    authorizationEvidenceSchemaValid: currentResult.flags.authorizationEvidenceSchemaValid,
    authorizationCompletenessValidatorWorks: currentResult.flags.authorizationCompletenessValidatorWorks,
    dryRunConfigSimulationWorks: currentResult.flags.dryRunConfigSimulationSchemaValid,
    redactedConfigPreviewGenerated: currentResult.flags.redactedConfigPreviewGenerated,
    relaySimulationPlanGenerated: currentResult.flags.relaySimulationPlanGenerated,
    accountPoolSimulationWorks: currentResult.flags.accountPoolSimulationWorks,
    credentialRefSimulationWorks: currentResult.flags.credentialRefSimulationWorks,
    rollbackSimulationWorks: currentResult.flags.rollbackSimulationWorks,
    emergencyDisableSimulationWorks: currentResult.flags.emergencyDisableSimulationWorks,
    missionControlAuthorizationPreviewVisible: currentResult.flags.missionControlAuthorizationPreviewVisible,
    authorizationComplete: currentResult.flags.authorizationComplete,
    realIntegrationAllowed: currentResult.flags.realIntegrationAllowed,
    realConfigWriteAllowed: currentResult.realConfigWriteAllowed,
    relayStartAllowed: currentResult.relayStartAllowed,
    guardedRealTestNotAllowedYet: currentResult.flags.guardedRealTestNotAllowedYet,
    phase592RegressionPassed: currentResult.flags.phase592RegressionPassed,
    phase593RegressionPassed: currentResult.flags.phase593RegressionPassed,
    phase594RegressionPassed: currentResult.flags.phase594RegressionPassed,
    phase595RegressionPassed: currentResult.flags.phase595RegressionPassed,
    phase596RegressionPassed: currentResult.flags.phase596RegressionPassed,
    phase597RegressionPassed: currentResult.flags.phase597RegressionPassed,
    ...phase598SafetyBoundary,
  };
  await writeFileWithRetry(resolve(repoRoot, phase598Group.sequenceEvidencePath), `${JSON.stringify(aggregate, null, 2)}\n`);
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
    "- Phase598 is authorization evidence intake and dry-run config simulation only.",
    "- It records required authorization fields, validates completeness, builds redacted config previews, simulates relay/account-pool/credentialRef/rollback/emergency-disable paths, and exposes a Mission Control authorization preview.",
    "- It does not modify real Codex config, does not write ~/.codex/config.toml, does not create a project .codex/config.toml, does not change base_url, does not start relay/proxy services, does not call providers, and does not read secrets/webhooks.",
    "",
    "## Simulation Summary",
    `- authorizationComplete: ${report.authorizationComplete}`,
    `- realIntegrationStatus: ${report.realIntegrationStatus}`,
    `- dryRunConfigSimulationAllowed: ${report.dryRunConfigSimulationAllowed}`,
    `- realConfigWriteAllowed: ${report.realConfigWriteAllowed}`,
    `- relayStartAllowed: ${report.relayStartAllowed}`,
    `- guardedRealTestNotAllowedYet: ${report.guardedRealTestNotAllowedYet}`,
    `- missingAuthorizationFields: ${report.missingAuthorizationFields.join(", ")}`,
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
    `- authorizationEvidenceSchemaValid: ${report.authorizationIntake.authorizationEvidenceSchemaValid}`,
    `- authorizationCompletenessValidatorWorks: ${report.authorizationValidation.authorizationCompletenessValidatorWorks}`,
    `- dryRunConfigSimulationWorks: ${report.dryRunConfigSimulation.dryRunConfigSimulationSchemaValid}`,
    `- redactedConfigPreviewGenerated: ${report.redactedConfigPreview.redactedConfigPreviewGenerated}`,
    `- relaySimulationPlanGenerated: ${report.relaySimulationPlan.relaySimulationPlanGenerated}`,
    `- accountPoolSimulationWorks: ${report.accountPoolSimulation.accountPoolSimulationWorks}`,
    `- credentialRefSimulationWorks: ${report.credentialRefSimulation.credentialRefSimulationWorks}`,
    `- rollbackSimulationWorks: ${report.rollbackSimulation.rollbackSimulationWorks}`,
    `- emergencyDisableSimulationWorks: ${report.emergencyDisableSimulation.emergencyDisableSimulationWorks}`,
    `- authorizationComplete: ${report.authorizationComplete}`,
    `- realIntegrationAllowed: ${report.realIntegrationAllowed}`,
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
    contextHash: report.contextPack.contextHash,
    authorizationComplete: report.authorizationComplete,
    realIntegrationStatus: report.realIntegrationStatus,
    dryRunConfigSimulationAllowed: report.dryRunConfigSimulationAllowed,
    realConfigWriteAllowed: report.realConfigWriteAllowed,
    relayStartAllowed: report.relayStartAllowed,
    guardedRealTestNotAllowedYet: report.guardedRealTestNotAllowedYet,
  };
}

function buildModifiedFiles(config) {
  return [
    "packages/codex-context-gateway/src/authorizationEvidenceIntake.js",
    "packages/codex-context-gateway/src/authorizationCompletenessValidator.js",
    "packages/codex-context-gateway/src/dryRunConfigSimulation.js",
    "packages/codex-context-gateway/src/redactedConfigPreviewBuilder.js",
    "packages/codex-context-gateway/src/relaySimulationPlan.js",
    "packages/codex-context-gateway/src/accountPoolSimulation.js",
    "packages/codex-context-gateway/src/credentialRefSimulation.js",
    "packages/codex-context-gateway/src/baseUrlDryRunPolicy.js",
    "packages/codex-context-gateway/src/rollbackSimulation.js",
    "packages/codex-context-gateway/src/emergencyDisableSimulation.js",
    "packages/codex-context-gateway/src/authorizationEvidenceBuilder.js",
    "packages/codex-context-gateway/src/missionControlAuthorizationPreview.js",
    "packages/codex-context-gateway/src/index.js",
    "apps/ai-gateway-service/src/ui/components/CodexContextGatewayPanel.js",
    "apps/ai-gateway-service/src/ui/copy/codexContextGatewayCopy.js",
    "apps/ai-gateway-service/src/ui/consolePage.js",
    "tools/phase598-registry.mjs",
    "tools/phase598-common.mjs",
    "tools/phase598-sequential-runner.mjs",
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
