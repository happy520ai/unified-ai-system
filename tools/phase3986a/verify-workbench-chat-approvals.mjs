import { existsSync, readFileSync } from "node:fs";

const resultPath = "apps/ai-gateway-service/evidence/phase3986a-workbench-chat-approvals/result.json";

function verify() {
  if (!existsSync(resultPath)) {
    console.error("[FAIL] Workbench chat send + approvals integration evidence not found.");
    console.error("Run `pnpm run:phase3986a-workbench-chat-approvals` first.");
    process.exit(1);
  }

  const data = JSON.parse(readFileSync(resultPath, "utf-8"));

  const checks = [
    ["integration_executed", data.phase === "Phase3986A-Workbench-Chat-Approvals-Integration"],
    ["config_updated_or_not_found", data.updates.config.updated === true || data.updates.config.reason === "config_file_not_found"],
    ["chat_send_enabled", data.workbenchConfig.chatSendEnabled === true],
    ["approvals_enabled", data.workbenchConfig.approvalsEnabled === true],
    ["model_selection_enabled", data.workbenchConfig.modelSelectionEnabled === true],
    ["multi_provider_scope", data.workbenchConfig.providerScope === "multi-provider"],
    ["real_provider_scope", data.workbenchConfig.realProviderScope === true],
    ["display_only_disabled", data.workbenchConfig.displayOnlyMode === false],
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
  console.log(`  Chat Send: ${data.workbenchConfig.chatSendEnabled ? "Enabled" : "Disabled"}`);
  console.log(`  Approvals: ${data.workbenchConfig.approvalsEnabled ? "Enabled" : "Disabled"}`);
  console.log(`  Model Selection: ${data.workbenchConfig.modelSelectionEnabled ? "Enabled" : "Disabled"}`);
  console.log(`  Provider Scope: ${data.workbenchConfig.providerScope}`);
  console.log(`  Real Provider Scope: ${data.workbenchConfig.realProviderScope ? "Yes" : "No"}`);
  console.log(`  Display Only: ${data.workbenchConfig.displayOnlyMode ? "Yes" : "No"}`);

  process.exit(allPassed ? 0 : 1);
}

verify();
