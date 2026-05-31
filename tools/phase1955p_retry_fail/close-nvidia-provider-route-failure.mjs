import { readJson, writeJson, writeText } from "../phase1903a/ownerAutomationSealCommon.mjs";

const phase1955SealPath = "apps/ai-gateway-service/evidence/phase1955p/phase1955p-seal-result.json";
const phase1955RetrySealPath = "apps/ai-gateway-service/evidence/phase1955p_retry/phase1955p-retry-seal-result.json";
const closurePath = "apps/ai-gateway-service/evidence/phase1955p_retry_fail/nvidia-route-failure-closure-result.json";
const gatePath = "apps/ai-gateway-service/evidence/phase1955p_retry_fail/alternative-provider-decision-gate-result.json";
const sealPath = "apps/ai-gateway-service/evidence/phase1955p_retry_fail/phase1955p-retry-fail-seal-result.json";
const nvidiaRouteRepairTemplatePath = "docs/phase1956p-nvidia-route-repair-template.json";
const alternativeProviderTemplatePath = "docs/phase1956p-alternative-provider-authorization-template.json";

const safetyBoundary = {
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
  publicLaunchReadyClaimed: false,
  commercialReadyClaimed: false,
  workspaceCleanClaimed: false,
};

const phase1955Read = readJson(phase1955SealPath);
const phase1955RetryRead = readJson(phase1955RetrySealPath);
const phase1955 = phase1955Read.data ?? {};
const retry = phase1955RetryRead.data ?? {};

const phase1955Timeout = isTimeoutAttempt(phase1955);
const retryTimeout = isTimeoutAttempt(retry);
const evidenceImported = phase1955Read.exists === true
  && phase1955Read.parseError === null
  && phase1955RetryRead.exists === true
  && phase1955RetryRead.parseError === null;
const timeoutStage = retry.timeoutStage ?? "provider_fetch_or_response_wait_timeout";
const nvidiaRequestAttemptTotal = Number(phase1955.requestAttemptCount ?? 0) + Number(retry.requestAttemptCount ?? 0);
const nvidiaTimeoutCount = [phase1955Timeout, retryTimeout].filter(Boolean).length;
const nvidiaSuccessTotal = Number(phase1955.oneShotProviderCallPassed === true) + Number(retry.oneShotProviderCallPassed === true);
const closureReady = evidenceImported
  && phase1955Timeout
  && retryTimeout
  && nvidiaRequestAttemptTotal === 2
  && nvidiaSuccessTotal === 0
  && nvidiaTimeoutCount === 2;

const routes = buildDecisionRoutes();
const nvidiaRepairTemplate = buildNvidiaRepairTemplate();
const alternativeProviderTemplate = buildAlternativeProviderTemplate();

const closure = {
  phase: "Phase1955P-Retry-Fail",
  name: "NVIDIA Route Failure Closure",
  completed: true,
  recommended_sealed: closureReady,
  blocker: closureReady ? null : "nvidia_route_failure_closure_input_invalid",
  nvidiaRouteFailureClosed: closureReady,
  nvidiaRouteStatus: closureReady ? "timeout_blocked" : "closure_input_invalid",
  nvidiaRequestAttemptTotal,
  nvidiaSuccessTotal,
  nvidiaTimeoutCount,
  phase1955EvidenceImported: phase1955Read.exists === true && phase1955Read.parseError === null,
  phase1955RetryEvidenceImported: phase1955RetryRead.exists === true && phase1955RetryRead.parseError === null,
  importedEvidence: [
    summarizeAttempt("Phase1955P", phase1955),
    summarizeAttempt("Phase1955P-Retry", retry),
  ],
  failureReason: "nvidia_request_timeout",
  timeoutStage,
  routeFailureClassification: "nvidia_guarded_one_shot_route_timeout_blocked_after_two_real_attempts",
  routeFailureRationale: "Both guarded NVIDIA one-shot attempts reached the real provider network path and timed out while waiting for fetch or response completion. Neither attempt recorded HTTP status or response body.",
  stopCondition: "No additional Provider requests in this phase; do not proceed to single-provider stability until route repair or alternative provider authorization is completed.",
  newProviderCallExecuted: false,
  requestAttemptCountInThisPhase: 0,
  providerCallsMade: false,
  providerStabilityVerified: false,
  oneShotProviderCallPassed: false,
  multiProviderStabilityVerified: false,
  ...safetyBoundary,
};

