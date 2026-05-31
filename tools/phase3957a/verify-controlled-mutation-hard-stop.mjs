import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import { pathToFileURL } from "node:url";

const repoRoot = process.cwd();
const previousResultPath = "apps/ai-gateway-service/evidence/phase3896-3956-controlled-fifty-six-tool-mutation/result.json";
const resultPath = "apps/ai-gateway-service/evidence/phase3957a-controlled-mutation-hard-stop/result.json";
const docPath = "docs/phase3957a-controlled-mutation-hard-stop.md";
const packageJsonPath = "package.json";

const forbiddenPhaseMarkerPattern = /PHASE(?:39[5-9][7-9]|39[6-9]\d|40[0-1]\d|4017)_FIFTY_SEVEN_TOOL/i;
const forbiddenControlledFiftySevenPattern = /controlled-fifty-seven-tool-mutation/i;

function readJson(relativePath) {
  return JSON.parse(readFileSync(resolve(repoRoot, relativePath), "utf8"));
}

function readText(relativePath) {
  return readFileSync(resolve(repoRoot, relativePath), "utf8");
}

function listFiles(rootRelativePath) {
  const root = resolve(repoRoot, rootRelativePath);
  if (!existsSync(root)) return [];
  const files = [];
  const stack = [root];
  while (stack.length > 0) {
    const current = stack.pop();
    for (const entry of readdirSync(current, { withFileTypes: true })) {
      const fullPath = join(current, entry.name);
      if (entry.isDirectory()) {
        if (["legacy", "node_modules", ".git"].includes(entry.name)) continue;
        stack.push(fullPath);
      } else if (entry.isFile()) {
        files.push(relative(repoRoot, fullPath).replaceAll("\\", "/"));
      }
    }
  }
  return files.sort();
}

function scanForbiddenFiles() {
  const scanRoots = ["docs", "tools", "apps/ai-gateway-service/evidence"];
  const matches = [];
  for (const root of scanRoots) {
    for (const file of listFiles(root)) {
      if (file === docPath || file === resultPath) continue;
      if (file.includes("/phase3957a/")) continue;
      if (forbiddenControlledFiftySevenPattern.test(file)) {
        matches.push({ file, reason: "controlled_fifty_seven_path" });
      }
      if (!/\.(mjs|js|json|md|diff)$/.test(file)) continue;
      const text = readText(file);
      if (forbiddenControlledFiftySevenPattern.test(text)) {
        matches.push({ file, reason: "controlled_fifty_seven_text" });
      }
      if (file.startsWith("tools/") && forbiddenPhaseMarkerPattern.test(text)) {
        matches.push({ file, reason: "phase3957_4017_fifty_seven_marker_in_tool_source" });
      }
    }
  }
  return matches;
}

