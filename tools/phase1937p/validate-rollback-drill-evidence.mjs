import { readJson, writeJson, check, allPassed } from "../phase1903a/ownerAutomationSealCommon.mjs";

const resultPath = "apps/ai-gateway-service/evidence/phase1937p/rollback-drill-evidence-result.json";
const validationPath = "apps/ai-gateway-service/evidence/phase1937p/rollback-drill-evidence-validation-result.json";
const read = readJson(resultPath);
const result = read.data ?? {};

const checks = [
  check("result_parseable", read.exists === true && read.parseError === null),
  check("completed_true", result.completed === true),
  check("recommended_sealed_true", result.recommended_sealed === true),
  check("rollback_dry_run_executed", result.rollbackDrillDryRunExecuted === true),
  check("real_rollback_not_executed", result.realRollbackExecuted === false),
  check("rollback_steps_validated", result.rollbackStepsValidated === true),
  check("git_reset_hard_false", result.gitResetHardExecuted === false),
  check("git_clean_false", result.gitCleanExecuted === false),
  check("files_deleted_false", result.filesDeleted === false),
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

const sealed = allPassed(checks);
const validation = {
  phase: "Phase1937P",
  name: "Rollback Drill Evidence Validation",
  completed: true,
  recommended_sealed: sealed,
  blocker: sealed ? null : "phase1937p_validation_failed",
  rollbackDrillDryRunExecuted: result.rollbackDrillDryRunExecuted === true,
  realRollbackExecuted: result.realRollbackExecuted === true,
  rollbackStepsValidated: result.rollbackStepsValidated === true,
  checks,
};

writeJson(validationPath, validation);
console.log(JSON.stringify(validation, null, 2));

if (!sealed) {
  process.exitCode = 1;
}
