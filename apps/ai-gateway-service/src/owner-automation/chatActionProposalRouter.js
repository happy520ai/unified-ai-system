import { parseLocalActionIntent } from "./chatActionIntentParser.js";
import { dryRunDesktopAction, realRunDesktopAction } from "./desktopActionRuntime.js";
import { evaluateChatLocalActionExecutionGate } from "./chatLocalActionExecutionGate.js";

export function routeChatActionProposal({ prompt, env = process.env } = {}) {
  const featureEnabled = env.OWNER_AUTOMATION_CHAT_PROPOSAL_ENABLED === "true";
  const intent = parseLocalActionIntent(prompt);
  if (!intent.matched) {
    return { action: "pass_through", featureFlagDefaultOff: true, intent, providerCallsMade: false };
  }
  if (!featureEnabled) {
    return {
      action: "pass_through",
      featureFlagDefaultOff: true,
      localActionIntentDetected: true,
      localActionProposal: null,
      realDesktopActionExecuted: false,
      desktopFileCreated: false,
      providerCallsMade: false,
    };
  }
  const dryRunPreview = dryRunDesktopAction({ actionId: intent.actionId, input: intent.input });
  return {
    action: "respond",
    featureFlagDefaultOff: true,
    localActionIntentDetected: true,
    localActionProposal: {
      actionId: intent.actionId,
      approvalRequired: true,
      realRunDefaultEnabled: false,
      input: intent.input,
      dryRunPreview,
      userVisibleSummary: "已识别本地桌面表格动作；默认只生成 action proposal，不执行真实桌面动作。",
    },
    realDesktopActionExecuted: false,
    desktopFileCreated: false,
    providerCallsMade: false,
  };
}

export async function handleChatLocalActionRoute({ prompt, env = process.env, approval = null, evidencePhase = "phase1911a" } = {}) {
  const proposalResult = routeChatActionProposal({ prompt, env });
  if (proposalResult.action !== "respond") {
    return proposalResult;
  }
  const proposal = proposalResult.localActionProposal;
  const gate = await evaluateChatLocalActionExecutionGate({ proposal, env, approval });
  if (!gate.allowed) {
    return {
      ...proposalResult,
      approvalGate: gate,
      chatTriggeredLocalAction: false,
      desktopFileCreated: false,
      desktopFileCreatedCount: 0,
      chatGatewayExecuteProviderChainCalled: false,
      providerCallsMade: false,
    };
  }
  const realRun = await realRunDesktopAction({
    actionId: proposal.actionId,
    input: proposal.input,
    approval: {
      ...approval,
      approvedOutputDirectory: approval.approvedOutputDirectory ?? "Desktop",
      approvedTestFilenamePrefix: approval.approvedTestFilenamePrefix ?? proposal.input.filenamePrefix,
    },
    evidencePhase,
  });
  return {
    ...proposalResult,
    approvalGate: gate,
    chatTriggeredLocalAction: true,
    desktopFileCreated: realRun.desktopFileCreated === true,
    desktopFileCreatedCount: realRun.desktopFileCreatedCount ?? 0,
    realRun,
    chatGatewayExecuteProviderChainCalled: false,
    providerCallsMade: false,
    secretValueExposed: false,
    overwriteDetected: false,
    desktopScanPerformed: false,
    desktopOtherFilesRead: false,
  };
}
