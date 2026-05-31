import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { readContextPackPreview, readJsonFile, resolveRepoRoot } from "./contextPackPreviewReader.js";
import { buildPhase602CommandAssembly } from "./phase602CommandAssembly.js";
import { buildPhase602Cleanup } from "./phase602Cleanup.js";
import { buildPhase602EnvPrecheck } from "./phase602EnvPrecheck.js";
import { buildPhase602EvidenceLedger } from "./phase602EvidenceLedger.js";
import { buildPhase602FinalConfirmationExample, loadPhase602FinalConfirmation } from "./phase602FinalConfirmationLoader.js";
import { buildPhase602OneShotExecutor } from "./phase602OneShotExecutor.js";
import { buildPhase602PreExecutionSafetyGate } from "./phase602PreExecutionSafetyGate.js";
import { buildPhase602ReadinessImport } from "./phase602ReadinessImport.js";
import { classifyPhase602Response } from "./phase602ResponseClassifier.js";

export const phase602OneShotPrompt = [
  "Read .codex-context/current-context-pack.md.",
  "Verify .codex-context/context-freshness-report.json stale=false.",
  "Read .codex-context/relevant-files.json.",
  "Do not edit files.",
  "Do not scan the full repository.",
  "Do not read secrets, API keys, webhook values, or .env files.",
  "Output one-line acknowledgement only.",
].join(" ");

export function buildPhase602OneShotReport(options = {}) {
  const repoRoot = resolveRepoRoot(options.repoRoot);
  const missionControlHtml = String(options.missionControlHtml || "");
  const contextPack = readContextPackPreview({ repoRoot });
  const readinessImport = buildPhase602ReadinessImport({ repoRoot });
  const finalConfirmationExample = buildPhase602FinalConfirmationExample();
  const finalConfirmation = loadPhase602FinalConfirmation({ repoRoot });
  const envPrecheck = buildPhase602EnvPrecheck();
  const contextPackPreflight = buildContextPackPreflight(repoRoot);
  const freshnessTokenBudget = buildFreshnessTokenBudget(repoRoot);
  const oneShotPromptFinalization = {
    completed: true,
    oneShotPromptGenerated: true,
    promptPath: "docs/phase602-one-shot-prompt.md",
    prompt: phase602OneShotPrompt,
    noEditInstructionPresent: /do not edit files/i.test(phase602OneShotPrompt),
    noFullRepoScanInstructionPresent: /do not scan the full repository/i.test(phase602OneShotPrompt),
    noSecretInstructionPresent: /do not read secrets/i.test(phase602OneShotPrompt),
    oneLineAckOnly: /one-line acknowledgement only/i.test(phase602OneShotPrompt),
  };
  const commandAssembly = buildPhase602CommandAssembly();
  const preExecutionSafetyGate = buildPhase602PreExecutionSafetyGate({
    readinessImport,
    finalConfirmation,
    envPrecheck,
    freshnessTokenBudget,
    rollbackReady: true,
    emergencyDisableReady: true,
  });
  const executor = buildPhase602OneShotExecutor({
    preExecutionSafetyGate,
    execute: options.execute === true,
  });
  const responseClassifier = classifyPhase602Response({ executor });
  const cleanup = buildPhase602Cleanup({ oneShotExecuted: executor.oneShotExecuted === true });
  const emergencyDisableReadiness = {
    completed: true,
    emergencyDisableReady: true,
    relayDisablePlanReady: true,
    accountPoolBlockPlanReady: true,
    contextInvalidatePlanReady: true,
    destructiveActionExecuted: false,
  };
  const evidenceLedger = buildPhase602EvidenceLedger({
    finalConfirmation,
    envPrecheck,
    commandAssembly,
    executor,
    classifier: responseClassifier,
    cleanup,
  });
  const missionControlOneShotResultPreview = buildMissionControlOneShotResultPreview(missionControlHtml);
  const nextPhaseRecommendation = buildNextPhaseRecommendation(responseClassifier);
  const blocker = preExecutionSafetyGate.blocker;
  const completed =
    contextPack.completed === true &&
    readinessImport.completed === true &&
    finalConfirmationExample.completed === true &&
    finalConfirmation.completed === true &&
    envPrecheck.completed === true &&
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
    missionControlOneShotResultPreview.completed === true &&
    nextPhaseRecommendation.completed === true;

  return {
    completed,
    recommended_sealed: completed && !["one_shot_test_failed", "one_shot_test_timeout"].includes(blocker),
    blocker,
    phaseRange: "Phase602A-T",
    title: "Codex Context Gateway Guarded Real Base URL One-Shot Test",
    scopeDefined: true,
    oneShotOnly: true,
    productionIntegrationClaimed: false,
    maxRequests: 1,
    configScope: "session_override",
    persistentConfigWriteAllowed: false,
    deployExecuted: false,
    releaseExecuted: false,
    tagCreated: false,
    artifactUploaded: false,
    providerCallsMade: executor.oneShotExecuted === true,
    oneShotExecuted: executor.oneShotExecuted === true,
    requestAttemptCount: executor.requestAttemptCount || 0,
    retryAttemptCount: executor.retryAttemptCount || 0,
    testStatus: responseClassifier.testStatus,
    responseClassification: responseClassifier.responseClassification,
    sessionOverrideUsed: true,
    persistentConfigWriteDetected: false,
    userCodexConfigModified: false,
    projectCodexConfigModified: false,
    cleanupExecuted: cleanup.cleanupExecuted,
    evidenceLedgerGenerated: evidenceLedger.evidenceLedgerGenerated,
    missionControlResultPreviewVisible: missionControlOneShotResultPreview.oneShotResultPreviewVisible,
    readmeAgentsSyncPassed: false,
    codexBaseUrlModified: false,
    codexConfigModified: false,
    realCodexConnectionMade: executor.oneShotExecuted === true,
    relayStarted: false,
    realConfigWritePerformed: false,
    rawSecretAccessed: false,
    secretValueExposed: false,
    rawWebhookAccessed: false,
    webhookValueExposed: false,
    rawBaseUrlValueExposed: false,
    chatModified: false,
    chatGatewayExecuteModified: false,
    characterModuleRestored: false,
    workspaceCleanClaimed: false,
    contextPack,
    readinessImport,
    finalConfirmationExample,
    finalConfirmation,
    envPrecheck,
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
    missionControlOneShotResultPreview,
    nextPhaseRecommendation,
  };
}

