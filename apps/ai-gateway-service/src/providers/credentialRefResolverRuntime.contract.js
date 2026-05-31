export const CREDENTIAL_REF_RESOLVER_RUNTIME_CONTRACT = Object.freeze({
  runtimeName: "credentialRefResolverRuntime",
  credentialRefPrefix: "credentialRef:",
  maxTimeoutMs: 60000,
  rawSecretReadableByCodex: false,
  authJsonReadableByCodex: false,
  envDumpAllowed: false,
  directProviderFetchAllowed: false,
  defaultChatGatewayExecuteRouteChangeAllowed: false,
  safeExecutionInvokerRequiredForRealProviderCall: true,
  supportedProviderRefs: Object.freeze([
    Object.freeze({
      providerId: "nvidia",
      credentialRef: "credentialRef:nvidia:default",
      allowedModelIds: Object.freeze([
        "nvidia/llama-3.3-nemotron-super-49b-v1",
      ]),
    }),
    Object.freeze({
      providerId: "openrouter",
      credentialRef: "credentialRef:openrouter:default",
      allowedModelIds: Object.freeze([
        "openai/gpt-4o-mini",
        "deepseek/deepseek-v4-flash:free",
        "moonshotai/kimi-k2.6:free",
        "google/gemma-4-31b-it:free",
        "qwen/qwen3-next-80b-a3b-instruct:free",
        "nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free",
      ]),
    }),
    Object.freeze({
      providerId: "mimo",
      credentialRef: "credentialRef:mimo:default",
      allowedModelIds: Object.freeze([
        "mimo-v2.5-pro",
      ]),
    }),
  ]),
});
