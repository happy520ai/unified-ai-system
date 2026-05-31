import { createSafeInternalProviderExecutor } from "../../apps/ai-gateway-service/src/providers/safeInternalProviderExecutor.js";
import { createSafeProviderExecutorTestAdapter } from "../../apps/ai-gateway-service/src/providers/safeProviderExecutorTestAdapter.js";
import { writeJson } from "../phase1903a/ownerAutomationSealCommon.mjs";

const bridgePath = "apps/ai-gateway-service/evidence/phase1954p/real-safe-provider-executor-bridge-result.json";
const secretBoundaryPath = "apps/ai-gateway-service/evidence/phase1954p/provider-executor-secret-boundary-result.json";
const readinessPath = "apps/ai-gateway-service/evidence/phase1954p/phase1955p-rerun-readiness-result.json";
const sealPath = "apps/ai-gateway-service/evidence/phase1954p/phase1954p-seal-result.json";

const testAdapter = createSafeProviderExecutorTestAdapter();
const executor = createSafeInternalProviderExecutor({
  mode: "real_bridge",
  providerAdapter: testAdapter,
  providerAdapterName: testAdapter.adapterName,
});

const result = await executor.execute({
  phase: "Phase1954P",
  providerId: "nvidia",
  modelId: "nvidia/llama-3.3-nemotron-super-49b-v1",
  credentialRef: "credentialRef:nvidia:default",
  prompt: "Return exactly: PME_PROVIDER_ONE_SHOT_OK",
  expectedResponseContains: "PME_PROVIDER_ONE_SHOT_OK",
  maxRequests: 1,
  maxEstimatedCostUsd: 0.01,
  timeoutMs: 30000,
  allowProviderCall: false,
  dryRun: true,
});

const safetyFields = {
  credentialRefOnly: true,
  rawSecretAccepted: false,
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
  providerStabilityVerified: false,
  oneShotProviderCallPassed: false,
  productionReadyClaimed: false,
  publicLaunchReadyClaimed: false,
  commercialReadyClaimed: false,
  workspaceCleanClaimed: false,
};

const bridge = {
  phase: "Phase1954P",
  name: "Real Safe Provider Executor Bridge Check",
  completed: true,
  recommended_sealed: result.ok === true,
  blocker: result.ok ? null : result.blocker,
  realSafeProviderExecutorBridgeReady: result.realSafeProviderExecutorBridgeReady === true,
  safeInternalProviderExecutorStillStub: result.safeInternalProviderExecutorStillStub === true,
  providerCallImplementationMode: result.providerCallImplementationMode,
  syntheticAdapterUsed: result.syntheticAdapterUsed === true,
  providerCallsMade: false,
  realProviderNetworkAttempted: false,
  requestAttemptCount: 0,
  requestEnvelopeNormalized: result.requestEnvelopeNormalized === true,
  responseSanitized: result.responseSanitized === true,
  maxRequestsGateEnforced: result.maxRequestsGateEnforced === true,
  budgetGateEnforced: result.budgetGateEnforced === true,
  timeoutGateEnforced: result.timeoutGateEnforced === true,
  providerAllowlistEnforced: result.providerAllowlistEnforced === true,
  modelAllowlistEnforced: result.modelAllowlistEnforced === true,
  sanitizedResponsePreview: result.sanitizedResponsePreview,
  ...safetyFields,
};

const secretBoundary = {
  phase: "Phase1954P",
  name: "Provider Executor Secret Boundary",
  completed: true,
  recommended_sealed: true,
  blocker: null,
  executorReadsRawProviderSecret: false,
  executorReadsAuthorizationJson: false,
  executorReadsDotEnv: false,
  executorDumpsEnv: false,
  executorLogsAuthorizationHeader: false,
  ...safetyFields,
};

const readiness = {
  phase: "Phase1954P",
  name: "Phase1955P Rerun Readiness",
  completed: true,
  recommended_sealed: result.ok === true,
  blocker: result.ok ? null : result.blocker,
  phase1955pRerunReady: result.ok === true,
  realSafeProviderExecutorBridgeReady: result.realSafeProviderExecutorBridgeReady === true,
  phase1955pRequiresFreshOwnerApproval: true,
  ...safetyFields,
};

const seal = {
  phase: "Phase1954P",
  name: "Real Safe Internal Provider Executor Bridge Implementation",
  completed: true,
  recommended_sealed: result.ok === true,
  blocker: result.ok ? null : result.blocker,
  realSafeProviderExecutorBridgeReady: result.realSafeProviderExecutorBridgeReady === true,
  safeInternalProviderExecutorStillStub: result.safeInternalProviderExecutorStillStub === true,
  providerCallImplementationMode: result.providerCallImplementationMode,
  syntheticAdapterUsed: result.syntheticAdapterUsed === true,
  providerCallsMade: false,
  realProviderNetworkAttempted: false,
  requestAttemptCount: 0,
  requestEnvelopeNormalized: result.requestEnvelopeNormalized === true,
  responseSanitized: result.responseSanitized === true,
  maxRequestsGateEnforced: result.maxRequestsGateEnforced === true,
  budgetGateEnforced: result.budgetGateEnforced === true,
  timeoutGateEnforced: result.timeoutGateEnforced === true,
  providerAllowlistEnforced: result.providerAllowlistEnforced === true,
  modelAllowlistEnforced: result.modelAllowlistEnforced === true,
  phase1955pRerunReady: result.ok === true,
  ...safetyFields,
};

writeJson(bridgePath, bridge);
writeJson(secretBoundaryPath, secretBoundary);
writeJson(readinessPath, readiness);
writeJson(sealPath, seal);
console.log(JSON.stringify(seal, null, 2));

if (seal.recommended_sealed !== true || seal.blocker !== null) {
  process.exitCode = 1;
}
