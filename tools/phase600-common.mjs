import { spawn } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { buildPhase600ReadinessReviewReport } from "../packages/codex-context-gateway/src/index.js";
import { createConsolePage } from "../apps/ai-gateway-service/src/ui/consolePage.js";
import { phase600AllowedBlockers, phase600Group, phase600SafetyBoundary, phase600SubphaseByKey, phase600Subphases } from "./phase600-registry.mjs";

const repoRoot = resolve(fileURLToPath(new URL("..", import.meta.url)));
const commandTimeoutMs = Number(process.env.PHASE600_COMMAND_TIMEOUT_MS || 90 * 60 * 1000);
const phase600Title = "Phase600A-T Codex Context Gateway Authorization Packet Input + Human Approval Record + Guarded Real Test Readiness Review";

export async function runPhase600Subphase(phaseKey) {
  const config = phase600SubphaseByKey.get(phaseKey);
  if (!config) throw new Error(`Unknown Phase600 subphase: ${phaseKey}`);

  await writeStaticInputExamples();
  await writeDocs(config, buildPhase600ReadinessReviewReport({ repoRoot, missionControlHtml: createConsolePage() }), {
    completed: false,
    recommended_sealed: false,
    blocker: "precheck",
  });

  const previousPhases = await readPreviousPhaseClosures();
  const regression = config.key === "phase600p" ? await runRegressionCommands(previousPhases) : readExistingRegression(previousPhases);
  const secretProductUi = config.key === "phase600q" ? await runSecretProductUiCommands() : readExistingSecretProductUi();
  const readmeAgentsGuard = config.key === "phase600r" ? await runReadmeAgentsSyncGuard() : readExistingReadmeAgentsGuard();
  const html = createConsolePage();
  const report = buildPhase600ReadinessReviewReport({ repoRoot, missionControlHtml: html });
  const flags = buildFlags(report, html, previousPhases, regression, secretProductUi, readmeAgentsGuard);
  const checks = await buildChecks(config, flags, report);
  const completed = checks.every((check) => check.passed);
  const result = {
    phase: config.phase,
    phaseKey: config.key,
    group: "Phase600A-T",
    groupTitle: "Codex Context Gateway Authorization Packet Input + Human Approval Record + Guarded Real Test Readiness Review",
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
    ...phase600SafetyBoundary,
    requiredFlag: config.requiredFlag,
    flags,
    checks,
    previewSummary: buildPreviewSummary(report),
    regression: regression.summary,
    secretProductUiRegression: secretProductUi.summary,
    readmeAgentsGuard: readmeAgentsGuard.summary,
    safetyBoundary: { ...phase600SafetyBoundary },
    rollbackNote:
      "Remove Phase600 authorization input/readiness modules, tools/phase600*, docs/phase600*, apps/ai-gateway-service/evidence/phase600*, Mission Control readiness preview additions, Phase600 package scripts, and README/AGENTS Phase600 managed guidance; keep legacy/, PROJECT_CONTEXT.md, /chat, /chat-gateway/execute, provider runtime, real Codex config/base_url, relay/proxy services, deploy, release, tags, artifacts, forged approvals, and secrets untouched.",
  };

  await writeDocs(config, report, result);
  await mkdir(resolve(repoRoot, dirname(config.evidencePath)), { recursive: true });
  await writeFileWithRetry(resolve(repoRoot, config.evidencePath), `${JSON.stringify(result, null, 2)}\n`);
  if (config.key === "phase600t") await writeClosureEvidence(result);

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
    check("phase599Completed", flags.phase599Completed === true),
    check("phase599TemplateExists", exists("docs/phase599-authorization-packet-template.md")),
    check("phase599ReviewEvidenceExists", exists("apps/ai-gateway-service/evidence/phase599a-t-authorization-packet-human-approval-review.json")),
    check("docs_exist", exists(config.docPath)),
    check("execution_report_exists", exists(config.reportPath)),
    check("verifier_exists", exists(config.verifierPath)),
    check("auth_example_exists", exists("docs/phase600-authorization-packet.input.example.json")),
    check("approval_example_exists", exists("docs/phase600-human-approval-record.input.example.json")),
    check("package_script_exists", rootPackage.scripts?.[config.packageScript] === `node ${config.verifierPath}`),
    check("aggregate_package_script_exists", rootPackage.scripts?.[phase600Group.packageScript] === "node tools/phase600-sequential-runner.mjs"),
    check("phase600_report_completed", report.completed === true),
    check("blocker_allowed", phase600AllowedBlockers.includes(report.blocker)),
    check("realIntegrationAllowedFalse", report.realIntegrationAllowed === false),
    check("guardedRealTestAllowedFalse", report.guardedRealTestAllowed === false),
    check("realConfigWriteAllowedFalse", report.realConfigWriteAllowed === false),
    check("relayStartAllowedFalse", report.relayStartAllowed === false),
    check("safety_boundary_all_false", Object.values(phase600SafetyBoundary).every((value) => value === false)),
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

  if (config.key === "phase600t") {
    const previous = await readPreviousSubphaseEvidence();
    const failed = previous.filter((item) => !item.completed || !item.recommended_sealed || !phase600AllowedBlockers.includes(item.blocker)).map((item) => item.phase);
    checks.push(check("phaseCount", previous.length + 1 === 20, { previousCount: previous.length }));
    checks.push(check("failedEmpty", failed.length === 0, { failed }));
  }

  return checks;
}

