export function buildBillingStatementPreview(statement = {}) {
  return {
    statementId: statement.statementId,
    totalEstimatedCost: statement.totalEstimatedCost || 0,
    currency: statement.currency || "USD",
    notLegalInvoiceWarningVisible: statement.legalInvoice === false,
    paymentProviderDisconnectedVisible: statement.paymentProviderConnected === false,
    actualBillingDisconnectedVisible: statement.actualBillingConnected === false,
    modeUsageSummary: statement.modeUsageSummary || {},
    providerUsageSummary: statement.providerUsageSummary || {},
    lineItems: statement.lineItems || [],
  };
}
