import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import { pathToFileURL } from "node:url";

const repoRoot = process.cwd();

const phase3957ResultPath =
  "apps/ai-gateway-service/evidence/phase3957a-controlled-mutation-hard-stop/result.json";
const resultPath =
  "apps/ai-gateway-service/evidence/phase3958a-product-reality-baseline-compression/result.json";
const docPath = "docs/phase3958a-product-reality-baseline-compression.md";
const packageJsonPath = "package.json";
const allowedHardStopReferences = new Set([
  "docs/phase3957a-controlled-mutation-hard-stop.md",
  "apps/ai-gateway-service/evidence/phase3957a-controlled-mutation-hard-stop/result.json",
  "tools/phase3957a/verify-controlled-mutation-hard-stop.mjs",
]);

const forbiddenControlledFiftySevenPattern = new RegExp(
  ["controlled", "fifty-seven", "tool", "mutation"].join("-"),
  "i",
);
const forbiddenPhase3958To4018MarkerPattern =
  /PHASE(?:395[8-9]|39[6-9]\d|40[0-1]\d|4018)_(?:CONTROLLED|FIFTY|MUTATION|TOOL)/i;

function fullPath(relativePath) {
  return resolve(repoRoot, relativePath);
}

function readJson(relativePath) {
  return JSON.parse(readFileSync(fullPath(relativePath), "utf8"));
}

function readText(relativePath) {
  return readFileSync(fullPath(relativePath), "utf8");
}

function listFiles(rootRelativePath) {
  const root = fullPath(rootRelativePath);
  if (!existsSync(root)) return [];
  const files = [];
  const stack = [root];

  while (stack.length > 0) {
    const current = stack.pop();
    for (const entry of readdirSync(current, { withFileTypes: true })) {
      if ([".git", "legacy", "node_modules"].includes(entry.name)) continue;
      const entryPath = join(current, entry.name);
      if (entry.isDirectory()) {
        stack.push(entryPath);
      } else if (entry.isFile()) {
        files.push(relative(repoRoot, entryPath).replaceAll("\\", "/"));
      }
    }
  }

  return files.sort();
}

function scanForbiddenExpansionArtifacts() {
  const scanRoots = ["docs", "tools", "apps/ai-gateway-service/evidence"];
  const matches = [];

  for (const root of scanRoots) {
    for (const file of listFiles(root)) {
      if (file === docPath || file === resultPath) continue;
      if (file.includes("/phase3958a/")) continue;
      if (allowedHardStopReferences.has(file)) continue;
      if (forbiddenControlledFiftySevenPattern.test(file)) {
        matches.push({ file, reason: "controlled_fifty_seven_path" });
      }

      if (!/\.(mjs|js|json|md|diff)$/.test(file)) continue;
      const text = readText(file);
      if (forbiddenControlledFiftySevenPattern.test(text)) {
        matches.push({ file, reason: "controlled_fifty_seven_text" });
      }
      if (file.startsWith("tools/") && forbiddenPhase3958To4018MarkerPattern.test(text)) {
        matches.push({ file, reason: "phase3958_4018_controlled_marker_in_tool_source" });
      }
    }
  }

  return matches;
}

function countNextPhaseItems(doc) {
  const matches = doc.match(/phaseName:/g);
  return matches ? matches.length : 0;
}