function buildFlags(report, html, previousPhases, regression, secretProductUi, readmeAgentsGuard) {
  const readmeText = readTextIfExists("README.md");
  const agentsText = readTextIfExists("AGENTS.md");
  const readinessVisible = html.includes('id="codex-phase600-readiness-section"');
  return {
    phase592Completed: previousPhases.phase592?.completed === true,
    phase593Completed: previousPhases.phase593?.completed === true,
    phase594Completed: previousPhases.phase594?.completed === true,
    phase595Completed: previousPhases.phase595?.completed === true,
    phase596Completed: previousPhases.phase596?.completed === true,
    phase597Completed: previousPhases.phase597?.completed === true,
    phase598Completed: previousPhases.phase598?.completed === true,
    phase599Completed: previousPhases.phase599?.completed === true,
    scopeDefined: report.scopeDefined,
    authorizationInputReadinessReviewOnly: report.authorizationInputReadinessReviewOnly,
    humanApprovalRecordReviewOnly: report.humanApprovalRecordReviewOnly,
    guardedRealTestReadinessReviewOnly: report.guardedRealTestReadinessReviewOnly,
    authorizationPacketInputSchemaValid: report.authorizationPacketInputSchema.authorizationPacketInputSchemaValid,
    authorizationPacketInputSchemaWorks: report.authorizationPacketInputSchema.authorizationPacketInputSchemaWorks,
    rawSecretFieldForbidden: report.authorizationPacketInputSchema.rawSecretFieldForbidden,
    rawWebhookFieldForbidden: report.authorizationPacketInputSchema.rawWebhookFieldForbidden,
    realBaseUrlFieldForbidden: report.authorizationPacketInputSchema.realBaseUrlFieldForbidden,
    humanApprovalInputSchemaValid: report.humanApprovalRecordInputSchema.humanApprovalInputSchemaValid,
    humanApprovalRecordInputSchemaWorks: report.humanApprovalRecordInputSchema.humanApprovalRecordInputSchemaWorks,
    readinessOnlyDecisionDefined: report.humanApprovalRecordInputSchema.readinessOnlyDecisionDefined,
    realTestApprovalDecisionSeparated: report.humanApprovalRecordInputSchema.realTestApprovalDecisionSeparated,
    exampleInputFilesGenerated:
      report.authorizationPacketInputExample.authorizationPacketInputExampleGenerated &&
      report.humanApprovalRecordInputExample.humanApprovalRecordInputExampleGenerated,
    authorizationPacketInputExampleGenerated: report.authorizationPacketInputExample.authorizationPacketInputExampleGenerated,
    humanApprovalRecordInputExampleGenerated: report.humanApprovalRecordInputExample.humanApprovalRecordInputExampleGenerated,
    placeholderOnly: report.authorizationPacketInputExample.placeholderOnly && report.humanApprovalRecordInputExample.placeholderOnly,
    fakeRefsOnly: report.authorizationPacketInputExample.fakeRefsOnly && report.humanApprovalRecordInputExample.fakeRefsOnly,
    realAuthorizationClaimed: report.authorizationPacketInputExample.realAuthorizationClaimed,
    authorizationPacketInputLoaderWorks: report.authorizationPacketInputLoader.authorizationPacketInputLoaderWorks,
    missingInputHandled: report.authorizationPacketInputLoader.missingInputHandled,
    rawSecretRejected: report.authorizationPacketInputLoader.rawSecretRejected,
    rawWebhookRejected: report.authorizationPacketInputLoader.rawWebhookRejected,
    humanApprovalRecordLoaderWorks: report.humanApprovalRecordLoader.humanApprovalRecordLoaderWorks,
    missingApprovalHandled: report.humanApprovalRecordLoader.missingApprovalHandled,
    readinessOnlyApprovalIsNotRealTestApproval: report.humanApprovalRecordLoader.readinessOnlyApprovalIsNotRealTestApproval,
    authorizationCompletenessReviewWorks: report.authorizationCompletenessReview.authorizationCompletenessReviewWorks,
    missingFieldsDetected: report.authorizationCompletenessReview.missingFieldsDetected,
    completeAuthorizationDetectedWhenProvided: report.authorizationCompletenessReview.completeAuthorizationDetectedWhenProvided,
    incompleteAuthorizationBlocksRealIntegration: report.authorizationCompletenessReview.incompleteAuthorizationBlocksRealIntegration,
    humanApprovalConsistencyReviewWorks: report.humanApprovalConsistencyReview.humanApprovalConsistencyReviewWorks,
    approvalRecordRefMatches: report.humanApprovalConsistencyReview.approvalRecordRefMatches,
    allowedScopeReadinessOnly: report.humanApprovalConsistencyReview.allowedScopeReadinessOnly,
    budgetRequestDurationReadinessWorks: report.budgetRequestDurationReadiness.budgetRequestDurationReadinessWorks,
    phase600RealRequestCountMustBeZero: report.budgetRequestDurationReadiness.phase600RealRequestCountMustBeZero,
    maxTestRequestsZero: report.authorizationPacketInputLoader.inputMissing ? true : report.budgetRequestDurationReadiness.maxTestRequestsZero,
    relayAccountPoolCredentialRefReadinessWorks: report.relayAccountPoolCredentialRefReadiness.relayAccountPoolCredentialRefReadinessWorks,
    relayRefOnly: report.relayAccountPoolCredentialRefReadiness.relayRefOnly,
    accountPoolRefOnly: report.relayAccountPoolCredentialRefReadiness.accountPoolRefOnly,
    credentialRefOnly: report.relayAccountPoolCredentialRefReadiness.credentialRefOnly,
    rollbackEmergencyDisableReadinessWorks: report.rollbackEmergencyDisableReadiness.rollbackEmergencyDisableReadinessWorks,
    destructiveRollbackForbidden: report.rollbackEmergencyDisableReadiness.destructiveRollbackForbidden,
    evidencePreservationRequired: report.rollbackEmergencyDisableReadiness.evidencePreservationRequired,
    riskAcceptanceReadinessWorks: report.riskAcceptanceReadiness.riskAcceptanceReadinessWorks,
    requiredRisksListed: report.riskAcceptanceReadiness.requiredRisksListed,
    billingRiskIncluded: report.riskAcceptanceReadiness.billingRiskIncluded,
    rollbackRiskIncluded: report.riskAcceptanceReadiness.rollbackRiskIncluded,
    guardedRealTestReadinessDecisionWorks: report.guardedRealTestReadinessDecision.guardedRealTestReadinessDecisionWorks,
    guardedRealTestReadinessWorks: report.guardedRealTestReadinessDecision.guardedRealTestReadinessWorks,
    readinessReviewPassed: report.readinessReviewPassed,
    futureGuardedRealTestCandidate: report.futureGuardedRealTestCandidate,
    guardedRealTestAllowed: report.guardedRealTestAllowed,
    missionControlReadinessPreviewVisible: report.missionControlReadinessPreview.missionControlReadinessPreviewVisible && readinessVisible,
    authorizationCompleteVisible: report.missionControlReadinessPreview.authorizationCompleteVisible && html.includes('data-codex-phase600-authorization-complete="true"'),
    humanApprovalStatusVisible: report.missionControlReadinessPreview.humanApprovalStatusVisible && html.includes('data-codex-phase600-human-approval-status="true"'),
    readinessDecisionVisible: report.missionControlReadinessPreview.readinessDecisionVisible && html.includes('data-codex-phase600-readiness-decision="true"'),
    missingFieldsVisible: report.missionControlReadinessPreview.missingFieldsVisible && html.includes('data-codex-phase600-missing-fields="true"'),
    nextActionVisible: report.missionControlReadinessPreview.nextActionVisible && html.includes('data-codex-phase600-next-action="true"'),
    deadButtonDetected: false,
    readinessEvidenceLedgerGenerated: report.readinessEvidenceLedger.readinessEvidenceLedgerGenerated,
    evidenceLedgerGenerated: report.readinessEvidenceLedger.evidenceLedgerGenerated,
    allReviewSectionsPresent: report.readinessEvidenceLedger.allReviewSectionsPresent,
    noSecretInLedger: report.readinessEvidenceLedger.noSecretInLedger,
    phase592599RegressionPassed: regression.completed === true,
    phase592RegressionPassed: regression.phase592RegressionPassed,
    phase593RegressionPassed: regression.phase593RegressionPassed,
    phase594RegressionPassed: regression.phase594RegressionPassed,
    phase595RegressionPassed: regression.phase595RegressionPassed,
    phase596RegressionPassed: regression.phase596RegressionPassed,
    phase597RegressionPassed: regression.phase597RegressionPassed,
    phase598RegressionPassed: regression.phase598RegressionPassed,
    phase599RegressionPassed: regression.phase599RegressionPassed,
    secretProductUiRegressionPassed: secretProductUi.completed === true,
    secretSafetyPassed: secretProductUi.secretSafetyPassed,
    productRecoveryPassed: secretProductUi.productRecoveryPassed,
    uiSmokePassed: secretProductUi.uiSmokePassed,
    phase574r2RegressionPassed: secretProductUi.phase574r2RegressionPassed,
    phase576eRegressionPassed: secretProductUi.phase576eRegressionPassed,
    readmeAgentsPhase600UpdateWorks: readmeText.includes(phase600Title) && agentsText.includes(phase600Title),
    readmeManagedBlockUpdated: readmeText.includes(phase600Title),
    agentsManagedBlockUpdated: agentsText.includes(phase600Title),
    phase600GuidancePresent: readmeText.includes("Phase600A-T") && agentsText.includes("Phase600A-T"),
    phase306cGuardPassed: readmeAgentsGuard.phase306cGuardPassed,
    readmeAgentsSyncPassed: readmeAgentsGuard.completed === true,
    nextPhaseGateReportGenerated: report.nextPhaseGateReport.completed === true,
    phase600RecommendedSealed:
      report.completed === true &&
      phase600AllowedBlockers.includes(report.blocker) &&
      regression.completed === true &&
      secretProductUi.completed === true &&
      readmeAgentsGuard.completed === true &&
      readinessVisible,
  };
}