export function verifyControlledMutationHardStop() {
  const checks = [];
  const fail = (id, details = null) => checks.push({ id, passed: false, details });
  const pass = (id, details = null) => checks.push({ id, passed: true, details });
  const check = (id, condition, details = null) => (condition ? pass(id, details) : fail(id, details));

  const previousExists = existsSync(resolve(repoRoot, previousResultPath));
  check("previous_phase3896_3956_result_exists", previousExists);
  const previous = previousExists ? readJson(previousResultPath) : {};
  check("previous_status_passed", previous.status === "passed");
  check("previous_recommended_sealed", previous.recommendedSealed === true);
  check("previous_changed_file_count_56", previous.changedFileCount === 56);
  check("previous_fifty_six_mutation_applied", previous.fiftySixMutationApplied === true);

  const resultExists = existsSync(resolve(repoRoot, resultPath));
  check("hard_stop_result_exists", resultExists);
  const result = resultExists ? readJson(resultPath) : {};
  check("completed_true", result.completed === true);
  check("recommended_sealed_true", result.recommendedSealed === true);
  check("blocker_null", result.blocker === null);
  check("previous_phase_range", result.previousPhaseRange === "Phase3896A-3956A");
  check("previous_controlled_mutation_file_count_56", result.previousControlledMutationFileCount === 56);
  check("controlled_mutation_hard_cap_56", result.controlledMutationHardCap === 56);
  check("expansion_to_57_disallowed", result.expansionTo57Allowed === false);
  check("phase3957_to_4017_blocked", result.phase3957To4017ControlledMutationBlocked === true);
  check("product_work_redirect_required", result.productWorkRedirectRequired === true);
  check(
    "product_work_value_gate_required",
    result.productWorkValueGateRequiredBeforeAnyFurtherExpansion === true,
  );
  check("provider_calls_false", result.providerCallsMade === false);
  check("secret_read_false", result.secretRead === false);
  check("chat_modified_false", result.chatModified === false);
  check("chat_gateway_execute_modified_false", result.chatGatewayExecuteModified === false);
  check("legacy_modified_false", result.legacyModified === false);
  check("project_context_modified_false", result.projectContextModified === false);
  check("deploy_executed_false", result.deployExecuted === false);
  check("workspace_clean_claimed_false", result.workspaceCleanClaimed === false);

  const docExists = existsSync(resolve(repoRoot, docPath));
  check("hard_stop_doc_exists", docExists);
  const doc = docExists ? readText(docPath) : "";
  check("doc_mentions_56_cap", doc.includes("56 文件") || doc.includes("56 files"));
  check("doc_blocks_57", doc.includes("changedFileCount=57") && doc.includes("不得"));
  check("doc_redirects_product_work", doc.includes("Product Work Mode") && doc.includes("Self Evolution Governance"));

  const pkg = readJson(packageJsonPath);
  check(
    "package_script_exists",
    pkg.scripts?.["verify:phase3957a-controlled-mutation-hard-stop"] ===
      "node tools/phase3957a/verify-controlled-mutation-hard-stop.mjs",
  );

  const forbiddenMatches = scanForbiddenFiles();
  check("no_controlled_fifty_seven_docs_or_evidence", forbiddenMatches.length === 0, forbiddenMatches);

  const completed = checks.every((entry) => entry.passed);
  const verifierResult = {
    phaseId: "Phase3957A-ControlledMutationExpansionHardStopAndProductWorkRedirect",
    status: completed ? "passed" : "failed",
    blocker: completed ? null : checks.filter((entry) => !entry.passed).map((entry) => entry.id).join(", "),
    completed,
    recommendedSealed: completed,
    controlledMutationHardCap: result.controlledMutationHardCap ?? null,
    expansionTo57Allowed: result.expansionTo57Allowed ?? null,
    phase3957To4017ControlledMutationBlocked: result.phase3957To4017ControlledMutationBlocked ?? null,
    productWorkRedirectRequired: result.productWorkRedirectRequired ?? null,
    providerCallsMade: false,
    secretRead: false,
    chatModified: false,
    chatGatewayExecuteModified: false,
    checks,
  };

  if (resultExists) {
    const merged = {
      ...result,
      verifierStatus: verifierResult.status,
      verifierBlocker: verifierResult.blocker,
      verifierChecks: checks,
    };
    writeFileSync(resolve(repoRoot, resultPath), `${JSON.stringify(merged, null, 2)}\n`, "utf8");
  }

  return verifierResult;
}

export function main() {
  const result = verifyControlledMutationHardStop();
  console.log(JSON.stringify({
    status: result.status,
    blocker: result.blocker,
    completed: result.completed,
    recommendedSealed: result.recommendedSealed,
    controlledMutationHardCap: result.controlledMutationHardCap,
    expansionTo57Allowed: result.expansionTo57Allowed,
    phase3957To4017ControlledMutationBlocked: result.phase3957To4017ControlledMutationBlocked,
    productWorkRedirectRequired: result.productWorkRedirectRequired,
  }, null, 2));
  if (!result.completed) process.exit(1);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main();
}
