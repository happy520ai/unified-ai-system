import { readFileSync } from "node:fs";
import { allPassed, check, pathExists, readJson, writeJson } from "../phase1903a/ownerAutomationSealCommon.mjs";

const phase = "Phase1959P";
const runnerPath = "tools/phase1959p/run-openrouter-credentialref-resolve-gate.mjs";
const verifierPath = "tools/phase1959p/verify-openrouter-credentialref-resolve-gate.mjs";
const resolveGateDocPath = "docs/phase1959p-openrouter-credentialref-resolve-gate.md";
const phase1960TextTemplatePath = "docs/phase1960p-openrouter-owner-approval-template.md";
const phase1960PacketPath = "docs/phase1960p-openrouter-one-shot-authorization-packet.json";
const gateResultPath = "apps/ai-gateway-service/evidence/phase1959p/openrouter-credentialref-resolve-gate-result.json";
const sealPath = "apps/ai-gateway-service/evidence/phase1959p/phase1959p-seal-result.json";
const previousSealPath = "apps/ai-gateway-service/evidence/phase1958p_credentialsetup/phase1958p-credentialsetup-seal-result.json";
const packageJsonPath = "package.json";

function readText(relativePath) {
  try {
    return readFileSync(relativePath, "utf8").replace(/^\uFEFF/u, "");
  } catch {
    return "";
  }
}

