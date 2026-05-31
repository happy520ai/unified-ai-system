export function buildRouteRollbackDisablePlan(input = {}) {
  const failures = input.failures || [];
  return {
    phase: "Phase832",
    routeRollbackDisableReady: true,
    supportedActions: [
      "disable_model",
      "disable_provider",
      "disable_route_policy",
      "disable_mode_routing",
      "disable_god_route",
      "disable_tianshu_route",
    ],
    recommendedActions: failures.length > 0
      ? ["keep_real_route_disabled", "require_credentialref_recheck", "preserve_dry_run_recommendation"]
      : ["keep_guarded_route_enabled_only_with_approval"],
    routeDefaultDisabled: true,
    chatDefaultEnabled: false,
    chatGatewayExecuteDefaultEnabled: false,
    providerCallsMade: false,
    secretRead: false,
  };
}
