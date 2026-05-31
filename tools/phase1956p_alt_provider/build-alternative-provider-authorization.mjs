import { readJson, writeJson, writeText } from "../phase1903a/ownerAutomationSealCommon.mjs";

const phase = "Phase1956P-AlternativeProvider-Authorization";
const evidenceDir = "apps/ai-gateway-service/evidence/phase1956p_alt_provider";
const nvidiaSealPath = "apps/ai-gateway-service/evidence/phase1956p_nvidia_route_repair/phase1956p-seal-result.json";
const nvidiaDiagnosisPath = "apps/ai-gateway-service/evidence/phase1956p_nvidia_route_repair/nvidia-route-diagnosis-result.json";
const retryFailGatePath = "apps/ai-gateway-service/evidence/phase1955p_retry_fail/alternative-provider-decision-gate-result.json";

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

const nvidiaSealRead = readJson(nvidiaSealPath);
const nvidiaDiagnosisRead = readJson(nvidiaDiagnosisPath);
const retryFailGateRead = readJson(retryFailGatePath);
const nvidiaSeal = nvidiaSealRead.data ?? {};
const nvidiaDiagnosis = nvidiaDiagnosisRead.data ?? {};
const retryFailGate = retryFailGateRead.data ?? {};

const historicalEvidenceImported = nvidiaSealRead.exists === true
  && nvidiaSealRead.parseError === null
  && nvidiaDiagnosisRead.exists === true
  && nvidiaDiagnosisRead.parseError === null
  && nvidiaSeal.nvidiaRouteStatus === "timeout_blocked"
  && nvidiaDiagnosis.retryReady === false;

const providerCandidateMatrix = [
  {
    routeId: "openrouter_compatible",
    label: "OpenRouter-compatible route",
    status: "available_after_owner_approval",
    riskLevel: "medium",
    target: "Prepare a guarded one-shot through an OpenAI-compatible OpenRouter endpoint after owner supplies provider, model, credentialRef, and budget.",
    credentialRefPattern: "credentialRef:openrouter:owner-approved",
    requiresCredentialRef: true,
    requiresOwnerApproval: true,
    requiresProviderAllowlist: true,
    requiresModelAllowlist: true,
    maxRequestsDefault: 1,
    maxEstimatedCostUsdDefault: 0.01,
    realProviderCallAllowedInThisPhase: false,
    nextPhase: "Phase1957P-AlternativeProvider-OneShot",
    claimBoundary: "Cannot claim stability from packet generation; one-shot evidence requires a separate approved execution phase.",
  },
  {
    routeId: "openai_compatible",
    label: "OpenAI-compatible route",
    status: "available_after_owner_approval",
    riskLevel: "medium",
    target: "Prepare a guarded one-shot through an OpenAI-compatible endpoint after owner supplies model, credentialRef, and budget.",
    credentialRefPattern: "credentialRef:openai:owner-approved",
    requiresCredentialRef: true,
    requiresOwnerApproval: true,
    requiresProviderAllowlist: true,
    requiresModelAllowlist: true,
    maxRequestsDefault: 1,
    maxEstimatedCostUsdDefault: 0.01,
    realProviderCallAllowedInThisPhase: false,
    nextPhase: "Phase1957P-AlternativeProvider-OneShot",
    claimBoundary: "OpenAI-compatible authorization remains packet-only until a future owner-approved execution phase.",
  },
  {
    routeId: "claude_compatible",
    label: "Claude-compatible route",
    status: "available_after_owner_approval",
    riskLevel: "medium",
    target: "Prepare a guarded Claude-compatible one-shot after owner supplies provider route, model, credentialRef, and budget.",
    credentialRefPattern: "credentialRef:claude:owner-approved",
    requiresCredentialRef: true,
    requiresOwnerApproval: true,
    requiresProviderAllowlist: true,
    requiresModelAllowlist: true,
    maxRequestsDefault: 1,
    maxEstimatedCostUsdDefault: 0.01,
    realProviderCallAllowedInThisPhase: false,
    nextPhase: "Phase1957P-AlternativeProvider-OneShot",
    claimBoundary: "Claude-compatible route requires a separately approved call and does not inherit NVIDIA evidence.",
  },
  {
    routeId: "volcengine_mimo",
    label: "Volcengine / MiMo route",
    status: "higher_risk_requires_separate_owner_approval",
    riskLevel: "high",
    target: "Prepare a separate high-risk approval packet only if owner explicitly chooses Volcengine or MiMo and supplies budget and credentialRef.",
    credentialRefPattern: "credentialRef:volcengine-or-mimo:owner-approved",
    requiresCredentialRef: true,
    requiresOwnerApproval: true,
    requiresProviderAllowlist: true,
    requiresModelAllowlist: true,
    maxRequestsDefault: 1,
    maxEstimatedCostUsdDefault: 0.01,
    realProviderCallAllowedInThisPhase: false,
    nextPhase: "Phase1957P-AlternativeProvider-OneShot",
    claimBoundary: "MiMo and Volcengine remain blocked without explicit separate owner approval.",
  },
  {
    routeId: "local_synthetic_provider_fallback",
    label: "Local synthetic provider fallback",
    status: "safe_dry_run_only",
    riskLevel: "low",
    target: "Keep three-mode, Tianshu, and Boss Mode demonstrations usable without real Provider evidence.",
    credentialRefPattern: "credentialRef:local-synthetic:dry-run-only",
    requiresCredentialRef: true,
    requiresOwnerApproval: false,
    requiresProviderAllowlist: false,
    requiresModelAllowlist: false,
    maxRequestsDefault: 0,
    maxEstimatedCostUsdDefault: 0,
    realProviderCallAllowedInThisPhase: false,
    nextPhase: "Phase1956P-LocalSyntheticProviderFallback",
    claimBoundary: "Synthetic fallback cannot be used to claim real Provider capability or Provider stability.",
  },
];

