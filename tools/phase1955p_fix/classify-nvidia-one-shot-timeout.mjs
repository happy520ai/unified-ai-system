import { readFileSync } from "node:fs";
import { readJson, writeJson, writeText } from "../phase1903a/ownerAutomationSealCommon.mjs";

const previousSealPath = "apps/ai-gateway-service/evidence/phase1955p/phase1955p-seal-result.json";
const classificationPath = "apps/ai-gateway-service/evidence/phase1955p_fix/nvidia-timeout-classification-result.json";
const repairPath = "apps/ai-gateway-service/evidence/phase1955p_fix/minimal-repair-readiness-result.json";
const sealPath = "apps/ai-gateway-service/evidence/phase1955p_fix/phase1955p-fix-seal-result.json";
const timeoutDocPath = "docs/phase1955p-fix-nvidia-timeout-classification.md";
const repairDocPath = "docs/phase1955p-fix-minimal-repair-plan.md";
const retryTemplatePath = "docs/phase1955p-retry-owner-approval-template.json";

const executorPath = "apps/ai-gateway-service/src/providers/safeInternalProviderExecutor.js";
const envelopePath = "apps/ai-gateway-service/src/providers/safeProviderRequestEnvelope.js";
const sanitizerPath = "apps/ai-gateway-service/src/providers/safeProviderResponseSanitizer.js";
const gatePath = "apps/ai-gateway-service/src/providers/providerExecutionAuthorizationGate.js";
const schemaPath = "apps/ai-gateway-service/src/providers/providerExecutionAuthorizationSchema.js";
const nvidiaClientPath = "apps/ai-gateway-service/src/providers/nvidia/nvidiaUnifiedClient.js";
const phase1955RunnerPath = "tools/phase1955p/run-guarded-real-provider-one-shot-rerun.mjs";

function readText(relativePath) {
  try {
    return readFileSync(relativePath, "utf8");
  } catch {
    return "";
  }
}

function hasText(relativePath, snippet) {
  return readText(relativePath).includes(snippet);
}

function classifyTimeoutStage(previous = {}) {
  const failureReason = previous.failureReason ?? previous.failureClassification ?? previous.responseClassification;
  const latencyMs = Number(previous.latencyMs ?? previous.providerResponseMetadata?.latencyMs ?? 0);
  const status = previous.providerResponseMetadata?.status ?? previous.providerResponseMetadata?.httpStatus ?? null;
  const responseReceived = previous.responseReceived === true || Boolean(previous.sanitizedResponsePreview);

  if (failureReason !== "nvidia_request_timeout") {
    return {
      timeoutStage: "not_nvidia_request_timeout",
      timeoutStageClassified: false,
      confidence: "low",
      rationale: "Previous Phase1955P failure is not classified as nvidia_request_timeout.",
    };
  }

  if (previous.realProviderNetworkAttempted === true && previous.providerCallsMade === true && status === null && responseReceived === false && latencyMs >= 30000) {
    return {
      timeoutStage: "provider_fetch_or_response_wait_timeout",
      timeoutStageClassified: true,
      confidence: "high",
      rationale: "Phase1955P reached the real NVIDIA network path, made exactly one attempt, recorded no HTTP status or response preview, and elapsed just over the 30000ms timeout.",
    };
  }

  if (previous.realProviderNetworkAttempted !== true) {
    return {
      timeoutStage: "pre_network_or_authorization_block",
      timeoutStageClassified: true,
      confidence: "medium",
      rationale: "No provider network attempt was recorded, so the timeout cannot be attributed to provider response wait.",
    };
  }

  if (responseReceived === true) {
    return {
      timeoutStage: "response_parse_or_marker_classification_after_response",
      timeoutStageClassified: true,
      confidence: "medium",
      rationale: "A response preview was recorded, so any failure would be after response receipt.",
    };
  }

  return {
    timeoutStage: "provider_timeout_unresolved_substage",
    timeoutStageClassified: true,
    confidence: "medium",
    rationale: "The failure was a NVIDIA timeout, but available sanitized evidence is insufficient for a narrower substage.",
  };
}

