import { readFileSync } from "node:fs";
import { readJson, writeJson, pathExists, check, allPassed } from "../phase1903a/ownerAutomationSealCommon.mjs";

const sourceFiles = [
  "apps/ai-gateway-service/src/providers/safeInternalProviderExecutor.js",
  "apps/ai-gateway-service/src/providers/safeInternalProviderExecutor.contract.js",
  "apps/ai-gateway-service/src/providers/providerExecutionAuthorizationGate.js",
  "apps/ai-gateway-service/src/providers/providerExecutionAuthorizationSchema.js",
];
const docsFiles = [
  "docs/phase1951p-safe-internal-provider-executor-authorization.md",
  "docs/phase1951p-provider-execution-boundary.md",
];
const runnerPath = "tools/phase1951p/run-safe-internal-provider-executor-authorization.mjs";
const resultPath =
  "apps/ai-gateway-service/evidence/phase1951p/safe-internal-provider-executor-authorization-result.json";
const boundaryPath = "apps/ai-gateway-service/evidence/phase1951p/provider-execution-boundary-result.json";
const validationPath =
  "apps/ai-gateway-service/evidence/phase1951p/safe-internal-provider-executor-authorization-validation-result.json";

const dangerousPatternSpecs = [
  { id: "dot_env_read", pattern: /readFileSync\(\s*["']\.env["']\s*\)/iu },
  { id: "auth_json_read", pattern: /readFileSync\(\s*["']auth\.json["']\s*\)/iu },
  { id: "provider_env_read", pattern: /process\.env\.(NVIDIA|OPENAI|ANTHROPIC|API_KEY)/iu },
  { id: "authorization_header_literal", pattern: /["']Authorization:["']/u },
  { id: "bearer_literal", pattern: /["']Bearer\s/u },
  { id: "sk_literal", pattern: /["']sk-/u },
  { id: "nvapi_literal", pattern: /["']nvapi-/iu },
  { id: "private_key_marker_literal", pattern: /["']-----BEGIN/u },
];

function readText(path) {
  try {
    return readFileSync(path, "utf8");
  } catch {
    return "";
  }
}

function findDangerousHits(path) {
  const text = readText(path);
  return dangerousPatternSpecs
    .filter((spec) => spec.pattern.test(text))
    .map((spec) => ({ file: path, pattern: spec.id }));
}

const sourceHits = sourceFiles.flatMap(findDangerousHits);
const runnerHits = findDangerousHits(runnerPath);
const executorText = readText(sourceFiles[0]);
const gateText = readText(sourceFiles[2]);
const resultRead = readJson(resultPath);
const boundaryRead = readJson(boundaryPath);
const result = resultRead.data ?? {};
const boundary = boundaryRead.data ?? {};

const checks = [
  ...sourceFiles.map((file) => check(`source_exists:${file}`, pathExists(file))),
  ...docsFiles.map((file) => check(`doc_exists:${file}`, pathExists(file))),
  check("runner_exists", pathExists(runnerPath)),
  check("result_evidence_parseable", resultRead.exists === true && resultRead.parseError === null),
  check("boundary_evidence_parseable", boundaryRead.exists === true && boundaryRead.parseError === null),
  check("dangerous_patterns_absent_in_sources", sourceHits.length === 0, { sourceHits }),
  check("dangerous_patterns_absent_in_runner", runnerHits.length === 0, { runnerHits }),
  check("executor_exports_factory", executorText.includes("createSafeInternalProviderExecutor")),
  check("executor_has_validate_method", executorText.includes("validateExecutionRequest")),
  check("executor_has_dry_run_method", executorText.includes("runDryRun")),
  check("executor_has_blocked_execute_method", executorText.includes("executeProvider")),
  check("gate_validates_authorization", gateText.includes("validateProviderExecutionAuthorization")),
  check("completed_true", result.completed === true),
  check("recommended_sealed_true", result.recommended_sealed === true),
  check("blocker_null", result.blocker === null),
  check("safe_internal_provider_executor_ready", result.safeInternalProviderExecutorReady === true),
  check("safe_provider_call_implementation_prepared", result.safeProviderCallImplementationPrepared === true),
  check("provider_call_implementation_mode_dry_run_stub", result.providerCallImplementationMode === "dry_run_stub"),
  check("allow_provider_call_false", result.allowProviderCall === false),
  check("request_attempt_count_zero", result.requestAttemptCount === 0),
  check("provider_calls_made_false", result.providerCallsMade === false),
  check("credential_ref_required_true", result.credentialRefRequired === true),
  check("raw_secret_accepted_false", result.rawSecretAccepted === false),
  check("raw_secret_read_false", result.rawSecretRead === false),
  check("auth_json_read_false", result.authJsonRead === false),
  check("env_dumped_false", result.envDumped === false),
  check("secret_value_exposed_false", result.secretValueExposed === false),
  check("chat_route_modified_false", result.chatRouteModified === false),
  check("chat_gateway_execute_modified_false", result.chatGatewayExecuteModified === false),
  check("deploy_executed_false", result.deployExecuted === false),
  check("release_executed_false", result.releaseExecuted === false),
  check("tag_created_false", result.tagCreated === false),
  check("artifact_uploaded_false", result.artifactUploaded === false),
  check("commit_push_false", result.commitCreated === false && result.pushExecuted === false),
  check("provider_stability_verified_false", result.providerStabilityVerified === false),
  check("provider_stability_not_verified_preserved", result.providerStabilityNotVerifiedPreserved === true),
  check("readiness_claims_false", result.productionReadyClaimed === false && result.publicLaunchReadyClaimed === false && result.commercialReadyClaimed === false),
  check("workspace_clean_claimed_false", result.workspaceCleanClaimed === false),
  check("boundary_completed_true", boundary.completed === true),
  check("boundary_sealed_true", boundary.recommended_sealed === true),
  check("boundary_provider_calls_false", boundary.providerCallsMade === false),
  check("boundary_provider_stability_preserved", boundary.providerStabilityBlockerPreserved === "provider_stability_not_verified"),
];

const sealed = allPassed(checks);
const validation = {
  phase: "Phase1951P",
  name: "Safe Internal Provider Executor Authorization Verification",
  completed: true,
  recommended_sealed: sealed,
  blocker: sealed ? null : "phase1951p_safe_internal_provider_executor_verification_failed",
  safeInternalProviderExecutorReady: result.safeInternalProviderExecutorReady === true,
  safeProviderCallImplementationPrepared: result.safeProviderCallImplementationPrepared === true,
  providerCallImplementationMode: result.providerCallImplementationMode ?? null,
  requestAttemptCount: result.requestAttemptCount ?? null,
  providerCallsMade: result.providerCallsMade === true,
  providerStabilityVerified: result.providerStabilityVerified === true,
  providerStabilityNotVerifiedPreserved: result.providerStabilityNotVerifiedPreserved === true,
  checks,
};

writeJson(validationPath, validation);
console.log(JSON.stringify(validation, null, 2));

if (!sealed) {
  process.exitCode = 1;
}