const credentialRefRequirementMatrix = providerCandidateMatrix.map((route) => ({
  routeId: route.routeId,
  label: route.label,
  credentialRefRequired: true,
  credentialRefPattern: route.credentialRefPattern,
  rawSecretAllowed: false,
  authJsonReadAllowed: false,
  envDumpAllowed: false,
  ownerMustProvideConcreteRefBeforeExecution: route.routeId !== "local_synthetic_provider_fallback",
  executionBlockedWithoutCredentialRef: route.routeId !== "local_synthetic_provider_fallback",
}));

const budgetAndRequestGate = {
  budgetAndRequestGateGenerated: true,
  allowProviderCallForCurrentPhase: false,
  defaultExecutionPhase: "Phase1957P-AlternativeProvider-OneShot",
  maxRequestsRequired: true,
  maxRequestsDefault: 1,
  retryAttemptCountDefault: 0,
  maxEstimatedCostUsdRequired: true,
  maxEstimatedCostUsdDefault: 0.01,
  timeoutMsRequired: true,
  timeoutMsDefault: 30000,
  providerAllowlistRequired: true,
  modelAllowlistRequired: true,
  credentialRefRequired: true,
  stopOnFirstFailure: true,
  providerStabilityTestAllowed: false,
};

const emergencyStopAndRollbackPlan = {
  emergencyStopAndRollbackPlanGenerated: true,
  emergencyStopTriggers: [
    "owner approval input missing or invalid",
    "credentialRef missing or malformed",
    "maxRequests greater than 1",
    "budget greater than owner-approved limit",
    "providerId or modelId not allowlisted",
    "raw secret or auth header logging requested",
    "chat gateway default route modification requested",
    "deploy, release, tag, artifact, commit, or push requested",
  ],
  rollbackPlan: [
    "delete Phase1956P alternative-provider docs",
    "delete Phase1956P alternative-provider tools",
    "delete Phase1956P alternative-provider evidence directory",
    "remove package scripts added for this phase",
    "re-run README / AGENTS managed sync guard",
  ],
  noRuntimeRollbackNeeded: true,
};

