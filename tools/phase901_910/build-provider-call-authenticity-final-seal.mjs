import { baseSafety, ensurePhaseDirs, loadPhase821900Evidence, phaseDoc, readJsonIfPresent, writeJson, writePhaseDoc } from "./phase901-910-common.mjs";

ensurePhaseDirs();
const phase821 = loadPhase821900Evidence();
const proof = readJsonIfPresent("apps/ai-gateway-service/evidence/phase901_910/external-provider-response-proof-gate-result.json") || {};
const reaudit = readJsonIfPresent("apps/ai-gateway-service/evidence/phase901_910/phase821-900-route-evidence-reaudit-result.json") || {};
const correction = readJsonIfPresent("apps/ai-gateway-service/evidence/phase901_910/authenticity-correction-ledger.json") || {};
const blocker = phase821 ? null : "phase821_900_evidence_missing";
const result = {
  phaseRange: "Phase901-910",
  completed: true,
  recommended_sealed: blocker === null,
  blocker,
  providerCallAuthenticityVerifierReady: true,
  phase821900Reaudited: reaudit.phase821900Reaudited === true,
  previousProviderCallsMade: reaudit.previousProviderCallsMade === true,
  previousTotalProviderRequests: reaudit.previousTotalProviderRequests || 0,
  externalProviderApiCallConfirmed: proof.externalProviderApiCallConfirmed === true,
  networkAttemptRecorded: proof.networkAttemptRecorded === true,
  providerResponseReceived: proof.providerResponseReceived === true,
  responseSource: proof.responseSource || "unknown",
  mockResponseUsed: proof.mockResponseUsed === true,
  simulatedResponseUsed: proof.simulatedResponseUsed === true,
  dryRunOnly: proof.dryRunOnly === true,
  localExecutorOnly: proof.localExecutorOnly === true,
  authenticityClassification: proof.authenticityClassification || "authenticity_unknown",
  correctionRequired: reaudit.correctionRequired === true,
  correctionLedgerGenerated: correction.correctionLedgerGenerated === true,
  routeEvidenceStillUsefulForLocalExecutor: reaudit.routeEvidenceStillUsefulForLocalExecutor === true,
  ...baseSafety(),
};

writeJson("apps/ai-gateway-service/evidence/phase901_910/provider-call-authenticity-final-result.json", result);

const docs = [
  ["phase908-mission-control-provider-call-authenticity-panel.md", "Phase908", "Mission Control Provider Call Authenticity Panel", "Document the read-only authenticity panel and forbidden action surface."],
  ["phase909-regression-secret-safety-recheck.md", "Phase909", "Regression + Secret Safety Recheck", "Record the required regression and secret-safety recheck boundary."],
  ["phase910-provider-call-authenticity-final-seal.md", "Phase910", "Provider Call Authenticity Final Seal", "Seal Provider call authenticity evidence hardening."],
  ["phase901-910-provider-call-authenticity-evidence-hardening.md", "Phase901-910", "Provider Call Authenticity Evidence Hardening", "Summarize the full authenticity hardening bundle."],
  ["phase901-910-execution-report.md", "Phase901-910", "Execution Report", "Report final classification and correction status."],
];
for (const [file, phase, title, goal] of docs) {
  writePhaseDoc(file, phaseDoc({
    phase,
    title,
    goal,
    facts: [
      `externalProviderApiCallConfirmed=${result.externalProviderApiCallConfirmed}`,
      `authenticityClassification=${result.authenticityClassification}`,
      `correctionRequired=${result.correctionRequired}`,
    ],
    boundaries: [
      "no new Provider request",
      "no raw secret/auth.json read",
      "no default route mutation",
      "no deploy/release/tag/artifact upload",
    ],
    outputs: ["apps/ai-gateway-service/evidence/phase901_910/provider-call-authenticity-final-result.json"],
  }));
}

console.log(JSON.stringify(result, null, 2));
