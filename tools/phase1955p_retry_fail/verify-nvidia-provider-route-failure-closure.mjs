import { readFileSync } from "node:fs";
import { allPassed, check, pathExists, readJson } from "../phase1903a/ownerAutomationSealCommon.mjs";
import { getSyntheticCapabilityAtoms } from "../../apps/ai-gateway-service/src/tianshu-capability-atom/syntheticCapabilityAtomRegistry.js";
import { createTianshuCapabilityReadout } from "../../apps/ai-gateway-service/src/tianshu-capability-atom/tianshuCapabilityReadoutAdapter.js";

const phase1955SealPath = "apps/ai-gateway-service/evidence/phase1955p/phase1955p-seal-result.json";
const phase1955RetrySealPath = "apps/ai-gateway-service/evidence/phase1955p_retry/phase1955p-retry-seal-result.json";
const closurePath = "apps/ai-gateway-service/evidence/phase1955p_retry_fail/nvidia-route-failure-closure-result.json";
const gatePath = "apps/ai-gateway-service/evidence/phase1955p_retry_fail/alternative-provider-decision-gate-result.json";
const sealPath = "apps/ai-gateway-service/evidence/phase1955p_retry_fail/phase1955p-retry-fail-seal-result.json";
const runnerPath = "tools/phase1955p_retry_fail/close-nvidia-provider-route-failure.mjs";
const verifierPath = "tools/phase1955p_retry_fail/verify-nvidia-provider-route-failure-closure.mjs";
const registryPath = "apps/ai-gateway-service/src/tianshu-capability-atom/syntheticCapabilityAtomRegistry.js";
const readoutPath = "apps/ai-gateway-service/src/tianshu-capability-atom/tianshuCapabilityReadoutAdapter.js";

