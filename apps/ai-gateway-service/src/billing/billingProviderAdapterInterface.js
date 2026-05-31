export function createBillingProviderAdapterInterface() {
  const notImplemented = () => ({ implemented: false, code: "BILLING_PROVIDER_NOT_CONNECTED", paymentProviderConnected: false });
  return {
    createCustomer: notImplemented,
    createInvoice: notImplemented,
    previewInvoice: notImplemented,
    recordUsage: notImplemented,
    voidInvoice: notImplemented,
    syncPaymentStatus: notImplemented,
  };
}
