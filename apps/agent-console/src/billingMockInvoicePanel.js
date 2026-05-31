import { buildBillingEstimateBadge } from "./billingEstimateBadge.js";
import { buildBillingExportActions } from "./billingExportActions.js";
import { buildBillingStatementPreview } from "./billingStatementPreview.js";

export function buildBillingMockInvoicePanel(statement = {}) {
  return {
    mockInvoicePanelVisible: true,
    badge: buildBillingEstimateBadge(),
    preview: buildBillingStatementPreview(statement),
    exportActions: buildBillingExportActions(),
    noActualBillingClaim: statement.actualBillingConnected === false && statement.legalInvoice === false,
  };
}
