import { createSafeInternalProviderExecutor } from "../../apps/ai-gateway-service/src/providers/safeInternalProviderExecutor.js";
import { createPhase1951PAuthorizationInput } from "../../apps/ai-gateway-service/src/providers/providerExecutionAuthorizationSchema.js";
import { writeJson } from "../phase1903a/ownerAutomationSealCommon.mjs";

const authorizationResultPath =
  "apps/ai-gateway-service/evidence/phase1951p/safe-internal-provider-executor-authorization-result.json";
const boundaryResultPath =
  "apps/ai-gateway-service/evidence/phase1951p/provider-execution-boundary-result.json";

const authorizationInput = createPhase1951PAuthorizationInput();
const executor = createSafeInternalProviderExecutor();
const dryRun = executor.runDryRun(authorizationInput);

const commonSafetyFields = {
  allowProviderCall: false,
  requestAttemptCount: 0,
  providerCallsMade: false,
  rawSecretAccepted: false,
  rawSecretRead: false,
  authJsonRead: false,
  envDumped: false,
  rawKeyOutput: false,
  authHeaderLogged: false,
  secretValueExposed: false,
  chatRouteModified: false,
  chatGatewayExecuteModified: false,
  deployExecuted: false,
  releaseExecuted: false,
  tagCreated: false,
  artifactUploaded: false,
  commitCreated: false,
  pushExecuted: false,
  providerStabilityVerified: false,
  providerStabilityNotVerifiedPreserved: true,
  productionReadyClaimed: false,
  publicLaunchReadyClaimed: false,
  commercialReadyClaimed: false,
  workspaceCleanClaimed: false,
};

const authorizationResult = {
  phase: "Phase1951P",
  name: "Safe Internal Provider Executor Authorization",
  completed: true,
  recommended_sealed: dryRun.ok === true,
  blocker: dryRun.ok === true ? null : dryRun.blocker,
  safeInternalProviderExecutorReady: dryRun.safeInternalProviderExecutorReady === true,
  safeProviderCallImplementationPrepared: dryRun.safeProviderCallImplementationPrepared === true,
  providerCallImplementationMode: dryRun.providerCallImplementationMode,
  authorizationGatePassed: dryRun.authorizationGatePassed === true,
  requestValidationPassed: dryRun.requestValidationPassed === true,
  acceptsCredentialRefOnly: dryRun.acceptsCredentialRefOnly === true,
  credentialRefRequired: dryRun.credentialRefRequired === true,
  providerAllowlistRequired: true,
  modelAllowlistRequired: true,
  maxRequestsRequired: true,
  maxEstimatedCostUsdRequired: true,
  explicitAllowProviderCallRequired: true,
  dryRunDefault: true,
  providerId: authorizationInput.providerId,
  modelId: authorizationInput.modelId,
  credentialRef: authorizationInput.credentialRef,
  maxRequests: authorizationInput.maxRequests,
  maxEstimatedCostUsd: authorizationInput.maxEstimatedCostUsd,
  ...commonSafetyFields,
  nextRecommendedPhase: "Phase1952P Guarded Real Provider Call Authorization",
};

const boundaryResult = {
  phase: "Phase1951P",
  name: "Provider Execution Boundary",
  completed: true,
  recommended_sealed: dryRun.ok === true,
  blocker: dryRun.ok === true ? null : dryRun.blocker,
  credentialRefOnlyBoundaryPrepared: true,
  providerAllowlist: ["nvidia"],
  modelAllowlist: ["nvidia/llama-3.3-nemotron-super-49b-v1"],
  credentialRefAllowlist: ["credentialRef:nvidia:default"],
  allowedDecision: authorizationInput.decision,
  providerCallImplementationMode: dryRun.providerCallImplementationMode,
  executionMode: "design_only_dry_run_stub",
  providerStabilityBlockerPreserved: "provider_stability_not_verified",
  ...commonSafetyFields,
};

writeJson(authorizationResultPath, authorizationResult);
writeJson(boundaryResultPath, boundaryResult);
console.log(JSON.stringify(authorizationResult, null, 2));

if (authorizationResult.recommended_sealed !== true || authorizationResult.blocker !== null) {
  process.exitCode = 1;
}