export function verifyProductRealityBaseline() {
  const checks = [];
  const pass = (id, details = null) => checks.push({ id, passed: true, details });
  const fail = (id, details = null) => checks.push({ id, passed: false, details });
  const check = (id, condition, details = null) => (condition ? pass(id, details) : fail(id, details));

  const phase3957Exists = existsSync(fullPath(phase3957ResultPath));
  check("phase3957a_evidence_exists", phase3957Exists);
  const phase3957 = phase3957Exists ? readJson(phase3957ResultPath) : {};
  check("phase3957a_completed", phase3957.completed === true);
  check("phase3957a_recommended_sealed", phase3957.recommendedSealed === true);
  check("phase3957a_blocker_null", phase3957.blocker === null);
  check("controlled_mutation_hard_cap_56", phase3957.controlledMutationHardCap === 56);
  check("expansion_to_57_disallowed", phase3957.expansionTo57Allowed === false);
  check("product_work_redirect_required", phase3957.productWorkRedirectRequired === true);

  const forbiddenMatches = scanForbiddenExpansionArtifacts();
  check("no_controlled_fifty_seven_artifacts", forbiddenMatches.length === 0, forbiddenMatches);

  const docExists = existsSync(fullPath(docPath));
  check("product_reality_baseline_doc_exists", docExists);
  const doc = docExists ? readText(docPath) : "";
  check("doc_has_verified_capabilities_section", doc.includes("## A. 已真实具备的能力"));
  check("doc_has_dry_run_mock_template_section", doc.includes("## B. dry-run / mock / template 能力"));
  check("doc_has_unverified_real_validation_section", doc.includes("## C. 未完成真实验证的能力"));
  check("doc_has_forbidden_claims_section", doc.includes("## D. 禁止误称的能力"));
  check("doc_has_p0_p1_p2_blocker_section", doc.includes("## E. P0/P1/P2 blocker"));
  check(
    "doc_has_next_product_work_phase_section",
    doc.includes("## F. 下一轮最多 10 个 Product Work Mode 阶段"),
  );
  check("doc_mentions_no_production_ready_claim", doc.includes("不得声称 production ready"));
  check("doc_mentions_no_provider_stability_claim", doc.includes("不得声称多 Provider 已稳定商用"));
  check("doc_mentions_controlled_mutation_no_ux_claim", doc.includes("controlled mutation 提升了产品体验"));
  check("next_product_work_phase_count_at_most_10", countNextPhaseItems(doc) <= 10, {
    count: countNextPhaseItems(doc),
  });

  const resultExists = existsSync(fullPath(resultPath));
  check("product_reality_baseline_result_exists", resultExists);
  const result = resultExists ? readJson(resultPath) : {};
  check("completed_true", result.completed === true);
  check("recommended_sealed_true", result.recommendedSealed === true);
  check("blocker_null", result.blocker === null);
  check("phase_name_correct", result.phase === "Phase3958A-ProductRealityBaselineCompression");
  check("controlled_mutation_hard_cap_respected", result.controlledMutationHardCapRespected === true);
  check("controlled_mutation_expansion_not_attempted", result.controlledMutationExpansionAttempted === false);
  check("product_reality_baseline_generated", result.productRealityBaselineGenerated === true);
  check("production_ready_not_claimed", result.productionReadyClaimed === false);
  check("provider_stability_not_claimed", result.providerStabilityClaimed === false);
  check("owner_dogfooding_not_claimed_complete", result.ownerDogfoodingClaimedComplete === false);
  check("deploy_not_claimed", result.deployClaimed === false);
  check("dry_run_mock_template_separated", result.dryRunMockTemplateClearlySeparated === true);
  check("max_next_product_work_phases_10", result.maxNextProductWorkPhases === 10);
  check("provider_calls_false", result.providerCallsMade === false);
  check("secret_read_false", result.secretRead === false);
  check("chat_modified_false", result.chatModified === false);
  check("chat_gateway_execute_modified_false", result.chatGatewayExecuteModified === false);
  check("legacy_modified_false", result.legacyModified === false);
  check("project_context_modified_false", result.projectContextModified === false);
  check("deploy_executed_false", result.deployExecuted === false);
  check("workspace_clean_claimed_false", result.workspaceCleanClaimed === false);

  const pkg = existsSync(fullPath(packageJsonPath)) ? readJson(packageJsonPath) : {};
  check(
    "package_run_script_exists",
    pkg.scripts?.["run:phase3958a-product-reality-baseline"] ===
      "node tools/phase3958a/generate-product-reality-baseline.mjs",
  );
  check(
    "package_verify_script_exists",
    pkg.scripts?.["verify:phase3958a-product-reality-baseline"] ===
      "node tools/phase3958a/verify-product-reality-baseline.mjs",
  );

  const completed = checks.every((entry) => entry.passed);
  return {
    phase: "Phase3958A-ProductRealityBaselineCompression",
    status: completed ? "passed" : "failed",
    completed,
    recommendedSealed: completed,
    blocker: completed ? null : checks.filter((entry) => !entry.passed).map((entry) => entry.id).join(", "),
    controlledMutationHardCapRespected: result.controlledMutationHardCapRespected ?? null,
    controlledMutationExpansionAttempted: result.controlledMutationExpansionAttempted ?? null,
    productRealityBaselineGenerated: result.productRealityBaselineGenerated ?? null,
    providerCallsMade: false,
    secretRead: false,
    chatModified: false,
    chatGatewayExecuteModified: false,
    deployExecuted: false,
    checks,
  };
}

export function main() {
  const result = verifyProductRealityBaseline();
  console.log(JSON.stringify({
    status: result.status,
    completed: result.completed,
    recommendedSealed: result.recommendedSealed,
    blocker: result.blocker,
    controlledMutationHardCapRespected: result.controlledMutationHardCapRespected,
    controlledMutationExpansionAttempted: result.controlledMutationExpansionAttempted,
    productRealityBaselineGenerated: result.productRealityBaselineGenerated,
  }, null, 2));
  if (!result.completed) process.exit(1);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main();
}
