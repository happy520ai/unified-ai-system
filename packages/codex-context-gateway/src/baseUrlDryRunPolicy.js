export function buildBaseUrlDryRunPolicy() {
  return {
    completed: true,
    baseUrlDryRunPolicyWorks: true,
    designOnlyAllowed: true,
    dryRunSimulationAllowed: true,
    realConfigWriteForbidden: true,
    realRelayStartForbidden: true,
    realProviderCallForbidden: true,
    realSecretReadForbidden: true,
    failClosedOnAuthorizationGap: true,
    summary: [
      "Design-only and dry-run simulation are allowed.",
      "Real config writes are forbidden.",
      "Real relay start is forbidden.",
      "Real provider calls are forbidden.",
      "Real secret reads are forbidden.",
    ],
  };
}
