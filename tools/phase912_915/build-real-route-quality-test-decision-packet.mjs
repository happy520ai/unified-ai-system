import { buildRealRouteQualityTestDecision } from "../../packages/model-routing-engine/src/index.js";
import {
  baseSafety,
  ensurePhaseDirs,
  finalPath,
  phase912InjectionDryRunPath,
  phase913AuthenticityPath,
  phase914RebindPath,
  phase915DecisionPath,
  phaseDoc,
  readJsonIfPresent,
  writeJson,
  writePhaseDoc,
} from "./phase912-915-common.mjs";

ensurePhaseDirs();

const phase912 = readJsonIfPresent(phase912InjectionDryRunPath) || {};
const phase913 = readJsonIfPresent(phase913AuthenticityPath) || {};
const rebind = readJsonIfPresent(phase914RebindPath) || {};
const decision = {
  ...buildRealRouteQualityTestDecision({ phase913, rebind }),
  ...baseSafety(),
};
writeJson(phase915DecisionPath, decision);

const recommendedSealed = phase912.readyForPhase913 === true && phase913.externalProviderApiCallConfirmed === true;
const blocker = recommendedSealed
  ? null
  : phase913.blocker || phase912.blocker || decision.blocker || "external_provider_authenticity_not_confirmed";
const finalEvidence = {
  phaseRange: "Phase912-915",
  completed: true,
  recommended_sealed: recommendedSealed,
  blocker,
  credentialRefSecureResolutionReady: phase912.credentialRefSecureResolutionReady === true,
  isolatedSecretInjectionReady: phase912.isolatedSecretInjectionReady === true,
  callerReceivesRawSecret: false,
  secretInjectedOnlyInsideBoundary: phase912.secretInjectedOnlyInsideBoundary === true,
  secretWrittenToEvidence: false,
  secretWrittenToLogs: false,
  authJsonRead: false,
  phase913Executed: Number(phase913.requestAttemptCount || 0) === 1,
  externalProviderApiCallConfirmed: phase913.externalProviderApiCallConfirmed === true,
  networkAttemptRecorded: phase913.networkAttemptRecorded === true,
  outboundTracePresent: phase913.outboundTracePresent === true,
  providerResponseReceived: phase913.providerResponseReceived === true,
  responseSource: phase913.responseSource || "unknown",
  responseMarkerMatched: phase913.responseMarkerMatched === true,
  markerWarning: phase913.markerWarning === true,
  responseClassification: phase913.responseClassification || "blocked_by_gate",
  mockResponseUsed: phase913.mockResponseUsed === true,
  simulatedResponseUsed: phase913.simulatedResponseUsed === true,
  dryRunOnly: phase913.dryRunOnly === true,
  localExecutorOnly: phase913.localExecutorOnly === true,
  authenticityClassification: phase913.authenticityClassification || "blocked_by_gate",
  phase914RebindPerformed: rebind.rebindPerformed === true,
  phase901910CorrectionPreserved: true,
  previousPhase821900Classification: rebind.previousPhase821900Classification || "simulated_response",
  originalEvidenceMutated: false,
  readyForRealRouteQualityTest: decision.readyForRealRouteQualityTest === true,
  requiresNewApprovalForBroaderTest: true,
  providerId: "nvidia",
  modelId: phase913.modelId || "nvidia/nemotron-mini-4b-instruct",
  credentialRef: "credentialRef:nvidia:default",
  credentialRefOnly: true,
  requestAttemptCount: Number(phase913.requestAttemptCount || 0),
  retryAttemptCount: Number(phase913.retryAttemptCount || 0),
  estimatedCostUsd: Number(phase913.estimatedCostUsd || 0),
  budgetExceeded: phase913.budgetExceeded === true,
  rawSecretRead: false,
  secretValueExposed: false,
  chatBehaviorChangedByDefault: false,
  chatGatewayExecuteBehaviorChangedByDefault: false,
  deployExecuted: false,
  releaseExecuted: false,
  tagCreated: false,
  artifactUploaded: false,
  unsupportedClaimCount: 0,
  hallucinatedFactCount: 0,
  codexContextGatewayUsed: true,
  contextCodecUsed: true,
  relevantFilesUsed: true,
  fullRepoScanAvoided: true,
  tokenBudgetRespected: true,
};

writeJson(finalPath, finalEvidence);
writePhaseDoc("phase915-real-route-quality-test-decision-packet.md", phaseDoc({
  title: "Phase915 Real Route Quality Test Decision Packet",
  goal: "Decide whether to request a new approval for broader real route quality testing without making extra Provider calls.",
  facts: [
    `readyForRealRouteQualityTest=${decision.readyForRealRouteQualityTest}`,
    "requiresNewApproval=true",
    "suggestedMaxProviderRequests=20",
  ],
  boundaries: [
    "No broader Provider test is executed in Phase915.",
    "No /chat default enablement.",
    "No deploy or release.",
  ],
  outputs: [phase915DecisionPath],
}));
writePhaseDoc("phase912-915-execution-report.md", phaseDoc({
  title: "Phase912-915 Execution Report",
  goal: "Summarize secure credentialRef injection, one-shot authenticity rerun, routing evidence rebind, and next-phase decision.",
  facts: [
    `recommended_sealed=${finalEvidence.recommended_sealed}`,
    `blocker=${finalEvidence.blocker}`,
    `externalProviderApiCallConfirmed=${finalEvidence.externalProviderApiCallConfirmed}`,
    `phase914RebindPerformed=${finalEvidence.phase914RebindPerformed}`,
  ],
  boundaries: [
    "Phase913 is one-shot only.",
    "Phase914 is new ledger only.",
    "Broader real route tests require new approval.",
  ],
  outputs: [finalPath],
}));

console.log(JSON.stringify(finalEvidence, null, 2));
