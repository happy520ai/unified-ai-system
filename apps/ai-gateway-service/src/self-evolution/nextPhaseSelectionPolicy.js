import { evaluateSelfEvolutionValueGate } from "./selfEvolutionValueGate.js";

export const nextPhaseSelectionPolicy = Object.freeze({
  lowValuePhaseExpansionRejectedByDefault: true,
  controlledFiftySevenMutationRejected: true,
  productWorkModePreferred: true,
  humanApprovalRequiredForHighRisk: true,
});

export function selectNextPhaseCandidate(proposal = {}, blockers = {}) {
  const gate = evaluateSelfEvolutionValueGate(proposal, blockers);
  if (gate.rejected) {
    return {
      accepted: false,
      rejected: true,
      decision: blockers.ownerDailyUse === true ? "rejected_product_work_mode_required" : "rejected",
      reasons: gate.reasons,
      productWorkModePreferred: true,
    };
  }

  return {
    accepted: true,
    rejected: false,
    decision: "accepted_for_product_work_review",
    reasons: [],
    productWorkModePreferred: true,
  };
}
