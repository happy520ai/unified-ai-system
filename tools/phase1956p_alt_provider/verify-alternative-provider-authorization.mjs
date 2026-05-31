import { readFileSync } from "node:fs";
import { allPassed, check, pathExists, readJson } from "../phase1903a/ownerAutomationSealCommon.mjs";

const phase = "Phase1956P-AlternativeProvider-Authorization";
const evidenceDir = "apps/ai-gateway-service/evidence/phase1956p_alt_provider";
const decisionGatePath = `${evidenceDir}/alternative-provider-decision-gate-result.json`;
const candidateMatrixPath = `${evidenceDir}/provider-candidate-matrix-result.json`;
const sealPath = `${evidenceDir}/alternative-provider-authorization-seal-result.json`;
const nvidiaSealPath = "apps/ai-gateway-service/evidence/phase1956p_nvidia_route_repair/phase1956p-seal-result.json";
const nvidiaDiagnosisPath = "apps/ai-gateway-service/evidence/phase1956p_nvidia_route_repair/nvidia-route-diagnosis-result.json";
const registryPath = "apps/ai-gateway-service/src/tianshu-capability-atom/syntheticCapabilityAtomRegistry.js";

const requiredFiles = [
  "tools/phase1956p_alt_provider/build-alternative-provider-authorization.mjs",
  "tools/phase1956p_alt_provider/verify-alternative-provider-authorization.mjs",
  "docs/phase1956p-alternative-provider-decision-gate.md",
  "docs/phase1956p-alternative-provider-candidate-matrix.md",
  "docs/phase1956p-alternative-provider-credentialref-matrix.md",
  "docs/phase1956p-alternative-provider-owner-approval-template.json",
  "docs/phase1956p-alternative-provider-budget-and-risk-gate.md",
  "docs/phase1956p-alternative-provider-emergency-stop-and-rollback.md",
  "docs/phase1956p-alternative-provider-next-one-shot-preview.md",
  decisionGatePath,
  candidateMatrixPath,
  sealPath,
  nvidiaSealPath,
  nvidiaDiagnosisPath,
  registryPath,
];

function readText(relativePath) {
  try {
    return readFileSync(relativePath, "utf8").replace(/^\uFEFF/u, "");
  } catch {
    return "";
  }
}

function findForbiddenRuntimeHits(relativePath) {
  const text = readText(relativePath);
  const checks = [
    { id: "direct_fetch_call", pattern: new RegExp("\\bfet" + "ch\\s*\\(", "u") },
    { id: "process_env_access", pattern: new RegExp("process" + "\\.env", "u") },
    { id: "dot_env_exact_read", pattern: new RegExp("readFileSync\\([^)]*\\." + "env", "u") },
    { id: "auth_json_exact_read", pattern: new RegExp("readFileSync\\([^)]*auth" + "\\.json", "u") },
    { id: "dynamic_eval", pattern: new RegExp("\\bev" + "al\\s*\\(|new\\s+Function\\s*\\(|vm\\.runIn", "u") },
    { id: "process_spawner", pattern: new RegExp("node:" + "child_" + "process", "u") },
    { id: "exec_file_call", pattern: new RegExp("\\bexec" + "File\\s*\\(", "u") },
    { id: "spawn_call", pattern: new RegExp("\\bsp" + "awn\\s*\\(", "u") },
    { id: "bearer_literal", pattern: new RegExp("Bearer\\s+[A-Za-z0-9._-]+", "u") },
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
    check(`${prefix}_provider_stability_false`, record.providerStabilityVerified === false),
    check(`${prefix}_one_shot_passed_false`, record.oneShotProviderCallPassed === false),
    check(`${prefix}_production_ready_claimed_false`, record.productionReadyClaimed === false),
    check(`${prefix}_commercial_ready_claimed_false`, record.commercialReadyClaimed === false),
    check(`${prefix}_workspace_clean_claimed_false`, record.workspaceCleanClaimed === false),
  ];
}

