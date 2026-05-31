import { readFileSync } from "node:fs";
import { readJson, writeJson, pathExists, check, allPassed } from "../phase1903a/ownerAutomationSealCommon.mjs";

const invokerPath = "apps/ai-gateway-service/src/providers/safeProviderExecutionInvoker.js";
const contractPath = "apps/ai-gateway-service/src/providers/safeProviderExecutionInvoker.contract.js";
const adapterPath = "apps/ai-gateway-service/src/providers/credentialRefProviderRuntimeAdapter.js";
const runnerPath = "tools/phase1932p/run-guarded-real-provider-stability-test.mjs";
const dryRunPath = "apps/ai-gateway-service/evidence/phase1932p-invoker/safe-execution-invoker-dry-run.json";
const resultPath = "apps/ai-gateway-service/evidence/phase1932p-invoker/safe-execution-invoker-result.json";
const validationPath = "apps/ai-gateway-service/evidence/phase1932p-invoker/safe-execution-invoker-validation-result.json";

function readText(path) {
  try {
    return readFileSync(path, "utf8");
  } catch {
    return "";
  }
}

const invokerText = readText(invokerPath);
const adapterText = readText(adapterPath);
const runnerText = readText(runnerPath);
const dryRunRead = readJson(dryRunPath);
const resultRead = readJson(resultPath);
const dryRun = dryRunRead.data ?? {};
const result = resultRead.data ?? {};

const dangerousPatterns = [
  /readFileSync\(\s*["']\.env["']\s*\)/i,
  /readFileSync\(\s*["']auth\.json["']\s*\)/i,
  /process\.env\.(NVIDIA|OPENAI|ANTHROPIC|API_KEY)/i,
  /"Authorization:"/,
  /"Bearer\s/,
  /"sk-/,
  /"nvapi-/,
  /"-----BEGIN/,
];

function findDangerousHits(label, text) {
  return dangerousPatterns
    .map((pattern) => `${label}:${pattern.toString()}`)
    .filter((_, index) => dangerousPatterns[index].test(text));
}

const dangerousHits = [
  ...findDangerousHits(invokerPath, invokerText),
  ...findDangerousHits(adapterPath, adapterText),
  ...findDangerousHits(runnerPath, runnerText),
];

const checks = [
  check("invoker_file_exists", pathExists(invokerPath)),
  check("contract_file_exists", pathExists(contractPath)),
  check("adapter_file_exists", pathExists(adapterPath)),
  check("runner_file_exists", pathExists(runnerPath)),
  check("dry_run_evidence_parseable", dryRunRead.exists === true && dryRunRead.parseError === null),
  check("result_evidence_parseable", resultRead.exists === true && resultRead.parseError === null),
  check("dangerous_patterns_absent", dangerousHits.length === 0, { dangerousHits }),
  check("invoker_exports_factory", invokerText.includes("createSafeProviderExecutionInvoker")),
  check("adapter_uses_invoker", adapterText.includes("createSafeProviderExecutionInvoker")),
  check("runner_uses_invoker", runnerText.includes("createSafeProviderExecutionInvoker")),
  check("safe_execution_invoker_generated", result.safeExecutionInvokerGenerated === true),
  check("safe_execution_invoker_dry_run_executed", result.safeExecutionInvokerDryRunExecuted === true && dryRun.dryRun === true),
  check("safe_execution_invoker_ready", result.safeExecutionInvokerReady === true && dryRun.safeExecutionInvokerReady === true),
  check("adapter_updated_to_use_invoker", result.adapterUpdatedToUseInvoker === true),
  check("phase1932p_runner_updated_to_use_invoker", result.phase1932pRunnerUpdatedToUseInvoker === true),
  check("credential_ref_only", result.credentialRefOnly === true && dryRun.credentialRefOnly === true),
  check("real_provider_call_executed_this_phase_false", result.realProviderCallExecutedThisPhase === false && dryRun.realProviderCallExecuted === false),
  check("provider_calls_made_false", result.providerCallsMade === false && dryRun.providerCallsMade === false),
  check("raw_secret_read_false", result.rawSecretRead === false && dryRun.rawSecretRead === false),
  check("secret_value_exposed_false", result.secretValueExposed === false),
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
];

const sealed = allPassed(checks);
const validation = {
  phase: "Phase1932P-Invoker",
  name: "Safe Execution Invoker Validation",
  completed: true,
  recommended_sealed: sealed,
  blocker: sealed ? null : "safe_execution_invoker_validation_failed",
  safeExecutionInvokerGenerated: pathExists(invokerPath),
  safeExecutionInvokerReady: result.safeExecutionInvokerReady === true,
  adapterUpdatedToUseInvoker: result.adapterUpdatedToUseInvoker === true,
  phase1932pRunnerUpdatedToUseInvoker: result.phase1932pRunnerUpdatedToUseInvoker === true,
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
