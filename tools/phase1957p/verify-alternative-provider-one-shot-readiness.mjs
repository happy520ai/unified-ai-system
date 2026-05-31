import { readFileSync } from "node:fs";
import { allPassed, check, pathExists, readJson } from "../phase1903a/ownerAutomationSealCommon.mjs";

const phase = "Phase1957P-AlternativeProvider-Guarded-One-Shot-Authorization-Intake";
const evidenceDir = "apps/ai-gateway-service/evidence/phase1957p";
const intakePath = "docs/phase1957p-alternative-provider-owner-approval.input.json";
const intakeExamplePath = "docs/phase1957p-alternative-provider-owner-approval.input.example.json";
const readinessReportPath = "docs/phase1957p-alternative-provider-readiness-report.md";
const previewPath = "docs/phase1957p-openrouter-compatible-one-shot-preview.md";
const intakeResultPath = `${evidenceDir}/alternative-provider-approval-intake-result.json`;
const readinessResultPath = `${evidenceDir}/alternative-provider-one-shot-readiness-result.json`;
const sealPath = `${evidenceDir}/phase1957p-seal-result.json`;
const phase1956SealPath = "apps/ai-gateway-service/evidence/phase1956p_alt_provider/alternative-provider-authorization-seal-result.json";
const schemaPath = "apps/ai-gateway-service/src/providers/providerExecutionAuthorizationSchema.js";
const gatePath = "apps/ai-gateway-service/src/providers/providerExecutionAuthorizationGate.js";
const packageJsonPath = "package.json";

const requiredFiles = [
  "tools/phase1957p/validate-alternative-provider-owner-approval.mjs",
  "tools/phase1957p/verify-alternative-provider-one-shot-readiness.mjs",
  intakePath,
  intakeExamplePath,
  readinessReportPath,
  previewPath,
  intakeResultPath,
  readinessResultPath,
  sealPath,
  phase1956SealPath,
  schemaPath,
  gatePath,
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
    { id: "fetch_call", pattern: new RegExp("\\bfet" + "ch\\s*\\(", "u") },
    { id: "process_env", pattern: new RegExp("process" + "\\.env", "u") },
    { id: "dot_env_read", pattern: new RegExp("readFileSync\\([^)]*\\." + "env", "u") },
    { id: "auth_json_read", pattern: new RegExp("readFileSync\\([^)]*auth" + "\\.json", "u") },
    { id: "dynamic_eval", pattern: new RegExp("\\bev" + "al\\s*\\(|new\\s+Function\\s*\\(|vm\\.runIn", "u") },
    { id: "spawner", pattern: new RegExp("node:" + "child_" + "process", "u") },
    { id: "exec_file", pattern: new RegExp("\\bexec" + "File\\s*\\(", "u") },
    { id: "spawn", pattern: new RegExp("\\bsp" + "awn\\s*\\(", "u") },
    { id: "bearer_literal", pattern: new RegExp("Bearer\\s+[A-Za-z0-9._-]+", "u") },
  ];
  return checks.filter((item) => item.pattern.test(text)).map((item) => ({ file: relativePath, pattern: item.id }));
}

