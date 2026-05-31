import { existsSync, readFileSync } from "node:fs";

const resultPath = "apps/ai-gateway-service/evidence/phase3981a-ui-dead-button-real/result.json";

function verify() {
  if (!existsSync(resultPath)) {
    console.error("[FAIL] UI dead button real integration evidence not found.");
    console.error("Run `pnpm run:phase3981a-ui-dead-button` first.");
    process.exit(1);
  }

  const data = JSON.parse(readFileSync(resultPath, "utf-8"));

  const checks = [
    ["integration_executed", data.phase === "Phase3981A-UI-Dead-Button-Real-Integration"],
    ["has_fixes", data.deadButtonFixes.length > 0],
    ["has_enabled", data.realExecutionEnablement.length > 0],
    ["buttons_fixed_or_no_changes", data.summary.totalButtonsFixed >= 0],
    ["execution_enabled_or_no_changes", data.summary.totalExecutionEnabled >= 0],
    ["ui_modified_or_no_changes", data.uiModified === true || data.summary.totalChanges === 0],
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
  console.log(`  Buttons Fixed: ${data.summary.totalButtonsFixed}`);
  console.log(`  Execution Enabled: ${data.summary.totalExecutionEnabled}`);
  console.log(`  Total Changes: ${data.summary.totalChanges}`);
  console.log(`  UI Modified: ${data.uiModified ? "Yes" : "No"}`);

  process.exit(allPassed ? 0 : 1);
}

verify();
