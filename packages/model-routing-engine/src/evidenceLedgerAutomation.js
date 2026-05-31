import { safetyFields } from "./localSelfUseV1ClosureCommon.js";

export function buildEvidenceLedgerAutomation() {
  return {
    phase: "Phase987",
    completed: true,
    recommended_sealed: true,
    blocker: null,
    evidenceLedgerReady: true,
    schema: ["date", "phase", "routeMode", "providerUsed", "evidenceRef", "issueRef", "costEstimate", "result"],
    entries: [
      {
        date: null,
        phase: "Phase971-1000",
        routeMode: "local-self-use-v1",
        providerUsed: false,
        evidenceRef: "apps/ai-gateway-service/evidence/phase971_1000/local-self-use-routing-system-v1-final-result.json",
        issueRef: null,
        costEstimate: 0,
        result: "template-ready",
      },
    ],
    ...safetyFields(),
  };
}
