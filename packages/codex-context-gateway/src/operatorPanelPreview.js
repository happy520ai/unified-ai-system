import { readContextPackPreview } from "./contextPackPreviewReader.js";
import { readDirtySummaryPreview } from "./dirtySummaryPreview.js";
import { readEvidenceIndexPreview } from "./evidenceIndexPreview.js";
import { readFreshnessPreview } from "./freshnessPreview.js";
import { readPromptPackPreview } from "./promptPackPreview.js";
import { readRelevantFilesPreview } from "./relevantFilesPreview.js";
import { readTokenBudgetPreview } from "./tokenBudgetPreview.js";
import { buildOperatorPanelErrorState } from "./operatorPanelErrorState.js";

export function readOperatorPanelPreview(options = {}) {
  const contextPack = readContextPackPreview(options);
  const tokenBudget = readTokenBudgetPreview(options);
  const freshness = readFreshnessPreview({ ...options, generatedAt: contextPack.generatedAt });
  const relevantFiles = readRelevantFilesPreview(options);
  const evidenceIndex = readEvidenceIndexPreview(options);
  const promptPack = readPromptPackPreview(options);
  const dirtySummary = readDirtySummaryPreview(options);
  const errorState = buildOperatorPanelErrorState(options);
  const safetyBoundary = buildSafetyBoundary(contextPack);
  return {
    completed:
      contextPack.completed &&
      tokenBudget.completed &&
      freshness.completed &&
      relevantFiles.completed &&
      evidenceIndex.completed &&
      promptPack.completed &&
      dirtySummary.completed,
    operatorPanelArchitectureDefined: true,
    codexContextGatewayReadOnly: true,
    operatorPreviewPanel: true,
    notRealCodexIntegration: true,
    contextPack,
    tokenBudget,
    freshness,
    relevantFiles,
    evidenceIndex,
    promptPack,
    dirtySummary,
    errorState,
    safetyBoundary,
    contextHash: contextPack.contextHash,
    stale: freshness.staleStatus,
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
}

function buildSafetyBoundary(contextPack) {
  const source = contextPack.safetyBoundary || {};
  return {
    noProviderCallBadgeVisible: source.providerCallsMade === false,
    noSecretReadBadgeVisible: source.rawSecretAccessed === false,
    noWebhookReadBadgeVisible: source.rawWebhookAccessed === false,
    noCodexBaseUrlChangeBadgeVisible: source.codexBaseUrlModified === false,
    noChatChangeBadgeVisible: source.chatModified === false && source.chatGatewayExecuteModified === false,
    noDeployBadgeVisible: source.deployExecuted === false && source.releaseExecuted === false,
    noExternalImSendBadgeVisible: true,
    badges: [
      "no provider call",
      "no secret read",
      "no webhook read",
      "no Codex base_url change",
      "no /chat change",
      "no /chat-gateway/execute change",
      "no deploy / release",
      "no external IM send",
    ],
  };
}
