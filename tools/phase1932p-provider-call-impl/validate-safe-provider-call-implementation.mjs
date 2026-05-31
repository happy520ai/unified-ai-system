import { readFileSync } from "node:fs";
import { readJson, writeJson, pathExists, check, allPassed } from "../phase1903a/ownerAutomationSealCommon.mjs";

const implementationPath = "apps/ai-gateway-service/src/providers/safeProviderCallImplementation.js";
const implementationContractPath = "apps/ai-gateway-service/src/providers/safeProviderCallImplementation.contract.js";
const invokerPath = "apps/ai-gateway-service/src/providers/safeProviderExecutionInvoker.js";
const adapterPath = "apps/ai-gateway-service/src/providers/credentialRefProviderRuntimeAdapter.js";
const runnerPath = "tools/phase1932p/run-guarded-real-provider-stability-test.mjs";
const dryRunPath = "apps/ai-gateway-service/evidence/phase1932p-provider-call-impl/safe-provider-call-implementation-dry-run.json";
const resultPath = "apps/ai-gateway-service/evidence/phase1932p-provider-call-impl/safe-provider-call-implementation-result.json";
const validationPath = "apps/ai-gateway-service/evidence/phase1932p-provider-call-impl/safe-provider-call-implementation-validation-result.json";

function readText(path) {
  try {
    return readFileSync(path, "utf8");
  } catch {
    return "";
  }
}

const implementationText = readText(implementationPath);
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
  ...findDangerousHits(implementationPath, implementationText),
  ...findDangerousHits(invokerPath, invokerText),
  ...findDangerousHits(adapterPath, adapterText),
  ...findDangerousHits(runnerPath, runnerText),
];

const checks = [
  check("safe_provider_call_implementation_exists", pathExists(implementationPath)),
  check("safe_provider_call_implementation_contract_exists", pathExists(implementationContractPath)),
  check("safe_provider_execution_invoker_exists", pathExists(invokerPath)),
  check("credential_ref_adapter_exists", pathExists(adapterPath)),
  check("phase1932p_runner_exists", pathExists(runnerPath)),
  check("dry_run_evidence_parseable", dryRunRead.exists === true && dryRunRead.parseError === null),
  check("result_evidence_parseable", resultRead.exists === true && resultRead.parseError === null),
  check("dangerous_patterns_absent", dangerousHits.length === 0, { dangerousHits }),
  check("implementation_exports_factory", implementationText.includes("createSafeProviderCallImplementation")),
  check("implementation_has_validate_method", implementationText.includes("validateProviderCallRequest")),
  check("implementation_has_dry_run_method", implementationText.includes("runProviderCallDryRun")),
  check("implementation_has_execute_method", implementationText.includes("executeProviderCall")),
  check("invoker_uses_provider_call_implementation", invokerText.includes("createSafeProviderCallImplementation")),
  check("invoker_calls_provider_call_dry_run", invokerText.includes("runProviderCallDryRun")),
  check("invoker_calls_provider_call_execute", invokerText.includes("executeProviderCall")),
  check("adapter_still_uses_invoker", adapterText.includes("createSafeProviderExecutionInvoker")),
  check("runner_checks_provider_call_implementation_ready", runnerText.includes("providerCallImplementationReady")),
  check("safe_provider_call_implementation_generated", result.safeProviderCallImplementationGenerated === true),
  check("safe_provider_call_implementation_dry_run_executed", result.safeProviderCallImplementationDryRunExecuted === true && dryRun.dryRun === true),
  check("provider_call_implementation_ready", result.providerCallImplementationReady === true && dryRun.providerCallImplementationReady === true),
  check(
    "safe_execution_invoker_updated_to_use_provider_call_implementation",
    result.safeExecutionInvokerUpdatedToUseProviderCallImplementation === true,
  ),
  check("phase1932p_runner_updated_to_check_provider_call_implementation", result.phase1932pRunnerUpdatedToCheckProviderCallImplementation === true),
  check("safe_execution_invoker_ready", dryRun.safeExecutionInvokerReady === true),
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
  phase: "Phase1932P-ProviderCallImpl",
  name: "Safe Provider Call Implementation Validation",
  completed: true,
  recommended_sealed: sealed,
  blocker: sealed ? null : "safe_provider_call_implementation_validation_failed",
  safeProviderCallImplementationGenerated: pathExists(implementationPath),
  providerCallImplementationReady: result.providerCallImplementationReady === true,
  safeExecutionInvokerUpdatedToUseProviderCallImplementation: result.safeExecutionInvokerUpdatedToUseProviderCallImplementation === true,
  phase1932pRunnerUpdatedToCheckProviderCallImplementation: result.phase1932pRunnerUpdatedToCheckProviderCallImplementation === true,
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
