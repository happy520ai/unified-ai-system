export const ISOLATED_RUNTIME_CANDIDATE_ROUTE_ID = "codex_exec_crs_isolated_runtime_candidate";
export const ISOLATED_RUNTIME_CANDIDATE_PROVIDER_ID = "crs";
export const ISOLATED_RUNTIME_CANDIDATE_ACK = "CONTEXT_GATEWAY_MODEL_PROVIDER_OK";

export function buildIsolatedRuntimeCandidateContract() {
  return {
    routeId: ISOLATED_RUNTIME_CANDIDATE_ROUTE_ID,
    routeType: "codex_exec_custom_model_provider",
    selectedProviderId: ISOLATED_RUNTIME_CANDIDATE_PROVIDER_ID,
    mode: "isolated_runtime_candidate",
    defaultChatIntegrated: false,
    chatGatewayExecuteIntegrated: false,
    providerRuntimeMainChainModified: false,
    dryRunDefault: true,
    realExecutionRequiresPhase624Confirmation: true,
    maxRequestsDefault: 1,
    maxRequestsHardLimit: 3,
    retryLimit: 0,
    stopOnFirstFailure: true,
    expectedAck: ISOLATED_RUNTIME_CANDIDATE_ACK,
    authJsonAccessAllowed: false,
    codexConfigWriteAllowed: false,
    projectCodexConfigWriteAllowed: false,
    deployAllowed: false,
    releaseAllowed: false,
    pushAllowed: false,
    commitAllowed: false,
    productionReady: false,
    releaseReady: false,
  };
}

export function buildIsolatedRuntimeCandidateCommandPreview() {
  return 'codex exec -c model_provider="crs" "Read .codex-context/current-context-pack.md. Check .codex-context/context-freshness-report.json and confirm stale=false. Read .codex-context/relevant-files.json. Do not edit files. Do not scan the full repository. Do not read secrets. Reply with one line only: CONTEXT_GATEWAY_MODEL_PROVIDER_OK."';
}
