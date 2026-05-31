import { formatInvoiceLineItem } from "./invoiceEstimateFormatter.js";

export function createMockInvoice({ invoiceId, userIdRef, billingPeriod, lineItems = [], auditTrace = {} } = {}) {
  const formatted = lineItems.map(formatInvoiceLineItem);
  const estimatedCostTotal = round(formatted.reduce((sum, item) => sum + Number(item.estimatedCost || 0), 0));
  return {
    invoiceId,
    userIdRef,
    billingPeriod,
    modeUsageSummary: summarize(formatted, "mode"),
    providerUsageSummary: summarize(formatted, "providerId"),
    estimatedCostTotal,
    currency: "USD",
    estimateOnly: true,
    actualInvoice: false,
    paymentProviderConnected: false,
    taxCalculated: false,
    legalInvoice: false,
    lineItems: formatted,
    warnings: ["mockInvoiceOnly", "notLegalInvoice", "actualBillingConnected=false"],
    auditTrace,
  };
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
