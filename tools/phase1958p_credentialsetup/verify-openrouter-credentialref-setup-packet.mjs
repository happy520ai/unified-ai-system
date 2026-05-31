import { readFileSync } from "node:fs";
import { allPassed, check, pathExists, readJson, writeJson } from "../phase1903a/ownerAutomationSealCommon.mjs";

const phase = "Phase1958P-CredentialSetup";
const runnerPath = "tools/phase1958p_credentialsetup/check-openrouter-credentialref-masked.mjs";
const verifierPath = "tools/phase1958p_credentialsetup/verify-openrouter-credentialref-setup-packet.mjs";
const ownerGuidePath = "docs/phase1958p-credentialsetup-openrouter-owner-guide.md";
const contractDocPath = "docs/phase1958p-credentialsetup-credentialref-contract.md";
const nextTemplatePath = "docs/phase1958p-credentialsetup-next-authorization-template.json";
const maskedCheckPath = "apps/ai-gateway-service/evidence/phase1958p_credentialsetup/openrouter-credentialref-masked-check-result.json";
const sealPath = "apps/ai-gateway-service/evidence/phase1958p_credentialsetup/phase1958p-credentialsetup-seal-result.json";
const previousSealPath = "apps/ai-gateway-service/evidence/phase1958p_fix/phase1958p-fix-seal-result.json";
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
    { id: "auth_header_literal", pattern: /Authorization\s*:\s*Bearer/u },
    { id: "auth_json_raw_read", pattern: /readFileSync\([^)]*auth\.json/u },
    { id: "dot_env_raw_read", pattern: /readFileSync\([^)]*\.env/u },
    { id: "process_env_dump", pattern: /Object\.entries\(\s*process\.env\s*\)|JSON\.stringify\(\s*process\.env\s*\)/u },
    { id: "secret_value_api", pattern: /\.getApiKey\s*\(|\.listRecords\s*\(/u },
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
    check(`${prefix}_dot_env_raw_read_false`, record.dotEnvRawRead === false),
    check(`${prefix}_env_dumped_false`, record.envDumped === false),
    check(`${prefix}_secret_value_exposed_false`, record.secretValueExposed === false),
    check(`${prefix}_authorization_header_logged_false`, record.authorizationHeaderLogged === false),
    check(`${prefix}_chat_route_modified_false`, record.chatRouteModified === false),
    check(`${prefix}_chat_gateway_execute_modified_false`, record.chatGatewayExecuteModified === false),
    check(`${prefix}_legacy_modified_false`, record.legacyModified === false),
    check(`${prefix}_project_context_modified_false`, record.projectContextModified === false),
    check(`${prefix}_deploy_release_tag_artifact_false`, record.deployExecuted === false && record.releaseExecuted === false && record.tagCreated === false && record.artifactUploaded === false),
    check(`${prefix}_commit_push_false`, record.commitCreated === false && record.pushExecuted === false),
    check(`${prefix}_workspace_clean_claimed_false`, record.workspaceCleanClaimed === false),
  ];
}

function includesAllAliases(mapping) {
  const aliases = Array.isArray(mapping?.aliasesChecked) ? mapping.aliasesChecked : [];
  return [
    "openrouter",
    "openrouter/default",
    "openrouter:default",
    "openrouter::default",
    "credentialRef:openrouter:default",
  ].every((alias) => aliases.includes(alias));
}

const maskedRead = readJson(maskedCheckPath);
const sealRead = readJson(sealPath);
const previousRead = readJson(previousSealPath);
const templateRead = readJson(nextTemplatePath);
const masked = maskedRead.data ?? {};
const seal = sealRead.data ?? {};
const previous = previousRead.data ?? {};
const template = templateRead.data ?? {};
const packageText = readText(packageJsonPath);
const ownerGuideText = readText(ownerGuidePath);
const contractDocText = readText(contractDocPath);
const runnerText = readText(runnerPath);
const staticHits = [runnerPath, ownerGuidePath, contractDocPath].flatMap(findForbiddenStaticHits);
const allowedBlockers = [null, "openrouter_credentialref_still_missing"];

const requiredFiles = [
  runnerPath,
  verifierPath,
  ownerGuidePath,
  contractDocPath,
  nextTemplatePath,
  maskedCheckPath,
  sealPath,
];

