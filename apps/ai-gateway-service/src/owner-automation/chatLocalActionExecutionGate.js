import { dryRunDesktopAction } from "./desktopActionRuntime.js";

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
  return { allowed: true, blocker: null, dryRunPreview, providerCallsMade: false };
}
