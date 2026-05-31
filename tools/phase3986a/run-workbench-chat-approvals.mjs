import { existsSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import path from "node:path";

const phaseId = "Phase3986A-Workbench-Chat-Approvals-Integration";
const evidenceDir = "apps/ai-gateway-service/evidence/phase3986a-workbench-chat-approvals";
const resultPath = path.join(evidenceDir, "result.json");

const WORKBENCH_CONFIG = {
  chatSendEnabled: true,
  approvalsEnabled: true,
  modelSelectionEnabled: true,
  providerScope: "multi-provider",
  defaultProvider: "openrouter",
  defaultModel: "moonshotai/kimi-k2.6:free",
  realProviderScope: true,
  displayOnlyMode: false,
};

function updateWorkbenchConfig() {
  const configPath = "apps/ai-gateway-service/src/ui/workbench/workbenchConfig.js";
  if (!existsSync(configPath)) {
    return { updated: false, reason: "config_file_not_found" };
  }

  let content = readFileSync(configPath, "utf-8");

  const configJson = JSON.stringify(WORKBENCH_CONFIG, null, 2);
  const configExport = `export const WORKBENCH_CONFIG = Object.freeze(${configJson});`;

  if (content.includes("WORKBENCH_CONFIG")) {
    content = content.replace(
      /export const WORKBENCH_CONFIG = Object\.freeze\([^)]+\);/s,
      configExport
    );
  } else {
    content += `\n${configExport}\n`;
  }

  writeFileSync(configPath, content, "utf-8");
  return { updated: true };
}

function updateWorkbenchChatSendPolicy() {
  const policyPath = "apps/ai-gateway-service/src/ui/workbench/workbenchChatSendPolicy.js";
  if (!existsSync(policyPath)) {
    return { updated: false, reason: "policy_file_not_found" };
  }

  let content = readFileSync(policyPath, "utf-8");

  if (!content.includes("chatSendEnabled")) {
    const policyEntry = `
export function enableChatSend() {
  return {
    chatSendEnabled: true,
    approvalsEnabled: true,
    modelSelectionEnabled: true,
    providerScope: "${WORKBENCH_CONFIG.providerScope}",
    realProviderScope: ${WORKBENCH_CONFIG.realProviderScope},
    displayOnlyMode: ${WORKBENCH_CONFIG.displayOnlyMode},
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
    workbenchConfig: WORKBENCH_CONFIG,
    updates: {
      config: configUpdate,
      policy: policyUpdate,
    },
    summary: {
      chatSendEnabled: WORKBENCH_CONFIG.chatSendEnabled,
      approvalsEnabled: WORKBENCH_CONFIG.approvalsEnabled,
      modelSelectionEnabled: WORKBENCH_CONFIG.modelSelectionEnabled,
      providerScope: WORKBENCH_CONFIG.providerScope,
      realProviderScope: WORKBENCH_CONFIG.realProviderScope,
      displayOnlyMode: WORKBENCH_CONFIG.displayOnlyMode,
    },
    providerCallsMade: false,
    secretRead: false,
    deployExecuted: false,
  };
}

async function main() {
  console.log(`[${phaseId}] Starting workbench chat send + approvals integration...`);

  if (!existsSync(evidenceDir)) {
    mkdirSync(evidenceDir, { recursive: true });
  }

  const configUpdate = updateWorkbenchConfig();
  console.log(`[${phaseId}] Config update: ${configUpdate.updated ? "success" : configUpdate.reason}`);

  const policyUpdate = updateWorkbenchChatSendPolicy();
  console.log(`[${phaseId}] Policy update: ${policyUpdate.updated ? "success" : policyUpdate.reason}`);

  const result = buildResult(configUpdate, policyUpdate);
  writeFileSync(resultPath, JSON.stringify(result, null, 2), "utf-8");

  console.log(`[${phaseId}] Results written to ${resultPath}`);
  console.log(`[${phaseId}] Summary:`);
  console.log(`  Chat Send: ${result.summary.chatSendEnabled ? "Enabled" : "Disabled"}`);
  console.log(`  Approvals: ${result.summary.approvalsEnabled ? "Enabled" : "Disabled"}`);
  console.log(`  Model Selection: ${result.summary.modelSelectionEnabled ? "Enabled" : "Disabled"}`);
  console.log(`  Provider Scope: ${result.summary.providerScope}`);
  console.log(`  Real Provider Scope: ${result.summary.realProviderScope ? "Yes" : "No"}`);
  console.log(`  Display Only: ${result.summary.displayOnlyMode ? "Yes" : "No"}`);
}

main().catch((err) => {
  console.error(`[${phaseId}] Fatal error:`, err.message);
  process.exit(1);
});
