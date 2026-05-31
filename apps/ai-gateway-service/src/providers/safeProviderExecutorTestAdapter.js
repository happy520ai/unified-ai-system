export function createSafeProviderExecutorTestAdapter(options = {}) {
  const marker = options.marker ?? "PME_PROVIDER_ONE_SHOT_OK";

  async function execute(envelope = {}) {
    return {
      ok: true,
      syntheticAdapterUsed: true,
      providerCallsMade: false,
      realProviderNetworkAttempted: false,
      status: 200,
      latencyMs: 0,
      providerId: envelope.providerId,
      modelId: envelope.modelId,
      text: marker,
    };
  }

  return {
    adapterName: "safeProviderExecutorTestAdapter",
    syntheticAdapterUsed: true,
    execute,
  };
}
