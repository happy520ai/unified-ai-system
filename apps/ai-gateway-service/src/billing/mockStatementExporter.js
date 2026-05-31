export function createMockStatement({ statementId, userIdRef, billingPeriod, invoices = [] } = {}) {
  const lineItems = invoices.flatMap((invoice) => invoice.lineItems || []);
  const totalEstimatedCost = round(invoices.reduce((sum, invoice) => sum + Number(invoice.estimatedCostTotal || 0), 0));
  return {
    statementId,
    userIdRef,
    billingPeriod,
    generatedAt: new Date().toISOString(),
    estimateOnly: true,
    legalInvoice: false,
    paymentProviderConnected: false,
    actualBillingConnected: false,
    currency: "USD",
    totalEstimatedCost,
    modeUsageSummary: summarize(lineItems, "mode"),
    providerUsageSummary: summarize(lineItems, "providerId"),
    lineItems,
    warnings: ["MOCK STATEMENT", "ESTIMATE ONLY", "NOT A LEGAL INVOICE", "PAYMENT PROVIDER NOT CONNECTED", "ACTUAL BILLING NOT CONNECTED"],
    exportFormats: ["json", "csv", "markdown"],
    auditTrace: { actualInvoice: false, paymentProviderConnected: false },
  };
}

export function exportMockStatement(statement, format) {
  if (format === "json") return JSON.stringify(statement, null, 2);
  if (format === "csv") return renderCsv(statement);
  if (format === "markdown") return renderMarkdown(statement);
  return "";
}

function renderCsv(statement) {
  const rows = [
    "# MOCK STATEMENT | ESTIMATE ONLY | NOT A LEGAL INVOICE | PAYMENT PROVIDER NOT CONNECTED | ACTUAL BILLING NOT CONNECTED",
    "mode,providerId,modelId,requestCount,estimatedCost",
  ];
  for (const item of statement.lineItems || []) {
    rows.push([item.mode, item.providerId, item.modelId, item.requestCount, item.estimatedCost].map(formatCsvCell).join(","));
  }
  return rows.join("\n");
}

export function formatCsvCell(value) {
  const normalized = String(value ?? "").replace(/\r?\n/g, " ");
  const safe = /^[=+\-@]/.test(normalized) ? `'${normalized}` : normalized;
  if (/[",\n]/.test(safe)) return `"${safe.replace(/"/g, '""')}"`;
  return safe;
}

function renderMarkdown(statement) {
  return [
    "# Mock Billing Statement",
    "",
    "> MOCK STATEMENT. ESTIMATE ONLY. NOT A LEGAL INVOICE. PAYMENT PROVIDER NOT CONNECTED. ACTUAL BILLING NOT CONNECTED.",
    "",
    `- statementId: ${statement.statementId}`,
    `- totalEstimatedCost: ${statement.totalEstimatedCost} ${statement.currency}`,
    `- paymentProviderConnected: ${statement.paymentProviderConnected}`,
    "",
  ].join("\n");
}

function summarize(items, key) {
  return items.reduce((acc, item) => {
    const value = item[key] || "unknown";
    acc[value] = (acc[value] || 0) + Number(item.requestCount || 0);
    return acc;
  }, {});
}

function round(value) {
  return Math.round(Number(value || 0) * 100000) / 100000;
}
