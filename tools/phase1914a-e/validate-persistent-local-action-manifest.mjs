import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { check } from "../phase1903a/ownerAutomationSealCommon.mjs";

const root = process.cwd();
const manifestPath = join(
  root,
  "apps/ai-gateway-service/evidence/phase1914a/persistent-local-action-manifest.json",
);
const resultPath = join(
  root,
  "apps/ai-gateway-service/evidence/phase1914a-e/persistent-local-action-manifest-result.json",
);

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8"));
}

const manifestExists = existsSync(manifestPath);
const resultExists = existsSync(resultPath);
let manifest = null;
let result = null;
let manifestParseable = false;
let resultParseable = false;

try {
  manifest = manifestExists ? readJson(manifestPath) : null;
  manifestParseable = manifest !== null;
} catch {
  manifestParseable = false;
}

try {
  result = resultExists ? readJson(resultPath) : null;
  resultParseable = result !== null;
} catch {
  resultParseable = false;
}

const safetyChecks = [
  ["desktop_files_recreated_false", result?.desktopFilesRecreated === false],
  ["desktop_scanned_false", result?.desktopScanned === false],
  ["desktop_file_list_read_false", result?.desktopFileListRead === false],
  ["desktop_file_content_read_false", result?.desktopFileContentRead === false],
  ["provider_false", result?.providerCallsMade === false],
  ["secret_false", result?.secretValueExposed === false],
  ["raw_secret_false", result?.rawSecretRead === false],
  ["auth_json_false", result?.authJsonRead === false],
  ["deploy_false", result?.deployExecuted === false],
  ["release_false", result?.releaseExecuted === false],
  ["tag_false", result?.tagCreated === false],
  ["artifact_false", result?.artifactUploaded === false],
  ["commit_false", result?.commitCreated === false],
  ["push_false", result?.pushExecuted === false],
  ["chat_gateway_execute_false", result?.chatGatewayExecuteModified === false],
  ["legacy_false", result?.legacyModified === false],
  ["project_context_false", result?.projectContextModified === false],
  ["workspace_clean_false", result?.workspaceCleanClaimed === false],
  ["production_ready_false", result?.productionReadyClaimed === false],
];

const checks = [
  check("manifest_exists", manifestExists),
  check("manifest_parseable", manifestParseable),
  check("result_exists", resultExists),
  check("result_parseable", resultParseable),
  check("manifest_current_exact_desktop_files_exist_false", manifest?.currentExactDesktopFilesExist === false),
  check("manifest_missing_acknowledged_true", manifest?.currentDesktopFilesMissingAcknowledged === true),
  check("manifest_do_not_claim_current_files_exist_true", manifest?.doNotClaimCurrentDesktopFilesExist === true),
  check("manifest_do_not_recreate_true", manifest?.doNotRecreateFilesInThisPhase === true),
  check("manifest_latest_diagnostic_all_missing", manifest?.latestDiagnosticClassification === "all_exact_paths_missing"),
  check("manifest_created_paths_array", Array.isArray(manifest?.createdFilePathsFromLatestEvidence)),
  check("manifest_diagnostic_results_array", Array.isArray(manifest?.diagnosticExactPathResults)),
  check("result_completed_true", result?.completed === true),
  check("result_recommended_sealed_true", result?.recommended_sealed === true),
  check("result_blocker_null", result?.blocker === null),
  check("result_diagnostic_all_missing", result?.diagnosisClassification === "all_exact_paths_missing"),
  check("result_missing_acknowledged_true", result?.currentDesktopFilesMissingAcknowledged === true),
  check("result_manifest_generated_true", result?.persistentManifestGenerated === true),
  check("result_phase1914a_verifier_updated_true", result?.phase1914aVerifierUpdated === true),
  ...safetyChecks.map(([id, passed]) => check(id, passed)),
];

const passed = checks.every((item) => item.passed);
const output = {
  phase: "Phase1914A-E",
  name: "Persistent Local Action Evidence Manifest Validator",
  completed: passed,
  recommended_sealed: passed,
  blocker: passed ? null : "persistent_local_action_manifest_validation_failed",
  manifestPath,
  resultPath,
  checks,
};

console.log(JSON.stringify(output, null, 2));
if (!passed) {
  process.exitCode = 1;
}
