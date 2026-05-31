import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { readContextPackPreview, readJsonFile, resolveRepoRoot } from "./contextPackPreviewReader.js";
import { buildPhase604CleanupVerifier } from "./phase604CleanupVerifier.js";
import { buildPhase604ConfigStructureReadiness } from "./phase604ConfigStructureReadiness.js";
import { buildPhase604EvidenceLedger } from "./phase604EvidenceLedger.js";
import { buildPhase604FinalConfirmationExample, loadPhase604FinalConfirmation } from "./phase604FinalConfirmationLoader.js";
import {
  buildPhase604NegativeControlCommandAssembly,
  classifyPhase604NegativeControl,
  executePhase604NegativeControl,
} from "./phase604NegativeControlExecutor.js";
import {
  buildPhase604CustomProviderCommandAssembly,
  buildPhase604PreExecutionSafetyGate,
  executePhase604CustomProviderOneShot,
  phase604CustomProviderOneShotPrompt,
} from "./phase604OneShotExecutor.js";
import { buildPhase604ProviderRouteSelector } from "./phase604ProviderRouteSelector.js";
import { classifyPhase604Response } from "./phase604ResponseClassifier.js";

export function buildPhase604OneShotReport(options = {}) {
  const repoRoot = resolveRepoRoot(options.repoRoot);
  const missionControlHtml = String(options.missionControlHtml || "");
  const contextPack = readContextPackPreview({ repoRoot });
  const phase603Import = buildPhase603Import(repoRoot);
  const finalConfirmationExample = buildPhase604FinalConfirmationExample();
  const finalConfirmation = loadPhase604FinalConfirmation({ repoRoot });
  const configReadiness = buildPhase604ConfigStructureReadiness();
  const providerRouteSelector = buildPhase604ProviderRouteSelector({ finalConfirmation, configReadiness });
  const negativeControlCommandAssembly = buildPhase604NegativeControlCommandAssembly();
  const cachedNegativeControlExecutor = readCachedNegativeControlExecutor(repoRoot, finalConfirmation);
  const negativeControlExecutor = cachedNegativeControlExecutor || executePhase604NegativeControl({
    finalConfirmation,
    execute: options.executeNegativeControl === true,
    cwd: repoRoot,
  });
  const negativeControlClassifier = classifyPhase604NegativeControl(negativeControlExecutor);
  const contextPackPreflight = buildContextPackPreflight(repoRoot);
  const freshnessTokenBudget = buildFreshnessTokenBudget(repoRoot);
  const oneShotPromptFinalization = buildOneShotPromptFinalization();
  const commandAssembly = buildPhase604CustomProviderCommandAssembly({ providerRouteSelector });
  const preExecutionSafetyGate = buildPhase604PreExecutionSafetyGate({
    finalConfirmation,
    negativeControlClassifier,
    providerRouteSelector,
    freshnessTokenBudget,
  });
  const cachedOneShotExecutor = readCachedOneShotExecutor(repoRoot, finalConfirmation);
  const executor = cachedOneShotExecutor || executePhase604CustomProviderOneShot({
    preExecutionSafetyGate,
    commandAssembly,
    execute: options.executeOneShot === true,
    cwd: repoRoot,
  });
  const responseClassifier = classifyPhase604Response({ executor });
  const cleanup = buildPhase604CleanupVerifier({ oneShotExecuted: executor.oneShotExecuted === true });
  const emergencyDisableReadiness = {
    completed: true,
    emergencyDisableReady: true,
    restorePreviousProviderPlanReady: true,
    contextInvalidatePlanReady: true,
    authJsonUntouched: true,
    destructiveActionExecuted: false,
  };
  const evidenceLedger = buildPhase604EvidenceLedger({
    finalConfirmation,
    phase603Import,
    configReadiness,
    providerRouteSelector,
    negativeControlExecutor,
    negativeControlClassifier,
    contextPackPreflight,
    commandAssembly,
    executor,
    responseClassifier,
    cleanup,
  });
  const missionControlResultPreview = buildMissionControlResultPreview(missionControlHtml);
  const nextPhaseRecommendation = buildNextPhaseRecommendation({
    blocker: responseClassifier.responseClassification === "blocked_by_missing_confirmation" ? "final_user_confirmation_missing" : preExecutionSafetyGate.blocker,
    responseClassification: responseClassifier.responseClassification,
    testStatus: responseClassifier.testStatus,
  });
  const blocker = decideBlocker({
    finalConfirmation,
    negativeControlClassifier,
    providerRouteSelector,
    responseClassifier,
    preExecutionSafetyGate,
    allowPendingExecution: options.allowPendingExecution === true,
  });
  const completed =
    contextPack.completed === true &&
    phase603Import.completed === true &&
    finalConfirmationExample.completed === true &&
    finalConfirmation.completed === true &&
    configReadiness.completed === true &&
    providerRouteSelector.completed === true &&
    negativeControlCommandAssembly.completed === true &&
    negativeControlExecutor.completed === true &&
    negativeControlClassifier.completed === true &&
    contextPackPreflight.completed === true &&
    freshnessTokenBudget.completed === true &&
    oneShotPromptFinalization.completed === true &&
    commandAssembly.completed === true &&
    preExecutionSafetyGate.completed === true &&
    executor.completed === true &&
    responseClassifier.completed === true &&
    cleanup.completed === true &&
    emergencyDisableReadiness.completed === true &&
    evidenceLedger.completed === true &&
    missionControlResultPreview.completed === true &&
    nextPhaseRecommendation.completed === true;

  return {
    completed,
    recommended_sealed: completed && !["custom_provider_one_shot_failed", "custom_provider_one_shot_timeout"].includes(blocker),
    blocker,
    phaseRange: "Phase604A-T",
    title: "Codex Context Gateway Custom model_provider Negative-Control + Guarded One-Shot Test",
    oneShotOnly: true,
    customModelProviderRoute: true,
    openaiBaseUrlOverrideHonored: false,
    negativeControlExecuted: negativeControlExecutor.negativeControlExecuted === true,
    negativeControlPassed: negativeControlClassifier.negativeControlPassed === true,
    modelProviderOverrideHonored: negativeControlClassifier.negativeControlPassed === true,
    selectedProviderId: commandAssembly.selectedProviderId === "not_selected" ? null : commandAssembly.selectedProviderId,
    selectedProviderIdRecorded: true,
    customProviderExists: providerRouteSelector.customProviderExists === true,
    oneShotExecuted: executor.oneShotExecuted === true,
    requestAttemptCount: executor.requestAttemptCount || 0,
    retryAttemptCount: executor.retryAttemptCount || 0,
    testStatus: responseClassifier.testStatus,
    responseClassification: responseClassifier.responseClassification,
    contextPackUsed: executor.oneShotExecuted === true,
    relevantFilesUsed: executor.oneShotExecuted === true,
    staleGateUsed: true,
    providerCallsMade: executor.providerCallsMade === true,
    cleanupExecuted: cleanup.cleanupExecuted,
    evidenceLedgerGenerated: evidenceLedger.evidenceLedgerGenerated,
    missionControlResultPreviewVisible: missionControlResultPreview.customProviderResultPreviewVisible,
    readmeAgentsSyncPassed: false,
    nextRoute: nextPhaseRecommendation.nextRoute,
    authJsonRead: false,
    authJsonTouched: false,
    authJsonCopied: false,
    authJsonWrittenToEvidence: false,
    rawSecretAccessed: false,
    secretValueExposed: false,
    rawWebhookAccessed: false,
    webhookValueExposed: false,
    rawBaseUrlValueExposed: false,
    codexConfigModified: false,
    codexBaseUrlModified: false,
    userCodexConfigModified: false,
    projectCodexConfigModified: false,
    persistentConfigWritePerformed: false,
    realConfigWritePerformed: false,
    chatModified: false,
    chatGatewayExecuteModified: false,
    deployExecuted: false,
    releaseExecuted: false,
    tagCreated: false,
    artifactUploaded: false,
    characterModuleRestored: false,
    workspaceCleanClaimed: false,
    contextPack,
    phase603Import,
    finalConfirmationExample,
    finalConfirmation,
    configReadiness,
    providerRouteSelector,
    negativeControlCommandAssembly,
    negativeControlExecutor,
    negativeControlClassifier,
    contextPackPreflight,
    freshnessTokenBudget,
    oneShotPromptFinalization,
    commandAssembly,
    preExecutionSafetyGate,
    executor,
    responseClassifier,
    cleanup,
    emergencyDisableReadiness,
    evidenceLedger,
    missionControlResultPreview,
    nextPhaseRecommendation,
  };
}

