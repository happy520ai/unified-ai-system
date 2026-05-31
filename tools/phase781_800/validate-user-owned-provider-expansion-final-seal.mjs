import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = resolve(fileURLToPath(new URL("../..", import.meta.url)));

const REQUIRED_FILES = [
  "apps/ai-gateway-service/evidence/phase761_780/global-model-library-expansion-final-result.json",
  "packages/global-model-library/src/userOwnedCredentialRefSetup.js",
  "packages/global-model-library/src/providerCredentialReadinessGate.js",
  "packages/global-model-library/src/discoveryApprovalSchema.js",
  "packages/global-model-library/src/providerDiscoveryAdapterV0.js",
  "packages/global-model-library/src/discoveryResultNormalizer.js",
  "packages/global-model-library/src/smokeApprovalSchema.js",
  "packages/global-model-library/src/boundedSmokeExecutorV0.js",
  "packages/global-model-library/src/smokeResultClassifier.js",
  "packages/global-model-library/src/selectableCandidateGate.js",
  "packages/global-model-library/src/providerCostQuotaGuard.js",
  "packages/global-model-library/src/providerRateLimitTimeoutPolicy.js",
  "packages/global-model-library/src/highRiskFailedDeprecatedGuard.js",
  "packages/global-model-library/src/modelCapabilityEnrichment.js",
  "packages/global-model-library/src/catalogMergeAliasResolverRecheck.js",
  "packages/global-model-library/src/providerExpansionEvidenceLedger.js",
  "tools/phase781_800/build-user-owned-credentialref-contract.mjs",
  "tools/phase781_800/run-provider-credential-readiness-gate.mjs",
  "tools/phase781_800/build-discovery-approval-schema.mjs",
  "tools/phase781_800/intake-discovery-approval.mjs",
  "tools/phase781_800/run-provider-discovery-adapter-v0.mjs",
  "tools/phase781_800/run-discovery-result-normalizer.mjs",
  "tools/phase781_800/build-smoke-approval-schema.mjs",
  "tools/phase781_800/intake-smoke-approval.mjs",
  "tools/phase781_800/run-bounded-smoke-executor-v0.mjs",
  "tools/phase781_800/run-smoke-result-classifier.mjs",
  "tools/phase781_800/run-selectable-candidate-gate.mjs",
  "tools/phase781_800/run-provider-cost-quota-guard.mjs",
  "tools/phase781_800/run-high-risk-failed-deprecated-guard.mjs",
  "tools/phase781_800/run-model-capability-enrichment.mjs",
  "tools/phase781_800/run-global-catalog-merge-alias-recheck.mjs",
  "tools/phase781_800/build-provider-expansion-evidence-ledger.mjs",
  "apps/ai-gateway-service/src/ui/components/UserOwnedProviderExpansionPanel.js",
  "apps/ai-gateway-service/src/ui/copy/userOwnedProviderExpansionCopy.js",
  "apps/ai-gateway-service/evidence/phase781_800/user-owned-provider-expansion-final-result.json",
  "apps/ai-gateway-service/evidence/phase781_800/provider-expansion-evidence-ledger.json",
  "provider-expansion/approvals/discovery-approval-schema.json",
  "provider-expansion/approvals/smoke-approval-schema.json",
  "provider-expansion/discovery/discovery-approval-intake-result.json",
  "provider-expansion/discovery/provider-discovery-result.json",
  "provider-expansion/discovery/discovery-normalized-result.json",
  "provider-expansion/smoke/smoke-approval-intake-result.json",
  "provider-expansion/smoke/bounded-smoke-executor-result.json",
  "provider-expansion/smoke/smoke-classification-result.json",
  "provider-expansion/candidates/selectable-candidate-gate-result.json",
  "provider-expansion/blocked/high-risk-failed-deprecated-guard-result.json",
  "docs/phase781-800/phase781-user-owned-provider-credentialref-contract.md",
  "docs/phase781-800/phase782-credentialref-setup-guide-validation-schema.md",
  "docs/phase781-800/phase783-provider-credential-readiness-gate.md",
  "docs/phase781-800/phase784-discovery-approval-packet-schema.md",
  "docs/phase781-800/phase785-provider-discovery-adapter-v0.md",
  "docs/phase781-800/phase786-discovery-result-normalizer.md",
  "docs/phase781-800/phase787-smoke-approval-packet-schema.md",
  "docs/phase781-800/phase788-bounded-smoke-executor-v0.md",
  "docs/phase781-800/phase789-smoke-result-classifier.md",
  "docs/phase781-800/phase790-selectable-candidate-gate.md",
  "docs/phase781-800/phase791-provider-cost-quota-guard.md",
  "docs/phase781-800/phase792-provider-rate-limit-timeout-policy.md",
  "docs/phase781-800/phase793-high-risk-failed-deprecated-model-guard.md",
  "docs/phase781-800/phase794-model-capability-enrichment.md",
  "docs/phase781-800/phase795-global-catalog-merge-alias-resolver-recheck.md",
  "docs/phase781-800/phase796-provider-expansion-evidence-ledger.md",
  "docs/phase781-800/phase797-mission-control-provider-expansion-panel.md",
  "docs/phase781-800/phase798-real-expansion-regression-pack.md",
  "docs/phase781-800/phase799-expansion-summary-operator-report.md",
  "docs/phase781-800/phase800-user-owned-provider-expansion-final-seal.md",
  "docs/phase781-800-user-owned-provider-expansion.md",
  "docs/phase781-800-execution-report.md",
];

