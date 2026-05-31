import { existsSync, readFileSync } from "node:fs";

const resultPath = "apps/ai-gateway-service/evidence/phase3983a-workforce-real/result.json";

function verify() {
  if (!existsSync(resultPath)) {
    console.error("[FAIL] Workforce real integration evidence not found.");
    console.error("Run `pnpm run:phase3983a-workforce` first.");
    process.exit(1);
  }

  const data = JSON.parse(readFileSync(resultPath, "utf-8"));

  const checks = [
    ["integration_executed", data.phase === "Phase3983A-Workforce-Real-Integration"],
    ["config_updated_or_not_found", data.updates.config.updated === true || data.updates.config.reason === "config_file_not_found"],
    ["execution_enabled", data.workforceConfig.executionEnabled === true],
    ["external_runner_enabled", data.workforceConfig.externalRunnerEnabled === true],
    ["real_execution_allowed", data.workforceConfig.realExecutionAllowed === true],
    ["dry_run_disabled", data.workforceConfig.dryRunMode === false],
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
  console.log(`  Execution: ${data.workforceConfig.executionEnabled ? "Enabled" : "Disabled"}`);
  console.log(`  External Runner: ${data.workforceConfig.externalRunnerEnabled ? "Enabled" : "Disabled"}`);
  console.log(`  Real Execution: ${data.workforceConfig.realExecutionAllowed ? "Allowed" : "Blocked"}`);
  console.log(`  Dry Run: ${data.workforceConfig.dryRunMode ? "Yes" : "No"}`);

  process.exit(allPassed ? 0 : 1);
}

verify();
