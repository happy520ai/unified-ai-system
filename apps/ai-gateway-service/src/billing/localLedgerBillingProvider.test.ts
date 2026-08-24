import { mkdtempSync, rmSync, existsSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import { createLocalLedgerBillingProvider } from "./localLedgerBillingProvider.js";

const workDir = mkdtempSync(join(tmpdir(), "uai-billing-"));
const ledgerPath = join(workDir, "billing-ledger.jsonl");
let tick = 0;
const clock = () => new Date(1_760_000_000_000 + ++tick * 1000).toISOString();

afterAll(() => {
  rmSync(workDir, { recursive: true, force: true });
});

function createProvider() {
  return createLocalLedgerBillingProvider({ ledgerPath, clock });
}

describe("localLedgerBillingProvider", () => {
  it("implements all six interface operations with real ledger effects", () => {
    const provider = createProvider();
    for (const method of ["createCustomer", "createInvoice", "previewInvoice", "recordUsage", "voidInvoice", "syncPaymentStatus"] as const) {
      expect(typeof provider[method]).toBe("function");
    }

    const customer = provider.createCustomer({ tenantId: "tenant-a", name: "Acme", email: "billing@acme.test" });
    expect(customer.implemented).toBe(true);
    expect(customer.paymentProviderConnected).toBe(false);
    if (!customer.ok) throw new Error(customer.message);
    expect(customer.customerId).toMatch(/^cus_/);

    provider.recordUsage({ customerId: customer.customerId, providerId: "openai", modelId: "gpt-test", tokens: 1200, estimatedCostUsd: 0.012 });
    provider.recordUsage({ customerId: customer.customerId, providerId: "openai", modelId: "gpt-test", tokens: 800, estimatedCostUsd: 0.008 });
    provider.recordUsage({ customerId: customer.customerId, providerId: "anthropic", modelId: "claude-test", tokens: 300, estimatedCostUsd: 0.003 });

    const preview = provider.previewInvoice({ customerId: customer.customerId });
    if (!preview.ok) throw new Error(preview.message);
    expect(preview.summary.eventCount).toBe(3);
    expect(preview.summary.lineItems).toHaveLength(2);
    expect(preview.summary.subtotalUsd).toBeCloseTo(0.023, 6);
    expect(preview.legalInvoice).toBe(false);

    const invoice = provider.createInvoice({ customerId: customer.customerId });
    if (!invoice.ok) throw new Error(invoice.message);
    expect(invoice.invoiceId).toMatch(/^inv_/);
    expect(invoice.invoice.totalUsd).toBeCloseTo(0.023, 6);
    expect(invoice.invoice.status).toBe("issued_from_local_ledger");
    expect(invoice.warnings).toContain("payment_provider_not_connected");

    // 已开票用量不再重复出现在下一次 preview 中。
    const previewAfter = provider.previewInvoice({ customerId: customer.customerId });
    if (!previewAfter.ok) throw new Error(previewAfter.message);
    expect(previewAfter.summary.eventCount).toBe(0);

    const payment = provider.recordManualPayment({ invoiceId: invoice.invoiceId, amountUsd: 0.023, note: "wire transfer" });
    if (!payment.ok) throw new Error(payment.message);
    expect(payment.paymentStatus).toBe("paid");

    const synced = provider.syncPaymentStatus({ invoiceId: invoice.invoiceId });
    if (!synced.ok) throw new Error(synced.message);
    expect(synced.paymentStatus).toBe("paid");
    expect(synced.paidAmountUsd).toBeCloseTo(0.023, 6);

    const voided = provider.voidInvoice({ invoiceId: invoice.invoiceId, reason: "test void" });
    if (!voided.ok) throw new Error(voided.message);
    expect(voided.status).toBe("voided");
    // 作废后用量回到未开票状态。
    const previewRevived = provider.previewInvoice({ customerId: customer.customerId });
    if (!previewRevived.ok) throw new Error(previewRevived.message);
    expect(previewRevived.summary.eventCount).toBe(3);
  });

  it("rejects unknown customers, invoices, and invalid inputs honestly", () => {
    const provider = createProvider();
    const unknownCustomer = provider.previewInvoice({ customerId: "cus_missing" });
    expect(unknownCustomer.ok).toBe(false);
    if (unknownCustomer.ok) throw new Error("Expected an input error.");
    expect(unknownCustomer.code).toBe("BILLING_INPUT_INVALID");

    const customer = provider.createCustomer({ name: "Beta" });
    if (!customer.ok) throw new Error(customer.message);
    for (const result of [
      provider.recordUsage({ customerId: customer.customerId }),
      provider.voidInvoice({ invoiceId: "inv_missing" }),
      provider.syncPaymentStatus({ invoiceId: "inv_missing" }),
      provider.createCustomer({}),
    ]) {
      if (result.ok) throw new Error("Expected an input error.");
      expect(result.code).toBe("BILLING_INPUT_INVALID");
    }
  });

  it("persists the ledger as JSONL and replays it on restart", () => {
    const first = createProvider();
    const customer = first.createCustomer({ name: "Gamma" });
    if (!customer.ok) throw new Error(customer.message);
    first.recordUsage({ customerId: customer.customerId, providerId: "p", modelId: "m", tokens: 10, estimatedCostUsd: 0.5 });
    const invoice = first.createInvoice({ customerId: customer.customerId });
    if (!invoice.ok) throw new Error(invoice.message);
    expect(existsSync(ledgerPath)).toBe(true);
    const lines = readFileSync(ledgerPath, "utf8").trim().split("\n");
    expect(lines.length).toBeGreaterThanOrEqual(3);
    expect(() => JSON.parse(lines[0])).not.toThrow();

    const restarted = createLocalLedgerBillingProvider({ ledgerPath, clock });
    const summary = restarted.getLedgerSummary();
    expect(summary.customerCount).toBeGreaterThanOrEqual(1);
    expect(summary.usageEventCount).toBeGreaterThanOrEqual(1);
    const replayedSync = restarted.syncPaymentStatus({ invoiceId: invoice.invoiceId });
    if (!replayedSync.ok) throw new Error(replayedSync.message);
    expect(replayedSync.invoiceId).toBe(invoice.invoiceId);
  });

  it("supports period windows in previews", () => {
    const provider = createProvider();
    const customer = provider.createCustomer({ name: "Delta" });
    if (!customer.ok) throw new Error(customer.message);
    const early = clock();
    provider.recordUsage({ customerId: customer.customerId, providerId: "p", modelId: "m", tokens: 5, estimatedCostUsd: 0.1 });
    const late = clock();
    const windowed = provider.previewInvoice({ customerId: customer.customerId, periodStart: late });
    if (!windowed.ok) throw new Error(windowed.message);
    expect(windowed.summary.eventCount).toBe(0);
    const all = provider.previewInvoice({ customerId: customer.customerId });
    if (!all.ok) throw new Error(all.message);
    expect(all.summary.eventCount).toBe(1);
    expect(early).toBeTruthy();
  });
});