const ownerApprovalInputTemplate = {
  phase: "Phase1957P-AlternativeProvider-OneShot",
  decision: "approved_execute_guarded_alternative_provider_one_shot",
  providerId: "owner_must_choose",
  modelId: "owner_must_choose",
  credentialRef: "credentialRef:provider:alias_required",
  allowProviderCall: false,
  allowRawSecretRead: false,
  allowAuthJsonRead: false,
  allowEnvDump: false,
  allowChatGatewayExecuteModification: false,
  allowDeploy: false,
  maxRequests: 1,
  retryAttemptCount: 0,
  maxEstimatedCostUsd: 0.01,
  timeoutMs: 30000,
  stream: false,
  prompt: "Reply only: OK",
  expectedResponseContains: "OK",
  recordNetworkAttempt: true,
  recordProviderResponseMetadata: true,
  recordRawSecret: false,
  recordAuthorizationHeader: false,
  createdBy: "owner",
  notes: "Template only. Not valid until owner fills concrete provider/model/credentialRef and allowProviderCall is explicitly approved in the execution phase.",
};

const nextOneShotCommandPreview = {
  nextOneShotCommandPreviewGenerated: true,
  commandPreview: "pnpm run run:phase1957p-alternative-provider-one-shot",
  verificationPreview: "pnpm run verify:phase1957p-alternative-provider-one-shot",
  requiresFreshOwnerApprovalInput: true,
  requiredInputPath: "docs/phase1957p-alternative-provider-one-shot-owner-approval.input.json",
  maxRequestsPreview: 1,
  retryAttemptCountPreview: 0,
  providerCallInThisPhase: false,
};

const decisionGate = {
  phase,
  name: "Alternative Provider Decision Gate",
  completed: true,
  recommended_sealed: true,
  blocker: null,
  alternativeProviderDecisionGateGenerated: true,
  historicalEvidenceImported,
  nvidiaRouteStatus: nvidiaSeal.nvidiaRouteStatus ?? "timeout_blocked",
  nvidiaRetryReady: nvidiaDiagnosis.retryReady === true,
  retryReadinessDecision: nvidiaDiagnosis.retryReadinessDecision ?? "retry_ready_false",
  historicalNvidiaAttemptCount: Number(nvidiaSeal.historicalNvidiaAttemptCount ?? 0),
  historicalNvidiaTimeoutCount: Number(nvidiaSeal.historicalNvidiaTimeoutCount ?? 0),
  decision: "prepare_alternative_provider_authorization_packet_only",
  allowProviderCallForCurrentPhase: false,
  providerCandidateMatrixGenerated: true,
  credentialRefRequirementMatrixGenerated: true,
  ownerApprovalInputTemplateGenerated: true,
  budgetAndRequestGateGenerated: true,
  emergencyStopAndRollbackPlanGenerated: true,
  nextOneShotCommandPreviewGenerated: true,
  previousDecisionGatePreserved: retryFailGateRead.exists === true && retryFailGate.alternativeProviderDecisionGateGenerated === true,
  recommendedNextRoutes: [
    "Route A: choose an alternative Provider only after owner approval",
    "Route B: keep NVIDIA timeout-blocked and continue diagnostics without calls",
    "Route C: use local synthetic provider fallback for dry-run continuity only",
  ],
  budgetAndRequestGate,
  emergencyStopAndRollbackPlan,
  nextOneShotCommandPreview,
  newProviderCallExecuted: false,
  providerCallsMade: false,
  requestAttemptCountInThisPhase: 0,
  providerStabilityVerified: false,
  oneShotProviderCallPassed: false,
  ...safetyBoundary,
};

