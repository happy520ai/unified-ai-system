import { existsSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import path from "node:path";

const phaseId = "Phase3983A-Workforce-Real-Integration";
const evidenceDir = "apps/ai-gateway-service/evidence/phase3983a-workforce-real";
const resultPath = path.join(evidenceDir, "result.json");

const WORKFORCE_CONFIG = {
  executionEnabled: true,
  externalRunnerEnabled: true,
  omxHandoffEnabled: true,
  maxConcurrentAgents: 3,
  approvalGateRequired: true,
  realExecutionAllowed: true,
  dryRunMode: false,
};

function updateWorkforceConfig() {
  const configPath = "apps/ai-gateway-service/src/workforce/workforceConfig.js";
  if (!existsSync(configPath)) {
    return { updated: false, reason: "config_file_not_found" };
  }

  let content = readFileSync(configPath, "utf-8");

  const configJson = JSON.stringify(WORKFORCE_CONFIG, null, 2);
  const configExport = `export const WORKFORCE_CONFIG = Object.freeze(${configJson});`;

  if (content.includes("WORKFORCE_CONFIG")) {
    content = content.replace(
      /export const WORKFORCE_CONFIG = Object\.freeze\([^)]+\);/s,
      configExport
    );
  } else {
    content += `\n${configExport}\n`;
  }

  writeFileSync(configPath, content, "utf-8");
  return { updated: true };
}

function updateWorkforceExecutionPolicy() {
  const policyPath = "apps/ai-gateway-service/src/workforce/workforceExecutionPolicy.js";
  if (!existsSync(policyPath)) {
    return { updated: false, reason: "policy_file_not_found" };
  }

  let content = readFileSync(policyPath, "utf-8");

  if (!content.includes("realExecutionEnabled")) {
    const policyEntry = `
export function enableRealExecution() {
  return {
    realExecutionEnabled: true,
    executionEnabled: ${WORKFORCE_CONFIG.executionEnabled},
    externalRunnerEnabled: ${WORKFORCE_CONFIG.externalRunnerEnabled},
    maxConcurrentAgents: ${WORKFORCE_CONFIG.maxConcurrentAgents},
    approvalGateRequired: ${WORKFORCE_CONFIG.approvalGateRequired},
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

function updateExternalRunnerConfig() {
  const runnerPath = "apps/ai-gateway-service/src/workforce/externalRunnerConfig.js";
  if (!existsSync(runnerPath)) {
    return { updated: false, reason: "runner_file_not_found" };
  }

  let content = readFileSync(runnerPath, "utf-8");

  if (!content.includes("runnerEnabled")) {
    const runnerEntry = `
export function enableExternalRunner() {
  return {
    runnerEnabled: true,
    executionEnabled: true,
    dryRunMode: false,
    timestamp: new Date().toISOString(),
  };
}
`;
    content += runnerEntry;
    writeFileSync(runnerPath, content, "utf-8");
    return { updated: true };
  }

  return { updated: false, reason: "already_updated" };
}

function buildResult(configUpdate, policyUpdate, runnerUpdate) {
  return {
    phase: phaseId,
    executedAt: new Date().toISOString(),
    workforceConfig: WORKFORCE_CONFIG,
    updates: {
      config: configUpdate,
      policy: policyUpdate,
      runner: runnerUpdate,
    },
    summary: {
      executionEnabled: WORKFORCE_CONFIG.executionEnabled,
      externalRunnerEnabled: WORKFORCE_CONFIG.externalRunnerEnabled,
      realExecutionAllowed: WORKFORCE_CONFIG.realExecutionAllowed,
      dryRunMode: WORKFORCE_CONFIG.dryRunMode,
    },
    providerCallsMade: false,
    secretRead: false,
    deployExecuted: false,
  };
}

async function main() {
  console.log(`[${phaseId}] Starting workforce real integration...`);

  if (!existsSync(evidenceDir)) {
    mkdirSync(evidenceDir, { recursive: true });
  }

  const configUpdate = updateWorkforceConfig();
  console.log(`[${phaseId}] Config update: ${configUpdate.updated ? "success" : configUpdate.reason}`);

  const policyUpdate = updateWorkforceExecutionPolicy();
  console.log(`[${phaseId}] Policy update: ${policyUpdate.updated ? "success" : policyUpdate.reason}`);

  const runnerUpdate = updateExternalRunnerConfig();
  console.log(`[${phaseId}] Runner update: ${runnerUpdate.updated ? "success" : runnerUpdate.reason}`);

  const result = buildResult(configUpdate, policyUpdate, runnerUpdate);
  writeFileSync(resultPath, JSON.stringify(result, null, 2), "utf-8");

  console.log(`[${phaseId}] Results written to ${resultPath}`);
  console.log(`[${phaseId}] Summary:`);
  console.log(`  Execution: ${result.summary.executionEnabled ? "Enabled" : "Disabled"}`);
  console.log(`  External Runner: ${result.summary.externalRunnerEnabled ? "Enabled" : "Disabled"}`);
  console.log(`  Real Execution: ${result.summary.realExecutionAllowed ? "Allowed" : "Blocked"}`);
  console.log(`  Dry Run: ${result.summary.dryRunMode ? "Yes" : "No"}`);
}

main().catch((err) => {
  console.error(`[${phaseId}] Fatal error:`, err.message);
  process.exit(1);
});