const decisionGateRead = readJson(decisionGatePath);
const candidateMatrixRead = readJson(candidateMatrixPath);
const sealRead = readJson(sealPath);
const nvidiaSealRead = readJson(nvidiaSealPath);
const nvidiaDiagnosisRead = readJson(nvidiaDiagnosisPath);
const approvalTemplateRead = readJson("docs/phase1956p-alternative-provider-owner-approval-template.json");

const decisionGate = decisionGateRead.data ?? {};
const candidateMatrix = candidateMatrixRead.data ?? {};
const seal = sealRead.data ?? {};
const nvidiaSeal = nvidiaSealRead.data ?? {};
const nvidiaDiagnosis = nvidiaDiagnosisRead.data ?? {};
const approvalTemplate = approvalTemplateRead.data ?? {};
const routes = candidateMatrix.providerCandidateMatrix ?? [];
const credentialRefs = candidateMatrix.credentialRefRequirementMatrix ?? [];
const registryText = readText(registryPath);
const packageText = readText("package.json");

const runtimeHits = [
  "tools/phase1956p_alt_provider/build-alternative-provider-authorization.mjs",
  "tools/phase1956p_alt_provider/verify-alternative-provider-authorization.mjs",
].flatMap(findForbiddenRuntimeHits);

const routeIds = routes.map((item) => item.routeId);
const expectedRouteIds = [
  "openrouter_compatible",
  "openai_compatible",
  "claude_compatible",
  "volcengine_mimo",
  "local_synthetic_provider_fallback",
];
const routeById = Object.fromEntries(routes.map((item) => [item.routeId, item]));

