import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { createDefaultPerUserModePolicy, mergePerUserModePolicy } from "../../apps/ai-gateway-service/src/governance/perUserModePolicy.js";
import { evaluateQuotaBudgetGate } from "../../apps/ai-gateway-service/src/governance/quotaBudgetGate.js";
import { ModePolicyError } from "../../apps/ai-gateway-service/src/governance/modePolicyErrors.js";

const repoRoot = resolve(".");
const resultPath = resolve(repoRoot, "docs/phase328f-quota-budget-governance-result.json");
const contractPath = resolve(repoRoot, "docs/phase328f-quota-budget-governance-contract.json");
const examplesPath = resolve(repoRoot, "docs/phase328f-user-policy-examples.json");

const basePolicy = createDefaultPerUserModePolicy({ userId: "phase328f-user" });
const scenarios = buildScenarios(basePolicy);
const results = scenarios.map(runScenario);

await mkdir(resolve(repoRoot, "apps/ai-gateway-service/evidence/phase328f"), { recursive: true });
await writeFile(contractPath, `${JSON.stringify(buildContract(basePolicy), null, 2)}\n`, "utf8");
await writeFile(examplesPath, `${JSON.stringify(buildExamples(basePolicy), null, 2)}\n`, "utf8");
await writeFile(resultPath, `${JSON.stringify({ phase: "Phase328F", scenariosProcessed: results.length, results }, null, 2)}\n`, "utf8");
console.log(JSON.stringify({ phase: "Phase328F", scenariosProcessed: results.length, results }, null, 2));

function buildScenarios(base) {
  return [
    { scenarioId: "allowedNormal", policy: base, request: { mode: "normal", audit: { traceEnabled: true } }, usage: emptyUsage(), estimatedCost: 0.01 },
    { scenarioId: "warningNearQuota", policy: mergePerUserModePolicy(base, { dailyRequestLimit: 2 }), request: { mode: "normal", audit: { traceEnabled: true } }, usage: { ...emptyUsage(), dailyRequestCount: 1, monthlyRequestCount: 1 }, estimatedCost: 0.01 },
    { scenarioId: "blockedQuota", policy: mergePerUserModePolicy(base, { dailyRequestLimit: 1 }), request: { mode: "normal", audit: { traceEnabled: true } }, usage: { ...emptyUsage(), dailyRequestCount: 1 }, estimatedCost: 0.01 },
    { scenarioId: "blockedBudget", policy: mergePerUserModePolicy(base, { dailyBudgetLimit: 0.02 }), request: { mode: "normal", audit: { traceEnabled: true } }, usage: { ...emptyUsage(), dailyEstimatedCost: 0.02 }, estimatedCost: 0.01 },
    { scenarioId: "godParticipantLimitExceeded", policy: mergePerUserModePolicy(base, { maxGodParticipants: 2 }), request: { mode: "god", audit: { traceEnabled: true }, modelSelection: { participantModelIds: ["a", "b", "c"] } }, usage: emptyUsage(), estimatedCost: 0.03 },
    { scenarioId: "tianshuEscalationBlocked", policy: mergePerUserModePolicy(base, { allowTianshuGodEscalation: false }), request: { mode: "tianshu", audit: { traceEnabled: true }, executionPolicy: { allowGodEscalation: true } }, usage: emptyUsage(), estimatedCost: 0.03 },
    { scenarioId: "auditTraceRequired", policy: base, request: { mode: "normal", audit: { traceEnabled: false } }, usage: emptyUsage(), estimatedCost: 0.01 },
  ];
}

function runScenario(scenario) {
  try {
    const decision = evaluateQuotaBudgetGate({
      policy: scenario.policy,
      request: scenario.request,
      usage: scenario.usage,
      estimatedCost: scenario.estimatedCost,
    });
    return { scenarioId: scenario.scenarioId, status: decision.warning ? "warning" : "allowed", decision };
  } catch (error) {
    if (error instanceof ModePolicyError) {
      return { scenarioId: scenario.scenarioId, status: "blocked", error: { code: error.code, message: error.message, details: error.details } };
    }
    throw error;
  }
}

function buildContract(policy) {
  return {
    phase: "Phase328F",
    contractName: "quota-budget-governance-contract",
    requestFields: Object.keys(policy),
    outputFields: ["allowed", "blocked", "warning", "reason", "remainingQuota", "estimatedCost", "budgetStatus", "policyStatus"],
    realBillingIntegrated: false,
  };
}

function buildExamples(base) {
  return {
    phase: "Phase328F",
    defaultUserPolicy: base,
    restrictedUserPolicy: mergePerUserModePolicy(base, {
      allowedModes: ["normal"],
      disabledModes: ["god", "tianshu"],
      dailyRequestLimit: 5,
      dailyBudgetLimit: 0.5,
    }),
  };
}

function emptyUsage() {
  return {
    dailyRequestCount: 0,
    monthlyRequestCount: 0,
    dailyEstimatedCost: 0,
    monthlyEstimatedCost: 0,
  };
}
