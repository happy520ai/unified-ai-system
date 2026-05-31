import { readFileSync } from "node:fs";
import { allPassed, check, pathExists, readJson } from "../phase1903a/ownerAutomationSealCommon.mjs";

const classificationPath = "apps/ai-gateway-service/evidence/phase1955p_fix/nvidia-timeout-classification-result.json";
const repairPath = "apps/ai-gateway-service/evidence/phase1955p_fix/minimal-repair-readiness-result.json";
const sealPath = "apps/ai-gateway-service/evidence/phase1955p_fix/phase1955p-fix-seal-result.json";
const previousSealPath = "apps/ai-gateway-service/evidence/phase1955p/phase1955p-seal-result.json";
const classifierPath = "tools/phase1955p_fix/classify-nvidia-one-shot-timeout.mjs";
const verifierPath = "tools/phase1955p_fix/verify-nvidia-timeout-classification.mjs";
const timeoutDocPath = "docs/phase1955p-fix-nvidia-timeout-classification.md";
const repairDocPath = "docs/phase1955p-fix-minimal-repair-plan.md";
const retryTemplatePath = "docs/phase1955p-retry-owner-approval-template.json";
const executorPath = "apps/ai-gateway-service/src/providers/safeInternalProviderExecutor.js";
const envelopePath = "apps/ai-gateway-service/src/providers/safeProviderRequestEnvelope.js";
const sanitizerPath = "apps/ai-gateway-service/src/providers/safeProviderResponseSanitizer.js";
const gatePath = "apps/ai-gateway-service/src/providers/providerExecutionAuthorizationGate.js";
const schemaPath = "apps/ai-gateway-service/src/providers/providerExecutionAuthorizationSchema.js";

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
    { id: "provider_client_import", pattern: new RegExp(["create", "Nvidia", "Unified", "Client"].join(""), "u") },
    { id: "guarded_one_shot_execution", pattern: /executeGuardedOneShotRerun\s*\(/u },
    { id: "process_env_dump", pattern: /process\.env/u },
    { id: "dot_env_exact_read", pattern: /readFileSync\(\s*["']\.env["']\s*\)/u },
    { id: "auth_json_exact_read", pattern: /readFileSync\(\s*["']auth\.json["']\s*\)/u },
    { id: "dynamic_eval", pattern: /\beval\s*\(|new\s+Function\s*\(|vm\.runIn/u },
  ];
  return checks.filter((item) => item.pattern.test(text)).map((item) => ({ file: relativePath, pattern: item.id }));
}

function safetyChecks(record, prefix = "seal") {
  return [
    check(`${prefix}_credential_ref_only_true`, record.credentialRefOnly === true),
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
    check(`${prefix}_workspace_clean_claimed_false`, record.workspaceCleanClaimed === false),
  ];
}

const classificationRead = readJson(classificationPath);
const repairRead = readJson(repairPath);
const sealRead = readJson(sealPath);
const previousSealRead = readJson(previousSealPath);
const classification = classificationRead.data ?? {};
const repair = repairRead.data ?? {};
const seal = sealRead.data ?? {};
const previousSeal = previousSealRead.data ?? {};
const runtimeHits = [classifierPath, verifierPath].flatMap(findForbiddenRuntimeHits);

const requiredFiles = [
  classifierPath,
  verifierPath,
  timeoutDocPath,
  repairDocPath,
  retryTemplatePath,
  previousSealPath,
  classificationPath,
  repairPath,
  sealPath,
  executorPath,
  envelopePath,
  sanitizerPath,
  gatePath,
  schemaPath,
];

const checks = [
  ...requiredFiles.map((file) => check(`file_exists:${file}`, pathExists(file))),
  check("classification_parseable", classificationRead.exists === true && classificationRead.parseError === null),
  check("repair_parseable", repairRead.exists === true && repairRead.parseError === null),
  check("seal_parseable", sealRead.exists === true && sealRead.parseError === null),
  check("previous_phase1955p_parseable", previousSealRead.exists === true && previousSealRead.parseError === null),
  check("previous_failure_reason_timeout", previousSeal.failureReason === "nvidia_request_timeout"),
  check("previous_real_provider_network_attempted", previousSeal.realProviderNetworkAttempted === true),
  check("previous_request_attempt_count_one", Number(previousSeal.requestAttemptCount ?? 0) === 1),
  check("phase_completed", seal.completed === true),
  check("phase_recommended_sealed", seal.recommended_sealed === true),
  check("phase_blocker_null", seal.blocker === null),
  check("timeout_failure_classified", seal.timeoutFailureClassified === true && classification.timeoutFailureClassified === true),
  check("failure_reason_preserved", seal.failureReason === "nvidia_request_timeout"),
  check("timeout_stage_classified", seal.timeoutStageClassified === true && classification.timeoutStageClassified === true),
  check("timeout_stage_expected", classification.timeoutStage === "provider_fetch_or_response_wait_timeout"),
  check("real_provider_network_attempted_previously", seal.realProviderNetworkAttemptedPreviously === true),
  check("new_provider_call_not_executed", seal.newProviderCallExecuted === false),
  check("provider_calls_made_this_phase_false", seal.providerCallsMade === false && seal.providerCallsMadeThisPhase === false),
  check("real_provider_network_attempted_this_phase_false", seal.realProviderNetworkAttemptedThisPhase === false),
  check("request_attempt_count_this_phase_zero", Number(seal.requestAttemptCountInThisPhase ?? -1) === 0),
  check("minimal_repair_plan_generated", seal.minimalRepairPlanGenerated === true && repair.minimalRepairPlanGenerated === true),
  check("retry_template_generated", seal.phase1955pRetryApprovalTemplateGenerated === true && repair.phase1955pRetryApprovalTemplateGenerated === true),
  check("retry_template_timeout_sixty_seconds", Number(repair.retryApprovalTemplate?.timeoutMs ?? 0) === 60000),
  check("retry_template_max_requests_one", Number(repair.retryApprovalTemplate?.maxRequests ?? 0) === 1),
  check("retry_template_no_retry", Number(repair.retryApprovalTemplate?.retryAttemptCount ?? -1) === 0),
  check("retry_template_light_model_candidate", repair.retryApprovalTemplate?.modelId === "nvidia/llama-3.1-nemotron-nano-8b-v1"),
  check("one_shot_still_not_passed", seal.oneShotProviderCallPassed === false),
  check("provider_stability_not_verified", seal.providerStabilityVerified === false),
  check("production_commercial_claims_false", seal.productionReadyClaimed === false && seal.commercialReadyClaimed === false),
  check("forbidden_runtime_patterns_absent", runtimeHits.length === 0, { runtimeHits }),
  ...safetyChecks(seal, "seal"),
  ...safetyChecks(classification, "classification"),
  ...safetyChecks(repair, "repair"),
];

const verified = allPassed(checks);
const result = {
  phase: "Phase1955P-Fix",
  name: "NVIDIA One-Shot Timeout Classification Verification",
  completed: true,
  recommended_sealed: verified,
  blocker: verified ? null : "phase1955p_fix_verification_failed",
  timeoutFailureClassified: seal.timeoutFailureClassified === true,
  failureReason: seal.failureReason ?? null,
  timeoutStageClassified: seal.timeoutStageClassified === true,
  timeoutStage: classification.timeoutStage ?? null,
  newProviderCallExecuted: seal.newProviderCallExecuted === true,
  requestAttemptCountInThisPhase: Number(seal.requestAttemptCountInThisPhase ?? 0),
  providerCallsMade: seal.providerCallsMade === true,
  minimalRepairPlanGenerated: seal.minimalRepairPlanGenerated === true,
  phase1955pRetryApprovalTemplateGenerated: seal.phase1955pRetryApprovalTemplateGenerated === true,
  checks,
};

console.log(JSON.stringify(result, null, 2));

if (!verified) {
  process.exitCode = 1;
}
