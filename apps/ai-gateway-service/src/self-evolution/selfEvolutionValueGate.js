import { getSelfEvolutionPolicy } from "./selfEvolutionPolicy.js";

const bannedControlledMutationName = ["controlled", "fifty-seven", "tool", "mutation"].join("-");

export function evaluateSelfEvolutionValueGate(proposal = {}, blockers = {}) {
  const reasons = [];
  const phaseName = String(proposal.proposedPhaseName || proposal.phaseName || "");
  const expectedUserValue = String(proposal.expectedUserValue || "").trim();
  const valueClass = String(proposal.valueClass || "").trim();
  const workType = String(proposal.workType || proposal.changeType || "").trim();

  if (phaseName.toLowerCase().includes(bannedControlledMutationName)) {
    reasons.push("controlled_57_file_mutation_blocked");
  }
  if (!valueClass) {
    reasons.push("value_class_missing");
  }
  if (!expectedUserValue) {
    reasons.push("expected_user_value_missing");
  }
  if (["marker", "managed_block", "file_count_expansion", "summary_only"].includes(workType)) {
    reasons.push("low_value_phase_expansion_blocked");
  }
  if (blockers.ownerDailyUse === true) {
    reasons.push("owner_daily_use_blocker_prioritizes_product_work_mode");
  }
  if (blockers.providerStability === true && proposal.providerCallRequested === true) {
    reasons.push("provider_stability_blocker_requires_approval_packet");
  }
  if (blockers.uiDeadButton === true) {
    reasons.push("ui_dead_button_blocker_prioritizes_scan_or_fix_proposal");
  }
  if (proposal.secretRisk === true || proposal.deployRisk === true || proposal.chatRouteRisk === true) {
    reasons.push("human_approval_required_for_high_risk");
  }

  return {
    accepted: reasons.length === 0,
    rejected: reasons.length > 0,
    reasons,
    policy: getSelfEvolutionPolicy(),
  };
}

export function validateRealExecution(entry = {}) {
  return {
    valid: entry.realExecutionEnabled === true,
    reason: entry.realExecutionEnabled ? "real_execution_enabled" : "real_execution_disabled",
    autonomousCodeMutationAllowed: entry.autonomousCodeMutationAllowed,
    autonomousProviderCallAllowed: entry.autonomousProviderCallAllowed,
  };
}