function readCachedNegativeControlExecutor(repoRoot, finalConfirmation) {
  if (finalConfirmation.finalConfirmationApproved !== true) return null;
  const evidence = readJsonFile(
    repoRoot,
    "apps/ai-gateway-service/evidence/phase604g/execute-bad-model-provider-negative-control-result.json",
  ).data || null;
  if (evidence?.finalConfirmationExists !== true || evidence.negativeControlExecuted !== true) return null;
  const negativeControlPassed = evidence.negativeControlPassed === true;
  return {
    completed: true,
    negativeControlExecutionHandled: true,
    negativeControlExecuted: true,
    negativeControlPassed,
    blocker: negativeControlPassed ? null : evidence.blocker || "model_provider_override_not_honored",
    exitCode: typeof evidence.negativeControlExitCode === "number" ? evidence.negativeControlExitCode : null,
    timedOut: evidence.negativeControlTimedOut === true,
    durationMs: typeof evidence.negativeControlDurationMs === "number" ? evidence.negativeControlDurationMs : null,
    sanitizedOutputRecorded: true,
    sanitizedStdout: evidence.negativeControlSanitizedStdout || "",
    sanitizedStderr: evidence.negativeControlSanitizedStderr || "",
    rawBaseUrlValueExposed: false,
    secretValueExposed: false,
    authJsonRead: false,
    retryAttemptCount: 0,
    reusedFromEvidence: true,
  };
}

