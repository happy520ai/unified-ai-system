import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

const repoRoot = process.cwd();
const docPath = "docs/phase3970a-product-work-mode-seal-review.md";
const resultPath = "apps/ai-gateway-service/evidence/phase3970a-product-work-mode-seal-review/result.json";

function readJson(relativePath) {
  return JSON.parse(readFileSync(resolve(repoRoot, relativePath), "utf8"));
}

function readText(relativePath) {
  return readFileSync(resolve(repoRoot, relativePath), "utf8");
}

export function verifyProductWorkModeSealReview() {
  const checks = [];
  const check = (id, passed, details = null) => checks.push({ id, passed, details });
  check("doc_exists", existsSync(resolve(repoRoot, docPath)));
  check("result_exists", existsSync(resolve(repoRoot, resultPath)));
  const doc = existsSync(resolve(repoRoot, docPath)) ? readText(docPath) : "";
  for (const section of [
    "## A. Completed",
    "## B. Recommended Seal",
    "## C. Still Blocked",
    "## D. Cannot Misclaim",
    "## E. Owner Inputs Required Next",
    "## F. Real Provider Smoke Allowed Next",
    "## G. Real Deploy Allowed",
    "## H. /chat Or /chat-gateway/execute Change Allowed",
  ]) {
    check(`doc_section:${section}`, doc.includes(section));
  }
  const result = existsSync(resolve(repoRoot, resultPath)) ? readJson(resultPath) : {};
  check("completed_true", result.completed === true);
  check("recommended_sealed_true", result.recommendedSealed === true);
  check("blocker_null", result.blocker === null);
  check("phase_range_reviewed", result.phaseRangeReviewed === "Phase3959A-3969A");
  check("owner_dogfooding_not_claimed", result.ownerDogfoodingClaimedComplete === false);
  check("provider_stability_not_claimed", result.providerStabilityClaimed === false);
  check("production_ready_not_claimed", result.productionReadyClaimed === false);
  check("deploy_not_claimed", result.deployClaimed === false);
  check("real_provider_smoke_not_allowed_next", result.realProviderSmokeAllowedNext === false);
  check("owner_approval_required", result.ownerApprovalRequiredForRealProviderSmoke === true);
  check("provider_calls_false", result.providerCallsMade === false);
  check("secret_read_false", result.secretRead === false);
  check("deploy_false", result.deployExecuted === false);
  check("chat_modified_false", result.chatModified === false);
  check("chat_gateway_execute_modified_false", result.chatGatewayExecuteModified === false);

  const pkg = readJson("package.json");
  check(
    "package_run_script",
    pkg.scripts?.["run:phase3970a-product-work-mode-seal-review"] ===
      "node tools/phase3970a/generate-product-work-mode-seal-review.mjs",
  );
  check(
    "package_verify_script",
    pkg.scripts?.["verify:phase3970a-product-work-mode-seal-review"] ===
      "node tools/phase3970a/verify-product-work-mode-seal-review.mjs",
  );

  const completed = checks.every((entry) => entry.passed);
  return {
    phase: "Phase3970A-ProductWorkModeSealReview",
    status: completed ? "sealed/pass" : "failed",
    completed,
    recommendedSealed: completed,
    blocker: completed ? null : checks.filter((entry) => !entry.passed).map((entry) => entry.id).join(", "),
    phaseRangeReviewed: result.phaseRangeReviewed ?? null,
    providerCallsMade: false,
    secretRead: false,
    checks,
  };
}

export function main() {
  const result = verifyProductWorkModeSealReview();
  console.log(JSON.stringify({
    status: result.status,
    completed: result.completed,
    recommendedSealed: result.recommendedSealed,
    blocker: result.blocker,
    phaseRangeReviewed: result.phaseRangeReviewed,
  }, null, 2));
  if (!result.completed) process.exit(1);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main();
}
