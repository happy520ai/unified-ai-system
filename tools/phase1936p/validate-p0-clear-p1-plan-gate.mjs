import { readJson, writeJson, check, allPassed } from "../phase1903a/ownerAutomationSealCommon.mjs";

const resultPath = "apps/ai-gateway-service/evidence/phase1936p/p0-clear-p1-plan-gate-result.json";
const validationPath = "apps/ai-gateway-service/evidence/phase1936p/p0-clear-p1-plan-gate-validation-result.json";
const read = readJson(resultPath);
const result = read.data ?? {};
const p0Count = Number(result.p0BlockerCount ?? 0);
const passState = p0Count === 0 && result.recommended_sealed === true && result.blocker === null;
const blockedState = p0Count > 0 && result.recommended_sealed === false && result.blocker === "p0_blockers_remain";

const checks = [
  check("result_parseable", read.exists === true && read.parseError === null),
  check("completed_true", result.completed === true),
  check("supported_state", passState || blockedState, { p0Count, blocker: result.blocker ?? null }),
  check("p0_blocker_count_number", Number.isInteger(p0Count) && p0Count >= 0),
  check("p1_plan_generated", result.p1TreatmentPlanGenerated === true),
  check("p1_items_array", Array.isArray(result.p1Items)),
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

const sealed = allPassed(checks) && passState;
const validation = {
  phase: "Phase1936P",
  name: "P0 Clear / P1 Plan Gate Validation",
  completed: true,
  recommended_sealed: sealed,
  blocker: sealed ? null : (result.blocker ?? "phase1936p_validation_failed"),
  p0BlockerCount: p0Count,
  p1TreatmentPlanGenerated: result.p1TreatmentPlanGenerated === true,
  checks,
};

writeJson(validationPath, validation);
console.log(JSON.stringify(validation, null, 2));

if (!sealed) {
  process.exitCode = 1;
}