function safetyChecks(record, prefix) {
  return [
    check(`${prefix}_allow_provider_call_in_this_phase_false`, record.allowProviderCallInThisPhase === false),
    check(`${prefix}_allow_provider_call_for_next_phase_true`, record.allowProviderCallForNextPhase === true),
    check(`${prefix}_provider_calls_made_false`, record.providerCallsMade === false),
    check(`${prefix}_request_attempt_count_zero`, Number(record.requestAttemptCountInThisPhase ?? -1) === 0),
    check(`${prefix}_raw_secret_read_false`, record.rawSecretRead === false),
    check(`${prefix}_auth_json_read_false`, record.authJsonRead === false),
    check(`${prefix}_dot_env_read_false`, record.dotEnvRead === false),
    check(`${prefix}_env_dumped_false`, record.envDumped === false),
    check(`${prefix}_secret_value_exposed_false`, record.secretValueExposed === false),
    check(`${prefix}_authorization_header_logged_false`, record.authorizationHeaderLogged === false),
    check(`${prefix}_chat_route_modified_false`, record.chatRouteModified === false),
    check(`${prefix}_chat_gateway_execute_modified_false`, record.chatGatewayExecuteModified === false),
    check(`${prefix}_provider_runtime_modified_false`, record.providerRuntimeModified === false),
    check(`${prefix}_legacy_modified_false`, record.legacyModified === false),
    check(`${prefix}_project_context_modified_false`, record.projectContextModified === false),
    check(`${prefix}_deploy_executed_false`, record.deployExecuted === false),
    check(`${prefix}_release_executed_false`, record.releaseExecuted === false),
    check(`${prefix}_tag_created_false`, record.tagCreated === false),
    check(`${prefix}_artifact_uploaded_false`, record.artifactUploaded === false),
    check(`${prefix}_commit_created_false`, record.commitCreated === false),
    check(`${prefix}_push_executed_false`, record.pushExecuted === false),
    check(`${prefix}_provider_stability_verified_false`, record.providerStabilityVerified === false),
    check(`${prefix}_one_shot_provider_call_passed_false`, record.oneShotProviderCallPassed === false),
    check(`${prefix}_production_ready_claimed_false`, record.productionReadyClaimed === false),
    check(`${prefix}_commercial_ready_claimed_false`, record.commercialReadyClaimed === false),
    check(`${prefix}_workspace_clean_claimed_false`, record.workspaceCleanClaimed === false),
  ];
}

const intakeRead = readJson(intakePath);
const intakeExampleRead = readJson(intakeExamplePath);
const readinessReportText = readText(readinessReportPath);
const previewText = readText(previewPath);
const intakeResultRead = readJson(intakeResultPath);
const readinessResultRead = readJson(readinessResultPath);
const sealRead = readJson(sealPath);
const phase1956SealRead = readJson(phase1956SealPath);
const packageText = readText(packageJsonPath);
const schemaText = readText(schemaPath);
const gateText = readText(gatePath);
const runtimeHits = [
  "tools/phase1957p/validate-alternative-provider-owner-approval.mjs",
  "tools/phase1957p/verify-alternative-provider-one-shot-readiness.mjs",
].flatMap(findForbiddenRuntimeHits);

const requiredProviderShapePresent = schemaText.includes("PHASE1957P_ALTERNATIVE_PROVIDER_ONE_SHOT_INTAKE_SCHEMA")
  && schemaText.includes("createPhase1957PAlternativeProviderOwnerApprovalInput")
  && gateText.includes("validateAlternativeProviderOwnerApprovalInput")
  && gateText.includes("allowProviderCallForNextPhase")
  && gateText.includes("selectedProviderId");

const intakeResult = intakeResultRead.data ?? {};
const readinessResult = readinessResultRead.data ?? {};
const seal = sealRead.data ?? {};
const phase1956Seal = phase1956SealRead.data ?? {};

