export const TAIJI_BEIDOU_AUTO_RUNTIME_FLAG = "TAIJI_BEIDOU_AUTO_RUNTIME_ENABLED";

export function createRuntimeKillSwitch(overrides = {}) {
  return {
    killSwitchRef: TAIJI_BEIDOU_AUTO_RUNTIME_FLAG,
    defaultEnabled: false,
    sandboxDryRunOverrideAllowed: true,
    productionRuntimeAllowed: false,
    disabledReason: "global_disable_flag_defaults_false",
    ...overrides,
  };
}

export function evaluateRuntimeKillSwitch(input = {}) {
  const policy = createRuntimeKillSwitch(input.policy);
  const sandboxDryRunRequested = input.runtimeKind === "sandbox_local";
  const phaseDryRunOverride = input.phaseDryRunOverride === true;
  const disabledByPolicy = policy.defaultEnabled !== true;
  const allowed =
    sandboxDryRunRequested &&
    phaseDryRunOverride &&
    policy.sandboxDryRunOverrideAllowed === true &&
    policy.productionRuntimeAllowed === false;

  return {
    killSwitchRef: policy.killSwitchRef,
    available: true,
    disabledByDefault: disabledByPolicy,
    sandboxDryRunAllowed: allowed,
    productionRuntimeAllowed: false,
    blockedReason: allowed ? null : "auto_runtime_global_disable",
  };
}
