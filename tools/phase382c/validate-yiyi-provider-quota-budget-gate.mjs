import { evaluateYiyiProviderQuotaBudgetGate } from "../../apps/ai-gateway-service/src/ui/yiyi/model-brain/yiyiProviderQuotaBudgetGate.js";
import { ensure, phase382Safety, readJson, writeJson, writeText } from "../phase382-common.mjs";

const cases = await readJson("docs/phase382c-yiyi-brain-gate-cases.json");
const caseResults = cases.map((item) => {
  const output = evaluateYiyiProviderQuotaBudgetGate(item.input);
  return {
    caseId: item.caseId,
    gateDecision: output.gateDecision,
    blockedBy: output.blockedBy,
    pass: output.gateDecision === item.expectedDecision,
  };
});

ensure(caseResults.every((item) => item.pass), "Provider/quota/budget gate cases failed.");

const result = {
  phase: "Phase382C",
  providerPolicyGateCreated: true,
  quotaBudgetGateCreated: true,
  fallbackToMockBrainEnabled: true,
  realBillingAllowed: false,
  billingExecuted: false,
  invoiceGenerated: false,
  caseResults,
  validationPassed: true,
  ...phase382Safety,
};

await writeJson("apps/ai-gateway-service/evidence/phase382c/yiyi-provider-quota-budget-gate-result.json", result);
await writeText("docs/phase382c-yiyi-brain-provider-quota-budget-gate.md", [
  "# Phase382C Provider / Quota / Budget Gate",
  "",
  "- Added dry-run provider policy, quota, and budget gate evaluation for Yiyi model-backed brain.",
  "- If any gate fails, the route falls back to local mock brain.",
  "- No billing, invoice generation, or provider call is performed in this phase.",
].join("\n"));

console.log(JSON.stringify(result, null, 2));
