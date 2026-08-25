export function createProviderConfigRoutes({ providerKeyConfigStore }) {
  return {
    status() {
      return providerKeyConfigStore.getStatus();
    },

    save(body) {
      return providerKeyConfigStore.save(body);
    },

    test(body, gatewayService) {
      return providerKeyConfigStore.test(body, gatewayService);
    },
  };
}