const gate = {
  phase: "Phase1955P-Retry-Fail",
  name: "Alternative Provider Decision Gate",
  completed: true,
  recommended_sealed: closureReady,
  blocker: closureReady ? null : "alternative_provider_decision_gate_input_invalid",
  alternativeProviderDecisionGateGenerated: true,
  nextRouteOptionsGenerated: true,
  nvidiaRouteRepairTemplateGenerated: true,
  alternativeProviderAuthorizationTemplateGenerated: true,
  routes,
  recommendation: {
    recommendedFirstRoute: "Route A",
    reason: "The current failure is route-level timeout evidence for NVIDIA. Repair the route diagnosis before spending more real provider attempts, or require a separate owner-approved alternative provider packet.",
  },
  newProviderCallExecuted: false,
  requestAttemptCountInThisPhase: 0,
  providerCallsMade: false,
  providerStabilityVerified: false,
  oneShotProviderCallPassed: false,
  multiProviderStabilityVerified: false,
  ...safetyBoundary,
};

const seal = {
  phase: "Phase1955P-Retry-Fail",
  name: "Phase1955P-Retry-Fail Seal Result",
  completed: true,
  recommended_sealed: closureReady,
  blocker: closureReady ? null : "nvidia_route_failure_closure_input_invalid",
  nvidiaRouteFailureClosed: closure.nvidiaRouteFailureClosed,
  nvidiaRouteStatus: closure.nvidiaRouteStatus,
  nvidiaRequestAttemptTotal,
  nvidiaSuccessTotal,
  nvidiaTimeoutCount,
  phase1955EvidenceImported: closure.phase1955EvidenceImported,
  phase1955RetryEvidenceImported: closure.phase1955RetryEvidenceImported,
  failureReason: "nvidia_request_timeout",
  timeoutStage,
  newProviderCallExecuted: false,
  requestAttemptCountInThisPhase: 0,
  providerCallsMade: false,
  alternativeProviderDecisionGateGenerated: true,
  nextRouteOptionsGenerated: true,
  nvidiaRouteRepairTemplateGenerated: true,
  alternativeProviderAuthorizationTemplateGenerated: true,
  tianshuProviderStabilityBlockerUpdated: true,
  providerStabilityVerified: false,
  oneShotProviderCallPassed: false,
  multiProviderStabilityVerified: false,
  ...safetyBoundary,
};

writeJson(closurePath, closure);
writeJson(gatePath, gate);
writeJson(sealPath, seal);
writeJson(nvidiaRouteRepairTemplatePath, nvidiaRepairTemplate);
writeJson(alternativeProviderTemplatePath, alternativeProviderTemplate);

writeText("docs/phase1955p-retry-fail-nvidia-route-failure-closure.md", buildClosureDoc(closure));
writeText("docs/phase1955p-retry-fail-alternative-provider-decision-gate.md", buildDecisionGateDoc(gate));
writeText("docs/phase1955p-retry-fail-next-route-options.md", buildNextRouteOptionsDoc(routes));
writeText("docs/phase1955p-retry-fail-provider-status-update.md", buildProviderStatusDoc(seal));

console.log(JSON.stringify(seal, null, 2));

if (seal.recommended_sealed !== true || seal.blocker !== null) {
  process.exitCode = 1;
}

function isTimeoutAttempt(record) {
  return record.providerId === "nvidia"
    && record.failureReason === "nvidia_request_timeout"
    && record.realProviderNetworkAttempted === true
    && record.providerCallsMade === true
    && Number(record.requestAttemptCount ?? 0) === 1
    && record.oneShotProviderCallPassed === false
    && record.expectedResponseMatched === false
    && record.responseReceived === false;
}

