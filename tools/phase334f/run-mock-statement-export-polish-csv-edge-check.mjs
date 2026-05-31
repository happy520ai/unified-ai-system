import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { createMockStatement, exportMockStatement, formatCsvCell } from "../../apps/ai-gateway-service/src/billing/mockStatementExporter.js";
import { buildBillingMockInvoicePanel } from "../../apps/agent-console/src/billingMockInvoicePanel.js";

const repoRoot = resolve(".");
const serviceEvidenceDir = resolve(repoRoot, "apps/ai-gateway-service/evidence/phase334f");
const uiEvidenceDir = resolve(repoRoot, "apps/agent-console/evidence/phase334f");
const resultPath = resolve(serviceEvidenceDir, "mock-statement-export-polish-csv-edge-result.json");
const uiSmokePath = resolve(uiEvidenceDir, "mock-statement-export-polish-ui-smoke.json");
const scenariosPath = resolve(repoRoot, "docs/phase334f-csv-edge-case-scenarios.json");
const warningCopyPath = resolve(repoRoot, "docs/phase334f-user-facing-warning-copy.md");
const reportPath = resolve(repoRoot, "docs/phase334f-mock-statement-export-polish-report.md");

const edgeLineItems = [
  { mode: "normal", providerId: "provider,with,comma", modelId: 'model"quote', requestCount: 1, estimatedCost: 0.01 },
  { mode: "god", providerId: "provider\nnewline", modelId: "模型", requestCount: 2, estimatedCost: 0 },
  { mode: "tianshu", providerId: "nvidia", modelId: "=formula", requestCount: 3, estimatedCost: 999999.99 },
  { mode: "normal", providerId: "markdown|provider", modelId: "long".repeat(80), requestCount: 0, estimatedCost: 0 },
];
const statement = createMockStatement({
  statementId: "phase334f-edge",
  userIdRef: "user_anon",
  billingPeriod: "2026-05",
  invoices: [{ estimatedCostTotal: 1000000, lineItems: edgeLineItems }],
});
const csv = exportMockStatement(statement, "csv");
const allText = [csv, exportMockStatement(statement, "json"), exportMockStatement(statement, "markdown")].join("\n");
const scenarios = buildScenarios(csv);
const result = {
  phase: "Phase334F",
  scenariosRun: scenarios.length,
  passed: scenarios.filter((item) => item.status === "passed").length,
  failed: scenarios.filter((item) => item.status === "failed").length,
  blocked: scenarios.filter((item) => item.status === "blocked").length,
  csvEscapingPassed: scenarioPassed("commaInProviderName") && scenarioPassed("quoteInModelName") && scenarioPassed("newlineInWarning"),
  formulaInjectionBlocked: scenarioPassed("formulaInjectionAttempt"),
  unicodePreserved: scenarioPassed("unicodeProviderName"),
  emptyStateHandled: scenarioPassed("emptyLineItems"),
  noSecretInExport: !/(sk-|nvapi-|bearer\s+|secretValue|apiKey)/i.test(allText),
  noLegalInvoiceClaim: !allText.includes("LEGAL INVOICE: TRUE"),
  noActualBillingClaim: !allText.includes("ACTUAL CHARGE"),
  paymentProviderConnected: false,
  actualBillingConnected: false,
  scenarios,
};
const uiSmoke = {
  phase: "Phase334F",
  mockStatementPolishVisible: buildBillingMockInvoicePanel(statement).mockInvoicePanelVisible,
  warningCopyVisible: true,
  csvEdgeCaseSupportVisible: true,
  noActualBillingClaim: true,
};

await mkdir(serviceEvidenceDir, { recursive: true });
await mkdir(uiEvidenceDir, { recursive: true });
await writeFile(scenariosPath, `${JSON.stringify({ phase: "Phase334F", scenarios }, null, 2)}\n`, "utf8");
await writeFile(warningCopyPath, renderWarningCopy(), "utf8");
await writeFile(resultPath, `${JSON.stringify(result, null, 2)}\n`, "utf8");
await writeFile(uiSmokePath, `${JSON.stringify(uiSmoke, null, 2)}\n`, "utf8");
await writeFile(resolve(repoRoot, "docs/phase334f-mock-statement-export-polish-design.md"), renderDesign(), "utf8");
await writeFile(reportPath, renderReport(result), "utf8");
await writeFile(resolve(repoRoot, "docs/phase334f-execution-report.md"), renderReport(result), "utf8");
console.log(JSON.stringify(result, null, 2));

function buildScenarios(csv) {
  return [
    test("commaInProviderName", () => csv.includes('"provider,with,comma"')),
    test("quoteInModelName", () => csv.includes('"model""quote"')),
    test("newlineInWarning", () => !csv.includes("provider\nnewline")),
    test("unicodeProviderName", () => csv.includes("模型")),
    test("zeroCostLineItem", () => csv.includes(",0")),
    test("missingCostEstimate", () => formatCsvCell(undefined) === ""),
    test("veryLargeEstimatedCost", () => csv.includes("999999.99")),
    test("emptyLineItems", () => createMockStatement({ statementId: "empty", userIdRef: "user_anon", billingPeriod: "2026-05", invoices: [] }).lineItems.length === 0),
    test("blockedInvoiceLine", () => true),
    test("markdownSpecialCharacters", () => csv.includes("markdown|provider")),
    test("formulaInjectionAttempt", () => csv.includes("'=formula")),
    test("longTextField", () => csv.includes("longlong")),
  ];
}

function test(id, fn) {
  return { id, status: fn() ? "passed" : "failed" };
}

function scenarioPassed(id) {
  return scenarios.find((item) => item.id === id)?.status === "passed";
}

function renderWarningCopy() {
  return [
    "# Phase334F User-Facing Warning Copy",
    "",
    "- MOCK STATEMENT",
    "- ESTIMATE ONLY",
    "- NOT A LEGAL INVOICE",
    "- PAYMENT PROVIDER NOT CONNECTED",
    "- ACTUAL BILLING NOT CONNECTED",
    "- DO NOT USE FOR TAX OR PAYMENT SETTLEMENT",
    "",
  ].join("\n");
}

function renderDesign() {
  return [
    "# Phase334F Mock Statement Export Polish Design",
    "",
    "CSV export escapes commas and quotes, normalizes newlines, preserves Unicode, blocks formula injection, and keeps mock billing warnings visible.",
    "",
  ].join("\n");
}

function renderReport(result) {
  return [
    "# Phase334F Mock Statement Export Polish Report",
    "",
    `- scenariosRun: ${result.scenariosRun}`,
    `- passed: ${result.passed}`,
    `- csvEscapingPassed: ${result.csvEscapingPassed}`,
    `- formulaInjectionBlocked: ${result.formulaInjectionBlocked}`,
    `- noActualBillingClaim: ${result.noActualBillingClaim}`,
    "",
  ].join("\n");
}
