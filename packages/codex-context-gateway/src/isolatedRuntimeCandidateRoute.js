import {
  buildIsolatedRuntimeCandidateCommandPreview,
  buildIsolatedRuntimeCandidateContract,
  ISOLATED_RUNTIME_CANDIDATE_ACK,
} from "./isolatedRuntimeCandidateContract.js";

export function buildIsolatedRuntimeCandidateRoutePreview() {
  const contract = buildIsolatedRuntimeCandidateContract();
  return {
    ...contract,
    commandPreview: buildIsolatedRuntimeCandidateCommandPreview(),
    dryRunSmoke: {
      routeContractLoadable: true,
      guardedPromptLoadable: true,
      maxRequestsPolicyApplied: contract.maxRequestsDefault === 1 && contract.maxRequestsHardLimit === 3,
      rollbackPolicyReferenced: true,
      emergencyDisablePolicyReferenced: true,
      realCodexExecExecuted: false,
      providerCallMade: false,
    },
    responsePolicy: {
      passRequiresAck: ISOLATED_RUNTIME_CANDIDATE_ACK,
      missingAckClassification: "invalid_response",
      ttyClassification: "failed_tty",
      timeoutClassification: "timeout",
    },
  };
}
