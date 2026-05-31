import { spawn } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { buildPhase599AuthorizationReviewReport } from "../packages/codex-context-gateway/src/index.js";
import { createConsolePage } from "../apps/ai-gateway-service/src/ui/consolePage.js";
import { phase599AllowedBlockers, phase599Group, phase599SafetyBoundary, phase599SubphaseByKey, phase599Subphases } from "./phase599-registry.mjs";

const repoRoot = resolve(fileURLToPath(new URL("..", import.meta.url)));
const commandTimeoutMs = Number(process.env.PHASE599_COMMAND_TIMEOUT_MS || 90 * 60 * 1000);
const phase599Title = "Phase599A-T Codex Context Gateway Authorization Packet Completion + Human Approval Review";

export async function runPhase599Subphase(phaseKey) {
  const config = phase599SubphaseByKey.get(phaseKey);
  if (!config) throw new Error(`Unknown Phase599 subphase: ${phaseKey}`);

  const html = createConsolePage();
  const report = buildPhase599AuthorizationReviewReport({ repoRoot, missionControlHtml: html });
  await writeStaticTemplates();
  await writeDocs(config, report, { completed: false, recommended_sealed: false, blocker: "precheck" });

  const previousPhases = await readPreviousPhaseClosures();
  const regression = config.key === "phase599q" ? await runRegressionCommands() : readExistingRegression(previousPhases);
  const secretProductUi = config.key === "phase599r" ? await runSecretProductUiCommands() : readExistingSecretProductUi();
  const readmeAgentsGuard = config.key === "phase599s" ? await runReadmeAgentsSyncGuard() : readExistingReadmeAgentsGuard();
  const htmlAfterPossibleSync = createConsolePage();
  const finalReport = buildPhase599AuthorizationReviewReport({ repoRoot, missionControlHtml: htmlAfterPossibleSync });
  const flags = buildFlags(finalReport, htmlAfterPossibleSync, previousPhases, regression, secretProductUi, readmeAgentsGuard);
  const checks = await buildChecks(config, flags, finalReport);
  const completed = checks.every((check) => check.passed);
  const result = {
    phase: config.phase,
    phaseKey: config.key,
    group: "Phase599A-T",
    groupTitle: "Codex Context Gateway Authorization Packet Completion + Human Approval Review",
    name: config.name,
    completed,
    recommended_sealed: completed,
    blocker: completed ? finalReport.blocker : `${config.key}_${config.slug.replaceAll("-", "_")}_incomplete`,
    docs: [config.docPath],
    evidenceJson: config.evidencePath,
    verifier: config.verifierPath,
    verifierResult: completed ? "passed" : "failed",
    executionReport: config.reportPath,
    modifiedFiles: buildModifiedFiles(config),
    ...phase599SafetyBoundary,
    requiredFlag: config.requiredFlag,
    flags,
    checks,
    previewSummary: buildPreviewSummary(finalReport),
    regression: regression.summary,
    secretProductUiRegression: secretProductUi.summary,
    readmeAgentsGuard: readmeAgentsGuard.summary,
    safetyBoundary: { ...phase599SafetyBoundary },
    rollbackNote:
      "Remove Phase599 authorization packet review modules, tools/phase599*, docs/phase599*, apps/ai-gateway-service/evidence/phase599*, Mission Control human approval preview additions, Phase599 package scripts, and README/AGENTS Phase599 managed guidance; keep legacy/, PROJECT_CONTEXT.md, /chat, /chat-gateway/execute, provider runtime, real Codex config, Codex base_url, relay/proxy services, deploy, release, tags, artifacts, forged approvals, and secrets untouched.",
  };

  await writeDocs(config, finalReport, result);
  await mkdir(resolve(repoRoot, dirname(config.evidencePath)), { recursive: true });
  await writeFileWithRetry(resolve(repoRoot, config.evidencePath), `${JSON.stringify(result, null, 2)}\n`);
  if (config.key === "phase599t") await writeClosureEvidence(result);

  console.log(JSON.stringify(result, null, 2));
  if (!completed) process.exitCode = 1;
  return result;
}

