export function buildBillingEvent({ eventId, estimate, eventType = "estimate_created", auditTrace = {} } = {}) {
  return {
    eventId,
    requestId: estimate.requestId,
    userIdRef: estimate.userIdRef,
    mode: estimate.mode,
    providerId: estimate.providerId,
    modelId: estimate.modelId,
    eventType,
    estimatedCost: estimate.estimatedCost,
    actualCost: null,
    actualCostAvailable: false,
    billingProviderConnected: false,
    timestamp: new Date().toISOString(),
    auditTrace,
  };
}
