import { readFileSync } from "node:fs";
import { allPassed, check, pathExists, readJson } from "../phase1903a/ownerAutomationSealCommon.mjs";

const phase = "Phase1956P-NVIDIA-Route-Repair";
const evidenceDir = "apps/ai-gateway-service/evidence/phase1956p_nvidia_route_repair";
const diagnosisPath = `${evidenceDir}/nvidia-route-diagnosis-result.json`;
const envelopePath = `${evidenceDir}/request-envelope-audit-result.json`;
const timeoutPath = `${evidenceDir}/timeout-handling-audit-result.json`;
const modelPath = `${evidenceDir}/model-compatibility-dry-run-result.json`;
const sealPath = `${evidenceDir}/phase1956p-seal-result.json`;
const previousClosurePath = "apps/ai-gateway-service/evidence/phase1955p_retry_fail/phase1955p-retry-fail-seal-result.json";
const previousGatePath = "apps/ai-gateway-service/evidence/phase1955p_retry_fail/alternative-provider-decision-gate-result.json";

const requiredFiles = [
  "tools/phase1956p_nvidia_route_repair/diagnose-nvidia-route-without-provider-call.mjs",
  "tools/phase1956p_nvidia_route_repair/verify-nvidia-route-repair-diagnosis.mjs",
  "docs/phase1956p-nvidia-route-repair-diagnosis.md",
  "docs/phase1956p-nvidia-request-envelope-audit.md",
  "docs/phase1956p-nvidia-timeout-handling-audit.md",
  "docs/phase1956p-nvidia-model-compatibility-dry-run.md",
  "docs/phase1956p-next-retry-readiness-gate.md",
  diagnosisPath,
  envelopePath,
  timeoutPath,
  modelPath,
  sealPath,
  previousClosurePath,
  previousGatePath,
  "apps/ai-gateway-service/src/providers/safeInternalProviderExecutor.js",
  "apps/ai-gateway-service/src/providers/safeProviderRequestEnvelope.js",
  "apps/ai-gateway-service/src/providers/safeProviderResponseSanitizer.js",
  "apps/ai-gateway-service/src/providers/providerExecutionAuthorizationGate.js",
  "apps/ai-gateway-service/src/providers/providerExecutionAuthorizationSchema.js",
  "apps/ai-gateway-service/src/providers/nvidia/nvidiaUnifiedClient.js",
  "apps/ai-gateway-service/src/providers/nvidiaAdapter.js",
];

function readText(relativePath) {
  try {
    return readFileSync(relativePath, "utf8");
  } catch {
    return "";
  }
}

