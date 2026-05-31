import { readJson, writeJson } from "../phase1903a/ownerAutomationSealCommon.mjs";

const sourcePath = "apps/ai-gateway-service/evidence/phase1932p/guarded-real-provider-stability-test-result.json";
const resultPath = "apps/ai-gateway-service/evidence/phase1933p/single-provider-stability-boundary-seal-result.json";

const sourceRead = readJson(sourcePath);
const source = sourceRead.data ?? {};
const phase1932Passed = source.recommended_sealed === true
  && source.blocker === null
  && source.providerId === "nvidia"
  && source.modelId === "nvidia/llama-3.3-nemotron-super-49b-v1"
  && source.credentialRef === "credentialRef:nvidia:default"
  && source.credentialRefOnly === true
  && source.realProviderCallExecuted === true
  && source.providerCallsMade === true
  && Number(source.requestAttemptCount) === 3
  && Number(source.successfulResponseCount) === 3
  && Number(source.failedResponseCount) === 0
  && Number(source.responseContainsExpectedMarkerCount) === 3;

const result = {
  phase: "Phase1933P",
  name: "Single Provider Stability Boundary Seal",
  completed: true,
  recommended_sealed: phase1932Passed,
  blocker: phase1932Passed ? null : "phase1932p_provider_test_not_passed",
  sourceEvidencePath: sourcePath,
  phase1932pResultReadable: sourceRead.exists === true && sourceRead.parseError === null,
  phase1932pProviderTestPassed: phase1932Passed,
  providerId: source.providerId ?? "nvidia",
  modelId: source.modelId ?? "nvidia/llama-3.3-nemotron-super-49b-v1",
  credentialRef: source.credentialRef ?? "credentialRef:nvidia:default",
  credentialRefOnly: source.credentialRefOnly === true,
  requestAttemptCount: Number(source.requestAttemptCount ?? 0),
  successfulResponseCount: Number(source.successfulResponseCount ?? 0),
  failedResponseCount: Number(source.failedResponseCount ?? 0),
  singleProviderBoundarySealed: phase1932Passed,
  nvidiaOnlyClaim: true,
  multiProviderStabilityClaimed: false,
  productionReadyClaimed: false,
  publicLaunchReadyClaimed: false,
  commercialReadyClaimed: false,
  providerCallsMadeThisPhase: false,
  rawSecretRead: false,
  secretValueExposed: false,
  authJsonRead: false,
  envDumped: false,
  rawKeyOutput: false,
  authHeaderLogged: false,
  deployExecuted: false,
  releaseExecuted: false,
  tagCreated: false,
  artifactUploaded: false,
  commitCreated: false,
  pushExecuted: false,
  chatGatewayExecuteModified: false,
  legacyModified: false,
  projectContextModified: false,
  workspaceCleanClaimed: false,
  nextRecommendedPhase: "Phase1934P Three-Mode Real Task Closure",
};

writeJson(resultPath, result);
console.log(JSON.stringify(result, null, 2));

if (result.recommended_sealed !== true || result.blocker !== null) {
  process.exitCode = 1;
}
