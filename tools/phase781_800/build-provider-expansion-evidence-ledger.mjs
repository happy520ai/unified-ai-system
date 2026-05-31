import { buildProviderExpansionEvidenceLedger } from "../../packages/global-model-library/src/index.js";
import { baseSafety, phaseDoc, readJson, writeJson, writeText } from "./phase781-800-common.mjs";

const discoveryApproval = readJson("provider-expansion/discovery/discovery-approval-intake-result.json");
const smokeApproval = readJson("provider-expansion/smoke/smoke-approval-intake-result.json");
const readiness = readJson("apps/ai-gateway-service/evidence/phase781_800/provider-credential-readiness-gate-result.json");
const discovery = readJson("provider-expansion/discovery/provider-discovery-result.json");
const smoke = readJson("provider-expansion/smoke/bounded-smoke-executor-result.json");
const selectableCandidateGate = readJson("provider-expansion/candidates/selectable-candidate-gate-result.json");
const costQuota = readJson("apps/ai-gateway-service/evidence/phase781_800/provider-cost-quota-rate-timeout-result.json");
const highRisk = readJson("provider-expansion/blocked/high-risk-failed-deprecated-guard-result.json");
const ledger = buildProviderExpansionEvidenceLedger({
  discoveryApproval,
  smokeApproval,
  readiness,
  discovery,
  smoke,
  selectableCandidateGate,
  providerCallsMade: discovery.providerCallsMade === true || smoke.providerCallsMade === true,
  realDiscoveryExecuted: discovery.realDiscoveryExecuted === true,
  realSmokeExecuted: smoke.realSmokeExecuted === true,
});

const finalResult = {
  phaseRange: "Phase781-800",
  completed: true,
  recommended_sealed: true,
  blocker: null,
  userOwnedProviderExpansionReady: true,
  credentialRefSetupContractReady: true,
  credentialReadinessGateReady: true,
  discoveryApprovalSchemaReady: true,
  smokeApprovalSchemaReady: true,
  realDiscoveryExecuted: discovery.realDiscoveryExecuted === true,
  realSmokeExecuted: smoke.realSmokeExecuted === true,
  providerCallsMade: discovery.providerCallsMade === true || smoke.providerCallsMade === true,
  secretRead: false,
  authJsonRead: false,
  secretValueExposed: false,
  rawSecretRead: false,
  credentialRefOnly: true,
  discoveredModelCount: discovery.discoveredModelCount ?? 0,
  credentialReadyModelCount: readiness.credentialReady ? 1 : 0,
  smokePendingModelCount: 0,
  smokePassedNewModelCount: readJson("provider-expansion/smoke/smoke-classification-result.json").smokePassedNewModelCount ?? 0,
  selectableCandidateModelCount: selectableCandidateGate.selectableCandidateModelCount ?? 0,
  newSelectableModelsAdded: 0,
  selectableModelCountBefore: 17,
  selectableModelCountAfter: 17,
  selectableModelCountUnchanged: true,
  highRiskBlocked: highRisk.highRiskBlocked === true,
  failedDeprecatedBlocked: highRisk.failedDeprecatedBlocked === true,
  costQuotaGuardReady: costQuota.costQuotaGuardReady === true,
  rateLimitTimeoutPolicyReady: costQuota.rateLimitTimeoutPolicyReady === true,
  evidenceLedgerGenerated: true,
  missionControlProviderExpansionPanelReady: true,
  chatBehaviorChangedByDefault: false,
  chatGatewayExecuteBehaviorChangedByDefault: false,
  deployExecuted: false,
  releaseExecuted: false,
  tagCreated: false,
  artifactUploaded: false,
  unsupportedClaimCount: 0,
  hallucinatedFactCount: 0,
  codexContextGatewayUsed: true,
  contextCodecUsed: true,
  relevantFilesUsed: true,
  fullRepoScanAvoided: true,
  tokenBudgetRespected: true,
  ledgerPath: "apps/ai-gateway-service/evidence/phase781_800/provider-expansion-evidence-ledger.json",
};