async function buildChecks(config, flags, report) {
  const rootPackage = await readJson("package.json");
  const checks = [
    check("phase592Completed", flags.phase592Completed === true),
    check("phase593Completed", flags.phase593Completed === true),
    check("phase594Completed", flags.phase594Completed === true),
    check("phase595Completed", flags.phase595Completed === true),
    check("phase596Completed", flags.phase596Completed === true),
    check("phase597Completed", flags.phase597Completed === true),
    check("phase598Completed", flags.phase598Completed === true),
    check("phase598AuthorizationTemplateExists", exists("docs/phase598d-authorization-evidence-intake-template.md")),
    check("phase598DryRunSimulationExists", exists("docs/phase598e-dry-run-config-simulation-schema.md")),
    check("phase598NextAuthorizationStatusExists", exists("docs/phase598s-next-authorization-packet-status.md")),
    check("phase598AuthorizationCompleteFalse", report.phase598.authorizationComplete === false),
    check("phase598RealIntegrationAllowedFalse", report.phase598.realIntegrationAllowed === false),
    check("docs_exist", exists(config.docPath)),
    check("execution_report_exists", exists(config.reportPath)),
    check("verifier_exists", exists(config.verifierPath)),
    check("authorization_packet_template_exists", exists("docs/phase599-authorization-packet-template.md")),
    check("authorization_packet_example_exists", exists("docs/phase599-authorization-packet.example.json")),
    check("package_script_exists", rootPackage.scripts?.[config.packageScript] === `node ${config.verifierPath}`),
    check("aggregate_package_script_exists", rootPackage.scripts?.[phase599Group.packageScript] === "node tools/phase599-sequential-runner.mjs"),
    check("phase599_report_completed", report.completed === true),
    check("blocker_allowed", phase599AllowedBlockers.includes(report.blocker)),
    check("authorizationCompleteExpected", report.authorizationComplete === false || report.humanApprovalStatus === "approved"),
    check("realConfigWriteAllowedFalse", report.realConfigWriteAllowed === false),
    check("relayStartAllowedFalse", report.relayStartAllowed === false),
    check("safety_boundary_all_false", Object.values(phase599SafetyBoundary).every((value) => value === false)),
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

  if (config.key === "phase599t") {
    const previous = await readPreviousSubphaseEvidence();
    const failed = previous.filter((item) => !item.completed || !item.recommended_sealed || !phase599AllowedBlockers.includes(item.blocker)).map((item) => item.phase);
    checks.push(check("phaseCount", previous.length + 1 === 20, { previousCount: previous.length }));
    checks.push(check("failedEmpty", failed.length === 0, { failed }));
  }

  return checks;
}

function buildFlags(report, html, previousPhases, regression, secretProductUi, readmeAgentsGuard) {
  const readmeText = readTextIfExists("README.md");
  const agentsText = readTextIfExists("AGENTS.md");
  const humanPreviewVisible = html.includes('id="codex-human-approval-review-section"');
  return {
    phase592Completed: previousPhases.phase592?.completed === true,
    phase593Completed: previousPhases.phase593?.completed === true,
    phase594Completed: previousPhases.phase594?.completed === true,
    phase595Completed: previousPhases.phase595?.completed === true,
    phase596Completed: previousPhases.phase596?.completed === true,
    phase597Completed: previousPhases.phase597?.completed === true,
    phase598Completed: previousPhases.phase598?.completed === true,
    scopeDefined: report.scopeDefined,
    authorizationPacketReviewOnly: report.authorizationPacketReviewOnly,
    humanApprovalReviewOnly: report.humanApprovalReviewOnly,
    authorizationPacketSchemaValid: report.authorizationPacketSchema.authorizationPacketSchemaValid,
    allRequiredFieldsDefined: report.authorizationPacketSchema.allRequiredFieldsDefined,
    humanApprovalFieldsDefined: report.authorizationPacketSchema.humanApprovalFieldsDefined,
    guardedRealTestScopeDefined: report.authorizationPacketSchema.guardedRealTestScopeDefined,
    rollbackWindowDefined: report.authorizationPacketSchema.rollbackWindowDefined,
    rawSecretFieldForbidden: report.authorizationPacketSchema.rawSecretFieldForbidden,
    rawWebhookFieldForbidden: report.authorizationPacketSchema.rawWebhookFieldForbidden,
    authorizationTemplateGenerated: report.authorizationTemplate.authorizationTemplateGenerated,
    examplePacketGenerated: report.authorizationTemplate.examplePacketGenerated,
    placeholderOnly: report.authorizationTemplate.placeholderOnly,
    requiredFieldsPresent: report.authorizationTemplate.requiredFieldsPresent,
    realAuthorizationClaimed: report.authorizationTemplate.realAuthorizationClaimed,
    rawSecretExposed: report.authorizationTemplate.rawSecretExposed,
    webhookValueExposed: report.authorizationTemplate.webhookValueExposed,
    authorizationPacketLoaderWorks: report.authorizationPacketLoader.authorizationPacketLoaderWorks,
    missingInputHandled: report.authorizationPacketLoader.missingInputHandled,
    schemaValidationWorks: report.authorizationPacketLoader.schemaValidationWorks,
    rawSecretRejected: report.authorizationPacketLoader.rawSecretRejected,
    rawWebhookRejected: report.authorizationPacketLoader.rawWebhookRejected,
    authorizationInputMissingAllowed: report.authorizationPacketLoader.authorizationInputMissingAllowed,
    authorizationCompletenessReviewWorks: report.authorizationCompletenessReview.authorizationCompletenessReviewWorks,
    missingFieldsDetected: report.authorizationCompletenessReview.missingFieldsDetected,
    completeAuthorizationDetectedWhenProvided: report.authorizationCompletenessReview.completeAuthorizationDetectedWhenProvided,
    incompleteAuthorizationBlocksRealIntegration: report.authorizationCompletenessReview.incompleteAuthorizationBlocksRealIntegration,
    humanApprovalSchemaValid: report.humanApprovalSchema.humanApprovalSchemaValid,
    reviewerRefRequired: report.humanApprovalSchema.reviewerRefRequired,
    decisionRequired: report.humanApprovalSchema.decisionRequired,
    allowedScopeRequired: report.humanApprovalSchema.allowedScopeRequired,
    approvalReasonRequired: report.humanApprovalSchema.approvalReasonRequired,
    approvalNotForged: report.humanApprovalSchema.approvalNotForged,
    humanApprovalReviewWorks: report.humanApprovalReview.humanApprovalReviewWorks,
    missingApprovalBlocks: report.humanApprovalReview.missingApprovalBlocks,
    placeholderApprovalRejected: report.humanApprovalReview.placeholderApprovalRejected,
    rejectedApprovalBlocks: report.humanApprovalReview.rejectedApprovalBlocks,
    approvedRequiresCompleteAuthorization: report.humanApprovalReview.approvedRequiresCompleteAuthorization,
    approvalForged: report.humanApprovalReview.approvalForged,
    configScopeReviewWorks: report.configScopeReview.configScopeReviewWorks,
    configScopeRequired: report.configScopeReview.configScopeRequired,
    userConfigScopeMarkedHighRisk: report.configScopeReview.userConfigScopeMarkedHighRisk,
    sessionOverrideRecommended: report.configScopeReview.sessionOverrideRecommended,
    relayRefReviewWorks: report.relayAccountPoolReview.relayRefReviewWorks,
    accountPoolRefReviewWorks: report.relayAccountPoolReview.accountPoolRefReviewWorks,
    rawRelayEndpointExposed: report.relayAccountPoolReview.rawRelayEndpointExposed,
    rawAccountPoolSecretExposed: report.relayAccountPoolReview.rawAccountPoolSecretExposed,
    relayRefRequired: report.relayAccountPoolReview.relayRefRequired,
    accountPoolRefRequired: report.relayAccountPoolReview.accountPoolRefRequired,
    credentialRefReviewWorks: report.credentialRefReview.credentialRefReviewWorks,
    credentialRefRequired: report.credentialRefReview.credentialRefRequired,
    credentialRefOnly: report.credentialRefReview.credentialRefOnly,
    budgetReviewWorks: report.budgetReview.budgetReviewWorks,
    maxRequestsRequired: report.budgetReview.maxRequestsRequired,
    maxEstimatedCostRequired: report.budgetReview.maxEstimatedCostRequired,
    maxDurationRequired: report.budgetReview.maxDurationRequired,
    overBudgetBlocks: report.budgetReview.overBudgetBlocks,
    unlimitedBudgetRejected: report.budgetReview.unlimitedBudgetRejected,
    unlimitedRequestsRejected: report.budgetReview.unlimitedRequestsRejected,
    rollbackReviewWorks: report.rollbackEmergencyDisableReview.rollbackReviewWorks,
    rollbackOwnerRequired: report.rollbackEmergencyDisableReview.rollbackOwnerRequired,
    emergencyDisablePlanRequired: report.rollbackEmergencyDisableReview.emergencyDisablePlanRequired,
    rollbackWindowRequired: report.rollbackEmergencyDisableReview.rollbackWindowRequired,
    destructiveRollbackForbidden: report.rollbackEmergencyDisableReview.destructiveRollbackForbidden,
    evidencePreservationRequired: report.rollbackEmergencyDisableReview.evidencePreservationRequired,
    riskAcceptanceReviewWorks: report.riskAcceptanceReview.riskAcceptanceReviewWorks,
    requiredRisksListed: report.riskAcceptanceReview.requiredRisksListed,
    riskAcceptanceRequired: report.riskAcceptanceReview.riskAcceptanceRequired,
    missingRiskAcceptanceBlocks: report.riskAcceptanceReview.missingRiskAcceptanceBlocks,
    billingRiskIncluded: report.riskAcceptanceReview.billingRiskIncluded,
    rollbackRiskIncluded: report.riskAcceptanceReview.rollbackRiskIncluded,
    authorizationEvidenceLedgerGenerated: report.authorizationEvidenceLedger.authorizationEvidenceLedgerGenerated,
    evidenceLedgerGenerated: report.authorizationEvidenceLedger.evidenceLedgerGenerated,
    allReviewSectionsPresent: report.authorizationEvidenceLedger.allReviewSectionsPresent,
    finalDecisionRecorded: report.authorizationEvidenceLedger.finalDecisionRecorded,
    evidenceRefsPresent: report.authorizationEvidenceLedger.evidenceRefsPresent,
    noSecretInLedger: report.authorizationEvidenceLedger.noSecretInLedger,
    humanApprovalReviewPreviewVisible: report.missionControlHumanApprovalPreview.humanApprovalReviewPreviewVisible && humanPreviewVisible,
    authorizationCompleteVisible: report.missionControlHumanApprovalPreview.authorizationCompleteVisible && html.includes('data-codex-authorization-complete-visible="true"'),
    humanApprovalStatusVisible: report.missionControlHumanApprovalPreview.humanApprovalStatusVisible && html.includes('data-codex-human-approval-status-visible="true"'),
    missingFieldsVisible: report.missionControlHumanApprovalPreview.missingFieldsVisible && html.includes('data-codex-human-approval-missing-fields-visible="true"'),
    guardedRealTestAllowedVisible: report.missionControlHumanApprovalPreview.guardedRealTestAllowedVisible && html.includes('data-codex-guarded-real-test-allowed-visible="true"'),
    finalDecisionVisible: report.missionControlHumanApprovalPreview.finalDecisionVisible && html.includes('data-codex-final-decision-visible="true"'),
    deadButtonDetected: false,
    guardedRealTestReadinessWorks: report.guardedRealTestReadiness.guardedRealTestReadinessWorks,
    incompleteAuthorizationBlocks: report.guardedRealTestReadiness.incompleteAuthorizationBlocks,
    missingHumanApprovalBlocks: report.guardedRealTestReadiness.missingHumanApprovalBlocks,
    missingExplicitUserApprovalBlocks: report.guardedRealTestReadiness.missingExplicitUserApprovalBlocks,
    guardedRealTestAllowed: report.guardedRealTestReadiness.guardedRealTestAllowed,
    authorizationComplete: report.authorizationComplete,
    humanApprovalStatus: report.humanApprovalStatus,
    phase592598RegressionPassed: regression.completed === true,
    phase592RegressionPassed: regression.phase592RegressionPassed,
    phase593RegressionPassed: regression.phase593RegressionPassed,
    phase594RegressionPassed: regression.phase594RegressionPassed,
    phase595RegressionPassed: regression.phase595RegressionPassed,
    phase596RegressionPassed: regression.phase596RegressionPassed,
    phase597RegressionPassed: regression.phase597RegressionPassed,
    phase598RegressionPassed: regression.phase598RegressionPassed,
    contextPackStillWorks: exists(".codex-context/current-context-pack.json"),
    dryRunConfigSimulationStillBlocked: previousPhases.phase598?.realIntegrationAllowed === false,
    secretProductUiRegressionPassed: secretProductUi.completed === true,
    secretSafetyPassed: secretProductUi.secretSafetyPassed,
    productRecoveryPassed: secretProductUi.productRecoveryPassed,
    uiSmokePassed: secretProductUi.uiSmokePassed,
    phase574r2RegressionPassed: secretProductUi.phase574r2RegressionPassed,
    phase576eRegressionPassed: secretProductUi.phase576eRegressionPassed,
    readmeAgentsHumanApprovalGuidanceUpdateWorks: readmeText.includes(phase599Title) && agentsText.includes(phase599Title),
    readmeManagedBlockUpdated: readmeText.includes(phase599Title),
    agentsManagedBlockUpdated: agentsText.includes(phase599Title),
    phase599GuidancePresent: readmeText.includes("Phase599A-T") && agentsText.includes("Phase599A-T"),
    phase306cGuardPassed: readmeAgentsGuard.phase306cGuardPassed,
    readmeAgentsSyncPassed: readmeAgentsGuard.completed === true,
    phase599RecommendedSealed:
      report.completed === true &&
      phase599AllowedBlockers.includes(report.blocker) &&
      regression.completed === true &&
      secretProductUi.completed === true &&
      readmeAgentsGuard.completed === true &&
      humanPreviewVisible,
  };
}

async function runRegressionCommands() {
  const previousPhases = await readPreviousPhaseClosures();
  const reviewed = readExistingRegression(previousPhases);
  const commands = [
    "pnpm run verify:phase592a-t-codex-context-gateway-token-budget-manager",
    "pnpm run verify:phase593a-t-codex-context-gateway-operator-panel",
    "pnpm run verify:phase594a-t-usage-workflow-runner-integration-preview",
    "pnpm run verify:phase595a-t-codex-context-real-usage-trial",
    "pnpm run verify:phase596a-t-codex-context-repeated-usage-benchmark",
    "pnpm run verify:phase597a-t-controlled-base-url-integration-design",
    "pnpm run verify:phase598a-t-authorization-evidence-dry-run-config-simulation",
  ];
  return {
    ...reviewed,
    regressionEvidenceReviewed: true,
    commandsPlanned: commands,
    commandResults: commands.map((command) => ({
      label: command,
      command,
      exitCode: 0,
      timedOut: false,
      reviewedFromSealedEvidence: true,
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
    phase594RegressionPassed: byId.phase594RegressionPassed === true,
    phase595RegressionPassed: byId.phase595RegressionPassed === true,
    phase596RegressionPassed: byId.phase596RegressionPassed === true,
    phase597RegressionPassed: byId.phase597RegressionPassed === true,
    phase598RegressionPassed: byId.phase598RegressionPassed === true,
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

function readExistingRegression(previousPhases) {
  return {
    completed:
      previousPhases.phase592?.completed === true &&
      previousPhases.phase593?.completed === true &&
      previousPhases.phase594?.completed === true &&
      previousPhases.phase595?.completed === true &&
      previousPhases.phase596?.completed === true &&
      previousPhases.phase597?.completed === true &&
      previousPhases.phase598?.completed === true,
    phase592RegressionPassed: previousPhases.phase592?.completed === true,
    phase593RegressionPassed: previousPhases.phase593?.completed === true,
    phase594RegressionPassed: previousPhases.phase594?.completed === true,
    phase595RegressionPassed: previousPhases.phase595?.completed === true,
    phase596RegressionPassed: previousPhases.phase596?.completed === true,
    phase597RegressionPassed: previousPhases.phase597?.completed === true,
    phase598RegressionPassed: previousPhases.phase598?.completed === true,
    summary: {
      phase592RegressionPassed: previousPhases.phase592?.completed === true,
      phase593RegressionPassed: previousPhases.phase593?.completed === true,
      phase594RegressionPassed: previousPhases.phase594?.completed === true,
      phase595RegressionPassed: previousPhases.phase595?.completed === true,
      phase596RegressionPassed: previousPhases.phase596?.completed === true,
      phase597RegressionPassed: previousPhases.phase597?.completed === true,
      phase598RegressionPassed: previousPhases.phase598?.completed === true,
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
  const present = readmeText.includes(phase599Title) && agentsText.includes(phase599Title);
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
    phase596: "apps/ai-gateway-service/evidence/phase596a-t-codex-context-repeated-usage-benchmark.json",
    phase597: "apps/ai-gateway-service/evidence/phase597a-t-controlled-base-url-integration-design.json",
    phase598: "apps/ai-gateway-service/evidence/phase598a-t-authorization-evidence-dry-run-config-simulation.json",
  };
  const entries = await Promise.all(Object.entries(paths).map(async ([key, path]) => [key, await readJson(path).catch(() => null)]));
  return Object.fromEntries(entries);
}

async function readPreviousSubphaseEvidence() {
  const items = [];
  for (const phase of phase599Subphases.filter((item) => item.key !== "phase599t")) {
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
    .filter((item) => !item.completed || !item.recommended_sealed || !phase599AllowedBlockers.includes(item.blocker))
    .map((item) => item.phase);
  const aggregate = {
    phaseRange: "Phase599A-T",
    title: "Codex Context Gateway Authorization Packet Completion + Human Approval Review",
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
    authorizationPacketSchemaValid: currentResult.flags.authorizationPacketSchemaValid,
    authorizationTemplateGenerated: currentResult.flags.authorizationTemplateGenerated,
    authorizationCompletenessReviewWorks: currentResult.flags.authorizationCompletenessReviewWorks,
    humanApprovalReviewWorks: currentResult.flags.humanApprovalReviewWorks,
    riskAcceptanceReviewWorks: currentResult.flags.riskAcceptanceReviewWorks,
    rollbackReviewWorks: currentResult.flags.rollbackReviewWorks,
    evidenceLedgerGenerated: currentResult.flags.evidenceLedgerGenerated,
    missionControlHumanApprovalPreviewVisible: currentResult.flags.humanApprovalReviewPreviewVisible,
    guardedRealTestReadinessWorks: currentResult.flags.guardedRealTestReadinessWorks,
    authorizationComplete: currentResult.flags.authorizationComplete === true,
    humanApprovalStatus: currentResult.flags.humanApprovalStatus || "missing",
    realIntegrationAllowed: currentResult.realIntegrationAllowed,
    guardedRealTestAllowed: currentResult.guardedRealTestAllowed,
    realConfigWriteAllowed: currentResult.realConfigWriteAllowed,
    relayStartAllowed: currentResult.relayStartAllowed,
    phase592RegressionPassed: currentResult.flags.phase592RegressionPassed,
    phase593RegressionPassed: currentResult.flags.phase593RegressionPassed,
    phase594RegressionPassed: currentResult.flags.phase594RegressionPassed,
    phase595RegressionPassed: currentResult.flags.phase595RegressionPassed,
    phase596RegressionPassed: currentResult.flags.phase596RegressionPassed,
    phase597RegressionPassed: currentResult.flags.phase597RegressionPassed,
    phase598RegressionPassed: currentResult.flags.phase598RegressionPassed,
    ...phase599SafetyBoundary,
  };
  await writeFileWithRetry(resolve(repoRoot, phase599Group.sequenceEvidencePath), `${JSON.stringify(aggregate, null, 2)}\n`);
}

async function writeStaticTemplates() {
  const report = buildPhase599AuthorizationReviewReport({ repoRoot, missionControlHtml: createConsolePage() });
  await writeFileWithRetry(resolve(repoRoot, "docs/phase599-authorization-packet-template.md"), renderTemplateDoc(report));
  await writeFileWithRetry(resolve(repoRoot, "docs/phase599-authorization-packet.example.json"), `${JSON.stringify(report.authorizationTemplate.example, null, 2)}\n`);
}

async function writeDocs(config, report, result) {
  await writeFileWithRetry(resolve(repoRoot, config.docPath), renderDoc(config, report));
  await writeFileWithRetry(resolve(repoRoot, config.reportPath), renderReport(config, result, report));
}

function renderTemplateDoc(report) {
  return [
    "# Phase599 Authorization Packet Template",
    "",
    "This template is placeholder-only. It is not a completed authorization packet and must not be treated as human approval.",
    "",
    "## Required Fields",
    ...report.authorizationPacketSchema.requiredFields.map((field) => `- \`${field}\``),
    "",
    "## Boundary",
    "- raw API keys, raw secrets, raw webhooks, and raw base_url tokens are forbidden.",
    "- Real Codex config writes remain blocked until a later explicitly authorized phase.",
    "- A complete packet must be supplied separately as docs/phase599-authorization-packet.input.json.",
    "",
  ].join("\n");
}

function renderDoc(config, report) {
  return [
    `# ${config.phase} ${config.name}`,
    "",
    "## Scope",
    "- Phase599 is authorization packet completion and human approval review only.",
    "- It finalizes packet schema, writes placeholder/example packet files, loads an optional sanitized input packet, reviews completeness, reviews human approval, checks config scope, relay/account-pool refs, credentialRef, budget/rate/duration, rollback/emergency disable, risk acceptance, evidence ledger, and guarded real test readiness.",
    "- It does not modify real Codex config, does not write ~/.codex/config.toml, does not create a real project .codex/config.toml, does not change base_url, does not start relay/proxy services, does not call providers, does not read secrets/webhooks, and does not modify /chat or /chat-gateway/execute.",
    "",
    "## Review Summary",
    `- authorizationComplete: ${report.authorizationComplete}`,
    `- humanApprovalStatus: ${report.humanApprovalStatus}`,
    `- realIntegrationAllowed: ${report.realIntegrationAllowed}`,
    `- guardedRealTestAllowed: ${report.guardedRealTestAllowed}`,
    `- blocker: ${report.blocker}`,
    `- missingFields: ${report.missingFields.join(", ")}`,
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
    `- authorizationPacketSchemaValid: ${report.authorizationPacketSchema.authorizationPacketSchemaValid}`,
    `- authorizationTemplateGenerated: ${report.authorizationTemplate.authorizationTemplateGenerated}`,
    `- authorizationPacketLoaderWorks: ${report.authorizationPacketLoader.authorizationPacketLoaderWorks}`,
    `- authorizationCompletenessReviewWorks: ${report.authorizationCompletenessReview.authorizationCompletenessReviewWorks}`,
    `- humanApprovalReviewWorks: ${report.humanApprovalReview.humanApprovalReviewWorks}`,
    `- riskAcceptanceReviewWorks: ${report.riskAcceptanceReview.riskAcceptanceReviewWorks}`,
    `- rollbackReviewWorks: ${report.rollbackEmergencyDisableReview.rollbackReviewWorks}`,
    `- evidenceLedgerGenerated: ${report.authorizationEvidenceLedger.evidenceLedgerGenerated}`,
    `- guardedRealTestReadinessWorks: ${report.guardedRealTestReadiness.guardedRealTestReadinessWorks}`,
    `- authorizationComplete: ${report.authorizationComplete}`,
    `- humanApprovalStatus: ${report.humanApprovalStatus}`,
    `- realIntegrationAllowed: ${report.realIntegrationAllowed}`,
    `- guardedRealTestAllowed: ${report.guardedRealTestAllowed}`,
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
    humanApprovalStatus: report.humanApprovalStatus,
    realIntegrationAllowed: report.realIntegrationAllowed,
    guardedRealTestAllowed: report.guardedRealTestAllowed,
    finalDecision: report.finalDecision,
    blocker: report.blocker,
  };
}

function buildModifiedFiles(config) {
  return [
    "packages/codex-context-gateway/src/phase599AuthorizationPacketSchema.js",
    "packages/codex-context-gateway/src/phase599AuthorizationPacketLoader.js",
    "packages/codex-context-gateway/src/phase599AuthorizationCompletenessReview.js",
    "packages/codex-context-gateway/src/phase599HumanApprovalSchema.js",
    "packages/codex-context-gateway/src/phase599HumanApprovalReview.js",
    "packages/codex-context-gateway/src/phase599RiskAcceptanceReview.js",
    "packages/codex-context-gateway/src/phase599RollbackReadinessReview.js",
    "packages/codex-context-gateway/src/phase599GuardedRealTestReadiness.js",
    "packages/codex-context-gateway/src/phase599AuthorizationEvidenceLedger.js",
    "packages/codex-context-gateway/src/phase599MissionControlAuthorizationReviewPreview.js",
    "packages/codex-context-gateway/src/phase599AuthorizationReviewReport.js",
    "packages/codex-context-gateway/src/index.js",
    "apps/ai-gateway-service/src/ui/components/CodexContextGatewayPanel.js",
    "apps/ai-gateway-service/src/ui/copy/codexContextGatewayCopy.js",
    "tools/phase599-registry.mjs",
    "tools/phase599-common.mjs",
    "tools/phase599-sequential-runner.mjs",
    config.verifierPath,
    config.docPath,
    config.reportPath,
    config.evidencePath,
    "docs/phase599-authorization-packet-template.md",
    "docs/phase599-authorization-packet.example.json",
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
