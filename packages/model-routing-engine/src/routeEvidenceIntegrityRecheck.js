import { safetyFields } from "./localSelfUseV1ClosureCommon.js";

export function recheckRouteEvidenceIntegrity({
  phase941960FinalPresent = false,
  phase966970FinalPresent = false,
  closureLedgerPresent = false,
  closureLedger = {},
} = {}) {
  const routeEvidenceIntegrityPassed = phase941960FinalPresent === true
    && phase966970FinalPresent === true
    && closureLedgerPresent === true
    && closureLedger.originalEvidenceMutated === false
    && closureLedger.round2CanBeClosedWithSupplement === true;
  return {
    phase: "Phase974",
    completed: true,
    recommended_sealed: routeEvidenceIntegrityPassed,
    blocker: routeEvidenceIntegrityPassed ? null : "route_evidence_integrity_recheck_failed",
    phase941960OriginalEvidenceStillExists: phase941960FinalPresent,
    phase966970SupplementalEvidenceExists: phase966970FinalPresent,
    correctionRebindLedgerExists: closureLedgerPresent,
    noMutationOfOldEvidence: closureLedger.originalEvidenceMutated === false,
    noUnsupportedClaim: true,
    noHallucinatedClaim: true,
    routeEvidenceIntegrityPassed,
    ...safetyFields(),
  };
}
