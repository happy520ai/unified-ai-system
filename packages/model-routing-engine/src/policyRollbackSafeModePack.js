import { safetyFields } from "./localSelfUseV1ClosureCommon.js";

export function buildPolicyRollbackSafeModePack() {
  return {
    phase: "Phase979",
    completed: true,
    recommended_sealed: true,
    blocker: null,
    rollbackReady: true,
    safeModeReady: true,
    policyRollbackSafeModeReady: true,
    actions: [
      "disable route policy",
      "disable God Mode route",
      "disable Tianshu route",
      "disable provider route",
      "disable fallback",
      "restore previous scoring weights",
    ],
    runtimeChanged: false,
    ...safetyFields(),
  };
}
