import { readContextPackPreview } from "./contextPackPreviewReader.js";
import { buildCodexInstructionSnippet } from "./codexInstructionSnippetBuilder.js";
import { runContextPreflight } from "./contextPreflight.js";
import { buildDryRunCodexTaskWrapper } from "./dryRunCodexTaskWrapper.js";
import { runFreshnessGate } from "./freshnessGate.js";
import { buildOperatorWorkflowChecklist } from "./operatorWorkflowChecklist.js";
import { loadPromptPack } from "./promptPackLoader.js";
import { buildRelevantFileReadAuditPreview } from "./relevantFileReadAuditPreview.js";
import { buildRelevantFileScopeGate } from "./relevantFileScopeGate.js";
import { buildRunnerHeartbeatPreview } from "./runnerHeartbeatPreview.js";
import { buildRunnerIntegrationPreview } from "./runnerIntegrationPreview.js";
import { buildRunnerResumePreview } from "./runnerResumePreview.js";
import { stopWhenContextStale } from "./staleContextStopper.js";
import { buildUsageEvidence } from "./usageEvidenceBuilder.js";
import { buildUsageFailurePreview } from "./usageFailurePreview.js";
import { enforceUsageTokenBudget } from "./usageTokenBudgetEnforcer.js";
import { planValidationCommands } from "./validationCommandPlanner.js";

export function buildUsageWorkflowPreview(options = {}) {
  const contextPack = readContextPackPreview(options);
  const preflight = runContextPreflight(options);
  const freshnessGate = runFreshnessGate(options);
  const staleStopper = stopWhenContextStale({ ...options, freshness: freshnessGate });
  const relevantFileScope = buildRelevantFileScopeGate(options);
  const promptPack = loadPromptPack(options);
  const validationPlan = planValidationCommands({ ...options, promptPack });
  const runnerIntegration = buildRunnerIntegrationPreview(options);
  const instructionSnippet = buildCodexInstructionSnippet(options);
  const dryRunTask = buildDryRunCodexTaskWrapper({ ...options, preflight, freshnessGate, relevantFileScope, promptPack, validationPlan });
  const failureMode = buildUsageFailurePreview(options);
  const tokenBudgetEnforcement = enforceUsageTokenBudget(options);
  const readAudit = buildRelevantFileReadAuditPreview({ ...options, scope: relevantFileScope });
  const operatorChecklist = buildOperatorWorkflowChecklist(options);
  const runnerHeartbeat = buildRunnerHeartbeatPreview(options);
  const runnerResume = buildRunnerResumePreview(options);
  const completed =
    preflight.completed &&
    freshnessGate.staleFalseAllows &&
    staleStopper.simulatedStaleBlocked &&
    relevantFileScope.scopeGateWorks &&
    promptPack.promptPackReadable &&
    validationPlan.validationCommandPlannerWorks &&
    dryRunTask.dryRunTaskWrapperWorks &&
    tokenBudgetEnforcement.currentBudgetRespected &&
    operatorChecklist.operatorChecklistExists;
  const preview = {
    completed,
    usageWorkflowArchitectureDefined: true,
    usesContextPack: true,
    usesRelevantFiles: true,
    usesPromptPack: true,
    usageWorkflowPreview: true,
    notRealCodexIntegration: true,
    contextHash: contextPack.contextHash,
    contextPack,
    preflight,
    freshnessGate,
    staleStopper,
    relevantFileScope,
    promptPack,
    validationPlan,
    runnerIntegration,
    instructionSnippet,
    dryRunTask,
    failureMode,
    tokenBudgetEnforcement,
    readAudit,
    operatorChecklist,
    runnerHeartbeat,
    runnerResume,
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
  };
  return {
    ...preview,
    evidencePreview: buildUsageEvidence({ preview }),
  };
}
