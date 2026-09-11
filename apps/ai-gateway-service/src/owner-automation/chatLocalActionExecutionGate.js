import { dryRunDesktopAction } from "./desktopActionRuntime.js";

/**
 * @param {{
 *   proposal?: { actionId?: string, input?: Record<string, unknown>, dryRunPreview?: Record<string, unknown> },
 *   env?: Record<string, string | undefined>,
 *   approval?: Record<string, unknown> | null
 * }} input
 */
export async function evaluateChatLocalActionExecutionGate({ proposal, env = process.env, approval = null }) {
  if (env.OWNER_AUTOMATION_CHAT_REAL_RUN_ENABLED !== "true") {
    return { allowed: false, blocker: "chat_real_run_feature_flag_disabled", providerCallsMade: false };
  }
  if (proposal?.actionId === "batch_create_desktop_spreadsheets" && env.OWNER_AUTOMATION_CHAT_BATCH_ENABLED !== "true") {
    return { allowed: false, blocker: "chat_batch_feature_flag_disabled", providerCallsMade: false };
  }
  if (!approval || typeof approval !== "object") {
    return { allowed: false, blocker: "owner_chat_real_run_approval_missing", providerCallsMade: false };
  }
  if (proposal?.actionId !== approval.approvedActionId) {
    return { allowed: false, blocker: "chat_action_not_approved", providerCallsMade: false };
  }
  if (approval.allowChatMainChainLocalActionExecution !== true) {
    return { allowed: false, blocker: "chat_main_chain_local_action_not_approved", providerCallsMade: false };
  }
  if (approval.allowOverwrite !== false || approval.allowDesktopScan !== false || approval.allowReadOtherDesktopFiles !== false) {
    return { allowed: false, blocker: "chat_local_action_safety_flags_invalid", providerCallsMade: false };
  }
  const dryRunPreview = proposal.dryRunPreview ?? dryRunDesktopAction({ actionId: proposal.actionId, input: proposal.input });
  if (dryRunPreview?.dryRun !== true) {
    return { allowed: false, blocker: "dry_run_preview_required", providerCallsMade: false };
  }
  // A JSON object supplied by the chat caller is not an approval authority.
  // Until desktop actions are registered behind Agent Governance Tool Proxy
  // with a sealed, one-time server approval, /chat stays proposal-only even
  // when legacy real-run flags are set.
  return {
    allowed: false,
    blocker: "chat_real_run_requires_governed_tool_proxy",
    dryRunPreview,
    providerCallsMade: false,
  };
}
