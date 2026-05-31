import { readFileSync } from "node:fs";
import { allPassed, check, pathExists, readJson, writeJson } from "../phase1903a/ownerAutomationSealCommon.mjs";

const phase = "Phase1958P-Fix";
const runnerPath = "tools/phase1958p_fix/check-openrouter-credentialref-readiness.mjs";
const verifierPath = "tools/phase1958p_fix/verify-openrouter-credentialref-readiness.mjs";
const readinessDocPath = "docs/phase1958p-fix-openrouter-credentialref-readiness.md";
const setupDocPath = "docs/phase1958p-fix-openrouter-owner-credential-setup.md";
const templatePath = "docs/phase1958p-fix-next-one-shot-authorization-template.json";
const boundaryDocPath = "docs/phase1958p-fix-credentialref-boundary.md";
const readinessPath = "apps/ai-gateway-service/evidence/phase1958p_fix/openrouter-credentialref-readiness-result.json";
const boundaryPath = "apps/ai-gateway-service/evidence/phase1958p_fix/openrouter-credentialref-boundary-result.json";
const sealPath = "apps/ai-gateway-service/evidence/phase1958p_fix/phase1958p-fix-seal-result.json";
const phase1958SealPath = "apps/ai-gateway-service/evidence/phase1958p/phase1958p-seal-result.json";
const contractPath = "apps/ai-gateway-service/src/providers/credentialRefResolverRuntime.contract.js";
const schemaPath = "apps/ai-gateway-service/src/providers/providerExecutionAuthorizationSchema.js";
const gatePath = "apps/ai-gateway-service/src/providers/providerExecutionAuthorizationGate.js";
const executorPath = "apps/ai-gateway-service/src/providers/safeInternalProviderExecutor.js";
const envelopePath = "apps/ai-gateway-service/src/providers/safeProviderRequestEnvelope.js";
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
    { id: "auth_json_literal", pattern: /auth\.json/u },
    { id: "dot_env_literal", pattern: /["']\.env["']|readFileSync\([^)]*\.env/u },
    { id: "env_dump", pattern: /Object\.entries\(\s*process\.env\s*\)|JSON\.stringify\(\s*process\.env\s*\)/u },
    { id: "authorization_header_literal", pattern: /Authorization\s*:/u },
    { id: "get_api_key_call", pattern: /\.getApiKey\s*\(/u },
    { id: "list_records_call", pattern: /\.listRecords\s*\(/u },
  ];
  return patterns.filter((item) => item.pattern.test(text)).map((item) => ({ file: relativePath, pattern: item.id }));
}

function safetyChecks(record, prefix) {
  return [
    check(`${prefix}_credential_ref_only_true`, record.credentialRefOnly === true),
    check(`${prefix}_raw_secret_read_false`, record.rawSecretRead === false),
    check(`${prefix}_auth_json_raw_read_false`, record.authJsonRawRead === false),
    check(`${prefix}_dot_env_raw_read_false`, record.dotEnvRawRead === false),
    check(`${prefix}_env_dumped_false`, record.envDumped === false),
    check(`${prefix}_secret_value_exposed_false`, record.secretValueExposed === false),
    check(`${prefix}_authorization_header_logged_false`, record.authorizationHeaderLogged === false),
    check(`${prefix}_provider_calls_made_false`, record.providerCallsMade === false),
    check(`${prefix}_request_attempt_count_zero`, Number(record.requestAttemptCountInThisPhase ?? -1) === 0),
    check(`${prefix}_external_network_request_made_false`, record.externalNetworkRequestMade === false),
    check(`${prefix}_chat_route_modified_false`, record.chatRouteModified === false),
    check(`${prefix}_chat_gateway_execute_modified_false`, record.chatGatewayExecuteModified === false),
    check(`${prefix}_legacy_modified_false`, record.legacyModified === false),
    check(`${prefix}_project_context_modified_false`, record.projectContextModified === false),
    check(`${prefix}_deploy_false`, record.deployExecuted === false),
    check(`${prefix}_commit_push_false`, record.commitCreated === false && record.pushExecuted === false),
    check(`${prefix}_workspace_clean_claimed_false`, record.workspaceCleanClaimed === false),
  ];
}

const readinessRead = readJson(readinessPath);
const boundaryRead = readJson(boundaryPath);
const sealRead = readJson(sealPath);
const phase1958Read = readJson(phase1958SealPath);
const templateRead = readJson(templatePath);
const readiness = readinessRead.data ?? {};
const boundary = boundaryRead.data ?? {};
const seal = sealRead.data ?? {};
const phase1958Seal = phase1958Read.data ?? {};
const template = templateRead.data ?? {};
const contractText = readText(contractPath);
const packageText = readText(packageJsonPath);
const runnerText = readText(runnerPath);
const staticHits = [runnerPath].flatMap(findForbiddenStaticHits);

const expectedBlockers = [null, "openrouter_credentialref_still_missing"];
const expectedSealed = seal.completed === true && seal.recommended_sealed === true && expectedBlockers.includes(seal.blocker ?? null);

const requiredFiles = [
  runnerPath,
  verifierPath,
  readinessDocPath,
  setupDocPath,
  templatePath,
  boundaryDocPath,
  readinessPath,
  boundaryPath,
  sealPath,
  contractPath,
  schemaPath,
  gatePath,
  executorPath,
  envelopePath,
];

const checks = [
  ...requiredFiles.map((file) => check(`file_exists:${file}`, pathExists(file))),
  check("phase1958_evidence_imported", phase1958Read.exists === true && phase1958Seal.blocker === "alternative_provider_credential_missing"),
  check("readiness_parseable", readinessRead.exists === true && readinessRead.parseError === null),
  check("boundary_parseable", boundaryRead.exists === true && boundaryRead.parseError === null),
  check("seal_parseable", sealRead.exists === true && sealRead.parseError === null),
  check("template_parseable", templateRead.exists === true && templateRead.parseError === null),
  check("forbidden_static_patterns_absent", staticHits.length === 0, { staticHits }),
  check("runner_uses_metadata_only", runnerText.includes("metadataOnlyCredentialStatus") && !runnerText.includes(".getApiKey(") && !runnerText.includes(".listRecords(")),
  check("openrouter_declared_in_contract", contractText.includes("\"openrouter\"") && contractText.includes("\"credentialRef:openrouter:default\"")),
  check("phase_completed", seal.completed === true),
  check("recommended_sealed_true", seal.recommended_sealed === true),
  check("blocker_expected", expectedBlockers.includes(seal.blocker ?? null)),
  check("readiness_closure_status_valid", expectedSealed),
  check("openrouter_credential_ref_declared_true", seal.openRouterCredentialRefDeclared === true),
  check("credential_ref_exact", seal.credentialRef === "credentialRef:openrouter:default"),
  check("resolvable_boolean", typeof seal.openRouterCredentialRefResolvable === "boolean"),
  check("next_template_generated", seal.nextOneShotAuthorizationTemplateGenerated === true),
  check("fresh_approval_required", seal.freshApprovalRequired === true),
  check("old_approval_not_reusable", seal.oldApprovalReusable === false),
  check("template_phase_next", template.phase === "Phase1958P-Fix-NextOneShot"),
  check("template_provider_openrouter", template.providerId === "openrouter"),
  check("template_credential_ref", template.credentialRef === "credentialRef:openrouter:default"),
  check("template_text_first_required", template.ownerApprovalTextSourceOfTruth === true),
  check("boundary_matches_seal", boundary.credentialRef === seal.credentialRef && boundary.providerCallsMade === seal.providerCallsMade),
  check("readiness_matches_seal", readiness.credentialRef === seal.credentialRef && readiness.openRouterCredentialRefDeclared === seal.openRouterCredentialRefDeclared),
  check("one_shot_provider_call_not_passed", seal.oneShotProviderCallPassed === false),
  check("provider_stability_verified_false", seal.providerStabilityVerified === false),
  check("production_commercial_claims_false", seal.productionReadyClaimed === false && seal.commercialReadyClaimed === false),
  check("package_scripts_added", packageText.includes("run:phase1958p-fix-openrouter-credentialref") && packageText.includes("verify:phase1958p-fix-openrouter-credentialref")),
  ...safetyChecks(seal, "seal"),
  ...safetyChecks(boundary, "boundary"),
];

const verified = allPassed(checks);
const verification = {
  phase,
  name: "Phase1958P-Fix OpenRouter CredentialRef Readiness Verification",
  completed: true,
  recommended_sealed: verified,
  blocker: verified ? null : "phase1958p_fix_verification_failed",
  openRouterCredentialRefDeclared: seal.openRouterCredentialRefDeclared === true,
  openRouterCredentialRefResolvable: seal.openRouterCredentialRefResolvable === true,
  credentialRef: seal.credentialRef ?? "credentialRef:openrouter:default",
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

writeJson("apps/ai-gateway-service/evidence/phase1958p_fix/phase1958p-fix-verification-result.json", verification);
console.log(JSON.stringify(verification, null, 2));

if (!verified) {
  process.exitCode = 1;
}
