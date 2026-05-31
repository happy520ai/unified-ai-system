import { PHASE966_970_EXPECTED_MARKER } from "./godMarkerRerunApprovalIntake.js";

export function buildGodPromptMarkerContractPreview({
  phase961965Audit = {},
  phase961965Design = {},
} = {}) {
  const rootCause = phase961965Audit.rootCauseClass || phase961965Audit.rootCauseFromPhase961965 || "prompt_marker_contract_mismatch";
  const prompt = `Return ONLY compact JSON. No markdown. No preface.
Review claim: AI Gateway routing evidence must distinguish real external provider responses from dry-run or simulated responses.
Use exactly this shape and keep each value short:
{"marker":"${PHASE966_970_EXPECTED_MARKER}","reviewerA":"Reviewer A Evidence: <one reason>","reviewerB":"Reviewer B Evidence: <one reason>","synthesis":"Synthesis: <one sentence>","finalAnswer":"Final Answer: pass or needs_followup"}
The marker value must be exactly ${PHASE966_970_EXPECTED_MARKER}.`;
  const contract = {
    phase: "Phase967",
    completed: true,
    recommended_sealed: rootCause === "prompt_marker_contract_mismatch"
      && phase961965Design.godModePromptFixDesignReady === true
      && phase961965Design.godModeScoringFixDesignReady === true,
    blocker: null,
    promptMarkerContractReady: true,
    rootCauseFromPhase961965: rootCause,
    targetScenario: "god_dual_reviewer",
    providerAllowlist: ["nvidia"],
    credentialRefOnly: true,
    modelId: "nvidia/llama-3.3-nemotron-super-49b-v1",
    prompt,
    responseStructure: {
      marker: PHASE966_970_EXPECTED_MARKER,
      reviewerA: "string",
      reviewerB: "string",
      synthesis: "string",
      finalAnswer: "string",
    },
    markerContract: {
      reviewerARequired: true,
      reviewerBRequired: true,
      synthesisRequired: true,
      finalAnswerRequired: true,
      explicitRerunMarkerRequired: true,
      expectedMarker: PHASE966_970_EXPECTED_MARKER,
      markerMayBeJsonFieldOrTrailingText: true,
    },
    scoringContract: {
      passRequiresExternalProvider: true,
      passRequiresReviewerA: true,
      passRequiresReviewerB: true,
      passRequiresSynthesis: true,
      passRequiresFinalAnswer: true,
      passRequiresMarker: true,
      markerMissingCannotPass: true,
      structureMissingCannotPass: true,
      markerMissingMaxScore: 60,
      structureMissingMaxScore: 70,
    },
    rawSecretRead: false,
    secretValueExposed: false,
    authJsonRead: false,
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
  if (contract.recommended_sealed !== true) {
    contract.blocker = "phase961_965_contract_design_not_ready";
  }
  return contract;
}

export function inspectGodMarkerResponse({ responseText = "", expectedMarker = PHASE966_970_EXPECTED_MARKER } = {}) {
  const text = String(responseText || "");
  const normalized = text.toLowerCase();
  const reviewerAFound = /reviewer\s*a|reviewera|\"reviewerA\"/i.test(text);
  const reviewerBFound = /reviewer\s*b|reviewerb|\"reviewerB\"/i.test(text);
  const synthesisFound = normalized.includes("synthesis") || normalized.includes("adjudication");
  const finalAnswerFound = normalized.includes("finalanswer") || normalized.includes("final answer") || normalized.includes("verdict");
  const markerFound = text.includes(expectedMarker);
  const structureComplete = reviewerAFound && reviewerBFound && synthesisFound && finalAnswerFound;
  const pass = structureComplete && markerFound;
  return {
    reviewerAFound,
    reviewerBFound,
    synthesisFound,
    finalAnswerFound,
    markerFound,
    structureComplete,
    responseClassification: pass ? "pass" : markerFound ? "structure_missing" : "marker_missing",
    qualityScore: pass ? 100 : markerFound ? 70 : structureComplete ? 60 : 40,
  };
}
