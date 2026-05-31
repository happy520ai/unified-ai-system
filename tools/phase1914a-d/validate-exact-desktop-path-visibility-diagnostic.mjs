import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const repoRoot = process.cwd();
const resultPath = "apps/ai-gateway-service/evidence/phase1914a-d/exact-desktop-path-visibility-diagnostic-result.json";
const allowedClassifications = new Set([
  "all_exact_paths_visible",
  "all_exact_paths_missing",
  "partial_exact_paths_visible",
  "desktop_directory_not_visible_to_process",
  "evidence_created_file_paths_missing",
  "diagnostic_error",
]);

function repoPath(relativePath) {
  return resolve(repoRoot, relativePath);
}

function check(id, passed) {
  return { id, passed: Boolean(passed) };
}

const exists = existsSync(repoPath(resultPath));
const result = exists ? JSON.parse(readFileSync(repoPath(resultPath), "utf8")) : {};
const checks = [
  check("result_exists", exists),
  check("completed_true", result.completed === true),
  check("diagnostic_only_true", result.diagnosticOnly === true),
  check("exact_path_checks_only_true", result.exactPathChecksOnly === true),
  check("desktop_scanned_false", result.desktopScanned === false),
  check("desktop_file_list_read_false", result.desktopFileListRead === false),
  check("desktop_file_content_read_false", result.desktopFileContentRead === false),
  check("new_desktop_file_created_false", result.newDesktopFileCreated === false),
  check("overwrite_false", result.overwritePerformed === false),
  check("provider_false", result.providerCallsMade === false),
  check("secret_false", result.secretValueExposed === false),
  check("raw_secret_false", result.rawSecretRead === false),
  check("auth_json_false", result.authJsonRead === false),
  check("deploy_false", result.deployExecuted === false),
  check("release_false", result.releaseExecuted === false),
  check("tag_false", result.tagCreated === false),
  check("artifact_false", result.artifactUploaded === false),
  check("commit_false", result.commitCreated === false),
  check("push_false", result.pushExecuted === false),
  check("chat_gateway_execute_false", result.chatGatewayExecuteModified === false),
  check("legacy_false", result.legacyModified === false),
  check("project_context_false", result.projectContextModified === false),
  check("workspace_clean_false", result.workspaceCleanClaimed === false),
  check("production_ready_false", result.productionReadyClaimed === false),
  check("classification_allowed", allowedClassifications.has(result.diagnosisClassification)),
  check("exact_path_results_array", Array.isArray(result.exactPathResults)),
  check("process_visibility_present", result.processVisibility && typeof result.processVisibility === "object"),
  check("full_env_dump_absent", !Object.prototype.hasOwnProperty.call(result, "fullEnvDump")),
];

const passed = checks.every((item) => item.passed);
const validationResult = {
  phase: "Phase1914A-D",
  name: "Exact Desktop Path Visibility Diagnostic",
  completed: passed,
  recommended_sealed: passed,
  blocker: passed ? null : checks.find((item) => !item.passed)?.id ?? "validation_failed",
  diagnosisClassification: result.diagnosisClassification ?? null,
  exactPathResultCount: Array.isArray(result.exactPathResults) ? result.exactPathResults.length : 0,
  desktopScanned: result.desktopScanned === true,
  desktopFileListRead: result.desktopFileListRead === true,
  desktopFileContentRead: result.desktopFileContentRead === true,
  newDesktopFileCreated: result.newDesktopFileCreated === true,
  providerCallsMade: result.providerCallsMade === true,
  secretValueExposed: result.secretValueExposed === true,
  authJsonRead: result.authJsonRead === true,
  chatGatewayExecuteModified: result.chatGatewayExecuteModified === true,
  legacyModified: result.legacyModified === true,
  projectContextModified: result.projectContextModified === true,
  checks,
};

console.log(JSON.stringify(validationResult, null, 2));
if (!validationResult.completed || !validationResult.recommended_sealed || validationResult.blocker) {
  process.exitCode = 1;
}