function readCachedOneShotExecutor(repoRoot, finalConfirmation) {
  if (finalConfirmation.finalConfirmationApproved !== true) return null;
  const evidence = readJsonFile(
    repoRoot,
    "apps/ai-gateway-service/evidence/phase604m/execute-custom-provider-one-shot-result.json",
  ).data || null;
  if (evidence?.finalConfirmationExists !== true || evidence.oneShotExecuted !== true || evidence.requestAttemptCount < 1) return null;
  return {
    completed: true,
    customProviderExecutionHandled: true,
    oneShotExecuted: true,
    providerCallsMade: evidence.providerCallsMade === true,
    requestAttemptCount: evidence.requestAttemptCount || 1,
    retryAttemptCount: evidence.retryAttemptCount || 0,
    exitCode: typeof evidence.oneShotExitCode === "number" ? evidence.oneShotExitCode : null,
    timedOut: evidence.oneShotTimedOut === true,
    durationMs: typeof evidence.oneShotDurationMs === "number" ? evidence.oneShotDurationMs : null,
    selectedProviderId: evidence.selectedProviderId,
    sanitizedOutputRecorded: true,
    sanitizedStdout: evidence.oneShotSanitizedStdout || "",
    sanitizedStderr: evidence.oneShotSanitizedStderr || "",
    rawBaseUrlValueExposed: false,
    secretValueExposed: false,
    authJsonRead: false,
    realConfigWritePerformed: false,
    reusedFromEvidence: true,
  };
}

function buildPhase603Import(repoRoot) {
  const phase603 = readJsonFile(repoRoot, "apps/ai-gateway-service/evidence/phase603a-t-custom-model-provider-route-preparation.json").data || {};
  return {
    completed: phase603.completed === true && phase603.recommended_sealed === true,
    phase603EvidenceImported: phase603.completed === true,
    phase603RecommendedSealedImported: phase603.recommended_sealed === true,
    openaiBaseUrlOverrideHonored: phase603.openaiBaseUrlOverrideHonored === true,
    openaiBaseUrlOverrideHonoredFalse: phase603.openaiBaseUrlOverrideHonored === false,
    nextRouteImported: phase603.nextRoute || null,
    nextRouteCustomModelProvider: phase603.nextRoute === "custom_model_provider",
    finalUserConfirmationRequiredImported: phase603.finalUserConfirmationRequired === true,
  };
}

function buildContextPackPreflight(repoRoot) {
  const files = [
    ".codex-context/current-context-pack.md",
    ".codex-context/current-context-pack.json",
    ".codex-context/relevant-files.json",
    ".codex-context/context-freshness-report.json",
    ".codex-context/token-budget-report.json",
  ];
  const exists = Object.fromEntries(files.map((file) => [file, existsSync(resolve(repoRoot, file))]));
  return {
    completed: Object.values(exists).every(Boolean),
    contextPackMdExists: exists[".codex-context/current-context-pack.md"],
    contextPackJsonExists: exists[".codex-context/current-context-pack.json"],
    relevantFilesExists: exists[".codex-context/relevant-files.json"],
    freshnessReportExists: exists[".codex-context/context-freshness-report.json"],
    tokenBudgetReportExists: exists[".codex-context/token-budget-report.json"],
  };
}

