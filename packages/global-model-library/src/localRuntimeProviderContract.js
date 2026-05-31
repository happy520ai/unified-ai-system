export function buildLocalRuntimeProviderContract() {
  return {
    contractName: "local-runtime-provider-contract",
    version: "phase766.v1",
    supportedFamilies: ["ollama-local", "lm-studio-local", "vllm-private"],
    runtimeEnabled: false,
    providerCallsMade: false,
    secretRead: false,
    localRuntimeRules: [
      "local manifests may be read only after explicit operator selection in a future phase",
      "this phase uses static fixtures only",
      "local models stay cataloged or credential_missing until a local smoke gate exists",
      "private endpoints and raw base_url values must not be printed",
    ],
    requiredRuntimeDescriptorFields: [
      "providerFamily",
      "runtimeType",
      "credentialPolicy",
      "baseUrlPolicy",
      "modelManifestPolicy",
      "smokePlanPreview",
    ],
  };
}
