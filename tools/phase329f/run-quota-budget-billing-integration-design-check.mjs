import { writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { buildBillingEstimate } from "../../apps/ai-gateway-service/src/billing/billingEstimateService.js";
import { buildBillingEvent } from "../../apps/ai-gateway-service/src/billing/billingEventRecorder.js";
import { evaluateBillingPolicyGate } from "../../apps/ai-gateway-service/src/billing/billingPolicyGate.js";

const repoRoot = resolve(".");
const resultPath = resolve(repoRoot, "docs/phase329f-billing-integration-check-result.json");
const estimateContractPath = resolve(repoRoot, "docs/phase329f-billing-estimate-contract.json");
const eventContractPath = resolve(repoRoot, "docs/phase329f-billing-event-contract.json");
const examplesPath = resolve(repoRoot, "docs/phase329f-billing-policy-examples.json");

const estimate = buildBillingEstimate({
  requestId: "phase329f-request-001",
  userIdRef: "user_anon",
  mode: "god",
  providerId: "nvidia",
  modelId: "meta/llama-3.2-3b-instruct",
  estimatedInputTokens: 400,
  estimatedOutputTokens: 600,
});
const event = buildBillingEvent({ eventId: "phase329f-event-001", estimate, auditTrace: { providerCallsMade: true } });
const policyExamples = {
  phase: "Phase329F",
  examples: {
    default: {
      dailyBudgetLimit: 5,
      monthlyBudgetLimit: 50,
      maxSingleRequestEstimatedCost: 0.5,
      godModeMaxEstimatedCost: 0.4,
      tianshuMaxEstimatedCost: 0.3,
      nonNvidiaProviderCostWarning: true,
      requireUserConfirmationAboveThreshold: true,
      confirmationThreshold: 0.05,
    },
  },
};
const gate = evaluateBillingPolicyGate({ estimate, policy: policyExamples.examples.default });
const output = {
  phase: "Phase329F",
  estimate,
  event,
  gate,
  actualBillingConnected: false,
  billingProviderConnected: false,
  actualChargeClaimed: false,
};

await writeFile(estimateContractPath, `${JSON.stringify(estimate, null, 2)}\n`, "utf8");
await writeFile(eventContractPath, `${JSON.stringify(event, null, 2)}\n`, "utf8");
await writeFile(examplesPath, `${JSON.stringify(policyExamples, null, 2)}\n`, "utf8");
await writeFile(resultPath, `${JSON.stringify(output, null, 2)}\n`, "utf8");
console.log(JSON.stringify(output, null, 2));
