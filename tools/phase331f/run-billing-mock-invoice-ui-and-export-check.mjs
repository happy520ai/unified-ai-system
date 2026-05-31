import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { createMockStatement, exportMockStatement } from "../../apps/ai-gateway-service/src/billing/mockStatementExporter.js";
import { buildBillingMockInvoicePanel } from "../../apps/agent-console/src/billingMockInvoicePanel.js";

const repoRoot = resolve(".");
const serviceEvidenceDir = resolve(repoRoot, "apps/ai-gateway-service/evidence/phase331f");
const uiEvidenceDir = resolve(repoRoot, "apps/agent-console/evidence/phase331f");
const exportResultPath = resolve(serviceEvidenceDir, "billing-mock-invoice-export-result.json");
const uiSmokePath = resolve(uiEvidenceDir, "billing-mock-invoice-ui-smoke.json");
const contractPath = resolve(repoRoot, "docs/phase331f-exportable-statement-contract.json");
const samplePath = resolve(repoRoot, "docs/phase331f-mock-statement-sample.json");

const phase330f = JSON.parse(await readFile(resolve(repoRoot, "apps/ai-gateway-service/evidence/phase330f/mock-invoice-flow-result.json"), "utf8"));
const statement = createMockStatement({
  statementId: "mock-statement-phase331f-001",
  userIdRef: "user_anon",
  billingPeriod: "2026-05",
  invoices: phase330f.invoices || [],
});
const exports = {
  json: exportMockStatement(statement, "json"),
  csv: exportMockStatement(statement, "csv"),
  markdown: exportMockStatement(statement, "markdown"),
};
const panel = buildBillingMockInvoicePanel(statement);
const uiSmoke = {
  phase: "Phase331F",
  mockInvoicePanelVisible: panel.mockInvoicePanelVisible,
  estimateOnlyBadgeVisible: panel.badge.estimateOnlyBadgeVisible,
  notLegalInvoiceWarningVisible: panel.preview.notLegalInvoiceWarningVisible,
  paymentProviderDisconnectedVisible: panel.preview.paymentProviderDisconnectedVisible,
  exportJsonAvailable: panel.exportActions.exportJsonAvailable,
  exportCsvAvailable: panel.exportActions.exportCsvAvailable,
  exportMarkdownAvailable: panel.exportActions.exportMarkdownAvailable,
  noActualBillingClaim: panel.noActualBillingClaim,
};
const result = {
  phase: "Phase331F",
  statementId: statement.statementId,
  estimateOnly: statement.estimateOnly,
  legalInvoice: statement.legalInvoice,
  paymentProviderConnected: statement.paymentProviderConnected,
  actualBillingConnected: statement.actualBillingConnected,
  exportFormats: statement.exportFormats,
  exportLengths: Object.fromEntries(Object.entries(exports).map(([key, value]) => [key, value.length])),
  actualInvoiceGenerated: false,
  realPaymentProviderConnected: false,
  secretValueExposed: false,
};

await mkdir(serviceEvidenceDir, { recursive: true });
await mkdir(uiEvidenceDir, { recursive: true });
await writeFile(contractPath, `${JSON.stringify(buildContract(), null, 2)}\n`, "utf8");
await writeFile(samplePath, `${JSON.stringify(statement, null, 2)}\n`, "utf8");
await writeFile(exportResultPath, `${JSON.stringify(result, null, 2)}\n`, "utf8");
await writeFile(uiSmokePath, `${JSON.stringify(uiSmoke, null, 2)}\n`, "utf8");
await writeFile(resolve(repoRoot, "docs/phase331f-billing-mock-invoice-ui-design.md"), renderDesign(), "utf8");
await writeFile(resolve(repoRoot, "docs/phase331f-billing-mock-invoice-ui-smoke-report.md"), renderReport(uiSmoke), "utf8");
await writeFile(resolve(repoRoot, "docs/phase331f-execution-report.md"), renderReport(uiSmoke), "utf8");
console.log(JSON.stringify({ result, uiSmoke }, null, 2));

function buildContract() {
  return {
    phase: "Phase331F",
    statementId: "string",
    userIdRef: "string",
    billingPeriod: "YYYY-MM",
    generatedAt: "iso_timestamp",
    estimateOnly: true,
    legalInvoice: false,
    paymentProviderConnected: false,
    actualBillingConnected: false,
    currency: "USD",
    totalEstimatedCost: "number",
    modeUsageSummary: "object",
    providerUsageSummary: "object",
    lineItems: "array",
    warnings: "array",
    exportFormats: ["json", "csv", "markdown"],
    auditTrace: "object",
  };
}

function renderDesign() {
  return [
    "# Phase331F Billing Mock Invoice UI Design",
    "",
    "The mock invoice panel shows estimate-only badges, not-legal-invoice warnings, disconnected payment provider status, and JSON/CSV/Markdown export actions.",
    "It does not generate legal invoices, PDFs, charges, or payment-provider records.",
    "",
  ].join("\n");
}

function renderReport(smoke) {
  return [
    "# Phase331F Billing Mock Invoice UI Smoke Report",
    "",
    `- mockInvoicePanelVisible: ${smoke.mockInvoicePanelVisible}`,
    `- estimateOnlyBadgeVisible: ${smoke.estimateOnlyBadgeVisible}`,
    `- notLegalInvoiceWarningVisible: ${smoke.notLegalInvoiceWarningVisible}`,
    `- paymentProviderDisconnectedVisible: ${smoke.paymentProviderDisconnectedVisible}`,
    `- exportJsonAvailable: ${smoke.exportJsonAvailable}`,
    `- exportCsvAvailable: ${smoke.exportCsvAvailable}`,
    `- exportMarkdownAvailable: ${smoke.exportMarkdownAvailable}`,
    "",
  ].join("\n");
}
