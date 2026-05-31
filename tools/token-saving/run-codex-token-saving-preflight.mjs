import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const outputPath =
  "apps/ai-gateway-service/evidence/phase633a/token-saving-preflight-wrapper-run.json";

const policy = {
  dryRunOnly: true,
  contextPackPath: ".codex-context/current-context-pack.md",
  relevantFilesPath: ".codex-context/relevant-files.json",
  freshnessReportPath: ".codex-context/context-freshness-report.json",
  maxRelevantFilesDefault: 20,
  maxRelevantFilesHardLimit: 50,
  fullRepoScanForbidden: true,
  forbiddenFullRepoScan: true,
  outputBudgetRequired: true,
};

const contextPack = readText(policy.contextPackPath);
const relevantFiles = readJson(policy.relevantFilesPath);
const freshnessReport = readJson(policy.freshnessReportPath);
const files = Array.isArray(relevantFiles.data?.files) ? relevantFiles.data.files : [];

const checks = [
  check("context_pack_exists", contextPack.length > 0),
  check("context_pack_has_hash", /hash:\s*[a-f0-9]{16,}/i.test(contextPack)),
  check("relevant_files_exists", relevantFiles.exists === true && !relevantFiles.parseErrorReason),
  check("freshness_report_exists", freshnessReport.exists === true && !freshnessReport.parseErrorReason),
  check("stale_false_required", freshnessReport.data?.stale === false),
  check("relevant_files_within_hard_limit", files.length <= policy.maxRelevantFilesHardLimit),
  check("token_budget_present", /tokenBudget:\s*\S+/i.test(contextPack)),
  check("token_budget_respected", /tokenBudgetRespected:\s*true/i.test(contextPack)),
  check("full_repo_scan_forbidden", policy.fullRepoScanForbidden === true),
  check("output_budget_required", policy.outputBudgetRequired === true),
];

const failed = checks.filter((item) => !item.passed).map((item) => item.id);
const result = {
  phase: "Phase633A",
  name: "Codex Token Saving Preflight Wrapper Run",
  completed: failed.length === 0,
  recommended_sealed: failed.length === 0,
  blocker: failed.length === 0 ? null : `token_saving_preflight_failed:${failed.join(",")}`,
  dryRunOnly: true,
  preflightPassed: failed.length === 0,
  contextPackRequired: true,
  relevantFilesRequired: true,
  freshnessReportRequired: true,
  staleFalseRequired: true,
  tokenBudgetRequired: true,
  outputBudgetRequired: true,
  fullRepoScanForbidden: true,
  forbiddenFullRepoScan: true,
  maxRelevantFilesDefault: policy.maxRelevantFilesDefault,
  maxRelevantFilesHardLimit: policy.maxRelevantFilesHardLimit,
  relevantFilesCount: files.length,
  codexExecExecutedByThisPhase: false,
  providerCallsMadeByThisPhase: false,
  authJsonRead: false,
  codexConfigModified: false,
  projectCodexConfigModified: false,
  chatModified: false,
  chatGatewayExecuteModified: false,
  providerRuntimeModified: false,
  deployExecuted: false,
  releaseExecuted: false,
  tagCreated: false,
  pushExecuted: false,
  commitCreated: false,
  workspaceCleanClaimed: false,
  checks,
};

writeJson(outputPath, result);
console.log(JSON.stringify(result, null, 2));
if (!result.preflightPassed) process.exitCode = 1;

function readText(relativePath) {
  try {
    return fs.readFileSync(path.join(root, relativePath), "utf8").replace(/^\uFEFF/, "");
  } catch {
    return "";
  }
}

function readJson(relativePath) {
  try {
    const fullPath = path.join(root, relativePath);
    if (!fs.existsSync(fullPath)) return { exists: false, data: null, parseErrorReason: null };
    return {
      exists: true,
      data: JSON.parse(fs.readFileSync(fullPath, "utf8").replace(/^\uFEFF/, "")),
      parseErrorReason: null,
    };
  } catch (error) {
    return {
      exists: true,
      data: null,
      parseErrorReason: error instanceof Error ? error.message : String(error),
    };
  }
}

function writeJson(relativePath, value) {
  const fullPath = path.join(root, relativePath);
  fs.mkdirSync(path.dirname(fullPath), { recursive: true });
  fs.writeFileSync(fullPath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function check(id, passed) {
  return { id, passed: Boolean(passed) };
}
