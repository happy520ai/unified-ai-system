import { readFileSync } from "node:fs";
import { readJson, writeJson, pathExists, check, allPassed } from "../phase1903a/ownerAutomationSealCommon.mjs";

const gatePath = "apps/ai-gateway-service/src/providers/providerExecutionAuthorizationGate.js";
const schemaPath = "apps/ai-gateway-service/src/providers/providerExecutionAuthorizationSchema.js";
const runnerPath = "tools/phase1952p/run-guarded-real-provider-call-authorization-preview.mjs";
const docsFiles = [
  "docs/phase1952p-guarded-real-provider-call-authorization.md",
  "docs/phase1952p-owner-approval-input-template.json",
  "docs/phase1952p-provider-call-budget-and-risk-gate.md",
  "docs/phase1952p-emergency-stop-and-rollback-plan.md",
  "docs/phase1952p-phase1953p-one-shot-command-preview.md",
];
const previewPath = "apps/ai-gateway-service/evidence/phase1952p/guarded-real-provider-call-authorization-preview.json";
const budgetGatePath = "apps/ai-gateway-service/evidence/phase1952p/provider-call-budget-gate-result.json";
const readinessPath = "apps/ai-gateway-service/evidence/phase1952p/phase1953p-one-shot-readiness-result.json";
const sealPath = "apps/ai-gateway-service/evidence/phase1952p/phase1952p-seal-result.json";
const validationPath = "apps/ai-gateway-service/evidence/phase1952p/phase1952p-validation-result.json";

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

const scannedFiles = [gatePath, schemaPath, runnerPath];
const dangerousHits = scannedFiles.flatMap(findDangerousHits);
const gateText = readText(gatePath);
const schemaText = readText(schemaPath);
const previewRead = readJson(previewPath);
const budgetRead = readJson(budgetGatePath);
const readinessRead = readJson(readinessPath);
const sealRead = readJson(sealPath);
const preview = previewRead.data ?? {};
const budget = budgetRead.data ?? {};
const readiness = readinessRead.data ?? {};
const seal = sealRead.data ?? {};

const checks = [
  check("gate_file_exists", pathExists(gatePath)),
  check("schema_file_exists", pathExists(schemaPath)),
  check("runner_exists", pathExists(runnerPath)),
  ...docsFiles.map((file) => check(`doc_exists:${file}`, pathExists(file))),
  check("preview_evidence_parseable", previewRead.exists === true && previewRead.parseError === null),
  check("budget_gate_evidence_parseable", budgetRead.exists === true && budgetRead.parseError === null),
  check("readiness_evidence_parseable", readinessRead.exists === true && readinessRead.parseError === null),
  check("seal_evidence_parseable", sealRead.exists === true && sealRead.parseError === null),
  check("dangerous_patterns_absent", dangerousHits.length === 0, { dangerousHits }),
  check("schema_exports_phase1952_packet", schemaText.includes("PHASE1952P_GUARDED_REAL_PROVIDER_CALL_AUTHORIZATION_SCHEMA")),
  check("gate_exports_phase1952_validator", gateText.includes("validateGuardedRealProviderCallAuthorizationPacket")),
  check("phase1952p_completed", seal.phase1952pCompleted === true && seal.completed === true),
  check("authorization_packet_generated", seal.authorizationPacketGenerated === true && preview.authorizationPacketGenerated === true),
  check("owner_approval_template_generated", seal.ownerApprovalTemplateGenerated === true && preview.ownerApprovalTemplateGenerated === true),
  check("phase1953p_one_shot_preview_generated", seal.phase1953pOneShotPreviewGenerated === true && readiness.phase1953pOneShotPreviewGenerated === true),
  check("allow_provider_call_for_current_phase_false", seal.allowProviderCallForCurrentPhase === false),
  check("request_attempt_count_zero", seal.requestAttemptCount === 0),
  check("provider_calls_made_false", seal.providerCallsMade === false),
  check("provider_stability_verified_false", seal.providerStabilityVerified === false),
  check("credential_ref_only_true", seal.credentialRefOnly === true),
  check("raw_secret_read_false", seal.rawSecretRead === false),
  check("auth_json_read_false", seal.authJsonRead === false),
  check("env_dumped_false", seal.envDumped === false),
  check("secret_value_exposed_false", seal.secretValueExposed === false),
  check("authorization_header_logged_false", seal.authorizationHeaderLogged === false),
  check("max_requests_gate_ready", seal.maxRequestsGateReady === true && budget.maxRequestsGateReady === true),
  check("budget_gate_ready", seal.budgetGateReady === true && budget.budgetGateReady === true),
  check("provider_allowlist_ready", seal.providerAllowlistReady === true && budget.providerAllowlistReady === true),
  check("model_allowlist_ready", seal.modelAllowlistReady === true && budget.modelAllowlistReady === true),
  check("timeout_gate_ready", seal.timeoutGateReady === true && budget.timeoutGateReady === true),
  check("emergency_stop_plan_ready", seal.emergencyStopPlanReady === true),
  check("rollback_plan_ready", seal.rollbackPlanReady === true),
  check("chat_route_modified_false", seal.chatRouteModified === false),
  check("chat_gateway_execute_modified_false", seal.chatGatewayExecuteModified === false),
  check("legacy_modified_false", seal.legacyModified === false),
  check("project_context_modified_false", seal.projectContextModified === false),
  check("deploy_release_tag_artifact_false", seal.deployExecuted === false && seal.releaseExecuted === false && seal.tagCreated === false && seal.artifactUploaded === false),
  check("commit_push_false", seal.commitCreated === false && seal.pushExecuted === false),
  check("provider_stability_not_verified_preserved", seal.providerStabilityNotVerifiedPreserved === true),
  check("sealed_true", seal.recommended_sealed === true && seal.blocker === null),
];

const sealed = allPassed(checks);
const validation = {
  phase: "Phase1952P",
  name: "Guarded Real Provider Call Authorization Verification",
  completed: true,
  recommended_sealed: sealed,
  blocker: sealed ? null : "phase1952p_provider_call_authorization_verification_failed",
  phase1952pCompleted: seal.phase1952pCompleted === true,
  authorizationPacketGenerated: seal.authorizationPacketGenerated === true,
  ownerApprovalTemplateGenerated: seal.ownerApprovalTemplateGenerated === true,
  phase1953pOneShotPreviewGenerated: seal.phase1953pOneShotPreviewGenerated === true,
  requestAttemptCount: seal.requestAttemptCount ?? null,
  providerCallsMade: seal.providerCallsMade === true,
  providerStabilityVerified: seal.providerStabilityVerified === true,
  providerStabilityNotVerifiedPreserved: seal.providerStabilityNotVerifiedPreserved === true,
  checks,
};

writeJson(validationPath, validation);
console.log(JSON.stringify(validation, null, 2));

if (!sealed) {
  process.exitCode = 1;
}