function findForbiddenStaticHits(relativePath) {
  const text = readText(relativePath);
  const patterns = [
    { id: "raw_openrouter_env_assignment", pattern: /OPENROUTER_API_KEY\s*=/u },
    { id: "authorization_header_literal", pattern: /Authorization\s*:\s*Bearer/u },
    { id: "auth_json_raw_read", pattern: /readFileSync\([^)]*auth\.json/u },
    { id: "dot_env_raw_read", pattern: /readFileSync\([^)]*\.env/u },
    { id: "env_dump", pattern: /Object\.entries\(\s*process\.env\s*\)|JSON\.stringify\(\s*process\.env\s*\)/u },
    { id: "raw_secret_accessor", pattern: /\.getApiKey\s*\(|\.listRecords\s*\(/u },
    { id: "network_fetch", pattern: /\bfetch\s*\(/u },
  ];
  return patterns.filter((item) => item.pattern.test(text)).map((item) => ({ file: relativePath, pattern: item.id }));
}

function safetyChecks(record, prefix) {
  return [
    check(`${prefix}_provider_calls_made_false`, record.providerCallsMade === false),
    check(`${prefix}_request_attempt_count_zero`, Number(record.requestAttemptCountInThisPhase ?? -1) === 0),
    check(`${prefix}_external_network_false`, record.externalNetworkRequestMade === false),
    check(`${prefix}_raw_secret_read_false`, record.rawSecretRead === false),
    check(`${prefix}_auth_json_raw_read_false`, record.authJsonRawRead === false),
    check(`${prefix}_auth_json_read_false`, record.authJsonRead === false),
    check(`${prefix}_dot_env_raw_read_false`, record.dotEnvRawRead === false),
    check(`${prefix}_dot_env_read_false`, record.dotEnvRead === false),
    check(`${prefix}_env_dumped_false`, record.envDumped === false),
    check(`${prefix}_secret_value_exposed_false`, record.secretValueExposed === false),
    check(`${prefix}_authorization_header_logged_false`, record.authorizationHeaderLogged === false),
    check(`${prefix}_chat_route_modified_false`, record.chatRouteModified === false),
    check(`${prefix}_chat_gateway_execute_modified_false`, record.chatGatewayExecuteModified === false),
    check(`${prefix}_legacy_modified_false`, record.legacyModified === false),
    check(`${prefix}_project_context_modified_false`, record.projectContextModified === false),
    check(`${prefix}_deploy_release_tag_artifact_false`, record.deployExecuted === false && record.releaseExecuted === false && record.tagCreated === false && record.artifactUploaded === false),
    check(`${prefix}_commit_push_false`, record.commitCreated === false && record.pushExecuted === false),
    check(`${prefix}_one_shot_false`, record.oneShotProviderCallPassed === false),
    check(`${prefix}_provider_stability_false`, record.providerStabilityVerified === false),
    check(`${prefix}_production_commercial_false`, record.productionReadyClaimed === false && record.commercialReadyClaimed === false),
    check(`${prefix}_workspace_clean_claimed_false`, record.workspaceCleanClaimed === false),
  ];
}

const previousRead = readJson(previousSealPath);
const gateRead = readJson(gateResultPath);
const sealRead = readJson(sealPath);
const packetRead = readJson(phase1960PacketPath);
const gate = gateRead.data ?? {};
const seal = sealRead.data ?? {};
const previous = previousRead.data ?? {};
const packageText = readText(packageJsonPath);
const resolveDocText = readText(resolveGateDocPath);
const phase1960TemplateExists = pathExists(phase1960TextTemplatePath);
const phase1960PacketExists = pathExists(phase1960PacketPath);
const staticHits = [runnerPath, resolveGateDocPath].flatMap(findForbiddenStaticHits);
const resolverStatus = seal.openRouterCredentialRefResolvable === true;

const checks = [
  check(`file_exists:${runnerPath}`, pathExists(runnerPath)),
  check(`file_exists:${verifierPath}`, pathExists(verifierPath)),
  check(`file_exists:${resolveGateDocPath}`, pathExists(resolveGateDocPath)),
  check(`file_exists:${gateResultPath}`, pathExists(gateResultPath)),
  check(`file_exists:${sealPath}`, pathExists(sealPath)),
  check("previous_credentialsetup_seal_imported", previousRead.exists === true && previousRead.parseError === null && previous.completed === true && previous.recommended_sealed === true),
  check("gate_result_parseable", gateRead.exists === true && gateRead.parseError === null),
  check("seal_parseable", sealRead.exists === true && sealRead.parseError === null),
  check("phase_completed", seal.completed === true),
  check("recommended_sealed_true", seal.recommended_sealed === true),
  check("blocker_matches_resolve_status", resolverStatus ? seal.blocker === null : seal.blocker === "openrouter_credentialref_still_missing"),
  check("credential_ref_exact", seal.credentialRef === "credentialRef:openrouter:default"),
  check("provider_openrouter", seal.providerId === "openrouter"),
  check("model_openrouter_gpt4o_mini", seal.modelId === "openai/gpt-4o-mini"),
  check("resolvable_boolean", typeof seal.openRouterCredentialRefResolvable === "boolean"),
  check("previous_status_recorded", typeof previous.openRouterCredentialRefResolvable === "boolean"),
  check("masked_runtime_status_present", seal.maskedRuntimeCredentialStatus?.providerId === "openrouter" && typeof seal.maskedRuntimeCredentialStatus?.apiKeyPresent === "boolean"),
  check("allow_provider_call_this_phase_false", seal.allowProviderCallInThisPhase === false),
  check("fresh_approval_required", seal.freshApprovalRequired === true && seal.oldApprovalReusable === false),
  check("text_first_required", seal.textFirstOwnerApprovalRequired === true && seal.jsonRole === "machine_validation_carrier_only"),
  check("phase1960_template_branch_correct", resolverStatus
    ? phase1960TemplateExists && phase1960PacketExists && seal.phase1960FreshAuthorizationTemplateGenerated === true && seal.phase1960OneShotAuthorizationPacketGenerated === true
    : seal.phase1960FreshAuthorizationTemplateGenerated === false && seal.phase1960OneShotAuthorizationPacketGenerated === false),
  check("phase1960_execution_not_generated", seal.phase1960ProviderExecutionGenerated === false),
  check("phase1960_packet_safe_if_present", !phase1960PacketExists || (
    packetRead.exists === true
      && packetRead.parseError === null
      && packetRead.data?.providerId === "openrouter"
      && packetRead.data?.credentialRef === "credentialRef:openrouter:default"
      && packetRead.data?.recordRawSecret === false
      && packetRead.data?.recordAuthorizationHeader === false
  )),
  check("gate_matches_seal", gate.openRouterCredentialRefResolvable === seal.openRouterCredentialRefResolvable && gate.blocker === seal.blocker),
  check("resolve_doc_mentions_decision", resolveDocText.includes("Phase1959P") && resolveDocText.includes("openRouterCredentialRefResolvable")),
  check("package_scripts_added", packageText.includes("run:phase1959p-openrouter-credentialref-gate") && packageText.includes("verify:phase1959p-openrouter-credentialref-gate")),
  check("forbidden_static_patterns_absent", staticHits.length === 0, { staticHits }),
  ...safetyChecks(seal, "seal"),
  ...safetyChecks(gate, "gate"),
];

const verified = allPassed(checks);
const verification = {
  phase,
  name: "Phase1959P OpenRouter CredentialRef Resolve Gate Verification",
  completed: true,
  recommended_sealed: verified,
  blocker: verified ? null : "phase1959p_openrouter_credentialref_gate_verification_failed",
  openRouterCredentialRefResolvable: seal.openRouterCredentialRefResolvable === true,
  credentialRef: seal.credentialRef ?? "credentialRef:openrouter:default",
  phase1960FreshAuthorizationTemplateGenerated: seal.phase1960FreshAuthorizationTemplateGenerated === true,
  phase1960OneShotAuthorizationPacketGenerated: seal.phase1960OneShotAuthorizationPacketGenerated === true,
  phase1960ProviderExecutionGenerated: false,
  providerCallsMade: false,
  requestAttemptCountInThisPhase: 0,
  externalNetworkRequestMade: false,
  rawSecretRead: false,
  authJsonRawRead: false,
  dotEnvRawRead: false,
  envDumped: false,
  secretValueExposed: false,
  authorizationHeaderLogged: false,
  checks,
};

writeJson("apps/ai-gateway-service/evidence/phase1959p/phase1959p-verification-result.json", verification);
console.log(JSON.stringify(verification, null, 2));

if (!verified) {
  process.exitCode = 1;
}