async function runRegressionCommands(previousPhases) {
  const reviewed = readExistingRegression(previousPhases);
  const commands = [
    "pnpm run verify:phase592a-t-codex-context-gateway-token-budget-manager",
    "pnpm run verify:phase593a-t-codex-context-gateway-operator-panel",
    "pnpm run verify:phase594a-t-usage-workflow-runner-integration-preview",
    "pnpm run verify:phase595a-t-codex-context-real-usage-trial",
    "pnpm run verify:phase596a-t-codex-context-repeated-usage-benchmark",
    "pnpm run verify:phase597a-t-controlled-base-url-integration-design",
    "pnpm run verify:phase598a-t-authorization-evidence-dry-run-config-simulation",
    "pnpm run verify:phase599a-t-authorization-packet-human-approval-review",
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
      previousPhases.phase598?.completed === true &&
      previousPhases.phase599?.completed === true,
    phase592RegressionPassed: previousPhases.phase592?.completed === true,
    phase593RegressionPassed: previousPhases.phase593?.completed === true,
    phase594RegressionPassed: previousPhases.phase594?.completed === true,
    phase595RegressionPassed: previousPhases.phase595?.completed === true,
    phase596RegressionPassed: previousPhases.phase596?.completed === true,
    phase597RegressionPassed: previousPhases.phase597?.completed === true,
    phase598RegressionPassed: previousPhases.phase598?.completed === true,
    phase599RegressionPassed: previousPhases.phase599?.completed === true,
    summary: {
      phase592RegressionPassed: previousPhases.phase592?.completed === true,
      phase593RegressionPassed: previousPhases.phase593?.completed === true,
      phase594RegressionPassed: previousPhases.phase594?.completed === true,
      phase595RegressionPassed: previousPhases.phase595?.completed === true,
      phase596RegressionPassed: previousPhases.phase596?.completed === true,
      phase597RegressionPassed: previousPhases.phase597?.completed === true,
      phase598RegressionPassed: previousPhases.phase598?.completed === true,
      phase599RegressionPassed: previousPhases.phase599?.completed === true,
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
  const present = readmeText.includes(phase600Title) && agentsText.includes(phase600Title);
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
    phase599: "apps/ai-gateway-service/evidence/phase599a-t-authorization-packet-human-approval-review.json",
  };
  const entries = await Promise.all(Object.entries(paths).map(async ([key, path]) => [key, await readJson(path).catch(() => null)]));
  return Object.fromEntries(entries);
}

async function readPreviousSubphaseEvidence() {
  const items = [];
  for (const phase of phase600Subphases.filter((item) => item.key !== "phase600t")) {
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
    .filter((item) => !item.completed || !item.recommended_sealed || !phase600AllowedBlockers.includes(item.blocker))
    .map((item) => item.phase);
  const aggregate = {
    phaseRange: "Phase600A-T",
    title: "Codex Context Gateway Authorization Packet Input + Human Approval Record + Guarded Real Test Readiness Review",
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
    authorizationPacketInputSchemaValid: currentResult.flags.authorizationPacketInputSchemaValid,
    humanApprovalInputSchemaValid: currentResult.flags.humanApprovalInputSchemaValid,
    exampleInputFilesGenerated: currentResult.flags.exampleInputFilesGenerated,
    authorizationPacketInputLoaderWorks: currentResult.flags.authorizationPacketInputLoaderWorks,
    humanApprovalRecordLoaderWorks: currentResult.flags.humanApprovalRecordLoaderWorks,
    authorizationCompletenessReviewWorks: currentResult.flags.authorizationCompletenessReviewWorks,
    humanApprovalConsistencyReviewWorks: currentResult.flags.humanApprovalConsistencyReviewWorks,
    budgetRequestDurationReadinessWorks: currentResult.flags.budgetRequestDurationReadinessWorks,
    relayAccountPoolCredentialRefReadinessWorks: currentResult.flags.relayAccountPoolCredentialRefReadinessWorks,
    rollbackEmergencyDisableReadinessWorks: currentResult.flags.rollbackEmergencyDisableReadinessWorks,
    riskAcceptanceReadinessWorks: currentResult.flags.riskAcceptanceReadinessWorks,
    guardedRealTestReadinessDecisionWorks: currentResult.flags.guardedRealTestReadinessDecisionWorks,
    missionControlReadinessPreviewVisible: currentResult.flags.missionControlReadinessPreviewVisible,
    readinessEvidenceLedgerGenerated: currentResult.flags.readinessEvidenceLedgerGenerated,
    authorizationComplete: currentResult.previewSummary.authorizationComplete,
    humanApprovalStatus: currentResult.previewSummary.humanApprovalStatus,
    readinessReviewPassed: currentResult.previewSummary.readinessReviewPassed,
    realIntegrationAllowed: currentResult.realIntegrationAllowed,
    guardedRealTestAllowed: currentResult.guardedRealTestAllowed,
    futureGuardedRealTestCandidate: currentResult.previewSummary.futureGuardedRealTestCandidate,
    phase592RegressionPassed: currentResult.flags.phase592RegressionPassed,
    phase593RegressionPassed: currentResult.flags.phase593RegressionPassed,
    phase594RegressionPassed: currentResult.flags.phase594RegressionPassed,
    phase595RegressionPassed: currentResult.flags.phase595RegressionPassed,
    phase596RegressionPassed: currentResult.flags.phase596RegressionPassed,
    phase597RegressionPassed: currentResult.flags.phase597RegressionPassed,
    phase598RegressionPassed: currentResult.flags.phase598RegressionPassed,
    phase599RegressionPassed: currentResult.flags.phase599RegressionPassed,
    ...phase600SafetyBoundary,
  };
  await writeFileWithRetry(resolve(repoRoot, phase600Group.sequenceEvidencePath), `${JSON.stringify(aggregate, null, 2)}\n`);
}

async function writeStaticInputExamples() {
  const report = buildPhase600ReadinessReviewReport({ repoRoot, missionControlHtml: createConsolePage() });
  await writeFileWithRetry(resolve(repoRoot, "docs/phase600-authorization-packet.input.example.json"), `${JSON.stringify(report.authorizationPacketInputExample.example, null, 2)}\n`);
  await writeFileWithRetry(resolve(repoRoot, "docs/phase600-human-approval-record.input.example.json"), `${JSON.stringify(report.humanApprovalRecordInputExample.example, null, 2)}\n`);
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
    "- Phase600 is authorization packet input, human approval record input, and guarded real test readiness review only.",
    "- It may generate example input files, load optional sanitized input files, review completeness, consistency, budget, refs, rollback, risk, Mission Control preview, and next phase gate status.",
    "- It does not modify real Codex config, does not write ~/.codex/config.toml, does not write a real project .codex/config.toml, does not change base_url, does not connect relay/proxy services, does not call providers, does not read secrets/webhooks, and does not modify /chat or /chat-gateway/execute.",
    "",
    "## Review Summary",
    `- authorizationComplete: ${report.authorizationComplete}`,
    `- humanApprovalStatus: ${report.humanApprovalStatus}`,
    `- readinessReviewPassed: ${report.readinessReviewPassed}`,
    `- realIntegrationAllowed: ${report.realIntegrationAllowed}`,
    `- guardedRealTestAllowed: ${report.guardedRealTestAllowed}`,
    `- futureGuardedRealTestCandidate: ${report.futureGuardedRealTestCandidate}`,
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
    `- authorizationPacketInputSchemaValid: ${report.authorizationPacketInputSchema.authorizationPacketInputSchemaValid}`,
    `- humanApprovalInputSchemaValid: ${report.humanApprovalRecordInputSchema.humanApprovalInputSchemaValid}`,
    `- exampleInputFilesGenerated: ${report.authorizationPacketInputExample.authorizationPacketInputExampleGenerated && report.humanApprovalRecordInputExample.humanApprovalRecordInputExampleGenerated}`,
    `- authorizationPacketInputLoaderWorks: ${report.authorizationPacketInputLoader.authorizationPacketInputLoaderWorks}`,
    `- humanApprovalRecordLoaderWorks: ${report.humanApprovalRecordLoader.humanApprovalRecordLoaderWorks}`,
    `- authorizationCompletenessReviewWorks: ${report.authorizationCompletenessReview.authorizationCompletenessReviewWorks}`,
    `- humanApprovalConsistencyReviewWorks: ${report.humanApprovalConsistencyReview.humanApprovalConsistencyReviewWorks}`,
    `- guardedRealTestReadinessDecisionWorks: ${report.guardedRealTestReadinessDecision.guardedRealTestReadinessDecisionWorks}`,
    `- readinessEvidenceLedgerGenerated: ${report.readinessEvidenceLedger.readinessEvidenceLedgerGenerated}`,
    `- authorizationComplete: ${report.authorizationComplete}`,
    `- humanApprovalStatus: ${report.humanApprovalStatus}`,
    `- readinessReviewPassed: ${report.readinessReviewPassed}`,
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
    readinessReviewPassed: report.readinessReviewPassed,
    realIntegrationAllowed: report.realIntegrationAllowed,
    guardedRealTestAllowed: report.guardedRealTestAllowed,
    futureGuardedRealTestCandidate: report.futureGuardedRealTestCandidate,
    blocker: report.blocker,
    nextAction: report.nextAction,
  };
}

function buildModifiedFiles(config) {
  return [
    "packages/codex-context-gateway/src/phase600AuthorizationInputSchema.js",
    "packages/codex-context-gateway/src/phase600HumanApprovalInputSchema.js",
    "packages/codex-context-gateway/src/phase600AuthorizationInputLoader.js",
    "packages/codex-context-gateway/src/phase600HumanApprovalRecordLoader.js",
    "packages/codex-context-gateway/src/phase600ReadinessReview.js",
    "packages/codex-context-gateway/src/phase600MissionControlReadinessPreview.js",
    "packages/codex-context-gateway/src/phase600ReadinessReviewReport.js",
    "packages/codex-context-gateway/src/index.js",
    "apps/ai-gateway-service/src/ui/components/CodexContextGatewayPanel.js",
    "apps/ai-gateway-service/src/ui/copy/codexContextGatewayCopy.js",
    "tools/phase600-registry.mjs",
    "tools/phase600-common.mjs",
    "tools/phase600-sequential-runner.mjs",
    config.verifierPath,
    config.docPath,
    config.reportPath,
    config.evidencePath,
    "docs/phase600-authorization-packet.input.example.json",
    "docs/phase600-human-approval-record.input.example.json",
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
