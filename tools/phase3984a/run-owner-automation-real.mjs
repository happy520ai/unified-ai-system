import { existsSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import path from "node:path";

const phaseId = "Phase3984A-Owner-Automation-Real-Integration";
const evidenceDir = "apps/ai-gateway-service/evidence/phase3984a-owner-automation-real";
const resultPath = path.join(evidenceDir, "result.json");

const OWNER_AUTOMATION_CONFIG = {
  realRunButtonEnabled: true,
  realExecutionCapabilityExpanded: true,
  registeredActionCount: 5,
  availableActions: [
    "create_desktop_spreadsheet",
    "create_desktop_document",
    "create_desktop_folder",
    "scan_desktop_files",
    "read_desktop_file",
  ],
  dryRunPreviewDrawerEnabled: true,
  approvalRequiredStateVisible: true,
  realExecutionEnabled: true,
};

function updateOwnerAutomationConfig() {
  const configPath = "apps/ai-gateway-service/src/owner-automation/ownerAutomationConfig.js";
  if (!existsSync(configPath)) {
    return { updated: false, reason: "config_file_not_found" };
  }

  let content = readFileSync(configPath, "utf-8");

  const configJson = JSON.stringify(OWNER_AUTOMATION_CONFIG, null, 2);
  const configExport = `export const OWNER_AUTOMATION_CONFIG = Object.freeze(${configJson});`;

  if (content.includes("OWNER_AUTOMATION_CONFIG")) {
    content = content.replace(
      /export const OWNER_AUTOMATION_CONFIG = Object\.freeze\([^)]+\);/s,
      configExport
    );
  } else {
    content += `\n${configExport}\n`;
  }

  writeFileSync(configPath, content, "utf-8");
  return { updated: true };
}

function updateOwnerAutomationExecutionPolicy() {
  const policyPath = "apps/ai-gateway-service/src/owner-automation/ownerAutomationExecutionPolicy.js";
  if (!existsSync(policyPath)) {
    return { updated: false, reason: "policy_file_not_found" };
  }

  let content = readFileSync(policyPath, "utf-8");

  if (!content.includes("realExecutionEnabled")) {
    const policyEntry = `
export function enableRealExecution() {
  return {
    realExecutionEnabled: true,
    realRunButtonEnabled: ${OWNER_AUTOMATION_CONFIG.realRunButtonEnabled},
    realExecutionCapabilityExpanded: ${OWNER_AUTOMATION_CONFIG.realExecutionCapabilityExpanded},
    registeredActionCount: ${OWNER_AUTOMATION_CONFIG.registeredActionCount},
    timestamp: new Date().toISOString(),
  };
}
`;
    content += policyEntry;
    writeFileSync(policyPath, content, "utf-8");
    return { updated: true };
  }

  return { updated: false, reason: "already_updated" };
}

function buildResult(configUpdate, policyUpdate) {
  return {
    phase: phaseId,
    executedAt: new Date().toISOString(),
    ownerAutomationConfig: OWNER_AUTOMATION_CONFIG,
    updates: {
      config: configUpdate,
      policy: policyUpdate,
    },
    summary: {
      realRunButtonEnabled: OWNER_AUTOMATION_CONFIG.realRunButtonEnabled,
      realExecutionCapabilityExpanded: OWNER_AUTOMATION_CONFIG.realExecutionCapabilityExpanded,
      registeredActionCount: OWNER_AUTOMATION_CONFIG.registeredActionCount,
      realExecutionEnabled: OWNER_AUTOMATION_CONFIG.realExecutionEnabled,
    },
    providerCallsMade: false,
    secretRead: false,
    deployExecuted: false,
  };
}

async function main() {
  console.log(`[${phaseId}] Starting owner automation real integration...`);

  if (!existsSync(evidenceDir)) {
    mkdirSync(evidenceDir, { recursive: true });
  }

  const configUpdate = updateOwnerAutomationConfig();
  console.log(`[${phaseId}] Config update: ${configUpdate.updated ? "success" : configUpdate.reason}`);

  const policyUpdate = updateOwnerAutomationExecutionPolicy();
  console.log(`[${phaseId}] Policy update: ${policyUpdate.updated ? "success" : policyUpdate.reason}`);

  const result = buildResult(configUpdate, policyUpdate);
  writeFileSync(resultPath, JSON.stringify(result, null, 2), "utf-8");

  console.log(`[${phaseId}] Results written to ${resultPath}`);
  console.log(`[${phaseId}] Summary:`);
  console.log(`  Real Run Button: ${result.summary.realRunButtonEnabled ? "Enabled" : "Disabled"}`);
  console.log(`  Real Execution: ${result.summary.realExecutionCapabilityExpanded ? "Expanded" : "Collapsed"}`);
  console.log(`  Registered Actions: ${result.summary.registeredActionCount}`);
  console.log(`  Real Execution: ${result.summary.realExecutionEnabled ? "Enabled" : "Disabled"}`);
}

main().catch((err) => {
  console.error(`[${phaseId}] Fatal error:`, err.message);
  process.exit(1);
});
