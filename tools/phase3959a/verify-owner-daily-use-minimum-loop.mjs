import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

const repoRoot = process.cwd();
const requiredFiles = [
  "docs/phase3959a-owner-daily-use-minimum-loop.md",
  "docs/owner-daily-use/owner-daily-use-template.json",
  "docs/owner-daily-use/owner-daily-use-readme.md",
  "apps/ai-gateway-service/evidence/phase3959a-owner-daily-use-minimum-loop/result.json",
];
const resultPath = requiredFiles[3];

function readJson(relativePath) {
  return JSON.parse(readFileSync(resolve(repoRoot, relativePath), "utf8"));
}

function readText(relativePath) {
  return readFileSync(resolve(repoRoot, relativePath), "utf8");
}

export function verifyOwnerDailyUseMinimumLoop() {
  const checks = [];
  const check = (id, passed, details = null) => checks.push({ id, passed, details });

  for (const file of requiredFiles) {
    check(`exists:${file}`, existsSync(resolve(repoRoot, file)));
  }

  const doc = existsSync(resolve(repoRoot, requiredFiles[0])) ? readText(requiredFiles[0]) : "";
  check("doc_mentions_no_fake_owner_feedback", doc.includes("does not fabricate owner feedback"));
  check("doc_mentions_manual_owner_input", doc.includes("owner-daily-use-0001.json"));

  const template = existsSync(resolve(repoRoot, requiredFiles[1])) ? readJson(requiredFiles[1]) : {};
  check("template_owner_provided_true", template.ownerProvided === true);
  check("template_blocks_secret_inclusion", template.secretsIncluded === false);

  const result = existsSync(resolve(repoRoot, resultPath)) ? readJson(resultPath) : {};
  check("completed_true", result.completed === true);
  check("recommended_sealed_true", result.recommendedSealed === true);
  check("blocker_owner_daily_use_record_missing", result.blocker === "owner_daily_use_record_missing");
  check("loop_prepared", result.ownerDailyUseLoopPrepared === true);
  check("real_owner_record_count_zero", result.realOwnerDailyUseRecordCount === 0);
  check("owner_daily_use_completed_false", result.ownerDailyUseCompleted === false);
  check("fake_owner_feedback_false", result.fakeOwnerFeedbackDetected === false);
  check("codex_self_test_not_counted", result.codexSelfTestCountedAsOwnerFeedback === false);
  check("provider_calls_false", result.providerCallsMade === false);
  check("secret_read_false", result.secretRead === false);
  check("chat_modified_false", result.chatModified === false);
  check("chat_gateway_execute_modified_false", result.chatGatewayExecuteModified === false);
  check("deploy_executed_false", result.deployExecuted === false);
  check("controlled_mutation_expansion_false", result.controlledMutationExpansionAttempted === false);

  const pkg = readJson("package.json");
  check(
    "package_run_script",
    pkg.scripts?.["run:phase3959a-owner-daily-use-minimum-loop"] ===
      "node tools/phase3959a/prepare-owner-daily-use-minimum-loop.mjs",
  );
  check(
    "package_verify_script",
    pkg.scripts?.["verify:phase3959a-owner-daily-use-minimum-loop"] ===
      "node tools/phase3959a/verify-owner-daily-use-minimum-loop.mjs",
  );

  const completed = checks.every((entry) => entry.passed);
  return {
    phase: "Phase3959A-OwnerDailyUseMinimumLoop",
    status: completed ? "sealed/blocked" : "failed",
    completed,
    recommendedSealed: completed,
    blocker: completed ? "owner_daily_use_record_missing" : checks.filter((entry) => !entry.passed).map((entry) => entry.id).join(", "),
    ownerDailyUseLoopPrepared: result.ownerDailyUseLoopPrepared ?? false,
    realOwnerDailyUseRecordCount: result.realOwnerDailyUseRecordCount ?? null,
    ownerDailyUseCompleted: result.ownerDailyUseCompleted ?? null,
    providerCallsMade: false,
    secretRead: false,
    checks,
  };
}

export function main() {
  const result = verifyOwnerDailyUseMinimumLoop();
  console.log(JSON.stringify({
    status: result.status,
    completed: result.completed,
    recommendedSealed: result.recommendedSealed,
    blocker: result.blocker,
    realOwnerDailyUseRecordCount: result.realOwnerDailyUseRecordCount,
    ownerDailyUseCompleted: result.ownerDailyUseCompleted,
  }, null, 2));
  if (!result.completed) process.exit(1);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main();
}