const requiredFiles = [
  runnerPath,
  verifierPath,
  "docs/phase1955p-retry-fail-nvidia-route-failure-closure.md",
  "docs/phase1955p-retry-fail-alternative-provider-decision-gate.md",
  "docs/phase1955p-retry-fail-next-route-options.md",
  "docs/phase1955p-retry-fail-provider-status-update.md",
  "docs/phase1956p-alternative-provider-authorization-template.json",
  "docs/phase1956p-nvidia-route-repair-template.json",
  closurePath,
  gatePath,
  sealPath,
  phase1955SealPath,
  phase1955RetrySealPath,
  registryPath,
  readoutPath,
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
    {
      id: "direct_provider_client_import",
      pattern: new RegExp([
        ["create", "Nvidia", "Unified", "Client"].join(""),
        ["create", "Open", "AI"].join(""),
        ["Open", "Router"].join(""),
        ["Cl", "aude"].join(""),
        ["Mi", "Mo"].join(""),
        ["Volc", "engine"].join(""),
      ].join("|"), "u"),
    },
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
    check(`${prefix}_request_attempt_this_phase_zero`, Number(record.requestAttemptCountInThisPhase ?? -1) === 0),
    check(`${prefix}_provider_calls_made_false`, record.providerCallsMade === false),
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

const phase1955Read = readJson(phase1955SealPath);
const phase1955RetryRead = readJson(phase1955RetrySealPath);
const closureRead = readJson(closurePath);
const gateRead = readJson(gatePath);
const sealRead = readJson(sealPath);
const alternativeTemplateRead = readJson("docs/phase1956p-alternative-provider-authorization-template.json");
const nvidiaRepairTemplateRead = readJson("docs/phase1956p-nvidia-route-repair-template.json");

const phase1955 = phase1955Read.data ?? {};
const retry = phase1955RetryRead.data ?? {};
const closure = closureRead.data ?? {};
const gate = gateRead.data ?? {};
const seal = sealRead.data ?? {};
const alternativeTemplate = alternativeTemplateRead.data ?? {};
const nvidiaRepairTemplate = nvidiaRepairTemplateRead.data ?? {};
const runtimeHits = [runnerPath, verifierPath, registryPath, readoutPath].flatMap(findForbiddenRuntimeHits);

const atoms = getSyntheticCapabilityAtoms();
const providerAtom = atoms.find((atom) => atom.title === "provider_stability_check") ?? {};
const readout = createTianshuCapabilityReadout(undefined, atoms);
const rejectedProviderAtom = readout.rejectedAtoms?.find((atom) => atom.title === "provider_stability_check") ?? {};

const routeA = gate.routes?.find((route) => route.routeId === "A") ?? {};
const routeB = gate.routes?.find((route) => route.routeId === "B") ?? {};
const routeC = gate.routes?.find((route) => route.routeId === "C") ?? {};

const checks = [
  ...requiredFiles.map((file) => check(`file_exists:${file}`, pathExists(file))),
  check("phase1955_evidence_parseable", phase1955Read.exists === true && phase1955Read.parseError === null),
  check("phase1955_retry_evidence_parseable", phase1955RetryRead.exists === true && phase1955RetryRead.parseError === null),
  check("closure_parseable", closureRead.exists === true && closureRead.parseError === null),
  check("gate_parseable", gateRead.exists === true && gateRead.parseError === null),
  check("seal_parseable", sealRead.exists === true && sealRead.parseError === null),
  check("phase1955_timeout_evidence", phase1955.failureReason === "nvidia_request_timeout" && Number(phase1955.requestAttemptCount ?? 0) === 1),
  check("phase1955_retry_timeout_evidence", retry.failureReason === "nvidia_request_timeout" && Number(retry.requestAttemptCount ?? 0) === 1),
  check("phase_completed", seal.completed === true),
  check("phase_recommended_sealed", seal.recommended_sealed === true),
  check("phase_blocker_null", seal.blocker === null),
  check("nvidia_route_failure_closed", seal.nvidiaRouteFailureClosed === true && closure.nvidiaRouteFailureClosed === true),
  check("nvidia_route_status_timeout_blocked", seal.nvidiaRouteStatus === "timeout_blocked" && closure.nvidiaRouteStatus === "timeout_blocked"),
  check("nvidia_request_attempt_total_two", Number(seal.nvidiaRequestAttemptTotal ?? 0) === 2),
  check("nvidia_success_total_zero", Number(seal.nvidiaSuccessTotal ?? -1) === 0),
  check("nvidia_timeout_count_two", Number(seal.nvidiaTimeoutCount ?? 0) === 2),
  check("phase1955_evidence_imported", seal.phase1955EvidenceImported === true),
  check("phase1955_retry_evidence_imported", seal.phase1955RetryEvidenceImported === true),
  check("failure_reason_preserved", seal.failureReason === "nvidia_request_timeout"),
  check("timeout_stage_preserved", seal.timeoutStage === "provider_fetch_or_response_wait_timeout"),
  check("alternative_provider_gate_generated", seal.alternativeProviderDecisionGateGenerated === true && gate.alternativeProviderDecisionGateGenerated === true),
  check("next_route_options_generated", seal.nextRouteOptionsGenerated === true && Array.isArray(gate.routes) && gate.routes.length === 3),
  check("route_a_nvidia_repair", routeA.title === "NVIDIA Route Repair" && routeA.status === "recommended_first" && routeA.realProviderCall === false && routeA.nextPhase === "Phase1956P-NVIDIA-Route-Repair"),
  check("route_b_alternative_provider", routeB.title === "Alternative Provider Authorization" && routeB.status === "available_after_owner_approval" && routeB.realProviderCall === false && routeB.nextPhase === "Phase1956P-AlternativeProvider-Authorization"),
  check("route_c_synthetic_fallback", routeC.title === "Local Synthetic Provider Fallback" && routeC.status === "safe_dry_run_only" && routeC.realProviderCall === false && routeC.nextPhase === "Phase1956P-LocalSyntheticProviderFallback"),
  check("nvidia_route_repair_template_generated", seal.nvidiaRouteRepairTemplateGenerated === true && nvidiaRepairTemplate.phase === "Phase1956P-NVIDIA-Route-Repair"),
  check("alternative_provider_authorization_template_generated", seal.alternativeProviderAuthorizationTemplateGenerated === true && alternativeTemplate.phase === "Phase1956P-AlternativeProvider-Authorization"),
  check("templates_do_not_authorize_calls", alternativeTemplate.allowProviderCall === false && nvidiaRepairTemplate.allowProviderCall === false),
  check("tianshu_provider_blocker_updated", seal.tianshuProviderStabilityBlockerUpdated === true && providerAtom.blocker === "provider_stability_not_verified"),
  check("tianshu_timeout_blocker_explained", /timeout_blocked/u.test(providerAtom.blockerExplanation ?? "") && /timeout_blocked/u.test(rejectedProviderAtom.blockerExplanation ?? "")),
  check("tianshu_evidence_refs_include_retry_fail", providerAtom.evidenceRefs?.includes(sealPath)),
  check("provider_stability_not_verified", seal.providerStabilityVerified === false),
  check("one_shot_provider_call_not_passed", seal.oneShotProviderCallPassed === false),
  check("multi_provider_stability_not_verified", seal.multiProviderStabilityVerified === false),
  check("forbidden_runtime_patterns_absent", runtimeHits.length === 0, { runtimeHits }),
  ...safetyChecks(seal, "seal"),
  ...safetyChecks(closure, "closure"),
  ...safetyChecks(gate, "gate"),
];

const verified = allPassed(checks);
const result = {
  phase: "Phase1955P-Retry-Fail",
  name: "NVIDIA Provider Route Failure Closure Verification",
  completed: true,
  recommended_sealed: verified,
  blocker: verified ? null : "phase1955p_retry_fail_verification_failed",
  nvidiaRouteFailureClosed: seal.nvidiaRouteFailureClosed === true,
  nvidiaRouteStatus: seal.nvidiaRouteStatus ?? null,
  nvidiaRequestAttemptTotal: Number(seal.nvidiaRequestAttemptTotal ?? 0),
  nvidiaSuccessTotal: Number(seal.nvidiaSuccessTotal ?? 0),
  nvidiaTimeoutCount: Number(seal.nvidiaTimeoutCount ?? 0),
  newProviderCallExecuted: seal.newProviderCallExecuted === true,
  requestAttemptCountInThisPhase: Number(seal.requestAttemptCountInThisPhase ?? 0),
  providerCallsMade: seal.providerCallsMade === true,
  alternativeProviderDecisionGateGenerated: seal.alternativeProviderDecisionGateGenerated === true,
  tianshuProviderStabilityBlockerUpdated: seal.tianshuProviderStabilityBlockerUpdated === true,
  providerStabilityVerified: seal.providerStabilityVerified === true,
  checks,
};

console.log(JSON.stringify(result, null, 2));

if (!verified) {
  process.exitCode = 1;
}
