import { getFreeModelFirstPolicy } from "./freeModelFirstPolicy.js";
import { getPaidApiGuardPolicy } from "./paidProviderApprovalPolicy.js";

export const mimoNonDefaultPolicy = {
  enabled: true,
  defaultAllowed: false,
  requiresManualApproval: true,
};

export const embeddingNonDefaultPolicy = {
  enabled: true,
  defaultAllowed: false,
  requiresManualApproval: true,
};

export function getProviderCostGovernancePolicy() {
  const freeModelPolicy = getFreeModelFirstPolicy();
  const paidGuardPolicy = getPaidApiGuardPolicy();

  return {
    enabled: true,
    mode: "local-static-policy-only",
    freeModelFirstPolicy: freeModelPolicy,
    paidApiGuardPolicy: paidGuardPolicy,
    manualApprovalRequired: true,
    autoFallbackToPaidDisabled: true,
    mimoNonDefaultPolicy: { ...mimoNonDefaultPolicy },
    embeddingNonDefaultPolicy: { ...embeddingNonDefaultPolicy },
    paidProviderDefaultAllowed: false,
    fallbackToPaidProviderAutoAllowed: false,
    providerDefaultChanged: false,
    realProviderCallPerformed: false,
  };
}