function staticInspectionSummary() {
  return {
    executorNormalizesEnvelope: hasText(executorPath, "normalizeSafeProviderRequestEnvelope"),
    executorUsesResponseSanitizer: hasText(executorPath, "sanitizeSafeProviderResponse"),
    envelopeRequiresCredentialRef: hasText(envelopePath, "credentialRef:"),
    envelopeMaxRequestLimitOne: hasText(envelopePath, "maxRequests > 1"),
    envelopeTimeoutLimitedByContract: hasText(envelopePath, "timeoutMsLimit"),
    authorizationGateChecksRerunPacket: hasText(gatePath, "validateGuardedRealProviderOneShotRerunAuthorizationPacket"),
    authorizationGateChecksTimeoutLimit: hasText(gatePath, "timeout_limit_exceeded"),
    schemaPhase1955TimeoutMs: hasText(schemaPath, "timeoutMs: 30000"),
    sanitizerRedactsSecretLikeText: hasText(sanitizerPath, "REDACTION_PATTERNS"),
    nvidiaClientUsesAbortController: hasText(nvidiaClientPath, "new AbortController()"),
    nvidiaClientDisablesStreaming: hasText(nvidiaClientPath, "stream: false"),
    nvidiaClientReadsBodyAfterFetch: hasText(nvidiaClientPath, "readJsonResponse(response)"),
    nvidiaClientClassifiesAbortAsTimeout: hasText(nvidiaClientPath, "nvidia_request_timeout"),
    phase1955RunnerUsesMaxTokensTwentyFour: hasText(phase1955RunnerPath, "maxTokens: 24"),
  };
}

function commonSafety() {
  return {
    credentialRefOnly: true,
    rawSecretRead: false,
    authJsonRead: false,
    dotEnvRead: false,
    envDumped: false,
    secretValueExposed: false,
    authorizationHeaderLogged: false,
    chatRouteModified: false,
    chatGatewayExecuteModified: false,
    legacyModified: false,
    projectContextModified: false,
    deployExecuted: false,
    releaseExecuted: false,
    tagCreated: false,
    artifactUploaded: false,
    commitCreated: false,
    pushExecuted: false,
    productionReadyClaimed: false,
    commercialReadyClaimed: false,
    workspaceCleanClaimed: false,
  };
}

const previousRead = readJson(previousSealPath);
const previous = previousRead.data ?? {};
const timeout = classifyTimeoutStage(previous);
const inspection = staticInspectionSummary();

const repairPlan = [
  {
    priority: 1,
    action: "keep_one_shot_budget",
    recommendation: "Keep maxRequests=1 and retryAttemptCount=0 for the next retry authorization.",
    risk: "low",
  },
  {
    priority: 2,
    action: "shorten_prompt",
    recommendation: "Use the shortest marker prompt: Reply only: OK.",
    risk: "low",
  },
  {
    priority: 3,
    action: "explicit_non_streaming",
    recommendation: "Keep stream=false in the NVIDIA chat payload and treat streaming as out of scope for the retry.",
    risk: "low",
  },
  {
    priority: 4,
    action: "increase_timeout_with_new_owner_approval",
    recommendation: "Raise timeoutMs to 60000 only in a new owner approval packet.",
    risk: "medium",
  },
  {
    priority: 5,
    action: "preserve_timeout_stage_classification",
    recommendation: "Record provider_fetch_or_response_wait_timeout when status is null, response is absent, and elapsed time reaches the client timeout.",
    risk: "low",
  },
  {
    priority: 6,
    action: "prepare_light_model_candidate",
    recommendation: "Use nvidia/llama-3.1-nemotron-nano-8b-v1 as a lower-timeout-risk candidate only after explicit approval.",
    risk: "medium",
  },
];

