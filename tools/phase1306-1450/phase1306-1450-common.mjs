import { access, mkdir, readFile, writeFile } from "node:fs/promises";
import { constants } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export const repoRoot = resolve(fileURLToPath(new URL("../..", import.meta.url)));
export const phaseRange = "Phase1306-1450-AIO";
export const title = "Taiji / Beidou Default Enable to Local Dogfooding Readiness";
export const evidenceDir = resolve(repoRoot, "apps/ai-gateway-service/evidence/phase1306-1450-taiji-beidou-local-dogfooding-mainline");
export const resultPath = resolve(evidenceDir, "taiji-beidou-local-dogfooding-mainline-result.json");
export const validationPath = resolve(evidenceDir, "taiji-beidou-local-dogfooding-mainline-validation-result.json");
export const reportPath = resolve(repoRoot, "docs/phase1306-1450-taiji-beidou-local-dogfooding-mainline-report.md");
export const upstreamResultPath = resolve(repoRoot, "apps/ai-gateway-service/evidence/phase1256-1305-taiji-beidou-limited-enable-to-default-readiness/taiji-beidou-limited-enable-to-default-readiness-result.json");

export const defaultEnableApprovalPath = resolve(repoRoot, "docs/approvals/phase1306-1325/default-enable-execution-approval.json");
export const callableApprovalPath = resolve(repoRoot, "docs/approvals/phase1326-1365/callable-readable-claimable-approval.json");
export const multiProviderApprovalPath = resolve(repoRoot, "docs/approvals/phase1375-1399/multi-provider-stability-approval.json");
export const localRehearsalApprovalPath = resolve(repoRoot, "docs/approvals/phase1400-1425/local-production-readiness-rehearsal-approval.json");
export const futureProductionApprovalPath = resolve(repoRoot, "docs/approvals/future-production-deploy/final-production-launch-approval-template.json");

export const dogfoodingDir = resolve(repoRoot, "docs/dogfooding/phase1426-1450");

export const batchRanges = [
  ["phase1306To1325", 1306, 1325, "Phase1306_1325"],
  ["phase1326To1365", 1326, 1365, "Phase1326_1365"],
  ["phase1366To1374", 1366, 1374, "Phase1366_1374"],
  ["phase1375To1399", 1375, 1399, "Phase1375_1399"],
  ["phase1400To1425", 1400, 1425, "Phase1400_1425"],
  ["phase1426To1450", 1426, 1450, "Phase1426_1450"],
];

export function defaultEnableApprovalTemplate() {
  return {
    phaseRange: "Phase1306-1325",
    decision: "approved_guarded_default_enable_execution",
    ownerApproved: true,
    ownerPersonallyApprovedDefaultEnable: true,
    allowDefaultEnableExecution: true,
    allowMainChainDefaultEnable: true,
    allowChatDefaultBehaviorChange: true,
    allowChatGatewayExecuteDefaultBehaviorChange: true,
    allowProviderCall: false,
    allowSecretRead: false,
    allowAuthJsonRead: false,
    allowRawCredentialRefRead: false,
    allowCredentialRefBypass: false,
    allowQuotaBypass: false,
    allowBudgetBypass: false,
    allowSelectableGateBypass: false,
    allowProviderRuntimeDefaultEnable: false,
    allowDeploy: false,
    allowRelease: false,
    allowTag: false,
    allowArtifactUpload: false,
    allowCommit: false,
    allowPush: false,
    allowWorkspaceCleanClaim: false,
    allowProductionReadyClaim: false,
    allowRealSemanticValidationClaim: false,
  };
}

export function callableApprovalTemplate() {
  return {
    phaseRange: "Phase1326-1365",
    decision: "approved_controlled_callable_readable_claimable_validation",
    ownerApproved: true,
    allowBoundedProviderCall: true,
    allowedProviders: ["nvidia"],
    allowedModels: ["nvidia/llama-3.3-nemotron-super-49b-v1"],
    allowedCredentialRefs: ["<credentialRef-name-only>"],
    maxRequests: 1,
    maxRetries: 0,
    maxEstimatedCostUsd: 0.05,
    allowCredentialRefRuntimeResolve: true,
    allowRawSecretRead: false,
    allowAuthJsonRead: false,
    allowRawCredentialRefRead: false,
    allowSecretOutput: false,
    allowClaimEvidenceBackedFacts: true,
    allowProductionReadyClaim: false,
    allowRealSemanticValidationClaim: false,
    allowRealHumanFeedbackClaim: false,
    allowProviderStabilityClaim: false,
    allowDeploy: false,
    allowRelease: false,
    allowTag: false,
    allowArtifactUpload: false,
    allowCommit: false,
    allowPush: false,
    allowWorkspaceCleanClaim: false,
  };
}

