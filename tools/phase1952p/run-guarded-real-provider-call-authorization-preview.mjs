import { createPhase1952PGuardedRealProviderCallAuthorizationPacket } from "../../apps/ai-gateway-service/src/providers/providerExecutionAuthorizationSchema.js";
import { validateGuardedRealProviderCallAuthorizationPacket } from "../../apps/ai-gateway-service/src/providers/providerExecutionAuthorizationGate.js";
import { writeJson } from "../phase1903a/ownerAutomationSealCommon.mjs";

const previewPath = "apps/ai-gateway-service/evidence/phase1952p/guarded-real-provider-call-authorization-preview.json";
const budgetGatePath = "apps/ai-gateway-service/evidence/phase1952p/provider-call-budget-gate-result.json";
const readinessPath = "apps/ai-gateway-service/evidence/phase1952p/phase1953p-one-shot-readiness-result.json";
const sealPath = "apps/ai-gateway-service/evidence/phase1952p/phase1952p-seal-result.json";

const packet = createPhase1952PGuardedRealProviderCallAuthorizationPacket();
const gate = validateGuardedRealProviderCallAuthorizationPacket(packet);

const safetyFields = {
  allowProviderCallForCurrentPhase: false,
  requestAttemptCount: 0,
  providerCallsMade: false,
  providerStabilityVerified: false,
  credentialRefOnly: true,
  rawSecretRead: false,
  authJsonRead: false,
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
  providerStabilityNotVerifiedPreserved: true,
};

const preview = {
  phase: "Phase1952P",
  name: "Guarded Real Provider Call Authorization Preview",
  completed: true,
  recommended_sealed: gate.ok === true,
  blocker: gate.ok ? null : "phase1952p_authorization_packet_invalid",
  authorizationPacketGenerated: true,
  ownerApprovalTemplateGenerated: true,
  phase1953pOneShotPreviewGenerated: true,
  targetPhase: "Phase1953P",
  providerId: packet.providerId,
  modelId: packet.modelId,
  credentialRef: packet.credentialRef,
  maxRequests: packet.maxRequests,
  maxEstimatedCostUsd: packet.maxEstimatedCostUsd,
  timeoutMs: packet.timeoutMs,
  promptPreview: packet.prompt,
  expectedResponseContains: packet.expectedResponseContains,
  ownerApprovalTemplatePath: "docs/phase1952p-owner-approval-input-template.json",
  oneShotCommandPreview: [
    "cmd /c pnpm run run:phase1953p-guarded-real-provider-one-shot",
    "cmd /c pnpm run verify:phase1953p-guarded-real-provider-one-shot",
  ],
  ...safetyFields,
};

const budgetGate = {
  phase: "Phase1952P",
  name: "Provider Call Budget And Risk Gate",
  completed: true,
  recommended_sealed: gate.ok === true,
  blocker: gate.ok ? null : "phase1952p_budget_or_risk_gate_failed",
  maxRequestsGateReady: gate.maxRequestsGateReady === true,
  budgetGateReady: gate.budgetGateReady === true,
  providerAllowlistReady: gate.providerAllowlistReady === true,
  modelAllowlistReady: gate.modelAllowlistReady === true,
  timeoutGateReady: gate.timeoutGateReady === true,
  authorizationFailures: gate.failures,
  ...safetyFields,
};

const readiness = {
  phase: "Phase1952P",
  name: "Phase1953P One-Shot Readiness Preview",
  completed: true,
  recommended_sealed: gate.ok === true,
  blocker: gate.ok ? null : "phase1953p_one_shot_readiness_preview_failed",
  phase1953pOneShotPreviewGenerated: true,
  phase1953pExecutionAllowedByThisPhase: false,
  ownerApprovalTemplateRequired: true,
  oneShotCommandPreviewGenerated: true,
  emergencyStopPlanReady: true,
  rollbackPlanReady: true,
  ...safetyFields,
};

const seal = {
  phase: "Phase1952P",
  name: "Guarded Real Provider Call Authorization Packet",
  completed: true,
  phase1952pCompleted: true,
  recommended_sealed: gate.ok === true,
  blocker: gate.ok ? null : "phase1952p_authorization_not_ready",
  authorizationPacketGenerated: true,
  ownerApprovalTemplateGenerated: true,
  phase1953pOneShotPreviewGenerated: true,
  maxRequestsGateReady: budgetGate.maxRequestsGateReady,
  budgetGateReady: budgetGate.budgetGateReady,
  providerAllowlistReady: budgetGate.providerAllowlistReady,
  modelAllowlistReady: budgetGate.modelAllowlistReady,
  timeoutGateReady: budgetGate.timeoutGateReady,
  emergencyStopPlanReady: true,
  rollbackPlanReady: true,
  nextRecommendedPhase: "Phase1953P Guarded Real Provider One-Shot Test",
  ...safetyFields,
};

writeJson(previewPath, preview);
writeJson(budgetGatePath, budgetGate);
writeJson(readinessPath, readiness);
writeJson(sealPath, seal);
console.log(JSON.stringify(seal, null, 2));

if (seal.recommended_sealed !== true || seal.blocker !== null) {
  process.exitCode = 1;
}
