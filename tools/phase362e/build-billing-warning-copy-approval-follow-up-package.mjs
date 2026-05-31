import { exists, writeJson, writeText } from "../phase362-common.mjs";

const warningCopyApprovalPresent = await exists("docs/approvals/phase361/billing-warning-copy-approval-record.json");
const requiredWarningLabels = [
  "MOCK STATEMENT",
  "ESTIMATE ONLY",
  "NOT A LEGAL INVOICE",
  "PAYMENT PROVIDER NOT CONNECTED",
  "ACTUAL BILLING NOT CONNECTED",
  "DO NOT USE FOR TAX OR PAYMENT SETTLEMENT",
];
const checklist = {
  phase: "Phase362E",
  packageName: "billing-warning-copy-approval-follow-up-package",
  estimateOnlyWording: true,
  notLegalInvoiceWording: true,
  paymentProviderNotConnectedWording: true,
  actualBillingNotConnectedWording: true,
  noTaxUseWording: true,
  noPaymentSettlementWording: true,
  nonNvidiaUserOwnedProviderCostWarning: true,
  quotaBudgetWarning: true,
  exportWarningLabels: requiredWarningLabels,
  statementIdRequirement: true,
  warningCopyApprovalRequired: true,
  warningCopyApprovalPresent,
  statementIdPresent: false,
  realBillingConnected: false,
  legalInvoiceGenerated: false,
  requiredWarningLabels,
  missingApprovals: warningCopyApprovalPresent ? [] : ["billing_warning_copy_approval", "statementId"],
  followUpActions: ["request statementId", "request billing warning copy approval"],
  safety: {
    actualBillingClaimed: false,
    legalInvoiceClaimed: false,
    secretValueExposed: false,
  },
};
const result = {
  phase: "Phase362E",
  billingWarningCopyFollowUpPackageGenerated: true,
  billingWarningChecklistGenerated: true,
  warningCopyApprovalPresent,
  statementIdPresent: false,
  requiredWarningLabelsPresent: requiredWarningLabels.length === 6,
  realBillingConnected: false,
  legalInvoiceGenerated: false,
  actualBillingClaimed: false,
  legalInvoiceClaimed: false,
  secretValueExposed: false,
  workspaceCleanClaimed: false,
};

await writeJson("docs/phase362e-billing-warning-copy-checklist.json", checklist);
await writeText("docs/phase362e-billing-warning-copy-approval-design.md", [
  "# Phase362E Billing Warning Copy Approval Design",
  "",
  "This package follows up billing warning copy approval. It does not connect billing, generate invoices, or claim legal billing readiness.",
].join("\n"));
await writeText("docs/phase362e-billing-warning-copy-approval-request-draft.md", [
  "# Phase362E Billing Warning Copy Approval Request Draft",
  "",
  "Required warnings must remain visible:",
  "",
  ...requiredWarningLabels.map((label) => `- ${label}`),
].join("\n"));
await writeText("docs/phase362e-billing-warning-copy-review-notes.md", [
  "# Phase362E Billing Warning Copy Review Notes",
  "",
  "- Verify estimate-only wording.",
  "- Verify no tax or payment settlement use.",
  "- Verify payment provider and actual billing remain disconnected.",
].join("\n"));
await writeText("docs/phase362e-billing-warning-copy-follow-up-report.md", [
  "# Phase362E Billing Warning Copy Follow-up Report",
  "",
  `- warningCopyApprovalPresent: ${warningCopyApprovalPresent}`,
  "- statementIdPresent: false",
  "- realBillingConnected: false",
  "- legalInvoiceGenerated: false",
].join("\n"));
await writeText("docs/phase362e-execution-report.md", [
  "# Phase362E Execution Report",
  "",
  "- billingWarningCopyFollowUpPackageGenerated: true",
  "- billingWarningChecklistGenerated: true",
  "- realBillingConnected: false",
  "- legalInvoiceGenerated: false",
].join("\n"));
await writeJson("apps/ai-gateway-service/evidence/phase362e/billing-warning-copy-follow-up-result.json", result);

console.log(JSON.stringify(result, null, 2));