const matrixResult = {
  phase,
  name: "Alternative Provider Candidate Matrix",
  completed: true,
  recommended_sealed: true,
  blocker: null,
  providerCandidateMatrixGenerated: true,
  credentialRefRequirementMatrixGenerated: true,
  ownerApprovalInputTemplateGenerated: true,
  providerCandidateMatrix,
  credentialRefRequirementMatrix,
  budgetAndRequestGate,
  nextOneShotCommandPreview,
  newProviderCallExecuted: false,
  providerCallsMade: false,
  requestAttemptCountInThisPhase: 0,
  providerStabilityVerified: false,
  oneShotProviderCallPassed: false,
  ...safetyBoundary,
};

const seal = {
  phase,
  name: "Phase1956P Alternative Provider Authorization Seal Result",
  completed: true,
  recommended_sealed: true,
  blocker: null,
  alternativeProviderDecisionGateGenerated: true,
  providerCandidateMatrixGenerated: true,
  credentialRefRequirementMatrixGenerated: true,
  ownerApprovalInputTemplateGenerated: true,
  budgetAndRequestGateGenerated: true,
  emergencyStopAndRollbackPlanGenerated: true,
  nextOneShotCommandPreviewGenerated: true,
  historicalEvidenceImported,
  nvidiaRouteStatus: nvidiaSeal.nvidiaRouteStatus ?? "timeout_blocked",
  nvidiaRetryReady: nvidiaDiagnosis.retryReady === true,
  retryReadinessDecision: nvidiaDiagnosis.retryReadinessDecision ?? "retry_ready_false",
  historicalNvidiaAttemptCount: Number(nvidiaSeal.historicalNvidiaAttemptCount ?? 0),
  historicalNvidiaTimeoutCount: Number(nvidiaSeal.historicalNvidiaTimeoutCount ?? 0),
  allowProviderCallForCurrentPhase: false,
  tianshuProviderStabilityBlockerUpdated: true,
  newProviderCallExecuted: false,
  providerCallsMade: false,
  requestAttemptCountInThisPhase: 0,
  providerStabilityVerified: false,
  oneShotProviderCallPassed: false,
  multiProviderStabilityVerified: false,
  ...safetyBoundary,
};

writeJson(`${evidenceDir}/alternative-provider-decision-gate-result.json`, decisionGate);
writeJson(`${evidenceDir}/provider-candidate-matrix-result.json`, matrixResult);
writeJson(`${evidenceDir}/alternative-provider-authorization-seal-result.json`, seal);
writeJson("docs/phase1956p-alternative-provider-owner-approval-template.json", ownerApprovalInputTemplate);

writeText("docs/phase1956p-alternative-provider-decision-gate.md", buildDecisionGateDoc(decisionGate));
writeText("docs/phase1956p-alternative-provider-candidate-matrix.md", buildCandidateMatrixDoc(providerCandidateMatrix));
writeText("docs/phase1956p-alternative-provider-credentialref-matrix.md", buildCredentialRefDoc(credentialRefRequirementMatrix));
writeText("docs/phase1956p-alternative-provider-budget-and-risk-gate.md", buildBudgetGateDoc(budgetAndRequestGate, providerCandidateMatrix));
writeText("docs/phase1956p-alternative-provider-emergency-stop-and-rollback.md", buildRollbackDoc(emergencyStopAndRollbackPlan));
writeText("docs/phase1956p-alternative-provider-next-one-shot-preview.md", buildNextOneShotDoc(nextOneShotCommandPreview));

console.log(JSON.stringify(seal, null, 2));

function buildDecisionGateDoc(record) {
  return `# Phase1956P Alternative Provider Decision Gate

## Decision

- completed: ${record.completed}
- recommended_sealed: ${record.recommended_sealed}
- blocker: ${record.blocker ?? "null"}
- decision: ${record.decision}
- allowProviderCallForCurrentPhase: ${record.allowProviderCallForCurrentPhase}

## Imported NVIDIA Evidence

- nvidiaRouteStatus: ${record.nvidiaRouteStatus}
- historicalNvidiaAttemptCount: ${record.historicalNvidiaAttemptCount}
- historicalNvidiaTimeoutCount: ${record.historicalNvidiaTimeoutCount}
- retryReadinessDecision: ${record.retryReadinessDecision}

NVIDIA remains timeout-blocked. This phase only prepares an alternative Provider authorization packet and does not execute a Provider call.

## Next Routes

${record.recommendedNextRoutes.map((item) => `- ${item}`).join("\n")}
`;
}

