export function buildRelayArchitectureDesign() {
  const chain = [
    "Codex CLI / IDE",
    "Codex base_url / proxy config",
    "Codex Context Gateway Relay",
    "Context Pack Gate",
    "Token Budget Gate",
    "Account Pool Policy",
    "Upstream Relay / Provider abstraction",
    "Response",
    "Evidence / Audit",
  ];
  return {
    completed: true,
    relayArchitectureDefined: true,
    contextPackGateIncluded: chain.includes("Context Pack Gate"),
    tokenBudgetGateIncluded: chain.includes("Token Budget Gate"),
    accountPoolPolicyIncluded: chain.includes("Account Pool Policy"),
    upstreamProviderAbstracted: chain.includes("Upstream Relay / Provider abstraction"),
    relayStarted: false,
    providerCallsMade: false,
    chain,
    separateContract: "codex-context-gateway-relay-design-contract",
  };
}