const REQUIRED_FINAL_FLAGS = {
  phaseRange: "Phase781-800",
  completed: true,
  recommended_sealed: true,
  blocker: null,
  userOwnedProviderExpansionReady: true,
  credentialRefSetupContractReady: true,
  credentialReadinessGateReady: true,
  discoveryApprovalSchemaReady: true,
  smokeApprovalSchemaReady: true,
  credentialRefOnly: true,
  rawSecretRead: false,
  secretRead: false,
  authJsonRead: false,
  secretValueExposed: false,
  newSelectableModelsAdded: 0,
  selectableModelCountBefore: 17,
  selectableModelCountAfter: 17,
  selectableModelCountUnchanged: true,
  highRiskBlocked: true,
  failedDeprecatedBlocked: true,
  costQuotaGuardReady: true,
  rateLimitTimeoutPolicyReady: true,
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
};

const failures = [];

for (const file of REQUIRED_FILES) {
  if (!existsSync(resolve(repoRoot, file))) failures.push(`missing required file: ${file}`);
}

const packageJson = readJsonIfPresent("package.json");
if (!packageJson?.scripts?.["verify:phase781-800-user-owned-provider-expansion"]) {
  failures.push("missing package script verify:phase781-800-user-owned-provider-expansion");
}
if (!packageJson?.scripts?.["run:phase781-800-user-owned-provider-expansion"]) {
  failures.push("missing package script run:phase781-800-user-owned-provider-expansion");
}

const phase761 = readJsonIfPresent("apps/ai-gateway-service/evidence/phase761_780/global-model-library-expansion-final-result.json");
if (phase761?.completed !== true || phase761?.recommended_sealed !== true) {
  failures.push("Phase761-780 final evidence must be completed and recommended_sealed");
}

const finalResult = readJsonIfPresent("apps/ai-gateway-service/evidence/phase781_800/user-owned-provider-expansion-final-result.json");
if (finalResult) {
  for (const [key, expected] of Object.entries(REQUIRED_FINAL_FLAGS)) {
    if (finalResult[key] !== expected) failures.push(`final result ${key} expected ${JSON.stringify(expected)} got ${JSON.stringify(finalResult[key])}`);
  }
  if (finalResult.realDiscoveryExecuted === true && finalResult.providerCallsMade !== true) {
    failures.push("realDiscoveryExecuted=true requires providerCallsMade=true");
  }
  if (finalResult.realSmokeExecuted === true && finalResult.providerCallsMade !== true) {
    failures.push("realSmokeExecuted=true requires providerCallsMade=true");
  }
  if (finalResult.newSelectableModelsAdded !== 0) failures.push("newSelectableModelsAdded must stay 0");
}

const ledger = readJsonIfPresent("apps/ai-gateway-service/evidence/phase781_800/provider-expansion-evidence-ledger.json");
if (ledger) {
  if (ledger.rawSecretRead !== false) failures.push("ledger rawSecretRead must be false");
  if (ledger.secretValueExposed !== false) failures.push("ledger secretValueExposed must be false");
  if (ledger.selectableModelCountUnchanged !== true) failures.push("ledger selectableModelCountUnchanged must be true");
}

const panel = readTextIfPresent("apps/ai-gateway-service/src/ui/components/UserOwnedProviderExpansionPanel.js");
if (panel) {
  for (const marker of [
    "User-owned Provider Expansion",
    "credentialRef-only",
    "realDiscoveryExecuted",
    "realSmokeExecuted",
    "selectable unchanged",
  ]) {
    if (!panel.includes(marker)) failures.push(`UserOwnedProviderExpansionPanel marker missing: ${marker}`);
  }
  for (const forbidden of ["读取 API Key", "立即 selectable", "绕过 CredentialRef", "部署", "修改 /chat", "修改 /chat-gateway/execute"]) {
    if (panel.includes(forbidden)) failures.push(`UserOwnedProviderExpansionPanel contains forbidden UI copy: ${forbidden}`);
  }
}

const missionControl = readTextIfPresent("apps/ai-gateway-service/src/ui/components/MissionControlPanel.js");
if (missionControl && !missionControl.includes("renderUserOwnedProviderExpansionPanel")) {
  failures.push("MissionControlPanel must render UserOwnedProviderExpansionPanel");
}

if (failures.length > 0) {
  console.error(JSON.stringify({ phaseRange: "Phase781-800", passed: false, failures }, null, 2));
  process.exit(1);
}

console.log(JSON.stringify({
  phaseRange: "Phase781-800",
  passed: true,
  completed: true,
  recommended_sealed: true,
  providerCallsMade: finalResult.providerCallsMade,
  realDiscoveryExecuted: finalResult.realDiscoveryExecuted,
  realSmokeExecuted: finalResult.realSmokeExecuted,
  secretRead: false,
  selectableModified: false,
}, null, 2));

function readJsonIfPresent(relativePath) {
  const path = resolve(repoRoot, relativePath);
  if (!existsSync(path)) return null;
  return JSON.parse(readFileSync(path, "utf8"));
}

function readTextIfPresent(relativePath) {
  const path = resolve(repoRoot, relativePath);
  if (!existsSync(path)) return "";
  return readFileSync(path, "utf8");
}