const checks = [
  ...requiredFiles.map((file) => check(`file_exists:${file}`, pathExists(file))),
  check("decision_gate_parseable", decisionGateRead.exists === true && decisionGateRead.parseError === null),
  check("candidate_matrix_parseable", candidateMatrixRead.exists === true && candidateMatrixRead.parseError === null),
  check("seal_parseable", sealRead.exists === true && sealRead.parseError === null),
  check("nvidia_seal_parseable", nvidiaSealRead.exists === true && nvidiaSealRead.parseError === null),
  check("nvidia_diagnosis_parseable", nvidiaDiagnosisRead.exists === true && nvidiaDiagnosisRead.parseError === null),
  check("owner_approval_template_parseable", approvalTemplateRead.exists === true && approvalTemplateRead.parseError === null),
  check("phase_completed", seal.completed === true),
  check("phase_recommended_sealed", seal.recommended_sealed === true),
  check("phase_blocker_null", seal.blocker === null),
  check("nvidia_route_timeout_blocked_imported", seal.nvidiaRouteStatus === "timeout_blocked" && nvidiaSeal.nvidiaRouteStatus === "timeout_blocked"),
  check("nvidia_retry_ready_false_imported", seal.nvidiaRetryReady === false && nvidiaDiagnosis.retryReady === false),
  check("alternative_provider_decision_gate_generated", seal.alternativeProviderDecisionGateGenerated === true && decisionGate.alternativeProviderDecisionGateGenerated === true),
  check("provider_candidate_matrix_generated", seal.providerCandidateMatrixGenerated === true && candidateMatrix.providerCandidateMatrixGenerated === true),
  check("credential_ref_requirement_matrix_generated", seal.credentialRefRequirementMatrixGenerated === true && candidateMatrix.credentialRefRequirementMatrixGenerated === true),
  check("owner_approval_input_template_generated", seal.ownerApprovalInputTemplateGenerated === true && approvalTemplate.phase === "Phase1957P-AlternativeProvider-OneShot"),
  check("budget_and_request_gate_generated", seal.budgetAndRequestGateGenerated === true && decisionGate.budgetAndRequestGateGenerated === true),
  check("emergency_stop_and_rollback_plan_generated", seal.emergencyStopAndRollbackPlanGenerated === true && decisionGate.emergencyStopAndRollbackPlanGenerated === true),
  check("next_one_shot_command_preview_generated", seal.nextOneShotCommandPreviewGenerated === true && decisionGate.nextOneShotCommandPreviewGenerated === true),
  check("candidate_route_count_five", routes.length === 5),
  check("candidate_route_ids_complete", expectedRouteIds.every((id) => routeIds.includes(id))),
  check("openrouter_owner_approval_required", routeById.openrouter_compatible?.status === "available_after_owner_approval" && routeById.openrouter_compatible?.requiresCredentialRef === true),
  check("openai_owner_approval_required", routeById.openai_compatible?.status === "available_after_owner_approval" && routeById.openai_compatible?.requiresCredentialRef === true),
  check("claude_owner_approval_required", routeById.claude_compatible?.status === "available_after_owner_approval" && routeById.claude_compatible?.requiresCredentialRef === true),
  check("volcengine_mimo_separate_approval_required", routeById.volcengine_mimo?.status === "higher_risk_requires_separate_owner_approval" && routeById.volcengine_mimo?.requiresCredentialRef === true),
  check("local_synthetic_dry_run_only", routeById.local_synthetic_provider_fallback?.status === "safe_dry_run_only" && routeById.local_synthetic_provider_fallback?.realProviderCallAllowedInThisPhase === false),
  check("credential_ref_matrix_complete", credentialRefs.length === 5 && credentialRefs.every((item) => item.rawSecretAllowed === false && item.credentialRefRequired === true)),
  check("owner_template_not_current_approval", approvalTemplate.allowProviderCall === false && approvalTemplate.createdBy === "owner" && /Template only/u.test(approvalTemplate.notes ?? "")),
  check("owner_template_budget_limited", approvalTemplate.maxRequests === 1 && approvalTemplate.retryAttemptCount === 0 && approvalTemplate.maxEstimatedCostUsd <= 0.01),
  check("owner_template_safety_false", approvalTemplate.allowRawSecretRead === false && approvalTemplate.allowAuthJsonRead === false && approvalTemplate.allowEnvDump === false && approvalTemplate.allowChatGatewayExecuteModification === false && approvalTemplate.allowDeploy === false),
  check("provider_call_current_phase_false", seal.allowProviderCallForCurrentPhase === false && decisionGate.allowProviderCallForCurrentPhase === false),
  check("tianshu_provider_blocker_updated", seal.tianshuProviderStabilityBlockerUpdated === true && /Phase1956P alternative provider authorization packet prepared/u.test(registryText)),
  check("package_scripts_added", packageText.includes("run:phase1956p-alternative-provider-authorization") && packageText.includes("verify:phase1956p-alternative-provider-authorization")),
  check("forbidden_runtime_patterns_absent", runtimeHits.length === 0, { runtimeHits }),
  ...safetyChecks(seal, "seal"),
  ...safetyChecks(decisionGate, "decision_gate"),
  ...safetyChecks(candidateMatrix, "candidate_matrix"),
];

const verified = allPassed(checks);
const result = {
  phase,
  name: "Alternative Provider Authorization Verification",
  completed: true,
  recommended_sealed: verified,
  blocker: verified ? null : "phase1956p_alternative_provider_authorization_verification_failed",
  alternativeProviderDecisionGateGenerated: seal.alternativeProviderDecisionGateGenerated === true,
  providerCandidateMatrixGenerated: seal.providerCandidateMatrixGenerated === true,
  ownerApprovalInputTemplateGenerated: seal.ownerApprovalInputTemplateGenerated === true,
  nvidiaRouteStatus: seal.nvidiaRouteStatus ?? null,
  providerCallsMade: seal.providerCallsMade === true,
  requestAttemptCountInThisPhase: Number(seal.requestAttemptCountInThisPhase ?? -1),
  checks,
};

console.log(JSON.stringify(result, null, 2));

if (!verified) {
  process.exitCode = 1;
}
