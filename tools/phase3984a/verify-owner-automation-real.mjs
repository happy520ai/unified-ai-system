import { existsSync, readFileSync } from "node:fs";

const resultPath = "apps/ai-gateway-service/evidence/phase3984a-owner-automation-real/result.json";

function verify() {
  if (!existsSync(resultPath)) {
    console.error("[FAIL] Owner automation real integration evidence not found.");
    console.error("Run `pnpm run:phase3984a-owner-automation` first.");
    process.exit(1);
  }

  const data = JSON.parse(readFileSync(resultPath, "utf-8"));

  const checks = [
    ["integration_executed", data.phase === "Phase3984A-Owner-Automation-Real-Integration"],
    ["config_updated_or_not_found", data.updates.config.updated === true || data.updates.config.reason === "config_file_not_found"],
    ["real_run_button_enabled", data.ownerAutomationConfig.realRunButtonEnabled === true],
    ["real_execution_expanded", data.ownerAutomationConfig.realExecutionCapabilityExpanded === true],
    ["registered_actions", data.ownerAutomationConfig.registeredActionCount > 0],
    ["real_execution_enabled", data.ownerAutomationConfig.realExecutionEnabled === true],
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
  console.log(`  Real Run Button: ${data.ownerAutomationConfig.realRunButtonEnabled ? "Enabled" : "Disabled"}`);
  console.log(`  Real Execution: ${data.ownerAutomationConfig.realExecutionCapabilityExpanded ? "Expanded" : "Collapsed"}`);
  console.log(`  Registered Actions: ${data.ownerAutomationConfig.registeredActionCount}`);
  console.log(`  Real Execution: ${data.ownerAutomationConfig.realExecutionEnabled ? "Enabled" : "Disabled"}`);

  process.exit(allPassed ? 0 : 1);
}

verify();