function findForbiddenRuntimeHits(relativePath) {
  const text = readText(relativePath);
  const checks = [
    { id: "direct_fetch_call", pattern: /\bfetch\s*\(/u },
    { id: "process_env_dump", pattern: /process\.env/u },
    { id: "dot_env_exact_read", pattern: /readFileSync\(\s*["']\.env["']\s*\)/u },
    { id: "auth_json_exact_read", pattern: /readFileSync\([^)]*auth\.json/u },
    { id: "dynamic_eval", pattern: /\beval\s*\(|new\s+Function\s*\(|vm\.runIn/u },
    { id: "process_spawner", pattern: new RegExp(["node:", "child_", "process"].join(""), "u") },
    { id: "exec_file_call", pattern: /\bexecFile\s*\(/u },
    { id: "spawn_call", pattern: /\bspawn\s*\(/u },
    { id: "bearer_literal", pattern: /Bearer\s+[A-Za-z0-9._-]+/u },
  ];
  return checks.filter((item) => item.pattern.test(text)).map((item) => ({ file: relativePath, pattern: item.id }));
}

function safetyChecks(record, prefix) {
  return [
    check(`${prefix}_new_provider_call_false`, record.newProviderCallExecuted === false),
    check(`${prefix}_provider_calls_made_false`, record.providerCallsMade === false),
    check(`${prefix}_request_attempt_this_phase_zero`, Number(record.requestAttemptCountInThisPhase ?? -1) === 0),
    check(`${prefix}_raw_secret_read_false`, record.rawSecretRead === false),
    check(`${prefix}_auth_json_read_false`, record.authJsonRead === false),
    check(`${prefix}_dot_env_read_false`, record.dotEnvRead === false),
    check(`${prefix}_env_dumped_false`, record.envDumped === false),
    check(`${prefix}_secret_value_exposed_false`, record.secretValueExposed === false),
    check(`${prefix}_authorization_header_logged_false`, record.authorizationHeaderLogged === false),
    check(`${prefix}_chat_route_modified_false`, record.chatRouteModified === false),
    check(`${prefix}_chat_gateway_execute_modified_false`, record.chatGatewayExecuteModified === false),
    check(`${prefix}_legacy_modified_false`, record.legacyModified === false),
    check(`${prefix}_project_context_modified_false`, record.projectContextModified === false),
    check(`${prefix}_deploy_false`, record.deployExecuted === false),
    check(`${prefix}_release_false`, record.releaseExecuted === false),
    check(`${prefix}_tag_false`, record.tagCreated === false),
    check(`${prefix}_artifact_false`, record.artifactUploaded === false),
    check(`${prefix}_commit_false`, record.commitCreated === false),
    check(`${prefix}_push_false`, record.pushExecuted === false),
    check(`${prefix}_production_ready_claimed_false`, record.productionReadyClaimed === false),
    check(`${prefix}_commercial_ready_claimed_false`, record.commercialReadyClaimed === false),
    check(`${prefix}_workspace_clean_claimed_false`, record.workspaceCleanClaimed === false),
  ];
}

const diagnosisRead = readJson(diagnosisPath);
const envelopeRead = readJson(envelopePath);
const timeoutRead = readJson(timeoutPath);
const modelRead = readJson(modelPath);
const sealRead = readJson(sealPath);
const previousClosureRead = readJson(previousClosurePath);
const previousGateRead = readJson(previousGatePath);

const diagnosis = diagnosisRead.data ?? {};
const envelope = envelopeRead.data ?? {};
const timeout = timeoutRead.data ?? {};
const model = modelRead.data ?? {};
const seal = sealRead.data ?? {};
const previousClosure = previousClosureRead.data ?? {};
const previousGate = previousGateRead.data ?? {};

const runtimeHits = [
  "tools/phase1956p_nvidia_route_repair/diagnose-nvidia-route-without-provider-call.mjs",
  "tools/phase1956p_nvidia_route_repair/verify-nvidia-route-repair-diagnosis.mjs",
].flatMap(findForbiddenRuntimeHits);

const checks = [
  ...requiredFiles.map((file) => check(`file_exists:${file}`, pathExists(file))),
  check("diagnosis_parseable", diagnosisRead.exists === true && diagnosisRead.parseError === null),
  check("envelope_parseable", envelopeRead.exists === true && envelopeRead.parseError === null),
  check("timeout_parseable", timeoutRead.exists === true && timeoutRead.parseError === null),
  check("model_parseable", modelRead.exists === true && modelRead.parseError === null),
  check("seal_parseable", sealRead.exists === true && sealRead.parseError === null),
  check("previous_closure_parseable", previousClosureRead.exists === true && previousClosureRead.parseError === null),
  check("previous_gate_parseable", previousGateRead.exists === true && previousGateRead.parseError === null),
  check("phase_completed", seal.completed === true),
  check("phase_recommended_sealed", seal.recommended_sealed === true),
  check("phase_blocker_null", seal.blocker === null),
  check("nvidia_route_repair_diagnosis_completed", seal.nvidiaRouteRepairDiagnosisCompleted === true),
  check("historical_attempts_imported", seal.historicalNvidiaAttemptsImported === true && previousClosure.nvidiaRouteStatus === "timeout_blocked"),
  check("historical_attempt_count_two", Number(seal.historicalNvidiaAttemptCount ?? 0) === 2),
  check("historical_timeout_count_two", Number(seal.historicalNvidiaTimeoutCount ?? 0) === 2),
  check("nvidia_route_status_timeout_blocked", seal.nvidiaRouteStatus === "timeout_blocked"),
  check("endpoint_audited", seal.endpointAudited === true && diagnosis.endpointAudited === true),
  check("request_envelope_audited", seal.requestEnvelopeAudited === true && envelope.requestEnvelopeAudited === true),
  check("timeout_handling_audited", seal.timeoutHandlingAudited === true && timeout.timeoutHandlingAudited === true),
  check("response_parsing_audited", seal.responseParsingAudited === true && timeout.responseParsingAudited === true),
  check("model_compatibility_dry_run_completed", seal.modelCompatibilityDryRunCompleted === true && model.modelCompatibilityDryRunCompleted === true),
  check("retry_readiness_gate_generated", seal.retryReadinessGateGenerated === true && diagnosis.retryReadinessGateGenerated === true),
  check("alternative_provider_decision_gate_preserved", seal.alternativeProviderDecisionGatePreserved === true && previousGate.alternativeProviderDecisionGateGenerated === true),
  check("default_retry_not_ready", diagnosis.retryReady === false && diagnosis.retryReadinessDecision === "retry_ready_false"),
  check("route_not_deprecated_by_this_phase", diagnosis.routeDeprecated === false),
  check("endpoint_openai_compatible_chat_completions", diagnosis.endpointAudit?.chatCompletionsPath === true && diagnosis.endpointAudit?.integrateBaseUrlDefaultPresent === true),
  check("stream_false_audited", envelope.streamFalsePropagated === true && timeout.streamFalseInNvidiaClient === true),
  check("timeout_abort_controller_audited", timeout.abortControllerPresent === true && timeout.abortTimeoutClassified === true),
  check("model_matrix_contains_two_authorized_models", Array.isArray(model.compatibilityMatrix) && model.compatibilityMatrix.filter((item) => item.allowedByExecutor === true).length >= 2),
  check("provider_stability_not_verified", seal.providerStabilityVerified === false),
  check("one_shot_not_passed", seal.oneShotProviderCallPassed === false),
  check("forbidden_runtime_patterns_absent", runtimeHits.length === 0, { runtimeHits }),
  ...safetyChecks(seal, "seal"),
  ...safetyChecks(diagnosis, "diagnosis"),
  ...safetyChecks(envelope, "envelope"),
  ...safetyChecks(timeout, "timeout"),
  ...safetyChecks(model, "model"),
];

const verified = allPassed(checks);
const result = {
  phase,
  name: "NVIDIA Route Repair Diagnosis Verification",
  completed: true,
  recommended_sealed: verified,
  blocker: verified ? null : "phase1956p_nvidia_route_repair_verification_failed",
  nvidiaRouteRepairDiagnosisCompleted: seal.nvidiaRouteRepairDiagnosisCompleted === true,
  nvidiaRouteStatus: seal.nvidiaRouteStatus ?? null,
  historicalNvidiaAttemptCount: Number(seal.historicalNvidiaAttemptCount ?? 0),
  historicalNvidiaTimeoutCount: Number(seal.historicalNvidiaTimeoutCount ?? 0),
  retryReady: diagnosis.retryReady === true,
  retryReadinessDecision: diagnosis.retryReadinessDecision ?? null,
  newProviderCallExecuted: seal.newProviderCallExecuted === true,
  providerCallsMade: seal.providerCallsMade === true,
  checks,
};

console.log(JSON.stringify(result, null, 2));

if (!verified) {
  process.exitCode = 1;
}
