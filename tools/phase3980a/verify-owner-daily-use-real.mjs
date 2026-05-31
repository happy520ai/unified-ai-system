import { existsSync, readFileSync } from "node:fs";

const resultPath = "apps/ai-gateway-service/evidence/phase3980a-owner-daily-use-real/result.json";

function verify() {
  if (!existsSync(resultPath)) {
    console.error("[FAIL] Owner daily use real integration evidence not found.");
    console.error("Run `pnpm run:phase3980a-owner-daily-use` first.");
    process.exit(1);
  }

  const data = JSON.parse(readFileSync(resultPath, "utf-8"));

  const checks = [
    ["integration_executed", data.phase === "Phase3980A-Owner-Daily-Use-Real-Integration"],
    ["owner_daily_use_completed", data.ownerDailyUseCompleted === true],
    ["real_record_count", data.realOwnerDailyUseRecordCount > 0],
    ["tasks_executed", data.taskResults.length > 0],
    ["has_passed_tasks", data.summary.passedTasks > 0],
    ["chat_test_passed", data.taskResults.some(t => t.id === "chat-test" && t.status === "pass")],
    ["no_raw_secret", data.secretRead === false],
    ["no_deploy", data.deployExecuted === false],
  ];

  let allPassed = true;
  for (const [name, passed] of checks) {
    const status = passed ? "PASS" : "FAIL";
    console.log(`  ${status}: ${name}`);
    if (!passed) allPassed = false;
  }

  console.log("");
  console.log(`[RESULT] ${allPassed ? "PASS" : "FAIL"}`);
  console.log(`  Owner Daily Use: ${data.ownerDailyUseCompleted ? "Completed" : "Not completed"}`);
  console.log(`  Real Record Count: ${data.realOwnerDailyUseRecordCount}`);
  console.log(`  Tasks Passed: ${data.summary.passedTasks}/${data.summary.totalTasks}`);
  console.log(`  Provider Calls: ${data.providerCallsMade ? "Made" : "Not made"}`);

  process.exit(allPassed ? 0 : 1);
}

verify();
