import { readFileSync } from "node:fs";
import { readJson, writeJson, pathExists, check, allPassed } from "../phase1903a/ownerAutomationSealCommon.mjs";

const sourceFiles = [
  "apps/ai-gateway-service/src/providers/safeInternalProviderExecutor.js",
  "apps/ai-gateway-service/src/providers/safeInternalProviderExecutor.contract.js",
  "apps/ai-gateway-service/src/providers/providerExecutionAuthorizationGate.js",
  "apps/ai-gateway-service/src/providers/providerExecutionAuthorizationSchema.js",
  "apps/ai-gateway-service/src/providers/safeProviderRequestEnvelope.js",
  "apps/ai-gateway-service/src/providers/safeProviderResponseSanitizer.js",
  "apps/ai-gateway-service/src/providers/safeProviderExecutorTestAdapter.js",
];
const docsFiles = [
  "docs/phase1954p-real-safe-provider-executor-bridge.md",
  "docs/phase1954p-provider-executor-secret-boundary.md",
  "docs/phase1954p-phase1955p-rerun-readiness.md",
];
const runnerPath = "tools/phase1954p/run-real-safe-provider-executor-bridge-check.mjs";
const bridgePath = "apps/ai-gateway-service/evidence/phase1954p/real-safe-provider-executor-bridge-result.json";
const secretBoundaryPath = "apps/ai-gateway-service/evidence/phase1954p/provider-executor-secret-boundary-result.json";
const readinessPath = "apps/ai-gateway-service/evidence/phase1954p/phase1955p-rerun-readiness-result.json";
const sealPath = "apps/ai-gateway-service/evidence/phase1954p/phase1954p-seal-result.json";
const validationPath = "apps/ai-gateway-service/evidence/phase1954p/phase1954p-validation-result.json";

