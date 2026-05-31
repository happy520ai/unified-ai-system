import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

const repoRoot = process.cwd();
const docPath = "docs/phase3969a-product-work-mode-rollback-drill-dry-run.md";
const resultPath = "apps/ai-gateway-service/evidence/phase3969a-product-work-mode-rollback-drill-dry-run/result.json";

function readJson(relativePath) {
  return JSON.parse(readFileSync(resolve(repoRoot, relativePath), "utf8"));
}

function readText(relativePath) {
  return readFileSync(resolve(repoRoot, relativePath), "utf8");
}

export function verifyProductWorkRollbackDrillDryRun() {
  const checks = [];
  const check = (id, passed, details = null) => checks.push({ id, passed, details });
  check("doc_exists", existsSync(resolve(repoRoot, docPath)));
  check("result_exists", existsSync(resolve(repoRoot, resultPath)));
  const doc = existsSync(resolve(repoRoot, docPath)) ? readText(docPath) : "";
  for (const phase of ["Phase3959A", "Phase3960A", "Phase3961A", "Phase3962A", "Phase3963A", "Phase3964A", "Phase3965A", "Phase3966A", "Phase3967A", "Phase3968A"]) {
    check(`doc_covers:${phase}`, doc.includes(phase));
  }
  const result = existsSync(resolve(repoRoot, resultPath)) ? readJson(resultPath) : {};
  check("completed_true", result.completed === true);
  check("recommended_sealed_true", result.recommendedSealed === true);
  check("blocker_null", result.blocker === null);
  check("rollback_dry_run_generated", result.rollbackDrillDryRunGenerated === true);
  check("real_rollback_false", result.realRollbackExecuted === false);
  check("files_deleted_false", result.filesDeleted === false);
  check("provider_calls_false", result.providerCallsMade === false);
  check("secret_read_false", result.secretRead === false);
  check("deploy_false", result.deployExecuted === false);

  const pkg = readJson("package.json");
  check(
    "package_run_script",
    pkg.scripts?.["run:phase3969a-product-work-rollback-drill-dry-run"] ===
      "node tools/phase3969a/generate-product-work-rollback-drill-dry-run.mjs",
  );
  check(
    "package_verify_script",
    pkg.scripts?.["verify:phase3969a-product-work-rollback-drill-dry-run"] ===
      "node tools/phase3969a/verify-product-work-rollback-drill-dry-run.mjs",
  );

  const completed = checks.every((entry) => entry.passed);
  return {
    phase: "Phase3969A-RollbackDrillDryRunForProductWorkMode",
    status: completed ? "sealed/pass" : "failed",
    completed,
    recommendedSealed: completed,
    blocker: completed ? null : checks.filter((entry) => !entry.passed).map((entry) => entry.id).join(", "),
    rollbackDrillDryRunGenerated: result.rollbackDrillDryRunGenerated ?? false,
    providerCallsMade: false,
    secretRead: false,
    checks,
  };
}

export function main() {
  const result = verifyProductWorkRollbackDrillDryRun();
  console.log(JSON.stringify({
    status: result.status,
    completed: result.completed,
    recommendedSealed: result.recommendedSealed,
    blocker: result.blocker,
    rollbackDrillDryRunGenerated: result.rollbackDrillDryRunGenerated,
  }, null, 2));
  if (!result.completed) process.exit(1);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main();
}