function summarizeAttempt(phase, record) {
  return {
    phase,
    providerId: record.providerId ?? "nvidia",
    modelId: record.modelId ?? null,
    requestAttemptCount: Number(record.requestAttemptCount ?? 0),
    retryAttemptCount: Number(record.retryAttemptCount ?? 0),
    failureReason: record.failureReason ?? null,
    timeoutStage: record.timeoutStage ?? "provider_fetch_or_response_wait_timeout",
    latencyMs: record.latencyMs ?? record.providerResponseMetadata?.latencyMs ?? null,
    httpStatus: record.providerResponseMetadata?.status ?? null,
    responseReceived: record.responseReceived === true,
    oneShotProviderCallPassed: record.oneShotProviderCallPassed === true,
    expectedResponseMatched: record.expectedResponseMatched === true,
    realProviderNetworkAttempted: record.realProviderNetworkAttempted === true,
  };
}

function buildDecisionRoutes() {
  return [
    {
      routeId: "A",
      title: "NVIDIA Route Repair",
      status: "recommended_first",
      riskLevel: "medium",
      realProviderCall: false,
      target: "Check endpoint, adapter, request body, timeout handling, response parsing, and model compatibility before any further retry.",
      nextPhase: "Phase1956P-NVIDIA-Route-Repair",
      explanation: "Do not directly retry again. First add route diagnostics and adapter compatibility checks without spending another Provider request.",
    },
    {
      routeId: "B",
      title: "Alternative Provider Authorization",
      status: "available_after_owner_approval",
      riskLevel: "high",
      realProviderCall: false,
      target: "Prepare an owner-approved packet for a clearly scoped alternative provider, model, credentialRef, maxRequests, and budget.",
      nextPhase: "Phase1956P-AlternativeProvider-Authorization",
      explanation: "This is only a packet path in the current phase. Any real call requires a separate owner approval and a new bounded execution phase.",
    },
    {
      routeId: "C",
      title: "Local Synthetic Provider Fallback",
      status: "safe_dry_run_only",
      riskLevel: "low",
      realProviderCall: false,
      target: "Keep Normal, God, Tianshu, and Boss Mode workflows demonstrable without claiming real Provider capability.",
      nextPhase: "Phase1956P-LocalSyntheticProviderFallback",
      explanation: "This preserves product usability for local dry-run flows, but it cannot be used as evidence of real Provider readiness.",
    },
  ];
}

function buildNvidiaRepairTemplate() {
  return {
    phase: "Phase1956P-NVIDIA-Route-Repair",
    decision: "prepare_nvidia_route_repair_without_provider_call",
    providerId: "nvidia",
    currentRouteStatus: "timeout_blocked",
    allowProviderCall: false,
    maxRequests: 0,
    retryAttemptCount: 0,
    diagnosticScope: [
      "endpoint_contract_review",
      "adapter_request_body_review",
      "non_streaming_response_handling_review",
      "timeout_stage_instrumentation",
      "model_compatibility_review",
      "sanitized_error_classification",
    ],
    forbiddenActions: [
      "real_provider_call",
      "raw_secret_read",
      "auth_json_read",
      "dot_env_read",
      "chat_gateway_execute_modification",
      "deploy",
      "release",
      "tag",
      "artifact_upload",
      "commit",
      "push",
    ],
    expectedOutputs: [
      "route_diagnostic_evidence",
      "adapter_contract_findings",
      "next_owner_approval_template_if_needed",
    ],
  };
}

function buildAlternativeProviderTemplate() {
  return {
    phase: "Phase1956P-AlternativeProvider-Authorization",
    decision: "prepare_alternative_provider_authorization_packet_only",
    providerId: "owner_must_choose",
    modelId: "owner_must_choose",
    credentialRef: "credentialRef:provider:alias_required",
    allowProviderCall: false,
    allowRawSecretRead: false,
    allowAuthJsonRead: false,
    allowEnvDump: false,
    allowChatGatewayExecuteModification: false,
    allowDeploy: false,
    maxRequests: 0,
    maxEstimatedCostUsd: 0,
    timeoutMs: 30000,
    prompt: "owner_must_define",
    expectedResponseContains: "owner_must_define",
    recordNetworkAttempt: false,
    recordProviderResponseMetadata: true,
    recordRawSecret: false,
    recordAuthorizationHeader: false,
    requiredBeforeExecution: [
      "provider_allowlist",
      "model_allowlist",
      "credentialRef_validation",
      "owner_approval_input",
      "budget_gate",
      "emergency_stop_plan",
    ],
    notes: "Authorization packet only. This template does not approve or execute any Provider call.",
  };
}

