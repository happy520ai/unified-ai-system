import { readJson, writeJson, check, allPassed } from "../phase1903a/ownerAutomationSealCommon.mjs";

const resultPath = "apps/ai-gateway-service/evidence/phase1940p/production-grade-evidence-final-gate-result.json";
const validationPath = "apps/ai-gateway-service/evidence/phase1940p/production-grade-evidence-final-gate-validation-result.json";
const read = readJson(resultPath);
const result = read.data ?? {};
const criteria = result.criteria ?? {};
const blocker = result.blocker ?? null;

const passState = result.recommended_sealed === true
  && blocker === null
  && result.claimLevel === "local_production_candidate"
  && Object.values(criteria).every((value) => value === true);

const blockedState = result.recommended_sealed === false
  && result.claimLevel === "blocked_evidence_closure"
  && [
    "provider_stability_not_verified",
    "owner_pilot_records_missing",
    "p0_blockers_remain",
    "owner_understanding_not_yet_proven",
    "production_grade_evidence_incomplete",
  ].includes(blocker);

const checks = [
  check("result_parseable", read.exists === true && read.parseError === null),
  check("completed_true", result.completed === true),
  check("supported_state", passState || blockedState, { blocker, claimLevel: result.claimLevel ?? null }),
  check("criteria_object_present", typeof criteria === "object" && criteria !== null),
  check("provider_request_count_safe", Number(result.requestAttemptCount ?? 0) >= 0 && Number(result.requestAttemptCount ?? 0) <= 3),
  check("credential_provider_scoped", result.providerId === "nvidia" && result.modelId === "nvidia/llama-3.3-nemotron-super-49b-v1"),
  check("public_production_not_claimed", result.publicProductionReadyClaimed === false),
  check("multi_provider_production_stable_not_claimed", result.multiProviderProductionStableClaimed === false),
  check("commercial_ready_not_claimed", result.commercialReadyClaimed === false),
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

const validationSealed = allPassed(checks) && passState;
const validation = {
  phase: "Phase1940P",
  name: "Production-Grade Evidence Final Gate Validation",
  completed: true,
  recommended_sealed: validationSealed,
  blocker: validationSealed ? null : (blocker ?? "phase1940p_validation_failed"),
  claimLevel: result.claimLevel ?? null,
  criteria,
  checks,
};

writeJson(validationPath, validation);
console.log(JSON.stringify(validation, null, 2));

if (!validationSealed) {
  process.exitCode = 1;
}
