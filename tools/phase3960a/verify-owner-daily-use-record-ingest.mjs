import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

const repoRoot = process.cwd();
const inputPath = "docs/owner-daily-use/records/owner-daily-use-0001.json";
const resultPath = "apps/ai-gateway-service/evidence/phase3960a-owner-daily-use-record-ingest-and-classifier/result.json";
const docPath = "docs/phase3960a-owner-daily-use-record-ingest-and-classifier.md";

function readJson(relativePath) {
  return JSON.parse(readFileSync(resolve(repoRoot, relativePath), "utf8"));
}

function readText(relativePath) {
  return readFileSync(resolve(repoRoot, relativePath), "utf8");
}

export function verifyOwnerDailyUseRecordIngest() {
  const checks = [];
  const check = (id, passed, details = null) => checks.push({ id, passed, details });
  const inputExists = existsSync(resolve(repoRoot, inputPath));

  check("doc_exists", existsSync(resolve(repoRoot, docPath)));
  check("result_exists", existsSync(resolve(repoRoot, resultPath)));
  const doc = existsSync(resolve(repoRoot, docPath)) ? readText(docPath) : "";
  check("doc_has_classification_rules", doc.includes("P0") && doc.includes("LowValue"));
  const result = existsSync(resolve(repoRoot, resultPath)) ? readJson(resultPath) : {};

  check("completed_true", result.completed === true);
  check("recommended_sealed_true", result.recommendedSealed === true);
  check("fake_owner_feedback_false", result.fakeOwnerFeedbackDetected === false);
  check("codex_self_test_not_counted", result.codexSelfTestCountedAsOwnerFeedback === false);
  check("provider_calls_false", result.providerCallsMade === false);
  check("secret_read_false", result.secretRead === false);
  check("chat_modified_false", result.chatModified === false);
  check("chat_gateway_execute_modified_false", result.chatGatewayExecuteModified === false);
  check("deploy_executed_false", result.deployExecuted === false);

  if (!inputExists) {
    check("missing_input_blocker", result.blocker === "owner_daily_use_record_missing");
    check("owner_record_found_false", result.ownerRecordFound === false);
    check("record_classified_false", result.recordClassified === false);
  } else {
    check("blocker_null_when_input_exists", result.blocker === null);
    check("owner_record_found_true", result.ownerRecordFound === true);
    check("owner_provided_true", result.ownerProvided === true);
    check("record_classified_true", result.recordClassified === true);
    check("suggested_next_product_phase_generated", result.suggestedNextProductPhaseGenerated === true);
  }

  const pkg = readJson("package.json");
  check(
    "package_run_script",
    pkg.scripts?.["run:phase3960a-owner-daily-use-record-ingest"] ===
      "node tools/phase3960a/ingest-owner-daily-use-record.mjs",
  );
  check(
    "package_verify_script",
    pkg.scripts?.["verify:phase3960a-owner-daily-use-record-ingest"] ===
      "node tools/phase3960a/verify-owner-daily-use-record-ingest.mjs",
  );

  const completed = checks.every((entry) => entry.passed);
  return {
    phase: "Phase3960A-OwnerDailyUseRecordIngestAndClassifier",
    status: completed ? (inputExists ? "sealed/pass" : "sealed/blocked") : "failed",
    completed,
    recommendedSealed: completed,
    blocker: completed ? result.blocker : checks.filter((entry) => !entry.passed).map((entry) => entry.id).join(", "),
    ownerRecordFound: result.ownerRecordFound ?? false,
    recordClassified: result.recordClassified ?? false,
    providerCallsMade: false,
    secretRead: false,
    checks,
  };
}

export function main() {
  const result = verifyOwnerDailyUseRecordIngest();
  console.log(JSON.stringify({
    status: result.status,
    completed: result.completed,
    recommendedSealed: result.recommendedSealed,
    blocker: result.blocker,
    ownerRecordFound: result.ownerRecordFound,
    recordClassified: result.recordClassified,
  }, null, 2));
  if (!result.completed) process.exit(1);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main();
}