const forbidden = [
  { id: "nvidia_env_key", pattern: /process\.env\.NVIDIA_API_KEY/u },
  { id: "openai_env_key", pattern: /process\.env\.OPENAI_API_KEY/u },
  { id: "dot_env_read", pattern: /readFileSync\(\s*["']\.env["']\s*\)/iu },
  { id: "auth_json_read", pattern: /readFileSync\(\s*["']auth\.json["']\s*\)/iu },
  { id: "authorization_bearer_literal", pattern: /Authorization:\s*Bearer/u },
  { id: "raw_api_key_identifier", pattern: /\bapiKey\b/u },
  { id: "secret_value_identifier", pattern: /\bsecretValue\b/u },
];

function readText(path) {
  try {
    return readFileSync(path, "utf8");
  } catch {
    return "";
  }
}

function findHits(path) {
  const text = readText(path);
  return forbidden.filter((item) => item.pattern.test(text)).map((item) => ({ file: path, pattern: item.id }));
}

const bridgeRead = readJson(bridgePath);
const secretRead = readJson(secretBoundaryPath);
const readinessRead = readJson(readinessPath);
const sealRead = readJson(sealPath);
const bridge = bridgeRead.data ?? {};
const secret = secretRead.data ?? {};
const readiness = readinessRead.data ?? {};
const seal = sealRead.data ?? {};
const sourceHits = sourceFiles.flatMap(findHits);
const executorText = readText(sourceFiles[0]);

const checks = [
  ...sourceFiles.map((file) => check(`source_exists:${file}`, pathExists(file))),
  ...docsFiles.map((file) => check(`doc_exists:${file}`, pathExists(file))),
  check("runner_exists", pathExists(runnerPath)),
  check("bridge_evidence_parseable", bridgeRead.exists === true && bridgeRead.parseError === null),
  check("secret_boundary_evidence_parseable", secretRead.exists === true && secretRead.parseError === null),
  check("readiness_evidence_parseable", readinessRead.exists === true && readinessRead.parseError === null),
  check("seal_evidence_parseable", sealRead.exists === true && sealRead.parseError === null),
  check("forbidden_source_patterns_absent", sourceHits.length === 0, { sourceHits }),
  check("executor_has_execute_method", executorText.includes("async function execute(")),
  check("executor_no_stub_blocker", !executorText.includes("phase1951_design_only_provider_call_not_authorized")),
  check("completed_true", seal.completed === true),
  check("recommended_sealed_true", seal.recommended_sealed === true),
  check("blocker_null", seal.blocker === null),
  check("real_bridge_ready", seal.realSafeProviderExecutorBridgeReady === true),
  check("safe_internal_provider_executor_still_stub_false", seal.safeInternalProviderExecutorStillStub === false),
  check("provider_call_implementation_mode_real_bridge", seal.providerCallImplementationMode === "real_bridge"),
  check("synthetic_adapter_used", seal.syntheticAdapterUsed === true && bridge.syntheticAdapterUsed === true),
  check("provider_calls_made_false", seal.providerCallsMade === false),
  check("real_provider_network_attempted_false", seal.realProviderNetworkAttempted === false),
  check("request_attempt_count_zero", seal.requestAttemptCount === 0),
  check("credential_ref_only", seal.credentialRefOnly === true),
  check("raw_secret_accepted_false", seal.rawSecretAccepted === false),
  check("raw_secret_read_false", seal.rawSecretRead === false && secret.rawSecretRead === false),
  check("auth_json_read_false", seal.authJsonRead === false && secret.authJsonRead === false),
  check("dot_env_read_false", seal.dotEnvRead === false && secret.dotEnvRead === false),
  check("env_dumped_false", seal.envDumped === false),
  check("secret_value_exposed_false", seal.secretValueExposed === false),
  check("authorization_header_logged_false", seal.authorizationHeaderLogged === false),
  check("request_envelope_normalized", seal.requestEnvelopeNormalized === true && bridge.requestEnvelopeNormalized === true),
  check("response_sanitized", seal.responseSanitized === true && bridge.responseSanitized === true),
  check("max_requests_gate_enforced", seal.maxRequestsGateEnforced === true),
  check("budget_gate_enforced", seal.budgetGateEnforced === true),
  check("timeout_gate_enforced", seal.timeoutGateEnforced === true),
  check("provider_allowlist_enforced", seal.providerAllowlistEnforced === true),
  check("model_allowlist_enforced", seal.modelAllowlistEnforced === true),
  check("chat_route_modified_false", seal.chatRouteModified === false),
  check("chat_gateway_execute_modified_false", seal.chatGatewayExecuteModified === false),
  check("legacy_modified_false", seal.legacyModified === false),
  check("project_context_modified_false", seal.projectContextModified === false),
  check("deploy_release_tag_artifact_false", seal.deployExecuted === false && seal.releaseExecuted === false && seal.tagCreated === false && seal.artifactUploaded === false),
  check("commit_push_false", seal.commitCreated === false && seal.pushExecuted === false),
  check("provider_stability_verified_false", seal.providerStabilityVerified === false),
  check("one_shot_provider_call_passed_false", seal.oneShotProviderCallPassed === false),
  check("phase1955p_rerun_ready", seal.phase1955pRerunReady === true && readiness.phase1955pRerunReady === true),
];

const sealed = allPassed(checks);
const validation = {
  phase: "Phase1954P",
  name: "Real Safe Internal Provider Executor Bridge Verification",
  completed: true,
  recommended_sealed: sealed,
  blocker: sealed ? null : "phase1954p_real_safe_provider_executor_bridge_verification_failed",
  realSafeProviderExecutorBridgeReady: seal.realSafeProviderExecutorBridgeReady === true,
  safeInternalProviderExecutorStillStub: seal.safeInternalProviderExecutorStillStub !== false,
  providerCallImplementationMode: seal.providerCallImplementationMode ?? null,
  syntheticAdapterUsed: seal.syntheticAdapterUsed === true,
  providerCallsMade: seal.providerCallsMade === true,
  realProviderNetworkAttempted: seal.realProviderNetworkAttempted === true,
  phase1955pRerunReady: seal.phase1955pRerunReady === true,
  checks,
};

writeJson(validationPath, validation);
console.log(JSON.stringify(validation, null, 2));

if (!sealed) {
  process.exitCode = 1;
}