export function multiProviderApprovalTemplate() {
  return {
    phaseRange: "Phase1375-1399",
    decision: "approved_bounded_multi_provider_stability_evaluation",
    ownerApproved: true,
    allowRealProviderCalls: true,
    allowedProviders: ["nvidia"],
    allowedModels: [
      "nvidia/llama-3.3-nemotron-super-49b-v1",
      "nvidia/llama-3.1-nemotron-nano-8b-v1",
    ],
    allowedCredentialRefs: ["<credentialRef-name-only>"],
    maxRequestsTotal: 10,
    maxRequestsPerProvider: 5,
    maxRetriesPerRequest: 0,
    maxEstimatedCostUsd: 1.0,
    allowCredentialRefRuntimeResolve: true,
    allowRawSecretRead: false,
    allowAuthJsonRead: false,
    allowRawCredentialRefRead: false,
    allowSecretOutput: false,
    allowDeploy: false,
    allowRelease: false,
    allowTag: false,
    allowArtifactUpload: false,
    allowCommit: false,
    allowPush: false,
    allowProductionReadyClaim: false,
    allowRealSemanticValidationClaim: false,
    allowWorkspaceCleanClaim: false,
  };
}

export function localRehearsalApprovalTemplate() {
  return {
    phaseRange: "Phase1400-1425",
    decision: "approved_local_production_readiness_rehearsal_only",
    ownerApproved: true,
    targetEnvironment: "local",
    allowLocalRuntimeChecks: true,
    allowLocalSmoke: true,
    allowLocalRollbackDrill: true,
    allowLocalIncidentDryRun: true,
    allowDeploy: false,
    allowRelease: false,
    allowTag: false,
    allowArtifactUpload: false,
    allowProviderCallsForLocalSmoke: false,
    allowRawSecretRead: false,
    allowAuthJsonRead: false,
    allowRawCredentialRefRead: false,
    allowSecretOutput: false,
    allowCommit: false,
    allowPush: false,
    allowWorkspaceCleanClaim: false,
    allowProductionReadyClaim: false,
    allowPublicLaunchClaim: false,
  };
}

export function futureProductionApprovalTemplate() {
  return {
    phaseRange: "FutureProductionDeploy",
    decision: "pending_after_real_one_to_two_month_local_dogfooding",
    ownerApproved: false,
    realOneMonthDogfoodingCompleted: false,
    realTwoMonthDogfoodingCompleted: false,
    ownerLongRunFeedbackReviewed: false,
    allowProductionDeploy: false,
    allowPublicLaunch: false,
    allowRelease: false,
    allowTag: false,
    allowArtifactUpload: false,
    allowProviderCallExpansion: false,
    allowProductionReadyClaim: false,
    allowWorkspaceCleanClaim: false,
  };
}

export function safetyBoundary() {
  return {
    secretValueExposed: false,
    rawSecretReadByCodex: false,
    authJsonRead: false,
    rawCredentialRefRead: false,
    credentialRefBypassed: false,
    quotaBypassed: false,
    budgetBypassed: false,
    selectableGateBypassed: false,
    providerCallsExceededApproval: false,
    estimatedCostExceededApproval: false,
    unapprovedProviderCalled: false,
    unapprovedModelCalled: false,
    providerRuntimeDefaultEnabled: false,
    defaultEnableExecuted: true,
    mainChainDefaultEnabled: true,
    taijiBeidouDefaultEnabled: true,
    deployExecuted: false,
    releaseExecuted: false,
    tagCreated: false,
    artifactUploaded: false,
    commitCreated: false,
    pushExecuted: false,
    workspaceCleanClaimed: false,
    legacyModified: false,
    projectContextModified: false,
    characterModuleRestored: false,
    productionReadyClaimed: false,
    publicLaunchClaimed: false,
    realSemanticValidationClaimedWithoutEvidence: false,
    ownerLongRunFeedbackClaimedWithoutActualRecords: false,
  };
}

export function phaseDocPath(phaseNumber) {
  return resolve(repoRoot, `docs/phase${phaseNumber}-taiji-beidou-local-dogfooding-mainline.md`);
}

export async function readTextIfExists(path, fallback = "") {
  try {
    return String(await readFile(path, "utf8"));
  } catch {
    return fallback;
  }
}

export async function readJsonIfExists(path, fallback = null) {
  const text = await readTextIfExists(path, "");
  if (!text) return fallback;
  try {
    return JSON.parse(text);
  } catch {
    return fallback;
  }
}

export async function pathExists(path) {
  try {
    await access(path, constants.F_OK);
    return true;
  } catch {
    return false;
  }
}

export async function writeJson(path, value) {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

export async function writeText(path, value) {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, `${String(value).trimEnd()}\n`, "utf8");
}

export function findBlocker(checks) {
  for (const [key, passed] of Object.entries(checks)) {
    if (passed !== true) return key;
  }
  return null;
}
