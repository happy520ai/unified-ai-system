import {
  buildExternalProviderAuthenticityEvidence,
  validatePhase911Approval,
} from "../../packages/model-routing-engine/src/index.js";
import { approvalPath, ensurePhase911Dirs, finalPath, oneShotPath, phaseDoc, readJsonIfPresent, writeJson, writeText } from "./phase911-common.mjs";

ensurePhase911Dirs();

const approval = readJsonIfPresent(approvalPath);
const oneShot = readJsonIfPresent(oneShotPath) || {};
const validation = approval ? validatePhase911Approval(approval) : { authorizationComplete: false };
const phase901910 = readJsonIfPresent("apps/ai-gateway-service/evidence/phase901_910/provider-call-authenticity-final-result.json") || {};
const finalEvidence = buildExternalProviderAuthenticityEvidence({
  approval,
  oneShot,
  authorizationComplete: validation.authorizationComplete,
  previousPhase821900Classification: phase901910.authenticityClassification || "simulated_response",
});

writeJson("apps/ai-gateway-service/evidence/phase911/real-external-provider-authenticity-evidence.json", {
  ...finalEvidence,
  sourceOneShotEvidence: oneShotPath,
});
writeJson(finalPath, finalEvidence);
writeText("docs/phase911/phase911-real-external-provider-one-shot-authenticity-result.md", phaseDoc({
  title: "Phase911 Real External Provider One-shot Authenticity Result",
  goal: "Summarize whether the one-shot evidence proves an actual external NVIDIA Provider response.",
  facts: [
    `externalProviderApiCallConfirmed=${finalEvidence.externalProviderApiCallConfirmed}`,
    `networkAttemptRecorded=${finalEvidence.networkAttemptRecorded}`,
    `providerResponseReceived=${finalEvidence.providerResponseReceived}`,
    `responseSource=${finalEvidence.responseSource}`,
    `responseClassification=${finalEvidence.responseClassification}`,
  ],
  boundaries: [
    "One request maximum.",
    "No retry.",
    "No secret/auth.json/raw endpoint output.",
  ],
  outputs: [
    "apps/ai-gateway-service/evidence/phase911/real-external-provider-authenticity-evidence.json",
    finalPath,
  ],
}));
writeText("docs/phase911/phase911-execution-report.md", phaseDoc({
  title: "Phase911 Execution Report",
  goal: "Record the Phase911 authenticity execution, safety boundaries, and final seal status.",
  facts: [
    `recommended_sealed=${finalEvidence.recommended_sealed}`,
    `blocker=${finalEvidence.blocker}`,
    `requestAttemptCount=${finalEvidence.requestAttemptCount}`,
    `retryAttemptCount=${finalEvidence.retryAttemptCount}`,
    "phase901910CorrectionPreserved=true",
  ],
  boundaries: [
    "Not production traffic.",
    "Not a stability soak.",
    "No /chat default mutation.",
    "No /chat-gateway/execute default mutation.",
  ],
  outputs: [finalPath],
}));

console.log(JSON.stringify(finalEvidence, null, 2));