function buildClosureDoc(record) {
  return `# Phase1955P-Retry-Fail NVIDIA Route Failure Closure

## Verified Facts

- Phase1955P reached the real NVIDIA provider network path and timed out after ${record.importedEvidence[0].latencyMs}ms.
- Phase1955P-Retry used the lighter NVIDIA model, non-streaming mode, and a 60000ms timeout, then timed out after ${record.importedEvidence[1].latencyMs}ms.
- Total NVIDIA attempts considered here: ${record.nvidiaRequestAttemptTotal}.
- Total successes: ${record.nvidiaSuccessTotal}.
- Total timeout failures: ${record.nvidiaTimeoutCount}.
- Current NVIDIA route status: ${record.nvidiaRouteStatus}.

## Closure

The NVIDIA guarded one-shot route is closed as timeout blocked for this branch of evidence. No additional Provider request was executed in this phase, and the system must not enter single provider stability testing from this evidence state.

## Current Blocked Claim

- oneShotProviderCallPassed=false
- providerStabilityVerified=false
- multiProviderStabilityVerified=false
- productionReadyClaimed=false
- commercialReadyClaimed=false
`;
}

function buildDecisionGateDoc(record) {
  return `# Phase1955P-Retry-Fail Alternative Provider Decision Gate

## Gate Result

- alternativeProviderDecisionGateGenerated: ${record.alternativeProviderDecisionGateGenerated}
- nextRouteOptionsGenerated: ${record.nextRouteOptionsGenerated}
- recommended first route: ${record.recommendation.recommendedFirstRoute}

## Routes

${record.routes.map((route) => `### Route ${route.routeId}: ${route.title}

- status: ${route.status}
- riskLevel: ${route.riskLevel}
- realProviderCall: ${route.realProviderCall}
- nextPhase: ${route.nextPhase}
- target: ${route.target}
- explanation: ${route.explanation}
`).join("\n")}
`;
}

function buildNextRouteOptionsDoc(routes) {
  return `# Phase1955P-Retry-Fail Next Route Options

## Route A: NVIDIA Route Repair

- status: ${routes[0].status}
- real call: ${routes[0].realProviderCall}
- next phase: ${routes[0].nextPhase}
- purpose: inspect endpoint, adapter, request body, timeout handling, model compatibility, and response parsing without a new Provider call.

## Route B: Alternative Provider Authorization

- status: ${routes[1].status}
- real call: ${routes[1].realProviderCall}
- next phase: ${routes[1].nextPhase}
- purpose: prepare a separate owner approval packet for a clearly selected alternative provider/model/credentialRef/budget.

## Route C: Local Synthetic Provider Fallback

- status: ${routes[2].status}
- real call: ${routes[2].realProviderCall}
- next phase: ${routes[2].nextPhase}
- purpose: keep local dry-run workflows demonstrable while preserving the fact that real Provider capability is not verified.
`;
}

function buildProviderStatusDoc(record) {
  return `# Phase1955P-Retry-Fail Provider Status Update

## NVIDIA

- route status: ${record.nvidiaRouteStatus}
- request attempts imported: ${record.nvidiaRequestAttemptTotal}
- success total: ${record.nvidiaSuccessTotal}
- timeout count: ${record.nvidiaTimeoutCount}
- failure reason: ${record.failureReason}
- timeout stage: ${record.timeoutStage}

## Tianshu Capability Atom

\`provider_stability_check\` remains blocked with \`provider_stability_not_verified\`. The blocker explanation now records that the guarded NVIDIA one-shot route timed out twice and is \`timeout_blocked\` pending route repair or alternative provider authorization.

## Boundaries

- newProviderCallExecuted=false
- requestAttemptCountInThisPhase=0
- providerCallsMade=false
- rawSecretRead=false
- secretValueExposed=false
- chatGatewayExecuteModified=false
`;
}
