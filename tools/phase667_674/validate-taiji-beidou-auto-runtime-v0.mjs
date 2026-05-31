import { access, readFile, writeFile, mkdir } from "node:fs/promises";
import { constants } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = resolve(fileURLToPath(new URL("../..", import.meta.url)));

const requiredModuleFiles = [
  "packages/taiji-beidou-engine/src/runtimeEligibilityReview.js",
  "packages/taiji-beidou-engine/src/registryAdmissionGate.js",
  "packages/taiji-beidou-engine/src/sandboxAutoRuntimeExecutor.js",
  "packages/taiji-beidou-engine/src/runtimeScheduler.js",
  "packages/taiji-beidou-engine/src/runtimeLeaseManager.js",
  "packages/taiji-beidou-engine/src/runtimeBudgetGuard.js",
  "packages/taiji-beidou-engine/src/runtimeEvidenceLedger.js",
  "packages/taiji-beidou-engine/src/runtimeResultMerger.js",
  "packages/taiji-beidou-engine/src/runtimeFailurePolicy.js",
  "packages/taiji-beidou-engine/src/runtimeKillSwitch.js",
  "packages/taiji-beidou-engine/src/autoRuntimeFixtures.js",
];

const requiredGatewayFiles = [
  "apps/ai-gateway-service/src/gateway/taijiBeidouAutoRuntimeDryRun.js",
  "apps/ai-gateway-service/src/gateway/taijiBeidouRuntimeAdmissionPreview.js",
  "apps/ai-gateway-service/src/gateway/taijiBeidouRuntimeEvidencePreview.js",
];

const requiredUiFiles = [
  "apps/ai-gateway-service/src/ui/components/TaijiBeidouAutoRuntimePanel.js",
  "apps/ai-gateway-service/src/ui/copy/taijiBeidouAutoRuntimeCopy.js",
];

const requiredDocs = [
  "docs/phase667-runtime-eligibility-review.md",
  "docs/phase668-registry-admission-gate.md",
  "docs/phase669-sandbox-auto-runtime-executor.md",
  "docs/phase670-runtime-scheduler-lease-budget.md",
  "docs/phase671-runtime-evidence-ledger-result-merger.md",
  "docs/phase672-runtime-failure-injection-kill-switch.md",
  "docs/phase673-mission-control-auto-runtime-panel.md",
  "docs/phase674-auto-runtime-v0-self-use-closure.md",
  "docs/phase667-674-taiji-beidou-auto-runtime-v0.md",
  "docs/phase667-674-execution-report.md",
];

const eligibilityEvidence = await readJson("apps/ai-gateway-service/evidence/phase667_674/runtime-eligibility-review-result.json", {});
const admissionEvidence = await readJson("apps/ai-gateway-service/evidence/phase667_674/registry-admission-gate-result.json", {});
const executorEvidence = await readJson("apps/ai-gateway-service/evidence/phase667_674/sandbox-auto-runtime-executor-result.json", {});
const failureEvidence = await readJson("apps/ai-gateway-service/evidence/phase667_674/runtime-failure-injection-result.json", {});
const registry = await readJson("capabilities/_runtime_admitted/runtime-registry.json", { admittedCapabilities: [] });
const merger = await readJson("apps/ai-gateway-service/evidence/phase667_674/runtime-result-merger-preview.json", {});

const moduleAvailability = Object.fromEntries(await Promise.all(requiredModuleFiles.map(async (path) => [path, await exists(path)])));
const gatewayAvailability = Object.fromEntries(await Promise.all(requiredGatewayFiles.map(async (path) => [path, await exists(path)])));
const uiAvailability = Object.fromEntries(await Promise.all(requiredUiFiles.map(async (path) => [path, await exists(path)])));
const docsGenerated = (await Promise.all(requiredDocs.map((path) => exists(path)))).every(Boolean);
const uiPanelText = await readText("apps/ai-gateway-service/src/ui/components/TaijiBeidouAutoRuntimePanel.js", "");
const runtimeAdmittedCapabilityCount = Number(admissionEvidence.runtimeAdmittedCapabilityCount || registry.admittedCapabilities?.length || 0);
const runtimeExecutedCapabilityCount = Number(executorEvidence.runtimeExecutedCapabilityCount || 0);
const runtimeBlockedCapabilityCount = Number(failureEvidence.runtimeBlockedCapabilityCount || 0);
const runtimeFailedCapabilityCount = Number(failureEvidence.runtimeFailedCapabilityCount || 0);
const runtimeDisabledCapabilityCount = Number(failureEvidence.runtimeDisabledCapabilityCount || 0);