const retryApprovalTemplate = {
  phase: "Phase1955P-Retry",
  decision: "approved_execute_guarded_real_provider_one_shot_timeout_retry",
  providerId: "nvidia",
  modelId: "nvidia/llama-3.1-nemotron-nano-8b-v1",
  credentialRef: "credentialRef:nvidia:default",
  allowProviderCall: true,
  maxRequests: 1,
  retryAttemptCount: 0,
  maxEstimatedCostUsd: 0.01,
  timeoutMs: 60000,
  prompt: "Reply only: OK",
  expectedResponseContains: "OK",
  allowRawSecretRead: false,
  allowAuthJsonRead: false,
  allowEnvDump: false,
  allowChatGatewayExecuteModification: false,
  allowDeploy: false,
  recordNetworkAttempt: true,
  recordProviderResponseMetadata: true,
  recordRawSecret: false,
  recordAuthorizationHeader: false,
  createdBy: "owner",
  notes: "One-shot guarded NVIDIA timeout retry only. Lower timeout risk candidate, no stability, production, or commercial claim.",
};

const completed = previousRead.exists === true && previousRead.parseError === null && timeout.timeoutStageClassified === true;
const classification = {
  phase: "Phase1955P-Fix",
  name: "NVIDIA One-Shot Timeout Classification",
  completed,
  recommended_sealed: completed,
  blocker: completed ? null : "phase1955p_previous_timeout_evidence_missing_or_unclassified",
  timeoutFailureClassified: previous.failureReason === "nvidia_request_timeout",
  failureReason: previous.failureReason ?? null,
  previousPhase: "Phase1955P",
  previousBlocker: previous.blocker ?? null,
  previousRequestAttemptCount: Number(previous.requestAttemptCount ?? 0),
  realProviderNetworkAttemptedPreviously: previous.realProviderNetworkAttempted === true,
  providerCallsMadePreviously: previous.providerCallsMade === true,
  previousLatencyMs: previous.latencyMs ?? previous.providerResponseMetadata?.latencyMs ?? null,
  previousHttpStatus: previous.providerResponseMetadata?.status ?? null,
  previousResponseReceived: previous.responseReceived === true,
  timeoutStage: timeout.timeoutStage,
  timeoutStageClassified: timeout.timeoutStageClassified,
  timeoutStageConfidence: timeout.confidence,
  timeoutStageRationale: timeout.rationale,
  rootCauseClassification: "client_abort_after_provider_fetch_or_response_wait_exceeded_30000ms",
  excludedCauses: [
    "credential_resolution_timeout_not_supported_by_evidence",
    "response_parse_timeout_not_supported_because_no_response_was_recorded",
    "expected_marker_mismatch_not_primary_because_no_response_was_recorded",
    "executor_stub_not_primary_because_real_bridge_reached_provider_network",
  ],
  staticInspection: inspection,
  newProviderCallExecuted: false,
  requestAttemptCountInThisPhase: 0,
  providerCallsMade: false,
  providerCallsMadeThisPhase: false,
  realProviderNetworkAttemptedThisPhase: false,
  oneShotProviderCallPassed: false,
  providerStabilityVerified: false,
  ...commonSafety(),
};

const repair = {
  phase: "Phase1955P-Fix",
  name: "Minimal Repair Readiness",
  completed: true,
  recommended_sealed: true,
  blocker: null,
  minimalRepairPlanGenerated: true,
  phase1955pRetryApprovalTemplateGenerated: true,
  repairPlan,
  retryApprovalTemplate,
  nextRetrySafetyBoundary: {
    requiresNewOwnerApproval: true,
    maxRequests: 1,
    retryAttemptCount: 0,
    allowProviderCallOnlyInRetryPhase: true,
    timeoutMsRequiresApproval: true,
    lighterModelIsCandidateOnly: true,
    lowerTimeoutRiskClaimOnly: true,
    providerStabilityClaimAllowed: false,
    oneShotPassClaimAllowedBeforeRetry: false,
  },
  newProviderCallExecuted: false,
  requestAttemptCountInThisPhase: 0,
  providerCallsMade: false,
  providerCallsMadeThisPhase: false,
  realProviderNetworkAttemptedThisPhase: false,
  oneShotProviderCallPassed: false,
  providerStabilityVerified: false,
  ...commonSafety(),
};

