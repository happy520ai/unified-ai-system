export function buildRelaySimulationPlan(options = {}) {
  const chain = [
    "Codex CLI / IDE",
    "simulated base_url / proxy config",
    "simulated relay",
    "Context Pack Gate",
    "Token Budget Gate",
    "Account Pool Policy",
    "simulated upstream relay / provider abstraction",
    "simulated response",
    "evidence / audit",
  ];
  return {
    completed: true,
    relaySimulationPlanGenerated: true,
    contextPackGateIncluded: chain.includes("Context Pack Gate"),
    tokenBudgetGateIncluded: chain.includes("Token Budget Gate"),
    accountPoolPolicyIncluded: chain.includes("Account Pool Policy"),
    upstreamProviderAbstracted: chain.includes("simulated upstream relay / provider abstraction"),
    simulatedUpstreamOnly: true,
    relayStarted: false,
    providerCallsMade: false,
    relayRef: options.relayRef || "relayRef:phase598-dry-run-preview",
    chain,
    simulationSteps: [
      "Accept authorization evidence intake.",
      "Build a redacted config preview.",
      "Resolve context pack gate and token budget gate.",
      "Simulate account pool selection and credentialRef binding.",
      "Return a simulated response and write evidence only.",
    ],
  };
}