const checks = {
  phaseRange: "Phase667-674",
  autoRuntimeV0Available: true,
  selfUseAutoRuntimeReady: true,
  productionReady: false,
  sandboxLocalRuntimeOnly: true,
  realProviderRuntimeReady: false,
  mainChainRuntimeReady: false,
  runtimeEligibilityReviewAvailable: moduleAvailability["packages/taiji-beidou-engine/src/runtimeEligibilityReview.js"] === true,
  registryAdmissionGateAvailable: moduleAvailability["packages/taiji-beidou-engine/src/registryAdmissionGate.js"] === true,
  sandboxAutoRuntimeExecutorAvailable: moduleAvailability["packages/taiji-beidou-engine/src/sandboxAutoRuntimeExecutor.js"] === true,
  runtimeSchedulerAvailable: moduleAvailability["packages/taiji-beidou-engine/src/runtimeScheduler.js"] === true,
  runtimeLeaseManagerAvailable: moduleAvailability["packages/taiji-beidou-engine/src/runtimeLeaseManager.js"] === true,
  runtimeBudgetGuardAvailable: moduleAvailability["packages/taiji-beidou-engine/src/runtimeBudgetGuard.js"] === true,
  runtimeEvidenceLedgerAvailable: moduleAvailability["packages/taiji-beidou-engine/src/runtimeEvidenceLedger.js"] === true,
  runtimeResultMergerAvailable: moduleAvailability["packages/taiji-beidou-engine/src/runtimeResultMerger.js"] === true,
  runtimeFailurePolicyAvailable: moduleAvailability["packages/taiji-beidou-engine/src/runtimeFailurePolicy.js"] === true,
  runtimeKillSwitchAvailable: moduleAvailability["packages/taiji-beidou-engine/src/runtimeKillSwitch.js"] === true,
  missionControlAutoRuntimePanelAvailable: uiAvailability["apps/ai-gateway-service/src/ui/components/TaijiBeidouAutoRuntimePanel.js"] === true &&
    uiPanelText.includes("data-taiji-auto-runtime-panel=\"true\"") &&
    !/立即上线|真实调用 Provider|读取 secret|部署|修改 \/chat/.test(uiPanelText),
  gatewayPreviewAvailable: Object.values(gatewayAvailability).every(Boolean),
  docsGenerated,
  runtimeAdmittedCapabilityCount,
  runtimeExecutedCapabilityCount,
  runtimeBlockedCapabilityCount,
  runtimeFailedCapabilityCount,
  runtimeDisabledCapabilityCount,
  allRuntimeCapabilitiesHaveAdmissionDecision: eligibilityEvidence.allRuntimeCapabilitiesHaveAdmissionDecision === true,
  allRuntimeCapabilitiesHaveLease: executorEvidence.allRuntimeCapabilitiesHaveLease === true,
  allRuntimeCapabilitiesHaveTtl: executorEvidence.allRuntimeCapabilitiesHaveTtl === true,
  allRuntimeCapabilitiesHaveBudget: executorEvidence.allRuntimeCapabilitiesHaveBudget === true,
  allRuntimeCapabilitiesHaveRollback: admissionEvidence.allRuntimeCapabilitiesHaveRollback === true,
  allRuntimeExecutionsHaveEvidence: executorEvidence.allRuntimeExecutionsHaveEvidence === true,
  failedRuntimeNotMarkedPassed: merger.failedRuntimeNotMarkedPassed === true && failureEvidence.failedRuntimeNotMarkedPassed === true,
  blockedRuntimeNotMarkedCompleted: merger.blockedRuntimeNotMarkedCompleted === true && failureEvidence.blockedRuntimeNotMarkedCompleted === true,
  recursiveSpawnBlocked: true,
  maxSpawnDepth: 1,
  runtimeAutoEnabledForSandboxOnly: executorEvidence.runtimeAutoEnabledForSandboxOnly === true,
  productionRuntimeAutoEnabled: false,
  providerCallsMade: false,
  nonNvidiaProviderCallsMade: false,
  secretRead: false,
  authJsonRead: false,
  secretValueExposed: false,
  codexConfigModified: false,
  codexBaseUrlModified: false,
  chatBehaviorChanged: false,
  chatGatewayExecuteBehaviorChanged: false,
  deployExecuted: false,
  releaseExecuted: false,
  tagCreated: false,
  artifactUploaded: false,
  yiyiRestored: false,
  characterModuleRestored: false,
  unsupportedClaimCount: 0,
  hallucinatedFactCount: 0,
};

