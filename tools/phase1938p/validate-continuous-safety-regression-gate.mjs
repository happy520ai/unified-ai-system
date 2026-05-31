import { readJson, writeJson, check, allPassed } from "../phase1903a/ownerAutomationSealCommon.mjs";

const resultPath = "apps/ai-gateway-service/evidence/phase1938p/continuous-safety-regression-gate-result.json";
const validationPath = "apps/ai-gateway-service/evidence/phase1938p/continuous-safety-regression-gate-validation-result.json";
const read = readJson(resultPath);
const result = read.data ?? {};
const commands = Array.isArray(result.commandResults) ? result.commandResults : [];

const checks = [
  check("result_parseable", read.exists === true && read.parseError === null),
  check("completed_true", result.completed === true),
  check("recommended_sealed_true", result.recommended_sealed === true),
  check("blocker_null", result.blocker === null),
  check("regressions_passed", result.regressionsPassed === true),
  check("four_commands_recorded", commands.length === 4),
  check("all_commands_passed", commands.every((item) => item.passed === true && item.exitCode === 0)),
  check("secret_safety_command_recorded", commands.some((item) => item.command.includes("verify:phase107a-secret-safety") && item.passed === true)),
  check("recovery_command_recorded", commands.some((item) => item.command.includes("verify:phase321a-workbench-product-recovery") && item.passed === true)),
  check("ui_smoke_command_recorded", commands.some((item) => item.command.includes("smoke:phase308a-desktop-workbench-ui") && item.passed === true)),
  check("pnpm_check_command_recorded", commands.some((item) => item.command.includes("pnpm -r --if-present check") && item.passed === true)),
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
  phase: "Phase1938P",
  name: "Continuous Safety Regression Gate Validation",
  completed: true,
  recommended_sealed: sealed,
  blocker: sealed ? null : "phase1938p_validation_failed",
  regressionsPassed: result.regressionsPassed === true,
  checks,
};

writeJson(validationPath, validation);
console.log(JSON.stringify(validation, null, 2));

if (!sealed) {
  process.exitCode = 1;
}
