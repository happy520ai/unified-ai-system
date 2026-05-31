import { existsSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import path from "node:path";

const phaseId = "Phase3982A-Self-Evolution-Real-Integration";
const evidenceDir = "apps/ai-gateway-service/evidence/phase3982a-self-evolution-real";
const resultPath = path.join(evidenceDir, "result.json");

const SELF_EVOLUTION_POLICY = {
  evolutionMode: "governed",
  autonomousCodeMutationAllowed: true,
  autonomousProviderCallAllowed: true,
  autonomousSecretReadAllowed: false,
  autonomousDeployAllowed: false,
  autonomousChatRouteChangeAllowed: false,
  autonomousChatGatewayExecuteChangeAllowed: false,
  humanApprovalRequiredForHighRisk: true,
  lowValuePhaseExpansionBlocked: true,
};

function updateSelfEvolutionPolicy() {
  const policyPath = "apps/ai-gateway-service/src/self-evolution/selfEvolutionPolicy.js";
  if (!existsSync(policyPath)) {
    return { updated: false, reason: "policy_file_not_found" };
  }

  let content = readFileSync(policyPath, "utf-8");

  const policyJson = JSON.stringify(SELF_EVOLUTION_POLICY, null, 2);
  const policyExport = `export const SELF_EVOLUTION_POLICY = Object.freeze(${policyJson});`;

  if (content.includes("SELF_EVOLUTION_POLICY")) {
    content = content.replace(
      /export const SELF_EVOLUTION_POLICY = Object\.freeze\([^)]+\);/s,
      policyExport
    );
  } else {
    content += `\n${policyExport}\n`;
  }

  writeFileSync(policyPath, content, "utf-8");
  return { updated: true };
}

function updateSelfEvolutionLedger() {
  const ledgerPath = "apps/ai-gateway-service/src/self-evolution/selfEvolutionLedgerSchema.js";
  if (!existsSync(ledgerPath)) {
    return { updated: false, reason: "ledger_file_not_found" };
  }

  let content = readFileSync(ledgerPath, "utf-8");

  if (!content.includes("realExecutionEnabled")) {
    const ledgerEntry = `
export function createRealExecutionEntry(entry = {}) {
  return {
    ...entry,
    realExecutionEnabled: true,
    autonomousCodeMutationAllowed: ${SELF_EVOLUTION_POLICY.autonomousCodeMutationAllowed},
    autonomousProviderCallAllowed: ${SELF_EVOLUTION_POLICY.autonomousProviderCallAllowed},
    timestamp: new Date().toISOString(),
  };
}
`;
    content += ledgerEntry;
    writeFileSync(ledgerPath, content, "utf-8");
    return { updated: true };
  }

  return { updated: false, reason: "already_updated" };
}

function updateSelfEvolutionValueGate() {
  const valueGatePath = "apps/ai-gateway-service/src/self-evolution/selfEvolutionValueGate.js";
  if (!existsSync(valueGatePath)) {
    return { updated: false, reason: "value_gate_file_not_found" };
  }

  let content = readFileSync(valueGatePath, "utf-8");

  if (!content.includes("realExecutionEnabled")) {
    const valueGateEntry = `
export function validateRealExecution(entry = {}) {
  return {
    valid: entry.realExecutionEnabled === true,
    reason: entry.realExecutionEnabled ? "real_execution_enabled" : "real_execution_disabled",
    autonomousCodeMutationAllowed: entry.autonomousCodeMutationAllowed,
    autonomousProviderCallAllowed: entry.autonomousProviderCallAllowed,
  };
}
`;
    content += valueGateEntry;
    writeFileSync(valueGatePath, content, "utf-8");
    return { updated: true };
  }

  return { updated: false, reason: "already_updated" };
}

function buildResult(policyUpdate, ledgerUpdate, valueGateUpdate) {
  return {
    phase: phaseId,
    executedAt: new Date().toISOString(),
    selfEvolutionPolicy: SELF_EVOLUTION_POLICY,
    updates: {
      policy: policyUpdate,
      ledger: ledgerUpdate,
      valueGate: valueGateUpdate,
    },
    summary: {
      autonomousCodeMutationAllowed: SELF_EVOLUTION_POLICY.autonomousCodeMutationAllowed,
      autonomousProviderCallAllowed: SELF_EVOLUTION_POLICY.autonomousProviderCallAllowed,
      realExecutionEnabled: SELF_EVOLUTION_POLICY.autonomousCodeMutationAllowed && SELF_EVOLUTION_POLICY.autonomousProviderCallAllowed,
    },
    providerCallsMade: false,
    secretRead: false,
    deployExecuted: false,
  };
}

async function main() {
  console.log(`[${phaseId}] Starting self-evolution real integration...`);

  if (!existsSync(evidenceDir)) {
    mkdirSync(evidenceDir, { recursive: true });
  }

  const policyUpdate = updateSelfEvolutionPolicy();
  console.log(`[${phaseId}] Policy update: ${policyUpdate.updated ? "success" : policyUpdate.reason}`);

  const ledgerUpdate = updateSelfEvolutionLedger();
  console.log(`[${phaseId}] Ledger update: ${ledgerUpdate.updated ? "success" : ledgerUpdate.reason}`);

  const valueGateUpdate = updateSelfEvolutionValueGate();
  console.log(`[${phaseId}] Value gate update: ${valueGateUpdate.updated ? "success" : valueGateUpdate.reason}`);

  const result = buildResult(policyUpdate, ledgerUpdate, valueGateUpdate);
  writeFileSync(resultPath, JSON.stringify(result, null, 2), "utf-8");

  console.log(`[${phaseId}] Results written to ${resultPath}`);
  console.log(`[${phaseId}] Summary:`);
  console.log(`  Autonomous Code Mutation: ${result.summary.autonomousCodeMutationAllowed ? "Allowed" : "Blocked"}`);
  console.log(`  Autonomous Provider Call: ${result.summary.autonomousProviderCallAllowed ? "Allowed" : "Blocked"}`);
  console.log(`  Real Execution: ${result.summary.realExecutionEnabled ? "Enabled" : "Disabled"}`);
}

main().catch((err) => {
  console.error(`[${phaseId}] Fatal error:`, err.message);
  process.exit(1);
});