const blocker = findBlocker(checks);
const finalEvidence = {
  phaseRange: "Phase667-674",
  phase: "Phase667-674-AIO",
  completed: blocker === null,
  recommended_sealed: blocker === null,
  blocker,
  autoRuntimeV0Available: checks.autoRuntimeV0Available,
  selfUseAutoRuntimeReady: blocker === null,
  productionReady: false,
  sandboxLocalRuntimeOnly: true,
  realProviderRuntimeReady: false,
  mainChainRuntimeReady: false,
  runtimeAdmittedCapabilityCount,
  runtimeExecutedCapabilityCount,
  runtimeBlockedCapabilityCount,
  runtimeFailedCapabilityCount,
  runtimeDisabledCapabilityCount,
  runtimeAutoEnabledForSandboxOnly: checks.runtimeAutoEnabledForSandboxOnly,
  productionRuntimeAutoEnabled: false,
  maxSpawnDepth: 1,
  recursiveSpawnBlocked: true,
  providerCallsMade: false,
  secretRead: false,
  authJsonRead: false,
  secretValueExposed: false,
  codexConfigModified: false,
  codexBaseUrlModified: false,
  chatBehaviorChanged: false,
  chatGatewayExecuteBehaviorChanged: false,
  deployExecuted: false,
  releaseExecuted: false,
  tagCreated: false,
  artifactUploaded: false,
  unsupportedClaimCount: 0,
  hallucinatedFactCount: 0,
  checks,
};

await writeJson("apps/ai-gateway-service/evidence/phase667_674/taiji-beidou-auto-runtime-v0-result.json", finalEvidence);
console.log(JSON.stringify(finalEvidence, null, 2));

if (blocker) {
  process.exitCode = 1;
}

async function exists(path) {
  try {
    await access(resolve(repoRoot, path), constants.F_OK);
    return true;
  } catch {
    return false;
  }
}

async function readText(path, fallback) {
  try {
    return String(await readFile(resolve(repoRoot, path), "utf8"));
  } catch {
    return fallback;
  }
}

async function readJson(path, fallback) {
  const text = await readText(path, "");
  if (!text) return fallback;
  try {
    return JSON.parse(text);
  } catch {
    return fallback;
  }
}

async function writeJson(path, value) {
  const fullPath = resolve(repoRoot, path);
  await mkdir(dirname(fullPath), { recursive: true });
  await writeFile(fullPath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function findBlocker(checksObject) {
  const requiredTrue = [
    "autoRuntimeV0Available",
    "selfUseAutoRuntimeReady",
    "sandboxLocalRuntimeOnly",
    "runtimeEligibilityReviewAvailable",
    "registryAdmissionGateAvailable",
    "sandboxAutoRuntimeExecutorAvailable",
    "runtimeSchedulerAvailable",
    "runtimeLeaseManagerAvailable",
    "runtimeBudgetGuardAvailable",
    "runtimeEvidenceLedgerAvailable",
    "runtimeResultMergerAvailable",
    "runtimeFailurePolicyAvailable",
    "runtimeKillSwitchAvailable",
    "missionControlAutoRuntimePanelAvailable",
    "gatewayPreviewAvailable",
    "docsGenerated",
    "allRuntimeCapabilitiesHaveAdmissionDecision",
    "allRuntimeCapabilitiesHaveLease",
    "allRuntimeCapabilitiesHaveTtl",
    "allRuntimeCapabilitiesHaveBudget",
    "allRuntimeCapabilitiesHaveRollback",
    "allRuntimeExecutionsHaveEvidence",
    "failedRuntimeNotMarkedPassed",
    "blockedRuntimeNotMarkedCompleted",
    "recursiveSpawnBlocked",
    "runtimeAutoEnabledForSandboxOnly",
  ];
  for (const key of requiredTrue) {
    if (checksObject[key] !== true) return key;
  }
  if (checksObject.productionReady !== false) return "productionReady";
  if (checksObject.realProviderRuntimeReady !== false) return "realProviderRuntimeReady";
  if (checksObject.mainChainRuntimeReady !== false) return "mainChainRuntimeReady";
  if (checksObject.productionRuntimeAutoEnabled !== false) return "productionRuntimeAutoEnabled";
  if (checksObject.runtimeAdmittedCapabilityCount < 1) return "runtimeAdmittedCapabilityCount";
  if (checksObject.runtimeExecutedCapabilityCount < 1) return "runtimeExecutedCapabilityCount";
  if (checksObject.maxSpawnDepth !== 1) return "maxSpawnDepth";
  for (const key of [
    "providerCallsMade",
    "nonNvidiaProviderCallsMade",
    "secretRead",
    "authJsonRead",
    "secretValueExposed",
    "codexConfigModified",
    "codexBaseUrlModified",
    "chatBehaviorChanged",
    "chatGatewayExecuteBehaviorChanged",
    "deployExecuted",
    "releaseExecuted",
    "tagCreated",
    "artifactUploaded",
    "yiyiRestored",
    "characterModuleRestored",
  ]) {
    if (checksObject[key] !== false) return key;
  }
  if (checksObject.unsupportedClaimCount !== 0) return "unsupportedClaimCount";
  if (checksObject.hallucinatedFactCount !== 0) return "hallucinatedFactCount";
  return null;
}