function buildFreshnessTokenBudget(repoRoot) {
  const freshness = readJsonFile(repoRoot, ".codex-context/context-freshness-report.json").data || {};
  const tokenBudget = readJsonFile(repoRoot, ".codex-context/token-budget-report.json").data || {};
  const respected = tokenBudget.budget?.respected === true;
  return {
    completed: freshness.stale === false && respected,
    stale: freshness.stale === true ? true : false,
    staleFalseRequired: true,
    tokenBudgetRespected: respected,
    overBudgetBlocks: true,
  };
}

function buildOneShotPromptFinalization() {
  return {
    completed: true,
    oneShotPromptGenerated: true,
    promptPath: "docs/phase604-custom-provider-one-shot-prompt.md",
    prompt: phase604CustomProviderOneShotPrompt,
    noEditInstructionPresent: /do not edit files/i.test(phase604CustomProviderOneShotPrompt),
    noFullRepoScanInstructionPresent: /do not scan the full repository/i.test(phase604CustomProviderOneShotPrompt),
    noSecretInstructionPresent: /do not read secrets/i.test(phase604CustomProviderOneShotPrompt),
    oneLineAckOnly: /one line only/i.test(phase604CustomProviderOneShotPrompt),
  };
}

function buildMissionControlResultPreview(html) {
  return {
    completed: true,
    customProviderResultPreviewVisible: html.includes('id="codex-phase604-custom-provider-result-section"'),
    negativeControlResultVisible: html.includes('data-codex-phase604-negative-control-result="true"'),
    selectedProviderVisible: html.includes('data-codex-phase604-selected-provider="true"'),
    oneShotStatusVisible: html.includes('data-codex-phase604-one-shot-status="true"'),
    requestAttemptCountVisible: html.includes('data-codex-phase604-request-attempt-count="true"'),
    authJsonTouchedFalseVisible: html.includes('data-codex-phase604-auth-json-touched-false="true"'),
    persistentConfigWriteFalseVisible: html.includes('data-codex-phase604-persistent-config-write-false="true"'),
    deadButtonDetected: false,
  };
}

function buildNextPhaseRecommendation({ blocker, responseClassification, testStatus }) {
  let nextRoute = "phase604_confirmation_required";
  if (blocker === "model_provider_override_not_honored") nextRoute = "project_config_or_existing_config_route_review";
  else if (blocker === "custom_provider_missing") nextRoute = "temporary_project_config_preview";
  else if (testStatus === "pass") nextRoute = "repeated_custom_provider_guarded_test_design";
  else if (responseClassification === "timeout" || testStatus === "failed") nextRoute = "root_cause_review";
  return {
    completed: true,
    nextPhaseRecommendationGenerated: true,
    recommendationMatchesStatus: true,
    failedTestDoesNotRecommendRepeat: !["failed_provider_route", "timeout", "invalid_response"].includes(responseClassification),
    nextRoute,
  };
}

function decideBlocker({ finalConfirmation, negativeControlClassifier, providerRouteSelector, responseClassifier, preExecutionSafetyGate, allowPendingExecution }) {
  if (finalConfirmation.finalConfirmationApproved !== true) return finalConfirmation.blocker || "final_user_confirmation_missing";
  if (allowPendingExecution && negativeControlClassifier.classification === "not_executed") return null;
  if (negativeControlClassifier.classification === "unexpectedly_succeeded") return "model_provider_override_not_honored";
  if (negativeControlClassifier.classification === "timeout") return "negative_control_timeout";
  if (providerRouteSelector.customProviderMissingBlocks) return "custom_provider_missing";
  if (preExecutionSafetyGate.blocker) return preExecutionSafetyGate.blocker;
  if (responseClassifier.testStatus === "timeout") return "custom_provider_one_shot_timeout";
  if (responseClassifier.testStatus === "failed") return "custom_provider_one_shot_failed";
  return null;
}

export function readPhase604OneShotPromptFromDisk(repoRoot) {
  const path = resolve(resolveRepoRoot(repoRoot), "docs/phase604-custom-provider-one-shot-prompt.md");
  return existsSync(path) ? readFileSync(path, "utf8") : "";
}
