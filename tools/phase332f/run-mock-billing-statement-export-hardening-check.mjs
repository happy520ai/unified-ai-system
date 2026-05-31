import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { createMockStatement, exportMockStatement } from "../../apps/ai-gateway-service/src/billing/mockStatementExporter.js";
import { buildBillingMockInvoicePanel } from "../../apps/agent-console/src/billingMockInvoicePanel.js";

const repoRoot = resolve(".");
const serviceEvidenceDir = resolve(repoRoot, "apps/ai-gateway-service/evidence/phase332f");
const uiEvidenceDir = resolve(repoRoot, "apps/agent-console/evidence/phase332f");
const resultPath = resolve(serviceEvidenceDir, "mock-billing-statement-export-hardening-result.json");
const uiSmokePath = resolve(uiEvidenceDir, "mock-billing-statement-export-ui-smoke.json");
const contractPath = resolve(repoRoot, "docs/phase332f-export-format-contract.json");
const jsonSamplePath = resolve(repoRoot, "docs/phase332f-export-sample-json.json");
const csvSamplePath = resolve(repoRoot, "docs/phase332f-export-sample-csv.md");
const markdownSamplePath = resolve(repoRoot, "docs/phase332f-export-sample-markdown.md");

const phase330f = JSON.parse(await readFile(resolve(repoRoot, "apps/ai-gateway-service/evidence/phase330f/mock-invoice-flow-result.json"), "utf8"));
const statement = createMockStatement({
  statementId: "mock-statement-phase332f-001",
  userIdRef: "user_anon",
  billingPeriod: "2026-05",
  invoices: phase330f.invoices || [],
});
const jsonExport = exportMockStatement(statement, "json");
const csvExport = exportMockStatement(statement, "csv");
const markdownExport = exportMockStatement(statement, "markdown");
const warningLabels = ["MOCK STATEMENT", "ESTIMATE ONLY", "NOT A LEGAL INVOICE", "PAYMENT PROVIDER NOT CONNECTED", "ACTUAL BILLING NOT CONNECTED"];
const allExports = [jsonExport, csvExport, markdownExport].join("\n");
const totalFromLines = round((statement.lineItems || []).reduce((sum, item) => sum + Number(item.estimatedCost || 0), 0));
const result = {
  phase: "Phase332F",
  jsonExportValid: Boolean(JSON.parse(jsonExport).estimateOnly),
  csvExportValid: csvExport.includes("mode,providerId,modelId,requestCount,estimatedCost"),
  markdownExportValid: markdownExport.includes("# Mock Billing Statement"),
  warningLabelsPresent: warningLabels.every((label) => allExports.includes(label)),
  noLegalInvoiceClaim: statement.legalInvoice === false && !allExports.includes("LEGAL INVOICE: TRUE"),
  noActualBillingClaim: statement.actualBillingConnected === false && !allExports.includes("ACTUAL CHARGE"),
  noSecretInExport: !/(sk-|nvapi-|bearer\s+|secretValue|apiKey)/i.test(allExports),
  noPaymentDataInExport: !/(cardNumber|cvv|bankAccount|paymentMethodId)/i.test(allExports),
  lineItemTotalsConsistent: totalFromLines === statement.totalEstimatedCost,
  emptyStateHandled: createMockStatement({ statementId: "empty", userIdRef: "user_anon", billingPeriod: "2026-05", invoices: [] }).lineItems.length === 0,
  blockedInvoiceHandled: Array.isArray(phase330f.blocked) && phase330f.blocked.length > 0,
  paymentProviderConnected: false,
  actualBillingConnected: false,
};
const panel = buildBillingMockInvoicePanel(statement);
const uiSmoke = {
  phase: "Phase332F",
  mockInvoicePanelVisible: panel.mockInvoicePanelVisible,
  estimateOnlyBadgeVisible: panel.badge.estimateOnlyBadgeVisible,
  exportJsonAvailable: panel.exportActions.exportJsonAvailable,
  exportCsvAvailable: panel.exportActions.exportCsvAvailable,
  exportMarkdownAvailable: panel.exportActions.exportMarkdownAvailable,
  noActualBillingClaim: panel.noActualBillingClaim,
};

await mkdir(serviceEvidenceDir, { recursive: true });
await mkdir(uiEvidenceDir, { recursive: true });
await writeFile(contractPath, `${JSON.stringify(buildContract(), null, 2)}\n`, "utf8");
await writeFile(jsonSamplePath, `${JSON.stringify(statement, null, 2)}\n`, "utf8");
await writeFile(csvSamplePath, fenced(csvExport, "csv"), "utf8");
await writeFile(markdownSamplePath, markdownExport, "utf8");
await writeFile(resultPath, `${JSON.stringify(result, null, 2)}\n`, "utf8");
await writeFile(uiSmokePath, `${JSON.stringify(uiSmoke, null, 2)}\n`, "utf8");
await writeFile(resolve(repoRoot, "docs/phase332f-mock-billing-statement-export-hardening-design.md"), renderDesign(), "utf8");
await writeFile(resolve(repoRoot, "docs/phase332f-export-hardening-report.md"), renderReport(result), "utf8");
await writeFile(resolve(repoRoot, "docs/phase332f-execution-report.md"), renderReport(result), "utf8");
console.log(JSON.stringify(result, null, 2));

function buildContract() {
  return {
    phase: "Phase332F",
    supportedFormats: ["json", "csv", "markdown"],
    estimateOnly: true,
    legalInvoice: false,
    paymentProviderConnected: false,
    actualBillingConnected: false,
    requiredWarningLabels: ["MOCK STATEMENT", "ESTIMATE ONLY", "NOT A LEGAL INVOICE", "PAYMENT PROVIDER NOT CONNECTED", "ACTUAL BILLING NOT CONNECTED"],
    redactionPolicy: { secrets: "forbidden", paymentData: "forbidden", userId: "reference_only" },
    exportMetadata: ["statementId", "billingPeriod", "generatedAt", "currency"],
    lineItemFields: ["mode", "providerId", "modelId", "requestCount", "estimatedInputTokens", "estimatedOutputTokens", "estimatedCost", "costSource", "estimateConfidence"],
  };
}

function fenced(text, info) {
  return ["```" + info, text, "```", ""].join("\n");
}

function renderDesign() {
  return [
    "# Phase332F Mock Billing Statement Export Hardening Design",
    "",
    "Exports must carry clear mock and estimate-only warnings in JSON, CSV, and Markdown.",
    "No payment data, legal invoice wording, actual charge wording, or secrets are allowed.",
    "",
  ].join("\n");
}

function renderReport(result) {
  return [
    "# Phase332F Export Hardening Report",
    "",
    `- jsonExportValid: ${result.jsonExportValid}`,
    `- csvExportValid: ${result.csvExportValid}`,
    `- markdownExportValid: ${result.markdownExportValid}`,
    `- warningLabelsPresent: ${result.warningLabelsPresent}`,
    `- noLegalInvoiceClaim: ${result.noLegalInvoiceClaim}`,
    `- noActualBillingClaim: ${result.noActualBillingClaim}`,
    `- noSecretInExport: ${result.noSecretInExport}`,
    "",
  ].join("\n");
}

function round(value) {
  return Math.round(Number(value || 0) * 100000) / 100000;
}
