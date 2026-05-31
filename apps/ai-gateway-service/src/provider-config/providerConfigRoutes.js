export function createProviderConfigRoutes({ providerKeyConfigStore }) {
  return {
    status() {
      return providerKeyConfigStore.getStatus();
    },

    save(body) {
      return providerKeyConfigStore.save(body);
    },

    test(body) {
      return providerKeyConfigStore.test(body);
    },
  };
}
