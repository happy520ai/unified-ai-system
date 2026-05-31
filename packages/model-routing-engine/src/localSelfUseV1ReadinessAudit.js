import { buildReadySeal, safetyFields } from "./localSelfUseV1ClosureCommon.js";

export function buildLocalSelfUseV1ReadinessAudit({
  supplemental = {},
  policy = {},
  consoleSeal = {},
  automation = {},
  soak = {},
  safety = {},
} = {}) {
  return buildReadySeal({
    phaseRange: "Phase996",
    checks: {
      supplementalClosureReady: supplemental.round2GodBlockerClearedBySupplement === true,
      routePolicyDesignReady: policy.disabledByDefaultPolicyConfigReady === true,
      localConsoleReady: consoleSeal.unifiedLocalRoutingOperatorPanelReady === true,
      operationAutomationReady: automation.localRegressionRoutineReady === true,
      soakFrameworkReady: soak.sevenDaySoakFrameworkReady === true,
      safetyBoundaryReady: safety.safetyBoundaryFinalRecheckPassed !== false,
    },
    extra: {
      localSelfUseV1ReadinessAuditReady: true,
      ...safetyFields(),
    },
  });
}
