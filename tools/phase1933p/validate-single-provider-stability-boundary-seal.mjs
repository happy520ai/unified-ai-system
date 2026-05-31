import { readJson, writeJson, check, allPassed } from "../phase1903a/ownerAutomationSealCommon.mjs";

const resultPath = "apps/ai-gateway-service/evidence/phase1933p/single-provider-stability-boundary-seal-result.json";
const validationPath = "apps/ai-gateway-service/evidence/phase1933p/single-provider-stability-boundary-seal-validation-result.json";
const read = readJson(resultPath);
const result = read.data ?? {};
const passedState = result.phase1932pProviderTestPassed === true
  && result.recommended_sealed === true
  && result.blocker === null;
const blockedState = result.phase1932pProviderTestPassed === false
  && result.recommended_sealed === false
  && result.blocker === "phase1932p_provider_test_not_passed";

const checks = [
  check("result_parseable", read.exists === true && read.parseError === null),
  check("completed_true", result.completed === true),
  check("supported_state", passedState || blockedState, { passedState, blockedState, blocker: result.blocker ?? null }),
  check("provider_id_nvidia", result.providerId === "nvidia"),
  check("model_id_scoped", result.modelId === "nvidia/llama-3.3-nemotron-super-49b-v1"),
  check("credential_ref_only", result.credentialRefOnly === true),
  check("nvidia_only_claim", result.nvidiaOnlyClaim === true),
  check("multi_provider_stability_not_claimed", result.multiProviderStabilityClaimed === false),
  check("provider_calls_made_this_phase_false", result.providerCallsMadeThisPhase === false),
  check("raw_secret_read_false", result.rawSecretRead === false),
  check("secret_value_exposed_false", result.secretValueExposed === false),
  check("auth_json_read_false", result.authJsonRead === false),
  check("env_dumped_false", result.envDumped === false),
  check("raw_key_output_false", result.rawKeyOutput === false),
  check("auth_header_logged_false", result.authHeaderLogged === false),
  check("deploy_release_tag_artifact_false", result.deployExecuted === false && result.releaseExecuted === false && result.tagCreated === false && result.artifactUploaded === false),
  check("commit_push_false", result.commitCreated === false && result.pushExecuted === false),
  check("chat_gateway_execute_modified_false", result.chatGatewayExecuteModified === false),
  check("legacy_project_context_false", result.legacyModified === false && result.projectContextModified === false),
  check("workspace_clean_claimed_false", result.workspaceCleanClaimed === false),
  check("readiness_claims_false", result.productionReadyClaimed === false && result.publicLaunchReadyClaimed === false && result.commercialReadyClaimed === false),
];

const sealed = allPassed(checks) && passedState;
const validation = {
  phase: "Phase1933P",
  name: "Single Provider Stability Boundary Seal Validation",
  completed: true,
  recommended_sealed: sealed,
  blocker: sealed ? null : (result.blocker ?? "phase1933p_validation_failed"),
  phase1932pProviderTestPassed: result.phase1932pProviderTestPassed === true,
  singleProviderBoundarySealed: result.singleProviderBoundarySealed === true,
  providerId: result.providerId ?? null,
  modelId: result.modelId ?? null,
  credentialRefOnly: result.credentialRefOnly === true,
  multiProviderStabilityClaimed: result.multiProviderStabilityClaimed === true,
  productionReadyClaimed: result.productionReadyClaimed === true,
  checks,
};

writeJson(validationPath, validation);
console.log(JSON.stringify(validation, null, 2));

if (validation.recommended_sealed !== true || validation.blocker !== null) {
  process.exitCode = 1;
}
