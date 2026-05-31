import { safetyFields } from "./localSelfUseV1ClosureCommon.js";

export function buildIssueLedgerAutomation() {
  return {
    phase: "Phase988",
    completed: true,
    recommended_sealed: true,
    blocker: null,
    issueLedgerReady: true,
    severityPolicy: {
      P0: ["secret leak", "unexpected deploy", "default route mutation", "data loss"],
      P1: ["route broken", "rollback broken", "provider gate broken"],
      P2: ["UX friction", "scoring issue", "fallback weakness"],
      P3: ["copy", "docs", "polish"],
    },
    issues: [],
    ...safetyFields(),
  };
}