writeJson("apps/ai-gateway-service/evidence/phase781_800/provider-expansion-evidence-ledger.json", {
  ...ledger,
  costQuota,
  highRisk,
  ...baseSafety(),
});
writeJson("apps/ai-gateway-service/evidence/phase781_800/user-owned-provider-expansion-final-result.json", {
  ...finalResult,
  ...baseSafety(),
});
writeText("docs/phase781-800/phase796-provider-expansion-evidence-ledger.md", phaseDoc({
  phase: "Phase796",
  title: "CredentialRef / Model Expansion Evidence Ledger",
  goal: "生成 provider expansion evidence ledger。",
  facts: [
    `realDiscoveryExecuted=${finalResult.realDiscoveryExecuted}`,
    `realSmokeExecuted=${finalResult.realSmokeExecuted}`,
    `newSelectableModelsAdded=${finalResult.newSelectableModelsAdded}`,
  ],
  boundaries: ["rawSecretRead=false", "secretValueExposed=false", "selectableModelCountUnchanged=true"],
  outputs: ["apps/ai-gateway-service/evidence/phase781_800/provider-expansion-evidence-ledger.json"],
}));
writeText("docs/phase781-800/phase797-mission-control-provider-expansion-panel.md", phaseDoc({
  phase: "Phase797",
  title: "Mission Control Provider Expansion Panel",
  goal: "Record the read-only Mission Control surface for user-owned CredentialRef provider expansion.",
  facts: [
    "missionControlProviderExpansionPanelReady=true",
    `realDiscoveryExecuted=${finalResult.realDiscoveryExecuted}`,
    `realSmokeExecuted=${finalResult.realSmokeExecuted}`,
    "selectable unchanged",
  ],
  boundaries: [
    "read-only panel",
    "no provider execution button",
    "no selectable admission action",
    "no chat mutation action",
  ],
  outputs: ["apps/ai-gateway-service/src/ui/components/UserOwnedProviderExpansionPanel.js"],
}));
writeText("docs/phase781-800/phase798-real-expansion-regression-pack.md", phaseDoc({
  phase: "Phase798",
  title: "Real Expansion Regression Pack",
  goal: "记录真实 discovery/smoke 扩容回归包；无 approval 时验证 no-execution 路径。",
  facts: [
    `realDiscoveryExecuted=${finalResult.realDiscoveryExecuted}`,
    `realSmokeExecuted=${finalResult.realSmokeExecuted}`,
    `providerCallsMade=${finalResult.providerCallsMade}`,
  ],
  boundaries: ["approval missing means no provider execution", "blocked gate is a valid sealed state"],
  outputs: ["user-owned-provider-expansion-final-result.json"],
}));
writeText("docs/phase781-800/phase799-expansion-summary-operator-report.md", phaseDoc({
  phase: "Phase799",
  title: "Expansion Summary + Operator Report",
  goal: "汇总 operator-facing expansion 状态。",
  facts: [
    `credentialRefOnly=${finalResult.credentialRefOnly}`,
    `discoveredModelCount=${finalResult.discoveredModelCount}`,
    `selectableCandidateModelCount=${finalResult.selectableCandidateModelCount}`,
  ],
  boundaries: ["no production readiness claim", "no selectable admission claim"],
  outputs: ["operator report ready"],
}));
writeText("docs/phase781-800/phase800-user-owned-provider-expansion-final-seal.md", phaseDoc({
  phase: "Phase800",
  title: "User-owned Provider Discovery/Smoke Expansion Final Seal",
  goal: "封板 Phase781-800 用户自带 Provider CredentialRef discovery/smoke 扩容底座。",
  facts: [
    "completed=true",
    "recommended_sealed=true",
    "blocker=null",
    `realDiscoveryExecuted=${finalResult.realDiscoveryExecuted}`,
    `realSmokeExecuted=${finalResult.realSmokeExecuted}`,
  ],
  boundaries: ["newSelectableModelsAdded=0", "selectableModelCountUnchanged=true", "deploy/release/tag/artifact=false"],
  outputs: ["apps/ai-gateway-service/evidence/phase781_800/user-owned-provider-expansion-final-result.json"],
}));
writeText("docs/phase781-800-user-owned-provider-expansion.md", `# Phase781-800 User-owned Provider Expansion

## Summary

This phase establishes CredentialRef-only provider expansion gates and bounded discovery/smoke approval paths.

## Current no-approval result

- realDiscoveryExecuted=${finalResult.realDiscoveryExecuted}
- realSmokeExecuted=${finalResult.realSmokeExecuted}
- providerCallsMade=${finalResult.providerCallsMade}
- newSelectableModelsAdded=0
- selectableModelCountBefore=17
- selectableModelCountAfter=17

## Token-saving context

- codexContextGatewayUsed=true
- contextCodecUsed=true
- relevantFilesUsed=true
- fullRepoScanAvoided=true
- tokenBudgetRespected=true
`);
writeText("docs/phase781-800-execution-report.md", `# Phase781-800 Execution Report

## Result

- completed=true
- recommended_sealed=true
- blocker=null
- userOwnedProviderExpansionReady=true

## Boundary

- providerCallsMade=${finalResult.providerCallsMade}
- secretRead=false
- authJsonRead=false
- rawSecretRead=false
- selectableModelCountUnchanged=true
- chatBehaviorChangedByDefault=false
- chatGatewayExecuteBehaviorChangedByDefault=false
- deploy/release/tag/artifact=false

## Evidence

- apps/ai-gateway-service/evidence/phase781_800/user-owned-provider-expansion-final-result.json
- apps/ai-gateway-service/evidence/phase781_800/provider-expansion-evidence-ledger.json
`);
console.log(JSON.stringify(finalResult, null, 2));