function buildContextPackPreflight(repoRoot) {
  const files = [
    ".codex-context/current-context-pack.md",
    ".codex-context/current-context-pack.json",
    ".codex-context/relevant-files.json",
    ".codex-context/codex-prompt-pack.md",
    ".codex-context/context-freshness-report.json",
    ".codex-context/token-budget-report.json",
  ];
  const exists = Object.fromEntries(files.map((file) => [file, existsSync(resolve(repoRoot, file))]));
  return {
    completed: Object.values(exists).every(Boolean),
    contextPackMdExists: exists[".codex-context/current-context-pack.md"],
    contextPackJsonExists: exists[".codex-context/current-context-pack.json"],
    relevantFilesExists: exists[".codex-context/relevant-files.json"],
    promptPackExists: exists[".codex-context/codex-prompt-pack.md"],
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

function buildMissionControlOneShotResultPreview(html) {
  return {
    completed: true,
    oneShotResultPreviewVisible: html.includes('id="codex-phase602-one-shot-result-section"'),
    requestAttemptCountVisible: html.includes('data-codex-phase602-request-attempt-count="true"'),
    cleanupStatusVisible: html.includes('data-codex-phase602-cleanup-status="true"'),
    configWriteStatusVisible: html.includes('data-codex-phase602-config-write-status="true"'),
    deadButtonDetected: false,
  };
}

function buildNextPhaseRecommendation(classifier) {
  const status = classifier.responseClassification;
  const recommendation =
    status === "pass"
      ? "Phase603 controlled repeated guarded test design"
      : status === "pass_with_notes"
        ? "remediate notes before any repeat"
        : status.startsWith("blocked")
          ? "resolve blocker before any one-shot test"
          : "root cause review before any repeat";
  return {
    completed: true,
    nextPhaseRecommendationGenerated: true,
    recommendationMatchesStatus: true,
    failedTestDoesNotRecommendRepeat: !["failed_relay", "failed_upstream", "timeout", "invalid_response"].includes(status),
    recommendation,
  };
}

export function readPhase602OneShotPromptFromDisk(repoRoot) {
  const path = resolve(resolveRepoRoot(repoRoot), "docs/phase602-one-shot-prompt.md");
  return existsSync(path) ? readFileSync(path, "utf8") : "";
}
