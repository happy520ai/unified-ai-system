// Local-ledger billing provider.
//
// Implements the six billingProviderAdapter operations against a durable
// local JSONL ledger: customers, usage events, invoices, voids. This gives
// the gateway REAL usage-based invoicing without any external dependency.
// Honesty contract preserved: there is still no payment provider connected —
// invoices are issued-from-ledger statements, not legal invoices, and
// payment status only changes through an explicit manual payment record.

import { appendFileSync, existsSync, mkdirSync, readFileSync } from "node:fs";
import { dirname, resolve as resolvePath } from "node:path";
import { randomUUID } from "node:crypto";

const DEFAULT_LEDGER_PATH = ".data/billing/billing-ledger.jsonl";

export function createLocalLedgerBillingProvider({
  ledgerPath = DEFAULT_LEDGER_PATH,
  clock = () => new Date().toISOString(),
} = {}) {
  const absoluteLedgerPath = resolvePath(process.cwd(), ledgerPath);
  const records = loadLedger(absoluteLedgerPath);
  const customers = new Map();   // customerId -> customer record
  const usageEvents = [];        // { eventId, customerId, ..., invoicedInvoiceId }
  const invoices = new Map();    // invoiceId -> invoice record
  const manualPayments = new Map(); // invoiceId -> [{ paymentId, amountUsd, recordedAt, note }]

  for (const record of records) {
    if (record.kind === "customer") customers.set(record.customerId, record);
    else if (record.kind === "usage") usageEvents.push(record);
    else if (record.kind === "invoice") invoices.set(record.invoiceId, record);
    else if (record.kind === "void") {
      const invoice = invoices.get(record.invoiceId);
      if (invoice) {
        invoice.status = "voided";
        invoice.voidedAt = record.timestamp;
        invoice.voidReason = record.reason ?? null;
        for (const event of usageEvents) {
          if (event.invoicedInvoiceId === record.invoiceId) event.invoicedInvoiceId = null;
        }
      }
    } else if (record.kind === "manual_payment") {
      const list = manualPayments.get(record.invoiceId) ?? [];
      list.push(record);
      manualPayments.set(record.invoiceId, list);
      const invoice = invoices.get(record.invoiceId);
      if (invoice) invoice.paidAmountUsd = round6((invoice.paidAmountUsd ?? 0) + record.amountUsd);
    }
  }

  function append(record) {
    mkdirSync(dirname(absoluteLedgerPath), { recursive: true });
    appendFileSync(absoluteLedgerPath, `${JSON.stringify(record)}\n`, "utf8");
  }

  const base = () => ({
    implemented: true,
    provider: "local-ledger",
    paymentProviderConnected: false,
  });

  return {
    ...base(),

    createCustomer({ tenantId = "default", name, email } = {}) {
      if (!name || typeof name !== "string") {
        return billingInputError("name is required.");
      }
      const customerId = `cus_${randomUUID().replace(/-/g, "").slice(0, 16)}`;
      const record = {
        kind: "customer",
        customerId,
        tenantId,
        name,
        email: email ?? null,
        createdAt: clock(),
      };
      customers.set(customerId, record);
      append(record);
      return { ...base(), customerId, customer: { ...record } };
    },

    recordUsage({
      customerId,
      virtualKeyFingerprint = null,
      requestId = null,
      providerId,
      modelId,
      tokens = 0,
      estimatedCostUsd = 0,
    } = {}) {
      const customer = customers.get(customerId);
      if (!customer) {
        return billingInputError(`Unknown customerId "${customerId}". Create the customer first.`);
      }
      if (!providerId || !modelId) {
        return billingInputError("providerId and modelId are required.");
      }
      const event = {
        kind: "usage",
        eventId: `evt_${randomUUID().replace(/-/g, "").slice(0, 16)}`,
        customerId,
        tenantId: customer.tenantId,
        virtualKeyFingerprint,
        requestId,
        providerId,
        modelId,
        tokens: Number(tokens) || 0,
        estimatedCostUsd: round6(Number(estimatedCostUsd) || 0),
        invoicedInvoiceId: null,
        timestamp: clock(),
      };
      usageEvents.push(event);
      append(event);
      return { ...base(), eventId: event.eventId, recorded: true };
    },

    previewInvoice({ customerId, periodStart = null, periodEnd = null } = {}) {
      const summary = summarizeUsage({ customerId, periodStart, periodEnd });
      if (summary === null) {
        return billingInputError(`Unknown customerId "${customerId}".`);
      }
      return {
        ...base(),
        invoice: null,
        summary,
        legalInvoice: false,
        taxProviderConnected: false,
        note: "Usage-based statement preview aggregated from the local ledger. Not a legal invoice; taxes are not computed.",
      };
    },

    createInvoice({ customerId, periodStart = null, periodEnd = null, currency = "USD" } = {}) {
      const summary = summarizeUsage({ customerId, periodStart, periodEnd });
      if (summary === null) {
        return billingInputError(`Unknown customerId "${customerId}".`);
      }
      const invoiceId = `inv_${randomUUID().replace(/-/g, "").slice(0, 16)}`;
      const invoice = {
        kind: "invoice",
        invoiceId,
        customerId,
        currency,
        status: "issued_from_local_ledger",
        paymentStatus: "unpaid",
        paidAmountUsd: 0,
        periodStart,
        periodEnd,
        lineItems: summary.lineItems,
        subtotalUsd: summary.subtotalUsd,
        totalUsd: summary.subtotalUsd,
        issuedAt: clock(),
        legalInvoice: false,
      };
      invoices.set(invoiceId, invoice);
      append(invoice);
      for (const event of usageEvents) {
        if (event.customerId === customerId && event.invoicedInvoiceId === null && inPeriod(event, periodStart, periodEnd)) {
          event.invoicedInvoiceId = invoiceId;
        }
      }
      return {
        ...base(),
        invoiceId,
        invoice: { ...invoice },
        legalInvoice: false,
        warnings: ["issued_from_local_ledger", "not_a_legal_invoice", "payment_provider_not_connected"],
      };
    },

    voidInvoice({ invoiceId, reason = null } = {}) {
      const invoice = invoices.get(invoiceId);
      if (!invoice) {
        return billingInputError(`Unknown invoiceId "${invoiceId}".`);
      }
      if (invoice.status === "voided") {
        return { ...base(), invoiceId, status: "voided", alreadyVoided: true };
      }
      invoice.status = "voided";
      invoice.voidedAt = clock();
      invoice.voidReason = reason;
      const voidRecord = {
        kind: "void",
        invoiceId,
        reason,
        timestamp: invoice.voidedAt,
      };
      append(voidRecord);
      for (const event of usageEvents) {
        if (event.invoicedInvoiceId === invoiceId) event.invoicedInvoiceId = null;
      }
      return { ...base(), invoiceId, status: "voided", invoice: { ...invoice } };
    },

    syncPaymentStatus({ invoiceId } = {}) {
      const invoice = invoices.get(invoiceId);
      if (!invoice) {
        return billingInputError(`Unknown invoiceId "${invoiceId}".`);
      }
      const payments = manualPayments.get(invoiceId) ?? [];
      const paid = round6(payments.reduce((sum, payment) => sum + payment.amountUsd, 0));
      const paymentStatus = paid <= 0
        ? "unpaid"
        : paid + 1e-9 >= invoice.totalUsd
          ? "paid"
          : "partially_paid";
      invoice.paymentStatus = paymentStatus;
      invoice.paidAmountUsd = paid;
      return {
        ...base(),
        invoiceId,
        paymentStatus,
        paidAmountUsd: paid,
        totalUsd: invoice.totalUsd,
        payments: payments.map(({ paymentId, amountUsd, recordedAt, note }) => ({
          paymentId, amountUsd, recordedAt, note,
        })),
        note: "No payment provider connected; payment records come from the local manual-payment ledger only.",
      };
    },

    /**
     * 台账扩展：手工登记一笔收款（对账/线下支付场景）。
     * 依然是本地记录，不代表任何支付网关交易。
     */
    recordManualPayment({ invoiceId, amountUsd, note = null } = {}) {
      const invoice = invoices.get(invoiceId);
      if (!invoice) {
        return billingInputError(`Unknown invoiceId "${invoiceId}".`);
      }
      const amount = Number(amountUsd);
      if (!Number.isFinite(amount) || amount <= 0) {
        return billingInputError("amountUsd must be a positive number.");
      }
      const payment = {
        kind: "manual_payment",
        paymentId: `pay_${randomUUID().replace(/-/g, "").slice(0, 12)}`,
        invoiceId,
        amountUsd: round6(amount),
        note,
        recordedAt: clock(),
      };
      const list = manualPayments.get(invoiceId) ?? [];
      list.push(payment);
      manualPayments.set(invoiceId, list);
      append(payment);
      return this.syncPaymentStatus({ invoiceId });
    },

    getLedgerSummary() {
      return {
        ...base(),
        ledgerPath: absoluteLedgerPath,
        customerCount: customers.size,
        usageEventCount: usageEvents.length,
        uninvoicedEventCount: usageEvents.filter((event) => event.invoicedInvoiceId === null).length,
        invoiceCount: invoices.size,
      };
    },
  };

  function summarizeUsage({ customerId, periodStart, periodEnd }) {
    const customer = customers.get(customerId);
    if (!customer) return null;
    const relevant = usageEvents.filter(
      (event) => event.customerId === customerId
        && event.invoicedInvoiceId === null
        && inPeriod(event, periodStart, periodEnd),
    );
    const byLine = new Map();
    for (const event of relevant) {
      const key = `${event.providerId}/${event.modelId}`;
      const line = byLine.get(key) ?? {
        providerId: event.providerId,
        modelId: event.modelId,
        tokens: 0,
        amountUsd: 0,
      };
      line.tokens += event.tokens;
      line.amountUsd = round6(line.amountUsd + event.estimatedCostUsd);
      byLine.set(key, line);
    }
    const lineItems = [...byLine.values()].map((line, index) => ({
      ...line,
      lineItemId: `li_${index + 1}`,
      description: `${line.providerId} / ${line.modelId} usage (${line.tokens} tokens)`,
    }));
    const subtotalUsd = round6(lineItems.reduce((sum, line) => sum + line.amountUsd, 0));
    return {
      customerId,
      periodStart,
      periodEnd,
      eventCount: relevant.length,
      lineItems,
      subtotalUsd,
      totalUsd: subtotalUsd,
    };
  }
}

function inPeriod(event, periodStart, periodEnd) {
  if (typeof periodStart === "string" && event.timestamp < periodStart) return false;
  if (typeof periodEnd === "string" && event.timestamp > periodEnd) return false;
  return true;
}

function round6(value) {
  return Math.round(value * 1e6) / 1e6;
}

function billingInputError(message) {
  return {
    implemented: true,
    provider: "local-ledger",
    paymentProviderConnected: false,
    ok: false,
    code: "BILLING_INPUT_INVALID",
    message,
  };
}

function loadLedger(path) {
  if (!existsSync(path)) return [];
  try {
    return readFileSync(path, "utf8")
      .split("\n")
      .filter((line) => line.trim().length > 0)
      .map((line) => JSON.parse(line));
  } catch {
    return [];
  }
}
