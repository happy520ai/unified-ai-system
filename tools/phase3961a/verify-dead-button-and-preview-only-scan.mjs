import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

const repoRoot = process.cwd();
const docPath = "docs/phase3961a-dead-button-and-preview-only-full-scan.md";
const resultPath = "apps/ai-gateway-service/evidence/phase3961a-dead-button-and-preview-only-full-scan/result.json";

function readJson(relativePath) {
  return JSON.parse(readFileSync(resolve(repoRoot, relativePath), "utf8"));
}

function readText(relativePath) {
  return readFileSync(resolve(repoRoot, relativePath), "utf8");
}

export function verifyDeadButtonAndPreviewOnlyScan() {
  const checks = [];
  const check = (id, passed, details = null) => checks.push({ id, passed, details });
  check("doc_exists", existsSync(resolve(repoRoot, docPath)));
  check("result_exists", existsSync(resolve(repoRoot, resultPath)));
  const doc = existsSync(resolve(repoRoot, docPath)) ? readText(docPath) : "";
  check("doc_mentions_dead_button_count", doc.includes("deadButtonCount"));
  check("doc_mentions_preview_only_count", doc.includes("previewOnlyButtonCount"));
  const result = existsSync(resolve(repoRoot, resultPath)) ? readJson(resultPath) : {};
  check("completed_true", result.completed === true);
  check("recommended_sealed_true", result.recommendedSealed === true);
  check("blocker_null", result.blocker === null);
  check("scan_completed", result.deadButtonScanCompleted === true);
  for (const key of [
    "deadButtonCount",
    "disabledButExplainedCount",
    "previewOnlyButtonCount",
    "misleadingRealActionButtonCount",
    "dangerousActionButtonCount",
    "missingBoundaryCopyCount",
  ]) {
    check(`${key}_is_number`, Number.isInteger(result[key]));
  }
  check("ui_modified_false", result.uiModified === false);
  check("real_action_button_added_false", result.realActionButtonAdded === false);
  check("provider_calls_false", result.providerCallsMade === false);
  check("secret_read_false", result.secretRead === false);
  check("deploy_executed_false", result.deployExecuted === false);

  const pkg = readJson("package.json");
  check(
    "package_scan_script",
    pkg.scripts?.["scan:phase3961a-dead-buttons-preview-only"] ===
      "node tools/phase3961a/scan-dead-buttons-and-preview-only.mjs",
  );
  check(
    "package_verify_script",
    pkg.scripts?.["verify:phase3961a-dead-buttons-preview-only"] ===
      "node tools/phase3961a/verify-dead-button-and-preview-only-scan.mjs",
  );

  const completed = checks.every((entry) => entry.passed);
  return {
    phase: "Phase3961A-DeadButtonAndPreviewOnlyFullScan",
    status: completed ? "sealed/pass" : "failed",
    completed,
    recommendedSealed: completed,
    blocker: completed ? null : checks.filter((entry) => !entry.passed).map((entry) => entry.id).join(", "),
    deadButtonScanCompleted: result.deadButtonScanCompleted ?? false,
    providerCallsMade: false,
    secretRead: false,
    checks,
  };
}

export function main() {
  const result = verifyDeadButtonAndPreviewOnlyScan();
  console.log(JSON.stringify({
    status: result.status,
    completed: result.completed,
    recommendedSealed: result.recommendedSealed,
    blocker: result.blocker,
    deadButtonScanCompleted: result.deadButtonScanCompleted,
  }, null, 2));
  if (!result.completed) process.exit(1);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main();
}