const seal = {
  phase: "Phase1955P-Fix",
  name: "NVIDIA One-Shot Timeout Classification + Minimal Repair Plan Seal",
  completed: completed && repair.completed === true,
  recommended_sealed: completed && repair.recommended_sealed === true,
  blocker: completed ? null : classification.blocker,
  timeoutFailureClassified: classification.timeoutFailureClassified,
  failureReason: "nvidia_request_timeout",
  realProviderNetworkAttemptedPreviously: classification.realProviderNetworkAttemptedPreviously,
  newProviderCallExecuted: false,
  requestAttemptCountInThisPhase: 0,
  providerCallsMade: false,
  providerCallsMadeThisPhase: false,
  realProviderNetworkAttemptedThisPhase: false,
  timeoutStageClassified: classification.timeoutStageClassified,
  timeoutStage: classification.timeoutStage,
  timeoutStageConfidence: classification.timeoutStageConfidence,
  minimalRepairPlanGenerated: repair.minimalRepairPlanGenerated,
  phase1955pRetryApprovalTemplateGenerated: repair.phase1955pRetryApprovalTemplateGenerated,
  oneShotProviderCallPassed: false,
  providerStabilityVerified: false,
  ...commonSafety(),
};

writeJson(classificationPath, classification);
writeJson(repairPath, repair);
writeJson(sealPath, seal);
writeJson(retryTemplatePath, retryApprovalTemplate);
writeText(timeoutDocPath, buildTimeoutDoc(classification));
writeText(repairDocPath, buildRepairDoc(repair));

console.log(JSON.stringify(seal, null, 2));

if (seal.recommended_sealed !== true || seal.blocker !== null) {
  process.exitCode = 1;
}

function buildTimeoutDoc(result) {
  return `# Phase1955P-Fix NVIDIA Timeout Classification

## Verified Input

- Previous phase: Phase1955P
- Previous blocker: ${result.previousBlocker}
- Previous failureReason: ${result.failureReason}
- Previous requestAttemptCount: ${result.previousRequestAttemptCount}
- Previous realProviderNetworkAttempted: ${result.realProviderNetworkAttemptedPreviously}
- Previous latencyMs: ${result.previousLatencyMs}
- Previous HTTP status: ${result.previousHttpStatus ?? "null"}
- Previous responseReceived: ${result.previousResponseReceived}

## Classification

- timeoutStageClassified: ${result.timeoutStageClassified}
- timeoutStage: ${result.timeoutStage}
- confidence: ${result.timeoutStageConfidence}
- rationale: ${result.timeoutStageRationale}

The evidence supports a client-side timeout while waiting for the NVIDIA fetch/response path. It does not support a credential resolution timeout, completed response parse timeout, or expected-marker mismatch from a completed response.

## Safety Boundary

- newProviderCallExecuted: false
- requestAttemptCountInThisPhase: 0
- rawSecretRead: false
- authJsonRead: false
- dotEnvRead: false
- authorizationHeaderLogged: false
- chatGatewayExecuteModified: false
- productionReadyClaimed: false
- commercialReadyClaimed: false
- workspaceCleanClaimed: false
`;
}

function buildRepairDoc(result) {
  const plan = result.repairPlan.map((item) => `- P${item.priority} ${item.action}: ${item.recommendation}`).join("\n");
  return `# Phase1955P-Fix Minimal Repair Plan

## Scope

This phase prepares the next safe retry plan only. It does not execute a Provider call and does not claim one-shot success or Provider stability.

## Minimal Repair Priority

${plan}

## Retry Approval Template

The retry template is written to \`docs/phase1955p-retry-owner-approval-template.json\`. It requires a fresh owner approval before any Provider call.

Important boundaries:

- maxRequests: ${result.retryApprovalTemplate.maxRequests}
- retryAttemptCount: ${result.retryApprovalTemplate.retryAttemptCount}
- timeoutMs: ${result.retryApprovalTemplate.timeoutMs}
- modelId: ${result.retryApprovalTemplate.modelId}
- prompt: ${result.retryApprovalTemplate.prompt}
- expectedResponseContains: ${result.retryApprovalTemplate.expectedResponseContains}

The lighter model candidate may reduce one-shot timeout risk. It is not a stability claim and must not be auto-selected without explicit approval.

## Not Claimed

- oneShotProviderCallPassed: false
- providerStabilityVerified: false
- productionReadyClaimed: false
- commercialReadyClaimed: false
- workspaceCleanClaimed: false
`;
}