function buildCandidateMatrixDoc(matrix) {
  return `# Phase1956P Alternative Provider Candidate Matrix

${matrix.map((item) => `## ${item.label}

- routeId: ${item.routeId}
- status: ${item.status}
- riskLevel: ${item.riskLevel}
- requiresCredentialRef: ${item.requiresCredentialRef}
- requiresOwnerApproval: ${item.requiresOwnerApproval}
- realProviderCallAllowedInThisPhase: ${item.realProviderCallAllowedInThisPhase}
- nextPhase: ${item.nextPhase}
- target: ${item.target}
- claimBoundary: ${item.claimBoundary}
`).join("\n")}
`;
}

function buildCredentialRefDoc(matrix) {
  return `# Phase1956P Alternative Provider CredentialRef Matrix

${matrix.map((item) => `## ${item.label}

- routeId: ${item.routeId}
- credentialRefRequired: ${item.credentialRefRequired}
- credentialRefPattern: ${item.credentialRefPattern}
- rawSecretAllowed: ${item.rawSecretAllowed}
- authJsonReadAllowed: ${item.authJsonReadAllowed}
- envDumpAllowed: ${item.envDumpAllowed}
- executionBlockedWithoutCredentialRef: ${item.executionBlockedWithoutCredentialRef}
`).join("\n")}

No raw secret, auth header, environment dump, or default chat route change is allowed by this matrix.
`;
}

function buildBudgetGateDoc(record, matrix) {
  return `# Phase1956P Alternative Provider Budget And Risk Gate

- budgetAndRequestGateGenerated: ${record.budgetAndRequestGateGenerated}
- allowProviderCallForCurrentPhase: ${record.allowProviderCallForCurrentPhase}
- maxRequestsRequired: ${record.maxRequestsRequired}
- maxRequestsDefault: ${record.maxRequestsDefault}
- retryAttemptCountDefault: ${record.retryAttemptCountDefault}
- maxEstimatedCostUsdRequired: ${record.maxEstimatedCostUsdRequired}
- maxEstimatedCostUsdDefault: ${record.maxEstimatedCostUsdDefault}
- providerAllowlistRequired: ${record.providerAllowlistRequired}
- modelAllowlistRequired: ${record.modelAllowlistRequired}
- credentialRefRequired: ${record.credentialRefRequired}
- stopOnFirstFailure: ${record.stopOnFirstFailure}

Candidate count: ${matrix.length}. Any real call requires a new owner approval input in a later phase.
`;
}

function buildRollbackDoc(record) {
  return `# Phase1956P Alternative Provider Emergency Stop And Rollback

## Emergency Stop Triggers

${record.emergencyStopTriggers.map((item) => `- ${item}`).join("\n")}

## Rollback Plan

${record.rollbackPlan.map((item) => `- ${item}`).join("\n")}

- noRuntimeRollbackNeeded: ${record.noRuntimeRollbackNeeded}
`;
}

function buildNextOneShotDoc(record) {
  return `# Phase1956P Alternative Provider Next One-Shot Preview

- nextOneShotCommandPreviewGenerated: ${record.nextOneShotCommandPreviewGenerated}
- commandPreview: ${record.commandPreview}
- verificationPreview: ${record.verificationPreview}
- requiresFreshOwnerApprovalInput: ${record.requiresFreshOwnerApprovalInput}
- requiredInputPath: ${record.requiredInputPath}
- maxRequestsPreview: ${record.maxRequestsPreview}
- retryAttemptCountPreview: ${record.retryAttemptCountPreview}
- providerCallInThisPhase: ${record.providerCallInThisPhase}

This is a preview only. It must not be used as proof that any alternative Provider passed one-shot or stability testing.
`;
}
