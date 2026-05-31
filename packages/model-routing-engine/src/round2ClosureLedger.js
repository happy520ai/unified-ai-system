import { safetyFields } from "./localSelfUseV1ClosureCommon.js";

export function buildRound2ClosureLedger({ clearance = {} } = {}) {
  const closed = clearance.blockerCanBeClearedBySupplement === true;
  return {
    originalPhase: "Phase941-960",
    originalBlocker: "round2_real_route_quality_test_failed",
    originalGodResult: "marker_missing_or_failed",
    supplementPhase: "Phase966-970",
    supplementResult: closed ? "pass" : "blocked",
    originalEvidenceMutated: false,
    closureMethod: "supplemental_rebind",
    round2CanBeClosedWithSupplement: closed,
    ...safetyFields(),
  };
}