const checks = [
  ...requiredFiles.map((file) => check(`file_exists:${file}`, pathExists(file))),
  check("intake_parseable", intakeRead.exists === true && intakeRead.parseError === null),
  check("intake_example_parseable", intakeExampleRead.exists === true && intakeExampleRead.parseError === null),
  check("readiness_report_text_present", readinessReportText.length > 0),
  check("preview_text_present", previewText.length > 0),
  check("intake_result_parseable", intakeResultRead.exists === true && intakeResultRead.parseError === null),
  check("readiness_result_parseable", readinessResultRead.exists === true && readinessResultRead.parseError === null),
  check("seal_parseable", sealRead.exists === true && sealRead.parseError === null),
  check("phase1956_seal_parseable", phase1956SealRead.exists === true && phase1956SealRead.parseError === null),
  check("phase1956_provider_status_timeout_blocked", phase1956Seal.nvidiaRouteStatus === "timeout_blocked"),
  check("required_provider_shape_present", requiredProviderShapePresent),
  check("phase_completed", seal.completed === true),
  check("phase_recommended_sealed", seal.recommended_sealed === true),
  check("phase_blocker_null", seal.blocker === null),
  check("alternative_provider_selected_true", seal.alternativeProviderSelected === true),
  check("selected_provider_openrouter", seal.selectedProviderId === "openrouter"),
  check("selected_model_openrouter_gpt4o_mini", seal.selectedModelId === "openai/gpt-4o-mini"),
  check("selected_credential_ref_openrouter_default", seal.selectedCredentialRef === "credentialRef:openrouter:default"),
  check("owner_approval_present", seal.ownerApprovalInputPresent === true),
  check("owner_approval_valid", seal.ownerApprovalInputValid === true),
  check("approval_statement_text_present", String(seal.approvalStatementText ?? "").trim().length > 0),
  check("allow_provider_call_for_next_phase_true", seal.allowProviderCallForNextPhase === true),
  check("allow_provider_call_in_this_phase_false", seal.allowProviderCallInThisPhase === false),
  check("next_one_shot_ready_true", seal.nextOneShotReady === true),
  check("max_requests_gate_ready_true", seal.maxRequestsGateReady === true),
  check("budget_gate_ready_true", seal.budgetGateReady === true),
  check("timeout_gate_ready_true", seal.timeoutGateReady === true),
  check("credential_ref_only_true", seal.credentialRefOnly === true),
  check("provider_calls_made_false", seal.providerCallsMade === false),
  check("request_attempt_count_zero", Number(seal.requestAttemptCountInThisPhase ?? -1) === 0),
  check("provider_stability_verified_false", seal.providerStabilityVerified === false),
  check("one_shot_provider_call_passed_false", seal.oneShotProviderCallPassed === false),
  check("provider_stability_not_verified_preserved", seal.provider_stability_not_verified_preserved === true),
  check("approval_intake_result_selected_route", intakeResult.selectedProviderId === "openrouter" && intakeResult.selectedModelId === "openai/gpt-4o-mini"),
  check("readiness_result_ready_for_next_phase", readinessResult.nextOneShotReady === true && readinessResult.allowProviderCallForNextPhase === true),
  check("readiness_result_approval_statement_text_present", String(readinessResult.approvalStatementText ?? "").trim().length > 0),
  check("readiness_report_mentions_next_phase", readinessReportText.includes("Phase1958P") && readinessReportText.toLowerCase().includes("openrouter")),
  check("preview_mentions_openrouter", previewText.toLowerCase().includes("openrouter") && previewText.includes("openai/gpt-4o-mini")),
  check("package_scripts_added", packageText.includes("run:phase1957p-alt-provider-approval-intake") && packageText.includes("verify:phase1957p-alt-provider-readiness")),
  check("forbidden_runtime_patterns_absent", runtimeHits.length === 0, { runtimeHits }),
  ...safetyChecks(seal, "seal"),
  ...safetyChecks(intakeResult, "intake_result"),
  ...safetyChecks(readinessResult, "readiness_result"),
];

const verified = allPassed(checks);
const result = {
  phase,
  name: "Alternative Provider Guarded One-Shot Authorization Readiness Verification",
  completed: true,
  recommended_sealed: verified,
  blocker: verified ? null : "phase1957p_alternative_provider_one_shot_readiness_verification_failed",
  alternativeProviderSelected: seal.alternativeProviderSelected === true,
  selectedProviderId: seal.selectedProviderId ?? null,
  selectedModelId: seal.selectedModelId ?? null,
  selectedCredentialRef: seal.selectedCredentialRef ?? null,
  allowProviderCallForNextPhase: seal.allowProviderCallForNextPhase === true,
  allowProviderCallInThisPhase: seal.allowProviderCallInThisPhase === true,
  nextOneShotReady: seal.nextOneShotReady === true,
  providerCallsMade: seal.providerCallsMade === true,
  requestAttemptCountInThisPhase: Number(seal.requestAttemptCountInThisPhase ?? 0),
  checks,
};

console.log(JSON.stringify(result, null, 2));

if (!verified) {
  process.exitCode = 1;
}
