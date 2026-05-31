import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { createMockInvoice } from "../../apps/ai-gateway-service/src/billing/mockInvoiceService.js";
import { createBillingProviderAdapterInterface } from "../../apps/ai-gateway-service/src/billing/billingProviderAdapterInterface.js";

const repoRoot = resolve(".");
const evidenceDir = resolve(repoRoot, "apps/ai-gateway-service/evidence/phase330f");
const resultPath = resolve(evidenceDir, "mock-invoice-flow-result.json");
const contractPath = resolve(repoRoot, "docs/phase330f-mock-invoice-contract.json");
const reportPath = resolve(repoRoot, "docs/phase330f-mock-invoice-flow-report.md");
const adapterPath = resolve(repoRoot, "docs/phase330f-billing-provider-adapter-interface.md");

const scenarios = buildScenarios();
const invoices = scenarios.filter((item) => item.blocked !== true).map((scenario) => createMockInvoice({
  invoiceId: `mock-${scenario.scenarioId}`,
  userIdRef: "user_anon",
  billingPeriod: "2026-05",
  lineItems: scenario.lineItems,
  auditTrace: { scenarioId: scenario.scenarioId, paymentProviderConnected: false },
}));
const blocked = scenarios.filter((item) => item.blocked === true);
const adapter = createBillingProviderAdapterInterface();
const result = {
  phase: "Phase330F",
  mockInvoicesGenerated: invoices.length,
  blockedInvoices: blocked.length,
  estimateOnly: true,
  paymentProviderConnected: false,
  actualBillingConnected: false,
  secretValueExposed: false,
  invoices,
  blocked,
  adapterPreview: adapter.previewInvoice(),
};
await mkdir(evidenceDir, { recursive: true });
await writeFile(resultPath, `${JSON.stringify(result, null, 2)}\n`, "utf8");
await writeFile(contractPath, `${JSON.stringify(invoices[0], null, 2)}\n`, "utf8");
await writeFile(reportPath, renderReport(result), "utf8");
await writeFile(adapterPath, renderAdapterInterface(), "utf8");
console.log(JSON.stringify({ phase: "Phase330F", mockInvoicesGenerated: result.mockInvoicesGenerated, blockedInvoices: result.blockedInvoices }, null, 2));

function buildScenarios() {
  return [
    { scenarioId: "normalModeInternalNvidiaEstimate", lineItems: [{ mode: "normal", providerId: "nvidia", modelId: "meta/llama-3.2-1b-instruct", requestCount: 3, estimatedInputTokens: 300, estimatedOutputTokens: 600, estimatedCost: 0.002 }] },
    { scenarioId: "godModeMultiModelEstimate", lineItems: [{ mode: "god", providerId: "nvidia", modelId: "meta/llama-3.2-3b-instruct", requestCount: 2, estimatedInputTokens: 900, estimatedOutputTokens: 1200, estimatedCost: 0.006 }] },
    { scenarioId: "tianshuPlannerEstimate", lineItems: [{ mode: "tianshu", providerId: "nvidia", modelId: "meta/llama-3.2-1b-instruct", requestCount: 4, estimatedInputTokens: 700, estimatedOutputTokens: 900, estimatedCost: 0.004 }] },
    { scenarioId: "nonNvidiaUserOwnedProviderEstimate", lineItems: [{ mode: "normal", providerId: "openai", modelId: "user-owned-model", requestCount: 1, estimatedInputTokens: 400, estimatedOutputTokens: 400, estimatedCost: 0.01, costSource: "userOwnedProviderEstimate" }] },
    { scenarioId: "quotaExceededInvoiceBlocked", blocked: true, reason: "USER_QUOTA_EXCEEDED" },
    { scenarioId: "budgetExceededInvoiceBlocked", blocked: true, reason: "USER_BUDGET_EXCEEDED" },
    { scenarioId: "missingBillingProfileBlocked", blocked: true, reason: "MISSING_BILLING_PROFILE" },
  ];
}

function renderReport(result) {
  return [
    "# Phase330F Mock Invoice Flow Report",
    "",
    `- mockInvoicesGenerated: ${result.mockInvoicesGenerated}`,
    `- blockedInvoices: ${result.blockedInvoices}`,
    `- estimateOnly: ${result.estimateOnly}`,
    `- paymentProviderConnected: ${result.paymentProviderConnected}`,
    `- actualBillingConnected: ${result.actualBillingConnected}`,
    "",
  ].join("\n");
}

function renderAdapterInterface() {
  return [
    "# Phase330F Billing Provider Adapter Interface",
    "",
    "- createCustomer",
    "- createInvoice",
    "- previewInvoice",
    "- recordUsage",
    "- voidInvoice",
    "- syncPaymentStatus",
    "",
    "All methods are interface/mock/not implemented. No real provider is connected.",
    "",
  ].join("\n");
}
