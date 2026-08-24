export interface LocalLedgerBillingProviderOptions {
  ledgerPath?: string;
  clock?: () => string;
}

interface BillingBase {
  implemented: true;
  provider: "local-ledger";
  paymentProviderConnected: false;
}

export interface BillingInputError extends BillingBase {
  ok: false;
  code: "BILLING_INPUT_INVALID";
  message: string;
}

interface BillingSuccess extends BillingBase {
  ok: true;
}

export interface BillingCustomer {
  kind: "customer";
  customerId: string;
  tenantId: string;
  name: string;
  email: string | null;
  createdAt: string;
}

export interface BillingSummary {
  customerId: string;
  periodStart: string | null;
  periodEnd: string | null;
  eventCount: number;
  lineItems: Array<Record<string, unknown>>;
  subtotalUsd: number;
  totalUsd: number;
}

export interface BillingInvoice {
  kind: "invoice";
  invoiceId: string;
  customerId: string;
  currency: string;
  status: string;
  paymentStatus: string;
  paidAmountUsd: number;
  totalUsd: number;
  legalInvoice: false;
  [key: string]: unknown;
}

export type CustomerResult = BillingInputError | (BillingSuccess & { customerId: string; customer: BillingCustomer });
export type UsageResult = BillingInputError | (BillingSuccess & { eventId: string; recorded: true });
export type PreviewResult = BillingInputError | (BillingSuccess & {
  invoice: null;
  summary: BillingSummary;
  legalInvoice: false;
  taxProviderConnected: false;
  note: string;
});
export type InvoiceResult = BillingInputError | (BillingSuccess & {
  invoiceId: string;
  invoice: BillingInvoice;
  legalInvoice: false;
  warnings: string[];
});
export type VoidResult = BillingInputError | (BillingSuccess & {
  invoiceId: string;
  status: "voided";
  alreadyVoided?: boolean;
  invoice?: BillingInvoice;
});
export type PaymentStatusResult = BillingInputError | (BillingSuccess & {
  invoiceId: string;
  paymentStatus: string;
  paidAmountUsd: number;
  totalUsd: number;
  payments: Array<Record<string, unknown>>;
  note: string;
});

export interface LocalLedgerBillingProvider extends BillingBase {
  ok: true;
  createCustomer(input?: { tenantId?: string; name?: string; email?: string | null }): CustomerResult;
  recordUsage(input?: {
    customerId?: string;
    virtualKeyFingerprint?: string | null;
    requestId?: string | null;
    providerId?: string;
    modelId?: string;
    tokens?: number;
    estimatedCostUsd?: number;
  }): UsageResult;
  previewInvoice(input?: { customerId?: string; periodStart?: string | null; periodEnd?: string | null }): PreviewResult;
  createInvoice(input?: { customerId?: string; periodStart?: string | null; periodEnd?: string | null; currency?: string }): InvoiceResult;
  voidInvoice(input?: { invoiceId?: string; reason?: string | null }): VoidResult;
  syncPaymentStatus(input?: { invoiceId?: string }): PaymentStatusResult;
  recordManualPayment(input?: { invoiceId?: string; amountUsd?: number; note?: string | null }): PaymentStatusResult;
  getLedgerSummary(): BillingSuccess & {
    ledgerPath: string;
    customerCount: number;
    usageEventCount: number;
    uninvoicedEventCount: number;
    invoiceCount: number;
  };
}

export declare function createLocalLedgerBillingProvider(
  options?: LocalLedgerBillingProviderOptions,
): LocalLedgerBillingProvider;
