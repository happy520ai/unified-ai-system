import { execFileSync } from "node:child_process";
import { readJson, writeJson, pathExists, check, allPassed } from "../phase1903a/ownerAutomationSealCommon.mjs";

const runnerPath = "tools/phase1932p/run-guarded-real-provider-stability-test.mjs";
const verifierPath = "tools/phase1932p/validate-guarded-real-provider-stability-test.mjs";
const prepVerifierPath = "tools/phase1932p-prep/validate-guarded-provider-runtime-entry-preparation.mjs";
const evidencePath = "apps/ai-gateway-service/evidence/phase1932p-prep/guarded-provider-runtime-entry-preparation-result.json";
const packageRead = readJson("package.json");
const evidenceRead = readJson(evidencePath);
const evidence = evidenceRead.data ?? {};

function nodeCheck(relativePath) {
  try {
    execFileSync("node", ["--check", relativePath], { stdio: "pipe" });
    return true;
  } catch {
    return false;
  }
}

const scripts = packageRead.data?.scripts ?? {};
const checks = [
  check("runner_exists", pathExists(runnerPath)),
  check("verifier_exists", pathExists(verifierPath)),
  check("runner_node_check", nodeCheck(runnerPath)),
  check("verifier_node_check", nodeCheck(verifierPath)),
  check("prep_verifier_node_check", nodeCheck(prepVerifierPath)),
  check(
    "run_script_present",
    scripts["run:phase1932p-guarded-provider-stability-test"] ===
      "node tools/phase1932p/run-guarded-real-provider-stability-test.mjs",
  ),
  check(
    "verify_script_present",
    scripts["verify:phase1932p-guarded-provider-stability-test"] ===
      "node tools/phase1932p/validate-guarded-real-provider-stability-test.mjs",
  ),
  check(
    "prep_verify_script_present",
    scripts["verify:phase1932p-prep-guarded-runtime-entry"] ===
      "node tools/phase1932p-prep/validate-guarded-provider-runtime-entry-preparation.mjs",
  ),
  check("prep_evidence_parseable", evidenceRead.exists === true && evidenceRead.parseError === null),
  check("real_provider_call_executed_this_phase_false", evidence.realProviderCallExecutedThisPhase === false),
  check("provider_calls_made_false", evidence.providerCallsMade === false),
  check("raw_secret_read_false", evidence.rawSecretRead === false),
  check("secret_value_exposed_false", evidence.secretValueExposed === false),
  check("auth_json_read_false", evidence.authJsonRead === false),
  check("env_dumped_false", evidence.envDumped === false),
  check("raw_key_output_false", evidence.rawKeyOutput === false),
  check("auth_header_logged_false", evidence.authHeaderLogged === false),
  check("chat_gateway_execute_modified_false", evidence.chatGatewayExecuteModified === false),
  check("legacy_modified_false", evidence.legacyModified === false),
  check("project_context_modified_false", evidence.projectContextModified === false),
  check("production_ready_claimed_false", evidence.productionReadyClaimed === false),
  check("public_launch_ready_claimed_false", evidence.publicLaunchReadyClaimed === false),
  check("commercial_ready_claimed_false", evidence.commercialReadyClaimed === false),
];

const sealed = allPassed(checks);
const result = {
  phase: "Phase1932P-Prep",
  name: "Guarded Provider Runtime Entry Preparation Validation",
  completed: true,
  recommended_sealed: sealed,
  blocker: sealed ? null : "phase1932p_prep_validation_failed",
  phase1932pRunnerGenerated: pathExists(runnerPath),
  phase1932pVerifierGenerated: pathExists(verifierPath),
  packageScriptsAdded: checks.find((item) => item.id === "run_script_present")?.passed === true
    && checks.find((item) => item.id === "verify_script_present")?.passed === true
    && checks.find((item) => item.id === "prep_verify_script_present")?.passed === true,
  safeRuntimeEntryDetected: evidence.safeRuntimeEntryDetected === true,
  safeRuntimeEntryName: evidence.safeRuntimeEntryName ?? null,
  realProviderCallExecutedThisPhase: false,
  providerCallsMade: false,
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
  productionReadyClaimed: false,
  publicLaunchReadyClaimed: false,
  commercialReadyClaimed: false,
  checks,
};

writeJson("apps/ai-gateway-service/evidence/phase1932p-prep/guarded-provider-runtime-entry-preparation-validation-result.json", result);
console.log(JSON.stringify(result, null, 2));

if (!sealed) {
  process.exitCode = 1;
}
