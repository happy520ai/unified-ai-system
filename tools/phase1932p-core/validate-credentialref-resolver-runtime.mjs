import { readFileSync } from "node:fs";
import { readJson, writeJson, pathExists, check, allPassed } from "../phase1903a/ownerAutomationSealCommon.mjs";

const corePath = "apps/ai-gateway-service/src/providers/credentialRefResolverRuntime.js";
const contractPath = "apps/ai-gateway-service/src/providers/credentialRefResolverRuntime.contract.js";
const adapterPath = "apps/ai-gateway-service/src/providers/credentialRefProviderRuntimeAdapter.js";
const runnerPath = "tools/phase1932p/run-guarded-real-provider-stability-test.mjs";
const dryRunPath = "apps/ai-gateway-service/evidence/phase1932p-core/credentialref-resolver-runtime-dry-run.json";
const resultPath = "apps/ai-gateway-service/evidence/phase1932p-core/credentialref-resolver-runtime-result.json";
const validationPath = "apps/ai-gateway-service/evidence/phase1932p-core/credentialref-resolver-runtime-validation-result.json";

function readText(path) {
  try {
    return readFileSync(path, "utf8");
  } catch {
    return "";
  }
}

const coreText = readText(corePath);
const contractText = readText(contractPath);
const adapterText = readText(adapterPath);
const runnerText = readText(runnerPath);
const dryRunRead = readJson(dryRunPath);
const resultRead = readJson(resultPath);
const dryRun = dryRunRead.data ?? {};
const result = resultRead.data ?? {};

const forbiddenPatterns = [
  /process\.env\.(NVIDIA|OPENAI|ANTHROPIC|API_KEY)/i,
  /readFileSync\(\s*["']\.env["']\s*\)/i,
  /readFileSync\(\s*["']auth\.json["']\s*\)/i,
  /Authorization:/i,
  /Bearer\s/i,
  /fetch\s*\(/i,
];
const coreForbiddenHits = forbiddenPatterns
  .map((pattern) => pattern.toString())
  .filter((_, index) => forbiddenPatterns[index].test(coreText));

const checks = [
  check("core_file_exists", pathExists(corePath)),
  check("contract_file_exists", pathExists(contractPath)),
  check("core_exports_factory", coreText.includes("createCredentialRefResolverRuntime")),
  check("contract_exports_rules", contractText.includes("CREDENTIAL_REF_RESOLVER_RUNTIME_CONTRACT")),
  check("core_forbidden_patterns_absent", coreForbiddenHits.length === 0, { coreForbiddenHits }),
  check("adapter_uses_resolver_runtime", adapterText.includes("createCredentialRefResolverRuntime")),
  check("runner_uses_resolver_runtime", runnerText.includes("createCredentialRefResolverRuntime")),
  check("dry_run_evidence_parseable", dryRunRead.exists === true && dryRunRead.parseError === null),
  check("result_evidence_parseable", resultRead.exists === true && resultRead.parseError === null),
  check("dry_run_true", dryRun.dryRun === true),
  check("credential_ref_only", dryRun.credentialRefOnly === true && result.credentialRefOnly === true),
  check("resolver_runtime_generated", result.resolverRuntimeGenerated === true),
  check("resolver_runtime_dry_run_passed", result.resolverRuntimeDryRunPassed === true),
  check("provider_calls_made_false", dryRun.providerCallsMade === false && result.providerCallsMade === false),
  check("real_provider_call_executed_false", dryRun.realProviderCallExecuted === false && result.realProviderCallExecutedThisPhase === false),
  check("raw_secret_read_false", dryRun.rawSecretRead === false && result.rawSecretRead === false),
  check("secret_value_exposed_false", result.secretValueExposed === false),
  check("auth_json_read_false", dryRun.authJsonRead === false && result.authJsonRead === false),
  check("env_dumped_false", dryRun.envDumped === false && result.envDumped === false),
  check("raw_key_output_false", dryRun.rawKeyOutput === false && result.rawKeyOutput === false),
  check("auth_header_logged_false", dryRun.authHeaderLogged === false && result.authHeaderLogged === false),
  check("chat_gateway_execute_modified_false", dryRun.chatGatewayExecuteModified === false && result.chatGatewayExecuteModified === false),
  check("legacy_modified_false", result.legacyModified === false),
  check("project_context_modified_false", result.projectContextModified === false),
  check("deploy_release_tag_artifact_false", result.deployExecuted === false && result.releaseExecuted === false && result.tagCreated === false && result.artifactUploaded === false),
  check("commit_push_false", result.commitCreated === false && result.pushExecuted === false),
  check("workspace_clean_claimed_false", result.workspaceCleanClaimed === false),
  check("readiness_claims_false", result.productionReadyClaimed === false && result.publicLaunchReadyClaimed === false && result.commercialReadyClaimed === false),
];

const sealed = allPassed(checks);
const validation = {
  phase: "Phase1932P-Core",
  name: "CredentialRef Resolver Runtime Validation",
  completed: true,
  recommended_sealed: sealed,
  blocker: sealed ? null : "credentialref_resolver_runtime_validation_failed",
  resolverRuntimeGenerated: pathExists(corePath),
  resolverRuntimeContractGenerated: pathExists(contractPath),
  adapterUsesResolverRuntime: adapterText.includes("createCredentialRefResolverRuntime"),
  runnerUsesResolverRuntime: runnerText.includes("createCredentialRefResolverRuntime"),
  resolverRuntimeDryRunPassed: result.resolverRuntimeDryRunPassed === true,
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
