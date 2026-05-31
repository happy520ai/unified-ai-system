import { readFileSync } from "node:fs";
import { readJson, writeJson, pathExists, check, allPassed } from "../phase1903a/ownerAutomationSealCommon.mjs";

const adapterPath = "apps/ai-gateway-service/src/providers/credentialRefProviderRuntimeAdapter.js";
const runnerPath = "tools/phase1932p/run-guarded-real-provider-stability-test.mjs";
const dryRunPath = "apps/ai-gateway-service/evidence/phase1932p-runtime/credentialref-provider-runtime-adapter-dry-run.json";
const resultPath = "apps/ai-gateway-service/evidence/phase1932p-runtime/credentialref-provider-runtime-adapter-result.json";
const validationPath = "apps/ai-gateway-service/evidence/phase1932p-runtime/credentialref-provider-runtime-adapter-validation-result.json";

function readText(path) {
  try {
    return readFileSync(path, "utf8");
  } catch {
    return "";
  }
}

const adapterText = readText(adapterPath);
const runnerText = readText(runnerPath);
const dryRunRead = readJson(dryRunPath);
const resultRead = readJson(resultPath);
const dryRun = dryRunRead.data ?? {};
const result = resultRead.data ?? {};
const dangerousPatterns = [
  "process.env.NVIDIA",
  "process.env.OPENAI",
  "process.env.ANTHROPIC",
  "process.env.API_KEY",
  "readFileSync(\".env\")",
  "readFileSync('.env')",
  "readFileSync(\"auth.json\")",
  "readFileSync('auth.json')",
  "Authorization:",
  "Bearer ",
];
const dangerousHits = dangerousPatterns.filter((pattern) => adapterText.includes(pattern));
const runnerDangerousPatterns = [
  /process\.env\.(NVIDIA|OPENAI|ANTHROPIC|API_KEY)/i,
  /readFileSync\(\s*["']\.env["']\s*\)/i,
  /readFileSync\(\s*["']auth\.json["']\s*\)/i,
  /Authorization:/i,
  /Bearer\s/i,
];
const runnerDangerousHits = runnerDangerousPatterns
  .map((pattern) => pattern.toString())
  .filter((_, index) => runnerDangerousPatterns[index].test(runnerText));

const safeEntryDetected = result.safeRuntimeEntryDetected === true;
const checks = [
  check("adapter_exists", pathExists(adapterPath)),
  check("adapter_dangerous_patterns_absent", dangerousHits.length === 0, { dangerousHits }),
  check("runner_exists", pathExists(runnerPath)),
  check("runner_uses_credentialref_adapter", runnerText.includes("createCredentialRefProviderRuntimeAdapter")),
  check("runner_raw_secret_read_absent", runnerDangerousHits.length === 0, { runnerDangerousHits }),
  check("dry_run_evidence_parseable", dryRunRead.exists === true && dryRunRead.parseError === null),
  check("result_evidence_parseable", resultRead.exists === true && resultRead.parseError === null),
  check("credential_ref_only", result.credentialRefOnly === true && dryRun.credentialRefOnly === true),
  check("real_provider_call_executed_this_phase_false", result.realProviderCallExecutedThisPhase === false),
  check("provider_calls_made_false", result.providerCallsMade === false && dryRun.providerCallsMade === false),
  check("raw_secret_read_false", result.rawSecretRead === false && dryRun.rawSecretRead === false),
  check("secret_value_exposed_false", result.secretValueExposed === false && dryRun.secretValueExposed === false),
  check("auth_json_read_false", result.authJsonRead === false && dryRun.authJsonRead === false),
  check("env_dumped_false", result.envDumped === false && dryRun.envDumped === false),
  check("raw_key_output_false", result.rawKeyOutput === false && dryRun.rawKeyOutput === false),
  check("auth_header_logged_false", result.authHeaderLogged === false && dryRun.authHeaderLogged === false),
  check("deploy_executed_false", result.deployExecuted === false),
  check("release_executed_false", result.releaseExecuted === false),
  check("tag_created_false", result.tagCreated === false),
  check("artifact_uploaded_false", result.artifactUploaded === false),
  check("commit_created_false", result.commitCreated === false),
  check("push_executed_false", result.pushExecuted === false),
  check("chat_gateway_execute_modified_false", result.chatGatewayExecuteModified === false && dryRun.chatGatewayExecuteModified === false),
  check("legacy_modified_false", result.legacyModified === false),
  check("project_context_modified_false", result.projectContextModified === false),
  check("workspace_clean_claimed_false", result.workspaceCleanClaimed === false),
  check("production_ready_claimed_false", result.productionReadyClaimed === false),
  check("public_launch_ready_claimed_false", result.publicLaunchReadyClaimed === false),
  check("commercial_ready_claimed_false", result.commercialReadyClaimed === false),
  check(
    "safe_runtime_entry_branch_valid",
    safeEntryDetected
      ? result.adapterDryRunPassed === true && result.runnerWillBlockIfSafeRuntimeMissing === true
      : result.blocker === "provider_runtime_core_missing" && result.runnerWillBlockIfSafeRuntimeMissing === true,
  ),
];

const sealed = allPassed(checks);
const validation = {
  phase: "Phase1932P-Runtime",
  name: "CredentialRef-Only Provider Runtime Adapter Validation",
  completed: true,
  recommended_sealed: sealed,
  blocker: sealed ? null : "phase1932p_runtime_adapter_validation_failed",
  adapterGenerated: pathExists(adapterPath),
  phase1932pRunnerUpdated: runnerText.includes("createCredentialRefProviderRuntimeAdapter"),
  adapterDryRunExecuted: dryRunRead.exists === true,
  adapterDryRunPassed: result.adapterDryRunPassed === true,
  safeRuntimeEntryDetected: safeEntryDetected,
  safeRuntimeEntryName: result.safeRuntimeEntryName ?? null,
  runnerWillBlockIfSafeRuntimeMissing: result.runnerWillBlockIfSafeRuntimeMissing === true,
  providerCallsMade: false,
  realProviderCallExecutedThisPhase: false,
  rawSecretRead: false,
  secretValueExposed: false,
  authJsonRead: false,
  envDumped: false,
  rawKeyOutput: false,
  authHeaderLogged: false,
  chatGatewayExecuteModified: false,
  legacyModified: false,
  projectContextModified: false,
  workspaceCleanClaimed: false,
  productionReadyClaimed: false,
  publicLaunchReadyClaimed: false,
  commercialReadyClaimed: false,
  checks,
};

writeJson(validationPath, validation);
console.log(JSON.stringify(validation, null, 2));

if (!sealed) {
  process.exitCode = 1;
}