const checks = [
  ...requiredFiles.map((file) => check(`file_exists:${file}`, pathExists(file))),
  check("previous_fix_seal_imported", previousRead.exists === true && previous.completed === true && previous.recommended_sealed === true),
  check("masked_check_parseable", maskedRead.exists === true && maskedRead.parseError === null),
  check("seal_parseable", sealRead.exists === true && sealRead.parseError === null),
  check("next_template_parseable", templateRead.exists === true && templateRead.parseError === null),
  check("forbidden_static_patterns_absent", staticHits.length === 0, { staticHits }),
  check("runner_masked_metadata_only", runnerText.includes("maskedReadinessCheckerGenerated") && !runnerText.includes(".getApiKey(") && !runnerText.includes(".listRecords(")),
  check("phase_completed", seal.completed === true),
  check("recommended_sealed_true", seal.recommended_sealed === true),
  check("blocker_allowed", allowedBlockers.includes(seal.blocker ?? null)),
  check("owner_setup_guide_generated", seal.ownerCredentialSetupGuideGenerated === true),
  check("credential_ref_contract_generated", seal.credentialRefContractGenerated === true),
  check("masked_checker_generated", seal.maskedReadinessCheckerGenerated === true),
  check("next_template_generated", seal.nextFreshAuthorizationTemplateGenerated === true),
  check("credential_ref_exact", seal.credentialRef === "credentialRef:openrouter:default"),
  check("resolvable_boolean", typeof seal.openRouterCredentialRefResolvable === "boolean"),
  check("mapping_aliases_checked", includesAllAliases(seal.credentialRefMapping), { aliasesChecked: seal.credentialRefMapping?.aliasesChecked ?? [] }),
  check("mapping_alias_statuses_masked", Array.isArray(seal.credentialRefMapping?.aliasStatuses) && seal.credentialRefMapping.aliasStatuses.every((status) =>
    typeof status.alias === "string"
    && typeof status.apiKeyPresent === "boolean"
    && !("apiKey" in status)
    && !("secret" in status)
    && !("authorization" in status)
  )),
  check("mapping_resolvable_matches_seal", seal.credentialRefMapping?.resolvable === seal.openRouterCredentialRefResolvable),
  check("runtime_status_matches_mapping", seal.openRouterRuntimeCredentialStatus?.apiKeyPresent === seal.credentialRefMapping?.apiKeyPresent && seal.openRouterRuntimeCredentialStatus?.endpointConfigured === seal.credentialRefMapping?.endpointConfigured),
  check("owner_guide_mentions_no_key_to_codex", ownerGuideText.includes("Codex 不接收、不读取、不打印 API Key") && ownerGuideText.includes("credentialRef:openrouter:default")),
  check("contract_doc_mentions_masked_only", contractDocText.includes("masked") && contractDocText.includes("credentialRef:openrouter:default")),
  check("template_text_source_truth", template.ownerApprovalTextSourceOfTruth === true),
  check("template_provider_openrouter", template.providerId === "openrouter"),
  check("template_credential_ref", template.credentialRef === "credentialRef:openrouter:default"),
  check("template_no_raw_record", template.recordRawSecret === false && template.recordAuthorizationHeader === false),
  check("masked_matches_seal", masked.credentialRef === seal.credentialRef && masked.openRouterCredentialRefResolvable === seal.openRouterCredentialRefResolvable),
  check("one_shot_not_passed", seal.oneShotProviderCallPassed === false),
  check("provider_stability_false", seal.providerStabilityVerified === false),
  check("production_commercial_claims_false", seal.productionReadyClaimed === false && seal.commercialReadyClaimed === false),
  check("package_scripts_added", packageText.includes("run:phase1958p-credentialsetup-openrouter") && packageText.includes("verify:phase1958p-credentialsetup-openrouter")),
  ...safetyChecks(seal, "seal"),
  ...safetyChecks(masked, "masked"),
];

const verified = allPassed(checks);
const verification = {
  phase,
  name: "Phase1958P-CredentialSetup OpenRouter CredentialRef Setup Packet Verification",
  completed: true,
  recommended_sealed: verified,
  blocker: verified ? null : "phase1958p_credentialsetup_verification_failed",
  credentialRef: seal.credentialRef ?? "credentialRef:openrouter:default",
  openRouterCredentialRefResolvable: seal.openRouterCredentialRefResolvable === true,
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

writeJson("apps/ai-gateway-service/evidence/phase1958p_credentialsetup/phase1958p-credentialsetup-verification-result.json", verification);
console.log(JSON.stringify(verification, null, 2));

if (!verified) {
  process.exitCode = 1;
}
