import { safetyFields } from "./localSelfUseV1ClosureCommon.js";

export function intakeRound2SupplementalEvidence({
  phase941960Final = {},
  phase961965Audit = {},
  phase966970Final = {},
  phase966970Attempts = {},
} = {}) {
  const phase966970GodRerunPassed = phase966970Final.godModeSmallScopeRerunPassed === true;
  const phase941960OriginalEvidenceMutated = phase966970Final.phase941960OriginalEvidenceMutated === true;
  const blocker = phase966970GodRerunPassed ? null : "phase966_970_supplemental_pass_evidence_missing";
  return {
    phase: "Phase971",
    completed: true,
    recommended_sealed: blocker === null,
    blocker,
    phase941960OriginalBlocker: phase941960Final.blocker || "unknown",
    phase961965RootCause: phase961965Audit.rootCauseClass || phase961965Audit.rootCauseFromPhase961965 || "unknown",
    phase966970GodRerunPassed,
    phase966970ExternalProviderApiCallConfirmed: phase966970Final.externalProviderApiCallConfirmed === true,
    phase941960OriginalEvidenceMutated,
    phase941960OriginalEvidenceNotMutated: phase941960OriginalEvidenceMutated === false,
    phase966970AttemptCount: phase966970Attempts.totalProviderRequests || 0,
    phase966970Attempts: phase966970Attempts.attempts || [],
    ...safetyFields(),
  };
}
